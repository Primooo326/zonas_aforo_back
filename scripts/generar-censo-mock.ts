import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// Constantes y Catálogos de Nombres y Datos
const TORRES = [
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
];

const NOMBRES = [
  'Carlos', 'María', 'Juan', 'Ana', 'Andrés', 'Laura', 'Felipe', 'Valentina',
  'Diego', 'Camila', 'Santiago', 'Daniela', 'Mateo', 'Sofia', 'Sebastián',
  'Juliana', 'Alejandro', 'Carolina', 'Gabriel', 'Paula', 'Nicolás', 'Mariana',
  'Fernando', 'Andrea', 'David', 'Lucía', 'Esteban', 'Natalia', 'Javier', 'Elena',
  'Pedro', 'Gabriela', 'Rodrigo', 'Diana', 'Manuel', 'Sara', 'Lucas', 'Patricia'
];

const APELLIDOS = [
  'Rodríguez', 'González', 'Martínez', 'Gómez', 'López', 'Hernández', 'Pérez',
  'García', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Vargas', 'Castro',
  'Morales', 'Ríos', 'Ortiz', 'Gutiérrez', 'Mendoza', 'Rojas', 'Silva',
  'Navarro', 'Guerrero', 'Medina', 'Cortés', 'Jiménez', 'Cabrera', 'Romero'
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
  'Maya', 'Sasha', 'Leo', 'Bimba', 'Duque', 'Pelusa', 'Sammy', 'Chester'
];

const MARCAS_CARRO = ['Toyota', 'Chevrolet', 'Renault', 'Mazda', 'Nissan', 'Kia', 'Volkswagen', 'Ford', 'Hyundai', 'BMW'];
const MARCAS_MOTO = ['Yamaha', 'Bajaj', 'Honda', 'Suzuki', 'KTM', 'AKT', 'Kawasaki', 'BMW'];
const MARCAS_BICI = ['Trek', 'Specialized', 'GW', 'Giant', 'Scott', 'Cannondale', 'Venzo'];
const COLORES = ['Blanco', 'Gris', 'Negro', 'Rojo', 'Azul', 'Plata', 'Vino Tinto'];

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
  const prefijos = ['310', '311', '312', '313', '314', '315', '320', '321', '300', '301', '302'];
  return `${randomItem(prefijos)}${randomInt(1000000, 9999999)}`;
}

export function generarMockCensoExcel(outputPath: string) {
  console.log('Iniciando generación de dataset mock para 500 apartamentos...');

  // 1. GENERAR 500 INMUEBLES
  const totalTorres = TORRES.length; // 10
  const pisosPorTorre = 10;
  const aptosPorPiso = 5;
  const letrasApto = ['A', 'B', 'C', 'D', 'E'];

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
    parqueaderosAsignados: string[]; // ['P-001', 'M-002']
    biciAsignada?: string; // 'BICI-001'
    bodegaAsignada?: string; // 'B-001'
  }

  const inmuebles: InmuebleDef[] = [];

  for (const torre of TORRES) {
    for (let p = 1; p <= pisosPorTorre; p++) {
      for (let a = 0; a < aptosPorPiso; a++) {
        const letra = letrasApto[a];
        const numApto = `${p}${padZero(a + 1, 2)}${letra}`; // ej: 101A, 102B, ..., 1001A
        const identificador = `${torre} - Apto ${numApto}`;

        const cuartos = a === 0 || a === 1 ? 3 : 2;
        const banos = cuartos === 3 ? 2 : (a === 2 ? 2 : 1);
        const tieneBalcon = p > 1;
        const tienePatio = p === 1;
        const metrosCuadrados = Number((cuartos === 3 ? 70.0 + (a * 3.5) : 54.0 + (a * 2.5)).toFixed(1));
        const coeficiente = Number((1 / 500).toFixed(4));

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

  // Marcar 20 desocupados (exactamente 2 por torre en el piso 10: 1004D y 1005E)
  for (const torre of TORRES) {
    const desocupadosTorre = inmuebles.filter(
      (i) => i.torre === torre && (i.numeroApto === '1004D' || i.numeroApto === '1005E')
    );
    for (const d of desocupadosTorre) {
      d.tipoOcupacion = 'Desocupada';
    }
  }

  // De los 480 ocupados: 70% en arriendo = 336 aptos, 30% propietarios = 144 aptos
  const ocupados = inmuebles.filter((i) => i.tipoOcupacion === 'Habitada');
  // Marcamos los primeros 336 como arriendo
  for (let i = 0; i < ocupados.length; i++) {
    ocupados[i].esArriendo = i < 336;
  }

  console.log(`Inmuebles: ${inmuebles.length} totales (480 habitados: 336 en arriendo, 144 propietarios, 20 desocupados).`);

  // 2. GENERAR PARQUEADEROS (285 TOTALES)
  // 170 Carros privados: P-001 a P-170
  // 55 Motos privadas: M-001 a M-055
  // 18 Carros visitantes: V-001 a V-018
  // 7 Motos visitantes: VM-001 a VM-007
  // 35 Bicicletas comunales: BICI-001 a BICI-035

  const cuposCarroPrivados: string[] = [];
  for (let i = 1; i <= 170; i++) cuposCarroPrivados.push(`P-${padZero(i, 3)}`);

  const cuposMotoPrivadas: string[] = [];
  for (let i = 1; i <= 55; i++) cuposMotoPrivadas.push(`M-${padZero(i, 3)}`);

  const cuposBiciComunales: string[] = [];
  for (let i = 1; i <= 35; i++) cuposBiciComunales.push(`BICI-${padZero(i, 3)}`);

  // Asignar los 225 cupos privados a los 480 ocupados:
  // - 5 inmuebles con 3 cupos (2 carros + 1 moto = 10 carros + 5 motos)
  // - 25 inmuebles con 2 cupos:
  //     * 15 con 1 carro + 1 moto (15 carros + 15 motos)
  //     * 10 con 2 carros (20 carros)
  //     Total en este grupo: 35 carros + 15 motos
  // - 160 inmuebles con 1 cupo:
  //     * 125 con 1 carro (125 carros)
  //     * 35 con 1 moto (35 motos)
  // Total carros asignados: 10 + 35 + 125 = 170 (100% de carros privados asignados)
  // Total motos asignadas: 5 + 15 + 35 = 55 (100% de motos privadas asignadas)
  // Total cupos: 225 privados.

  let idxCarro = 0;
  let idxMoto = 0;
  let idxOcupado = 0;

  // 5 unidades con 3 cupos
  for (let k = 0; k < 5; k++) {
    const u = ocupados[idxOcupado++];
    const c1 = cuposCarroPrivados[idxCarro++];
    const c2 = cuposCarroPrivados[idxCarro++];
    const m1 = cuposMotoPrivadas[idxMoto++];
    u.parqueaderosAsignados.push(c1, c2, m1);
  }

  // 15 unidades con 2 cupos (1 carro + 1 moto)
  for (let k = 0; k < 15; k++) {
    const u = ocupados[idxOcupado++];
    const c1 = cuposCarroPrivados[idxCarro++];
    const m1 = cuposMotoPrivadas[idxMoto++];
    u.parqueaderosAsignados.push(c1, m1);
  }

  // 10 unidades con 2 cupos (2 carros)
  for (let k = 0; k < 10; k++) {
    const u = ocupados[idxOcupado++];
    const c1 = cuposCarroPrivados[idxCarro++];
    const c2 = cuposCarroPrivados[idxCarro++];
    u.parqueaderosAsignados.push(c1, c2);
  }

  // 125 unidades con 1 carro
  for (let k = 0; k < 125; k++) {
    const u = ocupados[idxOcupado++];
    const c1 = cuposCarroPrivados[idxCarro++];
    u.parqueaderosAsignados.push(c1);
  }

  // 35 unidades con 1 moto
  for (let k = 0; k < 35; k++) {
    const u = ocupados[idxOcupado++];
    const m1 = cuposMotoPrivadas[idxMoto++];
    u.parqueaderosAsignados.push(m1);
  }

  // 35 unidades asignadas a bicicleta comunal
  for (let k = 0; k < 35; k++) {
    ocupados[k].biciAsignada = cuposBiciComunales[k];
  }

  console.log(`Parqueaderos privados asignados: ${idxCarro} carros y ${idxMoto} motos (Total 225).`);

  // Construir filas de Parqueaderos para Excel
  interface ParqueaderoRow {
    Numero_Parqueadero: string;
    Torre_Asignada: string;
    Apto_Asignado: string;
    Es_Visitante: string;
    Tipo: string;
    Es_Cubierto: string;
  }

  const filasParqueaderos: ParqueaderoRow[] = [];

  // 1. Carros privados
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

  // 2. Motos privadas
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

  // 3. Visitantes Carros (18)
  for (let v = 1; v <= 18; v++) {
    filasParqueaderos.push({
      Numero_Parqueadero: `V-${padZero(v, 2)}`,
      Torre_Asignada: '',
      Apto_Asignado: '',
      Es_Visitante: 'SI',
      Tipo: 'Carro',
      Es_Cubierto: 'NO',
    });
  }

  // 4. Visitantes Motos (7)
  for (let vm = 1; vm <= 7; vm++) {
    filasParqueaderos.push({
      Numero_Parqueadero: `VM-${padZero(vm, 2)}`,
      Torre_Asignada: '',
      Apto_Asignado: '',
      Es_Visitante: 'SI',
      Tipo: 'Moto',
      Es_Cubierto: 'NO',
    });
  }

  // 5. Bicicleteros comunales (35)
  for (let b = 1; b <= 35; b++) {
    const numBici = `BICI-${padZero(b, 3)}`;
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

  // 3. GENERAR BODEGAS (300 BODEGAS)
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
  // 30 bodegas asignadas por cada torre (primeros 30 aptos de cada torre = 300 aptos con bodega)
  for (const torre of TORRES) {
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

  // 4. GENERAR RESIDENTES (HOJA RESIDENTES)
  // Headers estándar compatibles:
  // Unidad / Apto | Torre | Apto | Nombre Completo | Documento | Condición | Contacto Principal | Fecha Nacimiento | Edad | Categoría Edad | Teléfono | Correo Electrónico
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
      // 1. Propietario (adulto no residente o de contacto de propiedad)
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
        'Correo Electrónico': `${nombreProp.toLowerCase().replace(/[^a-z]/g, '')}@gmail.com`,
      });

      // 2. Familia Arrendataria: 1 a 4 personas
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
          'Correo Electrónico': nac.edad >= 18 ? `${nombreRes.toLowerCase().replace(/[^a-z]/g, '')}${pIdx}@outlook.com` : '',
        });
      }
    } else {
      // Inmueble de Propietarios: 1 a 4 personas
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
          'Correo Electrónico': nac.edad >= 18 ? `${nombreRes.toLowerCase().replace(/[^a-z]/g, '')}${pIdx}@gmail.com` : '',
        });
      }
    }
  }

  console.log(`Residentes generados: ${filasResidentes.length}`);

  // 5. GENERAR MASCOTAS (50% de las 480 unidades ocupadas = 240 unidades con mascotas)
  // De 1 a 3 mascotas.
  // 0.5/3 (~16.7%) son perros de raza de manejo especial (peligrosa)
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
  // Seleccionamos 240 unidades ocupadas aleatorias o fijas
  const unidadesConMascotas = ocupados.slice(0, 240);

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

  // 6. GENERAR VEHÍCULOS (480 UNIDADES OCUPADAS TIENEN VEHÍCULOS)
  // - 80% con 1 vehículo (384 unidades)
  // - 10% con 2 vehículos (48 unidades)
  // - 10% con 3 vehículos (48 unidades)
  // Asociar con los parqueaderos asignados:
  // Si el tipo de vehículo coincide con un cupo asignado libre de la unidad -> Parquea en Edificio = 'Sí', N° Parqueadero = cupo
  // Si no coincide o se agotaron los cupos asignados -> Parquea en Edificio = 'No', N° Parqueadero = ''
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

  for (let idx = 0; idx < ocupados.length; idx++) {
    const u = ocupados[idx];
    let cantidadVehiculos = 1;
    if (idx >= 384 && idx < 432) {
      cantidadVehiculos = 2; // 48 unidades con 2
    } else if (idx >= 432) {
      cantidadVehiculos = 3; // 48 unidades con 3
    }

    // Copia mutable de cupos disponibles de esta unidad
    const cuposCarroDisponibles = u.parqueaderosAsignados.filter((c) => c.startsWith('P-'));
    const cuposMotoDisponibles = u.parqueaderosAsignados.filter((c) => c.startsWith('M-'));
    let tieneBiciCupo = !!u.biciAsignada;

    for (let v = 0; v < cantidadVehiculos; v++) {
      let tipoVehiculo: 'Carro' | 'Moto' | 'Bicicleta';

      // Si la unidad tiene cupo asignado, priorizar coincidir con el cupo
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
      let modelo = String(randomInt(2012, 2024));
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
        // Bicicleta
        placa = `BIC-${randomInt(100, 999)}`;
        marca = randomItem(MARCAS_BICI);
        modelo = String(randomInt(2018, 2024));
        if (tieneBiciCupo) {
          parqueaAdentro = 'Sí';
          numParqueadero = u.biciAsignada!;
          tieneBiciCupo = false; // asignado
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

  // 7. COMPILAR LIBRO EXCEL CON LAS 6 HOJAS
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
    { wch: 16 }, // Torre
    { wch: 14 }, // Apto_Casa
    { wch: 8 },  // Piso
    { wch: 10 }, // Cuartos
    { wch: 8 },  // Banos
    { wch: 14 }, // Tiene_Balcon
    { wch: 18 }, // Metros_Cuadrados
    { wch: 14 }, // Tiene_Patio
    { wch: 14 }, // Coeficiente
    { wch: 16 }, // Tipo_Ocupacion
  ];
  XLSX.utils.book_append_sheet(wb, wsInmuebles, 'Inmuebles');

  // Hoja 2: Residentes
  const wsResidentes = XLSX.utils.json_to_sheet(filasResidentes);
  wsResidentes['!cols'] = [
    { wch: 22 }, // Unidad / Apto
    { wch: 14 }, // Torre
    { wch: 12 }, // Apto
    { wch: 24 }, // Nombre Completo
    { wch: 14 }, // Documento
    { wch: 22 }, // Condición
    { wch: 18 }, // Contacto Principal
    { wch: 16 }, // Fecha Nacimiento
    { wch: 8 },  // Edad
    { wch: 18 }, // Categoría Edad
    { wch: 16 }, // Teléfono
    { wch: 26 }, // Correo Electrónico
  ];
  XLSX.utils.book_append_sheet(wb, wsResidentes, 'Residentes');

  // Hoja 3: Mascotas
  const wsMascotas = XLSX.utils.json_to_sheet(filasMascotas);
  wsMascotas['!cols'] = [
    { wch: 22 }, // Unidad / Apto
    { wch: 14 }, // Torre
    { wch: 12 }, // Apto
    { wch: 12 }, // Tipo
    { wch: 16 }, // Nombre
    { wch: 22 }, // Raza
    { wch: 26 }, // Manejo Especial
    { wch: 16 }, // Vacunas al Día
    { wch: 32 }, // Observaciones
  ];
  XLSX.utils.book_append_sheet(wb, wsMascotas, 'Mascotas');

  // Hoja 4: Vehículos
  const wsVehiculos = XLSX.utils.json_to_sheet(filasVehiculos);
  wsVehiculos['!cols'] = [
    { wch: 22 }, // Unidad / Apto
    { wch: 14 }, // Torre
    { wch: 12 }, // Apto
    { wch: 14 }, // Tipo
    { wch: 12 }, // Placa
    { wch: 16 }, // Marca
    { wch: 12 }, // Modelo
    { wch: 12 }, // Color
    { wch: 20 }, // Parquea en Edificio
    { wch: 16 }, // N° Parqueadero
  ];
  XLSX.utils.book_append_sheet(wb, wsVehiculos, 'Vehículos');

  // Hoja 5: Parqueaderos
  const wsParqueaderos = XLSX.utils.json_to_sheet(filasParqueaderos);
  wsParqueaderos['!cols'] = [
    { wch: 22 }, // Numero_Parqueadero
    { wch: 16 }, // Torre_Asignada
    { wch: 16 }, // Apto_Asignado
    { wch: 14 }, // Es_Visitante
    { wch: 12 }, // Tipo
    { wch: 14 }, // Es_Cubierto
  ];
  XLSX.utils.book_append_sheet(wb, wsParqueaderos, 'Parqueaderos');

  // Hoja 6: Bodegas
  const wsBodegas = XLSX.utils.json_to_sheet(filasBodegas);
  wsBodegas['!cols'] = [
    { wch: 18 }, // Numero_Bodega
    { wch: 16 }, // Torre_Asignada
    { wch: 16 }, // Apto_Asignado
    { wch: 16 }, // Ubicacion
    { wch: 18 }, // Metros_Cuadrados
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
}

// Ejecución directa si se invoca por CLI
if (require.main === module) {
  const targetFile = path.resolve(__dirname, '../data/censo_mock_500.xlsx');
  generarMockCensoExcel(targetFile);
}
