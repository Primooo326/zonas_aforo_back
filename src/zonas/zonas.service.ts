import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Zona } from './zona.schema';

@Injectable()
export class ZonasService {
  constructor(@InjectModel(Zona.name) private zonaModel: Model<Zona>) {}

  async create(dto: {
    nombre: string;
    descripcion: string;
    horarioInicio: string;
    horarioFin: string;
    diasDisponibles: string[];
    aforoMaximo: number;
    lapsoMinutos: number;
    edificioId: string;
  }) {
    return this.zonaModel.create({ ...dto, edificioId: new Types.ObjectId(dto.edificioId) });
  }

  async findAll(edificioId: string) {
    return this.zonaModel.find({ edificioId: new Types.ObjectId(edificioId) }).lean();
  }

  async findOne(id: string) {
    const zona = await this.zonaModel.findById(id).lean();
    if (!zona) throw new NotFoundException('Zona no encontrada');
    return zona;
  }

  async update(id: string, dto: Partial<Zona>) {
    const zona = await this.zonaModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!zona) throw new NotFoundException('Zona no encontrada');
    return zona;
  }

  async remove(id: string) {
    const zona = await this.zonaModel.findByIdAndDelete(id).lean();
    if (!zona) throw new NotFoundException('Zona no encontrada');
    return zona;
  }
}
