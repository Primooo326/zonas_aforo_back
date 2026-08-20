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

  async findPublicByEdificio(edificioId: string) {
    return this.zonaModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .select('nombre descripcion horarios aforoMaximo lapsoMinutos')
      .lean();
  }
}
