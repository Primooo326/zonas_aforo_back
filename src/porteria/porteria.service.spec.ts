import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PaquetesService } from './paquetes/paquetes.service';
import { Paquete, EstadoPaquete } from './paquetes/paquete.schema';
import { MinutaService } from './minuta/minuta.service';
import { Minuta, SeveridadNovedad } from './minuta/minuta.schema';
import { ConsultasPorteriaService } from './consultas/consultas-porteria.service';
import { CensoUnidad } from '../censo/censo.schema';
import { Reserva } from '../reservas/reserva.schema';
import { VisitasService } from './visitas/visitas.service';
import { Visita } from './visitas/visita.schema';
import {
  PreRegistroVisita,
  EstadoPreRegistro,
  ModalidadPase,
  MotivoVisita,
} from './visitas/preregistro-visita.schema';
import { Edificio } from '../edificios/edificio.schema';

describe('Portería Services', () => {
  let paquetesService: PaquetesService;
  let minutaService: MinutaService;
  let consultasService: ConsultasPorteriaService;
  let visitasService: VisitasService;

  let mockPaqueteModel: any;
  let mockMinutaModel: any;
  let mockCensoModel: any;
  let mockReservaModel: any;
  let mockVisitaModel: any;
  let mockPreRegistroModel: any;
  let mockEdificioModel: any;

  const mockEdificioId = new Types.ObjectId();

  beforeEach(async () => {
    mockPaqueteModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    mockMinutaModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
    };

    mockCensoModel = {
      find: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };

    mockReservaModel = {
      find: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
    };

    mockVisitaModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    mockPreRegistroModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    mockEdificioModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ nombre: 'Torres del Parque' }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaquetesService,
        MinutaService,
        ConsultasPorteriaService,
        VisitasService,
        { provide: getModelToken(Paquete.name), useValue: mockPaqueteModel },
        { provide: getModelToken(Minuta.name), useValue: mockMinutaModel },
        { provide: getModelToken(CensoUnidad.name), useValue: mockCensoModel },
        { provide: getModelToken(Reserva.name), useValue: mockReservaModel },
        { provide: getModelToken(Visita.name), useValue: mockVisitaModel },
        {
          provide: getModelToken(PreRegistroVisita.name),
          useValue: mockPreRegistroModel,
        },
        { provide: getModelToken(Edificio.name), useValue: mockEdificioModel },
      ],
    }).compile();

    paquetesService = module.get<PaquetesService>(PaquetesService);
    minutaService = module.get<MinutaService>(MinutaService);
    consultasService = module.get<ConsultasPorteriaService>(ConsultasPorteriaService);
    visitasService = module.get<VisitasService>(VisitasService);
  });

  it('debe registrar un paquete en portería', async () => {
    mockPaqueteModel.create.mockResolvedValue({
      torre: '1',
      apartamento: '101',
      transportadora: 'Servientrega',
      estado: EstadoPaquete.RECIBIDO,
    });

    const res = await paquetesService.registrar(mockEdificioId.toString(), {
      torre: '1',
      apartamento: '101',
      transportadora: 'Servientrega',
      vigilanteRecibioNombre: 'Carlos',
    });

    expect(res.estado).toBe(EstadoPaquete.RECIBIDO);
    expect(mockPaqueteModel.create).toHaveBeenCalled();
  });

  it('debe registrar una novedad en minuta digital con severidad', async () => {
    mockMinutaModel.create.mockResolvedValue({
      titulo: 'Bombillo fundido pasillo torre 2',
      severidad: SeveridadNovedad.MANTENIMIENTO,
      vigilanteNombre: 'Carlos',
    });

    const res = await minutaService.registrar(mockEdificioId.toString(), {
      titulo: 'Bombillo fundido pasillo torre 2',
      descripcion: 'El bombillo del piso 3 está apagado',
      severidad: SeveridadNovedad.MANTENIMIENTO,
      vigilanteNombre: 'Carlos',
    });

    expect(res.severidad).toBe(SeveridadNovedad.MANTENIMIENTO);
  });

  it('debe buscar vehículos por placa cumpliendo PoLP', async () => {
    mockCensoModel.lean.mockResolvedValue([
      {
        identificador: 'Torre 1 - 202',
        torre: '1',
        numeroApto: '202',
        tags: ['moroso'],
        personas: [{ nombreCompleto: 'Andrés Gómez', telefono: '3001234567' }],
        vehiculos: [
          { placa: 'ABC123', tipo: 'carro', marca: 'Mazda', color: 'Rojo' },
        ],
      },
    ]);

    const res = await consultasService.buscarPorPlaca(mockEdificioId.toString(), 'ABC123');
    expect(res).toHaveLength(1);
    expect(res[0].placa).toBe('ABC123');
    expect(res[0].esMoroso).toBe(true);
    expect(res[0].contactos[0].nombre).toBe('Andrés Gómez');
  });

  it('debe registrar el ingreso de una visita en portería', async () => {
    mockVisitaModel.create.mockResolvedValue({
      nombreVisitante: 'Mario López',
      torre: '2',
      apartamento: '401',
      fechaIngreso: new Date(),
    });

    const res = await visitasService.registrarIngreso(mockEdificioId.toString(), {
      nombreVisitante: 'Mario López',
      torre: '2',
      apartamento: '401',
      vigilanteIngresoNombre: 'Carlos',
    });

    expect(res.nombreVisitante).toBe('Mario López');
  });

  it('debe crear un pre-registro de visita con código de acceso único', async () => {
    mockPreRegistroModel.findOne.mockResolvedValue(null);
    mockPreRegistroModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      codigoAcceso: 'PAS-ABC123',
      nombreVisitante: 'Invitado Test',
      modalidad: ModalidadPase.UN_SOLO_USO,
      estado: EstadoPreRegistro.ACTIVO,
    });

    const res = await visitasService.crearPreRegistro(
      mockEdificioId.toString(),
      undefined,
      'Bogotá',
      '101A',
      'Laura López',
      'user-123',
      {
        nombreVisitante: 'Invitado Test',
        fechaInicio: new Date().toISOString(),
        motivo: MotivoVisita.SOCIAL,
      },
    );

    expect(res.codigoAcceso).toBe('PAS-ABC123');
    expect(res.estado).toBe(EstadoPreRegistro.ACTIVO);
  });

  it('debe registrar el ingreso de una visita programada y consumirla si es un solo uso', async () => {
    const mockSave = jest.fn();
    const mockPre = {
      _id: new Types.ObjectId(),
      torre: 'Bogotá',
      apartamento: '101A',
      residenteNombre: 'Laura López',
      nombreVisitante: 'Invitado Programado',
      codigoAcceso: 'PAS-XYZ789',
      modalidad: ModalidadPase.UN_SOLO_USO,
      estado: EstadoPreRegistro.ACTIVO,
      save: mockSave,
    };

    mockPreRegistroModel.findOne.mockResolvedValue(mockPre);
    mockVisitaModel.create.mockResolvedValue({
      _id: new Types.ObjectId(),
      nombreVisitante: 'Invitado Programado',
      residenteAQuienVisita: 'Laura López',
    });

    const res = await visitasService.registrarIngresoProgramado(
      mockEdificioId.toString(),
      mockPre._id.toString(),
      {
        vigilanteNombre: 'Carlos Guarda',
      },
    );

    expect(res.visita).toBeDefined();
    expect(mockPre.estado).toBe(EstadoPreRegistro.CONSUMIDO);
    expect(mockSave).toHaveBeenCalled();
  });
});
