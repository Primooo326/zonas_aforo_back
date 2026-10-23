import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MinutaDocument = HydratedDocument<Minuta> & { _id: Types.ObjectId };

export enum SeveridadNovedad {
  RUTINARIA = 'rutinaria',         // Rondas, entrega de turno, sin novedad
  MANTENIMIENTO = 'mantenimiento', // Daños, filtraciones, iluminación, fallas técnicas
  INCIDENTE = 'incidente_grave',    // Ruido, disputas, policía, emergencias
}

@Schema({ timestamps: true })
export class Minuta {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({
    type: String,
    enum: SeveridadNovedad,
    default: SeveridadNovedad.RUTINARIA,
    index: true,
  })
  severidad: SeveridadNovedad;

  @Prop({ required: true, trim: true })
  titulo: string;

  @Prop({ required: true, trim: true })
  descripcion: string;

  @Prop({ type: [String], default: [] })
  fotos: string[];

  // Atribución de autoría del vigilante
  @Prop({ type: Types.ObjectId, ref: 'Vigilante' })
  vigilanteId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  vigilanteNombre: string;

  @Prop({ default: Date.now, index: true })
  fechaHora: Date;

  // Interacción con Administración
  @Prop({ default: false, index: true })
  revisadoPorAdmin: boolean;

  @Prop({ trim: true })
  notasAdmin?: string;

  @Prop()
  fechaRevisionAdmin?: Date;
}

export const MinutaSchema = SchemaFactory.createForClass(Minuta);
MinutaSchema.index({ edificioId: 1, fechaHora: -1 });
MinutaSchema.index({ edificioId: 1, severidad: 1, revisadoPorAdmin: 1 });
