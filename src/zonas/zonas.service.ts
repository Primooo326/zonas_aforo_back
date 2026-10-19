import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Zona } from './zona.schema';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';

@Injectable()
export class ZonasService {
  constructor(@InjectModel(Zona.name) private zonaModel: Model<Zona>) {}

  private validarLapso(
    horarios: { dia: string; inicio: string; fin: string }[],
    lapsoMinutos: number,
  ) {
    if (!horarios || horarios.length === 0) {
      throw new BadRequestException('Selecciona al menos un día');
    }

    const diasVistos = new Set<string>();
    for (const h of horarios) {
      if (diasVistos.has(h.dia)) {
        throw new BadRequestException(`El día ${h.dia} está duplicado`);
      }
      diasVistos.add(h.dia);

      const [h1, m1] = h.inicio.split(':').map(Number);
      const [h2, m2] = h.fin.split(':').map(Number);
      const totalMinutos = h2 * 60 + m2 - (h1 * 60 + m1);
      if (totalMinutos <= 0) {
        throw new BadRequestException(
          `El horario de fin de ${h.dia} debe ser posterior al de inicio`,
        );
      }
      if (lapsoMinutos > totalMinutos) {
        throw new BadRequestException(
          `El lapso (${lapsoMinutos}min) excede el horario disponible de ${h.dia} (${totalMinutos}min)`,
        );
      }
    }
  }

  private async validarPropietario(zonaId: string, edificioId: string) {
    const zona = await this.zonaModel.findById(zonaId);
    if (!zona) throw new NotFoundException('Zona no encontrada');
    if (zona.edificioId.toString() !== edificioId) {
      throw new ForbiddenException('No tienes permiso para esta zona');
    }
    return zona;
  }

  async create(dto: CreateZonaDto) {
    this.validarLapso(dto.horarios, dto.lapsoMinutos);
    return this.zonaModel.create({
      ...dto,
      edificioId: new Types.ObjectId(dto.edificioId),
    });
  }

  async findAll(edificioId: string) {
    return this.zonaModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOne(id: string) {
    const zona = await this.zonaModel.findById(id).lean();
    if (!zona) throw new NotFoundException('Zona no encontrada');
    return zona;
  }

  async update(id: string, dto: UpdateZonaDto, edificioId: string) {
    await this.validarPropietario(id, edificioId);

    const zona = await this.zonaModel.findById(id).lean();
    if (!zona) throw new NotFoundException('Zona no encontrada');

    const horarios = dto.horarios ?? zona.horarios ?? [];
    const lapsoMinutos = dto.lapsoMinutos ?? zona.lapsoMinutos;
    this.validarLapso(horarios, lapsoMinutos);

    const actualizada = await this.zonaModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!actualizada) throw new NotFoundException('Zona no encontrada');
    return actualizada;
  }

  async remove(id: string, edificioId: string) {
    await this.validarPropietario(id, edificioId);
    const zona = await this.zonaModel.findByIdAndDelete(id).lean();
    if (!zona) throw new NotFoundException('Zona no encontrada');
    return zona;
  }

  async toggleMantenimiento(
    id: string,
    params: {
      enMantenimiento: boolean;
      motivo?: string;
      motivoMantenimiento?: string;
      fechaInicio?: string;
      mantenimientoFechaInicio?: string;
      horaInicio?: string;
      mantenimientoHoraInicio?: string;
      fechaFin?: string;
      mantenimientoFechaFin?: string;
      horaFin?: string;
      mantenimientoHoraFin?: string;
    },
    edificioId: string,
  ) {
    await this.validarPropietario(id, edificioId);
    const motivo = params.motivo ?? params.motivoMantenimiento ?? '';
    const fechaInicio = params.fechaInicio ?? params.mantenimientoFechaInicio ?? '';
    const horaInicio = params.horaInicio ?? params.mantenimientoHoraInicio ?? '';
    const fechaFin = params.fechaFin ?? params.mantenimientoFechaFin ?? '';
    const horaFin = params.horaFin ?? params.mantenimientoHoraFin ?? '';
    const updatePayload: any = {
      enMantenimiento: params.enMantenimiento,
      motivoMantenimiento: motivo,
      mantenimientoFechaInicio: params.enMantenimiento ? fechaInicio : '',
      mantenimientoHoraInicio: params.enMantenimiento ? horaInicio : '',
      mantenimientoFechaFin: params.enMantenimiento ? fechaFin : '',
      mantenimientoHoraFin: params.enMantenimiento ? horaFin : '',
    };
    const actualizada = await this.zonaModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .lean();
    if (!actualizada) throw new NotFoundException('Zona no encontrada');
    return actualizada;
  }

  getPlantillas() {
    return [
      {
        nombre: 'Salón Comunal / Social',
        descripcion: 'Espacio para reuniones y eventos sociales de los residentes.',
        politicasUso: 'Prohibido uso de pólvora o juegos pirotécnicos. Nivel moderado de música después de las 22:00. Entregar el salón aseado.',
        aforoMaximo: 50,
        lapsoMinutos: 240,
        horarios: [
          { dia: 'Lunes', inicio: '09:00', fin: '23:00' },
          { dia: 'Martes', inicio: '09:00', fin: '23:00' },
          { dia: 'Miércoles', inicio: '09:00', fin: '23:00' },
          { dia: 'Jueves', inicio: '09:00', fin: '23:00' },
          { dia: 'Viernes', inicio: '09:00', fin: '23:59' },
          { dia: 'Sábado', inicio: '09:00', fin: '23:59' },
          { dia: 'Domingo', inicio: '09:00', fin: '22:00' },
        ],
      },
      {
        nombre: 'Zona BBQ / Parrilla',
        descripcion: 'Área al aire libre equipada con parrilla para asados familiares.',
        politicasUso: 'Uso obligatorio de carbón. Dejar la parrilla limpia y cerciorarse de apagar las brasas por completo antes de retirarse.',
        aforoMaximo: 15,
        lapsoMinutos: 180,
        horarios: [
          { dia: 'Viernes', inicio: '11:00', fin: '21:00' },
          { dia: 'Sábado', inicio: '10:00', fin: '21:00' },
          { dia: 'Domingo', inicio: '10:00', fin: '20:00' },
        ],
      },
      {
        nombre: 'Piscina y Zonas Húmedas',
        descripcion: 'Piscina para adultos y niños con duchas y vestieres.',
        politicasUso: 'Ducha obligatoria antes de ingresar al agua. Menores de 12 años deben estar acompañados por un adulto responsable. Prohibido alimentos dentro del agua.',
        aforoMaximo: 25,
        lapsoMinutos: 120,
        horarios: [
          { dia: 'Martes', inicio: '08:00', fin: '18:00' },
          { dia: 'Miércoles', inicio: '08:00', fin: '18:00' },
          { dia: 'Jueves', inicio: '08:00', fin: '18:00' },
          { dia: 'Viernes', inicio: '08:00', fin: '18:00' },
          { dia: 'Sábado', inicio: '08:00', fin: '18:00' },
          { dia: 'Domingo', inicio: '08:00', fin: '17:00' },
        ],
      },
      {
        nombre: 'Cancha Sintética / Múltiple',
        descripcion: 'Cancha deportiva para microfútbol, baloncesto y voleibol.',
        politicasUso: 'Uso de calzado deportivo adecuado. Prohibido el ingreso de envases de vidrio y bebidas alcohólicas.',
        aforoMaximo: 14,
        lapsoMinutos: 60,
        horarios: [
          { dia: 'Lunes', inicio: '06:00', fin: '22:00' },
          { dia: 'Martes', inicio: '06:00', fin: '22:00' },
          { dia: 'Miércoles', inicio: '06:00', fin: '22:00' },
          { dia: 'Jueves', inicio: '06:00', fin: '22:00' },
          { dia: 'Viernes', inicio: '06:00', fin: '22:00' },
          { dia: 'Sábado', inicio: '07:00', fin: '22:00' },
          { dia: 'Domingo', inicio: '07:00', fin: '20:00' },
        ],
      },
      {
        nombre: 'Gimnasio',
        descripcion: 'Equipamiento de pesas, cardio y entrenamiento funcional.',
        politicasUso: 'Uso obligatorio de toalla personal. Desinfectar las máquinas tras finalizar. Reorganizar discos y mancuernas en sus soportes.',
        aforoMaximo: 12,
        lapsoMinutos: 90,
        horarios: [
          { dia: 'Lunes', inicio: '05:00', fin: '22:00' },
          { dia: 'Martes', inicio: '05:00', fin: '22:00' },
          { dia: 'Miércoles', inicio: '05:00', fin: '22:00' },
          { dia: 'Jueves', inicio: '05:00', fin: '22:00' },
          { dia: 'Viernes', inicio: '05:00', fin: '22:00' },
          { dia: 'Sábado', inicio: '06:00', fin: '20:00' },
          { dia: 'Domingo', inicio: '07:00', fin: '18:00' },
        ],
      },
    ];
  }

  async findPublicByEdificio(edificioId: string) {
    return this.zonaModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .select(
        'nombre descripcion politicasUso imagenes enMantenimiento motivoMantenimiento mantenimientoFechaInicio mantenimientoHoraInicio mantenimientoFechaFin mantenimientoHoraFin horarios aforoMaximo lapsoMinutos',
      )
      .lean();
  }
}
