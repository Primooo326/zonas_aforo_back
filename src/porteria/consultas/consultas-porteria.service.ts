import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CensoUnidad, CensoUnidadDocument } from '../../censo/censo.schema';
import { Reserva, ReservaDocument } from '../../reservas/reserva.schema';

@Injectable()
export class ConsultasPorteriaService {
  constructor(
    @InjectModel(CensoUnidad.name) private censoModel: Model<CensoUnidadDocument>,
    @InjectModel(Reserva.name) private reservaModel: Model<ReservaDocument>,
  ) {}

  async buscarDirectorio(edificioId: string, q?: string) {
    const query: any = {
      edificioId: new Types.ObjectId(edificioId),
      estado: 'aprobado',
    };

    if (q && q.trim().length > 0) {
      const term = q.trim();
      const regex = new RegExp(term, 'i');
      query.$or = [
        { identificador: regex },
        { torre: regex },
        { numeroApto: regex },
        { 'personas.nombreCompleto': regex },
        { 'vehiculos.placa': regex },
      ];
    }

    const unidades = await this.censoModel
      .find(query)
      .select('identificador torre numeroApto piso tipoOcupacion tags personas vehiculos mascotas')
      .limit(30)
      .lean();

    return unidades.map((u: any) => ({
      _id: u._id,
      identificador: u.identificador,
      torre: u.torre || '',
      numeroApto: u.numeroApto || '',
      piso: u.piso,
      tipoOcupacion: u.tipoOcupacion,
      esMoroso: Array.isArray(u.tags) && u.tags.includes('moroso'),
      residentes: (u.personas || []).map((p: any) => ({
        nombreCompleto: p.nombreCompleto,
        telefono: p.telefono,
        condicion: p.condicion,
        esContactoEmergencia: p.esContactoEmergencia,
      })),
      vehiculos: (u.vehiculos || []).map((v: any) => ({
        placa: v.placa,
        tipo: v.tipo,
        marca: v.marca,
        modelo: v.modelo,
        color: v.color,
        numeroParqueadero: v.numeroParqueadero,
      })),
      mascotas: (u.mascotas || []).map((m: any) => ({
        nombre: m.nombre,
        tipo: m.tipo,
        raza: m.raza,
        esRazaPeligrosa: m.esRazaPeligrosa,
        tienePoliza: !!m.adjuntoPolizaUrl,
      })),
    }));
  }

  async buscarPorPlaca(edificioId: string, placa: string) {
    if (!placa || placa.trim().length < 2) return [];

    const cleanPlaca = placa.trim().toUpperCase();
    const regex = new RegExp(cleanPlaca, 'i');

    const unidades = await this.censoModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        'vehiculos.placa': regex,
        estado: 'aprobado',
      })
      .select('identificador torre numeroApto tags personas vehiculos')
      .lean();

    const resultados: any[] = [];
    unidades.forEach((u: any) => {
      const matchVehs = (u.vehiculos || []).filter((v: any) =>
        v.placa?.toUpperCase().includes(cleanPlaca),
      );
      matchVehs.forEach((v: any) => {
        resultados.push({
          placa: v.placa,
          tipo: v.tipo,
          marca: v.marca,
          modelo: v.modelo,
          color: v.color,
          numeroParqueadero: v.numeroParqueadero,
          identificador: u.identificador,
          torre: u.torre,
          numeroApto: u.numeroApto,
          esMoroso: Array.isArray(u.tags) && u.tags.includes('moroso'),
          contactos: (u.personas || []).slice(0, 2).map((p: any) => ({
            nombre: p.nombreCompleto,
            telefono: p.telefono,
          })),
        });
      });
    });

    return resultados;
  }

  async buscarMascotas(edificioId: string, q: string) {
    if (!q || q.trim().length < 2) return [];

    const regex = new RegExp(q.trim(), 'i');

    const unidades = await this.censoModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        estado: 'aprobado',
        $or: [
          { 'mascotas.nombre': regex },
          { 'mascotas.raza': regex },
          { identificador: regex },
        ],
      })
      .select('identificador torre numeroApto mascotas personas')
      .lean();

    const resultados: any[] = [];
    unidades.forEach((u: any) => {
      (u.mascotas || []).forEach((m: any) => {
        resultados.push({
          nombre: m.nombre,
          tipo: m.tipo,
          raza: m.raza,
          esRazaPeligrosa: m.esRazaPeligrosa,
          tienePoliza: !!m.adjuntoPolizaUrl,
          identificador: u.identificador,
          torre: u.torre,
          numeroApto: u.numeroApto,
          residenteContacto: u.personas?.[0]?.nombreCompleto,
          telefonoContacto: u.personas?.[0]?.telefono,
        });
      });
    });

    return resultados;
  }

  async reservasHoy(edificioId: string) {
    // Formato local YYYY-MM-DD
    const now = new Date();
    const hoyStr = now.toISOString().split('T')[0];

    return this.reservaModel
      .find({
        edificioId: new Types.ObjectId(edificioId),
        fecha: hoyStr,
        estado: { $in: ['activa', 'aprobada'] },
      })
      .populate('zonaId', 'nombre capacidadMaxima')
      .sort({ horaInicio: 1 });
  }
}
