import { G, DECO } from '../../engine/world/ground';
import type { CityPlan, LotDef, PropDef, FenceDef } from '../../engine/world/types';
import { houseSpec } from '../../engine/world/CityBuilder';
import { acaNomasSoon, acaNomasStore } from '../brands';
import type { BuildingSpec } from '../../engine/assets/gen/buildings';

/**
 * Río Gallegos "versión jugable" (comprimida, no 1:1): el estuario y la costanera al norte,
 * una grilla de manzanas con avenidas anchas, barrios de casas bajas con techos de chapa,
 * postes y cables, y la estepa en los bordes. Nombres de calles genéricos y de uso común.
 *
 *   x → (abajo-derecha)     y ↓ (abajo-izquierda)
 *   Calles en x: Costanera (10) · Zapiola (26) · Av. Roca (42) · Alcorta (61) · Fagnano (77) · Los Coirones (92, ripio)
 *   Calles en y: Maipú (9) · Av. San Martín (25) · Sarmiento (44) · Rawson (60) · Errázuriz (76) · Los Álamos (92, ripio)
 */

const HOME_MUNICIPAL: BuildingSpec = {
  w: 4,
  d: 3,
  wall: 'wallBlue',
  roof: 'gableX',
  roofColor: 'roofRed',
  door: { face: 'L', u: 1.0 },
  chiflonera: true,
  windows: 'normal',
  details: ['gas', 'chimney', 'antenna', 'reja'],
  seed: 101,
};

const HOME_EMPRENDEDOR: BuildingSpec = {
  w: 4,
  d: 3,
  wall: 'wallYellow',
  roof: 'shed',
  roofColor: 'roofGreen',
  door: { face: 'L', u: 0.5 },
  windows: 'few',
  details: ['gas', 'chimney', 'kiosk', 'dish'],
  signs: [{ face: 'L', u0: 1.35, u1: 2.2, z0: 5, z1: 9, fg: 'ink', text: '', style: 'paper', caption: 'HABILITACIÓN EN TRÁMITE (hoja A4, con cinta)' }],
  seed: 102,
};

const SCHOOL: BuildingSpec = {
  w: 8,
  d: 6.5,
  floors: 2,
  floorH: 20,
  wall: 'wallCream',
  wall2: 'brick',
  roof: 'flat',
  roofColor: 'roofGrey',
  door: { face: 'L', u: 3.625, kind: 'double' },
  windows: 'many',
  details: ['mural', 'steps', 'lamp', 'tank'],
  signs: [{ face: 'L', u0: 1.0, u1: 7.0, z0: 24, z1: 34, bg: 'white', fg: 'signBlue', text: 'ESCUELA N° 38', logo: 'esc', style: 'board', caption: 'ESCUELA N° 38' }],
  seed: 201,
};

const MUNI: BuildingSpec = {
  w: 8,
  d: 7,
  floors: 3,
  floorH: 20,
  wall: 'wallWhite',
  wall2: 'slate3',
  roof: 'flat',
  roofColor: 'roofGrey',
  door: { face: 'L', u: 3.5, kind: 'double' },
  windows: 'many',
  details: ['columns', 'steps', 'ac', 'antenna'],
  signs: [
    { face: 'L', u0: 1.0, u1: 7.0, z0: 50, z1: 60, bg: 'muniTeal', fg: 'white', text: 'MUNICIPALIDAD', logo: 'muni', style: 'band', caption: 'MUNICIPALIDAD · CIUDAD EN MOVIMIENTO' },
    { face: 'L', u0: 4.3, u1: 7.9, z0: 21, z1: 39, bg: 'muniLight', fg: 'muniTeal', text: 'CIUDAD EN', text2: 'MOVIMIENTO', style: 'banner' },
  ],
  seed: 301,
};

const RADIO_STATION: BuildingSpec = {
  w: 3,
  d: 3,
  wall: 'wallGrey',
  roof: 'flat',
  roofColor: 'roofGrey',
  door: { face: 'L', u: 0.5, kind: 'metal' },
  windows: 'few',
  signs: [{ face: 'L', u0: 1.1, u1: 2.9, z0: 12, z1: 21, bg: 'r89Purple', fg: 'r89Yellow', text: 'R89', logo: 'r89', style: 'band', caption: 'RADIO 89 · FM 89.0' }],
  details: [],
  seed: 401,
};

function lots(charId: string): LotDef[] {
  return [
    // casa del protagonista (Fagnano, frente a la calle)
    {
      id: 'home',
      at: [36, 72],
      size: [4, 3],
      building: charId === 'emprendedor' ? HOME_EMPRENDEDOR : HOME_MUNICIPAL,
      yard: [35, 71, 41, 76],
      yardGround: G.YARD,
    },
    // Acá Nomás Suc. 11 (Fagnano y San Martín)
    { id: 'an11', at: [19.5, 72.5], size: [4, 3.5], building: acaNomasStore(4, 3.5, 'L', '11', 11), yard: [19, 72, 24, 76], yardGround: G.PAVER },
    // Ex Ferretería → Próximamente Acá Nomás (Alcorta)
    { id: 'an12', at: [50, 56.5], size: [5, 3.5], building: acaNomasSoon(5, 3.5, 'L', 'FERRETERÍA', 12), yard: [49, 56, 55.5, 60], yardGround: G.PAVER },
    // Acá Nomás Suc. 13 (Zapiola)
    { id: 'an13', at: [66, 21], size: [5, 3.5], building: acaNomasStore(5, 3.5, 'L', '13', 13), yard: [65.5, 20.5, 71.5, 25], yardGround: G.PAVER },
    // Acá Nomás Suc. 14 con punto de pago (Av. Roca)
    { id: 'an14', at: [66, 36.5], size: [5, 3.5], building: acaNomasStore(5, 3.5, 'L', '14', 14), yard: [65.5, 36, 71.5, 41], yardGround: G.PAVER },
    // Ex Farmacia → Próximamente Acá Nomás (Errázuriz)
    { id: 'an15', at: [71.5, 52], size: [3.5, 4], building: acaNomasSoon(3.5, 4, 'R', 'FARMACIA', 15), yard: [71, 51.5, 75, 56.5], yardGround: G.PAVER },
    // Escuela
    { id: 'school', at: [49.5, 15.5], size: [8, 6.5], building: SCHOOL, yard: [49, 15, 59, 25], yardGround: G.PAVER },
    // Municipalidad (Av. Roca, frente a la plaza seca)
    { id: 'muni', at: [34, 33], size: [8, 7], building: MUNI, yard: [33, 32, 43, 41], yardGround: G.PAVER },
    // Radio 89
    { id: 'radio89', at: [15, 17], size: [3, 3], building: RADIO_STATION, yard: [14, 16, 19, 21], yardGround: G.DIRT },
    // Casa de la hermana (barrio de casas iguales)
    { id: 'sister_house', at: [84, 56], size: [4, 3], building: { ...houseSpec('S', 4, 3, 0, true), door: { face: 'L', u: 1 } }, yard: [84, 55, 88, 60] },
  ];
}

function fences(): FenceDef[] {
  return [
    // escuela: reja con portón frente a la puerta
    { axis: 'x', at: [49, 24.94], len: 10, kind: 'reja', gates: [4] },
    // obra de Patagonia Puede: cerco de chapa
    { axis: 'y', at: [42.94, 50], len: 10, kind: 'chapa', stencil: 'pp' },
    { axis: 'x', at: [35, 59.94], len: 8, kind: 'chapa', stencil: 'pp' },
    // casa del protagonista
    { axis: 'x', at: [35, 75.94], len: 6, kind: 'picket', color: 'wood', gates: [2] },
    // alambrado del borde oeste (estepa)
    { axis: 'y', at: [6.2, 12], len: 84, kind: 'wire', gates: [30] },
  ];
}

function props(charId: string): PropDef[] {
  const out: PropDef[] = [];
  const add = (p: PropDef) => out.push(p);

  // ---------------------------------------------------------- costanera y estuario
  add({ type: 'letters', at: [34, 7.2], fp: [9, 0.4], solid: true, caption: { text: 'RÍO GALLEGOS', bg: 'slate8', fg: 'white', z: 28 } });
  for (let x = 12; x < 94; x += 4) add({ type: 'alamo', at: [x + 0.5, 7.6], params: { seed: x, h: 34 + (x % 3) * 4 }, anim: { fps: 1.6 }, solid: true });
  for (let x = 14; x < 94; x += 8) add({ type: 'bench', at: [x, 8.35], params: { axis: 'x' }, fp: [1, 0.3], solid: true });
  for (let x = 16; x < 94; x += 8) add({ type: 'streetlight', at: [x + 0.5, 8.8], params: { axis: 'x', side: 1 }, solid: true });
  for (const [x, y] of [
    [44, 5.6],
    [45.4, 6.2],
    [47.2, 5.5],
    [51, 6.1],
    [52.3, 5.4],
    [63, 5.8],
  ] as [number, number][])
    add({ type: 'flamingo', at: [x, y], anim: { fps: 0.7 } });

  // ---------------------------------------------------------- Radio 89
  add({ type: 'antenna', at: [20.5, 18.5], params: { h: 76 }, anim: { fps: 1.2 }, solid: true });
  // valla de la radio sobre la vereda de Maipú: queda por detrás y por encima de la emisora, sin taparla
  add({ type: 'bb_r89', at: [13.3, 15.6], params: { axis: 'y' }, fp: [0.12, 7], solid: true, caption: { text: 'RADIO 89 · FM 89.0 · LA QUE SE ESCUCHA AUNQUE SOPLE', bg: 'r89Purple', fg: 'r89Yellow', z: 70 } });

  // ---------------------------------------------------------- escuela
  add({ type: 'flag', at: [51.5, 23.4], params: { colors: ['flagBlue', 'white', 'flagBlue'], sun: true }, anim: { fps: 5 }, solid: true });
  add({ id: 'paro_sign', type: 'pl_paro', at: [54.6, 25.25], solid: true, caption: { text: 'PARO', bg: 'white', fg: 'signRed', z: 18 } });

  // ---------------------------------------------------------- municipalidad
  add({ type: 'flag', at: [35.2, 40.5], params: { colors: ['flagBlue', 'white', 'flagBlue'], sun: true }, anim: { fps: 5 }, solid: true });
  add({ type: 'flag', at: [40.8, 40.5], params: { colors: ['muniTeal', 'white', 'muniTeal'] }, anim: { fps: 5 }, solid: true });
  add({ type: 'pl_semaforo', at: [31.9, 41.4], solid: true, caption: { text: 'PLAN SEMÁFORO INTELIGENTE · ETAPA 1 · CIUDAD EN MOVIMIENTO', bg: 'muniTeal', fg: 'white', z: 34 } });

  // ---------------------------------------------------------- accidente en Roca y San Martín
  add({ id: 'crash_a', type: 'vehicle', at: [27.4, 45.6], params: { look: { model: 'pickup', body: 'carWhite', damaged: true }, dir: 2 }, anim: { fps: 2, seq: [2, 10] }, solid: true });
  add({ id: 'crash_b', type: 'vehicle', at: [28.6, 44.1], params: { look: { model: 'hatch', body: 'carRed', damaged: true }, dir: 5 }, anim: { fps: 2, seq: [5, 13] }, solid: true });
  add({ id: 'transito_car', type: 'vehicle', at: [30.4, 47.6], params: { look: { model: 'police', body: 'carWhite', accent: 'signBlue' }, dir: 6 }, anim: { fps: 3, seq: [6, 14] }, solid: true });
  for (const [x, y] of [
    [26.2, 43.2],
    [30.8, 43.4],
    [26.4, 47.8],
    [29.6, 42.7],
    [31.2, 45.2],
  ] as [number, number][])
    add({ type: 'cone', at: [x, y], solid: true });
  // corte en San Martín (al norte de Alcorta)
  add({ id: 'desvio_a', type: 'barrier', at: [28.9, 60.15], params: { axis: 'x', text: 'DESVÍO' }, fp: [1, 0.12], solid: true });
  add({ id: 'desvio_b', type: 'barrier', at: [29.9, 60.15], params: { axis: 'x' }, fp: [1, 0.12], solid: true });
  add({ type: 'barrier', at: [25.9, 60.15], params: { axis: 'x' }, fp: [1, 0.12], solid: true });
  add({ type: 'barrier', at: [26.9, 60.15], params: { axis: 'x', text: 'DESVÍO' }, fp: [1, 0.12], solid: true });
  add({ type: 'pl_desvio', at: [31.3, 60.7], solid: true, caption: { text: 'DESVÍO', bg: 'cone', fg: 'white', z: 20 } });
  add({ type: 'cone', at: [28.2, 60.6], solid: true });

  // ---------------------------------------------------------- obra Patagonia Puede (Centro de Distribución 2)
  add({ id: 'cd2', type: 'bb_pp_cd2', at: [35.4, 58.6], params: { axis: 'x' }, fp: [7, 0.12], solid: true, caption: { text: 'PATAGONIA PUEDE · PRÓXIMAMENTE · CENTRO DE DISTRIBUCIÓN 2', bg: 'ppNavy', fg: 'white', z: 78 } });
  add({ type: 'pl_pp_obra', at: [43.5, 52.6], solid: true, caption: { text: 'OBRA: CENTRO DE DISTRIBUCIÓN 2 · INICIO 2024 · PLAZO 180 DÍAS', bg: 'white', fg: 'ppNavy', z: 32 } });
  add({ type: 'mixer', at: [39.5, 53.2], solid: true });
  add({ type: 'sandpile', at: [40.6, 55.6], solid: true });
  add({ type: 'bricks', at: [37.6, 51.1], fp: [0.6, 0.6], solid: true });
  add({ type: 'sandpile', at: [36.4, 54.3], params: { color: '#9a9180' }, solid: true });
  for (const x of [44, 45, 46, 47]) {
    add({ type: 'barrier', at: [x, 59.9], params: { axis: 'x', text: x === 45 ? 'CERRADO' : undefined }, fp: [1, 0.12], solid: true });
    add({ type: 'barrier', at: [x, 49.4], params: { axis: 'x' }, fp: [1, 0.12], solid: true });
  }
  add({ type: 'pl_calle_cerrada', at: [46, 59.35], solid: true, caption: { text: 'CALLE CERRADA · OBRA PATAGONIA PUEDE', bg: 'hazard', fg: 'ink', z: 28 } });

  // ---------------------------------------------------------- Patagonia Puede Digital / fotocontrol
  add({ type: 'pl_pp_digital', at: [48.6, 41.5], solid: true, caption: { text: 'PATAGONIA PUEDE DIGITAL · ZONA DE FOTOCONTROL', bg: 'ppNavy', fg: 'white', z: 36 } });

  // ---------------------------------------------------------- Acá Nomás (cartel en Roca)
  add({ type: 'bb_an', at: [50, 40.3], params: { axis: 'x' }, fp: [7, 0.12], solid: true, caption: { text: 'ACÁ NOMÁS · TODO, A UNA CUADRA', bg: 'anOrange', fg: 'white', z: 62 } });

  // ---------------------------------------------------------- protesta por el bache (Errázuriz)
  add({ id: 'bache_banner', type: 'pl_bache', at: [78, 55.6], solid: true, caption: { text: '¡TAPEN EL BACHE! · VECINOS AUTOCONVOCADOS', bg: 'snow', fg: 'signRed', z: 34 } });
  add({ type: 'pl_pp_bacheo', at: [80.5, 56.8], solid: true, caption: { text: 'PATAGONIA PUEDE OBRAS · BACHEO EN EJECUCIÓN', bg: 'ppNavy', fg: 'ppCyan', z: 30 } });
  for (const [x, y] of [
    [76.4, 53.8],
    [79.5, 53.9],
    [76.5, 58.3],
    [79.3, 58.4],
  ] as [number, number][])
    add({ type: 'cone', at: [x, y], solid: true });
  add({ type: 'pothole_sign', at: [75.4, 58.2], solid: true });

  // ---------------------------------------------------------- casa del protagonista
  if (charId === 'emprendedor') {
    add({ id: 'kiosk_sign', type: 'plate', at: [40.5, 75.6], params: { text: 'KIOSCO', text2: 'EL REFUGIO', bg: '#f2e6c8', fg: '#b3322a', post: 4 }, solid: true, caption: { text: 'KIOSCO EL REFUGIO', z: 30 } });
  }
  add({ id: 'hat', type: 'beanie', at: [41.6, 76.3], params: { color: charId === 'emprendedor' ? 'red' : 'blue' }, hidden: true });

  // ---------------------------------------------------------- borde de estepa: bolsas enganchadas en el alambrado
  for (const [y, c] of [
    [24, 'anOrange'],
    [37, 'snow'],
    [52, 'anOrange'],
    [66, 'anOrange'],
    [83, 'snow'],
  ] as [number, string][])
    add({ type: 'bag', at: [6.25, y + 0.3], params: { color: c }, anim: { fps: 3 } });

  // parada de colectivo en Roca
  add({ type: 'busstop', at: [56.2, 49.3], params: { axis: 'x' }, fp: [1.4, 0.5], solid: true });
  add({ type: 'container', at: [62.2, 49.6], solid: true });
  add({ type: 'container', at: [40.1, 81.6], solid: true });
  return out;
}

export function cityPlan(charId: string): CityPlan {
  return {
    id: `ch01-city-${charId}`,
    name: 'Río Gallegos (versión jugable)',
    size: [100, 100],
    seed: 1885,
    base: G.STEPPE,
    groundRects: [
      { rect: [0, 0, 100, 5], g: G.WATER },
      { rect: [0, 5, 100, 7], g: G.MUD },
      { rect: [0, 7, 100, 9], g: G.PAVER },
      { rect: [35, 50, 43, 60], g: G.OBRA },
    ],
    streets: [
      { id: 'costanera', name: 'Av. Costanera', axis: 'x', at: 10, from: 9, to: 96, crosswalks: true },
      { id: 'zapiola', name: 'Zapiola', axis: 'x', at: 26, from: 9, to: 96 },
      { id: 'roca', name: 'Av. Roca', axis: 'x', at: 42, lanes: 2, median: 1, from: 9, to: 96, crosswalks: true },
      { id: 'alcorta', name: 'Alcorta', axis: 'x', at: 61, from: 9, to: 96 },
      { id: 'fagnano', name: 'Fagnano', axis: 'x', at: 77, from: 9, to: 96 },
      { id: 'coirones', name: 'Los Coirones', axis: 'x', at: 92, from: 9, to: 96, paved: false, sidewalk: 'dirt' },
      { id: 'maipu', name: 'Maipú', axis: 'y', at: 9, from: 10, to: 96 },
      { id: 'sanmartin', name: 'Av. San Martín', axis: 'y', at: 25, lanes: 2, median: 1, from: 10, to: 96, crosswalks: true },
      { id: 'sarmiento', name: 'Sarmiento', axis: 'y', at: 44, from: 10, to: 96 },
      { id: 'rawson', name: 'Rawson', axis: 'y', at: 60, from: 10, to: 96 },
      { id: 'errazuriz', name: 'Errázuriz', axis: 'y', at: 76, from: 10, to: 96 },
      { id: 'alamos', name: 'Los Álamos', axis: 'y', at: 92, from: 10, to: 96, paved: false, sidewalk: 'dirt' },
    ],
    signals: [
      { x: 'roca', y: 'sanmartin', broken: true },
      { x: 'roca', y: 'sarmiento' },
      { x: 'roca', y: 'rawson' },
      { x: 'roca', y: 'errazuriz' },
      { x: 'zapiola', y: 'sanmartin' },
      { x: 'costanera', y: 'sanmartin' },
    ],
    lots: lots(charId),
    fences: fences(),
    props: props(charId),
    autoFill: {
      exclude: [
        [14, 15, 24, 25],
        [49, 15, 59, 25],
        [33, 31, 43, 41],
      ],
      empty: [
        [65, 82, 75, 91],
        [14, 82, 24, 91],
      ],
      barrioRects: [
        [9, 81, 96, 92],
        [81, 50, 96, 76],
      ],
      uniform: [
        [81, 50, 91, 60],
        [81, 66, 91, 76],
      ],
    },
    autoProps: { poles: true, signs: true },
    parked: {
      density: 0.26,
      looks: [
        { model: 'sedan', body: 'carSilver' },
        { model: 'sedan', body: 'carRed' },
        { model: 'hatch', body: 'carBeige' },
        { model: 'pickup', body: 'carWhite' },
        { model: 'pickup', body: 'carSilver' },
        { model: 'pickup', body: 'carBlack' },
        { model: 'suv', body: 'carWhite' },
        { model: 'suv', body: 'carTeal' },
        { model: 'van', body: 'carWhite' },
        { model: 'hatch', body: 'carGreen' },
        { model: 'sedan', body: 'carBlack' },
      ],
    },
    blocks: [
      // obra de Patagonia Puede: Sarmiento cortada entre Roca y Alcorta (el GPS ya lo sabe)
      { id: 'obra', street: 'sarmiento', from: 49, to: 61, known: true },
      // accidente: San Martín cortada entre Roca y Alcorta (el GPS se entera al verlo)
      { id: 'accidente', street: 'sanmartin', from: 49, to: 61, known: false },
      // vecinos autoconvocados por el bache: Errázuriz entre Roca y Alcorta
      { id: 'protesta', street: 'errazuriz', from: 49, to: 61, known: false },
    ],
    blockedInters: [{ key: 'roca/sanmartin', known: false }],
    deco: [
      { at: [77, 56], code: DECO.BIG_POTHOLE },
      { at: [78, 57], code: DECO.POTHOLE },
      { at: [76, 55], code: DECO.PATCH },
      { at: [28, 45], code: DECO.OIL },
      { at: [27, 46], code: DECO.CRACK },
    ],
    markers: {
      home_door: { at: [37.45, 75.3], dir: 'S' },
      home_kid: { at: [36.85, 75.5], dir: 'S' },
      home_car: { at: [38.4, 77.5], dir: 'W' },
      home_gate: { at: [37.5, 76.4] },
      hat_fly_from: { at: [38.4, 75.8] },
      hat_land: { at: [41.6, 76.3] },
      tito: { at: [34.3, 75.25], dir: 'E' },
      elba: { at: [38.35, 75.3], dir: 'S' },
      agent_sm: { at: [28.45, 60.55], dir: 'S' },
      school_car: { at: [53.6, 26.5], dir: 'W' },
      school_gate_out: { at: [53.5, 25.5], dir: 'N' },
      school_gate_in: { at: [53.5, 24.45], dir: 'S' },
      portero: { at: [53.55, 24.3], dir: 'S' },
      parent_1: { at: [51.2, 25.6], dir: 'E' },
      parent_2: { at: [55.9, 25.55], dir: 'W' },
      parent_3: { at: [52.3, 25.85], dir: 'N' },
      parent_4: { at: [57.2, 25.4], dir: 'W' },
      kid_1: { at: [51.6, 25.45], dir: 'E' },
      kid_2: { at: [56.3, 25.8], dir: 'N' },
      call_spot: { at: [51.0, 25.6], dir: 'S' },
      sister_car: { at: [86.2, 61.5], dir: 'W' },
      sister_door: { at: [85.35, 59.35], dir: 'S' },
      sister_out: { at: [85.6, 59.7], dir: 'S' },
      protest_1: { at: [77.2, 55.3], dir: 'S' },
      protest_2: { at: [78.9, 55.1], dir: 'S' },
      protest_3: { at: [77.9, 56.6], dir: 'E' },
      protest_4: { at: [76.8, 56.9], dir: 'S' },
      an14_car: { at: [68.8, 42.5], dir: 'W' },
      an14_door: { at: [69.55, 40.55], dir: 'N' },
      muni_car: { at: [38.6, 42.5], dir: 'W' },
      muni_door: { at: [37.7, 40.55], dir: 'N' },
      attract_a: { at: [24, 13] },
      attract_b: { at: [76, 13] },
    },
    zones: [
      { id: 'accident_reveal', rect: [24.5, 63.5, 33, 71] },
      { id: 'accident_seen_roca', rect: [9, 40.5, 96, 49.5] },
      { id: 'cd2_view', rect: [33, 59.5, 48, 66] },
      { id: 'an12_view', rect: [48, 59.5, 58, 66] },
      { id: 'an11_view', rect: [16, 76, 32, 82] },
      { id: 'an13_view', rect: [62, 25, 75, 31] },
      { id: 'an15_view', rect: [74, 50, 81, 60] },
      { id: 'radio_view', rect: [12, 24.5, 24, 31] },
      { id: 'foto_view', rect: [44, 40.5, 58, 49.5] },
      { id: 'school_gate', rect: [51.8, 24.95, 55.8, 26.3] },
      { id: 'sister_door', rect: [83.8, 58.9, 87.4, 60.7] },
      { id: 'protest_reveal', rect: [80, 59, 90, 66] },
      { id: 'an14_door', rect: [67.8, 40.1, 71, 41.5] },
      { id: 'muni_door', rect: [36, 40.1, 40, 41.5] },
      { id: 'costanera_view', rect: [9, 9, 96, 15] },
    ],
  };
}
