import { IsString, IsOptional } from 'class-validator';

export class CreateSolicitudDto {
  @IsString()
  zonaId: string;

  @IsString()
  fecha: string;

  @IsString()
  horaInicio: string;

  @IsString()
  nombreSolicitante: string;

  @IsString()
  torreInmueble: string;

  @IsOptional()
  @IsString()
  tipo?: string;
}
