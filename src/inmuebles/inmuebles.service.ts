import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Inmueble } from './inmueble.schema';
import { CreateInmuebleDto } from './dto/create-inmueble.dto';
import { UpdateInmuebleDto } from './dto/update-inmueble.dto';

@Injectable()
export class InmueblesService {
  constructor(
    @InjectModel(Inmueble.name) private inmuebleModel: Model<Inmueble>,
  ) {}

  private validarCamposCondicionales(
    dto: CreateInmuebleDto | UpdateInmuebleDto,
  ) {
    // parqueadero solo relevante para inmueble, cubierto solo para parqueadero
    // Si tipo es habitacion, parqueadero/deposito no deberían venir con true sin sentido, pero permitimos
    // Validación estricta adicional si se requiere:
    // - parqueadero boolean solo si tipo inmueble => warning, no error bloqueante para MVP
    // Mantenemos validar precio >0 ya en DTO, telefono regex ya validado
  }

  private async validarPropietario(
    inmuebleId: string,
    edificioId: string,
    propietarioId?: string,
  ) {
    const inmueble = await this.inmuebleModel.findById(inmuebleId);
    if (!inmueble) throw new NotFoundException('Inmueble no encontrado');
    // Admin edificio puede editar todas las de su edificio
    if (inmueble.edificioId.toString() === edificioId) {
      return inmueble;
    }
    // Propietario solo sus propias
    if (propietarioId && inmueble.propietarioId?.toString() === propietarioId) {
      return inmueble;
    }
    throw new ForbiddenException('No tienes permiso para este inmueble');
  }

  async create(
    dto: CreateInmuebleDto,
    edificioId: string,
    propietarioId?: string,
  ) {
    this.validarCamposCondicionales(dto);
    const data: any = {
      ...dto,
      edificioId: new Types.ObjectId(edificioId),
      estado: dto.estado || 'activa',
      imagenes: dto.imagenes || [],
    };
    if (propietarioId) {
      data.propietarioId = new Types.ObjectId(propietarioId);
    }
    // telefono ya validado por DTO, observacion maxlength ya validado
    const creado = await this.inmuebleModel.create(data);
    return creado;
  }

  async findAll(query: {
    edificioId?: string;
    tipo?: string;
    transaccion?: string;
    estado?: string;
    search?: string;
  }) {
    const filter: any = {};
    if (query.edificioId)
      filter.edificioId = new Types.ObjectId(query.edificioId);
    else throw new BadRequestException('edificioId es requerido');

    if (query.tipo) filter.tipo = query.tipo;
    if (query.transaccion) filter.transaccion = query.transaccion;
    // Por defecto solo activas para público; si se pide explícitamente estado, filtrar
    if (query.estado) filter.estado = query.estado;
    else filter.estado = 'activa';

    if (query.search) {
      filter.$or = [
        { observacion: { $regex: query.search, $options: 'i' } },
        { telefono: { $regex: query.search, $options: 'i' } },
      ];
    }

    return this.inmuebleModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID inválido');
    const inmueble = await this.inmuebleModel.findById(id).lean();
    if (!inmueble) throw new NotFoundException('Inmueble no encontrado');
    return inmueble;
  }

  async findByEdificio(
    edificioId: string,
    query: { tipo?: string; transaccion?: string; estado?: string },
  ) {
    return this.findAll({ edificioId, ...query });
  }

  async update(
    id: string,
    dto: UpdateInmuebleDto,
    edificioId: string,
    propietarioId?: string,
  ) {
    await this.validarPropietario(id, edificioId, propietarioId);
    this.validarCamposCondicionales(dto);
    const actualizado = await this.inmuebleModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!actualizado) throw new NotFoundException('Inmueble no encontrado');
    return actualizado;
  }

  async remove(id: string, edificioId: string, propietarioId?: string) {
    await this.validarPropietario(id, edificioId, propietarioId);
    const eliminado = await this.inmuebleModel.findByIdAndDelete(id).lean();
    if (!eliminado) throw new NotFoundException('Inmueble no encontrado');
    return eliminado;
  }

  async updateEstado(
    id: string,
    estado: string,
    edificioId: string,
    propietarioId?: string,
  ) {
    await this.validarPropietario(id, edificioId, propietarioId);
    const actualizado = await this.inmuebleModel
      .findByIdAndUpdate(id, { estado }, { new: true })
      .lean();
    if (!actualizado) throw new NotFoundException('Inmueble no encontrado');
    return actualizado;
  }
}
