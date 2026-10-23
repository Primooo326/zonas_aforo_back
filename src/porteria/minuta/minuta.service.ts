import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Minuta, MinutaDocument, SeveridadNovedad } from './minuta.schema';
import { CreateMinutaDto, RevisarMinutaDto } from './dto/minuta.dto';

@Injectable()
export class MinutaService {
  constructor(
    @InjectModel(Minuta.name) private minutaModel: Model<MinutaDocument>,
  ) {}

  async registrar(edificioId: string, dto: CreateMinutaDto, fotosUrls: string[] = []) {
    const fotosFinales = [...(dto.fotos || []), ...fotosUrls];
    const nueva = await this.minutaModel.create({
      ...dto,
      edificioId: new Types.ObjectId(edificioId),
      fotos: fotosFinales,
      vigilanteId: dto.vigilanteId ? new Types.ObjectId(dto.vigilanteId) : undefined,
      fechaHora: new Date(),
      revisadoPorAdmin: false,
    });
    return nueva;
  }

  async listar(
    edificioId: string,
    filtro?: {
      severidad?: SeveridadNovedad;
      fechaInicio?: string;
      fechaFin?: string;
      soloPendientesAdmin?: boolean;
      limit?: number;
    },
  ) {
    const query: any = {
      edificioId: new Types.ObjectId(edificioId),
    };

    if (filtro?.severidad) {
      query.severidad = filtro.severidad;
    }

    if (filtro?.soloPendientesAdmin) {
      query.revisadoPorAdmin = false;
      query.severidad = { $in: [SeveridadNovedad.MANTENIMIENTO, SeveridadNovedad.INCIDENTE] };
    }

    if (filtro?.fechaInicio || filtro?.fechaFin) {
      query.fechaHora = {};
      if (filtro.fechaInicio) query.fechaHora.$gte = new Date(filtro.fechaInicio);
      if (filtro.fechaFin) query.fechaHora.$lte = new Date(filtro.fechaFin);
    }

    const limit = filtro?.limit || 50;

    return this.minutaModel
      .find(query)
      .sort({ fechaHora: -1 })
      .limit(limit);
  }

  async obtenerResumenAlertas(edificioId: string) {
    const pendientesMantenimiento = await this.minutaModel.countDocuments({
      edificioId: new Types.ObjectId(edificioId),
      severidad: SeveridadNovedad.MANTENIMIENTO,
      revisadoPorAdmin: false,
    });

    const pendientesIncidentes = await this.minutaModel.countDocuments({
      edificioId: new Types.ObjectId(edificioId),
      severidad: SeveridadNovedad.INCIDENTE,
      revisadoPorAdmin: false,
    });

    return {
      pendientesMantenimiento,
      pendientesIncidentes,
      totalAlertasPendientes: pendientesMantenimiento + pendientesIncidentes,
    };
  }

  async marcarRevisado(edificioId: string, id: string, dto: RevisarMinutaDto) {
    const novedad = await this.minutaModel.findOne({
      _id: new Types.ObjectId(id),
      edificioId: new Types.ObjectId(edificioId),
    });

    if (!novedad) throw new NotFoundException('Novedad de minuta no encontrada');

    novedad.revisadoPorAdmin = true;
    novedad.notasAdmin = dto.notasAdmin?.trim();
    novedad.fechaRevisionAdmin = new Date();

    return novedad.save();
  }
}
