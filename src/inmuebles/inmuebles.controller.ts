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
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InmueblesService } from './inmuebles.service';
import { CreateInmuebleDto } from './dto/create-inmueble.dto';
import { UpdateInmuebleDto } from './dto/update-inmueble.dto';
import { existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

@Controller()
export class InmueblesController {
  constructor(private inmueblesService: InmueblesService) {}

  private async procesarImagenes(
    files: any[],
    edificioId: string,
  ): Promise<string[]> {
    if (!files || files.length === 0) return [];
    if (files.length > 10) throw new BadRequestException('Máximo 10 imágenes');
    const uploadDir = join(process.cwd(), 'uploads', edificioId);
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const urls: string[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        throw new BadRequestException(`Imagen ${file.originalname} excede 5MB`);
      }
      const ext = extname(file.originalname).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        throw new BadRequestException(`Formato no permitido: ${ext} (solo jpg/png/webp)`);
      }
      const filename = `${randomUUID()}.webp`;
      const filepath = join(uploadDir, filename);
      await sharp(file.buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toFile(filepath);
      urls.push(`/uploads/${edificioId}/${filename}`);
    }
    return urls;
  }

  private parseBody(body: any): any {
    const parsed: any = { ...body };
    // Campos numéricos vienen como string en multipart
    ['metrosCuadrados', 'piso', 'precio'].forEach((k) => {
      if (parsed[k] !== undefined && typeof parsed[k] === 'string') {
        const n = Number(parsed[k]);
        if (!isNaN(n)) parsed[k] = n;
      }
    });
    // Booleanos
    ['parqueadero', 'balcon', 'deposito', 'amoblado', 'cubierto'].forEach((k) => {
      if (parsed[k] !== undefined && typeof parsed[k] === 'string') {
        if (parsed[k] === 'true') parsed[k] = true;
        else if (parsed[k] === 'false') parsed[k] = false;
      }
    });
    // imagenes puede venir como JSON string
    if (parsed.imagenes && typeof parsed.imagenes === 'string') {
      try {
        parsed.imagenes = JSON.parse(parsed.imagenes);
      } catch {
        // dejar como string array de un elemento
        parsed.imagenes = [parsed.imagenes];
      }
    }
    return parsed;
  }

  // Crear — requiere auth (edificio o propietario futuro) con soporte multipart
  @UseGuards(JwtAuthGuard)
  @Post('inmuebles')
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Solo jpg/png/webp permitidos'), false);
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @Body() body: any,
    @UploadedFiles() files: any[],
    @Request() req,
  ) {
    const dto = this.parseBody(body) as CreateInmuebleDto;
    const user = req.user;
    const edificioId = user.edificioId || user.id;
    const propietarioId = user.role === 'propietario' ? user.id : undefined;
    const urls = await this.procesarImagenes(files, edificioId);
    // Combinar urls de archivos con las que vengan en dto (si las hay)
    const imagenesExistentes = dto.imagenes || [];
    dto.imagenes = [...imagenesExistentes, ...urls];
    return this.inmueblesService.create(dto, edificioId, propietarioId);
  }

  // Listado público por edificio — sin auth, por defecto solo activas
  @Get('inmuebles')
  findAll(
    @Query('edificioId') edificioId: string,
    @Query('tipo') tipo?: string,
    @Query('transaccion') transaccion?: string,
    @Query('estado') estado?: string,
    @Query('search') search?: string,
  ) {
    return this.inmueblesService.findAll({
      edificioId,
      tipo,
      transaccion,
      estado,
      search,
    });
  }

  // Alias para compatibilidad con PRD: /inmuebles/edificio/:edificioId
  @Get('inmuebles/edificio/:edificioId')
  findByEdificio(
    @Param('edificioId') edificioId: string,
    @Query('tipo') tipo?: string,
    @Query('transaccion') transaccion?: string,
    @Query('estado') estado?: string,
  ) {
    return this.inmueblesService.findByEdificio(edificioId, {
      tipo,
      transaccion,
      estado,
    });
  }

  // Detalle público — sin auth
  @Get('inmuebles/:id')
  findOne(@Param('id') id: string) {
    return this.inmueblesService.findOne(id);
  }

  // Editar — requiere auth con soporte multipart
  @UseGuards(JwtAuthGuard)
  @Patch('inmuebles/:id')
  @UseInterceptors(
    FilesInterceptor('imagenes', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
          return cb(new BadRequestException('Solo jpg/png/webp permitidos'), false);
        }
        cb(null, true);
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: any[],
    @Request() req,
  ) {
    const dto = this.parseBody(body) as UpdateInmuebleDto;
    const user = req.user;
    const edificioId = user.edificioId || user.id;
    const propietarioId = user.role === 'propietario' ? user.id : undefined;
    if (files && files.length > 0) {
      const urls = await this.procesarImagenes(files, edificioId);
      const existentes = dto.imagenes || [];
      dto.imagenes = [...existentes, ...urls];
    }
    return this.inmueblesService.update(id, dto, edificioId, propietarioId);
  }

  // Eliminar — requiere auth
  @UseGuards(JwtAuthGuard)
  @Delete('inmuebles/:id')
  remove(@Param('id') id: string, @Request() req) {
    const user = req.user;
    const edificioId = user.edificioId || user.id;
    const propietarioId = user.role === 'propietario' ? user.id : undefined;
    return this.inmueblesService.remove(id, edificioId, propietarioId);
  }

  // Cambiar estado (vendida/arrendada/cancelada) — requiere auth
  @UseGuards(JwtAuthGuard)
  @Patch('inmuebles/:id/estado')
  updateEstado(
    @Param('id') id: string,
    @Body('estado') estado: string,
    @Request() req,
  ) {
    const user = req.user;
    const edificioId = user.edificioId || user.id;
    const propietarioId = user.role === 'propietario' ? user.id : undefined;
    return this.inmueblesService.updateEstado(id, estado, edificioId, propietarioId);
  }
}
