import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Propietario, PropietarioDocument } from '../propietarios/propietario.schema';
import { CensoUnidad, CensoUnidadDocument } from '../censo/censo.schema';
import { Edificio, EdificioDocument } from '../edificios/edificio.schema';
import { Reserva, ReservaDocument } from '../reservas/reserva.schema';
import { ReservasService } from '../reservas/reservas.service';
import { ZonasService } from '../zonas/zonas.service';
import { PaquetesService } from '../porteria/paquetes/paquetes.service';
import { VisitasService } from '../porteria/visitas/visitas.service';
import { SolicitudActualizacionDto } from './dto/solicitud-actualizacion.dto';
import { CrearReservaPortalDto } from './dto/crear-reserva-portal.dto';
import { CrearPreRegistroDto } from '../porteria/visitas/dto/preregistro-visita.dto';

@Injectable()
export class PortalService {
  constructor(
    @InjectModel(Propietario.name)
    private readonly propietarioModel: Model<PropietarioDocument>,
    @InjectModel(CensoUnidad.name)
    private readonly censoModel: Model<CensoUnidadDocument>,
    @InjectModel(Edificio.name)
    private readonly edificioModel: Model<EdificioDocument>,
    @InjectModel(Reserva.name)
    private readonly reservaModel: Model<ReservaDocument>,
    private readonly reservasService: ReservasService,
    private readonly zonasService: ZonasService,
    private readonly paquetesService: PaquetesService,
    private readonly visitasService: VisitasService,
  ) {}

  async getMe(propietarioId: string) {
    const propietario = await this.propietarioModel
      .findById(propietarioId)
      .select('-password')
      .lean();

    if (!propietario) {
      throw new NotFoundException('Perfil de residente no encontrado');
    }

    if (!propietario.censoUnidadId) {
      throw new BadRequestException(
        'Tu cuenta no se encuentra vinculada a ningún apartamento. Comunícate con la administración.',
      );
    }

    const unidad = await this.censoModel
      .findById(propietario.censoUnidadId)
      .lean();

    if (!unidad) {
      throw new NotFoundException('La unidad censada asignada no existe.');
    }

    const solicitudPendiente = await this.censoModel
      .findOne({
        unidadOriginalId: new Types.ObjectId(propietario.censoUnidadId),
        estado: 'pendiente_actualizacion',
      })
      .lean();

    const edificio = await this.edificioModel
      .findById(propietario.edificioId)
      .select('nombre email')
      .lean();

    return {
      propietario,
      unidad,
      edificio,
      solicitudPendiente,
    };
  }

  async solicitarActualizacion(
    propietarioId: string,
    dto: SolicitudActualizacionDto,
  ) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario || !propietario.censoUnidadId) {
      throw new BadRequestException('No tienes una unidad habitacional asociada');
    }

    const unidadOriginal = await this.censoModel.findById(
      propietario.censoUnidadId,
    );
    if (!unidadOriginal) {
      throw new NotFoundException('Unidad original no encontrada');
    }

    const existentePendiente = await this.censoModel.findOne({
      unidadOriginalId: new Types.ObjectId(propietario.censoUnidadId),
      estado: 'pendiente_actualizacion',
    });

    if (existentePendiente) {
      existentePendiente.personas = dto.personas as any;
      existentePendiente.mascotas = dto.mascotas as any;
      existentePendiente.vehiculos = dto.vehiculos as any;
      existentePendiente.tipoOcupacion =
        (dto.tipoOcupacion as any) || unidadOriginal.tipoOcupacion;
      existentePendiente.notasAdministracion = `Actualizado por residente el ${new Date().toLocaleDateString()}`;
      return existentePendiente.save();
    }

    return this.censoModel.create({
      edificioId: unidadOriginal.edificioId,
      identificador: unidadOriginal.identificador,
      torre: unidadOriginal.torre,
      numeroApto: unidadOriginal.numeroApto,
      piso: unidadOriginal.piso,
      cuartos: unidadOriginal.cuartos,
      banos: unidadOriginal.banos,
      metrosCuadrados: unidadOriginal.metrosCuadrados,
      coeficiente: unidadOriginal.coeficiente,
      parqueaderosAsignados: unidadOriginal.parqueaderosAsignados,
      bodegasAsignadas: unidadOriginal.bodegasAsignadas,
      tipoOcupacion: (dto.tipoOcupacion as any) || unidadOriginal.tipoOcupacion,
      personas: dto.personas as any,
      mascotas: dto.mascotas as any,
      vehiculos: dto.vehiculos as any,
      estado: 'pendiente_actualizacion',
      unidadOriginalId: unidadOriginal._id,
      notasAdministracion: `Solicitud radicada por ${propietario.nombre} el ${new Date().toLocaleDateString()}`,
    } as any);
  }

  async cancelarSolicitudActualizacion(propietarioId: string) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario || !propietario.censoUnidadId) {
      throw new BadRequestException('No tienes una unidad habitacional asociada');
    }

    const res = await this.censoModel.findOneAndDelete({
      unidadOriginalId: new Types.ObjectId(propietario.censoUnidadId),
      estado: 'pendiente_actualizacion',
    });

    if (!res) {
      throw new NotFoundException('No tienes ninguna solicitud pendiente');
    }

    return { success: true };
  }

  async getZonas(edificioId: string) {
    return this.zonasService.findAll(edificioId);
  }

  async getReservas(censoUnidadId?: string, edificioId?: string) {
    if (!censoUnidadId) return [];
    return this.reservaModel
      .find({
        censoUnidadId: new Types.ObjectId(censoUnidadId),
        ...(edificioId ? { edificioId: new Types.ObjectId(edificioId) } : {}),
      })
      .populate('zonaId')
      .sort({ fecha: -1, horaInicio: -1 })
      .lean();
  }

  async crearReserva(propietarioId: string, dto: CrearReservaPortalDto) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario || !propietario.censoUnidadId) {
      throw new BadRequestException('No tienes una unidad habitacional asociada');
    }

    const unidad = await this.censoModel.findById(propietario.censoUnidadId);
    if (!unidad) {
      throw new NotFoundException('Unidad habitacional no encontrada');
    }

    // Regla de Negocio RN-02: Bloqueo a morosos
    if (Array.isArray(unidad.tags) && unidad.tags.includes('moroso')) {
      throw new BadRequestException(
        'Tu apartamento presenta restricciones por mora en cuotas de administración. Comunícate con la administración.',
      );
    }

    // Obtener datos del solicitante
    const persona = unidad.personas?.find(
      (p) => p.email?.toLowerCase() === propietario.email?.toLowerCase(),
    );
    const nombre = persona?.nombreCompleto || propietario.nombre;
    const telefono = persona?.telefono || 'Sin teléfono';
    const torreInmueble =
      unidad.identificador ||
      `${unidad.torre ? unidad.torre + ' - ' : ''}Apto ${unidad.numeroApto || ''}`;

    return this.reservasService.crearSolicitud({
      zonaId: dto.zonaId,
      fecha: dto.fecha,
      horaInicio: dto.horaInicio,
      nombreSolicitante: nombre,
      telefonoContacto: telefono,
      torreInmueble,
      tipo: propietario.tipoResidente || 'propietario',
      censoUnidadId: unidad._id.toString(),
      edadSolicitante: dto.edadSolicitante || 18,
    });
  }

  async cancelarReserva(propietarioId: string, reservaId: string) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario || !propietario.censoUnidadId) {
      throw new BadRequestException('No tienes una unidad habitacional asociada');
    }

    const reserva = await this.reservaModel.findById(reservaId);
    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (
      !reserva.censoUnidadId ||
      reserva.censoUnidadId.toString() !== propietario.censoUnidadId.toString()
    ) {
      throw new ForbiddenException(
        'No tienes permiso para cancelar esta reserva.',
      );
    }

    return this.reservasService.cancelar(reservaId);
  }

  // --- Integración con Casillero y Visitas para el Residente ---

  async getPaquetes(propietarioId: string) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario || !propietario.censoUnidadId) return [];
    const unidad = await this.censoModel.findById(propietario.censoUnidadId);
    if (!unidad) return [];
    return this.paquetesService.listarParaResidente(
      propietario.edificioId.toString(),
      unidad.torre,
      unidad.numeroApto,
    );
  }

  async getVisitas(propietarioId: string) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario || !propietario.censoUnidadId) return [];
    const unidad = await this.censoModel.findById(propietario.censoUnidadId);
    if (!unidad) return [];
    return this.visitasService.listarParaResidente(
      propietario.edificioId.toString(),
      unidad.torre,
      unidad.numeroApto,
    );
  }

  async getPreRegistros(propietarioId: string) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario) return [];
    return this.visitasService.listarPreRegistrosParaResidente(
      propietario.edificioId.toString(),
      propietarioId,
    );
  }

  async crearPreRegistro(propietarioId: string, dto: CrearPreRegistroDto) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario || !propietario.censoUnidadId) {
      throw new NotFoundException('Perfil de residente o unidad no encontrada');
    }
    const unidad = await this.censoModel.findById(propietario.censoUnidadId);
    if (!unidad) {
      throw new NotFoundException('Unidad censada no encontrada');
    }
    return this.visitasService.crearPreRegistro(
      propietario.edificioId.toString(),
      propietario.censoUnidadId.toString(),
      unidad.torre || '',
      unidad.numeroApto || '',
      propietario.nombre || '',
      propietarioId,
      dto,
    );
  }

  async cancelarPreRegistro(propietarioId: string, preRegistroId: string) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario) {
      throw new NotFoundException('Perfil de residente no encontrado');
    }
    return this.visitasService.cancelarPreRegistro(
      propietario.edificioId.toString(),
      propietarioId,
      preRegistroId,
    );
  }
}
