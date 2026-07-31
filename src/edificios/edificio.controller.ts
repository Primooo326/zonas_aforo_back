import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Edificio } from './edificio.schema';

@Controller('edificio')
export class EdificioController {
  constructor(
    @InjectModel(Edificio.name) private edificioModel: Model<Edificio>,
  ) {}

  @Get(':id')
  async findPublic(@Param('id') id: string) {
    const edificio = await this.edificioModel.findById(id).lean();
    if (!edificio) throw new NotFoundException('Edificio no encontrado');
    const plain = edificio as {
      _id: { toString(): string };
      nombre: string;
      email: string;
    };
    return {
      id: plain._id.toString(),
      nombre: plain.nombre,
      email: plain.email,
    };
  }
}
