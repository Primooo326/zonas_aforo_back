import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaqueteDocument = HydratedDocument<Paquete> & { _id: Types.ObjectId };

export enum EstadoPaquete {
  RECIBIDO = 'recibido',
  ENTREGADO = 'entregado',
}

@Schema({ timestamps: true })
export class Paquete {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  torre: string;

  @Prop({ required: true, trim: true, uppercase: true })
  apartamento: string;

  @Prop({ trim: true })
  destinatario?: string; // Nombre del residente al que va dirigido

  @Prop({ required: true, trim: true })
  transportadora: string; // Servientrega, Coordinadora, Envía, Amazon, etc.

  @Prop({ default: 'paquete', trim: true })
  tipo: string; // paquete, sobre, domicilio, caja

  @Prop({ trim: true })
  fotoGuiaUrl?: string;

  @Prop({ trim: true })
  observaciones?: string;

  @Prop({ type: String, enum: EstadoPaquete, default: EstadoPaquete.RECIBIDO, index: true })
  estado: EstadoPaquete;

  // Recepción
  @Prop({ type: Types.ObjectId, ref: 'Vigilante' })
  vigilanteRecibioId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  vigilanteRecibioNombre: string;

  @Prop({ default: Date.now })
  fechaRecepcion: Date;

  // Entrega
  @Prop({ trim: true })
  entregadoA?: string; // Nombre del residente que lo retiró

  @Prop({ type: Types.ObjectId, ref: 'Vigilante' })
  vigilanteEntregoId?: Types.ObjectId;

  @Prop({ trim: true })
  vigilanteEntregoNombre?: string;

  @Prop()
  fechaEntrega?: Date;
}

export const PaqueteSchema = SchemaFactory.createForClass(Paquete);
PaqueteSchema.index({ edificioId: 1, torre: 1, apartamento: 1, estado: 1 });
PaqueteSchema.index({ edificioId: 1, estado: 1, createdAt: -1 });
