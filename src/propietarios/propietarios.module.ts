import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Propietario, PropietarioSchema } from './propietario.schema';
import { PropietariosService } from './propietarios.service';
import { PropietariosController } from './propietarios.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: { expiresIn: configService.get('jwt.expiresIn') },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: Propietario.name, schema: PropietarioSchema }]),
  ],
  controllers: [PropietariosController],
  providers: [PropietariosService],
  exports: [PropietariosService, MongooseModule],
})
export class PropietariosModule {}
