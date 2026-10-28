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
import { Propietario } from '../propietarios/propietario.schema';
import { Types } from 'mongoose';

describe('CensoService', () => {
  let service: CensoService;

  let mockCensoModel: any;
  let mockParqueaderoModel: any;
  let mockBodegaModel: any;
  let mockInvitacionModel: any;
  let mockPropietarioModel: any;

  beforeEach(async () => {
    mockCensoModel = {
      new: jest.fn(),
      constructor: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      bulkWrite: jest.fn().mockResolvedValue({ ok: 1 }),
      exec: jest.fn(),
    };

    mockParqueaderoModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      bulkWrite: jest.fn().mockResolvedValue({ ok: 1 }),
      exec: jest.fn(),
    };

    mockBodegaModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      bulkWrite: jest.fn().mockResolvedValue({ ok: 1 }),
      exec: jest.fn(),
    };

    mockPropietarioModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
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
        {
          provide: getModelToken(Propietario.name),
          useValue: mockPropietarioModel,
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

  describe('importarMasivo (Carga de Copropiedades y Casos Límite)', () => {
    const edificioId = new Types.ObjectId().toString();

    beforeEach(() => {
      mockCensoModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
    });

    it('debe autocoregregir menores de edad a convivientes y asegurar contacto principal adulto', async () => {
      const fechaMenor = new Date();
      fechaMenor.setFullYear(fechaMenor.getFullYear() - 15);
      const fechaAdulto = new Date();
      fechaAdulto.setFullYear(fechaAdulto.getFullYear() - 52);

      const dto = {
        inmuebles: [
          { numeroApto: '301', torre: 'Torre 1', coeficiente: 0.0014, tipoOcupacion: 'habitada' },
        ],
        residentes: [
          {
            torre: 'Torre 1',
            apto: '301',
            nombreCompleto: 'SAMUEL BUSTAMANTE',
            condicion: 'propietario' as const,
            esContactoPrincipal: true,
            fechaNacimiento: fechaMenor.toISOString().split('T')[0],
          },
          {
            torre: 'Torre 1',
            apto: '301',
            nombreCompleto: 'YON JAIRO BUSTAMANTE',
            condicion: 'propietario' as const,
            esContactoPrincipal: false,
            fechaNacimiento: fechaAdulto.toISOString().split('T')[0],
          },
        ],
      };

      const res = await service.importarMasivo(edificioId, dto as any);
      expect(res.inmueblesCreados).toBe(1);

      expect(mockCensoModel.bulkWrite).toHaveBeenCalledTimes(1);
      const ops = mockCensoModel.bulkWrite.mock.calls[0][0];
      expect(ops).toHaveLength(1);
      const doc = ops[0].insertOne.document;

      const menor = doc.personas.find((p: any) => p.nombreCompleto === 'SAMUEL BUSTAMANTE');
      const adulto = doc.personas.find((p: any) => p.nombreCompleto === 'YON JAIRO BUSTAMANTE');

      expect(menor.condicion).toBe('conviviente');
      expect(menor.esContactoPrincipal).toBe(false);
      expect(adulto.condicion).toBe('propietario');
      expect(adulto.esContactoPrincipal).toBe(true);
    });

    it('debe sanitizar placas vehiculares (incluyendo placas de 3 a 10 caracteres y fallbacks)', async () => {
      const dto = {
        inmuebles: [
          { numeroApto: '101', torre: '1', tipoOcupacion: 'habitada' },
        ],
        vehiculos: [
          { torre: 'Torre 1', apto: '101', tipo: 'carro', placa: 'ABC-123' },
          { torre: 'Torre 1', apto: '101', tipo: 'carro', placa: 'CYS' },
          { torre: 'Torre 1', apto: '101', tipo: 'moto', placa: 'ELECTRICA' },
          { torre: 'Torre 1', apto: '101', tipo: 'bicicleta' },
          { torre: 'Torre 1', apto: '101', tipo: 'carro', marca: 'GRIS', color: 'CXC-190' },
        ],
      };

      const res = await service.importarMasivo(edificioId, dto as any);
      expect(res.inmueblesCreados).toBe(1);

      const ops = mockCensoModel.bulkWrite.mock.calls[0][0];
      const doc = ops[0].insertOne.document;
      expect(doc.vehiculos).toHaveLength(5);

      const placas = doc.vehiculos.map((v: any) => v.placa);
      expect(placas).toContain('ABC123');
      expect(placas).toContain('CYS');
      expect(placas).toContain('ELECTRICA');
      expect(placas).toContain('BICSN');
      expect(placas).toContain('CXC190');

      for (const v of doc.vehiculos) {
        expect(typeof v.placa).toBe('string');
        expect(v.placa.length).toBeGreaterThanOrEqual(3);
        expect(v.placa.length).toBeLessThanOrEqual(10);
      }
    });

    it('debe omitir filas vacías de parqueaderos, bodegas y vehículos sin lanzar error', async () => {
      const dto = {
        inmuebles: [
          { numeroApto: '102', torre: '1', tipoOcupacion: 'habitada' },
        ],
        parqueaderos: [
          { numeroParqueadero: '', torreAsignada: '1', aptoAsignado: '102' },
        ],
        bodegas: [
          { numeroBodega: '   ', torreAsignada: '1', aptoAsignado: '102' },
        ],
        vehiculos: [
          { torre: 'Torre 1', apto: '102', tipo: '', placa: '' },
        ],
      };

      const res = await service.importarMasivo(edificioId, dto as any);
      expect(res.inmueblesCreados).toBe(1);

      const ops = mockCensoModel.bulkWrite.mock.calls[0][0];
      const doc = ops[0].insertOne.document;
      expect(doc.vehiculos).toHaveLength(0);
      expect(mockParqueaderoModel.bulkWrite).not.toHaveBeenCalled();
      expect(mockBodegaModel.bulkWrite).not.toHaveBeenCalled();
    });
  });

  describe('Códigos de 5 letras por inmueble (validarCodigoCenso y responderConCodigoCenso)', () => {
    const edificioId = new Types.ObjectId().toString();

    it('generarCodigo5Letras debe producir exactamente 5 letras mayúsculas [A-Z]{5}', () => {
      const usados = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const cod = service.generarCodigo5Letras(usados);
        expect(cod).toMatch(/^[A-Z]{5}$/);
      }
      expect(usados.size).toBe(20);
    });

    it('validarCodigoCenso debe aceptar códigos en minúsculas o mayúsculas y retornar los datos del inmueble', async () => {
      const unidadId = new Types.ObjectId();
      mockInvitacionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            codigo: 'KRPWM',
            token: 'tok-123',
            expiraEn: new Date(Date.now() + 86400000),
            utilizado: false,
            inmueblePredefinido: 'Ámsterdam - Apto 101A',
            censoUnidadId: unidadId,
            edificioId: { _id: edificioId, nombre: 'CR Rivera del Valle' },
          }),
        }),
      });

      mockCensoModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: unidadId,
          identificador: 'Ámsterdam - Apto 101A',
          torre: 'Ámsterdam',
          numeroApto: '101A',
          personas: [{ nombreCompleto: 'Gonzalo Ortiz', condicion: 'propietario', esContactoPrincipal: true }],
          mascotas: [],
          vehiculos: [],
        }),
      });

      const res = await service.validarCodigoCenso(edificioId, 'krpwm');
      expect(res.valido).toBe(true);
      expect(res.codigo).toBe('KRPWM');
      expect(res.inmueblePredefinido).toBe('Ámsterdam - Apto 101A');
      expect(res.unidad?.personas[0].nombreCompleto).toBe('Gonzalo Ortiz');
    });

    it('responderConCodigoCenso debe rechazar si se intenta modificar otro inmueble distinto al del código', async () => {
      const unidadId = new Types.ObjectId();
      mockInvitacionModel.findOne.mockImplementation(() => ({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            codigo: 'ABCDE',
            token: 'tok-abc',
            expiraEn: new Date(Date.now() + 86400000),
            utilizado: false,
            inmueblePredefinido: 'Ámsterdam - Apto 101A',
            censoUnidadId: unidadId,
            edificioId: { _id: edificioId, nombre: 'CR Rivera del Valle' },
          }),
        }),
        exec: jest.fn().mockResolvedValue({
          codigo: 'ABCDE',
          token: 'tok-abc',
          expiraEn: new Date(Date.now() + 86400000),
          utilizado: false,
          inmueblePredefinido: 'Ámsterdam - Apto 101A',
          censoUnidadId: unidadId,
          save: jest.fn(),
        }),
      }));

      mockCensoModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: unidadId,
          identificador: 'Ámsterdam - Apto 101A',
          torre: 'Ámsterdam',
          numeroApto: '101A',
          personas: [],
        }),
      });

      await expect(
        service.responderConCodigoCenso(edificioId, 'abcde', {
          identificador: 'Ámsterdam - Apto 999Z',
          personas: [],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('validarCodigoCenso debe permitir múltiples usos si la invitación sigue vigente (menos de 7 días)', async () => {
      const unidadId = new Types.ObjectId();
      mockInvitacionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            codigo: 'MULTI',
            token: 'tok-multi',
            expiraEn: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // vigencia 6 días restantes
            utilizado: true, // ya se usó previamente
            usos: 2,
            inmueblePredefinido: 'Ámsterdam - Apto 101A',
            censoUnidadId: unidadId,
            edificioId: { _id: edificioId, nombre: 'CR Rivera del Valle' },
          }),
        }),
      });

      mockCensoModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: unidadId,
          identificador: 'Ámsterdam - Apto 101A',
          torre: 'Ámsterdam',
          numeroApto: '101A',
          personas: [{ nombreCompleto: 'Gonzalo Ortiz', condicion: 'propietario', esContactoPrincipal: true }],
        }),
      });

      const res = await service.validarCodigoCenso(edificioId, 'MULTI');
      expect(res.valido).toBe(true);
      expect(res.multiUso).toBe(true);
      expect(res.usos).toBe(2);
      expect(res.diasRestantes).toBeGreaterThan(0);
    });

    it('validarCodigoCenso debe rechazar si la invitación ya superó los 7 días de vigencia', async () => {
      mockInvitacionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            codigo: 'EXPIR',
            token: 'tok-expir',
            expiraEn: new Date(Date.now() - 1000), // expirada hace 1 segundo
            utilizado: false,
            inmueblePredefinido: 'Ámsterdam - Apto 101A',
          }),
        }),
      });

      await expect(service.validarCodigoCenso(edificioId, 'EXPIR')).rejects.toThrow(BadRequestException);
    });

    it('rate limiting: debe permitir intentos fallidos hasta 20 veces y luego bloquear con HTTP 429', async () => {
      const testIp = '192.168.1.99';
      service.limpiarIntentosFallidos(testIp);

      mockInvitacionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null), // código inexistente
        }),
      });

      // Primeros 19 intentos fallidos lanzan NotFoundException (no 429)
      for (let i = 0; i < 19; i++) {
        await expect(service.validarCodigoCenso(edificioId, 'WRONG', testIp)).rejects.toThrow(NotFoundException);
      }

      // El intento 20 también falla con NotFoundException pero activa el bloqueo de rate limit
      await expect(service.validarCodigoCenso(edificioId, 'WRONG', testIp)).rejects.toThrow(NotFoundException);

      // El intento 21 es bloqueado de inmediato con HTTP 429 Too Many Requests
      await expect(service.validarCodigoCenso(edificioId, 'WRONG', testIp)).rejects.toThrow(
        /Demasiados intentos fallidos/,
      );

      // Limpiar al finalizar el test
      service.limpiarIntentosFallidos(testIp);
    });

    it('debe rechazar si dos vehículos en la misma solicitud reclaman el mismo número de parqueadero', async () => {
      mockCensoModel.findOne.mockResolvedValue(null);

      await expect(
        service.createFromPublic(edificioId, {
          identificador: 'Ámsterdam - Apto 102B',
          personas: [],
          vehiculos: [
            { tipo: 'Carro', placa: 'ABC123', parqueaEnEdificio: true, numeroParqueadero: 'M-020' },
            { tipo: 'Moto', placa: 'XYZ987', parqueaEnEdificio: true, numeroParqueadero: 'M-020' },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si un vehículo intenta asignar un parqueadero ya asignado a otro apartamento', async () => {
      mockCensoModel.findOne.mockResolvedValue(null);
      mockParqueaderoModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            numero: 'M-020',
            torreAsignada: 'Bogotá',
            aptoAsignado: '405E',
          },
        ]),
      });

      await expect(
        service.createFromPublic(edificioId, {
          identificador: 'Ámsterdam - Apto 102B',
          personas: [],
          vehiculos: [
            { tipo: 'Moto', placa: 'MYV53H', parqueaEnEdificio: true, numeroParqueadero: 'M-020' },
          ],
        } as any),
      ).rejects.toThrow(/ya se encuentra asignado a Bogotá Apto 405E/);
    });
  });

});
