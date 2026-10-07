import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CensoUnidad,
  CensoUnidadSchema,
  ParqueaderoInventario,
  ParqueaderoInventarioSchema,
  BodegaInventario,
  BodegaInventarioSchema,
} from './censo.schema';
import { CensoController } from './censo.controller';
import { CensoService } from './censo.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CensoUnidad.name, schema: CensoUnidadSchema },
      { name: ParqueaderoInventario.name, schema: ParqueaderoInventarioSchema },
      { name: BodegaInventario.name, schema: BodegaInventarioSchema },
    ]),
  ],
  controllers: [CensoController],
  providers: [CensoService],
  exports: [CensoService],
})
export class CensoModule {}
