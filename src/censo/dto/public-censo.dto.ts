import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PersonaCensoDto,
  MascotaCensoDto,
  VehiculoCensoDto,
} from './create-censo.dto';

export class PublicCensoDto {
  @IsString()
  @IsNotEmpty()
  identificador: string;

  @IsString()
  @IsOptional()
  torre?: string;

  @IsString()
  @IsOptional()
  numeroApto?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonaCensoDto)
  @IsOptional()
  personas?: PersonaCensoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MascotaCensoDto)
  @IsOptional()
  mascotas?: MascotaCensoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehiculoCensoDto)
  @IsOptional()
  vehiculos?: VehiculoCensoDto[];
}
