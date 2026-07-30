import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZonasService } from './zonas.service';

@Controller('zonas')
@UseGuards(JwtAuthGuard)
export class ZonasController {
  constructor(private zonasService: ZonasService) {}

  @Post()
  create(@Body() dto: any, @Request() req) {
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
  update(@Param('id') id: string, @Body() dto: any) {
    return this.zonasService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.zonasService.remove(id);
  }
}
