import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateInmuebleDto } from './create-inmueble.dto';

describe('CreateInmuebleDto', () => {
  const validBase = {
    tipo: 'inmueble',
    transaccion: 'venta',
    precio: 250000000,
    telefono: '+573001234567',
  };

  it('debe validar DTO válido mínimo', async () => {
    const dto = plainToInstance(CreateInmuebleDto, validBase);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('debe validar DTO completo con campos condicionales inmueble', async () => {
    const dto = plainToInstance(CreateInmuebleDto, {
      ...validBase,
      tipo: 'inmueble',
      metrosCuadrados: 80,
      piso: 3,
      parqueadero: true,
      balcon: true,
      deposito: false,
      amoblado: true,
      observacion: 'Hermoso apartamento con vista',
      emailContacto: 'test@test.com',
      imagenes: ['/uploads/img1.jpg'],
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('debe validar parqueadero con cubierto', async () => {
    const dto = plainToInstance(CreateInmuebleDto, {
      tipo: 'parqueadero',
      transaccion: 'arriendo',
      precio: 200000,
      telefono: '3001234567',
      cubierto: true,
      piso: 1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('debe validar habitacion con amoblado y balcon', async () => {
    const dto = plainToInstance(CreateInmuebleDto, {
      tipo: 'habitacion',
      transaccion: 'arriendo',
      precio: 800000,
      telefono: '3001234567',
      amoblado: true,
      balcon: false,
      metrosCuadrados: 15,
      piso: 2,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('debe fallar si tipo inválido', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...validBase, tipo: 'casa' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('tipo');
  });

  it('debe fallar si transaccion inválida', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...validBase, transaccion: 'permuta' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'transaccion')).toBe(true);
  });

  it('debe fallar si precio <=0', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...validBase, precio: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'precio')).toBe(true);
  });

  it('debe fallar si telefono inválido', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...validBase, telefono: 'abc' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'telefono')).toBe(true);
  });

  it('debe fallar si telefono muy corto', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...validBase, telefono: '123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'telefono')).toBe(true);
  });

  it('debe fallar si emailContacto inválido', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...validBase, emailContacto: 'no-email' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'emailContacto')).toBe(true);
  });

  it('debe fallar si observacion >1000 caracteres', async () => {
    const dto = plainToInstance(CreateInmuebleDto, {
      ...validBase,
      observacion: 'a'.repeat(1001),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'observacion')).toBe(true);
  });

  it('debe pasar si observacion exactamente 1000 caracteres', async () => {
    const dto = plainToInstance(CreateInmuebleDto, {
      ...validBase,
      observacion: 'a'.repeat(1000),
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('debe fallar si imagenes no es array de strings', async () => {
    const dto = plainToInstance(CreateInmuebleDto, {
      ...validBase,
      imagenes: [123 as any],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'imagenes')).toBe(true);
  });

  it('debe fallar si metrosCuadrados <=0', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...validBase, metrosCuadrados: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'metrosCuadrados')).toBe(true);
  });
});
