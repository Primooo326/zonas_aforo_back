import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VigilanteDocument = HydratedDocument<Vigilante> & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class Vigilante {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombreCompleto: string;

  @Prop({ required: true, trim: true })
  cedula: string;

  @Prop({ trim: true })
  telefono?: string;

  @Prop({ trim: true })
  empresaSeguridad?: string;

  @Prop({ default: true })
  activo: boolean;
}

export const VigilanteSchema = SchemaFactory.createForClass(Vigilante);
VigilanteSchema.index({ edificioId: 1, cedula: 1 });
