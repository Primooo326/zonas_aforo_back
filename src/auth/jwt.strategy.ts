import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Edificio } from '../edificios/edificio.schema';
import { Propietario } from '../propietarios/propietario.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(Edificio.name) private edificioModel: Model<Edificio>,
    @InjectModel(Propietario.name) private propietarioModel: Model<Propietario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'fallback-secret',
    });
  }

  async validate(payload: { sub: string; role?: string; edificioId?: string }) {
    if (payload.role === 'propietario') {
      const propietario: any = await this.propietarioModel.findById(payload.sub);
      if (!propietario) throw new UnauthorizedException();
      return {
        id: propietario._id.toString(),
        email: propietario.email,
        nombre: propietario.nombre,
        edificioId: propietario.edificioId.toString(),
        role: 'propietario',
      };
    }
    const edificio: any = await this.edificioModel.findById(payload.sub);
    if (edificio) {
      return {
        id: edificio._id.toString(),
        email: edificio.email,
        nombre: edificio.nombre,
        edificioId: edificio._id.toString(),
        role: 'edificio',
      };
    }
    // Fallback: intentar como propietario si no es edificio
    const propietario: any = await this.propietarioModel.findById(payload.sub);
    if (propietario) {
      return {
        id: propietario._id.toString(),
        email: propietario.email,
        nombre: propietario.nombre,
        edificioId: propietario.edificioId.toString(),
        role: 'propietario',
      };
    }
    throw new UnauthorizedException();
  }
}
