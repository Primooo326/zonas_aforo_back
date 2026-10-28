import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PropietariosService } from './propietarios.service';
import { Propietario } from './propietario.schema';
import { CensoUnidad, InvitacionCenso } from '../censo/censo.schema';
import { Edificio } from '../edificios/edificio.schema';

describe('PropietariosService', () => {
  let service: PropietariosService;

  const mockPropietarioModel: any = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockCensoModel: any = {
    findOne: jest.fn(),
    findById: jest.fn(),
  };

  const mockInvitacionModel: any = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockEdificioModel: any = {
    findById: jest.fn(),
  };

  const mockJwtService: any = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropietariosService,
        { provide: getModelToken(Propietario.name), useValue: mockPropietarioModel },
        { provide: getModelToken(CensoUnidad.name), useValue: mockCensoModel },
        { provide: getModelToken(InvitacionCenso.name), useValue: mockInvitacionModel },
        { provide: getModelToken(Edificio.name), useValue: mockEdificioModel },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<PropietariosService>(PropietariosService);
  });

  describe('validarInvitacion', () => {
    it('debe validar exitosamente usando un código de 5 letras', async () => {
      const edId = new Types.ObjectId();
      const unidadId = new Types.ObjectId();
      mockInvitacionModel.findOne.mockResolvedValue({
        token: 'tok-123',
        codigo: 'NISMJ',
        expiraEn: new Date(Date.now() + 86400000),
        edificioId: edId,
        censoUnidadId: unidadId,
      });

      mockEdificioModel.findById.mockResolvedValue({ nombre: 'CR Rivera del Valle' });
      mockCensoModel.findById.mockResolvedValue({
        _id: unidadId,
        identificador: 'Ámsterdam - Apto 102B',
        personas: [{ nombreCompleto: 'Juan Morales', email: 'juanskate326@gmail.com', esContactoPrincipal: true }],
      });

      const res = await service.validarInvitacion('NISMJ');
      expect(res.valido).toBe(true);
      expect(res.codigo).toBe('NISMJ');
      expect(res.email).toBe('juanskate326@gmail.com');
      expect(res.inmueblePredefinido).toBe('Ámsterdam - Apto 102B');
    });

    it('debe rechazar si el código o token ha expirado', async () => {
      mockInvitacionModel.findOne.mockResolvedValue({
        token: 'tok-exp',
        codigo: 'OLD55',
        expiraEn: new Date(Date.now() - 1000),
      });

      await expect(service.validarInvitacion('OLD55')).rejects.toThrow(BadRequestException);
    });
  });

  describe('activarORecuperar', () => {
    it('debe activar cuenta de residente y definir contraseña con código de 5 letras', async () => {
      const edId = new Types.ObjectId();
      const unidadId = new Types.ObjectId();
      const invDoc: any = {
        token: 'tok-123',
        codigo: 'NISMJ',
        expiraEn: new Date(Date.now() + 86400000),
        edificioId: edId,
        censoUnidadId: unidadId,
        usos: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      mockInvitacionModel.findOne.mockResolvedValue(invDoc);
      mockCensoModel.findById.mockResolvedValue({
        _id: unidadId,
        identificador: 'Ámsterdam - Apto 102B',
        personas: [{ nombreCompleto: 'Juan Morales', email: 'juanskate326@gmail.com', esContactoPrincipal: true }],
      });

      mockPropietarioModel.findOne.mockResolvedValue(null);
      mockPropietarioModel.create.mockResolvedValue({
        _id: new Types.ObjectId(),
        nombre: 'Juan Morales',
        email: 'juanskate326@gmail.com',
        edificioId: edId,
        censoUnidadId: unidadId,
        estado: 'activo',
        tipoResidente: 'propietario',
      });

      const res = await service.activarORecuperar({
        email: 'juanskate326@gmail.com',
        codigoCenso: 'NISMJ',
        password: 'nuevaPassword123',
      });

      expect(res.access_token).toBe('mock-jwt-token');
      expect(res.propietario.email).toBe('juanskate326@gmail.com');
      expect(res.propietario.estado).toBe('activo');
      expect(invDoc.usos).toBe(1);
    });
  });

  describe('login', () => {
    it('debe avisar claramente si el correo está en el censo pero aún no ha sido activado', async () => {
      mockPropietarioModel.findOne.mockResolvedValue(null);
      mockCensoModel.findOne.mockResolvedValue({
        identificador: 'Ámsterdam - Apto 102B',
        personas: [{ email: 'juanskate326@gmail.com' }],
      });

      await expect(
        service.login({
          email: 'juanskate326@gmail.com',
          password: 'cualquierPassword',
        }),
      ).rejects.toThrow(/Tu apartamento está registrado en el censo pero tu cuenta aún no ha sido activada/);
    });
  });
});
