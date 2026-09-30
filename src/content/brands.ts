import { registerLogo } from '../engine/assets/gen/logos';
import { registerProp } from '../engine/world/PropRegistry';
import { propBillboard, propPlate } from '../engine/assets/gen/props';
import { C } from '../engine/assets/Palette';
import type { BuildingSpec } from '../engine/assets/gen/buildings';

/**
 * Marcas FICTICIAS del juego. Ninguna copia logotipos reales: son dibujos originales
 * por código que sólo evocan el tipo de comunicación que inspira la sátira.
 *  - Patagonia Puede: empresa/estructura provincial de objeto amplio (azul, celeste, acento rojo).
 *  - Acá Nomás: cadena de comercios que aparece cada pocas cuadras (naranja y crema).
 *  - Radio 89: la radio de los trayectos.
 *  - Municipalidad "Ciudad en Movimiento": gráfica municipal ficticia (verde agua).
 */
export const BRANDS = {
  pp: { name: 'Patagonia Puede', subs: ['Patagonia Puede Alimentos', 'Patagonia Puede Digital', 'Patagonia Puede Hogar', 'Patagonia Puede Obras'] },
  an: { name: 'Acá Nomás', slogan: 'Todo lo que necesitás, a una cuadra' },
  r89: { name: 'Radio 89', dial: 'FM 89.0', slogan: 'La que se escucha aunque sople' },
  muni: { name: 'Municipalidad', slogan: 'Ciudad en Movimiento' },
};

export function registerBrands(): void {
  // Patagonia Puede: insignia con montaña, nieve y un sol rojo
  registerLogo('pp', (plot, size) => {
    const s = Math.max(8, size);
    const navy = C('ppNavy');
    const cyan = C('ppCyan');
    const white = C('white');
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) plot(x, y, navy);
    const base = s - 2;
    const peak = Math.floor(s * 0.42);
    const h = Math.floor(s * 0.62);
    for (let y = 0; y < h; y++) {
      const half = Math.floor(((y + 1) / h) * (s * 0.42));
      for (let x = peak - half; x <= peak + half; x++) {
        if (x < 1 || x > s - 2) continue;
        plot(x, base - h + 1 + y, y < 2 ? white : cyan);
      }
    }
    plot(s - 3, 2, C('ppRed'));
    plot(s - 2, 2, C('ppRed'));
    plot(s - 3, 1, C('ppRed'));
    return s;
  });
  // Acá Nomás: marcador de "acá" apuntando hacia abajo
  registerLogo('an', (plot, size) => {
    const s = Math.max(7, size);
    const w = Math.max(6, Math.round(s * 0.8));
    const r = w / 2;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < w; x++) {
        const cx = x + 0.5 - r;
        const cy = y + 0.5 - r;
        const inCircle = cx * cx + cy * cy <= r * r;
        const tail = y >= r && Math.abs(cx) <= (s - y) * (r / (s - r + 0.01));
        if (inCircle || tail) plot(x, y, C('anOrange'));
      }
    }
    const c = Math.floor(r);
    plot(c - 1, c - 1, C('anCream'));
    plot(c, c - 1, C('anCream'));
    plot(c - 1, c, C('anCream'));
    plot(c, c, C('anCream'));
    return w;
  });
  // Radio 89: círculo con ondas
  registerLogo('r89', (plot, size) => {
    const s = Math.max(7, size);
    const r = s / 2;
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
        if (d <= r) plot(x, y, d > r - 1.3 ? C('r89Yellow') : C('r89Magenta'));
      }
    plot(Math.floor(r), Math.floor(r), C('white'));
    plot(Math.floor(r) + 2, Math.floor(r) - 1, C('white'));
    plot(Math.floor(r) + 2, Math.floor(r) + 1, C('white'));
    return s;
  });
  // Municipalidad ficticia: tres líneas de viento
  registerLogo('muni', (plot, size) => {
    const s = Math.max(7, size);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) plot(x, y, C('muniTeal'));
    for (let i = 0; i < 3; i++) {
      const y = 2 + i * Math.max(2, Math.floor((s - 3) / 3));
      for (let x = 1 + i; x < s - 1; x++) plot(x, y, C('muniLight'));
      plot(s - 2, y - 1, C('muniLight'));
    }
    return s;
  });
  // Escarapela para la escuela
  registerLogo('esc', (plot, size) => {
    const s = Math.max(7, size);
    const r = s / 2;
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const d = Math.hypot(x + 0.5 - r, y + 0.5 - r);
        if (d <= r) plot(x, y, d > r * 0.66 ? C('flagBlue') : d > r * 0.33 ? C('white') : C('flagBlue'));
      }
    return s;
  });

  // ------------------------------------------------------------ carteles de marca (props)
  // Vallas FRENTE a la cámara (ver propBillboard): el texto se lee derecho y se parte solo.
  registerProp('bb_pp_cd2', (p: { axis?: 'x' | 'y' }) =>
    propBillboard({
      axis: p?.axis ?? 'x',
      len: 7,
      boardH: 46,
      post: 22,
      bg: 'ppNavy',
      border: 'ppCyan',
      logo: 'pp',
      logoSize: 14,
      lines: [
        { text: 'PATAGONIA PUEDE', fg: 'white' },
        { text: 'PRÓXIMAMENTE', fg: 'ppCyan' },
        { text: 'CENTRO DE', fg: 'white' },
        { text: 'DISTRIBUCIÓN 2', fg: 'white' },
      ],
    }),
  );
  registerProp('bb_r89', (p: { axis?: 'x' | 'y' }) =>
    propBillboard({
      axis: p?.axis ?? 'x',
      len: 7,
      boardH: 40,
      post: 16,
      bg: 'r89Purple',
      border: 'r89Yellow',
      logo: 'r89',
      logoSize: 10,
      lines: [
        { text: 'RADIO 89', fg: 'r89Yellow', scale: 2 },
        { text: 'LA QUE SE ESCUCHA', fg: 'white' },
        { text: 'AUNQUE SOPLE', fg: 'white' },
      ],
    }),
  );
  registerProp('bb_an', (p: { axis?: 'x' | 'y' }) =>
    propBillboard({
      axis: p?.axis ?? 'x',
      len: 7,
      boardH: 34,
      post: 18,
      bg: 'anOrange',
      border: 'anCream',
      logo: 'an',
      logoSize: 10,
      lines: [
        { text: 'ACÁ NOMÁS', fg: 'anCream', scale: 2 },
        { text: 'TODO, A UNA CUADRA', fg: 'white' },
      ],
    }),
  );
  registerProp('pl_pp_digital', () => propPlate({ text: 'PATAGONIA PUEDE DIGITAL', text2: 'ZONA DE FOTOCONTROL', bg: 'ppNavy', fg: 'white', logo: 'pp', post: 12 }));
  registerProp('pl_pp_bacheo', () => propPlate({ text: 'PATAGONIA PUEDE OBRAS', text2: 'BACHEO EN EJECUCIÓN', bg: 'ppNavy', fg: 'ppCyan', logo: 'pp', post: 8 }));
  registerProp('pl_pp_obra', () => propPlate({ text: 'OBRA: CENTRO DE DISTRIB. 2', text2: 'INICIO 2024 · PLAZO 180 DÍAS', bg: 'white', fg: 'ppNavy', logo: 'pp', post: 8 }));
  registerProp('pl_semaforo', () => propPlate({ text: 'PLAN SEMÁFORO', text2: 'INTELIGENTE', bg: 'muniTeal', fg: 'white', logo: 'muni', post: 10 }));
  registerProp('pl_calle_cerrada', () => propPlate({ text: 'CALLE CERRADA', text2: 'OBRA PATAGONIA PUEDE', bg: 'hazard', fg: 'ink', post: 4 }));
  registerProp('pl_desvio', () => propPlate({ text: 'DESVÍO', bg: 'cone', fg: 'white', post: 4 }));
  registerProp('pl_paro', () => propPlate({ text: 'PARO', bg: 'white', fg: 'signRed', post: 2 }));
  registerProp('pl_bache', () => propPlate({ text: '¡TAPEN EL BACHE!', text2: 'VECINOS AUTOCONVOCADOS', bg: 'snow', fg: 'signRed', post: 10 }));
}

// ------------------------------------------------------------ edificios de marca

/** Sucursal de Acá Nomás (vidriera con marquesina). face: cara que da a la calle. */
export function acaNomasStore(w: number, d: number, face: 'L' | 'R', suc: string, seed: number): BuildingSpec {
  const len = face === 'L' ? w : d;
  return {
    w,
    d,
    floors: 1,
    floorH: 22,
    wall: 'wallCream',
    wall2: 'anBrown',
    roof: 'flat',
    roofColor: 'roofGrey',
    windows: 'few',
    door: { face, u: Math.max(0.5, len - 1.1), kind: 'glass' },
    storefront: { face, u0: 0.25, u1: Math.max(0.8, len - 1.3), awning: 'anOrange' },
    signs: [{ face, u0: 0.1, u1: len - 0.1, z0: 18, z1: 29, bg: 'anOrange', fg: 'anCream', text: 'ACÁ NOMÁS', logo: 'an', style: 'band', caption: `ACÁ NOMÁS · SUCURSAL ${suc}` }],
    roofSign: { text: 'ACÁ NOMÁS', text2: `SUC. ${suc}`, bg: 'anOrange', fg: 'anCream', logo: 'an' },
    details: ['ac'],
    seed,
  };
}

/** Local cerrado a punto de convertirse en Acá Nomás. */
export function acaNomasSoon(w: number, d: number, face: 'L' | 'R', oldName: string, seed: number): BuildingSpec {
  const len = face === 'L' ? w : d;
  return {
    w,
    d,
    floors: 1,
    floorH: 22,
    wall: 'wallGrey',
    roof: 'flat',
    roofColor: 'roofGrey',
    windows: 'none',
    door: { face, u: Math.max(0.5, len - 1.1), kind: 'metal' },
    storefront: { face, u0: 0.25, u1: Math.max(0.8, len - 1.3) },
    signs: [
      { face, u0: 0.1, u1: len - 0.1, z0: 19, z1: 28, fg: 'slate5', text: oldName, style: 'painted' },
      { face, u0: 0.4, u1: len - 0.4, z0: 3, z1: 21, bg: 'anOrange', fg: 'anCream', text: 'PRÓXIMAMENTE', text2: 'ACÁ NOMÁS', style: 'banner', caption: `EX ${oldName} · PRÓXIMAMENTE ACÁ NOMÁS` },
    ],
    roofSign: { text: 'PRÓXIMAMENTE', text2: 'ACÁ NOMÁS', bg: 'anCream', fg: 'anOrange' },
    details: ['taped', 'graffiti'],
    seed,
  };
}
