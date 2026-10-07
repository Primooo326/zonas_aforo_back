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
}
