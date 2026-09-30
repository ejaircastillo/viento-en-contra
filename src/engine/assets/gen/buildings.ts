import { Face, type PixelCanvas } from '../PixelCanvas';
import { C, shade, mix, type Packed } from '../Palette';
import { Rng, hashStr } from '../../core/math';
import { isoCanvas, type IsoPainter } from './iso';
import { drawText, drawTextOnFace, fitText, measureText } from '../BitmapFont';
import { drawLogo } from './logos';
import type { GenOutput } from '../AssetRegistry';

/**
 * Edificios placeholder. Caras visibles: "L" = +y (abajo-izquierda, iluminada),
 * "R" = +x (abajo-derecha, en sombra). u se mide en baldosas a lo largo de la cara.
 * El ancla (ax, ay) del resultado es la esquina superior de la huella (x=0, y=0, z=0).
 */

export type FaceId = 'L' | 'R';

export interface SignSpec {
  face: FaceId;
  u0: number;
  u1: number;
  z0: number;
  z1: number;
  bg?: string;
  fg: string;
  text: string;
  text2?: string;
  logo?: string;
  style?: 'band' | 'board' | 'painted' | 'banner' | 'paper';
  /** Texto para la "lectura ampliada" del cartel (ver SignCaption). */
  caption?: string;
}

export type BuildingDetail =
  | 'gas'
  | 'dish'
  | 'chimney'
  | 'antenna'
  | 'tank'
  | 'ac'
  | 'reja'
  | 'awning'
  | 'columns'
  | 'steps'
  | 'kiosk'
  | 'mural'
  | 'graffiti'
  | 'lamp'
  | 'taped';

export interface BuildingSpec {
  w: number;
  d: number;
  floors?: number;
  floorH?: number;
  wall: string;
  wall2?: string;
  trim?: string;
  roof: 'gableX' | 'gableY' | 'shed' | 'flat';
  roofColor: string;
  roofH?: number;
  door?: { face: FaceId; u: number; kind?: 'wood' | 'glass' | 'metal' | 'double' };
  windows?: 'none' | 'few' | 'normal' | 'many';
  storefront?: { face: FaceId; u0: number; u1: number; awning?: string };
  signs?: SignSpec[];
  /** Cartel sobre el techo, de frente a la cámara (marcas: se lee de lejos). */
  roofSign?: { text: string; text2?: string; bg: string; fg: string; logo?: string };
  chiflonera?: boolean;
  details?: BuildingDetail[];
  seed: number;
}

export function buildingKey(spec: BuildingSpec): string {
  return 'bld:' + hashStr(JSON.stringify(spec)).toString(36);
}

const CURTAINS = ['#b9a27a', '#8f6b6b', '#6f8a7a', '#c8c0a8', '#7d6f95'];

export function drawBuilding(spec: BuildingSpec): GenOutput {
  const rng = new Rng(spec.seed * 7919 + 13);
  const floors = spec.floors ?? 1;
  const floorH = spec.floorH ?? 20;
  const flat = spec.roof === 'flat';
  const wallH = floors * floorH + (flat ? 3 : 0);
  const span = spec.roof === 'gableX' ? spec.d : spec.roof === 'gableY' ? spec.w : spec.d;
  const roofH =
    spec.roofH ?? (flat ? 0 : spec.roof === 'shed' ? 7 : Math.max(6, Math.min(16, Math.round(span * 5))));
  const details = new Set(spec.details ?? []);
  const roofSignH = spec.roofSign ? (spec.roofSign.text2 ? 2 : 1) * 9 + 4 + 7 : 0;
  const extraH = Math.max(roofSignH + 2, details.has('antenna') ? 14 : details.has('chimney') || details.has('tank') ? 10 : 2);
  const { pc, iso, ax, ay } = isoCanvas(spec.w, spec.d, wallH + roofH + extraH, 4);

  const W = spec.w;
  const D = spec.d;
  const chif = !!spec.chiflonera && !!spec.door;
  const Dm = chif && spec.door!.face === 'L' ? D - 0.5 : D;
  const Wm = chif && spec.door!.face === 'R' ? W - 0.5 : W;

  const wall = C(spec.wall);
  const wallR = shade(wall, 0.8);
  const wallTop = shade(wall, 1.1);
  const trim = C(spec.trim ?? 'frame');

  // sombra de contacto
  iso.groundShadow(-0.1, -0.1, W + 0.25, D + 0.25, 45);

  // volumen principal
  const faces = iso.box(0, 0, Wm, Dm, 0, wallH, { top: wallTop, left: wall, right: wallR });
  const L = faces.left;
  const R = faces.right;
  const faceOf = (f: FaceId) => (f === 'L' ? L : R);
  const kOf = (f: FaceId) => (f === 'L' ? 1 : 0.84);

  // zócalo / banda inferior
  if (spec.wall2) {
    const w2 = C(spec.wall2);
    L.rect(0, L.len, 0, Math.min(floorH, 9), w2);
    R.rect(0, R.len, 0, Math.min(floorH, 9), shade(w2, 0.8));
    L.hline(0, L.len, 9, shade(wall, 0.9));
    R.hline(0, R.len, 9, shade(wallR, 0.9));
  } else {
    L.hline(0, L.len, 0, shade(wall, 0.82));
    R.hline(0, R.len, 0, shade(wallR, 0.82));
  }
  for (let f = 1; f < floors; f++) {
    L.hline(0, L.len, f * floorH, shade(wall, 0.86));
    R.hline(0, R.len, f * floorH, shade(wallR, 0.86));
  }

  // --------------------------------------------------------------- aberturas
  const blocked: Record<FaceId, [number, number][]> = { L: [], R: [] };
  const doorW = spec.door?.kind === 'double' ? 10 : 6;
  if (spec.door && !chif) blocked[spec.door.face].push([spec.door.u * 16 - 3, spec.door.u * 16 + doorW + 3]);
  if (spec.door && chif) blocked[spec.door.face].push([spec.door.u * 16 - 8, spec.door.u * 16 + 14]);
  if (spec.storefront) blocked[spec.storefront.face].push([spec.storefront.u0 * 16 - 2, spec.storefront.u1 * 16 + 2]);
  if (details.has('kiosk') && spec.door) {
    const kf: FaceId = spec.door.face;
    const ku = spec.door.u * 16 + (chif ? 18 : 12);
    blocked[kf].push([ku - 2, ku + 14]);
  }

  const drawWindow = (face: Face, k: number, u0: number, zs: number, ww: number, wh: number, groundFloor: boolean) => {
    const frame = shade(trim, k);
    const glass = shade(C('glass'), k);
    const lit = rng.chance(0.12);
    face.rect(u0 - 1, u0 + ww + 1, zs - 1, zs + wh + 1, frame);
    face.rect(u0, u0 + ww, zs, zs + wh, lit ? shade(C('#caa860'), k) : glass);
    if (!lit) {
      face.rect(u0, u0 + 1, zs + 2, zs + wh, shade(C('glassLight'), k));
      face.px(u0 + 1, zs + wh - 1, shade(C('glassLight'), k));
    }
    if (ww >= 6) face.rect(u0 + (ww >> 1), u0 + (ww >> 1) + 1, zs, zs + wh, frame);
    if (rng.chance(0.45)) {
      const cc = shade(C(rng.pick(CURTAINS)), k);
      face.rect(u0, u0 + 2, zs + 1, zs + wh, cc);
      if (rng.chance(0.5)) face.rect(u0 + ww - 2, u0 + ww, zs + 1, zs + wh, cc);
    }
    face.rect(u0 - 1, u0 + ww + 1, zs - 2, zs - 1, shade(wall, k * 0.72));
    if (groundFloor && details.has('reja')) {
      for (let u = u0; u < u0 + ww; u += 2) face.rect(u, u + 1, zs, zs + wh, shade(C('slate8'), k));
      face.hline(u0 - 1, u0 + ww + 1, zs + (wh >> 1), shade(C('slate8'), k));
    }
  };

  const placeWindows = (fid: FaceId) => {
    if (spec.windows === 'none') return;
    const face = faceOf(fid);
    const k = kOf(fid);
    const density = spec.windows ?? 'normal';
    const pitch = density === 'many' ? 12 : density === 'few' ? 26 : 16;
    const ww = density === 'many' ? 6 : 6;
    const wh = Math.min(10, floorH - 9);
    const n = Math.max(0, Math.floor((face.len - 6) / pitch));
    if (n === 0) return;
    const used = n * pitch;
    const start = Math.floor((face.len - used) / 2 + (pitch - ww) / 2) & ~1;
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < n; i++) {
        const u0 = start + i * pitch;
        if (f === 0 && blocked[fid].some(([a, b]) => u0 + ww + 1 > a && u0 - 1 < b)) continue;
        if (u0 < 2 || u0 + ww > face.len - 2) continue;
        drawWindow(face, k, u0, f * floorH + 6, ww, wh, f === 0);
      }
    }
  };
  placeWindows('L');
  placeWindows('R');

  // vidriera comercial
  if (spec.storefront) {
    const sf = spec.storefront;
    const face = faceOf(sf.face);
    const k = kOf(sf.face);
    const u0 = Math.round(sf.u0 * 16) & ~1;
    const u1 = Math.round(sf.u1 * 16) & ~1;
    const zTop = Math.min(floorH - 5, 14);
    face.rect(u0 - 1, u1 + 1, 1, zTop + 1, shade(C('slate7'), k));
    face.rect(u0, u1, 2, zTop, shade(C('glass'), k));
    for (let u = u0; u < u1; u += 2) {
      // mercadería colorida en la vidriera
      const col = rng.pick(['#c8413a', '#e0b43c', '#3f8ac0', '#5aa35a', '#e07a2e', '#d9d2c0']);
      if (rng.chance(0.7)) face.rect(u, u + 1, 2, 2 + rng.int(1, 4), shade(C(col), k));
    }
    for (let u = u0 + 10; u < u1 - 2; u += 12) face.rect(u, u + 1, 2, zTop, shade(C('slate6'), k));
    face.rect(u0, u0 + 1, 5, zTop - 1, shade(C('glassLight'), k));
    if (sf.awning) {
      const aw = C(sf.awning);
      for (let u = u0 - 2; u < u1 + 2; u++) {
        const stripe = Math.floor(u / 4) % 2 === 0 ? aw : shade(C('white'), k);
        face.rectFree(u, u + 1, zTop + 2, zTop + 5, shade(stripe, k));
      }
      face.rectFree(u0 - 2, u1 + 2, zTop + 1, zTop + 2, shade(aw, k * 0.7));
    }
  }

  // puerta (con o sin chiflonera)
  if (spec.door) {
    const df = spec.door.face;
    let face = faceOf(df);
    let k = kOf(df);
    let u0 = Math.round(spec.door.u * 16) & ~1;
    if (chif) {
      // cabina rompevientos ("chiflonera"), típica de la Patagonia
      const cu = spec.door.u;
      let cf: { left: Face; right: Face };
      if (df === 'L') {
        cf = iso.box(cu - 0.2, Dm, cu + 0.55, D - 0.02, 0, 16, {
          top: shade(C(spec.roofColor), 1.05),
          left: wall,
          right: wallR,
        });
        face = cf.left;
        k = 1;
        u0 = 3;
        cf.right.rect(2, cf.right.len - 2, 7, 12, shade(C('glass'), 0.84));
      } else {
        cf = iso.box(Wm, cu - 0.2, W - 0.02, cu + 0.55, 0, 16, {
          top: shade(C(spec.roofColor), 1.05),
          left: wall,
          right: wallR,
        });
        face = cf.right;
        k = 0.84;
        u0 = 3;
        cf.left.rect(2, cf.left.len - 2, 7, 12, C('glass'));
      }
    }
    const kind = spec.door.kind ?? 'wood';
    const dw = kind === 'double' ? 10 : 6;
    const dh = 14;
    const dc =
      kind === 'glass' || kind === 'double' ? C('glass') : kind === 'metal' ? C('slate6') : C('door');
    face.rect(u0 - 1, u0 + dw + 1, 0, dh + 1, shade(trim, k));
    face.rect(u0, u0 + dw, 0, dh, shade(dc, k));
    if (kind === 'glass' || kind === 'double') {
      face.rect(u0, u0 + 1, 2, dh - 1, shade(C('glassLight'), k));
      if (kind === 'double') face.rect(u0 + 5, u0 + 6, 0, dh, shade(trim, k));
    } else {
      face.rect(u0 + 1, u0 + dw - 1, dh - 5, dh - 2, shade(C('glass'), k));
      face.px(u0 + dw - 2, 6, shade(C('hazard'), k));
    }
    if (details.has('steps')) face.rectFree(u0 - 3, u0 + dw + 3, 0, 1, shade(C('slate2'), k));
    if (details.has('lamp')) {
      face.px(u0 + dw + 2, dh, shade(C('slate8'), k));
      face.px(u0 + dw + 2, dh - 1, shade(C('headlight'), k));
    }
  }

  // ventana de kiosco con reja y golosinas
  if (details.has('kiosk') && spec.door) {
    const kf: FaceId = spec.door.face;
    const face = chif ? faceOf(kf) : faceOf(kf);
    const k = kOf(kf);
    const u0 = (Math.round(spec.door.u * 16) + (chif ? 18 : 12)) & ~1;
    face.rect(u0 - 1, u0 + 11, 4, 16, shade(C('frame'), k));
    face.rect(u0, u0 + 10, 5, 15, shade(C('#4a3f36'), k));
    for (let u = u0; u < u0 + 10; u++) {
      for (let z = 5; z < 11; z += 2) {
        const col = ['#e0b43c', '#c8413a', '#3f8ac0', '#f2f4f5', '#5aa35a', '#e07a2e'][(u * 3 + z) % 6];
        face.px(u, z, shade(C(col), k));
      }
    }
    for (let u = u0; u < u0 + 10; u += 2) face.rect(u, u + 1, 5, 15, shade(C('slate8'), k));
    face.hline(u0 - 1, u0 + 11, 10, shade(C('slate8'), k));
    face.rect(u0 - 1, u0 + 11, 3, 4, shade(C('wood'), k));
  }

  // --------------------------------------------------------------- detalles de pared
  if (details.has('gas')) {
    const u = Math.max(4, R.len - 10) & ~1;
    R.rect(u, u + 4, 1, 6, shade(C('slate5'), 0.84));
    R.rect(u + 1, u + 3, 3, 5, shade(C('slate3'), 0.84));
    R.rect(u + 4, u + 5, 3, 13, shade(C('hazard'), 0.84));
  }
  if (details.has('ac')) {
    const u = 6 + rng.int(0, 3) * 2;
    R.rect(u, u + 6, floorH - 7, floorH - 3, shade(C('slate2'), 0.84));
    R.hline(u, u + 6, floorH - 5, shade(C('slate4'), 0.84));
  }
  if (details.has('dish')) {
    const u = 4 + rng.int(0, 2) * 2;
    L.rect(u, u + 3, wallH - 7, wallH - 4, C('slate1'));
    L.px(u + 3, wallH - 6, C('slate5'));
  }
  if (details.has('mural')) {
    const cols = ['#74acdf', '#f6b40e', '#5aa35a', '#e07a2e'];
    for (let u = 2; u < L.len - 2; u++) {
      const c = C(cols[Math.floor(u / 6) % cols.length]);
      L.rect(u, u + 1, 2, 5 + ((u >> 2) % 3), c);
    }
  }
  if (details.has('graffiti')) {
    const g = C(rng.pick(['#3f8ac0', '#c8413a', '#2f2f2f', '#b8467e']));
    let u = rng.int(4, Math.max(5, L.len - 12));
    let z = rng.int(3, 7);
    for (let i = 0; i < 10; i++) {
      L.px(u, z, g);
      u++;
      z += rng.int(-1, 1);
      z = Math.max(2, Math.min(9, z));
    }
  }
  if (details.has('taped')) {
    // vidrieras tapadas con papel madera (local cerrado)
    const face = spec.storefront ? faceOf(spec.storefront.face) : L;
    const k = spec.storefront && spec.storefront.face === 'R' ? 0.84 : 1;
    const u0 = spec.storefront ? Math.round(spec.storefront.u0 * 16) : 4;
    const u1 = spec.storefront ? Math.round(spec.storefront.u1 * 16) : L.len - 4;
    face.rect(u0, u1, 2, Math.min(floorH - 5, 14), shade(C('#a88a5c'), k));
    for (let u = u0 + 3; u < u1; u += 7) face.rect(u, u + 1, 2, 13, shade(C('#8c7048'), k));
  }
  if (details.has('columns')) {
    const n = Math.max(2, Math.floor(L.len / 22));
    for (let i = 0; i < n; i++) {
      const u = Math.round(((i + 0.5) * L.len) / n) & ~1;
      L.rect(u - 1, u + 2, 0, floorH * Math.min(2, floors) - 2, C('slate1'));
      L.rect(u + 1, u + 2, 0, floorH * Math.min(2, floors) - 2, C('slate3'));
    }
    L.rect(0, L.len, floorH * Math.min(2, floors) - 3, floorH * Math.min(2, floors), C('slate1'));
  }

  // --------------------------------------------------------------- techo
  const roofLit = C(spec.roofColor);
  const roofDark = shade(roofLit, 0.78);
  const roofLine = shade(roofLit, 0.66);
  const ridge = shade(roofLit, 1.2);
  const e = 0.125;
  const H = wallH;
  const top = H + roofH;
  if (spec.roof === 'gableX') {
    iso.poly3(
      [
        [-e, -e, H - 1],
        [Wm + e, -e, H - 1],
        [Wm + e, Dm / 2, top],
        [-e, Dm / 2, top],
      ],
      roofDark,
    );
    iso.poly3(
      [
        [Wm, 0, H],
        [Wm, Dm, H],
        [Wm, Dm / 2, top],
      ],
      wallR,
    );
    iso.poly3(
      [
        [-e, Dm / 2, top],
        [Wm + e, Dm / 2, top],
        [Wm + e, Dm + e, H - 1],
        [-e, Dm + e, H - 1],
      ],
      roofLit,
    );
    for (let x = 0.125; x < Wm; x += 0.25) iso.line3([x, Dm / 2, top - 1], [x, Dm + e, H - 1], roofLine);
    iso.line3([-e, Dm / 2, top], [Wm + e, Dm / 2, top], ridge);
    iso.line3([-e, Dm + e, H - 1], [Wm + e, Dm + e, H - 1], shade(roofLit, 0.6));
  } else if (spec.roof === 'gableY') {
    iso.poly3(
      [
        [-e, -e, H - 1],
        [Wm / 2, -e, top],
        [Wm / 2, Dm + e, top],
        [-e, Dm + e, H - 1],
      ],
      roofLit,
    );
    iso.poly3(
      [
        [0, Dm, H],
        [Wm, Dm, H],
        [Wm / 2, Dm, top],
      ],
      wall,
    );
    iso.poly3(
      [
        [Wm / 2, -e, top],
        [Wm + e, -e, H - 1],
        [Wm + e, Dm + e, H - 1],
        [Wm / 2, Dm + e, top],
      ],
      roofDark,
    );
    for (let y = 0.125; y < Dm; y += 0.25) {
      iso.line3([Wm / 2, y, top - 1], [Wm + e, y, H - 1], shade(roofDark, 0.85));
      iso.line3([Wm / 2, y, top - 1], [-e, y, H - 1], roofLine);
    }
    iso.line3([Wm / 2, -e, top], [Wm / 2, Dm + e, top], ridge);
  } else if (spec.roof === 'shed') {
    iso.poly3(
      [
        [Wm, 0, H],
        [Wm, Dm, H],
        [Wm, 0, top],
      ],
      wallR,
    );
    iso.poly3(
      [
        [-e, -e, top],
        [Wm + e, -e, top],
        [Wm + e, Dm + e, H - 1],
        [-e, Dm + e, H - 1],
      ],
      roofLit,
    );
    for (let x = 0.125; x < Wm; x += 0.25) iso.line3([x, -e, top - 1], [x, Dm + e, H - 1], roofLine);
    iso.line3([-e, Dm + e, H - 1], [Wm + e, Dm + e, H - 1], shade(roofLit, 0.6));
  } else {
    // techo plano con parapeto
    iso.top(0.12, 0.12, Wm - 0.12, Dm - 0.12, H, mix(C('slate5'), roofLit, 0.25));
    if (details.has('tank')) {
      const tx = Math.min(Wm - 0.8, 0.4 + rng.next() * 0.4);
      iso.box(tx, 0.3, tx + 0.45, 0.75, H, H + 8, C('slate7'));
    }
    if (details.has('ac')) iso.box(Wm - 0.7, Dm - 0.7, Wm - 0.35, Dm - 0.35, H, H + 4, C('slate2'));
  }

  // chimenea / antena
  if (details.has('chimney')) {
    const cx = spec.roof === 'gableY' ? Wm * 0.3 : Wm * 0.7;
    const cy = spec.roof === 'gableY' ? Dm * 0.5 : Dm * 0.3;
    const zb = spec.roof === 'flat' ? H : H + Math.round(roofH * 0.6);
    iso.box(cx, cy, cx + 0.18, cy + 0.18, zb, zb + 9, C('slate6'));
    iso.top(cx - 0.03, cy - 0.03, cx + 0.21, cy + 0.21, zb + 9, C('slate8'));
  }
  if (details.has('antenna')) {
    const [px, py] = iso.P(Wm * 0.35, Dm * 0.4, top);
    pc.vline(Math.round(px), Math.round(py) - 13, Math.round(py), C('slate7'));
    pc.hline(Math.round(px) - 3, Math.round(px) + 3, Math.round(py) - 11, C('slate7'));
    pc.hline(Math.round(px) - 2, Math.round(px) + 2, Math.round(py) - 8, C('slate7'));
  }

  // --------------------------------------------------------------- carteles
  for (const s of spec.signs ?? []) drawSign(iso, faceOf(s.face), kOf(s.face), s);
  if (spec.roofSign) drawRoofSign(pc, iso, spec.roofSign, W / 2, D / 2, top);

  pc.outline(C('ink', 200));
  return { pc, anchorX: ax, anchorY: ay };
}

/** Cartel frontal sobre el techo, apoyado en dos patitas, centrado sobre la tapa del edificio. */
function drawRoofSign(pc: PixelCanvas, iso: IsoPainter, rs: NonNullable<BuildingSpec['roofSign']>, cx: number, cy: number, top: number): void {
  const lines = rs.text2 ? [rs.text, rs.text2] : [rs.text];
  const logoW = rs.logo ? 11 : 0;
  const tw = Math.max(...lines.map((l) => measureText(l, 1)));
  const bw = tw + logoW + 8;
  const bh = lines.length * 9 + 4;
  const [px, py] = iso.P(cx, cy, top);
  const x0 = Math.round(px - bw / 2);
  const legs = 5;
  const y0 = Math.round(py) - legs - bh;
  const bg = C(rs.bg);
  for (const lx of [x0 + 5, x0 + bw - 6]) {
    pc.vline(lx, y0 + bh, y0 + bh + legs, C('slate7'));
    pc.vline(lx + 1, y0 + bh, y0 + bh + legs, C('slate8'));
  }
  pc.rect(x0, y0, bw, bh, bg);
  pc.rect(x0 + 1, y0 + bh, bw, 1, shade(bg, 0.55));
  pc.rect(x0 + bw, y0 + 1, 1, bh, shade(bg, 0.55));
  pc.hline(x0, x0 + bw - 1, y0, shade(bg, 1.2));
  let tx = x0 + 4;
  if (rs.logo) {
    drawLogo(rs.logo, (x, y, c) => pc.set(tx + x, y0 + Math.floor((bh - 9) / 2) + y, c), 9);
    tx += logoW;
  }
  lines.forEach((l, i) => {
    const w = measureText(l, 1);
    drawText(pc, l, tx + Math.floor((tw - w) / 2), y0 + 4 + i * 9, C(rs.fg));
  });
}

function drawSign(iso: IsoPainter, face: Face, k: number, s: SignSpec): void {
  void iso;
  const u0 = Math.round(s.u0 * 16) & ~1;
  const u1 = Math.round(s.u1 * 16) & ~1;
  const fg = shade(C(s.fg), k);
  const style = s.style ?? 'band';
  const bg = s.bg ? shade(C(s.bg), k) : 0;
  const h = s.z1 - s.z0;
  if (style === 'paper') {
    face.rect(u0, u1, s.z0, s.z1, shade(C('white'), k));
    for (let z = s.z0 + 1; z < s.z1 - 1; z += 2) face.hline(u0 + 1, u1 - 1, z, shade(C('slate5'), k));
    return;
  }
  if (style !== 'painted' && bg) {
    face.rectFree(u0, u1, s.z0, s.z1, bg);
    if (style === 'board' || style === 'band') {
      face.hline(u0, u1, s.z0, shade(bg, 0.7));
      face.hline(u0, u1, s.z1 - 1, shade(bg, 1.15));
    }
    if (style === 'banner') {
      for (let u = u0; u < u1; u += 4) face.px(u + 2, s.z0, shade(bg, 0.6));
      face.rectFree(u0 - 1, u0, s.z0, s.z1, shade(C('slate8'), k));
      face.rectFree(u1, u1 + 1, s.z0, s.z1, shade(C('slate8'), k));
    }
  }
  let cu = u0 + 2;
  if (s.logo) {
    const size = Math.min(h - 2, 11);
    const lw = drawLogo(s.logo, (x, y, c) => face.px(cu + x, s.z1 - 2 - y - Math.floor((h - 2 - size) / 2), shade(c, k)), size);
    cu += lw + 2;
  }
  const avail = u1 - cu - 2;
  const lineH = 9;
  const maxLines = Math.max(1, Math.floor((h + 1) / lineH));
  const fit = fitText(s.text2 ? [s.text, s.text2] : [s.text], avail, maxLines);
  const totalH = fit.lines.length * lineH - 2;
  let zTop = s.z1 - 1 - Math.max(0, Math.floor((h - totalH) / 2)) - 1;
  for (const line of fit.lines) {
    const w = measureText(line, fit.spacing);
    const start = cu + Math.max(0, Math.floor((avail - w) / 2));
    drawTextOnFace(face, line, start, zTop, fg, { spacing: fit.spacing });
    zTop -= lineH;
  }
}
