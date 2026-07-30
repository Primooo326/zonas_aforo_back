import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reserva, ReservaSchema } from './reserva.schema';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { ZonasModule } from '../zonas/zonas.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Reserva.name, schema: ReservaSchema }]),
    ZonasModule,
    EventsModule,
  ],
  controllers: [ReservasController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
