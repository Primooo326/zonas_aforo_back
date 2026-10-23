import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// Constantes y Catálogos de Nombres y Datos
export const TODAS_LAS_TORRES = [
  'Bogotá',
  'Madrid',
  'Tokio',
  'París',
  'Londres',
  'Roma',
  'Buenos Aires',
  'Berlín',
  'Ottawa',
  'Santiago',
  'Lisboa',
  'Viena',
  'Ámsterdam',
  'Praga',
  'Estocolmo',
];

const NOMBRES = [
  'Carlos', 'María', 'Juan', 'Ana', 'Andrés', 'Laura', 'Felipe', 'Valentina',
  'Diego', 'Camila', 'Santiago', 'Daniela', 'Mateo', 'Sofia', 'Sebastián',
  'Juliana', 'Alejandro', 'Carolina', 'Gabriel', 'Paula', 'Nicolás', 'Mariana',
  'Fernando', 'Andrea', 'David', 'Lucía', 'Esteban', 'Natalia', 'Javier', 'Elena',
  'Pedro', 'Gabriela', 'Rodrigo', 'Diana', 'Manuel', 'Sara', 'Lucas', 'Patricia',
  'Gonzalo', 'Marcela', 'Mauricio', 'Claudia', 'Ricardo', 'Beatriz', 'Héctor', 'Gloria'
];

const APELLIDOS = [
  'Rodríguez', 'González', 'Martínez', 'Gómez', 'López', 'Hernández', 'Pérez',
  'García', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Vargas', 'Castro',
  'Morales', 'Ríos', 'Ortiz', 'Gutiérrez', 'Mendoza', 'Rojas', 'Silva',
  'Navarro', 'Guerrero', 'Medina', 'Cortés', 'Jiménez', 'Cabrera', 'Romero',
  'Herrera', 'Acosta', 'Vásquez', 'Cardona', 'Pinzón', 'Blandón', 'Montoya'
];

const RAZAS_PELIGROSAS = [
  'Pitbull Terrier',
  'Rottweiler',
  'Dóberman',
  'Dogo Argentino',
  'Bull Terrier',
  'Staffordshire Terrier',
  'Fila Brasileiro',
];

const RAZAS_NO_PELIGROSAS = [
  'Golden Retriever',
  'Labrador',
  'Criollo',
  'Poodle',
  'Schnauzer',
  'Beagle',
  'Bulldog Francés',
  'Pastor Alemán',
  'Pug',
  'Husky Siberiano',
  'Border Collie',
  'Yorkshire Terrier',
  'Shih Tzu',
  'Cocker Spaniel',
];

const RAZAS_GATOS = [
  'Común Europeo',
  'Siamés',
  'Persa',
  'Angora',
  'Bengalí',
  'Maine Coon',
  'Criollo',
];

const NOMBRES_MASCOTAS = [
  'Max', 'Luna', 'Rocky', 'Bella', 'Toby', 'Milo', 'Simba', 'Lola',
  'Zeus', 'Coco', 'Thor', 'Mia', 'Bruno', 'Nala', 'Kira', 'Lucas',
  'Maya', 'Sasha', 'Leo', 'Bimba', 'Duque', 'Pelusa', 'Sammy', 'Chester',
  'Canela', 'Apolo', 'Princesa', 'Boby', 'Tommy', 'Kiara'
];

const MARCAS_CARRO = ['Toyota', 'Chevrolet', 'Renault', 'Mazda', 'Nissan', 'Kia', 'Volkswagen', 'Ford', 'Hyundai', 'BMW', 'Suzuki', 'BYD'];
const MARCAS_MOTO = ['Yamaha', 'Bajaj', 'Honda', 'Suzuki', 'KTM', 'AKT', 'Kawasaki', 'BMW', 'Hero'];
const MARCAS_BICI = ['Trek', 'Specialized', 'GW', 'Giant', 'Scott', 'Cannondale', 'Venzo', 'Cliff'];
const COLORES = ['Blanco', 'Gris', 'Negro', 'Rojo', 'Azul', 'Plata', 'Vino Tinto', 'Verde', 'Grafito'];

// Funciones Auxiliares
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function padZero(num: number, len: number = 3): string {
  return String(num).padStart(len, '0');
}

function generarPlacaCarro(): string {
  const letras = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const l1 = randomItem(letras.split(''));
  const l2 = randomItem(letras.split(''));
  const l3 = randomItem(letras.split(''));
  const num = randomInt(100, 999);
  return `${l1}${l2}${l3}${num}`;
}

function generarPlacaMoto(): string {
  const letras = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const l1 = randomItem(letras.split(''));
  const l2 = randomItem(letras.split(''));
  const l3 = randomItem(letras.split(''));
  const num = randomInt(10, 99);
  const lFinal = randomItem(letras.split(''));
  return `${l1}${l2}${l3}${num}${lFinal}`;
}

function generarFechaNacimiento(tipo: 'menor' | 'adulto' | 'adulto_mayor'): { fecha: string; edad: number } {
  const hoy = new Date();
  let edad: number;
  if (tipo === 'menor') {
    edad = randomInt(3, 17);
  } else if (tipo === 'adulto_mayor') {
    edad = randomInt(60, 85);
  } else {
    edad = randomInt(20, 58);
  }

  const anio = hoy.getFullYear() - edad;
  const mes = String(randomInt(1, 12)).padStart(2, '0');
  const dia = String(randomInt(1, 28)).padStart(2, '0');
  return { fecha: `${anio}-${mes}-${dia}`, edad };
}

function generarTelefono(): string {
  const prefijos = ['310', '311', '312', '313', '314', '315', '320', '321', '300', '301', '302', '316', '318'];
  return `${randomItem(prefijos)}${randomInt(1000000, 9999999)}`;
}

export interface MockDatasetOutput {
  inmuebles: any[];
  residentes: any[];
  mascotas: any[];
  vehiculos: any[];
  parqueaderos: any[];
  bodegas: any[];
}

export function generarMockCensoExcel(outputPath: string, targetCount: number = 750): MockDatasetOutput {
  console.log(`Iniciando generación de dataset mock para ${targetCount} apartamentos...`);

  const pisosPorTorre = 10;
  const aptosPorPiso = 5;
  const letrasApto = ['A', 'B', 'C', 'D', 'E'];
  const numTorresNecesarias = Math.ceil(targetCount / (pisosPorTorre * aptosPorPiso));
  const torresSeleccionadas = TODAS_LAS_TORRES.slice(0, numTorresNecesarias);

  interface InmuebleDef {
    torre: string;
    numeroApto: string;
    identificador: string;
    piso: number;
    cuartos: number;
    banos: number;
    tieneBalcon: boolean;
    metrosCuadrados: number;
    tienePatio: boolean;
    coeficiente: number;
    tipoOcupacion: 'Habitada' | 'Desocupada';
    esArriendo: boolean;
    parqueaderosAsignados: string[];
    biciAsignada?: string;
    bodegaAsignada?: string;
  }

  const inmuebles: InmuebleDef[] = [];

  for (const torre of torresSeleccionadas) {
    for (let p = 1; p <= pisosPorTorre; p++) {
      for (let a = 0; a < aptosPorPiso; a++) {
        if (inmuebles.length >= targetCount) break;
        const letra = letrasApto[a];
        const numApto = `${p}${padZero(a + 1, 2)}${letra}`; // ej: 101A, ..., 1005E
        const identificador = `${torre} - Apto ${numApto}`;

        const cuartos = a === 0 || a === 1 ? 3 : 2;
        const banos = cuartos === 3 ? 2 : (a === 2 ? 2 : 1);
        const tieneBalcon = p > 1;
        const tienePatio = p === 1;
        const metrosCuadrados = Number((cuartos === 3 ? 70.0 + (a * 3.5) : 54.0 + (a * 2.5)).toFixed(1));
        const coeficiente = Number((1 / targetCount).toFixed(6));

        inmuebles.push({
          torre,
          numeroApto: numApto,
          identificador,
          piso: p,
          cuartos,
          banos,
          tieneBalcon,
          metrosCuadrados,
          tienePatio,
          coeficiente,
          tipoOcupacion: 'Habitada',
          esArriendo: false,
          parqueaderosAsignados: [],
        });
      }
    }
  }

  // 2 desocupados por torre en piso 10 (1004D y 1005E)
  for (const torre of torresSeleccionadas) {
    const desocupadosTorre = inmuebles.filter(
      (i) => i.torre === torre && (i.numeroApto === '1004D' || i.numeroApto === '1005E')
    );
    for (const d of desocupadosTorre) {
      d.tipoOcupacion = 'Desocupada';
    }
  }

  const ocupados = inmuebles.filter((i) => i.tipoOcupacion === 'Habitada');
  // 70% en arriendo, 30% propietarios
  const cantArriendo = Math.round(ocupados.length * 0.70);
  for (let i = 0; i < ocupados.length; i++) {
    ocupados[i].esArriendo = i < cantArriendo;
  }

  console.log(`Inmuebles: ${inmuebles.length} totales (${ocupados.length} habitados: ${cantArriendo} en arriendo, ${ocupados.length - cantArriendo} propietarios, ${inmuebles.length - ocupados.length} desocupados).`);

  // PARQUEADEROS
  // Escalado proporcional a 750 (o targetCount)
  // 750 aptos -> 255 Carros privados, 85 Motos privadas, 25 Carros visitantes, 10 Motos visitantes, 50 Bicicletas
  const cantCarrosPriv = Math.round(targetCount * 0.34); // 255 para 750
  const cantMotosPriv = Math.round(targetCount * 0.1133); // 85 para 750
  const cantCarrosVis = Math.round(targetCount * 0.0333); // 25 para 750
  const cantMotosVis = Math.round(targetCount * 0.0133); // 10 para 750
  const cantBicis = Math.round(targetCount * 0.0667); // 50 para 750

  const cuposCarroPrivados: string[] = [];
  for (let i = 1; i <= cantCarrosPriv; i++) cuposCarroPrivados.push(`P-${padZero(i, 3)}`);

  const cuposMotoPrivadas: string[] = [];
  for (let i = 1; i <= cantMotosPriv; i++) cuposMotoPrivadas.push(`M-${padZero(i, 3)}`);

  const cuposBiciComunales: string[] = [];
  for (let i = 1; i <= cantBicis; i++) cuposBiciComunales.push(`BICI-${padZero(i, 3)}`);

  // Asignar cupos privados a unidades ocupadas
  // 1. Unidades con 3 cupos (2 carros + 1 moto): 8 unidades
  const cant3Cupos = Math.min(8, Math.floor(cantMotosPriv * 0.1));
  let idxCarro = 0;
  let idxMoto = 0;
  let idxOcupado = 0;

  for (let k = 0; k < cant3Cupos; k++) {
    const u = ocupados[idxOcupado++];
    const c1 = cuposCarroPrivados[idxCarro++];
    const c2 = cuposCarroPrivados[idxCarro++];
    const m1 = cuposMotoPrivadas[idxMoto++];
    u.parqueaderosAsignados.push(c1, c2, m1);
  }

  // 2. Unidades con 2 cupos:
  // 20 con 1 carro + 1 moto
  const cant2CuposCarroMoto = 20;
  for (let k = 0; k < cant2CuposCarroMoto; k++) {
    const u = ocupados[idxOcupado++];
    const c1 = cuposCarroPrivados[idxCarro++];
    const m1 = cuposMotoPrivadas[idxMoto++];
    u.parqueaderosAsignados.push(c1, m1);
  }

  // 15 con 2 carros
  const cant2Cupos2Carros = 15;
  for (let k = 0; k < cant2Cupos2Carros; k++) {
    const u = ocupados[idxOcupado++];
    const c1 = cuposCarroPrivados[idxCarro++];
    const c2 = cuposCarroPrivados[idxCarro++];
    u.parqueaderosAsignados.push(c1, c2);
  }

  // 3. Unidades con 1 cupo:
  // Resto de carros privados
  while (idxCarro < cuposCarroPrivados.length && idxOcupado < ocupados.length) {
    const u = ocupados[idxOcupado++];
    const c1 = cuposCarroPrivados[idxCarro++];
    u.parqueaderosAsignados.push(c1);
  }

  // Resto de motos privadas
  while (idxMoto < cuposMotoPrivadas.length && idxOcupado < ocupados.length) {
    const u = ocupados[idxOcupado++];
    const m1 = cuposMotoPrivadas[idxMoto++];
    u.parqueaderosAsignados.push(m1);
  }

  // Bicicletas comunales
  for (let k = 0; k < cuposBiciComunales.length && k < ocupados.length; k++) {
    ocupados[k].biciAsignada = cuposBiciComunales[k];
  }

  console.log(`Parqueaderos privados asignados: ${idxCarro} carros y ${idxMoto} motos.`);

  interface ParqueaderoRow {
    Numero_Parqueadero: string;
    Torre_Asignada: string;
    Apto_Asignado: string;
    Es_Visitante: string;
    Tipo: string;
    Es_Cubierto: string;
  }

  const filasParqueaderos: ParqueaderoRow[] = [];

  for (const c of cuposCarroPrivados) {
    const asignadoA = ocupados.find((u) => u.parqueaderosAsignados.includes(c));
    filasParqueaderos.push({
      Numero_Parqueadero: c,
      Torre_Asignada: asignadoA ? asignadoA.torre : '',
      Apto_Asignado: asignadoA ? asignadoA.numeroApto : '',
      Es_Visitante: 'NO',
      Tipo: 'Carro',
      Es_Cubierto: 'SI',
    });
  }

  for (const m of cuposMotoPrivadas) {
    const asignadoA = ocupados.find((u) => u.parqueaderosAsignados.includes(m));
    filasParqueaderos.push({
      Numero_Parqueadero: m,
      Torre_Asignada: asignadoA ? asignadoA.torre : '',
      Apto_Asignado: asignadoA ? asignadoA.numeroApto : '',
      Es_Visitante: 'NO',
      Tipo: 'Moto',
      Es_Cubierto: 'SI',
    });
  }

  for (let v = 1; v <= cantCarrosVis; v++) {
    filasParqueaderos.push({
      Numero_Parqueadero: `V-${padZero(v, 2)}`,
      Torre_Asignada: '',
      Apto_Asignado: '',
      Es_Visitante: 'SI',
      Tipo: 'Carro',
      Es_Cubierto: 'NO',
    });
  }

  for (let vm = 1; vm <= cantMotosVis; vm++) {
    filasParqueaderos.push({
      Numero_Parqueadero: `VM-${padZero(vm, 2)}`,
      Torre_Asignada: '',
      Apto_Asignado: '',
      Es_Visitante: 'SI',
      Tipo: 'Moto',
      Es_Cubierto: 'NO',
    });
  }

  for (let b = 1; b <= cuposBiciComunales.length; b++) {
    const numBici = cuposBiciComunales[b - 1];
    const asignadoA = ocupados.find((u) => u.biciAsignada === numBici);
    filasParqueaderos.push({
      Numero_Parqueadero: numBici,
      Torre_Asignada: asignadoA ? asignadoA.torre : '',
      Apto_Asignado: asignadoA ? asignadoA.numeroApto : '',
      Es_Visitante: 'NO',
      Tipo: 'Bicicleta',
      Es_Cubierto: 'SI',
    });
  }

  // BODEGAS (30 por torre, primeros 30 aptos de cada torre)
  interface BodegaRow {
    Numero_Bodega: string;
    Torre_Asignada: string;
    Apto_Asignado: string;
    Ubicacion: string;
    Metros_Cuadrados: number;
  }

  const filasBodegas: BodegaRow[] = [];
  const ubicacionesBodega = ['Sótano 1', 'Sótano 2', 'Piso 1'];
  let numBodega = 1;

  for (const torre of torresSeleccionadas) {
    const aptosTorre = inmuebles.filter((i) => i.torre === torre).slice(0, 30);
    for (const apto of aptosTorre) {
      const codBodega = `B-${padZero(numBodega, 3)}`;
      apto.bodegaAsignada = codBodega;
      filasBodegas.push({
        Numero_Bodega: codBodega,
        Torre_Asignada: torre,
        Apto_Asignado: apto.numeroApto,
        Ubicacion: randomItem(ubicacionesBodega),
        Metros_Cuadrados: Number((2.5 + (numBodega % 4) * 0.8).toFixed(1)),
      });
      numBodega++;
    }
  }

  console.log(`Bodegas creadas y asignadas: ${filasBodegas.length}`);

  // RESIDENTES
  interface ResidenteRow {
    'Unidad / Apto': string;
    Torre: string;
    Apto: string;
    'Nombre Completo': string;
    Documento: string;
    Condición: string;
    'Contacto Principal': string;
    'Fecha Nacimiento': string;
    Edad: number;
    'Categoría Edad': string;
    Teléfono: string;
    'Correo Electrónico': string;
  }

  const filasResidentes: ResidenteRow[] = [];
  let docSecuencia = 10001001;

  for (const u of ocupados) {
    const apellidoFamilia = randomItem(APELLIDOS);

    if (u.esArriendo) {
      // Propietario no residente
      const apellidoProp = randomItem(APELLIDOS);
      const nombreProp = `${randomItem(NOMBRES)} ${apellidoProp}`;
      const nacProp = generarFechaNacimiento('adulto');
      filasResidentes.push({
        'Unidad / Apto': u.identificador,
        Torre: u.torre,
        Apto: u.numeroApto,
        'Nombre Completo': nombreProp,
        Documento: String(docSecuencia++),
        Condición: 'Propietario',
        'Contacto Principal': 'No',
        'Fecha Nacimiento': nacProp.fecha,
        Edad: nacProp.edad,
        'Categoría Edad': 'Adulto',
        Teléfono: generarTelefono(),
        'Correo Electrónico': `${nombreProp.toLowerCase().replace(/[^a-z]/g, '')}${randomInt(10, 99)}@gmail.com`,
      });

      // Familia Arrendataria: 1 a 4 personas
      const numPersonas = randomInt(1, 4);
      for (let pIdx = 0; pIdx < numPersonas; pIdx++) {
        const esCabeza = pIdx === 0;
        let tipoEdad: 'menor' | 'adulto' | 'adulto_mayor';
        if (esCabeza) {
          tipoEdad = Math.random() < 0.25 ? 'adulto_mayor' : 'adulto';
        } else if (pIdx === 1) {
          tipoEdad = Math.random() < 0.6 ? 'menor' : (Math.random() < 0.3 ? 'adulto_mayor' : 'adulto');
        } else {
          tipoEdad = Math.random() < 0.7 ? 'menor' : 'adulto';
        }

        const nac = generarFechaNacimiento(tipoEdad);
        const cat = nac.edad < 18 ? 'Menor de edad' : nac.edad >= 60 ? 'Adulto mayor' : 'Adulto';
        const nombreRes = `${randomItem(NOMBRES)} ${apellidoFamilia}`;

        filasResidentes.push({
          'Unidad / Apto': u.identificador,
          Torre: u.torre,
          Apto: u.numeroApto,
          'Nombre Completo': nombreRes,
          Documento: String(docSecuencia++),
          Condición: esCabeza ? 'Arrendatario' : 'Conviviente / Familiar',
          'Contacto Principal': esCabeza ? 'Sí' : 'No',
          'Fecha Nacimiento': nac.fecha,
          Edad: nac.edad,
          'Categoría Edad': cat,
          Teléfono: nac.edad >= 18 ? generarTelefono() : '',
          'Correo Electrónico': nac.edad >= 18 ? `${nombreRes.toLowerCase().replace(/[^a-z]/g, '')}${randomInt(10, 99)}@outlook.com` : '',
        });
      }
    } else {
      // Inmueble de Propietarios Residentes: 1 a 4 personas
      const numPersonas = randomInt(1, 4);
      for (let pIdx = 0; pIdx < numPersonas; pIdx++) {
        const esCabeza = pIdx === 0;
        let tipoEdad: 'menor' | 'adulto' | 'adulto_mayor';
        if (esCabeza) {
          tipoEdad = Math.random() < 0.3 ? 'adulto_mayor' : 'adulto';
        } else if (pIdx === 1) {
          tipoEdad = Math.random() < 0.6 ? 'menor' : 'adulto';
        } else {
          tipoEdad = Math.random() < 0.7 ? 'menor' : 'adulto';
        }

        const nac = generarFechaNacimiento(tipoEdad);
        const cat = nac.edad < 18 ? 'Menor de edad' : nac.edad >= 60 ? 'Adulto mayor' : 'Adulto';
        const nombreRes = `${randomItem(NOMBRES)} ${apellidoFamilia}`;

        filasResidentes.push({
          'Unidad / Apto': u.identificador,
          Torre: u.torre,
          Apto: u.numeroApto,
          'Nombre Completo': nombreRes,
          Documento: String(docSecuencia++),
          Condición: esCabeza ? 'Propietario' : 'Conviviente / Familiar',
          'Contacto Principal': esCabeza ? 'Sí' : 'No',
          'Fecha Nacimiento': nac.fecha,
          Edad: nac.edad,
          'Categoría Edad': cat,
          Teléfono: nac.edad >= 18 ? generarTelefono() : '',
          'Correo Electrónico': nac.edad >= 18 ? `${nombreRes.toLowerCase().replace(/[^a-z]/g, '')}${randomInt(10, 99)}@gmail.com` : '',
        });
      }
    }
  }

  console.log(`Residentes generados: ${filasResidentes.length}`);

  // MASCOTAS (50% de las unidades habitadas)
  interface MascotaRow {
    'Unidad / Apto': string;
    Torre: string;
    Apto: string;
    Tipo: string;
    Nombre: string;
    Raza: string;
    'Manejo Especial (Peligrosa)': string;
    'Vacunas al Día': string;
    Observaciones: string;
  }

  const filasMascotas: MascotaRow[] = [];
  const cantUnidadesConMascotas = Math.round(ocupados.length * 0.5);
  const unidadesConMascotas = ocupados.slice(0, cantUnidadesConMascotas);

  for (const u of unidadesConMascotas) {
    const numMascotas = randomInt(1, 3);
    for (let m = 0; m < numMascotas; m++) {
      const nombreMascota = randomItem(NOMBRES_MASCOTAS);
      const randPeligro = Math.random();
      const esPeligroso = randPeligro < (0.5 / 3); // ~16.7%

      let tipo = 'Perro';
      let raza = '';
      let obs = '';

      if (esPeligroso) {
        tipo = 'Perro';
        raza = randomItem(RAZAS_PELIGROSAS);
        obs = 'Póliza de responsabilidad civil vigente y bozal reglamentario';
      } else {
        const randTipo = Math.random();
        if (randTipo < 0.65) {
          tipo = 'Perro';
          raza = randomItem(RAZAS_NO_PELIGROSAS);
        } else if (randTipo < 0.95) {
          tipo = 'Gato';
          raza = randomItem(RAZAS_GATOS);
        } else {
          tipo = 'Otro';
          raza = 'Conejo Enano';
        }
      }

      const vacunasAlDia = Math.random() < 0.94 ? 'Sí' : 'No';
      if (vacunasAlDia === 'No') {
        obs = obs ? `${obs} - Pendiente refuerzo anual` : 'Pendiente refuerzo anual de vacunación';
      }

      filasMascotas.push({
        'Unidad / Apto': u.identificador,
        Torre: u.torre,
        Apto: u.numeroApto,
        Tipo: tipo,
        Nombre: nombreMascota,
        Raza: raza,
        'Manejo Especial (Peligrosa)': esPeligroso ? 'Sí' : 'No',
        'Vacunas al Día': vacunasAlDia,
        Observaciones: obs,
      });
    }
  }

  console.log(`Mascotas generadas: ${filasMascotas.length}`);

  // VEHÍCULOS (unidades habitadas)
  // 80% con 1, 10% con 2, 10% con 3
  interface VehiculoRow {
    'Unidad / Apto': string;
    Torre: string;
    Apto: string;
    Tipo: string;
    Placa: string;
    Marca: string;
    Modelo: string;
    Color: string;
    'Parquea en Edificio': string;
    'N° Parqueadero': string;
  }

  const filasVehiculos: VehiculoRow[] = [];
  const corte1Veh = Math.round(ocupados.length * 0.80);
  const corte2Veh = Math.round(ocupados.length * 0.90);

  for (let idx = 0; idx < ocupados.length; idx++) {
    const u = ocupados[idx];
    let cantidadVehiculos = 1;
    if (idx >= corte1Veh && idx < corte2Veh) {
      cantidadVehiculos = 2;
    } else if (idx >= corte2Veh) {
      cantidadVehiculos = 3;
    }

    const cuposCarroDisponibles = u.parqueaderosAsignados.filter((c) => c.startsWith('P-'));
    const cuposMotoDisponibles = u.parqueaderosAsignados.filter((c) => c.startsWith('M-'));
    let tieneBiciCupo = !!u.biciAsignada;

    for (let v = 0; v < cantidadVehiculos; v++) {
      let tipoVehiculo: 'Carro' | 'Moto' | 'Bicicleta';

      if (v === 0 && cuposCarroDisponibles.length > 0) {
        tipoVehiculo = 'Carro';
      } else if (v === 0 && cuposMotoDisponibles.length > 0) {
        tipoVehiculo = 'Moto';
      } else if (v === 1 && cuposMotoDisponibles.length > 0) {
        tipoVehiculo = 'Moto';
      } else if (v === 1 && cuposCarroDisponibles.length > 1) {
        tipoVehiculo = 'Carro';
      } else {
        const r = Math.random();
        tipoVehiculo = r < 0.6 ? 'Carro' : (r < 0.85 ? 'Moto' : 'Bicicleta');
      }

      let placa = '';
      let marca = '';
      let modelo = String(randomInt(2014, 2025));
      let color = randomItem(COLORES);
      let parqueaAdentro = 'No';
      let numParqueadero = '';

      if (tipoVehiculo === 'Carro') {
        placa = generarPlacaCarro();
        marca = randomItem(MARCAS_CARRO);
        if (cuposCarroDisponibles.length > 0) {
          parqueaAdentro = 'Sí';
          numParqueadero = cuposCarroDisponibles.shift()!;
        }
      } else if (tipoVehiculo === 'Moto') {
        placa = generarPlacaMoto();
        marca = randomItem(MARCAS_MOTO);
        if (cuposMotoDisponibles.length > 0) {
          parqueaAdentro = 'Sí';
          numParqueadero = cuposMotoDisponibles.shift()!;
        }
      } else {
        placa = `BIC-${randomInt(100, 999)}`;
        marca = randomItem(MARCAS_BICI);
        modelo = String(randomInt(2019, 2025));
        if (tieneBiciCupo) {
          parqueaAdentro = 'Sí';
          numParqueadero = u.biciAsignada!;
          tieneBiciCupo = false;
        }
      }

      filasVehiculos.push({
        'Unidad / Apto': u.identificador,
        Torre: u.torre,
        Apto: u.numeroApto,
        Tipo: tipoVehiculo,
        Placa: placa,
        Marca: marca,
        Modelo: modelo,
        Color: color,
        'Parquea en Edificio': parqueaAdentro,
        'N° Parqueadero': numParqueadero,
      });
    }
  }

  console.log(`Vehículos generados: ${filasVehiculos.length}`);

  // COMPILAR LIBRO EXCEL CON LAS 6 HOJAS
  const wb = XLSX.utils.book_new();

  // Hoja 1: Inmuebles
  const dataInmueblesAoa = [
    [
      'Torre',
      'Apto_Casa',
      'Piso',
      'Cuartos',
      'Banos',
      'Tiene_Balcon',
      'Metros_Cuadrados',
      'Tiene_Patio',
      'Coeficiente',
      'Tipo_Ocupacion',
    ],
    ...inmuebles.map((i) => [
      i.torre,
      i.numeroApto,
      i.piso,
      i.cuartos,
      i.banos,
      i.tieneBalcon ? 'SI' : 'NO',
      i.metrosCuadrados,
      i.tienePatio ? 'SI' : 'NO',
      i.coeficiente,
      i.tipoOcupacion,
    ]),
  ];
  const wsInmuebles = XLSX.utils.aoa_to_sheet(dataInmueblesAoa);
  wsInmuebles['!cols'] = [
    { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
    { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInmuebles, 'Inmuebles');

  // Hoja 2: Residentes
  const wsResidentes = XLSX.utils.json_to_sheet(filasResidentes);
  wsResidentes['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 14 },
    { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 18 },
    { wch: 16 }, { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResidentes, 'Residentes');

  // Hoja 3: Mascotas
  const wsMascotas = XLSX.utils.json_to_sheet(filasMascotas);
  wsMascotas['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
    { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMascotas, 'Mascotas');

  // Hoja 4: Vehículos
  const wsVehiculos = XLSX.utils.json_to_sheet(filasVehiculos);
  wsVehiculos['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsVehiculos, 'Vehículos');

  // Hoja 5: Parqueaderos
  const wsParqueaderos = XLSX.utils.json_to_sheet(filasParqueaderos);
  wsParqueaderos['!cols'] = [
    { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsParqueaderos, 'Parqueaderos');

  // Hoja 6: Bodegas
  const wsBodegas = XLSX.utils.json_to_sheet(filasBodegas);
  wsBodegas['!cols'] = [
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsBodegas, 'Bodegas');

  // Asegurar directorio destino
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Escribir archivo XLSX
  XLSX.writeFile(wb, outputPath);
  console.log(`¡Libro Excel generado con éxito en: ${outputPath}!`);

  return {
    inmuebles,
    residentes: filasResidentes,
    mascotas: filasMascotas,
    vehiculos: filasVehiculos,
    parqueaderos: filasParqueaderos,
    bodegas: filasBodegas,
  };
}

// Ejecución directa si se invoca por CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const targetCount = args[0] ? parseInt(args[0], 10) : 750;
  const fileName = `censo_mock_${targetCount}.xlsx`;
  const targetFile = path.resolve(__dirname, `../data/${fileName}`);
  generarMockCensoExcel(targetFile, targetCount);

  // Copia también a la raíz de zonas_aforo para conveniencia
  const rootTarget = path.resolve(__dirname, `../../${fileName}`);
  fs.copyFileSync(targetFile, rootTarget);
  console.log(`Copia duplicada en la raíz: ${rootTarget}`);
}
