import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Paquete, PaqueteDocument, EstadoPaquete } from './paquete.schema';
import { CreatePaqueteDto, EntregarPaqueteDto } from './dto/paquete.dto';

@Injectable()
export class PaquetesService {
  constructor(
    @InjectModel(Paquete.name) private paqueteModel: Model<PaqueteDocument>,
  ) {}

  async registrar(edificioId: string, dto: CreatePaqueteDto, fotoUrl?: string) {
    const nuevo = await this.paqueteModel.create({
      ...dto,
      edificioId: new Types.ObjectId(edificioId),
      torre: dto.torre.trim().toUpperCase(),
      apartamento: dto.apartamento.trim().toUpperCase(),
      fotoGuiaUrl: fotoUrl || dto.fotoGuiaUrl,
      vigilanteRecibioId: dto.vigilanteRecibioId ? new Types.ObjectId(dto.vigilanteRecibioId) : undefined,
      estado: EstadoPaquete.RECIBIDO,
      fechaRecepcion: new Date(),
    });
    return nuevo;
  }

  async listarPendientes(edificioId: string, filtro?: { torre?: string; apto?: string }) {
    const query: any = {
      edificioId: new Types.ObjectId(edificioId),
      estado: EstadoPaquete.RECIBIDO,
    };

    if (filtro?.torre) {
      query.torre = { $regex: new RegExp(filtro.torre.trim(), 'i') };
    }
    if (filtro?.apto) {
      query.apartamento = { $regex: new RegExp(filtro.apto.trim(), 'i') };
    }

    return this.paqueteModel.find(query).sort({ fechaRecepcion: -1 });
  }

  async listarHistorial(edificioId: string, limit = 50) {
    return this.paqueteModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        estado: EstadoPaquete.ENTREGADO,
      })
      .sort({ fechaEntrega: -1 })
      .limit(limit);
  }

  async entregar(edificioId: string, paqueteId: string, dto: EntregarPaqueteDto) {
    const paquete = await this.paqueteModel.findOne({
      _id: new Types.ObjectId(paqueteId),
      edificioId: new Types.ObjectId(edificioId),
    });

    if (!paquete) throw new NotFoundException('Paquete no encontrado');

    paquete.estado = EstadoPaquete.ENTREGADO;
    paquete.entregadoA = dto.entregadoA.trim();
    paquete.vigilanteEntregoId = dto.vigilanteEntregoId ? new Types.ObjectId(dto.vigilanteEntregoId) : undefined;
    paquete.vigilanteEntregoNombre = dto.vigilanteEntregoNombre.trim();
    paquete.fechaEntrega = new Date();

    return paquete.save();
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
    return this.paqueteModel.find(query).sort({ createdAt: -1 }).limit(30);
  }
}
