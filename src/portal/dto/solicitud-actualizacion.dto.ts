import { IsOptional, IsString, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PersonaCensoDto, MascotaCensoDto, VehiculoCensoDto } from '../../censo/dto/create-censo.dto';
import { TIPO_OCUPACION } from '../../censo/censo.schema';

export class SolicitudActualizacionDto {
  @IsOptional()
  @IsString()
  @IsIn([...TIPO_OCUPACION] as string[])
  tipoOcupacion?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PersonaCensoDto)
  personas?: PersonaCensoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MascotaCensoDto)
  mascotas?: MascotaCensoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehiculoCensoDto)
  vehiculos?: VehiculoCensoDto[];

  @IsOptional()
  @IsString()
  motivoCambio?: string;
}
