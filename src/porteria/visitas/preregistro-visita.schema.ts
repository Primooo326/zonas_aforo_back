import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PreRegistroVisitaDocument = HydratedDocument<PreRegistroVisita> & {
  _id: Types.ObjectId;
};

export enum ModalidadPase {
  UN_SOLO_USO = 'un_solo_uso',
  TEMPORAL = 'temporal',
}

export enum EstadoPreRegistro {
  ACTIVO = 'activo',
  CONSUMIDO = 'consumido',
  CANCELADO = 'cancelado',
  EXPIRADO = 'expirado',
}

export enum MotivoVisita {
  SOCIAL = 'social',
  FAMILIAR = 'familiar',
  CONTRATISTA = 'contratista',
  SERVICIO_TECNICO = 'servicio_tecnico',
  MUDANZA = 'mudanza',
  OTRO = 'otro',
}

@Schema({ timestamps: true })
export class PreRegistroVisita {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CensoUnidad', index: true })
  censoUnidadId?: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  torre: string;

  @Prop({ required: true, trim: true, uppercase: true })
  apartamento: string;

  @Prop({ required: true, trim: true })
  residenteNombre: string;

  @Prop({ required: true, trim: true, index: true })
  residenteUserId: string;

  @Prop({ required: true, trim: true })
  nombreVisitante: string;

  @Prop({ trim: true })
  documentoVisitante?: string;

  @Prop({ trim: true, uppercase: true })
  placaVehiculo?: string;

  @Prop({
    type: String,
    enum: MotivoVisita,
    default: MotivoVisita.SOCIAL,
  })
  motivo: MotivoVisita;

  @Prop({
    type: String,
    enum: ModalidadPase,
    default: ModalidadPase.UN_SOLO_USO,
  })
  modalidad: ModalidadPase;

  @Prop({ required: true, type: Date, index: true })
  fechaInicio: Date;

  @Prop({ type: Date })
  fechaFin?: Date;

  @Prop({ trim: true })
  observaciones?: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  codigoAcceso: string;

  @Prop({
    type: String,
    enum: EstadoPreRegistro,
    default: EstadoPreRegistro.ACTIVO,
    index: true,
  })
  estado: EstadoPreRegistro;

  @Prop({ type: Types.ObjectId, ref: 'Visita' })
  visitaId?: Types.ObjectId;
}

export const PreRegistroVisitaSchema =
  SchemaFactory.createForClass(PreRegistroVisita);

PreRegistroVisitaSchema.index({ edificioId: 1, estado: 1, fechaInicio: 1 });
PreRegistroVisitaSchema.index({ edificioId: 1, torre: 1, apartamento: 1 });
