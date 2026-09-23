import { IsString, IsEmail, MinLength, IsMongoId, IsOptional } from 'class-validator';

export class RegisterPropietarioDto {
  @IsString()
  nombre: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'password mínimo 6 caracteres' })
  password: string;

  @IsMongoId()
  edificioId: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}
