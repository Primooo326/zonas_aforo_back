import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Edificio } from '../edificios/edificio.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(Edificio.name) private edificioModel: Model<Edificio>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'fallback-secret',
    });
  }

  async validate(payload: { sub: string }) {
    const edificio = await this.edificioModel.findById(payload.sub);
    if (!edificio) throw new UnauthorizedException();
    return {
      id: edificio._id.toString(),
      email: edificio.email,
      nombre: edificio.nombre,
    };
  }
}
