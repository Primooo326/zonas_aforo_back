import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  CensoUnidad,
  CensoUnidadDocument,
  PersonaCenso,
  ParqueaderoInventario,
  ParqueaderoInventarioDocument,
  BodegaInventario,
  BodegaInventarioDocument,
  InvitacionCenso,
  InvitacionCensoDocument,
} from './censo.schema';
import { Propietario, PropietarioDocument } from '../propietarios/propietario.schema';
import * as bcrypt from 'bcrypt';
import { CreateCensoDto, PersonaCensoDto } from './dto/create-censo.dto';
import { UpdateCensoDto } from './dto/update-censo.dto';
import { PublicCensoDto } from './dto/public-censo.dto';
import { ImportarMasivoDto } from './dto/importar-masivo.dto';

export interface CensoStats {
  totalUnidades: number;
  totalPersonas: number;
  menores: number;
  adultos: number;
  adultosMayores: number;
  totalMascotas: number;
  mascotasPeligrosas: number;
  totalVehiculos: number;
  pendientes: number;
}

export function calcularEdad(fechaNacimiento: Date | string): number {
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return Math.max(0, edad);
}

export function categorizarEdad(edad: number): 'menor' | 'adulto' | 'adulto_mayor' {
  if (edad < 18) return 'menor';
  if (edad >= 60) return 'adulto_mayor';
  return 'adulto';
}

@Injectable()
export class CensoService {
  constructor(
    @InjectModel(CensoUnidad.name)
    private readonly censoModel: Model<CensoUnidadDocument>,
    @InjectModel(ParqueaderoInventario.name)
    private readonly parqueaderoModel: Model<ParqueaderoInventarioDocument>,
    @InjectModel(BodegaInventario.name)
    private readonly bodegaModel: Model<BodegaInventarioDocument>,
    @InjectModel(InvitacionCenso.name)
    private readonly invitacionModel: Model<InvitacionCensoDocument>,
    @InjectModel(Propietario.name)
    private readonly propietarioModel: Model<PropietarioDocument>,
  ) {}

  private validarPersonasYVehiculos(
    dto: { personas?: any[]; vehiculos?: any[] },
    options?: { fechaNacimientoOpcional?: boolean },
  ) {
    if (dto.personas && Array.isArray(dto.personas)) {
      const hoy = new Date();
      let contactosPrincipales = 0;

      for (const p of dto.personas) {
        if (!p.fechaNacimiento) {
          if (!options?.fechaNacimientoOpcional) {
            throw new BadRequestException(`La fecha de nacimiento es obligatoria para ${p.nombreCompleto || 'cada persona'}`);
          }
        } else {
          const nac = new Date(p.fechaNacimiento);
          if (isNaN(nac.getTime())) {
            throw new BadRequestException(`Fecha de nacimiento inválida para ${p.nombreCompleto || 'la persona'}`);
          }

          if (nac > hoy) {
            throw new BadRequestException(`La fecha de nacimiento de ${p.nombreCompleto || 'la persona'} no puede ser futura`);
          }

          const edad = calcularEdad(nac);
          if (edad > 125) {
            throw new BadRequestException(`La edad de ${p.nombreCompleto} (${edad} años) no puede superar los 125 años`);
          }

          if (edad < 18) {
            if (p.condicion === 'propietario') {
              throw new BadRequestException(`Un menor de edad (${p.nombreCompleto}, ${edad} años) no puede ser registrado como propietario`);
            }
            if (p.esContactoPrincipal) {
              throw new BadRequestException(`Un menor de edad (${p.nombreCompleto}, ${edad} años) no puede ser contacto principal`);
            }
          }
        }

        if (p.esContactoPrincipal) {
          contactosPrincipales++;
        }

        if (p.telefono && p.telefono.trim()) {
          const telLimpio = p.telefono.replace(/[\s\-\(\)\+]/g, '');
          if (!/^\d{7,15}$/.test(telLimpio)) {
            throw new BadRequestException(`El teléfono de ${p.nombreCompleto} debe contener entre 7 y 15 dígitos numéricos válidos`);
          }
        }

        if (p.email && p.email.trim()) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
            throw new BadRequestException(`El correo electrónico de ${p.nombreCompleto} no tiene un formato válido`);
          }
        }
      }

      if (contactosPrincipales > 1) {
        throw new BadRequestException('Solo puede haber un único contacto principal por unidad residencial');
      }
    }

    if (dto.vehiculos && Array.isArray(dto.vehiculos)) {
      for (const v of dto.vehiculos) {
        if (v.placa && v.placa.trim()) {
          const placaLimpia = v.placa.trim().toUpperCase().replace(/[\s\-]/g, '');
          if (placaLimpia.length < 5 || placaLimpia.length > 8) {
            throw new BadRequestException(`La placa vehicular "${v.placa}" debe tener entre 5 y 8 caracteres alfanuméricos`);
          }
          v.placa = placaLimpia;
        }
      }
    }
  }

  private normalizarVehiculos<T extends { vehiculos?: Array<{ placa: string }> }>(data: T): T {
    if (data.vehiculos && Array.isArray(data.vehiculos)) {
      data.vehiculos = data.vehiculos.map((v) => ({
        ...v,
        placa: v.placa.trim().toUpperCase().replace(/[\s\-]/g, ''),
      }));
    }
    return data;
  }

  async create(edificioId: string, dto: CreateCensoDto): Promise<CensoUnidad> {
    this.validarPersonasYVehiculos(dto);
    const data = this.normalizarVehiculos({ ...dto });
    const censo = new this.censoModel({
      ...data,
      edificioId: new Types.ObjectId(edificioId),
      estado: dto.estado || 'aprobado',
    });
    return censo.save();
  }

  async createFromPublic(
    edificioId: string,
    dto: PublicCensoDto,
  ): Promise<{ status: 'pendiente' | 'pendiente_actualizacion'; censo: CensoUnidad }> {
    this.validarPersonasYVehiculos(dto);
    const data = this.normalizarVehiculos({ ...dto });
    const edificioObjId = new Types.ObjectId(edificioId);

    // Buscar si ya existe una unidad aprobada con el mismo identificador
    const existente = await this.censoModel.findOne({
      edificioId: edificioObjId,
      identificador: new RegExp(`^${dto.identificador.trim()}$`, 'i'),
      estado: 'aprobado',
    });

    if (existente) {
      const nuevo = new this.censoModel({
        ...data,
        edificioId: edificioObjId,
        estado: 'pendiente_actualizacion',
        unidadOriginalId: existente._id,
      });
      const guardado = await nuevo.save();
      if (dto.password) {
        await this.crearCuentaResidentePendiente(guardado, dto.password, existente._id);
      }
      return { status: 'pendiente_actualizacion', censo: guardado };
    }

    const nuevo = new this.censoModel({
      ...data,
      edificioId: edificioObjId,
      estado: 'pendiente',
    });
    const guardado = await nuevo.save();
    if (dto.password) {
      await this.crearCuentaResidentePendiente(guardado, dto.password);
    }
    return { status: 'pendiente', censo: guardado };
  }

  private async crearCuentaResidentePendiente(
    censo: CensoUnidadDocument,
    rawPassword: string,
    unidadOriginalId?: Types.ObjectId,
  ) {
    try {
      const persona =
        censo.personas?.find((p) => p.esContactoPrincipal && p.email) ||
        censo.personas?.find((p) => p.email);

      if (!persona || !persona.email) return;

      const email = persona.email.trim().toLowerCase();
      const hashed = await bcrypt.hash(rawPassword, 10);
      const targetUnidadId = unidadOriginalId || censo._id;

      let cuenta = await this.propietarioModel.findOne({ email });
      if (cuenta) {
        cuenta.password = hashed;
        if (targetUnidadId) cuenta.censoUnidadId = targetUnidadId;
        cuenta.estado = 'pendiente_aprobacion';
        if (persona.nombreCompleto) cuenta.nombre = persona.nombreCompleto;
        if (persona.telefono) cuenta.telefono = persona.telefono;
        await cuenta.save();
      } else {
        await this.propietarioModel.create({
          nombre: persona.nombreCompleto || 'Residente',
          email,
          password: hashed,
          edificioId: censo.edificioId,
          censoUnidadId: targetUnidadId,
          tipoResidente: persona.condicion || 'propietario',
          estado: 'pendiente_aprobacion',
          telefono: persona.telefono,
          esContactoPrincipal: true,
        });
      }
    } catch {
      // Ignorar para no fallar el censo
    }
  }

  async findAll(
    edificioId: string,
    query?: {
      q?: string;
      estado?: string;
      condicion?: string;
    },
  ): Promise<CensoUnidad[]> {
    const filter: Record<string, unknown> = {
      edificioId: new Types.ObjectId(edificioId),
    };

    if (query?.estado) {
      filter.estado = query.estado;
    }

    if (query?.condicion) {
      filter['personas.condicion'] = query.condicion;
    }

    if (query?.q && query.q.trim()) {
      const term = query.q.trim();
      const regex = new RegExp(term, 'i');
      filter.$or = [
        { identificador: regex },
        { 'personas.nombreCompleto': regex },
        { 'personas.telefono': regex },
        { 'vehiculos.placa': regex },
      ];
    }

    return this.censoModel
      .find(filter)
      .sort({ estado: 1, identificador: 1, createdAt: -1 })
      .exec();
  }

  async findOne(id: string, edificioId: string): Promise<CensoUnidadDocument> {
    const censo = await this.censoModel
      .findOne({
        _id: new Types.ObjectId(id),
        edificioId: new Types.ObjectId(edificioId),
      })
      .exec();

    if (!censo) {
      throw new NotFoundException('Unidad de censo no encontrada');
    }

    return censo;
  }

  async update(
    id: string,
    edificioId: string,
    dto: UpdateCensoDto,
  ): Promise<CensoUnidadDocument> {
    this.validarPersonasYVehiculos(dto);
    const data = this.normalizarVehiculos({ ...dto });

    // Obtener la unidad antes de actualizar para comparar asignaciones
    const previa = await this.censoModel.findOne({
      _id: new Types.ObjectId(id),
      edificioId: new Types.ObjectId(edificioId),
    });

    if (!previa) {
      throw new NotFoundException('Unidad de censo no encontrada');
    }

    const censo = await this.censoModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          edificioId: new Types.ObjectId(edificioId),
        },
        { $set: data },
        { new: true },
      )
      .exec();

    if (!censo) {
      throw new NotFoundException('Unidad de censo no encontrada');
    }

    // Sincronización bidireccional de parqueaderos
    if (dto.parqueaderosAsignados !== undefined) {
      const numsPrevios = new Set((previa.parqueaderosAsignados || []).map((p) => p.numero.trim().toUpperCase()));
      const numsNuevos = new Set((dto.parqueaderosAsignados || []).map((p) => p.numero.trim().toUpperCase()));

      // Desasignados
      const desasignados = [...numsPrevios].filter((num) => !numsNuevos.has(num));
      if (desasignados.length > 0) {
        await this.parqueaderoModel.updateMany(
          {
            edificioId: new Types.ObjectId(edificioId),
            numero: { $in: desasignados },
          },
          { $set: { torreAsignada: '', aptoAsignado: '' } },
        );
      }

      // Asignados
      const asignados = [...numsNuevos];
      if (asignados.length > 0) {
        await this.parqueaderoModel.updateMany(
          {
            edificioId: new Types.ObjectId(edificioId),
            numero: { $in: asignados },
          },
          {
            $set: {
              torreAsignada: censo.torre || '',
              aptoAsignado: censo.numeroApto || '',
            },
          },
        );
      }
    }

    // Sincronización bidireccional de bodegas
    if (dto.bodegasAsignadas !== undefined) {
      const numsPrevios = new Set((previa.bodegasAsignadas || []).map((b) => b.numero.trim().toUpperCase()));
      const numsNuevos = new Set((dto.bodegasAsignadas || []).map((b) => b.numero.trim().toUpperCase()));

      // Desasignadas
      const desasignadas = [...numsPrevios].filter((num) => !numsNuevos.has(num));
      if (desasignadas.length > 0) {
        await this.bodegaModel.updateMany(
          {
            edificioId: new Types.ObjectId(edificioId),
            numero: { $in: desasignadas },
          },
          { $set: { torreAsignada: '', aptoAsignado: '' } },
        );
      }

      // Asignadas
      const asignadas = [...numsNuevos];
      if (asignadas.length > 0) {
        await this.bodegaModel.updateMany(
          {
            edificioId: new Types.ObjectId(edificioId),
            numero: { $in: asignadas },
          },
          {
            $set: {
              torreAsignada: censo.torre || '',
              aptoAsignado: censo.numeroApto || '',
            },
          },
        );
      }
    }

    return censo;
  }

  async agregarHabitante(
    unidadId: string,
    edificioId: string,
    dto: PersonaCensoDto,
  ): Promise<CensoUnidadDocument> {
    const censo = await this.censoModel.findOne({
      _id: new Types.ObjectId(unidadId),
      edificioId: new Types.ObjectId(edificioId),
    });

    if (!censo) {
      throw new NotFoundException('Inmueble / Unidad habitacional no encontrada');
    }

    if (!dto.nombreCompleto || !dto.nombreCompleto.trim()) {
      throw new BadRequestException('El nombre completo del habitante es obligatorio');
    }

    if (!dto.fechaNacimiento) {
      throw new BadRequestException('La fecha de nacimiento del habitante es obligatoria');
    }

    const nac = new Date(dto.fechaNacimiento);
    if (isNaN(nac.getTime())) {
      throw new BadRequestException('Fecha de nacimiento inválida');
    }

    const edad = calcularEdad(dto.fechaNacimiento);
    if (edad < 18 && dto.condicion === 'propietario') {
      throw new BadRequestException('Un menor de edad no puede ser registrado como propietario');
    }

    if (edad < 18 && dto.esContactoPrincipal) {
      throw new BadRequestException('Un menor de edad no puede ser el contacto principal');
    }

    // Si el inmueble estaba desocupado, pasa automáticamente a habitado
    if (censo.tipoOcupacion === 'desocupada') {
      censo.tipoOcupacion = 'habitada';
    }

    // Regla de contacto principal:
    // Si no había personas antes y es adulto, se asigna como contacto principal automáticamente.
    const tienePersonasPrevias = Array.isArray(censo.personas) && censo.personas.length > 0;
    const esPrimerAdulto = !tienePersonasPrevias && edad >= 18;
    const debeSerPrincipal = Boolean(dto.esContactoPrincipal || esPrimerAdulto);

    if (debeSerPrincipal) {
      // Transferir titularidad al nuevo habitante
      if (Array.isArray(censo.personas)) {
        censo.personas.forEach((p) => {
          p.esContactoPrincipal = false;
        });
      }
    }

    const nuevaPersona: PersonaCenso = {
      nombreCompleto: dto.nombreCompleto.trim(),
      telefono: dto.telefono?.trim() || '',
      email: dto.email?.trim().toLowerCase() || '',
      documento: dto.documento?.trim() || '',
      fechaNacimiento: nac,
      condicion: (dto.condicion as any) || (edad < 18 ? 'conviviente' : 'habitante'),
      esContactoPrincipal: debeSerPrincipal,
      discapacidad: Boolean(dto.discapacidad),
      condicionEspecial: dto.condicionEspecial?.trim() || '',
      adjuntoCedulaUrl: dto.adjuntoCedulaUrl?.trim() || '',
    };

    if (!Array.isArray(censo.personas)) {
      censo.personas = [];
    }
    censo.personas.push(nuevaPersona);

    return censo.save();
  }

  async remove(id: string, edificioId: string): Promise<{ deleted: boolean }> {
    const res = await this.censoModel
      .deleteOne({
        _id: new Types.ObjectId(id),
        edificioId: new Types.ObjectId(edificioId),
      })
      .exec();

    if (res.deletedCount === 0) {
      throw new NotFoundException('Unidad de censo no encontrada');
    }

    return { deleted: true };
  }

  async aprobar(id: string, edificioId: string): Promise<CensoUnidadDocument> {
    const item = await this.findOne(id, edificioId);

    if (item.estado === 'aprobado') {
      return item;
    }

    if (item.estado === 'pendiente_actualizacion' && item.unidadOriginalId) {
      // Actualizar la unidad original con los datos de esta propuesta
      const original = await this.censoModel.findOne({
        _id: item.unidadOriginalId,
        edificioId: new Types.ObjectId(edificioId),
      });

      if (original) {
        original.personas = item.personas;
        original.mascotas = item.mascotas;
        original.vehiculos = item.vehiculos;
        original.tipoOcupacion = item.tipoOcupacion;
        await original.save();

        // Activar cuentas de residentes vinculadas
        await this.propietarioModel.updateMany(
          { censoUnidadId: original._id, estado: 'pendiente_aprobacion' },
          { estado: 'activo' },
        );

        // Eliminar la solicitud de actualización temporal
        await this.censoModel.deleteOne({ _id: item._id });
        return original;
      }
    }

    // Si es pendiente simple
    item.estado = 'aprobado';
    const saved = await item.save();
    await this.propietarioModel.updateMany(
      { censoUnidadId: saved._id, estado: 'pendiente_aprobacion' },
      { estado: 'activo' },
    );
    return saved;
  }

  async rechazar(id: string, edificioId: string): Promise<CensoUnidadDocument> {
    const item = await this.findOne(id, edificioId);
    item.estado = 'rechazado';
    const saved = await item.save();
    await this.propietarioModel.updateMany(
      { censoUnidadId: saved._id, estado: 'pendiente_aprobacion' },
      { estado: 'inactivo' },
    );
    return saved;
  }

  async getStats(edificioId: string): Promise<CensoStats> {
    const unidades = await this.censoModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
      })
      .exec();

    let totalUnidades = 0;
    let totalPersonas = 0;
    let menores = 0;
    let adultos = 0;
    let adultosMayores = 0;
    let totalMascotas = 0;
    let mascotasPeligrosas = 0;
    let totalVehiculos = 0;
    let pendientes = 0;

    for (const u of unidades) {
      if (u.estado === 'pendiente' || u.estado === 'pendiente_actualizacion') {
        pendientes++;
      }

      if (u.estado === 'aprobado') {
        totalUnidades++;

        if (u.personas && Array.isArray(u.personas)) {
          for (const p of u.personas) {
            totalPersonas++;
            if (p.fechaNacimiento) {
              const edad = calcularEdad(p.fechaNacimiento);
              const cat = categorizarEdad(edad);
              if (cat === 'menor') menores++;
              else if (cat === 'adulto_mayor') adultosMayores++;
              else adultos++;
            } else {
              adultos++;
            }
          }
        }

        if (u.mascotas && Array.isArray(u.mascotas)) {
          for (const m of u.mascotas) {
            totalMascotas++;
            if (m.esPeligroso) mascotasPeligrosas++;
          }
        }

        if (u.vehiculos && Array.isArray(u.vehiculos)) {
          totalVehiculos += u.vehiculos.length;
        }
      }
    }

    return {
      totalUnidades,
      totalPersonas,
      menores,
      adultos,
      adultosMayores,
      totalMascotas,
      mascotasPeligrosas,
      totalVehiculos,
      pendientes,
    };
  }

  async importarMasivo(edificioId: string, dto: ImportarMasivoDto) {
    const edificioObjId = new Types.ObjectId(edificioId);

    const normalizarTorre = (raw?: string): string => {
      if (!raw) return '';
      const s = String(raw).trim();
      if (!s) return '';
      if (/^\d+$/.test(s)) return `Torre ${s}`;
      if (s.length === 1 && /^[a-zA-Z]$/.test(s)) return `Torre ${s.toUpperCase()}`;
      return s;
    };

    // Mapear parqueaderos por clave "torre_apto" y acumular bulkWrite
    const parqueaderosPorUnidad = new Map<string, Array<{ numero: string; tipo: string; esCubierto: boolean }>>();
    const parqBulkOps: any[] = [];
    if (dto.parqueaderos && Array.isArray(dto.parqueaderos)) {
      for (const p of dto.parqueaderos) {
        const torreNorm = normalizarTorre(p.torreAsignada);
        const aptoNorm = (p.aptoAsignado !== undefined && p.aptoAsignado !== null ? String(p.aptoAsignado) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        const rawTipo = (p.tipo || 'carro').trim().toLowerCase();
        const tipoParq = rawTipo.includes('moto') ? 'moto' : rawTipo.includes('bici') ? 'bicicleta' : 'carro';
        const numParq = p.numeroParqueadero.trim().toUpperCase();

        if (!parqueaderosPorUnidad.has(key)) {
          parqueaderosPorUnidad.set(key, []);
        }
        parqueaderosPorUnidad.get(key)!.push({
          numero: numParq,
          tipo: tipoParq,
          esCubierto: p.esCubierto !== undefined ? p.esCubierto : true,
        });

        const parqFilter: Record<string, any> = {
          edificioId: edificioObjId,
          numero: numParq,
        };
        if (torreNorm) {
          parqFilter.torreAsignada = torreNorm;
        }

        parqBulkOps.push({
          updateOne: {
            filter: parqFilter,
            update: {
              $set: {
                tipo: tipoParq,
                esVisitante: Boolean(p.esVisitante),
                esCubierto: p.esCubierto !== undefined ? p.esCubierto : true,
                torreAsignada: torreNorm || undefined,
                aptoAsignado: aptoNorm || undefined,
              },
            },
            upsert: true,
          },
        });
      }

      if (parqBulkOps.length > 0) {
        await this.parqueaderoModel.bulkWrite(parqBulkOps);
      }
    }

    // Mapear bodegas por clave "torre_apto" y acumular bulkWrite
    const bodegasPorUnidad = new Map<string, Array<{ numero: string; ubicacion?: string; metrosCuadrados?: number }>>();
    const bodegaBulkOps: any[] = [];
    if (dto.bodegas && Array.isArray(dto.bodegas)) {
      for (const b of dto.bodegas) {
        const torreNorm = normalizarTorre(b.torreAsignada);
        const aptoNorm = (b.aptoAsignado !== undefined && b.aptoAsignado !== null ? String(b.aptoAsignado) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        const numBodega = b.numeroBodega.trim().toUpperCase();

        if (!bodegasPorUnidad.has(key)) {
          bodegasPorUnidad.set(key, []);
        }
        bodegasPorUnidad.get(key)!.push({
          numero: numBodega,
          ubicacion: b.ubicacion?.trim(),
          metrosCuadrados: b.metrosCuadrados,
        });

        const bodegaFilter: Record<string, any> = {
          edificioId: edificioObjId,
          numero: numBodega,
        };
        if (torreNorm) {
          bodegaFilter.torreAsignada = torreNorm;
        }

        bodegaBulkOps.push({
          updateOne: {
            filter: bodegaFilter,
            update: {
              $set: {
                ubicacion: b.ubicacion?.trim(),
                metrosCuadrados: b.metrosCuadrados,
                torreAsignada: torreNorm || undefined,
                aptoAsignado: aptoNorm || undefined,
              },
            },
            upsert: true,
          },
        });
      }

      if (bodegaBulkOps.length > 0) {
        await this.bodegaModel.bulkWrite(bodegaBulkOps);
      }
    }

    // Mapear residentes por clave "torre_apto" o "identificador"
    const residentesPorUnidad = new Map<string, any[]>();
    if (dto.residentes && Array.isArray(dto.residentes)) {
      for (const r of dto.residentes) {
        const torreNorm = normalizarTorre(r.torre);
        const aptoNorm = (r.apto !== undefined && r.apto !== null ? String(r.apto) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        if (!residentesPorUnidad.has(key)) {
          residentesPorUnidad.set(key, []);
        }

        let fechaNac = r.fechaNacimiento?.trim() || undefined;
        if (typeof fechaNac === 'string') {
          const matchDMY = fechaNac.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (matchDMY) {
            const [, d, mStr, y] = matchDMY;
            fechaNac = `${y}-${mStr.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
        }

        const resItem = {
          nombreCompleto: r.nombreCompleto.trim(),
          documento: r.documento?.trim() || undefined,
          condicion: r.condicion?.toLowerCase().includes('prop')
            ? 'propietario'
            : r.condicion?.toLowerCase().includes('arrend')
              ? 'arrendatario'
              : 'conviviente',
          esContactoPrincipal: Boolean(r.esContactoPrincipal),
          ...(fechaNac ? { fechaNacimiento: fechaNac } : {}),
          telefono: r.telefono?.trim() || undefined,
          email: r.email?.trim() || undefined,
        };
        residentesPorUnidad.get(key)!.push(resItem);
        if (r.identificador) {
          const idKey = r.identificador.trim().toLowerCase();
          if (!residentesPorUnidad.has(idKey)) residentesPorUnidad.set(idKey, []);
          residentesPorUnidad.get(idKey)!.push(resItem);
        }
      }
    }

    // Mapear mascotas por clave "torre_apto" o "identificador" con enum normalizado
    const mascotasPorUnidad = new Map<string, any[]>();
    if (dto.mascotas && Array.isArray(dto.mascotas)) {
      for (const m of dto.mascotas) {
        const torreNorm = normalizarTorre(m.torre);
        const aptoNorm = (m.apto !== undefined && m.apto !== null ? String(m.apto) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        if (!mascotasPorUnidad.has(key)) {
          mascotasPorUnidad.set(key, []);
        }

        const rawTipo = (m.tipo || '').trim().toLowerCase();
        const tipoMascota = rawTipo.includes('gato') || rawTipo.includes('felin')
          ? 'gato'
          : rawTipo.includes('perr') || rawTipo.includes('can')
            ? 'perro'
            : (['perro', 'gato', 'otro'].includes(rawTipo) ? rawTipo : 'otro');

        const masItem = {
          tipo: tipoMascota,
          nombre: m.nombre.trim(),
          raza: m.raza?.trim() || 'Mestizo / No especificada',
          esPeligroso: Boolean(m.esPeligroso),
          vacunasAlDia: m.vacunasAlDia !== undefined ? Boolean(m.vacunasAlDia) : true,
          observaciones: m.observaciones?.trim() || undefined,
        };
        mascotasPorUnidad.get(key)!.push(masItem);
        if (m.identificador) {
          const idKey = m.identificador.trim().toLowerCase();
          if (!mascotasPorUnidad.has(idKey)) mascotasPorUnidad.set(idKey, []);
          mascotasPorUnidad.get(idKey)!.push(masItem);
        }
      }
    }

    // Mapear vehículos por clave "torre_apto" o "identificador" con enum normalizado
    const vehiculosPorUnidad = new Map<string, any[]>();
    if (dto.vehiculos && Array.isArray(dto.vehiculos)) {
      for (const v of dto.vehiculos) {
        const torreNorm = normalizarTorre(v.torre);
        const aptoNorm = (v.apto !== undefined && v.apto !== null ? String(v.apto) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        if (!vehiculosPorUnidad.has(key)) {
          vehiculosPorUnidad.set(key, []);
        }

        const rawTipo = (v.tipo || '').trim().toLowerCase();
        const tipoVehiculo = rawTipo.includes('moto')
          ? 'moto'
          : rawTipo.includes('bici')
            ? 'bicicleta'
            : (rawTipo.includes('carr') || rawTipo.includes('auto'))
              ? 'carro'
              : (['carro', 'moto', 'bicicleta', 'otro'].includes(rawTipo) ? rawTipo : 'otro');

        let placa = v.placa?.trim().toUpperCase().replace(/[\s\-]/g, '');
        if (!placa && tipoVehiculo === 'bicicleta') {
          placa = 'BIC-SN';
        }

        const vehItem = {
          tipo: tipoVehiculo,
          placa: placa || undefined,
          marca: v.marca?.trim() || undefined,
          modelo: v.modelo?.trim() || undefined,
          color: v.color?.trim() || undefined,
          parqueaEnEdificio: Boolean(v.parqueaEnEdificio),
          numeroParqueadero: v.numeroParqueadero?.trim() || undefined,
        };
        vehiculosPorUnidad.get(key)!.push(vehItem);
        if (v.identificador) {
          const idKey = v.identificador.trim().toLowerCase();
          if (!vehiculosPorUnidad.has(idKey)) vehiculosPorUnidad.set(idKey, []);
          vehiculosPorUnidad.get(idKey)!.push(vehItem);
        }
      }
    }

    // Pre-cargar unidades existentes para evitar consultas individuales masivas
    const unidadesExistentes = await this.censoModel.find({ edificioId: edificioObjId }).lean();
    const idMap = new Map<string, Types.ObjectId>();
    const torreAptoMap = new Map<string, Types.ObjectId>();
    const aptoOnlyMap = new Map<string, Types.ObjectId>();

    for (const u of unidadesExistentes) {
      if (u.identificador) idMap.set(u.identificador.trim().toLowerCase(), u._id);
      if (u.torre && u.numeroApto) {
        torreAptoMap.set(`${normalizarTorre(u.torre).toLowerCase()}:::${String(u.numeroApto).trim().toLowerCase()}`, u._id);
      } else if (u.numeroApto) {
        aptoOnlyMap.set(String(u.numeroApto).trim().toLowerCase(), u._id);
      }
    }

    let inmueblesCreados = 0;
    let inmueblesActualizados = 0;
    const censoBulkOps: any[] = [];

    for (const item of dto.inmuebles) {
      const numeroApto = (item.numeroApto !== undefined && item.numeroApto !== null ? String(item.numeroApto) : '').trim();
      if (!numeroApto) continue; // ignorar filas vacías

      const torre = normalizarTorre(item.torre);
      const identificador = torre
        ? `${torre} - Apto ${numeroApto}`
        : (numeroApto.toLowerCase().startsWith('apto') || numeroApto.toLowerCase().startsWith('casa'))
          ? numeroApto
          : `Apto ${numeroApto}`;

      const unitKey = `${torre.toLowerCase()}_${numeroApto.toLowerCase()}`;
      const parqueaderosAsignados = parqueaderosPorUnidad.get(unitKey) || [];
      const bodegasAsignadas = bodegasPorUnidad.get(unitKey) || [];
      const personasAsignadas = residentesPorUnidad.get(unitKey) || residentesPorUnidad.get(identificador.toLowerCase()) || [];
      const mascotasAsignadas = mascotasPorUnidad.get(unitKey) || mascotasPorUnidad.get(identificador.toLowerCase()) || [];
      const vehiculosAsignados = vehiculosPorUnidad.get(unitKey) || vehiculosPorUnidad.get(identificador.toLowerCase()) || [];

      // Sanitización defensiva y autorreparación para importación masiva de copropiedades
      const personasMap = new Map<string, any>();
      for (const p of personasAsignadas) {
        const nomNorm = (p.nombreCompleto || '').trim();
        if (!nomNorm) continue;
        const key = p.documento ? `doc_${String(p.documento).trim()}` : `name_${nomNorm.toLowerCase()}`;
        if (!personasMap.has(key)) {
          personasMap.set(key, { ...p, nombreCompleto: nomNorm });
        } else {
          const exist = personasMap.get(key);
          if (!exist.telefono && p.telefono) exist.telefono = p.telefono;
          if (!exist.email && p.email) exist.email = p.email;
          if (!exist.documento && p.documento) exist.documento = p.documento;
          if (!exist.fechaNacimiento && p.fechaNacimiento) exist.fechaNacimiento = p.fechaNacimiento;
        }
      }
      const personasLimpias = Array.from(personasMap.values());

      // Sanitizar emails y teléfonos para que notas libres o formatos irregulares no revienten el lote
      for (const p of personasLimpias) {
        if (p.email) {
          const emailTrim = String(p.email).trim().toLowerCase().replace(/\s+/g, '');
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
            p.email = emailTrim;
          } else {
            p.email = undefined;
          }
        }
        if (p.telefono) {
          const telDigits = String(p.telefono).replace(/\D/g, '');
          if (telDigits.length >= 7 && telDigits.length <= 15) {
            p.telefono = telDigits;
          } else {
            p.telefono = undefined;
          }
        }
      }

      // Autocorrección para menores de edad en censo masivo de copropiedades:
      // Si un menor de 18 años viene catalogado como 'propietario' o 'contactoPrincipal' en el Excel,
      // reclasificarlo automáticamente a 'conviviente' y retirar contactoPrincipal.
      for (const p of personasLimpias) {
        if (p.fechaNacimiento) {
          const nac = new Date(p.fechaNacimiento);
          if (!isNaN(nac.getTime())) {
            const edad = calcularEdad(nac);
            if (edad < 18) {
              if (p.condicion === 'propietario') {
                p.condicion = 'conviviente';
              }
              p.esContactoPrincipal = false;
            }
          }
        }
      }

      // Garantizar estricto UN ÚNICO contacto principal adulto por unidad residencial
      let contactoPrincipalAsignado = false;
      for (const p of personasLimpias) {
        const nac = p.fechaNacimiento ? new Date(p.fechaNacimiento) : null;
        const edad = nac && !isNaN(nac.getTime()) ? calcularEdad(nac) : 99;
        if (p.esContactoPrincipal && edad >= 18) {
          if (!contactoPrincipalAsignado) {
            contactoPrincipalAsignado = true;
          } else {
            p.esContactoPrincipal = false;
          }
        } else if (edad < 18) {
          p.esContactoPrincipal = false;
        }
      }
      if (!contactoPrincipalAsignado && personasLimpias.length > 0) {
        const primerAdulto = personasLimpias.find((p) => {
          const nac = p.fechaNacimiento ? new Date(p.fechaNacimiento) : null;
          const edad = nac && !isNaN(nac.getTime()) ? calcularEdad(nac) : 99;
          return edad >= 18;
        });
        if (primerAdulto) {
          primerAdulto.esContactoPrincipal = true;
        } else {
          personasLimpias[0].esContactoPrincipal = true;
        }
      }

      // Sanitizar vehículos: si la placa trae textos descriptivos o formato irregular, limpiar
      const vehiculosLimpios: any[] = [];
      for (const v of vehiculosAsignados) {
        const placaLimpia = String(v.placa || '').trim().toUpperCase().replace(/[\s\-]/g, '');
        if (placaLimpia.length >= 5 && placaLimpia.length <= 8) {
          vehiculosLimpios.push({ ...v, placa: placaLimpia });
        } else if (v.tipo === 'bicicleta') {
          vehiculosLimpios.push({ ...v, placa: 'BIC-SN' });
        } else if (v.tipo || v.marca || v.modelo) {
          vehiculosLimpios.push({ ...v, placa: undefined });
        }
      }

      if (personasLimpias.length > 0 || vehiculosLimpios.length > 0) {
        this.validarPersonasYVehiculos(
          { personas: personasLimpias, vehiculos: vehiculosLimpios },
          { fechaNacimientoOpcional: true },
        );
      }

      const idKey = identificador.toLowerCase();
      const torreAptoKey = `${torre.toLowerCase()}:::${numeroApto.toLowerCase()}`;
      const aptoKey = numeroApto.toLowerCase();

      let existingId: Types.ObjectId | undefined = undefined;
      if (idMap.has(idKey)) {
        existingId = idMap.get(idKey);
      } else if (torre && torreAptoMap.has(torreAptoKey)) {
        existingId = torreAptoMap.get(torreAptoKey);
      } else if (!torre && aptoOnlyMap.has(aptoKey)) {
        existingId = aptoOnlyMap.get(aptoKey);
      }

      const rawOcup = (item.tipoOcupacion || '').trim().toLowerCase();
      const tipoOcupacion = rawOcup.includes('desoc') ? 'desocupada' : 'habitada';

      if (existingId) {
        const updateFields: Record<string, any> = {
          identificador,
          numeroApto,
          tipoOcupacion,
        };
        if (torre) updateFields.torre = torre;
        if (item.piso !== undefined) updateFields.piso = item.piso;
        if (item.cuartos !== undefined) updateFields.cuartos = item.cuartos;
        if (item.banos !== undefined) updateFields.banos = item.banos;
        if (item.tieneBalcon !== undefined) updateFields.tieneBalcon = item.tieneBalcon;
        if (item.metrosCuadrados !== undefined) updateFields.metrosCuadrados = item.metrosCuadrados;
        if (item.tienePatio !== undefined) updateFields.tienePatio = item.tienePatio;
        if (item.coeficiente !== undefined) updateFields.coeficiente = item.coeficiente;
        if (parqueaderosAsignados.length > 0) updateFields.parqueaderosAsignados = parqueaderosAsignados;
        if (bodegasAsignadas.length > 0) updateFields.bodegasAsignadas = bodegasAsignadas;
        if (personasLimpias.length > 0) updateFields.personas = personasLimpias;
        if (mascotasAsignadas.length > 0) updateFields.mascotas = mascotasAsignadas;
        if (vehiculosLimpios.length > 0) updateFields.vehiculos = vehiculosLimpios;

        censoBulkOps.push({
          updateOne: {
            filter: { _id: existingId },
            update: { $set: updateFields },
          },
        });
        inmueblesActualizados++;
      } else {
        const newId = new Types.ObjectId();
        censoBulkOps.push({
          insertOne: {
            document: {
              _id: newId,
              edificioId: edificioObjId,
              identificador,
              torre: torre || undefined,
              numeroApto,
              piso: item.piso,
              cuartos: item.cuartos,
              banos: item.banos,
              tieneBalcon: item.tieneBalcon || false,
              metrosCuadrados: item.metrosCuadrados,
              tienePatio: item.tienePatio || false,
              coeficiente: item.coeficiente,
              tipoOcupacion,
              parqueaderosAsignados,
              bodegasAsignadas,
              personas: personasLimpias,
              mascotas: mascotasAsignadas,
              vehiculos: vehiculosLimpios,
              estado: 'aprobado',
            },
          },
        });
        idMap.set(idKey, newId);
        if (torre) torreAptoMap.set(torreAptoKey, newId);
        else aptoOnlyMap.set(aptoKey, newId);
        inmueblesCreados++;
      }
    }

    if (censoBulkOps.length > 0) {
      await this.censoModel.bulkWrite(censoBulkOps);
    }

    return {
      success: true,
      inmueblesCreados,
      inmueblesActualizados,
      totalInmuebles: dto.inmuebles.length,
      parqueaderosProcesados: dto.parqueaderos?.length || 0,
      bodegasProcesadas: dto.bodegas?.length || 0,
      residentesProcesados: dto.residentes?.length || 0,
      mascotasProcesadas: dto.mascotas?.length || 0,
      vehiculosProcesados: dto.vehiculos?.length || 0,
    };
  }

  async getCatalogoUnidades(edificioId: string) {
    return this.censoModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        estado: 'aprobado',
      })
      .select(
        'identificador torre numeroApto piso metrosCuadrados tieneBalcon tienePatio parqueaderosAsignados bodegasAsignadas personas',
      )
      .sort({ torre: 1, numeroApto: 1 })
      .lean();
  }

  async getPublicCatalogoUnidades(edificioId: string) {
    return this.censoModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        estado: 'aprobado',
      })
      .select('identificador torre numeroApto')
      .sort({ torre: 1, numeroApto: 1 })
      .lean();
  }

  async getInventarioParqueaderos(edificioId: string) {
    return this.parqueaderoModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .sort({ numero: 1 })
      .exec();
  }

  async getInventarioBodegas(edificioId: string) {
    return this.bodegaModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .sort({ numero: 1 })
      .exec();
  }

  async resetEdificio(edificioId: string) {
    const edificioObjId = new Types.ObjectId(edificioId);
    await this.censoModel.deleteMany({ edificioId: edificioObjId });
    await this.parqueaderoModel.deleteMany({ edificioId: edificioObjId });
    await this.bodegaModel.deleteMany({ edificioId: edificioObjId });
    return { success: true, message: 'Inventario y censo del edificio reseteados con éxito' };
  }

  async crearInvitacion(
    edificioId: string,
    diasValidez = 7,
    inmueblePredefinido?: string,
    creadoPor?: string,
  ) {
    const token = randomBytes(24).toString('hex');
    const expiraEn = new Date(Date.now() + (diasValidez || 7) * 24 * 60 * 60 * 1000);
    const invitacion = new this.invitacionModel({
      edificioId: new Types.ObjectId(edificioId),
      token,
      expiraEn,
      inmueblePredefinido,
      creadoPor,
    });
    await invitacion.save();
    return {
      token,
      expiraEn,
      diasValidez: diasValidez || 7,
      inmueblePredefinido,
    };
  }

  async getInvitaciones(edificioId: string) {
    return this.invitacionModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async validarInvitacion(token: string) {
    const inv = await this.invitacionModel
      .findOne({ token })
      .populate('edificioId', 'nombre direccion telefono')
      .exec();
    if (!inv) {
      throw new NotFoundException('Enlace de invitación inválido o no encontrado');
    }
    if (inv.utilizado) {
      throw new BadRequestException('El enlace de invitación al censo ya ha sido utilizado.');
    }
    if (new Date() > new Date(inv.expiraEn)) {
      throw new BadRequestException('El enlace de invitación al censo ha expirado. Por favor solicita uno nuevo.');
    }
    return inv;
  }

  async responderInvitacion(token: string, dto: PublicCensoDto) {
    const inv = await this.validarInvitacion(token);
    if (inv.inmueblePredefinido) {
      const predefNorm = inv.inmueblePredefinido.trim().toLowerCase();
      const dtoIdentNorm = (dto.identificador || '').trim().toLowerCase();
      if (dtoIdentNorm && dtoIdentNorm !== predefNorm) {
        throw new BadRequestException(
          `Esta invitación está restringida exclusivamente a la unidad "${inv.inmueblePredefinido}".`,
        );
      }
      dto.identificador = inv.inmueblePredefinido;
    }
    const edificioId = (inv.edificioId as any)._id?.toString() || inv.edificioId.toString();
    const res = await this.createFromPublic(edificioId, dto);
    inv.utilizado = true;
    await inv.save();
    return res;
  }

  async actualizarTags(id: string, edificioId: string, tags: string[]) {
    const censo = await this.censoModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        edificioId: new Types.ObjectId(edificioId),
      },
      { $set: { tags: tags || [] } },
      { new: true },
    );
    if (!censo) {
      throw new NotFoundException('Unidad de censo no encontrada');
    }
    return censo;
  }
}
