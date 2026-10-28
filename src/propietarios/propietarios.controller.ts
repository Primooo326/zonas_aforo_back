import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { PropietariosService } from './propietarios.service';
import { RegisterPropietarioDto } from './dto/register-propietario.dto';
import { LoginPropietarioDto } from './dto/login-propietario.dto';
import { RegistroInvitacionDto } from './dto/registro-invitacion.dto';
import { ActivarORecuperarDto } from './dto/activar-recuperar.dto';

@Controller('auth/propietario')
export class PropietariosController {
  constructor(private readonly propietariosService: PropietariosService) {}

  @Get('invitacion/:token')
  validarInvitacion(@Param('token') token: string) {
    return this.propietariosService.validarInvitacion(token);
  }

  @Post('registro-invitacion')
  registrarConInvitacion(@Body() dto: RegistroInvitacionDto) {
    return this.propietariosService.registrarConInvitacion(dto);
  }

  @Post('activar-o-recuperar')
  activarORecuperar(@Body() dto: ActivarORecuperarDto) {
    return this.propietariosService.activarORecuperar(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterPropietarioDto) {
    return this.propietariosService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginPropietarioDto) {
    return this.propietariosService.login(dto);
  }
}
