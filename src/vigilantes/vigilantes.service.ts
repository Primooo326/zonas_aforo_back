import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Vigilante, VigilanteDocument } from './vigilante.schema';
import { Edificio, EdificioDocument } from '../edificios/edificio.schema';
import {
  CreateVigilanteDto,
  UpdateVigilanteDto,
  LoginPuestoDto,
  SetPuestoPasswordDto,
} from './dto/vigilante.dto';

@Injectable()
export class VigilantesService {
  constructor(
    @InjectModel(Vigilante.name) private vigilanteModel: Model<VigilanteDocument>,
    @InjectModel(Edificio.name) private edificioModel: Model<EdificioDocument>,
    private jwtService: JwtService,
  ) {}

  async crear(edificioId: string, dto: CreateVigilanteDto) {
    const existe = await this.vigilanteModel.findOne({
      edificioId: new Types.ObjectId(edificioId),
      cedula: dto.cedula.trim(),
    });
    if (existe) {
      throw new ConflictException('Ya existe un vigilante con esta cédula en la copropiedad');
    }

    return this.vigilanteModel.create({
      ...dto,
      edificioId: new Types.ObjectId(edificioId),
      activo: true,
    });
  }

  async listar(edificioId: string) {
    return this.vigilanteModel
      .find({ edificioId: new Types.ObjectId(edificioId) })
      .sort({ activo: -1, nombreCompleto: 1 });
  }

  async listarActivos(edificioId: string) {
    return this.vigilanteModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        activo: true,
      })
      .select('_id nombreCompleto cedula empresaSeguridad')
      .sort({ nombreCompleto: 1 });
  }

  async actualizar(edificioId: string, id: string, dto: UpdateVigilanteDto) {
    const v = await this.vigilanteModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), edificioId: new Types.ObjectId(edificioId) },
      { $set: dto },
      { new: true },
    );
    if (!v) throw new NotFoundException('Vigilante no encontrado');
    return v;
  }

  async eliminar(edificioId: string, id: string) {
    const res = await this.vigilanteModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      edificioId: new Types.ObjectId(edificioId),
    });
    if (!res) throw new NotFoundException('Vigilante no encontrado');
    return { success: true };
  }

  // --- Gestión de Credenciales del Puesto de Vigilancia ---

  async obtenerInfoPuesto(edificioId: string) {
    const edificio = await this.edificioModel.findById(edificioId);
    if (!edificio) throw new NotFoundException('Edificio no encontrado');

    const usuarioSugerido = edificio.usuarioVigilancia || `porteria_${edificio.email.split('@')[0]}`;
    return {
      usuarioVigilancia: usuarioSugerido,
      tienePasswordConfigurado: !!edificio.passwordVigilancia,
      nombreEdificio: edificio.nombre,
      emailEdificio: edificio.email,
    };
  }

  async configurarCredencialesPuesto(edificioId: string, dto: SetPuestoPasswordDto) {
    const edificio = await this.edificioModel.findById(edificioId);
    if (!edificio) throw new NotFoundException('Edificio no encontrado');

    const hashed = await bcrypt.hash(dto.password, 10);
    const usuarioFinal = dto.usuarioVigilancia?.trim() || edificio.usuarioVigilancia || `porteria_${edificio.email.split('@')[0]}`;

    edificio.usuarioVigilancia = usuarioFinal;
    edificio.passwordVigilancia = hashed;
    await edificio.save();

    return {
      success: true,
      usuarioVigilancia: usuarioFinal,
      mensaje: 'Credenciales de puesto de vigilancia actualizadas exitosamente',
    };
  }

  // --- Login del Puesto de Vigilancia ---

  async loginPuesto(dto: LoginPuestoDto) {
    const queryTerm = dto.usuario.trim().toLowerCase();

    // Buscar el edificio por usuarioVigilancia, email o ID
    let edificio = await this.edificioModel.findOne({
      $or: [
        { usuarioVigilancia: queryTerm },
        { email: queryTerm },
      ],
    });

    if (!edificio && Types.ObjectId.isValid(queryTerm)) {
      edificio = await this.edificioModel.findById(queryTerm);
    }

    if (!edificio) {
      throw new NotFoundException('No se encontró el edificio o puesto de vigilancia indicado.');
    }

    // Si tiene passwordVigilancia específica, validar contra ella.
    // Si no ha sido configurada aún, validar contra el password del edificio como fallback.
    let isValid = false;
    if (edificio.passwordVigilancia) {
      isValid = await bcrypt.compare(dto.password, edificio.passwordVigilancia);
    } else {
      isValid = await bcrypt.compare(dto.password, edificio.password);
    }

    if (!isValid) {
      throw new UnauthorizedException('Contraseña de vigilancia incorrecta.');
    }

    const payload = {
      sub: edificio._id.toString(),
      edificioId: edificio._id.toString(),
      nombreEdificio: edificio.nombre,
      role: 'vigilancia',
    };

    return {
      access_token: this.jwtService.sign(payload),
      puesto: {
        edificioId: edificio._id.toString(),
        nombreEdificio: edificio.nombre,
        usuario: edificio.usuarioVigilancia || edificio.email,
        role: 'vigilancia',
      },
    };
  }
}
