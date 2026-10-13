import { Test, TestingModule } from '@nestjs/testing';
import { CensoController } from './censo.controller';
import { CensoService } from './censo.service';
import { PersonaCensoDto } from './dto/create-censo.dto';
import { UpdateCensoDto } from './dto/update-censo.dto';

describe('CensoController', () => {
  let controller: CensoController;
  let service: CensoService;

  const mockCensoService = {
    getStats: jest.fn(),
    importarMasivo: jest.fn(),
    getCatalogoUnidades: jest.fn(),
    getInventarioParqueaderos: jest.fn(),
    getInventarioBodegas: jest.fn(),
    resetEdificio: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    agregarHabitante: jest.fn(),
    remove: jest.fn(),
    aprobar: jest.fn(),
    rechazar: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CensoController],
      providers: [
        {
          provide: CensoService,
          useValue: mockCensoService,
        },
      ],
    }).compile();

    controller = module.get<CensoController>(CensoController);
    service = module.get<CensoService>(CensoService);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('agregarHabitante', () => {
    it('debe llamar a service.agregarHabitante con el edificioId extraído del usuario', async () => {
      const mockReq = { user: { edificioId: 'edif-123' } };
      const dto: PersonaCensoDto = {
        nombreCompleto: 'Juan Test',
        fechaNacimiento: '1990-01-01',
        telefono: '3001234567',
        email: 'juan@test.com',
        condicion: 'propietario',
        esContactoPrincipal: true,
      };

      const mockResult = { id: 'unidad-1', personas: [dto] };
      mockCensoService.agregarHabitante.mockResolvedValue(mockResult);

      const res = await controller.agregarHabitante('unidad-1', dto, mockReq as any);

      expect(service.agregarHabitante).toHaveBeenCalledWith('unidad-1', 'edif-123', dto);
      expect(res).toEqual(mockResult);
    });
  });

  describe('update', () => {
    it('debe delegar a service.update con id, edificioId y dto', async () => {
      const mockReq = { user: { edificioId: 'edif-123' } };
      const dto: UpdateCensoDto = {
        parqueaderosAsignados: [{ numero: 'P-01', tipo: 'carro', esCubierto: true }],
        bodegasAsignadas: [{ numero: 'B-01', ubicacion: 'Sótano 1', metrosCuadrados: 5 }],
      };

      const mockResult = { id: 'unidad-1', ...dto };
      mockCensoService.update.mockResolvedValue(mockResult);

      const res = await controller.update('unidad-1', dto, mockReq as any);

      expect(service.update).toHaveBeenCalledWith('unidad-1', 'edif-123', dto);
      expect(res).toEqual(mockResult);
    });
  });

  describe('inventario endpoints', () => {
    it('debe delegar getParqueaderos al servicio', async () => {
      const mockReq = { user: { edificioId: 'edif-123' } };
      const mockList = [{ numero: 'P-01' }];
      mockCensoService.getInventarioParqueaderos.mockResolvedValue(mockList);

      const res = await controller.getParqueaderos(mockReq as any);
      expect(service.getInventarioParqueaderos).toHaveBeenCalledWith('edif-123');
      expect(res).toEqual(mockList);
    });

    it('debe delegar getBodegas al servicio', async () => {
      const mockReq = { user: { edificioId: 'edif-123' } };
      const mockList = [{ numero: 'B-01' }];
      mockCensoService.getInventarioBodegas.mockResolvedValue(mockList);

      const res = await controller.getBodegas(mockReq as any);
      expect(service.getInventarioBodegas).toHaveBeenCalledWith('edif-123');
      expect(res).toEqual(mockList);
    });

    it('debe proveer getParqueaderosPublicos sin requerir sesión', async () => {
      const mockList = [{ numero: 'P-PUB-01' }];
      mockCensoService.getInventarioParqueaderos.mockResolvedValue(mockList);

      const res = await controller.getParqueaderosPublicos('edif-publico');
      expect(service.getInventarioParqueaderos).toHaveBeenCalledWith('edif-publico');
      expect(res).toEqual(mockList);
    });
  });
});
