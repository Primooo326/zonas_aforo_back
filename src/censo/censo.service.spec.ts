import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CensoService, calcularEdad, categorizarEdad } from './censo.service';
import { CensoUnidad } from './censo.schema';
import { Types } from 'mongoose';

describe('CensoService', () => {
  let service: CensoService;

  const mockCensoModel = {
    new: jest.fn(),
    constructor: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CensoService,
        {
          provide: getModelToken(CensoUnidad.name),
          useValue: mockCensoModel,
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
});
