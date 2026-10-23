import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VisitaDocument = HydratedDocument<Visita> & { _id: Types.ObjectId };

export enum TipoVisita {
  INVITADO_QR = 'invitado_qr',
  AUTORIZACION = 'autorizacion', // Mudanza, contratista, remodelación, técnico
  IMPREVISTO = 'imprevisto',     // Visita sin previo aviso, repartidor/delivery
}

@Schema({ timestamps: true })
export class Visita {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({
    type: String,
    enum: TipoVisita,
    default: TipoVisita.IMPREVISTO,
    index: true,
  })
  tipo: TipoVisita;

  @Prop({ required: true, trim: true, uppercase: true })
  torre: string;

  @Prop({ required: true, trim: true, uppercase: true })
  apartamento: string;

  @Prop({ trim: true })
  residenteAQuienVisita?: string;

  @Prop({ required: true, trim: true })
  nombreVisitante: string;

  @Prop({ trim: true })
  documentoVisitante?: string;

  @Prop({ trim: true, uppercase: true })
  placaVehiculo?: string;

  @Prop({ trim: true })
  empresa?: string; // Domicilio, Servientrega, Claro, etc.

  @Prop({ trim: true })
  observaciones?: string;

  @Prop({ default: Date.now, index: true })
  fechaIngreso: Date;

  @Prop({ index: true })
  fechaSalida?: Date;

  // Atribución de ingreso
  @Prop({ type: Types.ObjectId, ref: 'Vigilante' })
  vigilanteIngresoId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  vigilanteIngresoNombre: string;

  // Atribución de salida
  @Prop({ type: Types.ObjectId, ref: 'Vigilante' })
  vigilanteSalidaId?: Types.ObjectId;

  @Prop({ trim: true })
  vigilanteSalidaNombre?: string;
}

export const VisitaSchema = SchemaFactory.createForClass(Visita);
VisitaSchema.index({ edificioId: 1, fechaSalida: 1, fechaIngreso: -1 });
VisitaSchema.index({ edificioId: 1, torre: 1, apartamento: 1 });
