import { Controller, Post, Body } from '@nestjs/common';
import { PropietariosService } from './propietarios.service';
import { RegisterPropietarioDto } from './dto/register-propietario.dto';
import { LoginPropietarioDto } from './dto/login-propietario.dto';

@Controller('auth/propietario')
export class PropietariosController {
  constructor(private propietariosService: PropietariosService) {}

  @Post('register')
  register(@Body() dto: RegisterPropietarioDto) {
    return this.propietariosService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginPropietarioDto) {
    return this.propietariosService.login(dto);
  }
}
