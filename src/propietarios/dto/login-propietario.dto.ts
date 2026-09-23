import { IsEmail, IsString } from 'class-validator';

export class LoginPropietarioDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
