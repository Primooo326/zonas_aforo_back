import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PropietarioDocument = HydratedDocument<Propietario> & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class Propietario {
  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop()
  telefono?: string;
}

export const PropietarioSchema = SchemaFactory.createForClass(Propietario);
PropietarioSchema.index({ edificioId: 1, email: 1 });
