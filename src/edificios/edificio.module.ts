import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Edificio, EdificioSchema } from './edificio.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Edificio.name, schema: EdificioSchema }])],
  exports: [MongooseModule],
})
export class EdificioModule {}
