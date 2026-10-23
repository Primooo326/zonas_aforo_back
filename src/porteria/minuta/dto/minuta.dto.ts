import { IsNotEmpty, IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { SeveridadNovedad } from '../minuta.schema';

export class CreateMinutaDto {
  @IsNotEmpty()
  @IsEnum(SeveridadNovedad)
  severidad: SeveridadNovedad;

  @IsNotEmpty()
  @IsString()
  titulo: string;

  @IsNotEmpty()
  @IsString()
  descripcion: string;

  @IsOptional()
  @IsArray()
  fotos?: string[];

  @IsOptional()
  @IsString()
  vigilanteId?: string;

  @IsNotEmpty()
  @IsString()
  vigilanteNombre: string;
}

export class RevisarMinutaDto {
  @IsOptional()
  @IsString()
  notasAdmin?: string;
}
