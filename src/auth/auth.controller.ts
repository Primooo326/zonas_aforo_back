import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: { nombre: string; email: string; password: string; direccion: string; telefono: string }) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: { email: string; password: string }) {
    return this.authService.login(dto);
  }
}
