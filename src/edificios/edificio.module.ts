import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Edificio, EdificioSchema } from './edificio.schema';
import { EdificioController } from './edificio.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Edificio.name, schema: EdificioSchema },
    ]),
  ],
  controllers: [EdificioController],
  exports: [MongooseModule],
})
export class EdificioModule {}
