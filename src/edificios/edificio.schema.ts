import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EdificioDocument = HydratedDocument<Edificio> & { _id: any };

@Schema({ timestamps: true })
export class Edificio {
  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;
}

export const EdificioSchema = SchemaFactory.createForClass(Edificio);
