import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { InmueblesService } from './inmuebles.service';
import { Inmueble } from './inmueble.schema';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('InmueblesService', () => {
  let service: InmueblesService;
  let model: any;

  const edificioId = new Types.ObjectId().toString();
  const otroEdificioId = new Types.ObjectId().toString();
  const inmuebleId = new Types.ObjectId().toString();

  const mockInmueble = {
    _id: new Types.ObjectId(inmuebleId),
    tipo: 'inmueble',
    transaccion: 'venta',
    precio: 100000000,
    telefono: '3001234567',
    edificioId: new Types.ObjectId(edificioId),
    estado: 'activa',
    toString: () => inmuebleId,
  };

  beforeEach(async () => {
    const queryMock = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([mockInmueble]),
    };

    const mockModel: any = {
      create: jest.fn().mockImplementation((dto) => Promise.resolve({ ...dto, _id: new Types.ObjectId() })),
      find: jest.fn().mockReturnValue(queryMock),
      findById: jest.fn().mockImplementation((id: string) => {
        const doc = id === inmuebleId ? mockInmueble : null;
        return {
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(doc),
          }),
          lean: jest.fn().mockResolvedValue(doc),
          then: (resolve: any) => Promise.resolve(doc).then(resolve),
        };
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ ...mockInmueble, precio: 200000 }),
        }),
        lean: jest.fn().mockResolvedValue({ ...mockInmueble, precio: 200000 }),
      }),
      findByIdAndDelete: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockInmueble),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InmueblesService,
        { provide: getModelToken(Inmueble.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<InmueblesService>(InmueblesService);
    model = module.get(getModelToken(Inmueble.name));
  });

  describe('create', () => {
    it('debe crear inmueble con edificioId', async () => {
      const dto: any = {
        tipo: 'inmueble',
        transaccion: 'venta',
        precio: 250000000,
        telefono: '3001234567',
        observacion: 'test',
      };
      const result = await service.create(dto, edificioId);
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'inmueble',
          edificioId: expect.any(Types.ObjectId),
          estado: 'activa',
        }),
      );
      expect(result).toBeDefined();
    });

    it('debe crear con propietarioId si se provee', async () => {
      const propietarioId = new Types.ObjectId().toString();
      const dto: any = {
        tipo: 'habitacion',
        transaccion: 'arriendo',
        precio: 800000,
        telefono: '3001234567',
      };
      await service.create(dto, edificioId, propietarioId);
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          propietarioId: expect.any(Types.ObjectId),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('debe listar por edificioId con estado activa por defecto', async () => {
      const result = await service.findAll({ edificioId });
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({
          edificioId: expect.any(Types.ObjectId),
          estado: 'activa',
        }),
      );
      expect(result).toEqual([mockInmueble]);
    });

    it('debe filtrar por tipo y transaccion', async () => {
      await service.findAll({ edificioId, tipo: 'parqueadero', transaccion: 'arriendo' });
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'parqueadero',
          transaccion: 'arriendo',
        }),
      );
    });

    it('debe lanzar BadRequest si falta edificioId', async () => {
      await expect(service.findAll({} as any)).rejects.toThrow(BadRequestException);
    });

    it('debe respetar estado explícito', async () => {
      await service.findAll({ edificioId, estado: 'vendida' });
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'vendida' }),
      );
    });
  });

  describe('findOne', () => {
    it('debe retornar inmueble por id', async () => {
      model.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockInmueble),
        }),
        lean: jest.fn().mockResolvedValue(mockInmueble),
      });
      const result = await service.findOne(inmuebleId);
      expect(result).toEqual(mockInmueble);
    });

    it('debe lanzar BadRequest si id inválido', async () => {
      await expect(service.findOne('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFound si no existe', async () => {
      model.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
        lean: jest.fn().mockResolvedValue(null),
      });
      await expect(service.findOne(new Types.ObjectId().toString())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('debe actualizar si es propietario del edificio', async () => {
      const dto: any = { precio: 300000000 };
      const result = await service.update(inmuebleId, dto, edificioId);
      expect(model.findByIdAndUpdate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('debe lanzar Forbidden si edificio no coincide', async () => {
      const dto: any = { precio: 300000000 };
      // mockInmueble pertenece a edificioId, intentamos con otroEdificioId
      await expect(service.update(inmuebleId, dto, otroEdificioId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('debe eliminar si autorizado', async () => {
      const result = await service.remove(inmuebleId, edificioId);
      expect(model.findByIdAndDelete).toHaveBeenCalledWith(inmuebleId);
      expect(result).toEqual(mockInmueble);
    });

    it('debe lanzar Forbidden si no autorizado', async () => {
      await expect(service.remove(inmuebleId, otroEdificioId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateEstado', () => {
    it('debe cambiar estado', async () => {
      const result = await service.updateEstado(inmuebleId, 'vendida', edificioId);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        inmuebleId,
        { estado: 'vendida' },
        { new: true },
      );
      expect(result).toBeDefined();
    });
  });
});
