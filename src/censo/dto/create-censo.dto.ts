import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CONDICION_PERSONA,
  TIPO_MASCOTA,
  TIPO_VEHICULO,
  TIPO_OCUPACION,
  ESTADO_CENSO,
} from '../censo.schema';

export class PersonaCensoDto {
  @IsString()
  @IsNotEmpty()
  nombreCompleto: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  documento?: string;

  @IsDateString()
  @IsNotEmpty()
  fechaNacimiento: string;

  @IsString()
  @IsOptional()
  @IsIn([...CONDICION_PERSONA] as string[])
  condicion?: string;

  @IsBoolean()
  @IsOptional()
  esContactoPrincipal?: boolean;
}

export class MascotaCensoDto {
  @IsString()
  @IsIn([...TIPO_MASCOTA] as string[])
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  raza: string;

  @IsBoolean()
  @IsOptional()
  esPeligroso?: boolean;

  @IsBoolean()
  @IsOptional()
  vacunasAlDia?: boolean;

  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class VehiculoCensoDto {
  @IsString()
  @IsIn([...TIPO_VEHICULO] as string[])
  @IsNotEmpty()
  tipo: string;

  @IsString()
  @IsNotEmpty()
  placa: string;

  @IsString()
  @IsOptional()
  marca?: string;

  @IsString()
  @IsOptional()
  modelo?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsOptional()
  parqueaEnEdificio?: boolean;

  @IsString()
  @IsOptional()
  numeroParqueadero?: string;
}

export class CreateCensoDto {
  @IsString()
  @IsNotEmpty()
  identificador: string;

  @IsString()
  @IsOptional()
  torre?: string;

  @IsString()
  @IsOptional()
  numeroApto?: string;

  @IsString()
  @IsOptional()
  @IsIn([...TIPO_OCUPACION] as string[])
  tipoOcupacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonaCensoDto)
  @IsOptional()
  personas?: PersonaCensoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MascotaCensoDto)
  @IsOptional()
  mascotas?: MascotaCensoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehiculoCensoDto)
  @IsOptional()
  vehiculos?: VehiculoCensoDto[];

  @IsString()
  @IsOptional()
  @IsIn([...ESTADO_CENSO] as string[])
  estado?: string;

  @IsString()
  @IsOptional()
  notasAdministracion?: string;
}
