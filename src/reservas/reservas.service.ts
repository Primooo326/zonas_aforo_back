import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reserva } from './reserva.schema';
import { ZonasService } from '../zonas/zonas.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ReservasService {
  constructor(
    @InjectModel(Reserva.name) private reservaModel: Model<Reserva>,
    private zonasService: ZonasService,
    private eventsGateway: EventsGateway,
  ) {}

  private async validarDisponibilidad(
    zonaId: string,
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ) {
    const ocupadas = await this.reservaModel.countDocuments({
      zonaId: new Types.ObjectId(zonaId),
      fecha,
      estado: 'activa',
      $or: [{ horaInicio: { $lt: horaFin }, horaFin: { $gt: horaInicio } }],
    });

    const zona = await this.zonasService.findOne(zonaId);
    return {
      disponible: ocupadas < zona.aforoMaximo,
      ocupadas,
      disponibles: zona.aforoMaximo - ocupadas,
    };
  }

  private async validarReglas(
    zonaId: string,
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ) {
    const zona = await this.zonasService.findOne(zonaId);

    const hoy = new Date();
    const fechaSel = new Date(fecha + 'T00:00:00');
    if (fechaSel < new Date(hoy.toISOString().split('T')[0] + 'T00:00:00')) {
      throw new BadRequestException('No puedes reservar en una fecha pasada');
    }

    const diasSemana = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    const diaSemana = diasSemana[fechaSel.getDay()];
    const horarioDia = (zona.horarios || []).find((h) => h.dia === diaSemana);
    if (!horarioDia) {
      throw new BadRequestException(
        `La zona no está disponible los ${diaSemana}`,
      );
    }

    if (horaInicio < horarioDia.inicio) {
      throw new BadRequestException(
        `La hora de inicio (${horaInicio}) es anterior al horario disponible (${horarioDia.inicio})`,
      );
    }

    if (horaFin > horarioDia.fin) {
      throw new BadRequestException(
        `La hora de fin (${horaFin}) excede el horario disponible (${horarioDia.fin})`,
      );
    }

    if (horaInicio >= horaFin) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora de fin',
      );
    }
  }

  async verificarDisponibilidad(
    zonaId: string,
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ) {
    const ocupadas = await this.reservaModel.countDocuments({
      zonaId: new Types.ObjectId(zonaId),
      fecha,
      estado: 'activa',
      $or: [{ horaInicio: { $lt: horaFin }, horaFin: { $gt: horaInicio } }],
    });

    const zona = await this.zonasService.findOne(zonaId);
    return {
      disponible: ocupadas < zona.aforoMaximo,
      ocupadas,
      disponibles: zona.aforoMaximo - ocupadas,
    };
  }

  async crear(dto: {
    zonaId: string;
    edificioId: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    nombreSolicitante: string;
    torreInmueble: string;
    tipo: string;
  }) {
    await this.validarReglas(
      dto.zonaId,
      dto.fecha,
      dto.horaInicio,
      dto.horaFin,
    );

    const { disponible } = await this.verificarDisponibilidad(
      dto.zonaId,
      dto.fecha,
      dto.horaInicio,
      dto.horaFin,
    );

    if (!disponible) {
      throw new BadRequestException('Aforo completo en esta franja horaria');
    }

    const reserva = await this.reservaModel.create({
      ...dto,
      edificioId: new Types.ObjectId(dto.edificioId),
      zonaId: new Types.ObjectId(dto.zonaId),
    });

    this.eventsGateway.emitirActualizacion(dto.edificioId, {
      tipo: 'nueva_reserva',
      data: reserva,
    });

    return reserva;
  }

  async findByEdificio(
    edificioId: string,
    filtros?: { fecha?: string; zonaId?: string; estado?: string },
  ) {
    const query: any = { edificioId: new Types.ObjectId(edificioId) };
    if (filtros?.fecha) query.fecha = filtros.fecha;
    if (filtros?.zonaId) query.zonaId = new Types.ObjectId(filtros.zonaId);
    if (filtros?.estado) query.estado = filtros.estado;
    return this.reservaModel
      .find(query)
      .populate('zonaId')
      .sort({ fecha: -1, horaInicio: -1 })
      .lean();
  }

  async cancelar(id: string) {
    const reserva = await this.reservaModel
      .findByIdAndUpdate(id, { estado: 'cancelada' }, { new: true })
      .lean();
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    this.eventsGateway.emitirActualizacion(reserva.edificioId.toString(), {
      tipo: 'reserva_cancelada',
      data: reserva,
    });

    return reserva;
  }

  async getZonaPublic(id: string) {
    const zona = await this.zonasService.findOne(id);
    return {
      id: (zona as any)._id,
      nombre: zona.nombre,
      descripcion: zona.descripcion,
      horarios: zona.horarios || [],
      aforoMaximo: zona.aforoMaximo,
      lapsoMinutos: zona.lapsoMinutos,
      edificioId: (zona as any).edificioId,
    };
  }

  async getZonasByEdificio(edificioId: string) {
    return this.zonasService.findPublicByEdificio(edificioId);
  }

  async crearSolicitud(dto: {
    zonaId: string;
    fecha: string;
    horaInicio: string;
    nombreSolicitante: string;
    torreInmueble: string;
    tipo?: string;
  }) {
    const zona = await this.zonasService.findOne(dto.zonaId);
    const [h, m] = dto.horaInicio.split(':').map(Number);
    const totalMin = h * 60 + m + zona.lapsoMinutos;
    const horaFin = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;

    return this.crear({
      zonaId: dto.zonaId,
      edificioId: (zona as any).edificioId.toString(),
      fecha: dto.fecha,
      horaInicio: dto.horaInicio,
      horaFin,
      nombreSolicitante: dto.nombreSolicitante,
      torreInmueble: dto.torreInmueble,
      tipo: dto.tipo || 'propietario',
    });
  }

  async obtenerReportes(edificioId: string) {
    const reservas = await this.reservaModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        estado: 'activa',
      })
      .populate('zonaId')
      .lean();

    const porZona: Record<string, { total: number; ocupacion: number }> = {};

    for (const r of reservas as any[]) {
      const zonaName = r.zonaId?.nombre || 'Desconocida';
      if (!porZona[zonaName]) porZona[zonaName] = { total: 0, ocupacion: 0 };
      porZona[zonaName].total++;
    }

    return Object.entries(porZona).map(([zona, data]) => ({
      zona,
      totalReservas: data.total,
    }));
  }
}
