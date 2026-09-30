// Paleta del juego: fría, grisácea y patagónica, con acentos de color para
// vehículos, marcas, personajes y objetivos. Los colores se guardan como
// enteros empaquetados 0xAABBGGRR (formato de ImageData en little-endian).

export type Packed = number;

export function rgba(r: number, g: number, b: number, a = 255): Packed {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function hex(h: string, a = 255): Packed {
  const s = h.startsWith('#') ? h.slice(1) : h;
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}

export function unpack(c: Packed): [number, number, number, number] {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255];
}

export function toCss(c: Packed): string {
  const [r, g, b, a] = unpack(c);
  return a === 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}

/** Multiplica el brillo (f < 1 oscurece, f > 1 aclara). */
export function shade(c: Packed, f: number): Packed {
  const [r, g, b, a] = unpack(c);
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return rgba(k(r), k(g), k(b), a);
}

/** Aclara hacia blanco frío. */
export function tint(c: Packed, t: number, toward: Packed = hex('#e8edf2')): Packed {
  return mix(c, toward, t);
}

export function mix(a: Packed, b: Packed, t: number): Packed {
  const [r1, g1, b1, a1] = unpack(a);
  const [r2, g2, b2, a2] = unpack(b);
  const l = (x: number, y: number) => Math.round(x + (y - x) * t);
  return rgba(l(r1, r2), l(g1, g2), l(b1, b2), l(a1, a2));
}

export function withAlpha(c: Packed, a: number): Packed {
  const [r, g, b] = unpack(c);
  return rgba(r, g, b, Math.round(a * 255));
}

/** Colores con nombre (hex). Los generadores y el contenido usan estos nombres. */
export const PAL = {
  // Tinta y neutros fríos
  ink: '#161a20',
  night: '#232830',
  slate9: '#2d333b',
  slate8: '#383f48',
  slate7: '#444c56',
  slate6: '#535c67',
  slate5: '#646e79',
  slate4: '#78828d',
  slate3: '#8f99a3',
  slate2: '#aab2ba',
  slate1: '#c6ccd2',
  snow: '#e3e8ec',
  white: '#f2f4f5',

  // Asfalto y veredas
  asphalt0: '#3f444b',
  asphalt1: '#454a52',
  asphalt2: '#4b5058',
  asphalt3: '#52575f',
  asphaltPatch: '#383c42',
  lineWhite: '#c6c2ae',
  lineYellow: '#c8a646',
  walk0: '#868987',
  walk1: '#909391',
  walk2: '#9a9d9a',
  walkLine: '#777a78',
  curb: '#b1b2ac',
  curbShadow: '#363a40',

  // Suelos patagónicos
  dirt0: '#6a5d4d',
  dirt1: '#756755',
  dirt2: '#80715c',
  pebble: '#958874',
  steppe0: '#7a744a',
  steppe1: '#878052',
  steppe2: '#948c5b',
  steppe3: '#a39a66',
  steppeDark: '#646040',
  yard0: '#66704a',
  yard1: '#707b51',
  yard2: '#7b8659',
  water0: '#566b78',
  water1: '#5e7483',
  water2: '#687f8f',
  waterLight: '#8199a7',
  mud0: '#5b564a',
  mud1: '#666053',
  mudWet: '#7a7669',
  paver0: '#85817b',
  paver1: '#918c85',
  paver2: '#7b7771',

  // Paredes
  wallCream: '#d0c5ab',
  wallBeige: '#bfae8e',
  wallBlue: '#9db1c0',
  wallGreen: '#a7b597',
  wallSalmon: '#c89b85',
  wallYellow: '#d2c07b',
  wallGrey: '#a2a6a7',
  wallWhite: '#d7dada',
  wallTeal: '#6f9b9a',
  brick: '#985a46',
  brickDark: '#7f4a3a',
  wood: '#8a6446',
  woodDark: '#6b4c35',

  // Techos de chapa
  roofRed: '#9e453c',
  roofGreen: '#4c7157',
  roofBlue: '#425f88',
  roofGrey: '#7b838a',
  roofBrown: '#795944',
  roofTeal: '#3e7c7b',

  // Vidrios y aberturas
  glass: '#2a3949',
  glassLight: '#58768e',
  frame: '#dde0e1',
  door: '#5d4636',

  // Piel y pelo
  skin0: '#e2b797',
  skin1: '#c99b79',
  skin2: '#a77a5b',
  skin3: '#875e46',
  hairBlack: '#232126',
  hairDark: '#473327',
  hairBrown: '#6c4932',
  hairGrey: '#9b9b9b',
  hairRed: '#8a4a31',
  hairBlond: '#b5945b',

  // Ropa
  navy: '#2e3e62',
  blue: '#3e5e98',
  red: '#a73a34',
  mustard: '#be983a',
  green: '#4e794f',
  purple: '#694a7e',
  brown: '#6d4f3f',
  grey: '#6e747b',
  guardapolvo: '#e2e6e9',
  lime: '#b6d33a',
  orange: '#d87629',
  black: '#29292d',
  denim: '#465a7a',

  // Vehículos
  carWhite: '#d8dbdc',
  carSilver: '#a8aeb3',
  carBlue: '#3c5d93',
  carRed: '#a23f39',
  carBlack: '#2b2e34',
  carGreen: '#4d6e54',
  carBeige: '#b7a789',
  carTeal: '#3e8989',
  tire: '#1d1f23',
  headlight: '#f3e9b8',
  taillight: '#d8413a',

  // Marcas ficticias
  ppNavy: '#1f3f73',
  ppCyan: '#3fb4d6',
  ppRed: '#c8413a',
  anOrange: '#e07a2e',
  anCream: '#f3e2b8',
  anBrown: '#6b3a23',
  r89Magenta: '#b8467e',
  r89Purple: '#4f3470',
  r89Yellow: '#f0c83c',
  muniTeal: '#2f8f74',
  muniLight: '#bfe3d4',
  flagBlue: '#74acdf',
  flagSun: '#f6b40e',

  // Señalización
  signRed: '#c23b32',
  signBlue: '#2f5f8f',
  signGreen: '#2f6f4f',
  cone: '#e4682a',
  hazard: '#e9c23a',
  lightRed: '#ff4a3d',
  lightYellow: '#ffc93d',
  lightGreen: '#5fe07a',
  lightOff: '#2a2e33',
  flamingo: '#e79aa5',
  flamingoDark: '#c46f7f',
} as const;

export type PalName = keyof typeof PAL;

const packedCache = new Map<string, Packed>();

/** Color empaquetado por nombre de paleta o hex literal. */
export function C(name: PalName | string, alpha = 255): Packed {
  const key = alpha === 255 ? name : `${name}@${alpha}`;
  let v = packedCache.get(key);
  if (v === undefined) {
    const h = (PAL as Record<string, string>)[name] ?? name;
    v = hex(h, alpha);
    packedCache.set(key, v);
  }
  return v;
}

export function css(name: PalName | string): string {
  return (PAL as Record<string, string>)[name] ?? name;
}
