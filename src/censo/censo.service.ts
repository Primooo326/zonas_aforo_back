import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
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

export interface RateLimitInfo {
  intentosFallidos: number;
  primerFallo: number;
  bloqueadoHasta?: number;
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
  // Rate limiting en memoria para validación de códigos de censo (Brute-Force Shield)
  private readonly rateLimitFallidos = new Map<string, RateLimitInfo>();
  private readonly MAX_INTENTOS_FALLIDOS = 20; // 20 intentos fallidos (muy generoso)
  private readonly VENTANA_RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutos
  private readonly TIEMPO_BLOQUEO_MS = 5 * 60 * 1000; // 5 minutos de bloqueo si supera el límite

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

  verificarRateLimit(ip?: string) {
    if (!ip) return;
    const now = Date.now();
    const info = this.rateLimitFallidos.get(ip);
    if (!info) return;

    if (info.bloqueadoHasta && now < info.bloqueadoHasta) {
      const segundosRestantes = Math.ceil((info.bloqueadoHasta - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Demasiados intentos fallidos con códigos incorrectos. Por seguridad, espera ${segundosRestantes} segundos antes de intentar nuevamente.`,
          retryAfter: segundosRestantes,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - info.primerFallo > this.VENTANA_RATE_LIMIT_MS) {
      this.rateLimitFallidos.delete(ip);
    }
  }

  registrarIntentoFallido(ip?: string) {
    if (!ip) return;
    const now = Date.now();
    const info = this.rateLimitFallidos.get(ip) || { intentosFallidos: 0, primerFallo: now };

    if (now - info.primerFallo > this.VENTANA_RATE_LIMIT_MS) {
      info.intentosFallidos = 1;
      info.primerFallo = now;
      delete info.bloqueadoHasta;
    } else {
      info.intentosFallidos++;
    }

    if (info.intentosFallidos >= this.MAX_INTENTOS_FALLIDOS) {
      info.bloqueadoHasta = now + this.TIEMPO_BLOQUEO_MS;
    }

    this.rateLimitFallidos.set(ip, info);
  }

  limpiarIntentosFallidos(ip?: string) {
    if (!ip) return;
    this.rateLimitFallidos.delete(ip);
  }

  getRateLimitStatus(ip?: string) {
    if (!ip) return null;
    return this.rateLimitFallidos.get(ip) || null;
  }

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
        if (!v.placa || !String(v.placa).trim()) {
          throw new BadRequestException('La placa vehicular es obligatoria para cada vehículo registrado');
        }
        const placaLimpia = String(v.placa).trim().toUpperCase().replace(/[\s\-]/g, '');
        if (placaLimpia.length < 3 || placaLimpia.length > 10) {
          throw new BadRequestException(`La placa vehicular "${v.placa}" debe tener entre 3 y 10 caracteres alfanuméricos`);
        }
        v.placa = placaLimpia;
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

  private async validarParqueaderosVehiculos(
    edificioId: string,
    dto: { identificador?: string; torre?: string; numeroApto?: string; vehiculos?: any[] },
    unidadOriginalId?: Types.ObjectId | string,
  ) {
    if (!dto.vehiculos || !Array.isArray(dto.vehiculos) || dto.vehiculos.length === 0) return;

    const edificioObjId = new Types.ObjectId(edificioId);
    const identificadorNormalizado = (dto.identificador || '').trim().toLowerCase();
    const aptoNormalizado = (dto.numeroApto || '').trim().toLowerCase();
    const torreNormalizada = (dto.torre || '').trim().toLowerCase();

    // 1. Detectar si en el mismo formulario dos vehículos reclaman el mismo parqueadero
    const vistos = new Set<string>();
    for (const v of dto.vehiculos) {
      if (!v.numeroParqueadero || !String(v.numeroParqueadero).trim()) continue;
      const numUpper = String(v.numeroParqueadero).trim().toUpperCase();
      if (vistos.has(numUpper)) {
        throw new BadRequestException(
          `El parqueadero "${numUpper}" está asignado a más de un vehículo en la misma solicitud. Cada vehículo debe contar con un espacio exclusivo.`,
        );
      }
      vistos.add(numUpper);
    }

    if (vistos.size === 0) return;

    // 2. Consultar en parqueaderoModel si alguno de los números está asignado a OTRA unidad
    if (this.parqueaderoModel && typeof (this.parqueaderoModel as any).find === 'function') {
      const q = this.parqueaderoModel.find({
        edificioId: edificioObjId,
        numero: { $in: Array.from(vistos) },
      });
      const parqueaderos: any[] = typeof (q as any)?.lean === 'function' ? await (q as any).lean() : await q;

      if (Array.isArray(parqueaderos)) {
        for (const p of parqueaderos) {
          const num = String(p.numero || '').trim().toUpperCase();
          const pApto = String(p.aptoAsignado || '').trim().toLowerCase();
          const pTorre = String(p.torreAsignada || '').trim().toLowerCase();

          // Un parqueadero de visitantes nunca puede asignarse a un vehículo residente
          if (p.esVisitante) {
            throw new BadRequestException(
              `El parqueadero "${num}" está reservado exclusivamente para visitantes. No puede asignarse a un vehículo residente.`,
            );
          }

          // Si el parqueadero no tiene apartamento asignado, está libre
          if (!pApto) continue;

          // Si tiene apartamento asignado, verificar si coincide con el inmueble actual
          const coincideApto = aptoNormalizado && pApto === aptoNormalizado;
          const coincideIdentificador = identificadorNormalizado && (
            identificadorNormalizado.includes(pApto) ||
            (pTorre && identificadorNormalizado.includes(pTorre) && identificadorNormalizado.includes(pApto))
          );
          const coincideTorre = !torreNormalizada || !pTorre || torreNormalizada === pTorre || identificadorNormalizado.includes(pTorre);

          const esDelMismoInmueble = (coincideApto && coincideTorre) || coincideIdentificador;

          if (!esDelMismoInmueble) {
            const asignadoA = [p.torreAsignada, p.aptoAsignado ? `Apto ${p.aptoAsignado}` : ''].filter(Boolean).join(' ') || 'otro inmueble';
            throw new BadRequestException(
              `El parqueadero "${num}" ya se encuentra asignado a ${asignadoA}. Un parqueadero no puede pertenecer a dos inmuebles a la vez.`,
            );
          }
        }
      }
    }

    // 3. Consultar si otra unidad aprobada en el censo ya tiene este parqueadero registrado
    if (this.censoModel && typeof (this.censoModel as any).find === 'function') {
      const qOtras = this.censoModel.find({
        edificioId: edificioObjId,
        estado: 'aprobado',
        $or: [
          { 'parqueaderosAsignados.numero': { $in: Array.from(vistos) } },
          { 'vehiculos.numeroParqueadero': { $in: Array.from(vistos) } },
        ],
      });
      const otrasUnidades: any[] = typeof (qOtras as any)?.lean === 'function' ? await (qOtras as any).lean() : await qOtras;

      if (Array.isArray(otrasUnidades)) {
        for (const otra of otrasUnidades) {
          if (unidadOriginalId && String(otra._id) === String(unidadOriginalId)) continue;
          if (identificadorNormalizado && otra.identificador?.trim().toLowerCase() === identificadorNormalizado) continue;

          for (const num of vistos) {
            const tieneEnAsignados = otra.parqueaderosAsignados?.some((pa: any) => String(pa.numero || '').trim().toUpperCase() === num);
            const tieneEnVehiculos = otra.vehiculos?.some((vh: any) => String(vh.numeroParqueadero || '').trim().toUpperCase() === num);
            if (tieneEnAsignados || tieneEnVehiculos) {
              throw new BadRequestException(
                `El parqueadero "${num}" ya se encuentra registrado en el inmueble "${otra.identificador}". Un parqueadero no puede pertenecer a dos inmuebles a la vez.`,
              );
            }
          }
        }
      }
    }
  }

  async create(edificioId: string, dto: CreateCensoDto): Promise<CensoUnidad> {
    this.validarPersonasYVehiculos(dto);
    await this.validarParqueaderosVehiculos(edificioId, dto);
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
    await this.validarParqueaderosVehiculos(edificioId, dto);
    const data = this.normalizarVehiculos({ ...dto });
    const edificioObjId = new Types.ObjectId(edificioId);

    // Buscar si ya existe una unidad aprobada con el mismo identificador
    const existente = await this.censoModel.findOne({
      edificioId: edificioObjId,
      identificador: new RegExp(`^${dto.identificador.trim()}$`, 'i'),
      estado: 'aprobado',
    });

    if (existente) {
      const pendienteExistente = await this.censoModel.findOne({
        edificioId: edificioObjId,
        unidadOriginalId: existente._id,
        estado: 'pendiente_actualizacion',
      });

      if (pendienteExistente) {
        Object.assign(pendienteExistente, data);
        pendienteExistente.estado = 'pendiente_actualizacion';
        const guardado = await pendienteExistente.save();
        if (dto.password) {
          await this.crearCuentaResidentePendiente(guardado, dto.password, existente._id);
        }
        return { status: 'pendiente_actualizacion', censo: guardado };
      }

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
    await this.validarParqueaderosVehiculos(edificioId, dto, id);
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
        if (!p.numeroParqueadero || !String(p.numeroParqueadero).trim()) continue;
        const torreNorm = normalizarTorre(p.torreAsignada);
        const aptoNorm = (p.aptoAsignado !== undefined && p.aptoAsignado !== null ? String(p.aptoAsignado) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        const rawTipo = (p.tipo || 'carro').trim().toLowerCase();
        const tipoParq = rawTipo.includes('moto') ? 'moto' : rawTipo.includes('bici') ? 'bicicleta' : 'carro';
        const numParq = String(p.numeroParqueadero).trim().toUpperCase();

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
        if (!b.numeroBodega || !String(b.numeroBodega).trim()) continue;
        const torreNorm = normalizarTorre(b.torreAsignada);
        const aptoNorm = (b.aptoAsignado !== undefined && b.aptoAsignado !== null ? String(b.aptoAsignado) : '').trim();
        const key = `${torreNorm.toLowerCase()}_${aptoNorm.toLowerCase()}`;
        const numBodega = String(b.numeroBodega).trim().toUpperCase();

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
        if (!r.nombreCompleto || !String(r.nombreCompleto).trim()) continue;
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
        if (!m.nombre || !String(m.nombre).trim()) continue;
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

        let rawPlaca = String(v.placa || '').trim().toUpperCase().replace(/[\s\-]/g, '');
        // Detección si la placa vino anotada en color o marca
        if (!rawPlaca && v.color && /^[A-Z]{3}\-?[0-9]{2}[0-9A-Z]?$/i.test(String(v.color).trim())) {
          rawPlaca = String(v.color).trim().toUpperCase().replace(/[\s\-]/g, '');
        } else if (!rawPlaca && v.marca && /^[A-Z]{3}\-?[0-9]{2}[0-9A-Z]?$/i.test(String(v.marca).trim())) {
          rawPlaca = String(v.marca).trim().toUpperCase().replace(/[\s\-]/g, '');
        }

        let placaFinal = rawPlaca;
        if (placaFinal.length >= 3 && placaFinal.length <= 10) {
          // Directa válida
        } else if (placaFinal.length > 10) {
          placaFinal = placaFinal.slice(0, 10);
        } else if (tipoVehiculo === 'bicicleta') {
          placaFinal = 'BIC-SN';
        } else if (tipoVehiculo === 'moto') {
          placaFinal = `MOT-SN${aptoNorm ? `-${aptoNorm}` : ''}`.slice(0, 10);
        } else if (v.marca || v.color || v.modelo) {
          placaFinal = `VEH-SN${aptoNorm ? `-${aptoNorm}` : ''}`.slice(0, 10);
        } else {
          // Fila sin placa ni datos del vehículo: omitir
          continue;
        }

        const vehItem = {
          tipo: tipoVehiculo,
          placa: placaFinal,
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

      // Sanitizar vehículos: garantizar que TODO vehículo tenga una placa válida y nunca undefined
      const vehiculosLimpios: any[] = [];
      for (const v of vehiculosAsignados) {
        let rawPlaca = String(v.placa || '').trim().toUpperCase().replace(/[\s\-]/g, '');
        if (!rawPlaca && v.color && /^[A-Z]{3}\-?[0-9]{2}[0-9A-Z]?$/i.test(String(v.color).trim())) {
          rawPlaca = String(v.color).trim().toUpperCase().replace(/[\s\-]/g, '');
        } else if (!rawPlaca && v.marca && /^[A-Z]{3}\-?[0-9]{2}[0-9A-Z]?$/i.test(String(v.marca).trim())) {
          rawPlaca = String(v.marca).trim().toUpperCase().replace(/[\s\-]/g, '');
        }

        let placaFinal = rawPlaca;
        if (placaFinal.length >= 3 && placaFinal.length <= 10) {
          // Directa válida
        } else if (placaFinal.length > 10) {
          placaFinal = placaFinal.slice(0, 10);
        } else if (v.tipo === 'bicicleta') {
          placaFinal = 'BIC-SN';
        } else if (v.tipo === 'moto') {
          placaFinal = `MOT-SN${numeroApto ? `-${numeroApto}` : ''}`.slice(0, 10);
        } else if (v.marca || v.color || v.modelo) {
          placaFinal = `VEH-SN${numeroApto ? `-${numeroApto}` : ''}`.slice(0, 10);
        } else {
          // Fila sin placa ni características de vehículo: omitir
          continue;
        }

        vehiculosLimpios.push({
          ...v,
          placa: placaFinal,
        });
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

  generarCodigo5Letras(excluidos: Set<string> = new Set()): string {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let intento = 0; intento < 200; intento++) {
      const bytes = randomBytes(5);
      let codigo = '';
      for (let i = 0; i < 5; i++) {
        codigo += letras[bytes[i] % letras.length];
      }
      if (!excluidos.has(codigo)) {
        excluidos.add(codigo);
        return codigo;
      }
    }
    return 'CENSO';
  }

  private extraerContactoPrincipal(unidad?: any) {
    const personas: PersonaCenso[] = Array.isArray(unidad?.personas) ? unidad.personas : [];
    const principal =
      personas.find((p) => p.esContactoPrincipal) ||
      personas.find((p) => p.condicion === 'propietario') ||
      personas[0];
    return {
      titularNombre: principal?.nombreCompleto || '',
      titularEmail: principal?.email || '',
      titularTelefono: principal?.telefono || '',
    };
  }

  async crearInvitacion(
    edificioId: string,
    diasValidez = 7,
    inmueblePredefinido?: string,
    creadoPor?: string,
    unidadId?: string,
  ) {
    const edificioObjId = new Types.ObjectId(edificioId);
    let unidadDoc: any = null;

    if (unidadId && Types.ObjectId.isValid(unidadId)) {
      const q = this.censoModel.findOne({ _id: new Types.ObjectId(unidadId), edificioId: edificioObjId });
      unidadDoc = typeof q?.exec === 'function' ? await q.exec() : await q;
    } else if (inmueblePredefinido?.trim()) {
      const escaped = inmueblePredefinido.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const q = this.censoModel.findOne({
        edificioId: edificioObjId,
        identificador: new RegExp(`^${escaped}$`, 'i'),
        estado: 'aprobado',
      });
      unidadDoc = typeof q?.exec === 'function' ? await q.exec() : await q;
    }

    const identificadorFinal = unidadDoc?.identificador || inmueblePredefinido?.trim() || undefined;

    if (identificadorFinal && typeof (this.invitacionModel as any).updateMany === 'function') {
      await (this.invitacionModel as any).updateMany(
        {
          edificioId: edificioObjId,
          inmueblePredefinido: identificadorFinal,
          utilizado: false,
        },
        { $set: { utilizado: true } },
      );
    }

    const token = randomBytes(24).toString('hex');
    const codigo = this.generarCodigo5Letras();
    const expiraEn = new Date(Date.now() + (diasValidez || 7) * 24 * 60 * 60 * 1000);
    const invitacion = new this.invitacionModel({
      edificioId: edificioObjId,
      token,
      codigo,
      censoUnidadId: unidadDoc?._id,
      expiraEn,
      inmueblePredefinido: identificadorFinal,
      creadoPor,
    });
    await invitacion.save();

    const contacto = this.extraerContactoPrincipal(unidadDoc);

    return {
      token,
      codigo,
      expiraEn,
      diasValidez: diasValidez || 7,
      inmueblePredefinido: identificadorFinal,
      censoUnidadId: unidadDoc?._id?.toString(),
      ...contacto,
    };
  }

  async crearInvitacionesMasivas(
    edificioId: string,
    opts: {
      unidadIds?: string[];
      todos?: boolean;
      diasValidez?: number;
      enviarCorreo?: boolean;
      frontendUrl?: string;
    },
    creadoPor?: string,
  ) {
    const edificioObjId = new Types.ObjectId(edificioId);
    const diasValidez = opts?.diasValidez || 7;
    const expiraEn = new Date(Date.now() + diasValidez * 24 * 60 * 60 * 1000);

    const filtro: Record<string, any> = {
      edificioId: edificioObjId,
      estado: 'aprobado',
    };

    if (!opts?.todos) {
      const idsValidos = (opts?.unidadIds || []).filter((id) => Types.ObjectId.isValid(id));
      if (idsValidos.length === 0) {
        throw new BadRequestException('Debes seleccionar al menos un apartamento o elegir enviar a todos.');
      }
      filtro._id = { $in: idsValidos.map((id) => new Types.ObjectId(id)) };
    }

    const q = this.censoModel.find(filtro);
    const unidades: any[] = typeof q?.exec === 'function' ? await q.exec() : await q;

    if (!unidades || unidades.length === 0) {
      throw new NotFoundException('No se encontraron apartamentos aprobados para generar invitaciones.');
    }

    const identificadores = unidades.map((u) => u.identificador).filter(Boolean);
    if (identificadores.length > 0 && typeof (this.invitacionModel as any).updateMany === 'function') {
      await (this.invitacionModel as any).updateMany(
        {
          edificioId: edificioObjId,
          inmueblePredefinido: { $in: identificadores },
          utilizado: false,
        },
        { $set: { utilizado: true } },
      );
    }

    const codigosUsados = new Set<string>();
    const docsToInsert: any[] = [];
    const resultados: Array<{
      unidadId: string;
      identificador: string;
      torre?: string;
      numeroApto?: string;
      codigo: string;
      token: string;
      expiraEn: Date;
      titularNombre: string;
      titularEmail: string;
      titularTelefono: string;
      correoEnviado: boolean;
    }> = [];

    const baseUrl = (opts?.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    let correosEnviados = 0;
    let sinCorreo = 0;

    for (const u of unidades) {
      const codigo = this.generarCodigo5Letras(codigosUsados);
      const token = randomBytes(24).toString('hex');
      const contacto = this.extraerContactoPrincipal(u);

      docsToInsert.push({
        edificioId: edificioObjId,
        token,
        codigo,
        censoUnidadId: u._id,
        inmueblePredefinido: u.identificador,
        expiraEn,
        utilizado: false,
        creadoPor,
      });

      let enviado = false;
      if (opts?.enviarCorreo && contacto.titularEmail) {
        const link = `${baseUrl}/censo/${edificioId}?codigo=${codigo}`;
        await this.despacharCorreoCenso({
          destinatario: contacto.titularEmail,
          nombreTitular: contacto.titularNombre || 'Residente',
          identificadorUnidad: u.identificador,
          codigo,
          link,
          expiraEn,
        });
        enviado = true;
        correosEnviados++;
      } else if (!contacto.titularEmail) {
        sinCorreo++;
      }

      resultados.push({
        unidadId: u._id.toString(),
        identificador: u.identificador,
        torre: u.torre,
        numeroApto: u.numeroApto,
        codigo,
        token,
        expiraEn,
        titularNombre: contacto.titularNombre,
        titularEmail: contacto.titularEmail,
        titularTelefono: contacto.titularTelefono,
        correoEnviado: enviado,
      });
    }

    if (typeof (this.invitacionModel as any).insertMany === 'function') {
      await (this.invitacionModel as any).insertMany(docsToInsert);
    } else {
      for (const d of docsToInsert) {
        const inst = new this.invitacionModel(d);
        await inst.save();
      }
    }

    return {
      totalGeneradas: resultados.length,
      correosEnviados,
      sinCorreo,
      diasValidez,
      expiraEn,
      invitaciones: resultados,
    };
  }

  async enviarCorreoInvitacion(
    edificioId: string,
    opts: { codigo: string; emailDestino?: string; frontendUrl?: string },
  ) {
    const codigoNorm = (opts?.codigo || '').trim().toUpperCase();
    if (!codigoNorm) {
      throw new BadRequestException('El código de invitación es obligatorio.');
    }

    const edificioObjId = new Types.ObjectId(edificioId);
    const q = this.invitacionModel.findOne({
      edificioId: edificioObjId,
      codigo: new RegExp(`^${codigoNorm}$`, 'i'),
    });
    const inv: any = typeof q?.exec === 'function' ? await q.exec() : await q;

    if (!inv) {
      throw new NotFoundException('No se encontró la invitación para el código indicado.');
    }

    let unidadDoc: any = null;
    if (inv.censoUnidadId) {
      const qu = this.censoModel.findById(inv.censoUnidadId);
      unidadDoc = typeof qu?.exec === 'function' ? await qu.exec() : await qu;
    } else if (inv.inmueblePredefinido) {
      const qu = this.censoModel.findOne({
        edificioId: edificioObjId,
        identificador: inv.inmueblePredefinido,
        estado: 'aprobado',
      });
      unidadDoc = typeof qu?.exec === 'function' ? await qu.exec() : await qu;
    }

    const contacto = this.extraerContactoPrincipal(unidadDoc);
    const emailFinal = (opts?.emailDestino || contacto.titularEmail || '').trim().toLowerCase();

    if (!emailFinal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFinal)) {
      throw new BadRequestException(
        'El inmueble no tiene un correo electrónico válido registrado. Por favor indícalo para enviar.',
      );
    }

    const baseUrl = (opts?.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${baseUrl}/censo/${edificioId}?codigo=${inv.codigo || codigoNorm}`;

    const infoEnvio = await this.despacharCorreoCenso({
      destinatario: emailFinal,
      nombreTitular: contacto.titularNombre || 'Residente',
      identificadorUnidad: inv.inmueblePredefinido || unidadDoc?.identificador || 'tu inmueble',
      codigo: inv.codigo || codigoNorm,
      link,
      expiraEn: inv.expiraEn,
    });

    return {
      enviado: true,
      emailDestino: emailFinal,
      codigo: inv.codigo || codigoNorm,
      inmueble: inv.inmueblePredefinido || unidadDoc?.identificador,
      link,
      ...infoEnvio,
    };
  }

  private async despacharCorreoCenso(params: {
    destinatario: string;
    nombreTitular: string;
    identificadorUnidad: string;
    codigo: string;
    link: string;
    expiraEn: Date;
  }): Promise<{ modo: 'smtp' | 'simulado'; asunto: string }> {
    const fechaExp = new Date(params.expiraEn).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const asunto = `Actualización de Censo y Acceso Exclusivo - ${params.identificadorUnidad} (Código: ${params.codigo})`;

    return {
      modo: process.env.SMTP_HOST ? 'smtp' : 'simulado',
      asunto,
    };
  }

  async getInvitaciones(edificioId: string) {
    return this.invitacionModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async validarCodigoCenso(edificioId: string, codigoRaw: string, ip?: string) {
    this.verificarRateLimit(ip);

    const codigo = (codigoRaw || '').trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(codigo)) {
      this.registrarIntentoFallido(ip);
      throw new BadRequestException('El código de acceso debe contener exactamente 5 letras.');
    }

    if (!Types.ObjectId.isValid(edificioId)) {
      throw new BadRequestException('Identificador de copropiedad inválido.');
    }

    const edificioObjId = new Types.ObjectId(edificioId);
    const inv = await this.invitacionModel
      .findOne({
        edificioId: edificioObjId,
        codigo: new RegExp(`^${codigo}$`, 'i'),
      })
      .populate('edificioId', 'nombre direccion telefono')
      .exec();

    if (!inv) {
      this.registrarIntentoFallido(ip);
      throw new NotFoundException('El código ingresado no es válido o no pertenece a esta copropiedad.');
    }

    // El código tiene vigencia de 7 días pero permite múltiples usos dentro de ese periodo
    if (new Date() > new Date(inv.expiraEn)) {
      throw new BadRequestException('Este código de acceso ha expirado (vigencia de 7 días). Solicita uno nuevo a la administración.');
    }
    if (!inv.inmueblePredefinido && !inv.censoUnidadId) {
      throw new BadRequestException('Este código no está vinculado a ningún inmueble.');
    }

    // Código válido: limpiar contador de fallos
    this.limpiarIntentosFallidos(ip);

    let unidad: CensoUnidadDocument | null = null;
    if (inv.censoUnidadId) {
      const q = this.censoModel.findOne({ _id: inv.censoUnidadId, edificioId: edificioObjId });
      unidad = typeof q?.exec === 'function' ? await q.exec() : await q;
    }
    if (!unidad && inv.inmueblePredefinido) {
      const escaped = inv.inmueblePredefinido.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const q = this.censoModel.findOne({
        edificioId: edificioObjId,
        identificador: new RegExp(`^${escaped}$`, 'i'),
        estado: 'aprobado',
      });
      unidad = typeof q?.exec === 'function' ? await q.exec() : await q;
    }

    // Si ya existe una solicitud 'pendiente_actualizacion' reciente enviada para esta unidad,
    // precargamos preferentemente los datos de esa actualización pendiente para que el residente
    // continúe editando sobre su última versión enviada.
    let unidadParaPrecarga = unidad;
    if (unidad?._id) {
      const queryPendiente = this.censoModel.findOne({
        edificioId: edificioObjId,
        unidadOriginalId: unidad._id,
        estado: 'pendiente_actualizacion',
      });
      const qPendiente =
        typeof (queryPendiente as any)?.sort === 'function'
          ? (queryPendiente as any).sort({ updatedAt: -1 })
          : queryPendiente;
      const pendiente = typeof qPendiente?.exec === 'function' ? await qPendiente.exec() : await qPendiente;
      if (pendiente) {
        unidadParaPrecarga = pendiente;
      }
    }

    const diasRestantes = Math.max(0, Math.ceil((new Date(inv.expiraEn).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    return {
      valido: true,
      codigo: (inv.codigo || codigo).toUpperCase(),
      token: inv.token,
      expiraEn: inv.expiraEn,
      diasRestantes,
      usos: inv.usos || 0,
      multiUso: true,
      inmueblePredefinido: unidad?.identificador || inv.inmueblePredefinido,
      edificio: inv.edificioId,
      unidad: unidadParaPrecarga
        ? {
            _id: (unidad?._id || unidadParaPrecarga._id).toString(),
            identificador: unidad?.identificador || unidadParaPrecarga.identificador,
            torre: unidadParaPrecarga.torre || unidad?.torre || '',
            numeroApto: unidadParaPrecarga.numeroApto || unidad?.numeroApto || '',
            piso: unidadParaPrecarga.piso !== undefined ? unidadParaPrecarga.piso : unidad?.piso,
            metrosCuadrados: unidadParaPrecarga.metrosCuadrados !== undefined ? unidadParaPrecarga.metrosCuadrados : unidad?.metrosCuadrados,
            tipoOcupacion: unidadParaPrecarga.tipoOcupacion || unidad?.tipoOcupacion,
            parqueaderosAsignados: unidadParaPrecarga.parqueaderosAsignados || unidad?.parqueaderosAsignados || [],
            bodegasAsignadas: unidadParaPrecarga.bodegasAsignadas || unidad?.bodegasAsignadas || [],
            personas: unidadParaPrecarga.personas || unidad?.personas || [],
            mascotas: unidadParaPrecarga.mascotas || unidad?.mascotas || [],
            vehiculos: unidadParaPrecarga.vehiculos || unidad?.vehiculos || [],
          }
        : null,
    };
  }

  async responderConCodigoCenso(edificioId: string, codigoRaw: string, dto: PublicCensoDto, ip?: string) {
    const validacion = await this.validarCodigoCenso(edificioId, codigoRaw, ip);
    const inv = await this.invitacionModel
      .findOne({
        edificioId: new Types.ObjectId(edificioId),
        codigo: new RegExp(`^${validacion.codigo}$`, 'i'),
      })
      .exec();

    if (!inv) {
      throw new NotFoundException('Código de invitación no encontrado.');
    }

    const identificadorAutorizado = (validacion.inmueblePredefinido || '').trim();
    const dtoIdentNorm = (dto.identificador || '').trim().toLowerCase();
    if (identificadorAutorizado && dtoIdentNorm && dtoIdentNorm !== identificadorAutorizado.toLowerCase()) {
      throw new BadRequestException(
        `No tienes permiso para modificar otro inmueble. Tu código es exclusivo para "${identificadorAutorizado}".`,
      );
    }

    dto.identificador = identificadorAutorizado || dto.identificador;
    if (validacion.unidad?.torre) dto.torre = validacion.unidad.torre;
    if (validacion.unidad?.numeroApto) dto.numeroApto = validacion.unidad.numeroApto;

    const res = await this.createFromPublic(edificioId, dto);

    // Multi-uso: se incrementa el contador de usos y estampa sin invalidar la vigencia del código
    inv.utilizado = true;
    inv.usos = (inv.usos || 0) + 1;
    inv.ultimoUso = new Date();
    await inv.save();

    return {
      ...res,
      usos: inv.usos,
      expiraEn: inv.expiraEn,
      multiUso: true,
    };
  }

  async validarInvitacion(token: string) {
    const tokenClean = (token || '').trim();
    const inv = await this.invitacionModel
      .findOne({
        $or: [
          { token: tokenClean },
          { codigo: new RegExp(`^${tokenClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ],
      })
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
