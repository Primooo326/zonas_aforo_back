import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Edificio } from '../edificios/edificio.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Edificio.name) private edificioModel: Model<Edificio>,
    private jwtService: JwtService,
  ) {}

  async register(dto: { nombre: string; email: string; password: string; direccion: string; telefono: string }) {
    const exists = await this.edificioModel.findOne({ email: dto.email });
    if (exists) throw new ConflictException('El email ya está registrado');

    const hashed = await bcrypt.hash(dto.password, 10);
    const edificio = await this.edificioModel.create({ ...dto, password: hashed });

    return this.generateToken(edificio);
  }

  async login(dto: { email: string; password: string }) {
    const edificio = await this.edificioModel.findOne({ email: dto.email });
    if (!edificio) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(dto.password, edificio.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    return this.generateToken(edificio);
  }

  private generateToken(edificio: any) {
    const payload = { sub: edificio._id.toString(), email: edificio.email, nombre: edificio.nombre };
    return {
      access_token: this.jwtService.sign(payload),
      edificio: {
        id: edificio._id.toString(),
        nombre: edificio.nombre,
        email: edificio.email,
        direccion: edificio.direccion,
        telefono: edificio.telefono,
      },
    };
  }
}
