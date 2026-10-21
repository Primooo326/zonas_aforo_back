import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortalService } from './portal.service';
import { SolicitudActualizacionDto } from './dto/solicitud-actualizacion.dto';
import { CrearReservaPortalDto } from './dto/crear-reserva-portal.dto';

@Controller('portal')
@UseGuards(JwtAuthGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  private checkPropietarioRole(req: any) {
    if (req.user?.role !== 'propietario') {
      throw new ForbiddenException(
        'Acceso restringido para el portal de residentes.',
      );
    }
  }

  @Get('me')
  async getMe(@Request() req: any) {
    this.checkPropietarioRole(req);
    return this.portalService.getMe(req.user.id);
  }

  @Post('solicitud-actualizacion')
  async solicitarActualizacion(
    @Request() req: any,
    @Body() dto: SolicitudActualizacionDto,
  ) {
    this.checkPropietarioRole(req);
    return this.portalService.solicitarActualizacion(req.user.id, dto);
  }

  @Delete('solicitud-actualizacion')
  async cancelarSolicitudActualizacion(@Request() req: any) {
    this.checkPropietarioRole(req);
    return this.portalService.cancelarSolicitudActualizacion(req.user.id);
  }

  @Get('zonas')
  async getZonas(@Request() req: any) {
    this.checkPropietarioRole(req);
    return this.portalService.getZonas(req.user.edificioId);
  }

  @Get('reservas')
  async getReservas(@Request() req: any) {
    this.checkPropietarioRole(req);
    return this.portalService.getReservas(
      req.user.censoUnidadId,
      req.user.edificioId,
    );
  }

  @Post('reservas')
  async crearReserva(
    @Request() req: any,
    @Body() dto: CrearReservaPortalDto,
  ) {
    this.checkPropietarioRole(req);
    return this.portalService.crearReserva(req.user.id, dto);
  }

  @Patch('reservas/:id/cancelar')
  async cancelarReserva(@Request() req: any, @Param('id') id: string) {
    this.checkPropietarioRole(req);
    return this.portalService.cancelarReserva(req.user.id, id);
  }
}
