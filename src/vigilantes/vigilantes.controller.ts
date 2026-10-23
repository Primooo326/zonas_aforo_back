import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VigilantesService } from './vigilantes.service';
import {
  CreateVigilanteDto,
  UpdateVigilanteDto,
  LoginPuestoDto,
  SetPuestoPasswordDto,
} from './dto/vigilante.dto';

@Controller('vigilantes')
export class VigilantesController {
  constructor(private readonly vigilantesService: VigilantesService) {}

  // Login público para el puesto de vigilancia
  @Post('login-puesto')
  loginPuesto(@Body() dto: LoginPuestoDto) {
    return this.vigilantesService.loginPuesto(dto);
  }

  // Lista de vigilantes activos para el selector rápido de la consola (o para el admin)
  @Get('activos')
  @UseGuards(JwtAuthGuard)
  listarActivos(@Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.vigilantesService.listarActivos(edificioId);
  }

  // --- Endpoints de Administración de Vigilantes ---

  @Get()
  @UseGuards(JwtAuthGuard)
  listarTodos(@Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.vigilantesService.listar(edificioId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  crear(@Body() dto: CreateVigilanteDto, @Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.vigilantesService.crear(edificioId, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateVigilanteDto,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.vigilantesService.actualizar(edificioId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminar(@Param('id') id: string, @Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.vigilantesService.eliminar(edificioId, id);
  }

  @Get('puesto-info')
  @UseGuards(JwtAuthGuard)
  obtenerInfoPuesto(@Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.vigilantesService.obtenerInfoPuesto(edificioId);
  }

  @Post('puesto-credenciales')
  @UseGuards(JwtAuthGuard)
  configurarCredencialesPuesto(
    @Body() dto: SetPuestoPasswordDto,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.vigilantesService.configurarCredencialesPuesto(edificioId, dto);
  }
}
