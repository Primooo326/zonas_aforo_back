import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { VisitasService } from './visitas.service';
import { RegistrarVisitaDto, RegistrarSalidaDto } from './dto/visita.dto';
import { ConfirmarIngresoProgramadoDto } from './dto/preregistro-visita.dto';

@Controller('porteria/visitas')
@UseGuards(JwtAuthGuard)
export class VisitasController {
  constructor(private readonly visitasService: VisitasService) {}

  @Post('ingreso')
  registrarIngreso(@Body() dto: RegistrarVisitaDto, @Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.visitasService.registrarIngreso(edificioId, dto);
  }

  @Get('activas')
  listarActivas(@Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.visitasService.listarActivas(edificioId);
  }

  @Patch(':id/salida')
  registrarSalida(
    @Param('id') id: string,
    @Body() dto: RegistrarSalidaDto,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.visitasService.registrarSalida(edificioId, id, dto);
  }

  @Get('historial')
  listarHistorial(@Query('limit') limit: string, @Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    const l = limit ? parseInt(limit, 10) : 50;
    return this.visitasService.listarHistorial(edificioId, l);
  }

  // --- Visitas Programadas (Pre-registros) en Portería ---

  @Get('programadas')
  listarProgramadas(@Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.visitasService.listarProgramadasParaPorteria(edificioId);
  }

  @Post('programadas/:id/ingreso')
  registrarIngresoProgramado(
    @Param('id') id: string,
    @Body() dto: ConfirmarIngresoProgramadoDto,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.visitasService.registrarIngresoProgramado(edificioId, id, dto);
  }
}
