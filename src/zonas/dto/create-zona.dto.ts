import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  IsMongoId,
} from 'class-validator';

export class CreateZonaDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  horarioInicio: string;

  @IsString()
  horarioFin: string;

  @IsArray()
  diasDisponibles: string[];

  @IsNumber()
  @Min(1)
  aforoMaximo: number;

  @IsNumber()
  @Min(1)
  lapsoMinutos: number;

  @IsOptional()
  @IsMongoId()
  edificioId?: string;
}
