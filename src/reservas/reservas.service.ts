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
import { CensoUnidad, CensoUnidadDocument } from '../censo/censo.schema';

@Injectable()
export class ReservasService {
  constructor(
    @InjectModel(Reserva.name) private reservaModel: Model<Reserva>,
    @InjectModel(CensoUnidad.name) private censoModel: Model<CensoUnidadDocument>,
    private zonasService: ZonasService,
    private eventsGateway: EventsGateway,
  ) {}

  private estaEnMantenimientoEnFechaHora(
    zona: any,
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ): boolean {
    if (!zona.enMantenimiento) return false;

    // Si no tiene fechas especificadas, el mantenimiento es inmediato e indefinido
    if (!zona.mantenimientoFechaInicio && !zona.mantenimientoFechaFin) {
      return true;
    }

    const fInicio = zona.mantenimientoFechaInicio || '1970-01-01';
    const hInicio = zona.mantenimientoHoraInicio || '00:00';
    const fFin = zona.mantenimientoFechaFin || '2099-12-31';
    const hFin = zona.mantenimientoHoraFin || '23:59';

    const slotInicio = `${fecha}T${horaInicio}`;
    const slotFin = `${fecha}T${horaFin}`;
    const mantInicio = `${fInicio}T${hInicio}`;
    const mantFin = `${fFin}T${hFin}`;

    return slotInicio < mantFin && slotFin > mantInicio;
  }

  private async validarDisponibilidad(
    zonaId: string,
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ) {
    const zona = await this.zonasService.findOne(zonaId);

    if (this.estaEnMantenimientoEnFechaHora(zona, fecha, horaInicio, horaFin)) {
      return {
        disponible: false,
        ocupadas: zona.aforoMaximo,
        disponibles: 0,
        enMantenimiento: true,
        motivoMantenimiento: zona.motivoMantenimiento || 'Mantenimiento programado',
      };
    }

    const ocupadas = await this.reservaModel.countDocuments({
      zonaId: new Types.ObjectId(zonaId),
      fecha,
      estado: { $in: ['activa', 'aprobada'] },
      $or: [{ horaInicio: { $lt: horaFin }, horaFin: { $gt: horaInicio } }],
    });

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

    if (this.estaEnMantenimientoEnFechaHora(zona, fecha, horaInicio, horaFin)) {
      const periodoMsg = zona.mantenimientoFechaInicio
        ? ` (del ${zona.mantenimientoFechaInicio} ${zona.mantenimientoHoraInicio || ''} al ${zona.mantenimientoFechaFin || ''} ${zona.mantenimientoHoraFin || ''})`
        : '';
      throw new BadRequestException(
        `La zona "${zona.nombre}" se encuentra en mantenimiento${periodoMsg}${
          zona.motivoMantenimiento ? ': ' + zona.motivoMantenimiento : ''
        } y no admite reservas.`,
      );
    }

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
    return this.validarDisponibilidad(zonaId, fecha, horaInicio, horaFin);
  }

  async crear(dto: {
    zonaId: string;
    edificioId: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    nombreSolicitante: string;
    torreInmueble: string;
    tipo?: string;
    censoUnidadId?: string;
    telefonoContacto?: string;
    edadSolicitante?: number;
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

    let censoUnidadObjId: Types.ObjectId | undefined = undefined;
    let esCensoVerificado = false;
    let torreInmueble = dto.torreInmueble;
    let tipo = dto.tipo || 'propietario';

    // Regla de Negocio: Validar que el solicitante no sea menor de edad
    if ((dto as any).edadSolicitante !== undefined && Number((dto as any).edadSolicitante) < 18) {
      throw new BadRequestException('Los menores de edad no están autorizados para apartar zonas comunes.');
    }

    if (dto.censoUnidadId && Types.ObjectId.isValid(dto.censoUnidadId)) {
      const unidad = await this.censoModel.findById(dto.censoUnidadId);
      if (unidad) {
        if (unidad.tags?.includes('moroso')) {
          throw new BadRequestException(
            'La unidad presenta mora en administración y no está autorizada para reservar zonas comunes.',
          );
        }
        if (unidad.estado && unidad.estado !== 'aprobado') {
          throw new BadRequestException(
            'El censo de la unidad aún no se encuentra aprobado por la administración.',
          );
        }

        censoUnidadObjId = unidad._id as Types.ObjectId;
        if (!torreInmueble) {
          torreInmueble =
            unidad.identificador ||
            `${unidad.torre ? unidad.torre + ' - ' : ''}Apto ${unidad.numeroApto || ''}`;
        }

        // Cotejar si el solicitante o su teléfono coinciden con algún residente registrado
        const clean = (s?: string) => (s || '').toLowerCase().trim();
        const cleanName = clean(dto.nombreSolicitante);
        const cleanTel = (dto.telefonoContacto || '').replace(/\D/g, '');

        const match = unidad.personas?.find((p) => {
          const pName = clean(p.nombreCompleto);
          const pTel = (p.telefono || '').replace(/\D/g, '');
          const matchName =
            cleanName &&
            (pName.includes(cleanName) || cleanName.includes(pName));
          const matchTel =
            cleanTel &&
            pTel &&
            (cleanTel.endsWith(pTel) || pTel.endsWith(cleanTel));
          return matchName || matchTel;
        });

        if (match) {
          // Si el residente censado es menor de edad, bloquear
          if (match.fechaNacimiento) {
            const birth = new Date(match.fechaNacimiento);
            const age = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
            if (age < 18) {
              throw new BadRequestException('Los menores de edad no están autorizados para apartar zonas comunes.');
            }
          }

          esCensoVerificado = true;
          tipo =
            match.condicion === 'arrendatario'
              ? 'arrendatario'
              : 'propietario';
        }
      }
    }

    const reserva = await this.reservaModel.create({
      ...dto,
      torreInmueble,
      tipo,
      censoUnidadId: censoUnidadObjId,
      esCensoVerificado,
      telefonoContacto: dto.telefonoContacto,
      edificioId: new Types.ObjectId(dto.edificioId),
      zonaId: new Types.ObjectId(dto.zonaId),
      estado: (dto as any).esReservaAdmin ? 'aprobada' : (dto as any).estado || 'activa',
      esReservaAdmin: Boolean((dto as any).esReservaAdmin),
      motivoAdmin: (dto as any).motivoAdmin,
      edadSolicitante: (dto as any).edadSolicitante,
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
      .populate('censoUnidadId', 'identificador torre numeroApto')
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

  async aprobar(id: string) {
    const reserva = await this.reservaModel
      .findByIdAndUpdate(id, { estado: 'aprobada' }, { new: true })
      .lean();
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    this.eventsGateway.emitirActualizacion(reserva.edificioId.toString(), {
      tipo: 'reserva_aprobada',
      data: reserva,
    });

    return reserva;
  }

  async rechazar(id: string, motivo?: string) {
    const reserva = await this.reservaModel
      .findByIdAndUpdate(
        id,
        {
          estado: 'rechazada',
          motivoRechazo: motivo || 'Cancelada por la administración',
        },
        { new: true },
      )
      .lean();
    if (!reserva) throw new NotFoundException('Reserva no encontrada');

    this.eventsGateway.emitirActualizacion(reserva.edificioId.toString(), {
      tipo: 'reserva_rechazada',
      data: reserva,
    });

    return reserva;
  }

  async crearAdmin(dto: any, edificioId: string) {
    return this.crear({
      ...dto,
      edificioId,
      esReservaAdmin: true,
      estado: 'aprobada',
    });
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
    edadSolicitante?: number;
    torreInmueble: string;
    tipo?: string;
    censoUnidadId?: string;
    telefonoContacto?: string;
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
      edadSolicitante: dto.edadSolicitante,
      torreInmueble: dto.torreInmueble,
      tipo: dto.tipo || 'propietario',
      censoUnidadId: dto.censoUnidadId,
      telefonoContacto: dto.telefonoContacto,
    });
  }

  async obtenerReportes(edificioId: string) {
    const reservas = await this.reservaModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        estado: { $in: ['activa', 'aprobada'] },
      })
      .populate('zonaId')
      .lean();

    const porZona: Record<string, { total: number; aforoMaximo: number }> = {};

    for (const r of reservas as any[]) {
      const zonaName = r.zonaId?.nombre || 'Desconocida';
      const aforo = r.zonaId?.aforoMaximo || 1;
      if (!porZona[zonaName]) porZona[zonaName] = { total: 0, aforoMaximo: aforo };
      porZona[zonaName].total++;
    }

    return Object.entries(porZona).map(([zona, data]) => ({
      zona,
      totalReservas: data.total,
      ocupacion: Math.min(100, Math.round((data.total / data.aforoMaximo) * 100)),
    }));
  }
}
