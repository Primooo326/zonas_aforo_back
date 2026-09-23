import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Inmueble, InmuebleSchema } from './inmueble.schema';
import { InmueblesController } from './inmuebles.controller';
import { InmueblesService } from './inmuebles.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inmueble.name, schema: InmuebleSchema },
    ]),
  ],
  controllers: [InmueblesController],
  providers: [InmueblesService],
  exports: [InmueblesService],
})
export class InmueblesModule {}
