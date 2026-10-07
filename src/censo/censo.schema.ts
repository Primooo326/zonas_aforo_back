import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CensoUnidadDocument = HydratedDocument<CensoUnidad> & { _id: Types.ObjectId };

export const CONDICION_PERSONA = ['propietario', 'arrendatario', 'conviviente'] as const;
export type CondicionPersona = (typeof CONDICION_PERSONA)[number];

export const TIPO_MASCOTA = ['perro', 'gato', 'otro'] as const;
export type TipoMascota = (typeof TIPO_MASCOTA)[number];

export const TIPO_VEHICULO = ['carro', 'moto', 'bicicleta', 'otro'] as const;
export type TipoVehiculo = (typeof TIPO_VEHICULO)[number];

export const ESTADO_CENSO = ['aprobado', 'pendiente', 'pendiente_actualizacion', 'rechazado'] as const;
export type EstadoCenso = (typeof ESTADO_CENSO)[number];

export const TIPO_OCUPACION = ['habitada', 'desocupada'] as const;
export type TipoOcupacion = (typeof TIPO_OCUPACION)[number];

@Schema({ _id: false })
export class PersonaCenso {
  @Prop({ required: true, trim: true })
  nombreCompleto: string;

  @Prop({ trim: true })
  telefono?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  documento?: string;

  @Prop({ required: true })
  fechaNacimiento: Date;

  @Prop({ required: true, enum: CONDICION_PERSONA, default: 'conviviente', type: String })
  condicion: CondicionPersona;

  @Prop({ default: false })
  esContactoPrincipal: boolean;
}
export const PersonaCensoSchema = SchemaFactory.createForClass(PersonaCenso);

@Schema({ _id: false })
export class MascotaCenso {
  @Prop({ required: true, enum: TIPO_MASCOTA, default: 'perro', type: String })
  tipo: TipoMascota;

  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  raza: string;

  @Prop({ default: false })
  esPeligroso: boolean;

  @Prop({ default: true })
  vacunasAlDia: boolean;

  @Prop({ trim: true })
  observaciones?: string;
}
export const MascotaCensoSchema = SchemaFactory.createForClass(MascotaCenso);

@Schema({ _id: false })
export class VehiculoCenso {
  @Prop({ required: true, enum: TIPO_VEHICULO, default: 'carro', type: String })
  tipo: TipoVehiculo;

  @Prop({ required: true, uppercase: true, trim: true })
  placa: string;

  @Prop({ trim: true })
  marca?: string;

  @Prop({ trim: true })
  modelo?: string;

  @Prop({ trim: true })
  color?: string;

  @Prop({ default: false })
  parqueaEnEdificio: boolean;

  @Prop({ trim: true })
  numeroParqueadero?: string;
}
export const VehiculoCensoSchema = SchemaFactory.createForClass(VehiculoCenso);

@Schema({ _id: false })
export class ParqueaderoAsignado {
  @Prop({ required: true, trim: true })
  numero: string;

  @Prop({ default: 'carro', trim: true })
  tipo: string;

  @Prop({ default: true })
  esCubierto: boolean;
}
export const ParqueaderoAsignadoSchema = SchemaFactory.createForClass(ParqueaderoAsignado);

@Schema({ _id: false })
export class BodegaAsignada {
  @Prop({ required: true, trim: true })
  numero: string;

  @Prop({ trim: true })
  ubicacion?: string;

  @Prop()
  metrosCuadrados?: number;
}
export const BodegaAsignadaSchema = SchemaFactory.createForClass(BodegaAsignada);

@Schema({ timestamps: true })
export class CensoUnidad {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  identificador: string;

  @Prop({ trim: true })
  torre?: string;

  @Prop({ trim: true })
  numeroApto?: string;

  @Prop()
  piso?: number;

  @Prop()
  cuartos?: number;

  @Prop()
  banos?: number;

  @Prop({ default: false })
  tieneBalcon?: boolean;

  @Prop()
  metrosCuadrados?: number;

  @Prop({ default: false })
  tienePatio?: boolean;

  @Prop()
  coeficiente?: number;

  @Prop({ type: [ParqueaderoAsignadoSchema], default: [] })
  parqueaderosAsignados?: ParqueaderoAsignado[];

  @Prop({ type: [BodegaAsignadaSchema], default: [] })
  bodegasAsignadas?: BodegaAsignada[];

  @Prop({ required: true, enum: TIPO_OCUPACION, default: 'habitada', type: String })
  tipoOcupacion: TipoOcupacion;

  @Prop({ type: [PersonaCensoSchema], default: [] })
  personas: PersonaCenso[];

  @Prop({ type: [MascotaCensoSchema], default: [] })
  mascotas: MascotaCenso[];

  @Prop({ type: [VehiculoCensoSchema], default: [] })
  vehiculos: VehiculoCenso[];

  @Prop({ required: true, enum: ESTADO_CENSO, default: 'aprobado', index: true, type: String })
  estado: EstadoCenso;

  @Prop({ type: Types.ObjectId, ref: 'CensoUnidad', required: false })
  unidadOriginalId?: Types.ObjectId;

  @Prop({ trim: true })
  notasAdministracion?: string;
}

export const CensoUnidadSchema = SchemaFactory.createForClass(CensoUnidad);

CensoUnidadSchema.index({ edificioId: 1, identificador: 1 });
CensoUnidadSchema.index({ edificioId: 1, torre: 1, numeroApto: 1 });
CensoUnidadSchema.index({ edificioId: 1, estado: 1 });
CensoUnidadSchema.index({ edificioId: 1, 'vehiculos.placa': 1 });
CensoUnidadSchema.index({ edificioId: 1, 'personas.nombreCompleto': 1 });

// Inventario global de parqueaderos del edificio
export type ParqueaderoInventarioDocument = HydratedDocument<ParqueaderoInventario> & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class ParqueaderoInventario {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  numero: string;

  @Prop({ default: 'carro', trim: true })
  tipo: string;

  @Prop({ default: false })
  esVisitante: boolean;

  @Prop({ default: true })
  esCubierto: boolean;

  @Prop({ trim: true })
  torreAsignada?: string;

  @Prop({ trim: true })
  aptoAsignado?: string;
}
export const ParqueaderoInventarioSchema = SchemaFactory.createForClass(ParqueaderoInventario);
ParqueaderoInventarioSchema.index({ edificioId: 1, numero: 1 });

// Inventario global de bodegas del edificio
export type BodegaInventarioDocument = HydratedDocument<BodegaInventario> & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class BodegaInventario {
  _id?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  numero: string;

  @Prop({ trim: true })
  ubicacion?: string;

  @Prop()
  metrosCuadrados?: number;

  @Prop({ trim: true })
  torreAsignada?: string;

  @Prop({ trim: true })
  aptoAsignado?: string;
}
export const BodegaInventarioSchema = SchemaFactory.createForClass(BodegaInventario);
BodegaInventarioSchema.index({ edificioId: 1, numero: 1 });
