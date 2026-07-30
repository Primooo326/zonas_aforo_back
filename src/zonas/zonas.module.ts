import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Zona, ZonaSchema } from './zona.schema';
import { ZonasController } from './zonas.controller';
import { ZonasService } from './zonas.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Zona.name, schema: ZonaSchema }]),
  ],
  controllers: [ZonasController],
  providers: [ZonasService],
  exports: [ZonasService],
})
export class ZonasModule {}
