import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { Propietario, PropietarioSchema } from '../propietarios/propietario.schema';
import { CensoUnidad, CensoUnidadSchema } from '../censo/censo.schema';
import { Edificio, EdificioSchema } from '../edificios/edificio.schema';
import { Reserva, ReservaSchema } from '../reservas/reserva.schema';
import { ReservasModule } from '../reservas/reservas.module';
import { ZonasModule } from '../zonas/zonas.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Propietario.name, schema: PropietarioSchema },
      { name: CensoUnidad.name, schema: CensoUnidadSchema },
      { name: Edificio.name, schema: EdificioSchema },
      { name: Reserva.name, schema: ReservaSchema },
    ]),
    ReservasModule,
    ZonasModule,
  ],
  controllers: [PortalController],
  providers: [PortalService],
  exports: [PortalService],
})
export class PortalModule {}
