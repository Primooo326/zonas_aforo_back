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
    horarioInicio: string,
    horarioFin: string,
    lapsoMinutos: number,
  ) {
    const [h1, m1] = horarioInicio.split(':').map(Number);
    const [h2, m2] = horarioFin.split(':').map(Number);
    const totalMinutos = h2 * 60 + m2 - (h1 * 60 + m1);
    if (totalMinutos <= 0) {
      throw new BadRequestException(
        'El horario de fin debe ser posterior al de inicio',
      );
    }
    if (lapsoMinutos > totalMinutos) {
      throw new BadRequestException(
        `El lapso (${lapsoMinutos}min) excede el horario disponible (${totalMinutos}min)`,
      );
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
    this.validarLapso(dto.horarioInicio, dto.horarioFin, dto.lapsoMinutos);
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

    const horarioInicio = dto.horarioInicio;
    const horarioFin = dto.horarioFin;
    const lapsoMinutos = dto.lapsoMinutos;

    if (
      (horarioInicio || horarioFin || lapsoMinutos) &&
      !(horarioInicio && horarioFin && lapsoMinutos)
    ) {
      const zona = await this.zonaModel.findById(id).lean();
      if (!zona) throw new NotFoundException('Zona no encontrada');
      this.validarLapso(
        horarioInicio || zona.horarioInicio,
        horarioFin || zona.horarioFin,
        lapsoMinutos ?? zona.lapsoMinutos,
      );
    } else if (horarioInicio && horarioFin && lapsoMinutos) {
      this.validarLapso(horarioInicio, horarioFin, lapsoMinutos);
    }

    const zona = await this.zonaModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!zona) throw new NotFoundException('Zona no encontrada');
    return zona;
  }

  async remove(id: string, edificioId: string) {
    await this.validarPropietario(id, edificioId);
    const zona = await this.zonaModel.findByIdAndDelete(id).lean();
    if (!zona) throw new NotFoundException('Zona no encontrada');
    return zona;
  }

  async findPublicByEdificio(edificioId: string) {
    return this.zonaModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .select(
        'nombre descripcion horarioInicio horarioFin diasDisponibles aforoMaximo lapsoMinutos',
      )
      .lean();
  }
}
