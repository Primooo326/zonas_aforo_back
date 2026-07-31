import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class ReservasController {
  constructor(private reservasService: ReservasService) {}

  @Post('reservas')
  @UseGuards(JwtAuthGuard)
  crear(@Body() dto: CreateReservaDto) {
    return this.reservasService.crear({
      ...dto,
      tipo: dto.tipo || 'propietario',
    });
  }

  @Get('zonas/:id/public')
  getZonaPublic(@Param('id') id: string) {
    return this.reservasService.getZonaPublic(id);
  }

  @Get('edificio/:id/zonas')
  getZonasByEdificio(@Param('id') id: string) {
    return this.reservasService.getZonasByEdificio(id);
  }

  @Post('solicitudes')
  @HttpCode(201)
  crearSolicitud(@Body() dto: CreateSolicitudDto) {
    return this.reservasService.crearSolicitud(dto);
  }

  @Get('reservas/disponibilidad')
  verificarDisponibilidad(
    @Query('zonaId') zonaId: string,
    @Query('fecha') fecha: string,
    @Query('horaInicio') horaInicio: string,
    @Query('horaFin') horaFin: string,
  ) {
    return this.reservasService.verificarDisponibilidad(
      zonaId,
      fecha,
      horaInicio,
      horaFin,
    );
  }

  @Get('edificio/:edificioId/reservas')
  @UseGuards(JwtAuthGuard)
  findByEdificio(
    @Param('edificioId') edificioId: string,
    @Query('fecha') fecha?: string,
    @Query('zonaId') zonaId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.reservasService.findByEdificio(edificioId, {
      fecha,
      zonaId,
      estado,
    });
  }

  @Post('reservas/:id/cancelar')
  @UseGuards(JwtAuthGuard)
  cancelar(@Param('id') id: string) {
    return this.reservasService.cancelar(id);
  }

  @Get('edificio/:edificioId/reportes')
  @UseGuards(JwtAuthGuard)
  reportes(@Param('edificioId') edificioId: string) {
    return this.reservasService.obtenerReportes(edificioId);
  }
}
