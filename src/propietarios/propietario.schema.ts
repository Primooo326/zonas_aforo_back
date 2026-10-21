import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PropietarioDocument = HydratedDocument<Propietario> & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class Propietario {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: Types.ObjectId, ref: 'Edificio', required: true, index: true })
  edificioId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CensoUnidad', required: false, index: true })
  censoUnidadId?: Types.ObjectId;

  @Prop({ required: true, enum: ['propietario', 'arrendatario', 'habitante'], default: 'propietario' })
  tipoResidente: string;

  @Prop({ required: true, enum: ['activo', 'pendiente_aprobacion', 'inactivo'], default: 'activo', index: true })
  estado: string;

  @Prop({ trim: true })
  telefono?: string;

  @Prop({ default: false })
  esContactoPrincipal?: boolean;
}

export const PropietarioSchema = SchemaFactory.createForClass(Propietario);
PropietarioSchema.index({ edificioId: 1, email: 1 });
PropietarioSchema.index({ edificioId: 1, censoUnidadId: 1 });
