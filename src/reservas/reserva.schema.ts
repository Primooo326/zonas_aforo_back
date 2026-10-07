import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReservaDocument = HydratedDocument<Reserva>;

@Schema({ timestamps: true })
export class Reserva {
  @Prop({ type: Types.ObjectId, ref: 'Zona', required: true })
  zonaId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true })
  edificioId: Types.ObjectId;

  @Prop({ required: true })
  fecha: string;

  @Prop({ required: true })
  horaInicio: string;

  @Prop({ required: true })
  horaFin: string;

  @Prop({ required: true })
  nombreSolicitante: string;

  @Prop({ required: true })
  torreInmueble: string;

  @Prop({ required: true, default: 'propietario' })
  tipo: string;

  @Prop({ type: Types.ObjectId, ref: 'CensoUnidad', required: false, index: true })
  censoUnidadId?: Types.ObjectId;

  @Prop({ default: false })
  esCensoVerificado?: boolean;

  @Prop({ trim: true })
  telefonoContacto?: string;

  @Prop({ default: 'activa' })
  estado: string;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);

ReservaSchema.index({ edificioId: 1, fecha: 1, estado: 1 });
ReservaSchema.index({ edificioId: 1, censoUnidadId: 1 });
