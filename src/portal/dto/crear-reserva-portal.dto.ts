import { IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class CrearReservaPortalDto {
  @IsString()
  @IsNotEmpty()
  zonaId: string;

  @IsString()
  @IsNotEmpty()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  horaInicio: string;

  @IsString()
  @IsOptional()
  horaFin?: string;

  @IsString()
  @IsOptional()
  nombreSolicitante?: string;

  @IsString()
  @IsOptional()
  telefonoContacto?: string;

  @IsNumber()
  @IsOptional()
  @Min(18)
  edadSolicitante?: number;
}
