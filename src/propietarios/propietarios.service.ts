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
import { randomBytes } from 'crypto';
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
import { ActivarORecuperarDto } from './dto/activar-recuperar.dto';

@Injectable()
export class PropietariosService {
  constructor(
    @InjectModel(Propietario.name) private propietarioModel: Model<PropietarioDocument>,
    @InjectModel(CensoUnidad.name) private censoModel: Model<CensoUnidadDocument>,
    @InjectModel(InvitacionCenso.name) private invitacionModel: Model<InvitacionCensoDocument>,
    @InjectModel(Edificio.name) private edificioModel: Model<EdificioDocument>,
    private jwtService: JwtService,
  ) {}

  async validarInvitacion(tokenOrCode: string) {
    const raw = (tokenOrCode || '').trim();
    if (!raw) {
      throw new BadRequestException('Código o token de invitación no proporcionado');
    }

    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inv = await this.invitacionModel.findOne({
      $or: [
        { token: raw },
        { codigo: new RegExp(`^${escaped}$`, 'i') },
      ],
    });

    if (!inv) {
      throw new BadRequestException('El código o enlace de invitación es inválido o no existe');
    }

    if (new Date(inv.expiraEn).getTime() < Date.now()) {
      throw new BadRequestException('El código o enlace de invitación ha expirado');
    }

    const edificio = await this.edificioModel.findById(inv.edificioId);

    let censo: CensoUnidadDocument | null = null;
    if (inv.censoUnidadId) {
      censo = await this.censoModel.findById(inv.censoUnidadId);
    }
    if (!censo && inv.inmueblePredefinido) {
      censo = await this.censoModel.findOne({
        edificioId: inv.edificioId,
        identificador: new RegExp(`^${inv.inmueblePredefinido.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        estado: { $in: ['aprobado', 'pendiente', 'pendiente_actualizacion'] },
      });
    }

    const persona =
      censo?.personas?.find((p) => p.esContactoPrincipal && p.email) ||
      censo?.personas?.find((p) => p.email) ||
      censo?.personas?.[0];

    return {
      valido: true,
      token: inv.token,
      codigo: inv.codigo,
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

  async activarORecuperar(dto: ActivarORecuperarDto) {
    const email = (dto.email || '').trim().toLowerCase();
    const codigoRaw = (dto.codigoCenso || '').trim().toUpperCase();
    const password = (dto.password || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Ingresa un correo electrónico válido');
    }

    if (!codigoRaw) {
      throw new BadRequestException('Ingresa tu código de censo de 5 letras (o token de invitación)');
    }

    if (!password || password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }

    // 1. Buscar la invitación por código de 5 letras o token
    const inv = await this.invitacionModel.findOne({
      $or: [
        { codigo: new RegExp(`^${codigoRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { token: codigoRaw },
      ],
    });

    if (!inv) {
      throw new NotFoundException(
        'El código de censo o invitación ingresado no existe. Verifica los 5 caracteres enviados por la administración.',
      );
    }

    if (new Date(inv.expiraEn).getTime() < Date.now()) {
      throw new BadRequestException(
        'El código de censo ha expirado (vigencia de 7 días). Solicita uno nuevo a la administración.',
      );
    }

    // 2. Localizar la unidad del censo asociada a la invitación
    let censo: CensoUnidadDocument | null = null;
    if (inv.censoUnidadId) {
      censo = await this.censoModel.findById(inv.censoUnidadId);
    }
    if (!censo && inv.inmueblePredefinido) {
      censo = await this.censoModel.findOne({
        edificioId: inv.edificioId,
        identificador: new RegExp(`^${inv.inmueblePredefinido.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        estado: { $in: ['aprobado', 'pendiente', 'pendiente_actualizacion'] },
      });
    }

    // 3. Obtener datos de la persona si ya existía en censo
    let personaEnUnidad: any = null;
    if (censo && censo.personas && Array.isArray(censo.personas)) {
      personaEnUnidad = censo.personas.find(
        (p) => p.email && p.email.trim().toLowerCase() === email,
      );
    }

    const nombreFinal = personaEnUnidad?.nombreCompleto || 'Residente titular';
    const telefonoFinal = personaEnUnidad?.telefono || '';
    const tipoResidenteFinal = personaEnUnidad?.condicion || 'propietario';

    const hashed = await bcrypt.hash(password, 10);

    // 4. Crear o actualizar cuenta en propietarioModel
    let propietario = await this.propietarioModel.findOne({ email });

    if (propietario) {
      if (propietario.edificioId.toString() !== inv.edificioId.toString()) {
        throw new ConflictException(
          'Este correo electrónico ya se encuentra vinculado a otra copropiedad.',
        );
      }
      propietario.password = hashed;
      propietario.estado = 'activo';
      if (censo?._id) propietario.censoUnidadId = censo._id;
      if (nombreFinal) propietario.nombre = nombreFinal;
      if (telefonoFinal) propietario.telefono = telefonoFinal;
      if (tipoResidenteFinal) propietario.tipoResidente = tipoResidenteFinal;
      await propietario.save();
    } else {
      propietario = await this.propietarioModel.create({
        nombre: nombreFinal,
        email,
        password: hashed,
        edificioId: inv.edificioId,
        censoUnidadId: censo?._id,
        tipoResidente: tipoResidenteFinal,
        estado: 'activo',
        telefono: telefonoFinal,
        esContactoPrincipal: personaEnUnidad?.esContactoPrincipal ?? true,
      });
    }

    inv.usos = (inv.usos || 0) + 1;
    inv.ultimoUso = new Date();
    await inv.save();

    return this.generateToken(propietario);
  }

  async login(dto: LoginPropietarioDto) {
    const email = (dto.email || '').trim().toLowerCase();
    const propietario = await this.propietarioModel.findOne({ email });
    if (!propietario) {
      // Verificar si el correo está registrado en el censo pero no ha activado contraseña
      if (this.censoModel && typeof (this.censoModel as any).findOne === 'function') {
        const censoConPersona = await this.censoModel.findOne({
          'personas.email': email,
          estado: { $in: ['aprobado', 'pendiente', 'pendiente_actualizacion'] },
        });
        if (censoConPersona) {
          throw new UnauthorizedException(
            'Tu apartamento está registrado en el censo pero tu cuenta aún no ha sido activada con una contraseña. Usa la opción "Activar cuenta con código de censo" para definir tu contraseña e ingresar.',
          );
        }
      }
      throw new UnauthorizedException('Credenciales inválidas. Verifica tu correo y contraseña.');
    }

    const valid = await bcrypt.compare(dto.password, propietario.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas. Verifica tu correo y contraseña.');
    }

    if (propietario.estado === 'pendiente_aprobacion') {
      // Si la unidad de censo ya está aprobada, activar automáticamente al residente
      if (propietario.censoUnidadId && this.censoModel && typeof (this.censoModel as any).findById === 'function') {
        const unidad = await this.censoModel.findById(propietario.censoUnidadId);
        if (unidad && unidad.estado === 'aprobado') {
          propietario.estado = 'activo';
          await propietario.save();
          return this.generateToken(propietario);
        }
      }

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
