import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visita, VisitaDocument, TipoVisita } from './visita.schema';
import {
  PreRegistroVisita,
  PreRegistroVisitaDocument,
  EstadoPreRegistro,
  ModalidadPase,
} from './preregistro-visita.schema';
import { Edificio, EdificioDocument } from '../../edificios/edificio.schema';
import { RegistrarVisitaDto, RegistrarSalidaDto } from './dto/visita.dto';
import {
  CrearPreRegistroDto,
  ConfirmarIngresoProgramadoDto,
} from './dto/preregistro-visita.dto';

function generarCodigoAcceso(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PAS-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

@Injectable()
export class VisitasService {
  constructor(
    @InjectModel(Visita.name) private visitaModel: Model<VisitaDocument>,
    @InjectModel(PreRegistroVisita.name)
    private preRegistroModel: Model<PreRegistroVisitaDocument>,
    @InjectModel(Edificio.name) private edificioModel: Model<EdificioDocument>,
  ) {}

  async registrarIngreso(edificioId: string, dto: RegistrarVisitaDto) {
    const nueva = await this.visitaModel.create({
      ...dto,
      edificioId: new Types.ObjectId(edificioId),
      tipo: dto.tipo || TipoVisita.IMPREVISTO,
      torre: dto.torre.trim().toUpperCase(),
      apartamento: dto.apartamento.trim().toUpperCase(),
      nombreVisitante: dto.nombreVisitante.trim(),
      placaVehiculo: dto.placaVehiculo?.trim().toUpperCase(),
      vigilanteIngresoId: dto.vigilanteIngresoId
        ? new Types.ObjectId(dto.vigilanteIngresoId)
        : undefined,
      fechaIngreso: new Date(),
    });
    return nueva;
  }

  async listarActivas(edificioId: string) {
    return this.visitaModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        fechaSalida: null,
      })
      .sort({ fechaIngreso: -1 });
  }

  async registrarSalida(
    edificioId: string,
    id: string,
    dto: RegistrarSalidaDto,
  ) {
    const visita = await this.visitaModel.findOne({
      _id: new Types.ObjectId(id),
      edificioId: new Types.ObjectId(edificioId),
    });

    if (!visita)
      throw new NotFoundException('Registro de visita no encontrado');

    visita.fechaSalida = new Date();
    visita.vigilanteSalidaId = dto.vigilanteSalidaId
      ? new Types.ObjectId(dto.vigilanteSalidaId)
      : undefined;
    visita.vigilanteSalidaNombre = dto.vigilanteSalidaNombre.trim();

    return visita.save();
  }

  async listarHistorial(edificioId: string, limit = 50) {
    return this.visitaModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        fechaSalida: { $ne: null },
      })
      .sort({ fechaSalida: -1 })
      .limit(limit);
  }

  async listarParaResidente(edificioId: string, torre?: string, apto?: string) {
    if (!apto) return [];
    const query: any = {
      edificioId: new Types.ObjectId(edificioId),
      apartamento: apto.trim().toUpperCase(),
    };
    if (torre) {
      query.torre = torre.trim().toUpperCase();
    }
    return this.visitaModel.find(query).sort({ fechaIngreso: -1 }).limit(30);
  }

  // --- Pre-registros y Pases QR ---

  async crearPreRegistro(
    edificioId: string,
    censoUnidadId: string | undefined,
    torre: string,
    apartamento: string,
    residenteNombre: string,
    residenteUserId: string,
    dto: CrearPreRegistroDto,
  ) {
    // Generar código de acceso único
    let codigo = '';
    let existe = true;
    let intentos = 0;
    while (existe && intentos < 5) {
      codigo = generarCodigoAcceso();
      const previo = await this.preRegistroModel.findOne({
        codigoAcceso: codigo,
      });
      if (!previo) existe = false;
      intentos++;
    }

    const pre = await this.preRegistroModel.create({
      edificioId: new Types.ObjectId(edificioId),
      censoUnidadId: censoUnidadId
        ? new Types.ObjectId(censoUnidadId)
        : undefined,
      torre: torre.trim().toUpperCase(),
      apartamento: apartamento.trim().toUpperCase(),
      residenteNombre: residenteNombre.trim(),
      residenteUserId: residenteUserId.trim(),
      nombreVisitante: dto.nombreVisitante.trim(),
      documentoVisitante: dto.documentoVisitante?.trim(),
      placaVehiculo: dto.placaVehiculo?.trim().toUpperCase(),
      motivo: dto.motivo,
      modalidad: dto.modalidad || ModalidadPase.UN_SOLO_USO,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
      observaciones: dto.observaciones?.trim(),
      codigoAcceso: codigo,
      estado: EstadoPreRegistro.ACTIVO,
    });

    return pre;
  }

  async listarProgramadasParaPorteria(edificioId: string) {
    const ahora = new Date();
    const inicioDia = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      0,
      0,
      0,
      0,
    );
    const finDia = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      23,
      59,
      59,
      999,
    );

    return this.preRegistroModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        estado: EstadoPreRegistro.ACTIVO,
        $or: [
          {
            modalidad: ModalidadPase.UN_SOLO_USO,
            fechaInicio: { $lte: finDia },
          },
          {
            modalidad: ModalidadPase.TEMPORAL,
            fechaInicio: { $lte: finDia },
            $or: [
              { fechaFin: { $exists: false } },
              { fechaFin: null },
              { fechaFin: { $gte: inicioDia } },
            ],
          },
        ],
      })
      .sort({ fechaInicio: 1, createdAt: -1 });
  }

  async registrarIngresoProgramado(
    edificioId: string,
    preRegistroId: string,
    dto: ConfirmarIngresoProgramadoDto,
  ) {
    const pre = await this.preRegistroModel.findOne({
      _id: new Types.ObjectId(preRegistroId),
      edificioId: new Types.ObjectId(edificioId),
    });

    if (!pre) {
      throw new NotFoundException('Pre-registro de visita no encontrado');
    }

    if (pre.estado !== EstadoPreRegistro.ACTIVO) {
      throw new BadRequestException('El pase de acceso no se encuentra activo');
    }

    // 1. Crear el registro en Visitas (aparece en monitor Adentro)
    const nuevaVisita = await this.visitaModel.create({
      edificioId: new Types.ObjectId(edificioId),
      tipo: TipoVisita.INVITADO_QR,
      torre: pre.torre,
      apartamento: pre.apartamento,
      residenteAQuienVisita: pre.residenteNombre,
      nombreVisitante: pre.nombreVisitante,
      documentoVisitante:
        dto.documentoVisitante?.trim() || pre.documentoVisitante,
      placaVehiculo:
        dto.placaVehiculo?.trim().toUpperCase() || pre.placaVehiculo,
      observaciones: pre.observaciones
        ? `[Pase ${pre.codigoAcceso}] ${pre.observaciones}`
        : `[Pase ${pre.codigoAcceso}] Ingreso autorizado con QR/Pre-registro`,
      fechaIngreso: new Date(),
      vigilanteIngresoId: dto.vigilanteId
        ? new Types.ObjectId(dto.vigilanteId)
        : undefined,
      vigilanteIngresoNombre: dto.vigilanteNombre.trim(),
    });

    // 2. Si es de un solo uso, marcar como CONSUMIDO
    if (pre.modalidad === ModalidadPase.UN_SOLO_USO) {
      pre.estado = EstadoPreRegistro.CONSUMIDO;
      pre.visitaId = nuevaVisita._id;
      await pre.save();
    }

    return { visita: nuevaVisita, preRegistro: pre };
  }

  async listarPreRegistrosParaResidente(
    edificioId: string,
    residenteUserId: string,
  ) {
    return this.preRegistroModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        residenteUserId: residenteUserId.trim(),
      })
      .sort({ createdAt: -1 })
      .limit(50);
  }

  async cancelarPreRegistro(
    edificioId: string,
    residenteUserId: string,
    preRegistroId: string,
  ) {
    const pre = await this.preRegistroModel.findOne({
      _id: new Types.ObjectId(preRegistroId),
      edificioId: new Types.ObjectId(edificioId),
      residenteUserId: residenteUserId.trim(),
    });

    if (!pre) {
      throw new NotFoundException('Autorización no encontrada');
    }

    if (pre.estado === EstadoPreRegistro.CONSUMIDO) {
      throw new BadRequestException(
        'No es posible cancelar un pase que ya fue utilizado para ingresar',
      );
    }

    pre.estado = EstadoPreRegistro.CANCELADO;
    return pre.save();
  }

  async obtenerPasePublico(codigoAcceso: string) {
    const cleanCode = codigoAcceso.trim().toUpperCase();
    const pre = await this.preRegistroModel.findOne({
      codigoAcceso: cleanCode,
    });

    if (!pre) {
      throw new NotFoundException('Pase de acceso no encontrado o inválido');
    }

    const edificio = await this.edificioModel
      .findById(pre.edificioId)
      .select('nombre');

    return {
      codigoAcceso: pre.codigoAcceso,
      edificioNombre: edificio?.nombre || 'Conjunto Residencial',
      torre: pre.torre,
      apartamento: pre.apartamento,
      residenteNombre: pre.residenteNombre,
      nombreVisitante: pre.nombreVisitante,
      documentoVisitante: pre.documentoVisitante,
      placaVehiculo: pre.placaVehiculo,
      motivo: pre.motivo,
      modalidad: pre.modalidad,
      fechaInicio: pre.fechaInicio,
      fechaFin: pre.fechaFin,
      observaciones: pre.observaciones,
      estado: pre.estado,
    };
  }
}
