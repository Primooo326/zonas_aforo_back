import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Vigilante, VigilanteSchema } from './vigilante.schema';
import { Edificio, EdificioSchema } from '../edificios/edificio.schema';
import { VigilantesService } from './vigilantes.service';
import { VigilantesController } from './vigilantes.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vigilante.name, schema: VigilanteSchema },
      { name: Edificio.name, schema: EdificioSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') || 'fallback-secret',
        signOptions: { expiresIn: '30d' }, // La sesión de puesto de portería dura 30 días para evitar desconexiones
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [VigilantesController],
  providers: [VigilantesService],
  exports: [VigilantesService],
})
export class VigilantesModule {}
