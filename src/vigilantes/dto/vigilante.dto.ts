import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateVigilanteDto {
  @IsNotEmpty()
  @IsString()
  nombreCompleto: string;

  @IsNotEmpty()
  @IsString()
  cedula: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  empresaSeguridad?: string;
}

export class UpdateVigilanteDto {
  @IsOptional()
  @IsString()
  nombreCompleto?: string;

  @IsOptional()
  @IsString()
  cedula?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  empresaSeguridad?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class LoginPuestoDto {
  @IsNotEmpty()
  @IsString()
  usuario: string; // Puede ser el email del edificio, usuarioVigilancia o ID

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class SetPuestoPasswordDto {
  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  usuarioVigilancia?: string;
}
