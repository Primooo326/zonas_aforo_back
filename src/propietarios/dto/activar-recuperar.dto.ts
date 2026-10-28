import { IsString, MinLength, IsEmail } from 'class-validator';

export class ActivarORecuperarDto {
  @IsEmail({}, { message: 'Ingresa un correo electrónico válido' })
  email: string;

  @IsString({ message: 'El código de censo o invitación es requerido' })
  codigoCenso: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}
