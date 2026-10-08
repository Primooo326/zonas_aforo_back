import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportarInmuebleItemDto {
  @IsOptional()
  @IsString()
  torre?: string;

  @IsString()
  numeroApto: string;

  @IsOptional()
  @IsNumber()
  piso?: number;

  @IsOptional()
  @IsNumber()
  cuartos?: number;

  @IsOptional()
  @IsNumber()
  banos?: number;

  @IsOptional()
  @IsBoolean()
  tieneBalcon?: boolean;

  @IsOptional()
  @IsNumber()
  metrosCuadrados?: number;

  @IsOptional()
  @IsBoolean()
  tienePatio?: boolean;

  @IsOptional()
  @IsNumber()
  coeficiente?: number;

  @IsOptional()
  @IsString()
  tipoOcupacion?: string;
}

export class ImportarParqueaderoItemDto {
  @IsString()
  numeroParqueadero: string;

  @IsOptional()
  @IsString()
  torreAsignada?: string;

  @IsOptional()
  @IsString()
  aptoAsignado?: string;

  @IsOptional()
  @IsBoolean()
  esVisitante?: boolean;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsBoolean()
  esCubierto?: boolean;
}

export class ImportarBodegaItemDto {
  @IsString()
  numeroBodega: string;

  @IsOptional()
  @IsString()
  torreAsignada?: string;

  @IsOptional()
  @IsString()
  aptoAsignado?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsNumber()
  metrosCuadrados?: number;
}

export class ImportarResidenteItemDto {
  @IsOptional()
  @IsString()
  torre?: string;

  @IsOptional()
  @IsString()
  apto?: string;

  @IsOptional()
  @IsString()
  identificador?: string;

  @IsString()
  nombreCompleto: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsString()
  condicion: string;

  @IsOptional()
  @IsBoolean()
  esContactoPrincipal?: boolean;

  @IsString()
  fechaNacimiento: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

export class ImportarMascotaItemDto {
  @IsOptional()
  @IsString()
  torre?: string;

  @IsOptional()
  @IsString()
  apto?: string;

  @IsOptional()
  @IsString()
  identificador?: string;

  @IsString()
  tipo: string;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  raza?: string;

  @IsOptional()
  @IsBoolean()
  esPeligroso?: boolean;

  @IsOptional()
  @IsBoolean()
  vacunasAlDia?: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ImportarVehiculoItemDto {
  @IsOptional()
  @IsString()
  torre?: string;

  @IsOptional()
  @IsString()
  apto?: string;

  @IsOptional()
  @IsString()
  identificador?: string;

  @IsString()
  tipo: string;

  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  parqueaEnEdificio?: boolean;

  @IsOptional()
  @IsString()
  numeroParqueadero?: string;
}

export class ImportarMasivoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportarInmuebleItemDto)
  inmuebles: ImportarInmuebleItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportarParqueaderoItemDto)
  parqueaderos?: ImportarParqueaderoItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportarBodegaItemDto)
  bodegas?: ImportarBodegaItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportarResidenteItemDto)
  residentes?: ImportarResidenteItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportarMascotaItemDto)
  mascotas?: ImportarMascotaItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportarVehiculoItemDto)
  vehiculos?: ImportarVehiculoItemDto[];
}
