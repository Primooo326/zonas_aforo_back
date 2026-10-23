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
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { MinutaService } from './minuta.service';
import { CreateMinutaDto, RevisarMinutaDto } from './dto/minuta.dto';
import { SeveridadNovedad } from './minuta.schema';

@Controller('porteria/minuta')
@UseGuards(JwtAuthGuard)
export class MinutaController {
  constructor(private readonly minutaService: MinutaService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('fotos', 5))
  async registrar(
    @Body() body: any,
    @UploadedFiles() files: any[],
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    const fotosUrls: string[] = [];

    if (files && files.length > 0) {
      const uploadDir = join(process.cwd(), 'uploads', edificioId, 'minuta');
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          throw new BadRequestException('Cada imagen no debe superar 5MB');
        }
        const filename = `${randomUUID()}.webp`;
        const filepath = join(uploadDir, filename);

        await sharp(file.buffer)
          .resize({ width: 1000, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(filepath);

        fotosUrls.push(`/uploads/${edificioId}/minuta/${filename}`);
      }
    }

    const dto: CreateMinutaDto = {
      severidad: body.severidad as SeveridadNovedad,
      titulo: body.titulo,
      descripcion: body.descripcion,
      vigilanteId: body.vigilanteId,
      vigilanteNombre: body.vigilanteNombre || 'Vigilancia',
    };

    return this.minutaService.registrar(edificioId, dto, fotosUrls);
  }

  @Get()
  listar(
    @Query('severidad') severidad: SeveridadNovedad,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
    @Query('soloPendientesAdmin') soloPendientesAdmin: string,
    @Query('limit') limit: string,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.minutaService.listar(edificioId, {
      severidad,
      fechaInicio,
      fechaFin,
      soloPendientesAdmin: soloPendientesAdmin === 'true',
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('alertas-resumen')
  alertasResumen(@Request() req) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.minutaService.obtenerResumenAlertas(edificioId);
  }

  @Patch(':id/revisar')
  marcarRevisado(
    @Param('id') id: string,
    @Body() dto: RevisarMinutaDto,
    @Request() req,
  ) {
    const edificioId = req.user.edificioId || req.user.id;
    return this.minutaService.marcarRevisado(edificioId, id, dto);
  }
}
