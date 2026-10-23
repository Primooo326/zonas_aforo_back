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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PaquetesService } from './paquetes.service';
import { CreatePaqueteDto, EntregarPaqueteDto } from './dto/paquete.dto';

@Controller('porteria/paquetes')
@UseGuards(JwtAuthGuard)
export class PaquetesController {
  constructor(private readonly paquetesService: PaquetesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('fotoGuia'))
  async registrar(
    @Body() body: any,
    @UploadedFile() file: any,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    let fotoUrl: string | undefined = undefined;

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('La foto no debe superar 5MB');
      }
      const uploadDir = join(process.cwd(), 'uploads', edificioId, 'paquetes');
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

      const filename = `${randomUUID()}.webp`;
      const filepath = join(uploadDir, filename);

      await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(filepath);

      fotoUrl = `/uploads/${edificioId}/paquetes/${filename}`;
    }

    const dto: CreatePaqueteDto = {
      torre: body.torre,
      apartamento: body.apartamento,
      transportadora: body.transportadora,
      tipo: body.tipo || 'paquete',
      fotoGuiaUrl: fotoUrl || body.fotoGuiaUrl,
      observaciones: body.observaciones,
      vigilanteRecibioId: body.vigilanteRecibioId,
      vigilanteRecibioNombre: body.vigilanteRecibioNombre || 'Vigilancia',
    };

    return this.paquetesService.registrar(edificioId, dto, fotoUrl);
  }

  @Get('pendientes')
  listarPendientes(
    @Query('torre') torre: string,
    @Query('apto') apto: string,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.paquetesService.listarPendientes(edificioId, { torre, apto });
  }

  @Get('historial')
  listarHistorial(
    @Query('limit') limit: string,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    const l = limit ? parseInt(limit, 10) : 50;
    return this.paquetesService.listarHistorial(edificioId, l);
  }

  @Patch(':id/entregar')
  entregar(
    @Param('id') id: string,
    @Body() dto: EntregarPaqueteDto,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.paquetesService.entregar(edificioId, id, dto);
  }
}
