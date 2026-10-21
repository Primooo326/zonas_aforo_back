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
import { SolicitudActualizacionDto } from './dto/solicitud-actualizacion.dto';
import { CrearReservaPortalDto } from './dto/crear-reserva-portal.dto';

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
      solicitudPendiente,
      edificio,
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

    const original = await this.censoModel.findById(propietario.censoUnidadId);
    if (!original) {
      throw new NotFoundException('Inmueble original no encontrado');
    }

    const personasFormatted = dto.personas
      ? dto.personas.map((p) => ({
          ...p,
          fechaNacimiento: p.fechaNacimiento ? new Date(p.fechaNacimiento) : undefined,
        }))
      : original.personas;

    let pendiente = await this.censoModel.findOne({
      unidadOriginalId: original._id,
      estado: 'pendiente_actualizacion',
    });

    if (pendiente) {
      if (dto.tipoOcupacion) pendiente.tipoOcupacion = dto.tipoOcupacion as any;
      if (dto.personas) pendiente.personas = personasFormatted as any;
      if (dto.mascotas) pendiente.mascotas = dto.mascotas as any;
      if (dto.vehiculos) pendiente.vehiculos = dto.vehiculos as any;
      if (dto.motivoCambio) pendiente.notasAdministracion = dto.motivoCambio;
      await pendiente.save();
      return {
        message: 'Solicitud de actualización modificada exitosamente.',
        solicitud: pendiente,
      };
    }

    const nueva = new this.censoModel({
      edificioId: original.edificioId,
      identificador: original.identificador,
      torre: original.torre,
      numeroApto: original.numeroApto,
      piso: original.piso,
      cuartos: original.cuartos,
      banos: original.banos,
      tieneBalcon: original.tieneBalcon,
      metrosCuadrados: original.metrosCuadrados,
      tienePatio: original.tienePatio,
      coeficiente: original.coeficiente,
      parqueaderosAsignados: original.parqueaderosAsignados,
      bodegasAsignadas: original.bodegasAsignadas,
      tipoOcupacion: dto.tipoOcupacion || original.tipoOcupacion,
      personas: personasFormatted,
      mascotas: dto.mascotas || original.mascotas,
      vehiculos: dto.vehiculos || original.vehiculos,
      estado: 'pendiente_actualizacion',
      unidadOriginalId: original._id,
      notasAdministracion:
        dto.motivoCambio || 'Actualización de datos solicitada por residente desde el portal',
    });

    const guardada = await nueva.save();

    return {
      message: 'Solicitud enviada a la administración para revisión.',
      solicitud: guardada,
    };
  }

  async cancelarSolicitudActualizacion(propietarioId: string) {
    const propietario = await this.propietarioModel.findById(propietarioId);
    if (!propietario || !propietario.censoUnidadId) {
      throw new BadRequestException('No tienes una unidad habitacional asociada');
    }

    await this.censoModel.deleteMany({
      unidadOriginalId: propietario.censoUnidadId,
      estado: 'pendiente_actualizacion',
    });

    return { message: 'Solicitud de actualización cancelada con éxito.' };
  }

  async getZonas(edificioId: string) {
    return this.zonasService.findPublicByEdificio(edificioId);
  }

  async getReservas(censoUnidadId: string, edificioId: string) {
    if (!censoUnidadId) return [];

    return this.reservaModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        censoUnidadId: new Types.ObjectId(censoUnidadId),
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

    if (unidad.tags?.includes('moroso')) {
      throw new BadRequestException(
        'Tu inmueble presenta un tag de mora en administración y tiene restringidas las reservas de zonas comunes.',
      );
    }

    const nombre = dto.nombreSolicitante || propietario.nombre;
    const telefono = dto.telefonoContacto || propietario.telefono || '';
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
}
