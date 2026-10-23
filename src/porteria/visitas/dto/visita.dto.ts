import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { TipoVisita } from '../visita.schema';

export class RegistrarVisitaDto {
  @IsOptional()
  @IsEnum(TipoVisita)
  tipo?: TipoVisita;

  @IsNotEmpty()
  @IsString()
  torre: string;

  @IsNotEmpty()
  @IsString()
  apartamento: string;

  @IsOptional()
  @IsString()
  residenteAQuienVisita?: string;

  @IsNotEmpty()
  @IsString()
  nombreVisitante: string;

  @IsOptional()
  @IsString()
  documentoVisitante?: string;

  @IsOptional()
  @IsString()
  placaVehiculo?: string;

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  vigilanteIngresoId?: string;

  @IsNotEmpty()
  @IsString()
  vigilanteIngresoNombre: string;
}

export class RegistrarSalidaDto {
  @IsOptional()
  @IsString()
  vigilanteSalidaId?: string;

  @IsNotEmpty()
  @IsString()
  vigilanteSalidaNombre: string;
}
