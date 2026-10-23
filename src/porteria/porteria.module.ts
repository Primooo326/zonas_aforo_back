import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Paquete, PaqueteSchema } from './paquetes/paquete.schema';
import { PaquetesService } from './paquetes/paquetes.service';
import { PaquetesController } from './paquetes/paquetes.controller';
import { Minuta, MinutaSchema } from './minuta/minuta.schema';
import { MinutaService } from './minuta/minuta.service';
import { MinutaController } from './minuta/minuta.controller';
import { Visita, VisitaSchema } from './visitas/visita.schema';
import {
  PreRegistroVisita,
  PreRegistroVisitaSchema,
} from './visitas/preregistro-visita.schema';
import { VisitasService } from './visitas/visitas.service';
import { VisitasController } from './visitas/visitas.controller';
import { PasesPublicosController } from './visitas/pases-publicos.controller';
import { ConsultasPorteriaService } from './consultas/consultas-porteria.service';
import { ConsultasPorteriaController } from './consultas/consultas-porteria.controller';
import { CensoUnidad, CensoUnidadSchema } from '../censo/censo.schema';
import { Reserva, ReservaSchema } from '../reservas/reserva.schema';
import { Edificio, EdificioSchema } from '../edificios/edificio.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Paquete.name, schema: PaqueteSchema },
      { name: Minuta.name, schema: MinutaSchema },
      { name: Visita.name, schema: VisitaSchema },
      { name: PreRegistroVisita.name, schema: PreRegistroVisitaSchema },
      { name: CensoUnidad.name, schema: CensoUnidadSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: Edificio.name, schema: EdificioSchema },
    ]),
  ],
  controllers: [
    PaquetesController,
    MinutaController,
    VisitasController,
    PasesPublicosController,
    ConsultasPorteriaController,
  ],
  providers: [
    PaquetesService,
    MinutaService,
    VisitasService,
    ConsultasPorteriaService,
  ],
  exports: [
    PaquetesService,
    MinutaService,
    VisitasService,
    ConsultasPorteriaService,
  ],
})
export class PorteriaModule {}
