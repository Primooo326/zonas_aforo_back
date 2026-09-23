import { Test, TestingModule } from '@nestjs/testing';
import { InmueblesController } from './inmuebles.controller';
import { InmueblesService } from './inmuebles.service';

describe('InmueblesController', () => {
  let controller: InmueblesController;
  let service: InmueblesService;

  const mockService = {
    create: jest.fn().mockResolvedValue({ _id: '1', tipo: 'inmueble' }),
    findAll: jest.fn().mockResolvedValue([{ _id: '1' }]),
    findByEdificio: jest.fn().mockResolvedValue([{ _id: '1' }]),
    findOne: jest.fn().mockResolvedValue({ _id: '1' }),
    update: jest.fn().mockResolvedValue({ _id: '1', precio: 200 }),
    remove: jest.fn().mockResolvedValue({ _id: '1' }),
    updateEstado: jest.fn().mockResolvedValue({ _id: '1', estado: 'vendida' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InmueblesController],
      providers: [{ provide: InmueblesService, useValue: mockService }],
    }).compile();

    controller = module.get<InmueblesController>(InmueblesController);
    service = module.get<InmueblesService>(InmueblesService);
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('POST /inmuebles -> create', async () => {
    const dto: any = { tipo: 'inmueble', transaccion: 'venta', precio: 100, telefono: '3001234567' };
    const req: any = { user: { id: 'edificio123' } };
    const result = await controller.create(dto, [], req);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'inmueble' }), 'edificio123', undefined);
    expect(result).toEqual({ _id: '1', tipo: 'inmueble' });
  });

  it('GET /inmuebles -> findAll', async () => {
    const result = await controller.findAll('edificio123', 'inmueble', 'venta', undefined, undefined);
    expect(service.findAll).toHaveBeenCalledWith({
      edificioId: 'edificio123',
      tipo: 'inmueble',
      transaccion: 'venta',
      estado: undefined,
      search: undefined,
    });
    expect(result).toEqual([{ _id: '1' }]);
  });

  it('GET /inmuebles/edificio/:edificioId -> findByEdificio', async () => {
    const result = await controller.findByEdificio('edificio123', 'parqueadero', undefined, undefined);
    expect(service.findByEdificio).toHaveBeenCalledWith('edificio123', {
      tipo: 'parqueadero',
      transaccion: undefined,
      estado: undefined,
    });
    expect(result).toEqual([{ _id: '1' }]);
  });

  it('GET /inmuebles/:id -> findOne', async () => {
    const result = await controller.findOne('id123');
    expect(service.findOne).toHaveBeenCalledWith('id123');
    expect(result).toEqual({ _id: '1' });
  });

  it('PATCH /inmuebles/:id -> update', async () => {
    const dto: any = { precio: 200 };
    const req: any = { user: { id: 'edificio123' } };
    const result = await controller.update('id123', dto, [], req);
    expect(service.update).toHaveBeenCalledWith('id123', expect.objectContaining({ precio: 200 }), 'edificio123', undefined);
    expect(result).toEqual({ _id: '1', precio: 200 });
  });

  it('DELETE /inmuebles/:id -> remove', async () => {
    const req: any = { user: { id: 'edificio123' } };
    const result = await controller.remove('id123', req);
    expect(service.remove).toHaveBeenCalledWith('id123', 'edificio123', undefined);
    expect(result).toEqual({ _id: '1' });
  });

  it('PATCH /inmuebles/:id/estado -> updateEstado', async () => {
    const req: any = { user: { id: 'edificio123' } };
    const result = await controller.updateEstado('id123', 'vendida', req);
    expect(service.updateEstado).toHaveBeenCalledWith('id123', 'vendida', 'edificio123', undefined);
    expect(result).toEqual({ _id: '1', estado: 'vendida' });
  });
});
