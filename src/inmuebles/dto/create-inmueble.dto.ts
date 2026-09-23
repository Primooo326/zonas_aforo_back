import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  IsEmail,
  MaxLength,
  Min,
  IsArray,
  Matches,
} from 'class-validator';
import {
  TIPO_INMUEBLE,
  TRANSACCION,
  ESTADO_INMUEBLE,
} from '../inmueble.schema';

export class CreateInmuebleDto {
  @IsString()
  @IsIn([...TIPO_INMUEBLE] as string[], {
    message: `tipo debe ser uno de: ${TIPO_INMUEBLE.join(', ')}`,
  })
  tipo: string;

  @IsString()
  @IsIn([...TRANSACCION] as string[], {
    message: `transaccion debe ser uno de: ${TRANSACCION.join(', ')}`,
  })
  transaccion: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'metrosCuadrados debe ser mayor a 0' })
  metrosCuadrados?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'piso no puede ser negativo' })
  piso?: number;

  @IsOptional()
  @IsBoolean()
  parqueadero?: boolean;

  @IsOptional()
  @IsBoolean()
  balcon?: boolean;

  @IsOptional()
  @IsBoolean()
  deposito?: boolean;

  @IsOptional()
  @IsBoolean()
  amoblado?: boolean;

  @IsOptional()
  @IsBoolean()
  cubierto?: boolean;

  @IsNumber()
  @Min(1, { message: 'precio debe ser mayor a 0' })
  precio: number;

  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message: 'telefono debe ser un número válido (7-20 dígitos)',
  })
  telefono: string;

  @IsOptional()
  @IsEmail({}, { message: 'emailContacto debe ser un email válido' })
  emailContacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'observacion máximo 1000 caracteres' })
  observacion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagenes?: string[];

  @IsOptional()
  @IsString()
  @IsIn([...ESTADO_INMUEBLE] as string[])
  estado?: string;

  // Inyectado desde auth, no validar en request
  @IsOptional()
  edificioId?: string;

  @IsOptional()
  propietarioId?: string;
}
