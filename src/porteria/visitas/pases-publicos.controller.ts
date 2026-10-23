import { Controller, Get, Param } from '@nestjs/common';
import { VisitasService } from './visitas.service';

@Controller('pases/publico')
export class PasesPublicosController {
  constructor(private readonly visitasService: VisitasService) {}

  @Get(':codigo')
  obtenerPasePublico(@Param('codigo') codigo: string) {
    return this.visitasService.obtenerPasePublico(codigo);
  }
}
