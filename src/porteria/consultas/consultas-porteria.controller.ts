import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ConsultasPorteriaService } from './consultas-porteria.service';

@Controller('porteria/consultas')
@UseGuards(JwtAuthGuard)
export class ConsultasPorteriaController {
  constructor(private readonly consultasService: ConsultasPorteriaService) {}

  @Get('directorio')
  buscarDirectorio(@Query('q') q: string, @Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.consultasService.buscarDirectorio(edificioId, q);
  }

  @Get('vehiculos')
  buscarVehiculo(@Query('placa') placa: string, @Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.consultasService.buscarPorPlaca(edificioId, placa);
  }

  @Get('mascotas')
  buscarMascotas(@Query('q') q: string, @Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.consultasService.buscarMascotas(edificioId, q);
  }

  @Get('reservas-hoy')
  reservasHoy(@Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.consultasService.reservasHoy(edificioId);
  }
}
