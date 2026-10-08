import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CensoUnidad,
  CensoUnidadDocument,
  PersonaCenso,
  ParqueaderoInventario,
  ParqueaderoInventarioDocument,
  BodegaInventario,
  BodegaInventarioDocument,
} from './censo.schema';
import { CreateCensoDto } from './dto/create-censo.dto';
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
  ) {}

  private validarPersonasYVehiculos(dto: { personas?: any[]; vehiculos?: any[] }) {
    if (dto.personas && Array.isArray(dto.personas)) {
      const hoy = new Date();
      let contactosPrincipales = 0;

      for (const p of dto.personas) {
        if (!p.fechaNacimiento) {
          throw new BadRequestException(`La fecha de nacimiento es obligatoria para ${p.nombreCompleto || 'cada persona'}`);
        }

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
      return { status: 'pendiente_actualizacion', censo: guardado };
    }

    const nuevo = new this.censoModel({
      ...data,
      edificioId: edificioObjId,
      estado: 'pendiente',
    });
    const guardado = await nuevo.save();
    return { status: 'pendiente', censo: guardado };
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

    return censo;
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

        // Eliminar la solicitud de actualización temporal
        await this.censoModel.deleteOne({ _id: item._id });
        return original;
      }
    }

    // Si es pendiente simple
    item.estado = 'aprobado';
    return item.save();
  }

  async rechazar(id: string, edificioId: string): Promise<CensoUnidadDocument> {
    const item = await this.findOne(id, edificioId);
    item.estado = 'rechazado';
    return item.save();
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

    // Mapear parqueaderos por clave "torre_apto"
    const parqueaderosPorUnidad = new Map<string, Array<{ numero: string; tipo: string; esCubierto: boolean }>>();
    if (dto.parqueaderos && Array.isArray(dto.parqueaderos)) {
      for (const p of dto.parqueaderos) {
        const torreNorm = normalizarTorre(p.torreAsignada);
        const aptoNorm = (p.aptoAsignado !== undefined && p.aptoAsignado !== null ? String(p.aptoAsignado) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        if (!parqueaderosPorUnidad.has(key)) {
          parqueaderosPorUnidad.set(key, []);
        }
        parqueaderosPorUnidad.get(key)!.push({
          numero: p.numeroParqueadero.trim(),
          tipo: p.tipo || 'carro',
          esCubierto: p.esCubierto !== undefined ? p.esCubierto : true,
        });

        // Registrar o actualizar en el inventario global de parqueaderos
        const parqFilter: Record<string, any> = {
          edificioId: edificioObjId,
          numero: p.numeroParqueadero.trim().toUpperCase(),
        };
        if (torreNorm) {
          parqFilter.torreAsignada = torreNorm;
        }

        await this.parqueaderoModel.findOneAndUpdate(
          parqFilter,
          {
            $set: {
              tipo: p.tipo || 'carro',
              esVisitante: Boolean(p.esVisitante),
              esCubierto: p.esCubierto !== undefined ? p.esCubierto : true,
              torreAsignada: torreNorm || undefined,
              aptoAsignado: aptoNorm || undefined,
            },
          },
          { upsert: true, new: true },
        );
      }
    }

    // Mapear bodegas por clave "torre_apto"
    const bodegasPorUnidad = new Map<string, Array<{ numero: string; ubicacion?: string; metrosCuadrados?: number }>>();
    if (dto.bodegas && Array.isArray(dto.bodegas)) {
      for (const b of dto.bodegas) {
        const torreNorm = normalizarTorre(b.torreAsignada);
        const aptoNorm = (b.aptoAsignado !== undefined && b.aptoAsignado !== null ? String(b.aptoAsignado) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        if (!bodegasPorUnidad.has(key)) {
          bodegasPorUnidad.set(key, []);
        }
        bodegasPorUnidad.get(key)!.push({
          numero: b.numeroBodega.trim(),
          ubicacion: b.ubicacion?.trim(),
          metrosCuadrados: b.metrosCuadrados,
        });

        // Registrar o actualizar en el inventario global de bodegas
        const bodegaFilter: Record<string, any> = {
          edificioId: edificioObjId,
          numero: b.numeroBodega.trim().toUpperCase(),
        };
        if (torreNorm) {
          bodegaFilter.torreAsignada = torreNorm;
        }

        await this.bodegaModel.findOneAndUpdate(
          bodegaFilter,
          {
            $set: {
              ubicacion: b.ubicacion?.trim(),
              metrosCuadrados: b.metrosCuadrados,
              torreAsignada: torreNorm || undefined,
              aptoAsignado: aptoNorm || undefined,
            },
          },
          { upsert: true, new: true },
        );
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
        const resItem = {
          nombreCompleto: r.nombreCompleto.trim(),
          documento: r.documento?.trim() || undefined,
          condicion: r.condicion?.toLowerCase().includes('prop')
            ? 'propietario'
            : r.condicion?.toLowerCase().includes('arrend')
              ? 'arrendatario'
              : 'conviviente',
          esContactoPrincipal: Boolean(r.esContactoPrincipal),
          fechaNacimiento: r.fechaNacimiento,
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

    // Mapear mascotas por clave "torre_apto" o "identificador"
    const mascotasPorUnidad = new Map<string, any[]>();
    if (dto.mascotas && Array.isArray(dto.mascotas)) {
      for (const m of dto.mascotas) {
        const torreNorm = normalizarTorre(m.torre);
        const aptoNorm = (m.apto !== undefined && m.apto !== null ? String(m.apto) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        if (!mascotasPorUnidad.has(key)) {
          mascotasPorUnidad.set(key, []);
        }
        const masItem = {
          tipo: m.tipo.trim(),
          nombre: m.nombre.trim(),
          raza: m.raza?.trim() || undefined,
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

    // Mapear vehiculos por clave "torre_apto" o "identificador"
    const vehiculosPorUnidad = new Map<string, any[]>();
    if (dto.vehiculos && Array.isArray(dto.vehiculos)) {
      for (const v of dto.vehiculos) {
        const torreNorm = normalizarTorre(v.torre);
        const aptoNorm = (v.apto !== undefined && v.apto !== null ? String(v.apto) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        if (!vehiculosPorUnidad.has(key)) {
          vehiculosPorUnidad.set(key, []);
        }
        const vehItem = {
          tipo: v.tipo.trim(),
          placa: v.placa?.trim().toUpperCase() || undefined,
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

    let inmueblesCreados = 0;
    let inmueblesActualizados = 0;

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

      if (personasAsignadas.length > 0 || vehiculosAsignados.length > 0) {
        this.validarPersonasYVehiculos({ personas: personasAsignadas, vehiculos: vehiculosAsignados });
      }

      // Buscar si ya existe la unidad por torre+apto o por identificador
      const orConditions: any[] = [{ identificador: new RegExp(`^${identificador}$`, 'i') }];
      if (torre) {
        orConditions.push({
          torre: new RegExp(`^${torre}$`, 'i'),
          numeroApto: new RegExp(`^${numeroApto}$`, 'i'),
        });
      } else {
        orConditions.push({
          numeroApto: new RegExp(`^${numeroApto}$`, 'i'),
        });
      }

      const existente = await this.censoModel.findOne({
        edificioId: edificioObjId,
        $or: orConditions,
      });

      if (existente) {
        if (item.piso !== undefined) existente.piso = item.piso;
        if (item.cuartos !== undefined) existente.cuartos = item.cuartos;
        if (item.banos !== undefined) existente.banos = item.banos;
        if (item.tieneBalcon !== undefined) existente.tieneBalcon = item.tieneBalcon;
        if (item.metrosCuadrados !== undefined) existente.metrosCuadrados = item.metrosCuadrados;
        if (item.tienePatio !== undefined) existente.tienePatio = item.tienePatio;
        if (item.coeficiente !== undefined) existente.coeficiente = item.coeficiente;
        if (item.tipoOcupacion) existente.tipoOcupacion = item.tipoOcupacion as any;
        if (parqueaderosAsignados.length > 0) existente.parqueaderosAsignados = parqueaderosAsignados;
        if (bodegasAsignadas.length > 0) existente.bodegasAsignadas = bodegasAsignadas;
        if (personasAsignadas.length > 0) existente.personas = personasAsignadas;
        if (mascotasAsignadas.length > 0) existente.mascotas = mascotasAsignadas;
        if (vehiculosAsignados.length > 0) existente.vehiculos = vehiculosAsignados;

        await existente.save();
        inmueblesActualizados++;
      } else {
        const nuevaUnidad = new this.censoModel({
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
          tipoOcupacion: (item.tipoOcupacion as any) || 'habitada',
          parqueaderosAsignados,
          bodegasAsignadas,
          personas: personasAsignadas,
          mascotas: mascotasAsignadas,
          vehiculos: vehiculosAsignados,
          estado: 'aprobado',
        });
        await nuevaUnidad.save();
        inmueblesCreados++;
      }
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
}
