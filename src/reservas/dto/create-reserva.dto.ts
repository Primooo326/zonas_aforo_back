import { IsString, IsOptional } from 'class-validator';

export class CreateReservaDto {
  @IsString()
  zonaId: string;

  @IsString()
  edificioId: string;

  @IsString()
  fecha: string;

  @IsString()
  horaInicio: string;

  @IsString()
  horaFin: string;

  @IsString()
  nombreSolicitante: string;

  @IsString()
  torreInmueble: string;

  @IsOptional()
  @IsString()
  tipo?: string;
}
