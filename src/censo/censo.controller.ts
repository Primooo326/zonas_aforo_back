import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CensoService } from './censo.service';
import { CreateCensoDto, PersonaCensoDto } from './dto/create-censo.dto';
import { UpdateCensoDto } from './dto/update-censo.dto';
import { PublicCensoDto } from './dto/public-censo.dto';
import { ImportarMasivoDto } from './dto/importar-masivo.dto';

interface AuthenticatedUser {
  id?: string;
  sub?: string;
  edificioId?: string;
  role?: string;
}

@Controller('censo')
export class CensoController {
  constructor(private readonly censoService: CensoService) {}

  private getEdificioId(req: { user: AuthenticatedUser }): string {
    return req.user.edificioId || req.user.id || req.user.sub || '';
  }

  // --- Endpoints Administrativos Protegidos ---

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats(@Request() req: { user: AuthenticatedUser }) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.getStats(edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('importar-masivo')
  async importarMasivo(
    @Body() dto: ImportarMasivoDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.importarMasivo(edificioId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('catalogo-unidades')
  async getCatalogoUnidades(@Request() req: { user: AuthenticatedUser }) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.getCatalogoUnidades(edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('parqueaderos')
  async getParqueaderos(@Request() req: { user: AuthenticatedUser }) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.getInventarioParqueaderos(edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bodegas')
  async getBodegas(@Request() req: { user: AuthenticatedUser }) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.getInventarioBodegas(edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('edificio/reset')
  async resetEdificio(@Request() req: { user: AuthenticatedUser }) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.resetEdificio(edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Request() req: { user: AuthenticatedUser },
    @Query('q') q?: string,
    @Query('estado') estado?: string,
    @Query('condicion') condicion?: string,
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.findAll(edificioId, { q, estado, condicion });
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitaciones')
  async crearInvitacion(
    @Body() body: { diasValidez?: number; inmueblePredefinido?: string },
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.crearInvitacion(
      edificioId,
      body?.diasValidez || 7,
      body?.inmueblePredefinido,
      req.user?.id || req.user?.sub,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('invitaciones')
  async getInvitaciones(@Request() req: { user: AuthenticatedUser }) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.getInvitaciones(edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.findOne(id, edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateCensoDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.create(edificioId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCensoDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.update(id, edificioId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/habitante')
  async agregarHabitante(
    @Param('id') id: string,
    @Body() dto: PersonaCensoDto,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.agregarHabitante(id, edificioId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.remove(id, edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/aprobar')
  async aprobar(
    @Param('id') id: string,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.aprobar(id, edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/rechazar')
  async rechazar(
    @Param('id') id: string,
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.rechazar(id, edificioId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/tags')
  async actualizarTags(
    @Param('id') id: string,
    @Body('tags') tags: string[],
    @Request() req: { user: AuthenticatedUser },
  ) {
    const edificioId = this.getEdificioId(req);
    return this.censoService.actualizarTags(id, edificioId, tags);
  }

  // --- Endpoints Públicos para Residentes ---

  @Get('public/:edificioId/unidades')
  async getUnidadesPublicas(@Param('edificioId') edificioId: string) {
    return this.censoService.getPublicCatalogoUnidades(edificioId);
  }

  @Get('public/:edificioId/parqueaderos')
  async getParqueaderosPublicos(@Param('edificioId') edificioId: string) {
    return this.censoService.getInventarioParqueaderos(edificioId);
  }

  @Post('public/:edificioId')
  async createPublic(
    @Param('edificioId') edificioId: string,
    @Body() dto: PublicCensoDto,
  ) {
    return this.censoService.createFromPublic(edificioId, dto);
  }

  @Get('public/invitacion/:token')
  async validarInvitacion(@Param('token') token: string) {
    return this.censoService.validarInvitacion(token);
  }

  @Post('public/invitacion/:token')
  async responderInvitacion(
    @Param('token') token: string,
    @Body() dto: PublicCensoDto,
  ) {
    return this.censoService.responderInvitacion(token, dto);
  }
}
