import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ReservasService } from './reservas.service';

@Controller()
export class ReservasController {
  constructor(private reservasService: ReservasService) {}

  @Post('reservas')
  crear(@Body() dto: {
    zonaId: string;
    edificioId: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    nombreSolicitante: string;
    torreInmueble: string;
    tipo?: string;
  }) {
    return this.reservasService.crear({ ...dto, tipo: dto.tipo || 'propietario' });
  }

  @Get('reservas/disponibilidad')
  verificarDisponibilidad(@Query('zonaId') zonaId: string, @Query('fecha') fecha: string, @Query('horaInicio') horaInicio: string, @Query('horaFin') horaFin: string) {
    return this.reservasService.verificarDisponibilidad(zonaId, fecha, horaInicio, horaFin);
  }

  @Get('edificio/:edificioId/reservas')
  findByEdificio(@Param('edificioId') edificioId: string, @Query('fecha') fecha?: string, @Query('zonaId') zonaId?: string, @Query('estado') estado?: string) {
    return this.reservasService.findByEdificio(edificioId, { fecha, zonaId, estado });
  }

  @Post('reservas/:id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.reservasService.cancelar(id);
  }

  @Get('edificio/:edificioId/reportes')
  reportes(@Param('edificioId') edificioId: string) {
    return this.reservasService.obtenerReportes(edificioId);
  }
}
