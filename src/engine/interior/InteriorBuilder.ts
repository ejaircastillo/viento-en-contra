import { G, type GroundModel } from '../world/ground';
import type { SolidRect, StaticObject, MarkerDef, ZoneDef, SignCaption } from '../world/types';
import type { InteriorDef, WallItem } from '../mission/types';
import { propGen, propKey } from '../world/PropRegistry';
import { isoCanvas } from '../assets/gen/iso';
import { C, shade, type Packed } from '../assets/Palette';
import { drawTextOnFace, fitText, measureText } from '../assets/BitmapFont';
import { drawLogo } from '../assets/gen/logos';
import type { Face } from '../assets/PixelCanvas';
import type { GenOutput } from '../assets/AssetRegistry';
import { hashStr } from '../core/math';

/**
 * Interiores: una habitación isométrica "en corte" (se ven las dos paredes del fondo).
 * El piso usa el mismo pintor de suelo que la ciudad; las paredes son una textura con sus
 * ventanas, puertas, carteles y afiches; los muebles son props con huella (orden por tiras).
 */
export interface InteriorModel {
  def: InteriorDef;
  w: number;
  h: number;
  ox: number;
  oy: number;
  ground: GroundModel;
  statics: StaticObject[];
  solids: SolidRect[];
  solidGrid: Map<number, SolidRect[]>;
  walkGrid: Uint8Array;
  markers: Map<string, MarkerDef>;
  zones: Map<string, ZoneDef>;
  wall: StaticObject;
  captions: SignCaption[];
}

/** Margen de baldosas alrededor de la habitación (vacío). */
const M = 3;

function drawWallItem(face: Face, k: number, it: WallItem, wallH: number): void {
  const u0 = Math.round(it.u * 16) & ~1;
  const u1 = Math.round((it.u + it.w) * 16) & ~1;
  const z0 = it.z;
  const z1 = Math.min(wallH - 2, it.z + it.h);
  const sh = (c: Packed) => shade(c, k);
  switch (it.kind) {
    case 'window': {
      face.rect(u0 - 1, u1 + 1, z0 - 1, z1 + 1, sh(C('frame')));
      face.rect(u0, u1, z0, z1, sh(C('#aebfcc')));
      for (let u = u0; u < u1; u++) {
        // cielo encapotado y una línea de techos lejanos
        const hz = z0 + 3 + ((u * 7) % 5 === 0 ? 1 : 0);
        face.rect(u, u + 1, z0, hz, sh(C('#7d8a93')));
      }
      for (let i = 0; i < 4; i++) {
        const zz = z0 + 6 + i * 3;
        if (zz < z1) face.hline(u0 + 2 + i * 3, Math.min(u1 - 1, u0 + 9 + i * 3), zz, sh(C('#e3ecf2')));
      }
      face.rect(Math.round((u0 + u1) / 2), Math.round((u0 + u1) / 2) + 1, z0, z1, sh(C('frame')));
      face.hline(u0 - 1, u1 + 1, z0 - 2, sh(C('slate2')));
      break;
    }
    case 'door': {
      face.rect(u0 - 1, u1 + 1, 0, z1 + 1, sh(C('slate7')));
      face.rect(u0, u1, 0, z1, sh(C('#8fa6b5')));
      face.rect(u0 + 1, u0 + 2, 2, z1 - 1, sh(C('#cfdde6')));
      face.rect(u1 - 3, u1 - 2, Math.floor(z1 / 2) - 1, Math.floor(z1 / 2) + 1, sh(C('slate8')));
      if (it.text) {
        const tw = measureText(it.text, 0);
        const su = Math.floor((u0 + u1 - tw) / 2);
        face.rect(su - 2, su + tw + 2, z1 + 3, z1 + 12, sh(C('signGreen')));
        drawTextOnFace(face, it.text, su, z1 + 10, sh(C('white')), { spacing: 0 });
      }
      break;
    }
    case 'poster':
    case 'sign':
    case 'board': {
      const bg = C(it.bg ?? (it.kind === 'board' ? '#9c7a52' : '#efe9da'));
      face.rect(u0, u1, z0, z1, sh(bg));
      face.hline(u0, u1, z0, sh(shade(bg, 0.7)));
      if (it.kind === 'board') {
        for (let i = 0; i < 5; i++) {
          const pu = u0 + 2 + ((i * 7) % Math.max(4, u1 - u0 - 6));
          const pz = z0 + 2 + ((i * 5) % Math.max(3, z1 - z0 - 6));
          face.rect(pu, pu + 4, pz, pz + 4, sh(C(i % 2 ? '#f2f4f5' : '#f0d27a')));
        }
      }
      let cu = u0 + 2;
      if (it.logo) {
        const lw = drawLogo(it.logo, (x, y, c) => face.px(cu + x, z1 - 2 - y, sh(c)), Math.min(9, z1 - z0 - 3));
        cu += lw + 2;
      }
      const fg = sh(C(it.fg ?? 'ink'));
      const avail = u1 - cu - 2;
      const fit = fitText([it.text, it.text2].filter(Boolean) as string[], avail, Math.max(1, Math.floor((z1 - z0 + 1) / 9)));
      let zt = z1 - 2;
      for (const l of fit.lines) {
        const tw = measureText(l, fit.spacing);
        drawTextOnFace(face, l, cu + Math.max(0, Math.floor((avail - tw) / 2)), zt, fg, { spacing: fit.spacing });
        zt -= 9;
      }
      if (it.kind === 'poster') face.px(Math.round((u0 + u1) / 2), z1 - 1, sh(C('signRed')));
      break;
    }
    case 'clock': {
      const cu = Math.round((u0 + u1) / 2);
      const cz = Math.round((z0 + z1) / 2);
      const r = Math.max(3, Math.floor((z1 - z0) / 2));
      for (let du = -r; du <= r; du++)
        for (let dz = -r; dz <= r; dz++) {
          const d = Math.hypot(du, dz);
          if (d <= r) face.px(cu + du, cz + dz, sh(d > r - 1 ? C('slate7') : C('white')));
        }
      face.rect(cu, cu + 1, cz, cz + r - 1, sh(C('ink')));
      face.rect(cu, cu + r - 1, cz, cz + 1, sh(C('ink')));
      break;
    }
    case 'heater': {
      face.rect(u0, u1, z0, z1, sh(C('#d9d4c4')));
      for (let u = u0 + 1; u < u1 - 1; u += 2) face.rect(u, u + 1, z0 + 1, z1 - 1, sh(C('slate3')));
      face.px(u1 - 2, z0 + 1, sh(C('lightRed')));
      break;
    }
    case 'frame': {
      face.rect(u0 - 1, u1 + 1, z0 - 1, z1 + 1, sh(C('wood')));
      face.rect(u0, u1, z0, z1, sh(C('#9fb7c9')));
      // montañas y lago (paisaje genérico patagónico)
      for (let u = u0; u < u1; u++) {
        const t = (u - u0) / Math.max(1, u1 - u0);
        const mh = Math.round((z1 - z0) * (0.55 + 0.3 * Math.abs(Math.sin(t * 5.2))));
        face.rect(u, u + 1, z0 + 2, z0 + 2 + Math.max(1, mh - 4), sh(C('#6d7f8f')));
        face.rect(u, u + 1, z0, z0 + 2, sh(C('#4f7a8a')));
      }
      break;
    }
  }
}

function drawWalls(def: InteriorDef): GenOutput {
  const [W, D] = def.size;
  const H = def.wallH;
  const T = 0.25;
  const { pc, iso, ax, ay } = isoCanvas(W + T, D + T, H + 4, 3);
  // la huella de la textura empieza en (-T, -T): corremos el pintor
  const shift = (x: number, y: number): [number, number] => [x + T, y + T];
  const wall = C(def.wallColor);
  const low = def.wallLow ? C(def.wallLow) : shade(wall, 0.85);
  const topC = shade(wall, 0.6);
  // pared del fondo (a lo largo de x, en y=0) y pared izquierda (a lo largo de y, en x=0)
  const [bx0, by0] = shift(0, -T);
  const [bx1, by1] = shift(W, 0);
  const back = iso.box(bx0, by0, bx1, by1, 0, H, { top: topC, left: wall, right: shade(wall, 0.8) });
  const [lx0, ly0] = shift(-T, -T);
  const [lx1, ly1] = shift(0, D);
  const left = iso.box(lx0, ly0, lx1, ly1, 0, H, { top: topC, left: shade(wall, 0.9), right: shade(wall, 0.84) });
  // zócalo
  back.left.rect(0, back.left.len, 0, 8, low);
  back.left.hline(0, back.left.len, 8, shade(low, 1.15));
  left.right.rect(0, left.right.len, 0, 8, shade(low, 0.84));
  left.right.hline(0, left.right.len, 8, shade(low, 0.96));
  for (const it of def.items) {
    if (it.wall === 'back') drawWallItem(back.left, 1, it, H);
    else {
      // en la pared izquierda u corre de y = D hacia y = 0: convertimos para que u=0 sea el fondo
      const flipped = { ...it, u: D - it.u - it.w };
      drawWallItem(left.right, 0.84, flipped, H);
    }
  }
  pc.outline(C('ink', 160));
  return { pc, anchorX: ax, anchorY: ay };
}

export function buildInterior(def: InteriorDef): InteriorModel {
  const [W, D] = def.size;
  const w = W + M * 2;
  const h = D + M * 2;
  const N = w * h;
  const ground = new Uint8Array(N).fill(G.NONE);
  for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) ground[(j + M) * w + (i + M)] = def.floor;
  const statics: StaticObject[] = [];
  const solids: SolidRect[] = [];
  const ox = M;
  const oy = M;
  const wallSpec = { ...def, props: [], markers: {}, zones: [] };
  const wall: StaticObject = {
    kind: 'building',
    texKey: `wall:${def.id}:${hashStr(JSON.stringify(wallSpec)).toString(36)}`,
    gen: () => drawWalls(def),
    x: ox - 0.25,
    y: oy - 0.25,
    solid: true,
    // las paredes del fondo quedan siempre detrás de todo lo que hay en la habitación
    bias: -6,
  };
  statics.push(wall);
  // paredes y bordes como sólidos
  solids.push({ x0: ox - 2, y0: oy - 2, x1: ox + W + 2, y1: oy + 0.08 });
  solids.push({ x0: ox - 2, y0: oy - 2, x1: ox + 0.08, y1: oy + D + 2 });
  solids.push({ x0: ox - 2, y0: oy + D - 0.05, x1: ox + W + 2, y1: oy + D + 2 });
  solids.push({ x0: ox + W - 0.05, y0: oy - 2, x1: ox + W + 2, y1: oy + D + 2 });
  for (const pd of def.props) {
    const gen = propGen(pd.type);
    const params = pd.params ?? {};
    const x = pd.at[0] + ox;
    const y = pd.at[1] + oy;
    const obj: StaticObject = {
      id: pd.id,
      tag: pd.tag,
      kind: 'prop',
      texKey: propKey(pd.type, params),
      gen: () => gen(params),
      x,
      y,
      fp: pd.fp,
      solid: pd.solid ?? false,
      anim: pd.anim,
      flipX: pd.flipX,
      hidden: pd.hidden,
    };
    statics.push(obj);
    if (obj.solid) {
      if (pd.fp) solids.push({ x0: x, y0: y, x1: x + pd.fp[0], y1: y + pd.fp[1], ref: obj });
      else solids.push({ x0: x - 0.16, y0: y - 0.16, x1: x + 0.16, y1: y + 0.16, ref: obj });
    }
  }
  const solidGrid = new Map<number, SolidRect[]>();
  for (const r of solids) {
    for (let j = Math.max(0, Math.floor(r.y0)); j <= Math.min(h - 1, Math.floor(r.y1)); j++)
      for (let i = Math.max(0, Math.floor(r.x0)); i <= Math.min(w - 1, Math.floor(r.x1)); i++) {
        const k = j * w + i;
        let arr = solidGrid.get(k);
        if (!arr) solidGrid.set(k, (arr = []));
        arr.push(r);
      }
  }
  const walkGrid = new Uint8Array(N);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (ground[j * w + i] === G.NONE) continue;
      const cx = i + 0.5;
      const cy = j + 0.5;
      const arr = solidGrid.get(j * w + i);
      walkGrid[j * w + i] = arr && arr.some((r) => cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) ? 0 : 1;
    }
  const markers = new Map<string, MarkerDef>();
  for (const [k, m] of Object.entries(def.markers)) markers.set(k, { at: [m.at[0] + ox, m.at[1] + oy], dir: m.dir });
  const propCaptions: SignCaption[] = def.props
    .filter((pd) => pd.caption)
    .map((pd, i) => {
      const c = typeof pd.caption === 'string' ? { text: pd.caption } : pd.caption!;
      const fx = pd.fp ? pd.fp[0] / 2 : 0;
      const fy = pd.fp ? pd.fp[1] / 2 : 0;
      return { key: `prop:${def.id}:${pd.id ?? pd.type}:${i}`, x: pd.at[0] + fx + ox, y: pd.at[1] + fy + oy, z: c.z ?? 30, text: c.text, bg: c.bg ?? 'slate8', fg: c.fg ?? 'white' };
    });
  const captions: SignCaption[] = def.items
    .filter((it) => it.caption)
    .map((it, i) => {
      const mid = it.u + it.w / 2;
      const back = it.wall === 'back';
      return {
        key: `wall:${def.id}:${i}`,
        x: back ? ox + mid : ox + 0.05,
        y: back ? oy + 0.05 : oy + mid,
        z: Math.min(def.wallH, it.z + it.h) + 4,
        text: it.caption!,
        bg: it.bg ?? (it.kind === 'board' ? '#9c7a52' : '#efe9da'),
        fg: it.fg ?? 'ink',
      };
    })
    .concat(propCaptions);
  const zones = new Map<string, ZoneDef>();
  for (const z of def.zones) zones.set(z.id, { id: z.id, rect: [z.rect[0] + ox, z.rect[1] + oy, z.rect[2] + ox, z.rect[3] + oy] });
  return {
    def,
    w,
    h,
    ox,
    oy,
    ground: { w, h, seed: 7, ground, marks: new Uint8Array(N), lanes: new Uint8Array(N), deco: new Uint8Array(N) },
    statics,
    solids,
    solidGrid,
    walkGrid,
    markers,
    zones,
    wall,
    captions,
  };
}
