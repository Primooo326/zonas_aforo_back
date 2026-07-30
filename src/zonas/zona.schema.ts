import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ZonaDocument = HydratedDocument<Zona>;

@Schema({ timestamps: true })
export class Zona {
  @Prop({ required: true })
  nombre: string;

  @Prop()
  descripcion: string;

  @Prop({ required: true })
  horarioInicio: string;

  @Prop({ required: true })
  horarioFin: string;

  @Prop({ required: true })
  diasDisponibles: string[];

  @Prop({ required: true })
  aforoMaximo: number;

  @Prop({ required: true })
  lapsoMinutos: number;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true })
  edificioId: Types.ObjectId;
}

export const ZonaSchema = SchemaFactory.createForClass(Zona);
