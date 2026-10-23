import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import mongoose, { Types } from 'mongoose';
import { generarMockCensoExcel } from './generar-censo-mock';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://admin:mi_password_seguro@127.0.0.1:27017/zonas_aforo?authSource=admin';
const TARGET_EMAIL = 'juanskate326@gmail.com';

function normalizarTorre(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return `Torre ${s}`;
  if (s.length === 1 && /^[a-zA-Z]$/.test(s)) return `Torre ${s.toUpperCase()}`;
  return s;
}

function parseBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (!val) return false;
  const s = String(val).trim().toUpperCase();
  return s === 'SI' || s === 'SÍ' || s === 'TRUE' || s === '1' || s === 'YES';
}

function parseNumber(val: unknown): number | undefined {
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  if (!val) return undefined;
  const cleaned = String(val).replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

export async function subirCensoMock(targetCount: number = 750) {
  console.log('====================================================');
  console.log(`CARGADOR DE CENSO MOCK (${targetCount} INMUEBLES)`);
  console.log('====================================================');

  const excelPath = path.resolve(__dirname, `../data/censo_mock_${targetCount}.xlsx`);
  if (!fs.existsSync(excelPath)) {
    console.log(`Archivo no encontrado en ${excelPath}. Generándolo ahora...`);
    generarMockCensoExcel(excelPath, targetCount);
  }

  console.log(`Leyendo archivo Excel: ${excelPath}`);
  const wb = XLSX.readFile(excelPath);
  const sheetNames = wb.SheetNames;
  console.log(`Hojas encontradas en el libro: [${sheetNames.join(', ')}]`);

  // 1. Parsear Hoja Inmuebles
  const wsInm = wb.Sheets['Inmuebles'];
  if (!wsInm) throw new Error('No se encontró la hoja "Inmuebles" en el archivo Excel.');
  const rawInmuebles: any[] = XLSX.utils.sheet_to_json(wsInm, { defval: '' });
  console.log(`Filas leídas en "Inmuebles": ${rawInmuebles.length}`);

  // 2. Parsear Hoja Residentes
  const wsRes = wb.Sheets['Residentes'];
  const rawResidentes: any[] = wsRes ? XLSX.utils.sheet_to_json(wsRes, { defval: '' }) : [];
  console.log(`Filas leídas en "Residentes": ${rawResidentes.length}`);

  // 3. Parsear Hoja Mascotas
  const wsMas = wb.Sheets['Mascotas'];
  const rawMascotas: any[] = wsMas ? XLSX.utils.sheet_to_json(wsMas, { defval: '' }) : [];
  console.log(`Filas leídas en "Mascotas": ${rawMascotas.length}`);

  // 4. Parsear Hoja Vehículos
  const wsVeh = wb.Sheets['Vehículos'] || wb.Sheets['Vehiculos'];
  const rawVehiculos: any[] = wsVeh ? XLSX.utils.sheet_to_json(wsVeh, { defval: '' }) : [];
  console.log(`Filas leídas en "Vehículos": ${rawVehiculos.length}`);

  // 5. Parsear Hoja Parqueaderos
  const wsParq = wb.Sheets['Parqueaderos'];
  const rawParqueaderos: any[] = wsParq ? XLSX.utils.sheet_to_json(wsParq, { defval: '' }) : [];
  console.log(`Filas leídas en "Parqueaderos": ${rawParqueaderos.length}`);

  // 6. Parsear Hoja Bodegas
  const wsBod = wb.Sheets['Bodegas'];
  const rawBodegas: any[] = wsBod ? XLSX.utils.sheet_to_json(wsBod, { defval: '' }) : [];
  console.log(`Filas leídas en "Bodegas": ${rawBodegas.length}`);

  // Conectar a MongoDB
  console.log(`\nConectando a MongoDB en: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}...`);
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No se pudo obtener la instancia de base de datos de MongoDB.');

  // Resolver Edificio
  let edificio = await db.collection('edificios').findOne({ email: TARGET_EMAIL });
  if (!edificio) {
    // Intentar buscar cualquier edificio
    edificio = await db.collection('edificios').findOne({});
  }
  if (!edificio) {
    throw new Error('No se encontró ningún edificio en la colección "edificios".');
  }

  const edificioId = edificio._id as Types.ObjectId;
  console.log(`Edificio objetivo: "${edificio.nombre}" (${edificio.email}) - ID: ${edificioId}`);

  // Limpiar censo anterior del edificio
  console.log('\nLimpiando datos previos de censo para este edificio...');
  const resDelCenso = await db.collection('censounidads').deleteMany({ edificioId });
  const resDelParq = await db.collection('parqueaderoinventarios').deleteMany({ edificioId });
  const resDelBod = await db.collection('bodegainventarios').deleteMany({ edificioId });
  console.log(`- censounidads eliminadas: ${resDelCenso.deletedCount}`);
  console.log(`- parqueaderoinventarios eliminados: ${resDelParq.deletedCount}`);
  console.log(`- bodegainventarios eliminados: ${resDelBod.deletedCount}`);

  // Mapear Parqueaderos por unidad
  const parqueaderosPorUnidad = new Map<string, Array<{ numero: string; tipo: string; esCubierto: boolean }>>();
  const docsParqueaderoInventario: any[] = [];
  const now = new Date();

  for (const p of rawParqueaderos) {
    const num = String(p.Numero_Parqueadero || p.numero || '').trim().toUpperCase();
    if (!num) continue;
    const torre = normalizarTorre(String(p.Torre_Asignada || p.torre || ''));
    const apto = String(p.Apto_Asignado || p.apto || '').trim();
    const esVis = parseBoolean(p.Es_Visitante || p.esVisitante);
    const rawTipo = String(p.Tipo || p.tipo || 'Carro').trim().toLowerCase();
    const tipo = rawTipo.includes('moto') ? 'moto' : rawTipo.includes('bici') ? 'bicicleta' : 'carro';
    const esCub = p.Es_Cubierto !== undefined ? parseBoolean(p.Es_Cubierto) : true;

    docsParqueaderoInventario.push({
      _id: new Types.ObjectId(),
      edificioId,
      numero: num,
      tipo,
      esVisitante: esVis,
      esCubierto: esCub,
      ...(torre ? { torreAsignada: torre } : {}),
      ...(apto ? { aptoAsignado: apto } : {}),
      createdAt: now,
      updatedAt: now,
    });

    if (torre && apto) {
      const key = `${torre.toLowerCase()}:::${apto.toLowerCase()}`;
      if (!parqueaderosPorUnidad.has(key)) parqueaderosPorUnidad.set(key, []);
      parqueaderosPorUnidad.get(key)!.push({
        numero: num,
        tipo,
        esCubierto: esCub,
      });
    }
  }

  // Mapear Bodegas por unidad
  const bodegasPorUnidad = new Map<string, Array<{ numero: string; ubicacion?: string; metrosCuadrados?: number }>>();
  const docsBodegaInventario: any[] = [];

  for (const b of rawBodegas) {
    const num = String(b.Numero_Bodega || b.numero || '').trim().toUpperCase();
    if (!num) continue;
    const torre = normalizarTorre(String(b.Torre_Asignada || b.torre || ''));
    const apto = String(b.Apto_Asignado || b.apto || '').trim();
    const ubicacion = String(b.Ubicacion || b.ubicacion || '').trim() || undefined;
    const m2 = parseNumber(b.Metros_Cuadrados || b.metrosCuadrados);

    docsBodegaInventario.push({
      _id: new Types.ObjectId(),
      edificioId,
      numero: num,
      ubicacion,
      metrosCuadrados: m2,
      ...(torre ? { torreAsignada: torre } : {}),
      ...(apto ? { aptoAsignado: apto } : {}),
      createdAt: now,
      updatedAt: now,
    });

    if (torre && apto) {
      const key = `${torre.toLowerCase()}:::${apto.toLowerCase()}`;
      if (!bodegasPorUnidad.has(key)) bodegasPorUnidad.set(key, []);
      bodegasPorUnidad.get(key)!.push({
        numero: num,
        ubicacion,
        metrosCuadrados: m2,
      });
    }
  }

  // Mapear Residentes por unidad
  const residentesPorUnidad = new Map<string, any[]>();
  for (const r of rawResidentes) {
    const nom = String(r['Nombre Completo'] || r.nombreCompleto || '').trim();
    if (!nom) continue;
    const torre = normalizarTorre(String(r.Torre || r.torre || ''));
    const apto = String(r.Apto || r.apto || '').trim();
    const rawCond = String(r.Condición || r.condicion || '').toLowerCase();
    const condicion = rawCond.includes('prop')
      ? 'propietario'
      : rawCond.includes('arrend')
        ? 'arrendatario'
        : 'conviviente';

    const esPrincipal = parseBoolean(r['Contacto Principal'] || r.esContactoPrincipal);
    const doc = String(r.Documento || r.documento || '').trim() || undefined;
    const tel = String(r.Teléfono || r.telefono || '').replace(/\D/g, '') || undefined;
    const email = String(r['Correo Electrónico'] || r.email || '').trim().toLowerCase() || undefined;

    let fechaNac: Date | undefined = undefined;
    const rawFecha = String(r['Fecha Nacimiento'] || r.fechaNacimiento || '').trim();
    if (rawFecha) {
      const d = new Date(rawFecha);
      if (!isNaN(d.getTime())) fechaNac = d;
    }

    const resObj = {
      nombreCompleto: nom,
      documento: doc,
      condicion,
      esContactoPrincipal: esPrincipal,
      ...(fechaNac ? { fechaNacimiento: fechaNac } : {}),
      ...(tel && tel.length >= 7 ? { telefono: tel } : {}),
      ...(email && email.includes('@') ? { email } : {}),
      discapacidad: false,
    };

    const key = `${torre.toLowerCase()}:::${apto.toLowerCase()}`;
    if (!residentesPorUnidad.has(key)) residentesPorUnidad.set(key, []);
    residentesPorUnidad.get(key)!.push(resObj);
  }

  // Mapear Mascotas por unidad
  const mascotasPorUnidad = new Map<string, any[]>();
  for (const m of rawMascotas) {
    const nom = String(m.Nombre || m.nombre || '').trim();
    if (!nom) continue;
    const torre = normalizarTorre(String(m.Torre || m.torre || ''));
    const apto = String(m.Apto || m.apto || '').trim();
    const rawTipo = String(m.Tipo || m.tipo || 'perro').trim().toLowerCase();
    const tipo = rawTipo.includes('gato') ? 'gato' : rawTipo.includes('perr') ? 'perro' : 'otro';
    const raza = String(m.Raza || m.raza || 'Mestizo').trim();
    const esPeligroso = parseBoolean(m['Manejo Especial (Peligrosa)'] || m.esPeligroso);
    const vacunas = m['Vacunas al Día'] !== undefined ? parseBoolean(m['Vacunas al Día']) : true;
    const obs = String(m.Observaciones || m.observaciones || '').trim() || undefined;

    const masObj = {
      tipo,
      nombre: nom,
      raza,
      esPeligroso,
      esManejoEspecial: esPeligroso,
      vacunasAlDia: vacunas,
      observaciones: obs,
    };

    const key = `${torre.toLowerCase()}:::${apto.toLowerCase()}`;
    if (!mascotasPorUnidad.has(key)) mascotasPorUnidad.set(key, []);
    mascotasPorUnidad.get(key)!.push(masObj);
  }

  // Mapear Vehículos por unidad
  const vehiculosPorUnidad = new Map<string, any[]>();
  for (const v of rawVehiculos) {
    const rawPlaca = String(v.Placa || v.placa || '').trim().toUpperCase().replace(/[\s\-]/g, '');
    const torre = normalizarTorre(String(v.Torre || v.torre || ''));
    const apto = String(v.Apto || v.apto || '').trim();
    const rawTipo = String(v.Tipo || v.tipo || 'carro').trim().toLowerCase();
    const tipo = rawTipo.includes('moto') ? 'moto' : rawTipo.includes('bici') ? 'bicicleta' : 'carro';

    let placaFinal = rawPlaca;
    if (!placaFinal) {
      if (tipo === 'bicicleta') placaFinal = 'BIC-SN';
      else if (tipo === 'moto') placaFinal = `MOT-SN-${apto}`;
      else placaFinal = `VEH-SN-${apto}`;
    }

    const vehObj = {
      tipo,
      placa: placaFinal,
      marca: String(v.Marca || v.marca || '').trim() || undefined,
      modelo: String(v.Modelo || v.modelo || '').trim() || undefined,
      color: String(v.Color || v.color || '').trim() || undefined,
      parqueaEnEdificio: parseBoolean(v['Parquea en Edificio'] || v.parqueaEnEdificio),
      numeroParqueadero: String(v['N° Parqueadero'] || v.numeroParqueadero || '').trim() || undefined,
      esPropietarioResidente: true,
    };

    const key = `${torre.toLowerCase()}:::${apto.toLowerCase()}`;
    if (!vehiculosPorUnidad.has(key)) vehiculosPorUnidad.set(key, []);
    vehiculosPorUnidad.get(key)!.push(vehObj);
  }

  // Construir documentos CensoUnidad
  console.log('\nConstruyendo unidades del censo...');
  const docsCensoUnidad: any[] = [];

  for (const inm of rawInmuebles) {
    const torre = normalizarTorre(String(inm.Torre || inm.torre || ''));
    const numApto = String(inm.Apto_Casa || inm.numeroApto || inm.Apto || '').trim();
    if (!numApto) continue;

    const identificador = torre ? `${torre} - Apto ${numApto}` : `Apto ${numApto}`;
    const piso = parseNumber(inm.Piso || inm.piso);
    const cuartos = parseNumber(inm.Cuartos || inm.cuartos);
    const banos = parseNumber(inm.Banos || inm.banos);
    const tieneBalcon = parseBoolean(inm.Tiene_Balcon || inm.tieneBalcon);
    const tienePatio = parseBoolean(inm.Tiene_Patio || inm.tienePatio);
    const metrosCuadrados = parseNumber(inm.Metros_Cuadrados || inm.metrosCuadrados);
    const coeficiente = parseNumber(inm.Coeficiente || inm.coeficiente);
    const rawOcup = String(inm.Tipo_Ocupacion || inm.tipoOcupacion || '').toLowerCase();
    const tipoOcupacion = rawOcup.includes('desoc') ? 'desocupada' : 'habitada';

    const unitKey = `${torre.toLowerCase()}:::${numApto.toLowerCase()}`;
    const parqueaderosAsignados = parqueaderosPorUnidad.get(unitKey) || [];
    const bodegasAsignadas = bodegasPorUnidad.get(unitKey) || [];
    const personas = residentesPorUnidad.get(unitKey) || [];
    const mascotas = mascotasPorUnidad.get(unitKey) || [];
    const vehiculos = vehiculosPorUnidad.get(unitKey) || [];

    // Garantizar un único contacto principal
    if (personas.length > 0) {
      let principalEncontrado = false;
      for (const p of personas) {
        if (p.esContactoPrincipal) {
          if (!principalEncontrado) principalEncontrado = true;
          else p.esContactoPrincipal = false;
        }
      }
      if (!principalEncontrado) personas[0].esContactoPrincipal = true;
    }

    docsCensoUnidad.push({
      _id: new Types.ObjectId(),
      edificioId,
      identificador,
      torre: torre || undefined,
      numeroApto: numApto,
      piso,
      cuartos,
      banos,
      tieneBalcon,
      metrosCuadrados,
      tienePatio,
      coeficiente,
      tipoOcupacion,
      parqueaderosAsignados,
      bodegasAsignadas,
      personas,
      mascotas,
      vehiculos,
      estado: 'aprobado',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Insertar en MongoDB
  console.log(`\nInsertando en MongoDB:`);
  console.log(`- ${docsParqueaderoInventario.length} parqueaderos en "parqueaderoinventarios"...`);
  if (docsParqueaderoInventario.length > 0) {
    await db.collection('parqueaderoinventarios').insertMany(docsParqueaderoInventario);
  }

  console.log(`- ${docsBodegaInventario.length} bodegas en "bodegainventarios"...`);
  if (docsBodegaInventario.length > 0) {
    await db.collection('bodegainventarios').insertMany(docsBodegaInventario);
  }

  console.log(`- ${docsCensoUnidad.length} unidades en "censounidads"...`);
  if (docsCensoUnidad.length > 0) {
    // Insertar en lotes de 250 para asegurar performance óptimo
    const batchSize = 250;
    for (let i = 0; i < docsCensoUnidad.length; i += batchSize) {
      const batch = docsCensoUnidad.slice(i, i + batchSize);
      await db.collection('censounidads').insertMany(batch);
      console.log(`  * Lote ${Math.floor(i / batchSize) + 1} insertado (${batch.length} unidades)`);
    }
  }

  // Verificación directa en base de datos
  console.log('\n====================================================');
  console.log('VERIFICACIÓN EN MONGODB TRAS LA CARGA');
  console.log('====================================================');

  const countUnidades = await db.collection('censounidads').countDocuments({ edificioId });
  const countParqueaderos = await db.collection('parqueaderoinventarios').countDocuments({ edificioId });
  const countBodegas = await db.collection('bodegainventarios').countDocuments({ edificioId });

  // Agregaciones de verificación
  const statsAggregation = await db.collection('censounidads').aggregate([
    { $match: { edificioId } },
    {
      $group: {
        _id: null,
        totalHabitadas: {
          $sum: { $cond: [{ $eq: ['$tipoOcupacion', 'habitada'] }, 1, 0] },
        },
        totalDesocupadas: {
          $sum: { $cond: [{ $eq: ['$tipoOcupacion', 'desocupada'] }, 1, 0] },
        },
        totalPersonas: { $sum: { $size: '$personas' } },
        totalMascotas: { $sum: { $size: '$mascotas' } },
        totalVehiculos: { $sum: { $size: '$vehiculos' } },
        torresDistintas: { $addToSet: '$torre' },
      },
    },
  ]).toArray();

  const stats = statsAggregation[0] || {};

  console.log(`TOTAL INMUEBLES INSERTADOS: ${countUnidades}`);
  console.log(`- Habitados: ${stats.totalHabitadas}`);
  console.log(`- Desocupados: ${stats.totalDesocupadas}`);
  console.log(`- Torres cubiertas (${stats.torresDistintas?.length}): [${stats.torresDistintas?.join(', ')}]`);
  console.log(`TOTAL PERSONAS RESIDENTES: ${stats.totalPersonas}`);
  console.log(`TOTAL MASCOTAS REGISTRADAS: ${stats.totalMascotas}`);
  console.log(`TOTAL VEHÍCULOS REGISTRADOS: ${stats.totalVehiculos}`);
  console.log(`TOTAL INVENTARIO PARQUEADEROS: ${countParqueaderos}`);
  console.log(`TOTAL INVENTARIO BODEGAS: ${countBodegas}`);
  console.log('====================================================\n');

  await mongoose.disconnect();
  console.log('Conexión a MongoDB cerrada con éxito.');

  return {
    countUnidades,
    countParqueaderos,
    countBodegas,
    stats,
  };
}

// Ejecución directa si se invoca por CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const targetCount = args[0] ? parseInt(args[0], 10) : 750;
  subirCensoMock(targetCount)
    .then(() => {
      console.log('¡Proceso completado con éxito!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error durante la carga:', err);
      process.exit(1);
    });
}
