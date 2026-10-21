import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Propietario, PropietarioDocument } from './propietario.schema';
import {
  CensoUnidad,
  CensoUnidadDocument,
  InvitacionCenso,
  InvitacionCensoDocument,
} from '../censo/censo.schema';
import { Edificio, EdificioDocument } from '../edificios/edificio.schema';
import { RegisterPropietarioDto } from './dto/register-propietario.dto';
import { LoginPropietarioDto } from './dto/login-propietario.dto';
import { RegistroInvitacionDto } from './dto/registro-invitacion.dto';

@Injectable()
export class PropietariosService {
  constructor(
    @InjectModel(Propietario.name) private propietarioModel: Model<PropietarioDocument>,
    @InjectModel(CensoUnidad.name) private censoModel: Model<CensoUnidadDocument>,
    @InjectModel(InvitacionCenso.name) private invitacionModel: Model<InvitacionCensoDocument>,
    @InjectModel(Edificio.name) private edificioModel: Model<EdificioDocument>,
    private jwtService: JwtService,
  ) {}

  async validarInvitacion(token: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('Token de invitación no proporcionado');
    }

    const inv = await this.invitacionModel.findOne({
      token: token.trim(),
      utilizado: false,
    });

    if (!inv) {
      throw new BadRequestException('La invitación es inválida o ya fue utilizada');
    }

    if (new Date(inv.expiraEn).getTime() < Date.now()) {
      throw new BadRequestException('La invitación ha expirado');
    }

    const edificio = await this.edificioModel.findById(inv.edificioId);

    let censo: CensoUnidadDocument | null = null;
    if (inv.inmueblePredefinido) {
      censo = await this.censoModel.findOne({
        edificioId: inv.edificioId,
        identificador: new RegExp(`^${inv.inmueblePredefinido.trim()}$`, 'i'),
        estado: 'aprobado',
      });
    }

    const persona =
      censo?.personas?.find((p) => p.esContactoPrincipal && p.email) ||
      censo?.personas?.find((p) => p.email) ||
      censo?.personas?.[0];

    return {
      valido: true,
      token: inv.token,
      edificioId: inv.edificioId.toString(),
      edificioNombre: edificio?.nombre || 'Copropiedad',
      inmueblePredefinido: inv.inmueblePredefinido || censo?.identificador || '',
      torre: censo?.torre || '',
      numeroApto: censo?.numeroApto || '',
      nombre: persona?.nombreCompleto || '',
      email: persona?.email || '',
      telefono: persona?.telefono || '',
      tipoResidente: persona?.condicion || 'propietario',
      censoUnidadId: censo?._id ? censo._id.toString() : undefined,
    };
  }

  async registrarConInvitacion(dto: RegistroInvitacionDto) {
    const invInfo = await this.validarInvitacion(dto.token);

    const email = (dto.email || invInfo.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException(
        'El correo electrónico es obligatorio para crear la cuenta de residente',
      );
    }

    const nombre = (dto.nombre || invInfo.nombre || 'Residente').trim();
    const telefono = (dto.telefono || invInfo.telefono || '').trim();

    const inv = await this.invitacionModel.findOne({ token: dto.token });
    if (!inv) {
      throw new BadRequestException('Invitación no válida');
    }

    let censoUnidadId = invInfo.censoUnidadId;
    if (!censoUnidadId && invInfo.inmueblePredefinido) {
      const censo = await this.censoModel.findOne({
        edificioId: new Types.ObjectId(invInfo.edificioId),
        identificador: new RegExp(`^${invInfo.inmueblePredefinido.trim()}$`, 'i'),
      });
      if (censo) censoUnidadId = censo._id.toString();
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    let propietario = await this.propietarioModel.findOne({ email });

    if (propietario) {
      // Si ya existía para el mismo edificio y unidad, actualizar credenciales
      if (
        propietario.edificioId.toString() === invInfo.edificioId &&
        (!propietario.censoUnidadId || propietario.censoUnidadId.toString() === censoUnidadId)
      ) {
        propietario.password = hashed;
        propietario.estado = 'activo';
        if (censoUnidadId) propietario.censoUnidadId = new Types.ObjectId(censoUnidadId);
        if (nombre) propietario.nombre = nombre;
        if (telefono) propietario.telefono = telefono;
        await propietario.save();
      } else {
        throw new ConflictException(
          'Este correo electrónico ya está registrado en otra unidad o copropiedad',
        );
      }
    } else {
      propietario = await this.propietarioModel.create({
        nombre,
        email,
        password: hashed,
        edificioId: new Types.ObjectId(invInfo.edificioId),
        censoUnidadId: censoUnidadId ? new Types.ObjectId(censoUnidadId) : undefined,
        tipoResidente: invInfo.tipoResidente || 'propietario',
        estado: 'activo',
        telefono,
        esContactoPrincipal: true,
      });
    }

    // Marcar invitación como utilizada
    inv.utilizado = true;
    await inv.save();

    return this.generateToken(propietario);
  }

  async register(dto: RegisterPropietarioDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.propietarioModel.findOne({ email });
    if (exists) throw new ConflictException('El email ya está registrado');

    const hashed = await bcrypt.hash(dto.password, 10);
    const propietario = await this.propietarioModel.create({
      ...dto,
      email,
      password: hashed,
      estado: 'activo',
      tipoResidente: 'propietario',
    });

    return this.generateToken(propietario);
  }

  async login(dto: LoginPropietarioDto) {
    const email = (dto.email || '').trim().toLowerCase();
    const propietario = await this.propietarioModel.findOne({ email });
    if (!propietario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(dto.password, propietario.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (propietario.estado === 'pendiente_aprobacion') {
      throw new UnauthorizedException(
        'Tu registro está en proceso de revisión y validación por la administración. Te notificaremos una vez sea aprobado.',
      );
    }

    if (propietario.estado === 'inactivo') {
      throw new UnauthorizedException(
        'Tu cuenta de habitante se encuentra inactiva. Comunícate con la administración de tu conjunto.',
      );
    }

    return this.generateToken(propietario);
  }

  private generateToken(propietario: PropietarioDocument) {
    const payload = {
      sub: propietario._id.toString(),
      email: propietario.email,
      nombre: propietario.nombre,
      edificioId: propietario.edificioId.toString(),
      censoUnidadId: propietario.censoUnidadId ? propietario.censoUnidadId.toString() : undefined,
      tipoResidente: propietario.tipoResidente || 'propietario',
      role: 'propietario',
    };

    return {
      access_token: this.jwtService.sign(payload),
      propietario: {
        id: propietario._id.toString(),
        nombre: propietario.nombre,
        email: propietario.email,
        telefono: propietario.telefono,
        tipoResidente: propietario.tipoResidente || 'propietario',
        estado: propietario.estado || 'activo',
        edificioId: propietario.edificioId.toString(),
        censoUnidadId: propietario.censoUnidadId ? propietario.censoUnidadId.toString() : undefined,
      },
    };
  }
}
