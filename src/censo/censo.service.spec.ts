import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CensoService, calcularEdad, categorizarEdad } from './censo.service';
import {
  CensoUnidad,
  ParqueaderoInventario,
  BodegaInventario,
  InvitacionCenso,
} from './censo.schema';
import { Types } from 'mongoose';

describe('CensoService', () => {
  let service: CensoService;

  let mockCensoModel: any;
  let mockParqueaderoModel: any;
  let mockBodegaModel: any;
  let mockInvitacionModel: any;

  beforeEach(async () => {
    mockCensoModel = {
      new: jest.fn(),
      constructor: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      exec: jest.fn(),
    };

    mockParqueaderoModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      exec: jest.fn(),
    };

    mockBodegaModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      exec: jest.fn(),
    };

    mockInvitacionModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
      deleteMany: jest.fn(),
      exec: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CensoService,
        {
          provide: getModelToken(CensoUnidad.name),
          useValue: mockCensoModel,
        },
        {
          provide: getModelToken(ParqueaderoInventario.name),
          useValue: mockParqueaderoModel,
        },
        {
          provide: getModelToken(BodegaInventario.name),
          useValue: mockBodegaModel,
        },
        {
          provide: getModelToken(InvitacionCenso.name),
          useValue: mockInvitacionModel,
        },
      ],
    }).compile();

    service = module.get<CensoService>(CensoService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('Cálculo y Categorización de Edad', () => {
    it('debe clasificar como menor a alguien con menos de 18 años', () => {
      const fechaMenor = new Date();
      fechaMenor.setFullYear(fechaMenor.getFullYear() - 10);
      const edad = calcularEdad(fechaMenor);
      expect(edad).toBe(10);
      expect(categorizarEdad(edad)).toBe('menor');
    });

    it('debe clasificar como adulto a alguien de 35 años', () => {
      const fechaAdulto = new Date();
      fechaAdulto.setFullYear(fechaAdulto.getFullYear() - 35);
      const edad = calcularEdad(fechaAdulto);
      expect(edad).toBe(35);
      expect(categorizarEdad(edad)).toBe('adulto');
    });

    it('debe clasificar como adulto mayor a alguien de 65 años', () => {
      const fechaMayor = new Date();
      fechaMayor.setFullYear(fechaMayor.getFullYear() - 65);
      const edad = calcularEdad(fechaMayor);
      expect(edad).toBe(65);
      expect(categorizarEdad(edad)).toBe('adulto_mayor');
    });
  });

  describe('Estadísticas Agregadas', () => {
    it('debe calcular KPIs correctamente incluyendo menores, adultos mayores y mascotas', async () => {
      const edificioId = new Types.ObjectId().toString();

      const fechaMenor = new Date();
      fechaMenor.setFullYear(fechaMenor.getFullYear() - 8);

      const fechaMayor = new Date();
      fechaMayor.setFullYear(fechaMayor.getFullYear() - 72);

      const mockUnidades = [
        {
          estado: 'aprobado',
          personas: [
            { nombreCompleto: 'Menor 1', fechaNacimiento: fechaMenor, condicion: 'conviviente' },
            { nombreCompleto: 'Abuelo 1', fechaNacimiento: fechaMayor, condicion: 'propietario' },
          ],
          mascotas: [
            { tipo: 'perro', nombre: 'Roco', raza: 'Pitbull', esPeligroso: true },
          ],
          vehiculos: [
            { tipo: 'carro', placa: 'ABC123' },
          ],
        },
        {
          estado: 'pendiente',
          personas: [],
          mascotas: [],
          vehiculos: [],
        },
      ];

      mockCensoModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUnidades),
      });

      const stats = await service.getStats(edificioId);

      expect(stats.totalUnidades).toBe(1);
      expect(stats.totalPersonas).toBe(2);
      expect(stats.menores).toBe(1);
      expect(stats.adultosMayores).toBe(1);
      expect(stats.totalMascotas).toBe(1);
      expect(stats.mascotasPeligrosas).toBe(1);
      expect(stats.totalVehiculos).toBe(1);
      expect(stats.pendientes).toBe(1);
    });
  });

  describe('agregarHabitante (Nuevo Flujo de Habitantes)', () => {
    const edificioId = new Types.ObjectId().toString();
    const unidadId = new Types.ObjectId().toString();

    it('debe registrar habitante adulto en unidad desocupada y cambiarla a habitada como contacto principal', async () => {
      const fechaAdulto = new Date();
      fechaAdulto.setFullYear(fechaAdulto.getFullYear() - 30);

      const mockUnidad = {
        _id: new Types.ObjectId(unidadId),
        edificioId: new Types.ObjectId(edificioId),
        torre: '1',
        numeroApto: '101',
        tipoOcupacion: 'desocupada',
        personas: [],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      mockCensoModel.findOne.mockResolvedValue(mockUnidad);

      const resultado = await service.agregarHabitante(unidadId, edificioId, {
        nombreCompleto: 'Carlos Pérez',
        documento: '10203040',
        fechaNacimiento: fechaAdulto.toISOString().split('T')[0],
        telefono: '3001234567',
        email: 'carlos@test.com',
        condicion: 'propietario',
      } as any);

      expect(resultado.tipoOcupacion).toBe('habitada');
      expect(resultado.personas.length).toBe(1);
      expect(resultado.personas[0].nombreCompleto).toBe('Carlos Pérez');
      expect(resultado.personas[0].esContactoPrincipal).toBe(true);
      expect(mockUnidad.save).toHaveBeenCalled();
    });

    it('debe transferir el contacto principal al nuevo habitante desmarcando al previo', async () => {
      const fechaAdulto = new Date();
      fechaAdulto.setFullYear(fechaAdulto.getFullYear() - 28);

      const mockUnidad = {
        _id: new Types.ObjectId(unidadId),
        edificioId: new Types.ObjectId(edificioId),
        tipoOcupacion: 'habitada',
        personas: [
          {
            nombreCompleto: 'Ana Gómez',
            esContactoPrincipal: true,
            condicion: 'arrendatario',
          },
        ],
        save: jest.fn().mockImplementation(function () {
          return Promise.resolve(this);
        }),
      };

      mockCensoModel.findOne.mockResolvedValue(mockUnidad);

      const resultado = await service.agregarHabitante(unidadId, edificioId, {
        nombreCompleto: 'Pedro Gómez',
        fechaNacimiento: fechaAdulto.toISOString().split('T')[0],
        condicion: 'arrendatario',
        esContactoPrincipal: true,
      } as any);

      expect(resultado.personas.length).toBe(2);
      expect(resultado.personas[0].esContactoPrincipal).toBe(false);
      expect(resultado.personas[1].nombreCompleto).toBe('Pedro Gómez');
      expect(resultado.personas[1].esContactoPrincipal).toBe(true);
    });

    it('debe lanzar NotFoundException si el inmueble no existe', async () => {
      mockCensoModel.findOne.mockResolvedValue(null);

      await expect(
        service.agregarHabitante(unidadId, edificioId, {
          nombreCompleto: 'Laura Ruiz',
          fechaNacimiento: '1995-05-10',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el nombre completo está vacío', async () => {
      const mockUnidad = {
        _id: new Types.ObjectId(unidadId),
        edificioId: new Types.ObjectId(edificioId),
        personas: [],
      };
      mockCensoModel.findOne.mockResolvedValue(mockUnidad);

      await expect(
        service.agregarHabitante(unidadId, edificioId, {
          nombreCompleto: '   ',
          fechaNacimiento: '1995-05-10',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si la fecha de nacimiento falta o es inválida', async () => {
      const mockUnidad = {
        _id: new Types.ObjectId(unidadId),
        edificioId: new Types.ObjectId(edificioId),
        personas: [],
      };
      mockCensoModel.findOne.mockResolvedValue(mockUnidad);

      await expect(
        service.agregarHabitante(unidadId, edificioId, {
          nombreCompleto: 'Laura Ruiz',
          fechaNacimiento: '',
        } as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.agregarHabitante(unidadId, edificioId, {
          nombreCompleto: 'Laura Ruiz',
          fechaNacimiento: 'fecha-no-valida',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar a un menor de edad registrado como propietario', async () => {
      const fechaMenor = new Date();
      fechaMenor.setFullYear(fechaMenor.getFullYear() - 12);

      const mockUnidad = {
        _id: new Types.ObjectId(unidadId),
        edificioId: new Types.ObjectId(edificioId),
        personas: [],
      };
      mockCensoModel.findOne.mockResolvedValue(mockUnidad);

      await expect(
        service.agregarHabitante(unidadId, edificioId, {
          nombreCompleto: 'Niño Propietario',
          fechaNacimiento: fechaMenor.toISOString().split('T')[0],
          condicion: 'propietario',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar a un menor de edad asignado como contacto principal', async () => {
      const fechaMenor = new Date();
      fechaMenor.setFullYear(fechaMenor.getFullYear() - 10);

      const mockUnidad = {
        _id: new Types.ObjectId(unidadId),
        edificioId: new Types.ObjectId(edificioId),
        personas: [],
      };
      mockCensoModel.findOne.mockResolvedValue(mockUnidad);

      await expect(
        service.agregarHabitante(unidadId, edificioId, {
          nombreCompleto: 'Niño Principal',
          fechaNacimiento: fechaMenor.toISOString().split('T')[0],
          condicion: 'conviviente',
          esContactoPrincipal: true,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Sincronización Bidireccional de Parqueaderos y Bodegas (update)', () => {
    const edificioId = new Types.ObjectId().toString();
    const unidadId = new Types.ObjectId().toString();

    it('debe actualizar inventario asignando nuevos parqueaderos y liberando los removidos', async () => {
      const unidadPrevia = {
        _id: new Types.ObjectId(unidadId),
        edificioId: new Types.ObjectId(edificioId),
        torre: 'Torre A',
        numeroApto: '502',
        parqueaderosAsignados: [{ numero: 'P-101', tipo: 'carro', esCubierto: true }],
        bodegasAsignadas: [],
      };

      const unidadActualizada = {
        ...unidadPrevia,
        parqueaderosAsignados: [{ numero: 'P-102', tipo: 'carro', esCubierto: true }],
      };

      const makeMockQuery = (val: any) => {
        const p: any = Promise.resolve(val);
        p.exec = jest.fn().mockResolvedValue(val);
        return p;
      };

      mockCensoModel.findOne.mockReturnValue(makeMockQuery(unidadPrevia));
      mockCensoModel.findOneAndUpdate.mockReturnValue(makeMockQuery(unidadActualizada));

      mockParqueaderoModel.updateMany.mockResolvedValue({ acknowledged: true });

      const res = await service.update(unidadId, edificioId, {
        parqueaderosAsignados: [{ numero: 'P-102', tipo: 'carro', esCubierto: true }],
      } as any);

      expect(res).toBeDefined();

      // Debe liberar P-101
      expect(mockParqueaderoModel.updateMany).toHaveBeenCalledWith(
        {
          edificioId: new Types.ObjectId(edificioId),
          numero: { $in: ['P-101'] },
        },
        { $set: { torreAsignada: '', aptoAsignado: '' } },
      );

      // Debe asignar P-102 a Torre A - Apto 502
      expect(mockParqueaderoModel.updateMany).toHaveBeenCalledWith(
        {
          edificioId: new Types.ObjectId(edificioId),
          numero: { $in: ['P-102'] },
        },
        {
          $set: {
            torreAsignada: 'Torre A',
            aptoAsignado: '502',
          },
        },
      );
    });

    it('debe actualizar inventario asignando nuevas bodegas y liberando las removidas', async () => {
      const makeMockQuery = (val: any) => {
        const p: any = Promise.resolve(val);
        p.exec = jest.fn().mockResolvedValue(val);
        return p;
      };

      const unidadPrevia = {
        _id: new Types.ObjectId(unidadId),
        edificioId: new Types.ObjectId(edificioId),
        torre: 'Torre B',
        numeroApto: '301',
        parqueaderosAsignados: [],
        bodegasAsignadas: [{ numero: 'B-01', ubicacion: 'Sótano 1' }],
      };

      const unidadActualizada = {
        ...unidadPrevia,
        bodegasAsignadas: [{ numero: 'B-02', ubicacion: 'Sótano 2' }],
      };

      mockCensoModel.findOne.mockReturnValue(makeMockQuery(unidadPrevia));
      mockCensoModel.findOneAndUpdate.mockReturnValue(makeMockQuery(unidadActualizada));

      mockBodegaModel.updateMany.mockResolvedValue({ acknowledged: true });

      const res = await service.update(unidadId, edificioId, {
        bodegasAsignadas: [{ numero: 'B-02', ubicacion: 'Sótano 2' }],
      } as any);

      expect(res).toBeDefined();

      // Debe liberar B-01
      expect(mockBodegaModel.updateMany).toHaveBeenCalledWith(
        {
          edificioId: new Types.ObjectId(edificioId),
          numero: { $in: ['B-01'] },
        },
        { $set: { torreAsignada: '', aptoAsignado: '' } },
      );

      // Debe asignar B-02
      expect(mockBodegaModel.updateMany).toHaveBeenCalledWith(
        {
          edificioId: new Types.ObjectId(edificioId),
          numero: { $in: ['B-02'] },
        },
        {
          $set: {
            torreAsignada: 'Torre B',
            aptoAsignado: '301',
          },
        },
      );
    });
  });

  describe('Consultas de Inventario', () => {
    const edificioId = new Types.ObjectId().toString();

    it('debe retornar inventario de parqueaderos ordenado', async () => {
      const mockList = [
        { numero: 'P-01', tipo: 'carro' },
        { numero: 'P-02', tipo: 'moto' },
      ];

      mockParqueaderoModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockList),
        }),
      });

      const res = await service.getInventarioParqueaderos(edificioId);
      expect(res).toEqual(mockList);
    });

    it('debe retornar inventario de bodegas ordenado', async () => {
      const mockList = [
        { numero: 'B-01', ubicacion: 'Piso 1' },
      ];

      mockBodegaModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockList),
        }),
      });

      const res = await service.getInventarioBodegas(edificioId);
      expect(res).toEqual(mockList);
    });
  });
});
