import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ZonaDocument = HydratedDocument<Zona>;

@Schema({ timestamps: true })
export class Zona {
  @Prop({ required: true })
  nombre: string;

  @Prop()
  descripcion: string;

  @Prop({ default: '' })
  politicasUso: string;

  @Prop({ type: [String], default: [] })
  imagenes: string[];

  @Prop({ default: false })
  enMantenimiento: boolean;

  @Prop({ default: '' })
  motivoMantenimiento: string;

  @Prop({ default: '' })
  mantenimientoFechaInicio: string;

  @Prop({ default: '' })
  mantenimientoHoraInicio: string;

  @Prop({ default: '' })
  mantenimientoFechaFin: string;

  @Prop({ default: '' })
  mantenimientoHoraFin: string;

  @Prop({
    type: [
      {
        dia: { type: String },
        inicio: { type: String },
        fin: { type: String },
      },
    ],
    required: true,
    default: [],
  })
  horarios: { dia: string; inicio: string; fin: string }[];

  @Prop({ required: true })
  aforoMaximo: number;

  @Prop({ required: true })
  lapsoMinutos: number;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true })
  edificioId: Types.ObjectId;
}

export const ZonaSchema = SchemaFactory.createForClass(Zona);
