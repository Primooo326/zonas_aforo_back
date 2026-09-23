import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InmuebleDocument = HydratedDocument<Inmueble>;

export const TIPO_INMUEBLE = ['inmueble', 'parqueadero', 'habitacion'] as const;
export type TipoInmueble = (typeof TIPO_INMUEBLE)[number];

export const TRANSACCION = ['venta', 'arriendo'] as const;
export type Transaccion = (typeof TRANSACCION)[number];

export const ESTADO_INMUEBLE = [
  'activa',
  'vendida',
  'arrendada',
  'cancelada',
] as const;
export type EstadoInmueble = (typeof ESTADO_INMUEBLE)[number];

@Schema({ timestamps: true })
export class Inmueble {
  @Prop({ required: true, enum: TIPO_INMUEBLE, type: String })
  tipo: TipoInmueble;

  @Prop({ required: true, enum: TRANSACCION, type: String })
  transaccion: Transaccion;

  @Prop()
  metrosCuadrados?: number;

  @Prop()
  piso?: number;

  // inmueble: viene con parqueadero
  @Prop()
  parqueadero?: boolean;

  // inmueble, habitacion
  @Prop()
  balcon?: boolean;

  @Prop()
  deposito?: boolean;

  @Prop()
  amoblado?: boolean;

  // parqueadero: cubierto
  @Prop()
  cubierto?: boolean;

  @Prop({ required: true, min: 1 })
  precio: number;

  @Prop({ required: true })
  telefono: string;

  @Prop()
  emailContacto?: string;

  @Prop({ maxlength: 1000 })
  observacion?: string;

  @Prop({ type: [String], default: [] })
  imagenes: string[];

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Propietario', required: false })
  propietarioId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: ESTADO_INMUEBLE,
    default: 'activa',
    index: true,
    type: String,
  })
  estado: EstadoInmueble;
}

export const InmuebleSchema = SchemaFactory.createForClass(Inmueble);

// Índices compuestos para performance <200ms listado
InmuebleSchema.index({ edificioId: 1, estado: 1, tipo: 1 });
InmuebleSchema.index({ edificioId: 1, estado: 1, transaccion: 1 });
InmuebleSchema.index({ createdAt: -1 });
