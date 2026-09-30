import { hex } from '../assets/Palette';

/**
 * Pintor de suelo por píxel (puro: corre en Web Worker o en el hilo principal).
 * Cada píxel se asigna a la baldosa cuyo rombo contiene su centro, así los bordes
 * coinciden exactamente con los de edificios y props.
 */

export const G = {
  NONE: 0,
  STEPPE: 1,
  DIRT: 2,
  YARD: 3,
  LOT: 4,
  SIDEWALK: 5,
  SIDEWALK_DIRT: 6,
  ROAD: 7,
  ROAD_DIRT: 8,
  MEDIAN: 9,
  WATER: 10,
  MUD: 11,
  PAVER: 12,
  SHORE: 13,
  PARKING: 14,
  FLOOR_LINO: 15,
  FLOOR_TILE: 16,
  FLOOR_WOOD: 17,
  OBRA: 18,
  FLOOR_STORE: 19,
} as const;

export type GroundId = (typeof G)[keyof typeof G];

/** Bits de `marks` */
export const MK = {
  CW_X: 1, // senda peatonal sobre calle que corre en x (franjas a lo largo de x)
  CW_Y: 2,
  STOP_PX: 4, // línea de detención sobre el borde +x de la baldosa
  STOP_NX: 8,
  STOP_PY: 16,
  STOP_NY: 32,
} as const;

/** Bits de `lanes`: línea discontinua sobre un borde de la baldosa */
export const LN = {
  PY: 1,
  NY: 2,
  PX: 4,
  NX: 8,
  YELLOW: 16,
} as const;

/** Códigos de `deco` */
export const DECO = {
  NONE: 0,
  POTHOLE: 1,
  PATCH: 2,
  MANHOLE: 3,
  CRACK: 4,
  OIL: 5,
  PUDDLE: 6,
  SNOW: 7,
  TRASH: 8,
  BIG_POTHOLE: 9,
  TIRE: 10,
} as const;

export interface GroundModel {
  w: number;
  h: number;
  seed: number;
  ground: Uint8Array;
  marks: Uint8Array;
  lanes: Uint8Array;
  deco: Uint8Array;
}

// ---------------------------------------------------------------- colores
const K = (h: string) => hex(h);
const COL = {
  void: K('#6f7466'),
  asphalt: [K('#3f444b'), K('#454a52'), K('#4b5058'), K('#52575f')],
  patch: K('#383c42'),
  patchSeam: K('#2f3238'),
  line: K('#c6c2ae'),
  lineWorn: K('#8f8f86'),
  yellow: K('#c8a646'),
  walk: [K('#868987'), K('#909391'), K('#9a9d9a')],
  walkLine: K('#777a78'),
  curb: K('#b1b2ac'),
  curbFace: K('#9c9d97'),
  curbShadow: K('#34383d'),
  dirt: [K('#6a5d4d'), K('#756755'), K('#80715c')],
  pebble: K('#958874'),
  pebbleDark: K('#5b5043'),
  steppe: [K('#7a744a'), K('#878052'), K('#948c5b'), K('#a39a66')],
  steppeDark: K('#646040'),
  yard: [K('#66704a'), K('#707b51'), K('#7b8659')],
  yardDark: K('#58613f'),
  water: [K('#566b78'), K('#5e7483'), K('#687f8f')],
  waterLight: K('#8199a7'),
  foam: K('#a4b3ba'),
  mud: [K('#5b564a'), K('#666053'), K('#716a5b')],
  mudWet: K('#7a7669'),
  paver: [K('#85817b'), K('#918c85'), K('#7b7771')],
  paverLine: K('#6d6a65'),
  shore: [K('#8a8378'), K('#9a9387'), K('#7a746a')],
  snow: [K('#dfe5ea'), K('#cfd7de')],
  lino: [K('#9aa0a2'), K('#b5b8b4')],
  linoScuff: K('#8a9092'),
  tile: [K('#c7c0b0'), K('#bdb5a4')],
  tileGrout: K('#a39b8a'),
  wood: [K('#8a6a4c'), K('#7f6145'), K('#957352')],
  woodLine: K('#664c36'),
  store: [K('#d6d6d0'), K('#cacac4')],
  storeGrout: K('#b0b0aa'),
  trash: [K('#e07a2e'), K('#f2f4f5'), K('#3f8ac0'), K('#c8413a')],
  puddle: K('#6d7f8c'),
  puddleLight: K('#9fb2bf'),
  obra: [K('#6f6152'), K('#7a6b5a'), K('#655848')],
};

// ---------------------------------------------------------------- ruido
function h2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 1442695041;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s);
  const b = h2(xi + 1, yi, s);
  const c = h2(xi, yi + 1, s);
  const d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function isRoadLike(t: number): boolean {
  return t === G.ROAD || t === G.PARKING || t === G.ROAD_DIRT;
}

function isWalkLike(t: number): boolean {
  return t === G.SIDEWALK || t === G.MEDIAN || t === G.PAVER || t === G.SIDEWALK_DIRT;
}

// ---------------------------------------------------------------- pintado

export interface PaintedChunk {
  data: Uint32Array;
  w: number;
  h: number;
  sx0: number;
  sy0: number;
  empty: boolean;
}

/** Pinta el rombo de baldosas [i0,i0+size)×[j0,j0+size). */
export function paintChunk(m: GroundModel, cx: number, cy: number, size: number): PaintedChunk {
  const i0 = cx * size;
  const j0 = cy * size;
  const sx0 = (i0 - j0 - size) * 16;
  const sy0 = (i0 + j0) * 8;
  const w = size * 32;
  const h = size * 16;
  const data = new Uint32Array(w * h);
  const i1 = Math.min(m.w, i0 + size);
  const j1 = Math.min(m.h, j0 + size);
  let empty = true;
  for (let py = 0; py < h; py++) {
    const wyPix = sy0 + py;
    const b = (wyPix + 0.5) / 8;
    for (let px = 0; px < w; px++) {
      const wxPix = sx0 + px;
      const a = (wxPix + 0.5) / 16;
      const x = (a + b) * 0.5;
      const y = (b - a) * 0.5;
      const i = Math.floor(x);
      const j = Math.floor(y);
      if (i < i0 || j < j0 || i >= i1 || j >= j1) continue;
      const c = paintPixel(m, i, j, x - i, y - j, x, y, wxPix, wyPix);
      data[py * w + px] = c;
      empty = false;
    }
  }
  return { data, w, h, sx0, sy0, empty };
}

function tileAt(m: GroundModel, i: number, j: number): number {
  if (i < 0 || j < 0 || i >= m.w || j >= m.h) return G.NONE;
  return m.ground[j * m.w + i];
}

function paintPixel(
  m: GroundModel,
  i: number,
  j: number,
  u: number,
  v: number,
  x: number,
  y: number,
  wx: number,
  wy: number,
): number {
  const idx = j * m.w + i;
  const t = m.ground[idx];
  const s = m.seed;
  const n = h2(wx, wy, s);
  const deco = m.deco[idx];

  switch (t) {
    case G.ROAD:
    case G.PARKING: {
      let c = roadBase(x, y, n, s);
      c = roadDeco(m, deco, u, v, n, c, i, j);
      const lanes = m.lanes[idx];
      if (lanes) {
        const dashAlong = (p: number) => (p * 2 - Math.floor(p * 2)) < 0.55;
        const worn = n < 0.18;
        const lc = lanes & LN.YELLOW ? COL.yellow : worn ? COL.lineWorn : COL.line;
        const th = 0.065;
        if (lanes & LN.PY && v > 1 - th && dashAlong(x)) c = lc;
        if (lanes & LN.NY && v < th && dashAlong(x)) c = lc;
        if (lanes & LN.PX && u > 1 - th && dashAlong(y)) c = lc;
        if (lanes & LN.NX && u < th && dashAlong(y)) c = lc;
      }
      const mk = m.marks[idx];
      if (mk) {
        const wornC = n < 0.22 ? COL.lineWorn : COL.line;
        if (mk & MK.CW_X && u > 0.08 && u < 0.92) {
          const f = y * 3 - Math.floor(y * 3);
          if (f < 0.5) c = wornC;
        }
        if (mk & MK.CW_Y && v > 0.08 && v < 0.92) {
          const f = x * 3 - Math.floor(x * 3);
          if (f < 0.5) c = wornC;
        }
        const st = 0.13;
        if (mk & MK.STOP_PX && u > 1 - st) c = wornC;
        if (mk & MK.STOP_NX && u < st) c = wornC;
        if (mk & MK.STOP_PY && v > 1 - st) c = wornC;
        if (mk & MK.STOP_NY && v < st) c = wornC;
      }
      return curbEdgesOnRoad(m, i, j, u, v, c);
    }
    case G.ROAD_DIRT: {
      let c = n < 0.5 ? COL.dirt[1] : n < 0.8 ? COL.dirt[0] : COL.dirt[2];
      if (n > 0.93) c = COL.pebble;
      else if (n < 0.05) c = COL.pebbleDark;
      const lf = vnoise(x * 0.8, y * 0.8, s + 5);
      if (lf < 0.28 && n < 0.6) c = COL.puddle;
      return c;
    }
    case G.SIDEWALK: {
      const lf = vnoise(x * 0.7, y * 0.7, s + 11);
      let c = n < 0.3 ? COL.walk[0] : n < 0.8 ? COL.walk[1] : COL.walk[2];
      if (lf < 0.22 && n < 0.5) c = COL.walk[0];
      const fu = u * 2 - Math.floor(u * 2);
      const fv = v * 2 - Math.floor(v * 2);
      if (fu < 0.05 || fv < 0.05) c = COL.walkLine;
      if (deco === DECO.SNOW && vnoise(x * 3, y * 3, s + 3) > 0.62) c = n < 0.5 ? COL.snow[0] : COL.snow[1];
      if (deco === DECO.CRACK && Math.abs(u - v) < 0.04) c = COL.walkLine;
      return curbOnWalk(m, i, j, u, v, c);
    }
    case G.SIDEWALK_DIRT: {
      let c = n < 0.45 ? COL.dirt[2] : n < 0.85 ? COL.dirt[1] : COL.pebble;
      if (vnoise(x * 1.5, y * 1.5, s + 2) < 0.3 && n > 0.4) c = COL.steppe[0];
      return curbOnWalk(m, i, j, u, v, c);
    }
    case G.MEDIAN: {
      let c = n < 0.4 ? COL.yard[0] : n < 0.8 ? COL.yard[1] : COL.yard[2];
      if (h2(Math.floor(wx / 2), wy, s + 4) < 0.1) c = COL.yardDark;
      return curbOnWalk(m, i, j, u, v, c);
    }
    case G.STEPPE: {
      const lf = vnoise(x * 0.35, y * 0.35, s + 21);
      const band = lf < 0.3 ? 0 : lf < 0.55 ? 1 : lf < 0.8 ? 2 : 3;
      let c = COL.steppe[band];
      if (n < 0.1) c = COL.steppe[Math.max(0, band - 1)];
      else if (n > 0.92) c = COL.steppe[Math.min(3, band + 1)];
      const tuft = h2(Math.floor(wx / 3), Math.floor(wy / 2), s + 9);
      if (tuft < 0.06) c = COL.steppeDark;
      if (deco === DECO.SNOW && vnoise(x * 2.5, y * 2.5, s + 3) > 0.6) c = n < 0.6 ? COL.snow[0] : COL.snow[1];
      if (deco === DECO.TRASH && n < 0.02) c = COL.trash[Math.floor(n * 200) % 4];
      return c;
    }
    case G.DIRT:
    case G.OBRA: {
      const pal = t === G.OBRA ? COL.obra : COL.dirt;
      let c = n < 0.4 ? pal[0] : n < 0.8 ? pal[1] : pal[2];
      if (n > 0.95) c = COL.pebble;
      if (t === G.OBRA) {
        const track = Math.abs(((x + y * 0.3) % 1.4) - 0.7);
        if (track < 0.06) c = COL.pebbleDark;
        if (vnoise(x * 0.9, y * 0.9, s + 8) < 0.2) c = COL.puddle;
      }
      return c;
    }
    case G.LOT: {
      const lf = vnoise(x * 0.8, y * 0.8, s + 31);
      let c = lf < 0.45 ? (n < 0.5 ? COL.dirt[1] : COL.dirt[2]) : n < 0.5 ? COL.steppe[1] : COL.steppe[2];
      if (n < 0.012) c = COL.trash[Math.floor(n * 400) % 4];
      if (h2(Math.floor(wx / 3), Math.floor(wy / 2), s + 13) < 0.05) c = COL.steppeDark;
      return c;
    }
    case G.YARD: {
      const lf = vnoise(x * 0.6, y * 0.6, s + 41);
      let c = lf < 0.35 ? COL.yard[0] : lf < 0.7 ? COL.yard[1] : COL.yard[2];
      if (n < 0.08) c = COL.yardDark;
      if (lf < 0.18 && n > 0.5) c = COL.dirt[1];
      if (deco === DECO.SNOW && vnoise(x * 2.5, y * 2.5, s + 3) > 0.62) c = COL.snow[n < 0.5 ? 0 : 1];
      return c;
    }
    case G.WATER: {
      const band = Math.floor((wy + Math.floor(Math.sin(wx * 0.07 + wy * 0.03) * 2)) / 3);
      let c = COL.water[(band & 1) + (n > 0.85 ? 1 : 0)];
      if (h2(Math.floor(wx / 4), wy, s + 17) < 0.035) c = COL.waterLight;
      // espuma cerca de la orilla
      const nearLand =
        (u > 0.8 && tileAt(m, i + 1, j) !== G.WATER) ||
        (v > 0.8 && tileAt(m, i, j + 1) !== G.WATER) ||
        (u < 0.2 && i > 0 && tileAt(m, i - 1, j) !== G.WATER) ||
        (v < 0.2 && j > 0 && tileAt(m, i, j - 1) !== G.WATER);
      if (nearLand && n < 0.45) c = COL.foam;
      return c;
    }
    case G.MUD: {
      const lf = vnoise(x * 0.9, y * 0.5, s + 51);
      let c = lf < 0.4 ? COL.mud[0] : lf < 0.75 ? COL.mud[1] : COL.mud[2];
      if (n > 0.9) c = COL.mudWet;
      if (lf < 0.15) c = n < 0.5 ? COL.water[1] : COL.waterLight;
      return c;
    }
    case G.SHORE: {
      let c = n < 0.35 ? COL.shore[0] : n < 0.75 ? COL.shore[1] : COL.shore[2];
      if (n > 0.96) c = COL.pebbleDark;
      return c;
    }
    case G.PAVER: {
      const row = Math.floor(y * 4);
      const off = row % 2 ? 0.125 : 0;
      const fu = (x + off) * 4 - Math.floor((x + off) * 4);
      const fv = y * 4 - row;
      let c = COL.paver[h2(Math.floor((x + off) * 4), row, s) < 0.3 ? 2 : n < 0.5 ? 0 : 1];
      if (fu < 0.12 || fv < 0.12) c = COL.paverLine;
      return curbOnWalk(m, i, j, u, v, c);
    }
    case G.FLOOR_LINO: {
      const cb = (Math.floor(x * 2) + Math.floor(y * 2)) & 1;
      let c = COL.lino[cb];
      if (n < 0.04) c = COL.linoScuff;
      return c;
    }
    case G.FLOOR_TILE: {
      const fu = x * 3 - Math.floor(x * 3);
      const fv = y * 3 - Math.floor(y * 3);
      let c = COL.tile[n < 0.5 ? 0 : 1];
      if (fu < 0.08 || fv < 0.08) c = COL.tileGrout;
      return c;
    }
    case G.FLOOR_WOOD: {
      const plank = Math.floor(y * 4);
      const off = (plank * 0.37) % 1;
      const fv = y * 4 - plank;
      const endLine = ((x + off) * 1.0) % 1;
      let c = COL.wood[h2(plank, Math.floor(x + off), s) < 0.33 ? 2 : n < 0.5 ? 0 : 1];
      if (fv < 0.1 || endLine < 0.03) c = COL.woodLine;
      return c;
    }
    case G.FLOOR_STORE: {
      const fu = x * 2 - Math.floor(x * 2);
      const fv = y * 2 - Math.floor(y * 2);
      let c = COL.store[(Math.floor(x * 2) + Math.floor(y * 2)) & 1];
      if (fu < 0.05 || fv < 0.05) c = COL.storeGrout;
      return c;
    }
    default:
      return 0;
  }
}

function roadBase(x: number, y: number, n: number, s: number): number {
  const lf = vnoise(x * 0.45, y * 0.45, s + 61);
  let k = n < 0.25 ? 0 : n < 0.7 ? 1 : n < 0.93 ? 2 : 3;
  if (lf < 0.3 && k > 0) k--;
  if (lf > 0.78 && k < 3) k++;
  return COL.asphalt[k];
}

function roadDeco(m: GroundModel, deco: number, u: number, v: number, n: number, c: number, i: number, j: number): number {
  switch (deco) {
    case DECO.POTHOLE:
    case DECO.BIG_POTHOLE: {
      const r = deco === DECO.BIG_POTHOLE ? 0.42 : 0.24;
      const du = (u - 0.5) / r;
      const dv = (v - 0.5) / (r * 0.8);
      const d = du * du + dv * dv;
      if (d < 0.55) return deco === DECO.BIG_POTHOLE && d < 0.25 ? COL.puddle : COL.patchSeam;
      if (d < 1) return n < 0.5 ? COL.walk[0] : COL.asphalt[3];
      return c;
    }
    case DECO.PATCH: {
      if (u > 0.15 && u < 0.85 && v > 0.2 && v < 0.8) {
        if (u < 0.19 || u > 0.81 || v < 0.24 || v > 0.76) return COL.patchSeam;
        return COL.patch;
      }
      return c;
    }
    case DECO.MANHOLE: {
      const du = u - 0.5;
      const dv = v - 0.5;
      const d = du * du + dv * dv;
      if (d < 0.02) return (Math.floor(u * 12) + Math.floor(v * 12)) & 1 ? COL.walkLine : COL.patchSeam;
      if (d < 0.028) return COL.patchSeam;
      return c;
    }
    case DECO.CRACK: {
      const line = Math.abs(v - 0.5 - Math.sin(u * 9 + i) * 0.12);
      if (line < 0.035) return COL.patchSeam;
      return c;
    }
    case DECO.OIL: {
      const du = (u - 0.45) / 0.3;
      const dv = (v - 0.55) / 0.22;
      if (du * du + dv * dv < 1 && n < 0.8) return COL.patch;
      return c;
    }
    case DECO.PUDDLE: {
      const du = (u - 0.5) / 0.38;
      const dv = (v - 0.5) / 0.26;
      const d = du * du + dv * dv;
      if (d < 1) return n < 0.12 || (Math.abs(u - v) < 0.05 && d < 0.6) ? COL.puddleLight : COL.puddle;
      return c;
    }
    case DECO.TIRE: {
      const f = (u + v * 0.1) % 0.5;
      if (f < 0.05 && n < 0.7) return COL.patch;
      return c;
    }
    default:
      void m;
      void j;
      return c;
  }
}

/** Sobre el asfalto: el cordón de la vereda de atrás muestra su cara; el de adelante, una sombra. */
function curbEdgesOnRoad(m: GroundModel, i: number, j: number, u: number, v: number, c: number): number {
  const e = 0.07;
  if (u < e && isWalkLike(tileAt(m, i - 1, j))) return COL.curbFace;
  if (v < e && isWalkLike(tileAt(m, i, j - 1))) return COL.curbFace;
  if (u > 1 - e && isWalkLike(tileAt(m, i + 1, j))) return COL.curbShadow;
  if (v > 1 - e && isWalkLike(tileAt(m, i, j + 1))) return COL.curbShadow;
  return c;
}

function curbOnWalk(m: GroundModel, i: number, j: number, u: number, v: number, c: number): number {
  const e = 0.08;
  if (u > 1 - e && isRoadLike(tileAt(m, i + 1, j))) return COL.curb;
  if (v > 1 - e && isRoadLike(tileAt(m, i, j + 1))) return COL.curb;
  if (u < e && isRoadLike(tileAt(m, i - 1, j))) return COL.curb;
  if (v < e && isRoadLike(tileAt(m, i, j - 1))) return COL.curb;
  return c;
}
