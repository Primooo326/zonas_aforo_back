import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PortalService } from './portal.service';
import { Propietario } from '../propietarios/propietario.schema';
import { CensoUnidad, ParqueaderoInventario } from '../censo/censo.schema';
import { Edificio } from '../edificios/edificio.schema';
import { Reserva } from '../reservas/reserva.schema';
import { ReservasService } from '../reservas/reservas.service';
import { ZonasService } from '../zonas/zonas.service';
import { PaquetesService } from '../porteria/paquetes/paquetes.service';
import { VisitasService } from '../porteria/visitas/visitas.service';

describe('PortalService', () => {
  let service: PortalService;
  let mockPropietarioModel: any;
  let mockCensoModel: any;
  let mockEdificioModel: any;
  let mockReservaModel: any;
  let mockParqueaderoModel: any;
  let mockReservasService: any;
  let mockZonasService: any;

  const mockCensoUnidadId = new Types.ObjectId();
  const mockEdificioId = new Types.ObjectId();
  const mockPropietarioId = new Types.ObjectId();

  beforeEach(async () => {
    mockPropietarioModel = {
      findById: jest.fn(),
    };

    mockCensoModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      deleteMany: jest.fn(),
    };

    mockParqueaderoModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
      findOne: jest.fn().mockResolvedValue(null),
    };

    // Constructor mock for `new this.censoModel(...)`
    const mockCensoInstance = {
      save: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        estado: 'pendiente_actualizacion',
      }),
    };
    function MockCensoModelClass(dto: any) {
      Object.assign(this, dto, mockCensoInstance);
    }
    MockCensoModelClass.findById = mockCensoModel.findById;
    MockCensoModelClass.findOne = mockCensoModel.findOne;
    MockCensoModelClass.deleteMany = mockCensoModel.deleteMany;

    mockEdificioModel = {
      findById: jest.fn(),
    };

    mockReservaModel = {
      find: jest.fn(),
      findById: jest.fn(),
    };

    mockReservasService = {
      crearSolicitud: jest.fn(),
      cancelar: jest.fn(),
    };

    mockZonasService = {
      findPublicByEdificio: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortalService,
        {
          provide: getModelToken(Propietario.name),
          useValue: mockPropietarioModel,
        },
        {
          provide: getModelToken(CensoUnidad.name),
          useValue: MockCensoModelClass,
        },
        {
          provide: getModelToken(Edificio.name),
          useValue: mockEdificioModel,
        },
        {
          provide: getModelToken(Reserva.name),
          useValue: mockReservaModel,
        },
        {
          provide: getModelToken(ParqueaderoInventario.name),
          useValue: mockParqueaderoModel,
        },
        {
          provide: ReservasService,
          useValue: mockReservasService,
        },
        {
          provide: ZonasService,
          useValue: mockZonasService,
        },
        {
          provide: PaquetesService,
          useValue: {
            listarParaResidente: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: VisitasService,
          useValue: {
            listarParaResidente: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<PortalService>(PortalService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('getMe', () => {
    it('debe lanzar NotFoundException si el propietario no existe', async () => {
      mockPropietarioModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getMe(mockPropietarioId.toString())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar BadRequestException si el propietario no tiene censoUnidadId', async () => {
      mockPropietarioModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: mockPropietarioId,
            nombre: 'Carlos Residente',
            email: 'carlos@test.com',
            censoUnidadId: null,
          }),
        }),
      });

      await expect(service.getMe(mockPropietarioId.toString())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe retornar datos completos cuando el residente y la unidad existen', async () => {
      mockPropietarioModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: mockPropietarioId,
            nombre: 'Carlos Residente',
            email: 'carlos@test.com',
            censoUnidadId: mockCensoUnidadId,
            edificioId: mockEdificioId,
          }),
        }),
      });

      mockCensoModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: mockCensoUnidadId,
          torre: '1',
          numeroApto: '402',
          personas: [{ nombreCompleto: 'Carlos Residente' }],
        }),
      });

      mockCensoModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      mockEdificioModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            nombre: 'Torres del Parque',
            email: 'admin@torres.com',
          }),
        }),
      });

      const res = await service.getMe(mockPropietarioId.toString());
      expect(res.propietario.nombre).toBe('Carlos Residente');
      expect(res.unidad.numeroApto).toBe('402');
      expect(res.edificio.nombre).toBe('Torres del Parque');
    });
  });

  describe('crearReserva', () => {
    it('debe rechazar la reserva si la unidad presenta mora (tag moroso)', async () => {
      mockPropietarioModel.findById.mockResolvedValue({
        _id: mockPropietarioId,
        censoUnidadId: mockCensoUnidadId,
        nombre: 'Carlos Residente',
      });

      mockCensoModel.findById.mockResolvedValue({
        _id: mockCensoUnidadId,
        tags: ['moroso'],
      });

      await expect(
        service.crearReserva(mockPropietarioId.toString(), {
          zonaId: new Types.ObjectId().toString(),
          fecha: '2026-10-25',
          horaInicio: '10:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelarReserva', () => {
    it('debe prohibir cancelar una reserva ajena a la unidad del residente', async () => {
      const otraUnidadId = new Types.ObjectId();
      mockPropietarioModel.findById.mockResolvedValue({
        _id: mockPropietarioId,
        censoUnidadId: mockCensoUnidadId,
      });

      mockReservaModel.findById.mockResolvedValue({
        _id: new Types.ObjectId(),
        censoUnidadId: otraUnidadId,
      });

      await expect(
        service.cancelarReserva(
          mockPropietarioId.toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
