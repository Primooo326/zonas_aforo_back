import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { VigilantesService } from './vigilantes.service';
import { Vigilante } from './vigilante.schema';
import { Edificio } from '../edificios/edificio.schema';

describe('VigilantesService', () => {
  let service: VigilantesService;
  let mockVigilanteModel: any;
  let mockEdificioModel: any;
  let mockJwtService: any;

  const mockEdificioId = new Types.ObjectId();

  beforeEach(async () => {
    mockVigilanteModel = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
    };

    mockEdificioModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VigilantesService,
        {
          provide: getModelToken(Vigilante.name),
          useValue: mockVigilanteModel,
        },
        {
          provide: getModelToken(Edificio.name),
          useValue: mockEdificioModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<VigilantesService>(VigilantesService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe crear un vigilante exitosamente', async () => {
    mockVigilanteModel.findOne.mockResolvedValue(null);
    mockVigilanteModel.create.mockResolvedValue({
      nombreCompleto: 'Juan Guarda',
      cedula: '12345',
      edificioId: mockEdificioId,
      activo: true,
    });

    const resultado = await service.crear(mockEdificioId.toString(), {
      nombreCompleto: 'Juan Guarda',
      cedula: '12345',
    });

    expect(resultado.nombreCompleto).toBe('Juan Guarda');
    expect(mockVigilanteModel.create).toHaveBeenCalled();
  });

  it('debe listar vigilantes activos', async () => {
    mockVigilanteModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ nombreCompleto: 'Pedro Vigilante' }]),
      }),
    });

    const activos = await service.listarActivos(mockEdificioId.toString());
    expect(activos).toHaveLength(1);
    expect(activos[0].nombreCompleto).toBe('Pedro Vigilante');
  });
});
