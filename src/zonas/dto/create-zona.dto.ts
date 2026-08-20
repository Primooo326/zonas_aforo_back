import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  IsMongoId,
  ValidateNested,
  Matches,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export const DIAS_VALIDOS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

export class HorarioZonaDto {
  @IsString()
  @IsIn(DIAS_VALIDOS)
  dia: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'inicio debe tener formato HH:MM',
  })
  inicio: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'fin debe tener formato HH:MM',
  })
  fin: string;
}

export class CreateZonaDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioZonaDto)
  horarios: HorarioZonaDto[];

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
