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
import { ZonasService } from './zonas.service';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';

@Controller('zonas')
@UseGuards(JwtAuthGuard)
export class ZonasController {
  constructor(private zonasService: ZonasService) {}

  @Post()
  create(@Body() dto: CreateZonaDto, @Request() req) {
    return this.zonasService.create({ ...dto, edificioId: req.user.id });
  }

  @Get()
  findAll(@Request() req) {
    return this.zonasService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.zonasService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateZonaDto, @Request() req) {
    return this.zonasService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.zonasService.remove(id, req.user.id);
  }
}
