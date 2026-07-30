import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { AuthModule } from './auth/auth.module';
import { EdificioModule } from './edificios/edificio.module';
import { ZonasModule } from './zonas/zonas.module';
import { ReservasModule } from './reservas/reservas.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('database.uri'),
        dbName: configService.get('database.dbName'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    EdificioModule,
    ZonasModule,
    ReservasModule,
    EventsModule,
  ],
})
export class AppModule {}
