import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreatePaqueteDto {
  @IsNotEmpty()
  @IsString()
  torre: string;

  @IsNotEmpty()
  @IsString()
  apartamento: string;

  @IsOptional()
  @IsString()
  destinatario?: string;

  @IsNotEmpty()
  @IsString()
  transportadora: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  fotoGuiaUrl?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  vigilanteRecibioId?: string;

  @IsNotEmpty()
  @IsString()
  vigilanteRecibioNombre: string;
}

export class EntregarPaqueteDto {
  @IsNotEmpty()
  @IsString()
  entregadoA: string;

  @IsOptional()
  @IsString()
  vigilanteEntregoId?: string;

  @IsNotEmpty()
  @IsString()
  vigilanteEntregoNombre: string;
}
