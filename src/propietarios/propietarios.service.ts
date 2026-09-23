import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Propietario } from './propietario.schema';

@Injectable()
export class PropietariosService {
  constructor(
    @InjectModel(Propietario.name) private propietarioModel: Model<Propietario>,
    private jwtService: JwtService,
  ) {}

  async register(dto: { nombre: string; email: string; password: string; edificioId: string; telefono?: string }) {
    const exists = await this.propietarioModel.findOne({ email: dto.email });
    if (exists) throw new ConflictException('El email ya está registrado');
    const hashed = await bcrypt.hash(dto.password, 10);
    const propietario: any = await this.propietarioModel.create({
      ...dto,
      password: hashed,
    });
    return this.generateToken(propietario);
  }

  async login(dto: { email: string; password: string }) {
    const propietario: any = await this.propietarioModel.findOne({ email: dto.email });
    if (!propietario) throw new UnauthorizedException('Credenciales inválidas');
    const valid = await bcrypt.compare(dto.password, propietario.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');
    return this.generateToken(propietario);
  }

  private generateToken(propietario: any) {
    const payload = {
      sub: propietario._id.toString(),
      email: propietario.email,
      nombre: propietario.nombre,
      edificioId: propietario.edificioId.toString(),
      role: 'propietario',
    };
    return {
      access_token: this.jwtService.sign(payload),
      propietario: {
        id: propietario._id.toString(),
        nombre: propietario.nombre,
        email: propietario.email,
        edificioId: propietario.edificioId.toString(),
      },
    };
  }
}
