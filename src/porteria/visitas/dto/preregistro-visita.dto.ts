import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ModalidadPase, MotivoVisita } from '../preregistro-visita.schema';

export class CrearPreRegistroDto {
  @IsNotEmpty({ message: 'El nombre del visitante es obligatorio' })
  @IsString()
  nombreVisitante: string;

  @IsOptional()
  @IsString()
  documentoVisitante?: string;

  @IsOptional()
  @IsString()
  placaVehiculo?: string;

  @IsOptional()
  @IsEnum(MotivoVisita, {
    message: 'Motivo inválido (social, familiar, contratista, servicio_tecnico, mudanza, otro)',
  })
  motivo?: MotivoVisita;

  @IsOptional()
  @IsEnum(ModalidadPase, {
    message: 'Modalidad inválida (un_solo_uso, temporal)',
  })
  modalidad?: ModalidadPase;

  @IsNotEmpty({ message: 'La fecha de inicio o fecha programada es requerida' })
  @IsDateString({}, { message: 'Fecha de inicio inválida' })
  fechaInicio: string;

  @IsOptional()
  @IsDateString({}, { message: 'Fecha de fin inválida' })
  fechaFin?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ConfirmarIngresoProgramadoDto {
  @IsOptional()
  @IsString()
  vigilanteId?: string;

  @IsNotEmpty({ message: 'El nombre del vigilante es obligatorio' })
  @IsString()
  vigilanteNombre: string;

  @IsOptional()
  @IsString()
  placaVehiculo?: string;

  @IsOptional()
  @IsString()
  documentoVisitante?: string;
}
