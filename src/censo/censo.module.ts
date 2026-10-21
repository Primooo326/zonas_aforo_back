import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CensoUnidad,
  CensoUnidadSchema,
  ParqueaderoInventario,
  ParqueaderoInventarioSchema,
  BodegaInventario,
  BodegaInventarioSchema,
  InvitacionCenso,
  InvitacionCensoSchema,
} from './censo.schema';
import { CensoController } from './censo.controller';
import { CensoService } from './censo.service';
import { Propietario, PropietarioSchema } from '../propietarios/propietario.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CensoUnidad.name, schema: CensoUnidadSchema },
      { name: ParqueaderoInventario.name, schema: ParqueaderoInventarioSchema },
      { name: BodegaInventario.name, schema: BodegaInventarioSchema },
      { name: InvitacionCenso.name, schema: InvitacionCensoSchema },
      { name: Propietario.name, schema: PropietarioSchema },
    ]),
  ],
  controllers: [CensoController],
  providers: [CensoService],
  exports: [CensoService],
})
export class CensoModule {}
