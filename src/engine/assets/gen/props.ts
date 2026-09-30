import { PixelCanvas } from '../PixelCanvas';
import { C, shade, mix, type Packed } from '../Palette';
import { Rng } from '../../core/math';
import { isoCanvas, pointCanvas } from './iso';
import { drawText, drawTextOnFace, measureText, wrapLine } from '../BitmapFont';
import { drawLogo } from './logos';
import type { GenOutput } from '../AssetRegistry';

/**
 * Props urbanos e interiores. Cada generador devuelve un GenOutput cuyo ancla es:
 *  - props puntuales: el punto de apoyo en el suelo;
 *  - props con huella (fp): la esquina superior de la huella (x=0,y=0).
 * Los que tienen varios cuadros vienen en tira horizontal.
 */

type Axis = 'x' | 'y';

function strip(frames: PixelCanvas[], ax: number, ay: number): GenOutput {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const pc = new PixelCanvas(fw * frames.length, fh);
  frames.forEach((f, i) => pc.blit(f, i * fw, 0));
  return { pc, frameW: fw, frameH: fh, anchorX: ax, anchorY: ay };
}

function outlined(pc: PixelCanvas, alpha = 210): PixelCanvas {
  pc.outline(C('ink', alpha));
  return pc;
}

// ---------------------------------------------------------------- postes y señales

export function propPole(p: { axis?: Axis }): GenOutput {
  const { pc, ax, ay } = pointCanvas(8, 40, 3);
  const wood = C('#6f5642');
  const woodS = shade(wood, 0.75);
  for (let y = ay - 36; y <= ay; y++) {
    pc.set(ax - 1, y, wood);
    pc.set(ax, y, woodS);
  }
  // cruceta perpendicular a los cables
  const dir = p.axis === 'y' ? 1 : -1;
  for (let i = -4; i <= 4; i++) pc.set(ax + i, ay - 33 + Math.round((i * dir) / 2), woodS);
  pc.set(ax - 4, ay - 34 + Math.round((-4 * dir) / 2), C('slate1'));
  pc.set(ax + 4, ay - 34 + Math.round((4 * dir) / 2), C('slate1'));
  pc.set(ax - 1, ay - 37, C('slate6'));
  // transformador ocasional: caja gris
  pc.rect(ax - 3, ay - 28, 2, 3, C('slate4'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propStreetlight(p: { axis?: Axis; side?: 1 | -1 }): GenOutput {
  const { pc, ax, ay } = pointCanvas(9, 34, 3);
  const metal = C('slate5');
  for (let y = ay - 30; y <= ay; y++) pc.set(ax, y, metal);
  pc.set(ax - 1, ay, metal);
  pc.set(ax + 1, ay, metal);
  const s = p.side ?? 1;
  const dx = p.axis === 'y' ? s : -s;
  for (let i = 1; i <= 5; i++) pc.set(ax + i * dx, ay - 30 - (i < 3 ? 1 : 0), metal);
  pc.set(ax + 6 * dx, ay - 29, C('slate7'));
  pc.set(ax + 5 * dx, ay - 29, C('slate7'));
  pc.set(ax + 5 * dx, ay - 28, C('headlight', 230));
  pc.set(ax + 6 * dx, ay - 28, C('headlight', 230));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

/** Semáforo: 4 cuadros [apagado, rojo, amarillo, verde]. */
export function propTrafficLight(): GenOutput {
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 4; f++) {
    const c = pointCanvas(6, 32, 3);
    ax = c.ax;
    ay = c.ay;
    const pc = c.pc;
    for (let y = ay - 20; y <= ay; y++) pc.set(ax, y, C('slate7'));
    pc.rect(ax - 2, ay - 29, 5, 10, C('slate8'));
    pc.rect(ax - 1, ay - 28, 3, 8, C('black'));
    const lamps: [number, string][] = [
      [ay - 27, 'lightRed'],
      [ay - 24, 'lightYellow'],
      [ay - 21, 'lightGreen'],
    ];
    lamps.forEach(([ly, col], i) => {
      const on = f === i + 1;
      pc.rect(ax - 1, ly, 3, 2, on ? C(col) : shade(C(col), 0.3));
      if (on) {
        pc.set(ax - 2, ly, C(col, 120));
        pc.set(ax + 2, ly, C(col, 120));
        pc.set(ax, ly - 1, C(col, 150));
      }
    });
    frames.push(outlined(pc));
  }
  return strip(frames, ax, ay);
}

export function propPare(): GenOutput {
  const { pc, ax, ay } = pointCanvas(6, 24, 3);
  for (let y = ay - 16; y <= ay; y++) pc.set(ax, y, C('slate4'));
  const cy = ay - 19;
  pc.poly([ax - 2, cy - 4, ax + 3, cy - 4, ax + 5, cy - 2, ax + 5, cy + 3, ax + 3, cy + 5, ax - 2, cy + 5, ax - 4, cy + 3, ax - 4, cy - 2], C('signRed'));
  pc.hline(ax - 2, ax + 3, cy, C('white'));
  pc.hline(ax - 2, ax + 3, cy + 1, C('white'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propStreetSign(): GenOutput {
  const { pc, ax, ay } = pointCanvas(8, 26, 3);
  for (let y = ay - 22; y <= ay; y++) pc.set(ax, y, C('slate4'));
  pc.poly([ax - 7, ay - 23, ax, ay - 26, ax, ay - 23, ax - 7, ay - 20], C('signBlue'));
  pc.poly([ax, ay - 26, ax + 7, ay - 23, ax + 7, ay - 20, ax, ay - 23], shade(C('signBlue'), 0.8));
  for (let i = 1; i < 6; i += 2) pc.set(ax - 6 + i, ay - 22 - Math.floor(i / 2), C('white'));
  for (let i = 1; i < 6; i += 2) pc.set(ax + 1 + i, ay - 25 + Math.floor(i / 2) + 1, C('slate1'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

/** Cartel frontal sobre dos patas, con texto legible (señalética chica). */
export function propPlate(p: { text: string; text2?: string; bg: string; fg: string; logo?: string; post?: number }): GenOutput {
  const lines = p.text2 ? [p.text, p.text2] : [p.text];
  const tw = Math.max(...lines.map((l) => measureText(l, 1)));
  const logoW = p.logo ? 10 : 0;
  const w = tw + logoW + 6;
  const h = lines.length * 9 + 3;
  const post = p.post ?? 8;
  const pc = new PixelCanvas(w + 2, h + post + 4);
  const ax = Math.floor(pc.w / 2);
  const ay = pc.h - 2;
  const bg = C(p.bg);
  pc.rect(1, 1, w, h, bg);
  pc.hline(1, w, h, shade(bg, 0.7));
  pc.hline(1, w, 1, shade(bg, 1.15));
  let x = 4;
  if (p.logo) {
    drawLogo(p.logo, (lx, ly, c) => pc.set(x + lx, 3 + ly, c), 8);
    x += logoW;
  }
  lines.forEach((l, i) => drawText(pc, l, x, 3 + i * 9 + 1, C(p.fg)));
  pc.vline(4, h + 1, ay, C('slate6'));
  pc.vline(w - 3, h + 1, ay, C('slate6'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

// ---------------------------------------------------------------- vegetación

/** Álamo patagónico inclinado por el viento. 2 cuadros (vaivén). */
export function propAlamo(p: { bare?: boolean; h?: number; seed?: number }): GenOutput {
  const H = p.h ?? 38;
  const rng = new Rng(p.seed ?? 3);
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  const leaves = [C('#4f5e3c'), C('#5b6b43'), C('#66774b'), C('#46533a')];
  const bareC = [C('#6e6257'), C('#7b6e61'), C('#5d534a')];
  const pts: { x: number; y: number; c: number }[] = [];
  for (let i = 0; i < (p.bare ? 70 : 170); i++) {
    const t = rng.next();
    const y = -Math.round(6 + t * (H - 6));
    const width = p.bare ? 3.5 : 4.2 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.9));
    const x = Math.round((rng.next() * 2 - 1) * width + t * 3);
    pts.push({ x, y, c: rng.int(0, 3) });
  }
  for (let f = 0; f < 2; f++) {
    const c = pointCanvas(9, H + 4, 3);
    ax = c.ax;
    ay = c.ay;
    const pc = c.pc;
    const trunk = C('#5a4636');
    for (let y = 0; y > -Math.round(H * 0.45); y--) pc.set(ax + Math.round(-y * 0.06), ay + y, trunk);
    for (const q of pts) {
      const sway = f === 1 ? Math.round((-q.y / H) * 1.6) : 0;
      const col = p.bare ? bareC[q.c % 3] : leaves[q.c];
      pc.set(ax + q.x + sway, ay + q.y, col);
      if (!p.bare) pc.set(ax + q.x + sway, ay + q.y - 1, col);
    }
    frames.push(outlined(pc, 170));
  }
  return strip(frames, ax, ay);
}

export function propTree(p: { seed?: number; bare?: boolean }): GenOutput {
  const rng = new Rng(p.seed ?? 5);
  const { pc, ax, ay } = pointCanvas(10, 28, 3);
  for (let y = ay - 10; y <= ay; y++) {
    pc.set(ax, y, C('#5a4636'));
    pc.set(ax - 1, y, C('#6b5442'));
  }
  const cols = p.bare ? [C('#6e6257'), C('#7b6e61')] : [C('#55623f'), C('#61704a'), C('#4a5638')];
  for (let i = 0; i < 140; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * 7;
    const x = Math.round(ax + Math.cos(a) * r + 1);
    const y = Math.round(ay - 17 + Math.sin(a) * r * 0.8);
    if (!p.bare || rng.chance(0.4)) pc.set(x, y, rng.pick(cols));
  }
  return { pc: outlined(pc, 170), anchorX: ax, anchorY: ay };
}

export function propBush(p: { seed?: number; color?: string }): GenOutput {
  const rng = new Rng(p.seed ?? 9);
  const { pc, ax, ay } = pointCanvas(7, 9, 2);
  const base = C(p.color ?? '#4d553a');
  for (let i = 0; i < 60; i++) {
    const x = ax + rng.int(-5, 5);
    const y = ay - rng.int(0, 6);
    if (Math.abs(x - ax) / 6 + Math.abs(y - (ay - 3)) / 4 < 1.3) pc.set(x, y, shade(base, 0.8 + rng.next() * 0.45));
  }
  return { pc: outlined(pc, 150), anchorX: ax, anchorY: ay };
}

/** Mata de coirón (pasto de estepa). 2 cuadros. */
export function propCoiron(p: { seed?: number }): GenOutput {
  const rng = new Rng(p.seed ?? 11);
  const blades: { x: number; h: number; c: Packed }[] = [];
  for (let i = 0; i < 9; i++) blades.push({ x: rng.int(-3, 3), h: rng.int(3, 7), c: rng.pick([C('steppe3'), C('steppe2'), C('#b5ab74')]) });
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 2; f++) {
    const c = pointCanvas(6, 9, 2);
    ax = c.ax;
    ay = c.ay;
    for (const b of blades) {
      for (let y = 0; y < b.h; y++) {
        const lean = Math.round((y / b.h) * (f === 0 ? 1.5 : 2.6));
        c.pc.set(ax + b.x + lean, ay - y, b.c);
      }
    }
    frames.push(c.pc);
  }
  return strip(frames, ax, ay);
}

// ---------------------------------------------------------------- mobiliario urbano

export function propBin(): GenOutput {
  const { pc, ax, ay } = pointCanvas(4, 10, 2);
  pc.rect(ax - 2, ay - 7, 4, 7, C('#3f6f4c'));
  pc.rect(ax + 1, ay - 7, 1, 7, C('#335b3e'));
  pc.hline(ax - 3, ax + 2, ay - 8, C('slate6'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propContainer(p: { color?: string }): GenOutput {
  const { pc, iso, ax, ay } = isoCanvas(0.85, 0.55, 12, 2);
  const c = C(p.color ?? '#3f6a55');
  iso.groundShadow(0, 0, 0.9, 0.6, 50);
  iso.box(0, 0, 0.85, 0.55, 1, 10, c);
  iso.top(0, 0, 0.85, 0.55, 11, shade(c, 0.7));
  const f = iso.faceY(0, 0.85, 0.55);
  f.hline(0, f.len, 6, shade(c, 0.8));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propBench(p: { axis?: Axis }): GenOutput {
  const along = p.axis ?? 'x';
  const w = along === 'x' ? 1 : 0.3;
  const d = along === 'x' ? 0.3 : 1;
  const { pc, iso, ax, ay } = isoCanvas(w, d, 10, 2);
  const wood = C('wood');
  iso.box(0, 0, w, d, 3, 5, wood);
  if (along === 'x') iso.box(0, 0, w, 0.08, 5, 9, shade(wood, 0.9));
  else iso.box(0, 0, 0.08, d, 5, 9, shade(wood, 0.9));
  const legs = along === 'x' ? [[0.05, 0.05], [0.85, 0.05]] : [[0.05, 0.05], [0.05, 0.85]];
  for (const [lx, ly] of legs) iso.box(lx, ly, lx + 0.08, ly + 0.2, 0, 3, C('slate7'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propBusStop(p: { axis?: Axis }): GenOutput {
  const along = p.axis ?? 'x';
  const w = along === 'x' ? 1.4 : 0.5;
  const d = along === 'x' ? 0.5 : 1.4;
  const { pc, iso, ax, ay } = isoCanvas(w, d, 24, 3);
  const metal = C('slate6');
  if (along === 'x') {
    iso.box(0, 0, w, 0.06, 0, 20, { top: metal, left: C('glassLight', 150), right: metal });
    iso.box(0, 0, 0.06, d, 0, 20, { top: metal, left: C('glassLight', 150), right: C('glassLight', 150) });
    iso.box(w - 0.06, 0, w, d, 0, 20, metal);
  } else {
    iso.box(0, 0, 0.06, d, 0, 20, { top: metal, left: metal, right: C('glassLight', 150) });
    iso.box(0, 0, w, 0.06, 0, 20, metal);
    iso.box(0, d - 0.06, w, d, 0, 20, metal);
  }
  iso.box(-0.05, -0.05, w + 0.05, d + 0.05, 20, 22, C('slate5'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propCone(): GenOutput {
  const { pc, ax, ay } = pointCanvas(4, 9, 2);
  pc.rect(ax - 3, ay - 1, 6, 1, C('slate8'));
  pc.rect(ax - 2, ay - 4, 4, 3, C('cone'));
  pc.rect(ax - 1, ay - 7, 2, 3, C('cone'));
  pc.rect(ax - 2, ay - 4, 4, 1, C('white'));
  pc.set(ax + 1, ay - 2, shade(C('cone'), 0.75));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

/** Valla de 1 baldosa. Con texto opcional ("DESVÍO", "CALLE CERRADA"). */
export function propBarrier(p: { axis?: Axis; text?: string }): GenOutput {
  const along = p.axis ?? 'x';
  const w = along === 'x' ? 1 : 0.12;
  const d = along === 'x' ? 0.12 : 1;
  const { pc, iso, ax, ay } = isoCanvas(w, d, 16, 2);
  const face = along === 'x' ? iso.faceY(0, 1, 0.12) : iso.faceX(0, 1, 0.12);
  const k = along === 'x' ? 1 : 0.84;
  face.rect(1, 3, 0, 8, shade(C('slate2'), k));
  face.rect(face.len - 3, face.len - 1, 0, 8, shade(C('slate2'), k));
  for (let u = 0; u < face.len; u++) {
    const red = Math.floor((u + 1) / 4) % 2 === 0;
    face.rect(u, u + 1, 7, 12, shade(red ? C('signRed') : C('white'), k));
  }
  if (p.text) {
    const tw = measureText(p.text, 0);
    if (tw <= face.len) drawTextOnFace(face, p.text, Math.floor((face.len - tw) / 2), 11, shade(C('ink'), k), { spacing: 0 });
  }
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export type FenceKind = 'picket' | 'reja' | 'wire' | 'chapa' | 'wall';

/** Cerco de 1 baldosa a lo largo de x o y. */
export function propFence(p: { axis?: Axis; kind?: FenceKind; color?: string; len?: number; stencil?: string }): GenOutput {
  const along = p.axis ?? 'x';
  const L = p.len ?? 1;
  const kind = p.kind ?? 'picket';
  const tall = kind === 'chapa' ? 18 : kind === 'wall' ? 9 : 10;
  const w = along === 'x' ? L : 0.06;
  const d = along === 'x' ? 0.06 : L;
  const { pc, iso, ax, ay } = isoCanvas(w, d, tall + 2, 2);
  const face = along === 'x' ? iso.faceY(0, L, 0.06) : iso.faceX(0, L, 0.06);
  const k = along === 'x' ? 1 : 0.84;
  const col = C(p.color ?? (kind === 'reja' ? 'slate8' : kind === 'chapa' ? 'slate6' : kind === 'wall' ? 'wallCream' : 'wood'));
  switch (kind) {
    case 'picket':
      for (let u = 0; u < face.len; u += 3) face.rect(u, u + 2, 0, tall - (u % 6 === 0 ? 0 : 1), shade(col, k * (u % 6 ? 0.9 : 1)));
      face.hline(0, face.len, 6, shade(col, k * 0.8));
      break;
    case 'reja':
      for (let u = 0; u < face.len; u += 2) face.rect(u, u + 1, 0, tall, shade(col, k));
      face.hline(0, face.len, tall - 1, shade(col, k));
      face.hline(0, face.len, 2, shade(col, k));
      break;
    case 'wire':
      for (let u = 0; u < face.len; u += 8) face.rect(u, u + 1, 0, tall, shade(C('wood'), k));
      for (const z of [3, 6, 9]) face.hline(0, face.len, z, shade(C('slate4'), k));
      break;
    case 'chapa':
      for (let u = 0; u < face.len; u++) face.rect(u, u + 1, 0, tall, shade(col, k * (u % 2 ? 0.86 : 1)));
      face.hline(0, face.len, tall - 1, shade(col, k * 1.2));
      if (p.stencil) drawLogo(p.stencil, (x, y, c) => face.px(4 + x, tall - 4 - y, shade(c, k)), 9);
      break;
    case 'wall':
      face.rect(0, face.len, 0, tall, shade(col, k));
      face.hline(0, face.len, tall - 1, shade(col, k * 1.1));
      break;
  }
  return { pc: outlined(pc, 180), anchorX: ax, anchorY: ay };
}

/** Bandera en mástil. 3 cuadros de flameo. colors: franjas horizontales de arriba a abajo. */
export function propFlag(p: { colors?: string[]; sun?: boolean; h?: number }): GenOutput {
  const H = p.h ?? 34;
  const cols = (p.colors ?? ['flagBlue', 'white', 'flagBlue']).map((c) => C(c));
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 3; f++) {
    const c = pointCanvas(12, H + 3, 2);
    ax = c.ax;
    ay = c.ay;
    const pc = c.pc;
    for (let y = ay - H; y <= ay; y++) pc.set(ax, y, C('slate3'));
    const fw = 11;
    const fh = 7;
    for (let x = 1; x <= fw; x++) {
      const wave = Math.round(Math.sin((x + f * 2) * 0.9) * 0.9);
      for (let y = 0; y < fh; y++) {
        const band = Math.min(cols.length - 1, Math.floor((y / fh) * cols.length));
        pc.set(ax + x, ay - H + 1 + y + wave, cols[band]);
      }
    }
    if (p.sun) pc.set(ax + 5, ay - H + 4 + Math.round(Math.sin((5 + f * 2) * 0.9) * 0.9), C('flagSun'));
    frames.push(outlined(pc, 160));
  }
  return strip(frames, ax, ay);
}

/** Letras turísticas "RÍO GALLEGOS" de la costanera (huella a lo largo de x). */
export function propLetters(p: { text?: string }): GenOutput {
  const text = p.text ?? 'RÍO GALLEGOS';
  const tw = measureText(text, 2) * 2;
  const L = Math.ceil((tw + 8) / 16);
  const { pc, iso, ax, ay } = isoCanvas(L, 0.4, 24, 3);
  iso.box(0, 0, L, 0.4, 0, 2, C('slate4'));
  const back = iso.faceY(0, L, 0.2);
  const front = iso.faceY(0, L, 0.4);
  const u0 = Math.floor((front.len - tw) / 2);
  drawTextOnFace(back, text, u0 + 1, 18, C('#6fa7c9'), { spacing: 2, scale: 2 });
  drawTextOnFace(front, text, u0, 17, C('white'), { spacing: 2, scale: 2 });
  return { pc: outlined(pc, 170), anchorX: ax, anchorY: ay };
}

export function propFlamingo(): GenOutput {
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 2; f++) {
    const c = pointCanvas(5, 13, 2);
    ax = c.ax;
    ay = c.ay;
    const pc = c.pc;
    const pink = C('flamingo');
    const dark = C('flamingoDark');
    pc.vline(ax, ay - 5, ay, dark);
    pc.vline(ax + 1, ay - 5, ay - 1, dark);
    pc.rect(ax - 2, ay - 8, 5, 3, pink);
    pc.set(ax - 2, ay - 7, dark);
    if (f === 0) {
      pc.vline(ax + 2, ay - 12, ay - 8, pink);
      pc.set(ax + 3, ay - 12, pink);
      pc.set(ax + 4, ay - 11, C('ink'));
    } else {
      pc.set(ax + 3, ay - 7, pink);
      pc.set(ax + 3, ay - 6, pink);
      pc.set(ax + 3, ay - 5, pink);
      pc.set(ax + 4, ay - 4, C('ink'));
    }
    frames.push(outlined(pc, 150));
  }
  return strip(frames, ax, ay);
}

/** Bolsa de nylon volando. 4 cuadros. */
export function propBag(p: { color?: string }): GenOutput {
  const col = C(p.color ?? 'snow');
  const frames: PixelCanvas[] = [];
  const shapes = [
    ['.##.', '####', '.##.', '..#.'],
    ['..#.', '.###', '####', '.#..'],
    ['.#..', '####', '###.', '.##.'],
    ['.##.', '###.', '####', '..##'],
  ];
  for (const s of shapes) {
    const pc = new PixelCanvas(6, 6);
    s.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && pc.set(x + 1, y + 1, x === 3 ? shade(col, 0.82) : col)));
    frames.push(outlined(pc, 120));
  }
  return strip(frames, 3, 3);
}

/** Perro callejero. 6 cuadros: frente quieto, frente 2 pasos, espalda quieto, espalda 2 pasos. */
export function propDog(p: { color?: string }): GenOutput {
  const col = C(p.color ?? '#8a6a4a');
  const dark = shade(col, 0.72);
  const frames: PixelCanvas[] = [];
  for (let v = 0; v < 2; v++) {
    for (let f = 0; f < 3; f++) {
      const pc = new PixelCanvas(12, 11);
      const back = v === 1;
      pc.rect(2, 4, 7, 3, col);
      pc.rect(2, 6, 7, 1, dark);
      const legs = f === 0 ? [2, 3, 7, 8] : f === 1 ? [2, 4, 6, 8] : [3, 3, 7, 7];
      for (const lx of legs) pc.vline(lx, 7, 9, dark);
      if (!back) {
        pc.rect(7, 2, 3, 3, col);
        pc.set(10, 3, dark);
        pc.set(8, 3, C('ink'));
        pc.set(7, 1, dark);
        pc.set(1, 3, col);
      } else {
        pc.rect(1, 2, 3, 3, col);
        pc.set(1, 1, dark);
        pc.set(9, 3, col);
        pc.set(10, 2, col);
      }
      frames.push(outlined(pc, 200));
    }
  }
  return strip(frames, 6, 10);
}

// ---------------------------------------------------------------- obra

export function propMixer(): GenOutput {
  const { pc, ax, ay } = pointCanvas(8, 14, 2);
  pc.rect(ax - 5, ay - 3, 10, 2, C('slate7'));
  pc.set(ax - 4, ay - 1, C('tire'));
  pc.set(ax + 3, ay - 1, C('tire'));
  pc.ellipse(ax, ay - 8, 4.5, 4, C('orange'));
  pc.ellipse(ax + 1, ay - 9, 2, 2, shade(C('orange'), 1.2));
  pc.rect(ax + 3, ay - 12, 2, 2, C('slate8'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propSandpile(p: { color?: string }): GenOutput {
  const { pc, ax, ay } = pointCanvas(9, 8, 2);
  const col = C(p.color ?? '#a8966f');
  for (let y = 0; y < 6; y++) {
    const half = 8 - y;
    for (let x = -half; x <= half; x++) pc.set(ax + x, ay - y, shade(col, x > half / 2 ? 0.8 : y === 5 ? 1.12 : 1));
  }
  return { pc: outlined(pc, 150), anchorX: ax, anchorY: ay };
}

export function propBricks(): GenOutput {
  const { pc, iso, ax, ay } = isoCanvas(0.6, 0.6, 10, 2);
  iso.box(0, 0, 0.6, 0.6, 0, 2, C('wood'));
  const f = iso.box(0.05, 0.05, 0.55, 0.55, 2, 8, C('brick'));
  for (const z of [4, 6]) {
    f.left.hline(0, f.left.len, z, shade(C('brick'), 0.8));
    f.right.hline(0, f.right.len, z, shade(C('brick'), 0.65));
  }
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

/** Antena de radio reticulada (hito visual). 2 cuadros: baliza encendida/apagada. */
export function propAntenna(p: { h?: number }): GenOutput {
  const H = p.h ?? 70;
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 2; f++) {
    const c = pointCanvas(8, H + 4, 3);
    ax = c.ax;
    ay = c.ay;
    const pc = c.pc;
    for (let y = 0; y < H; y++) {
      const half = Math.max(1, Math.round(4 * (1 - y / H)));
      const col = Math.floor(y / 8) % 2 === 0 ? C('signRed') : C('white');
      pc.set(ax - half, ay - y, col);
      pc.set(ax + half, ay - y, col);
      if (y % 4 === 0) pc.hline(ax - half, ax + half, ay - y, shade(col, 0.8));
      if (y % 4 === 2) pc.set(ax, ay - y, shade(col, 0.8));
    }
    pc.set(ax, ay - H - 1, f === 0 ? C('lightRed') : C('#6a2a26'));
    pc.set(ax, ay - H - 2, f === 0 ? C('lightRed', 140) : 0);
    frames.push(outlined(pc, 140));
  }
  return strip(frames, ax, ay);
}

export interface BillboardLine {
  text: string;
  fg: string;
  scale?: number;
}

/**
 * Cartel grande (valla) FRENTE a la cámara, sobre dos postes cerca del centro de su huella.
 * El frente plano se lee mucho mejor que un texto en diagonal: los renglones largos se parten
 * solos y el tablero crece lo necesario. La huella (axis x: a lo largo de x) sólo da la
 * colisión y el orden de dibujo; el ancla sigue siendo la esquina (0,0) de esa huella.
 */
export function propBillboard(p: {
  axis?: Axis;
  len: number;
  boardH: number;
  post?: number;
  bg: string;
  lines: BillboardLine[];
  logo?: string;
  logoSize?: number;
  border?: string;
}): GenOutput {
  const along = p.axis ?? 'x';
  const L = p.len;
  const post = p.post ?? 10;
  const pad = 5;
  const logoSize = p.logo ? (p.logoSize ?? 12) : 0;
  const logoW = p.logo ? logoSize + 5 : 0;
  const maxW = L * 16 + 16;
  const availText = maxW - pad * 2 - logoW;
  // renglones ya partidos y medidos
  const rows: { text: string; fg: string; scale: number; spacing: number; w: number }[] = [];
  for (const l of p.lines) {
    let scale = l.scale ?? 1;
    if (scale > 1 && measureText(l.text, 1) * scale > availText) scale = 1;
    for (const r of wrapLine(l.text, Math.floor(availText / scale), 3)) {
      rows.push({ text: r.text, fg: l.fg, scale, spacing: r.spacing, w: measureText(r.text, r.spacing) * scale });
    }
  }
  const lineH = (s: number) => 7 * s + (s > 1 ? 5 : 3);
  const textW = Math.max(...rows.map((r) => r.w));
  const textH = rows.reduce((a, r) => a + lineH(r.scale), 0) - 3;
  const bw = Math.min(maxW, Math.max(textW + logoW + pad * 2, 28));
  const bh = Math.max(p.boardH, textH + pad * 2 + 2, logoSize + pad * 2);
  // geometría en px relativos al ancla (esquina 0,0 de la huella)
  const cx = along === 'x' ? 8 * L : -8 * L;
  const cy = 4 * L;
  const k = Math.min(16, Math.floor(bw / 2) - 7);
  const postA = along === 'x' ? { x: cx - k, y: cy - k / 2 } : { x: cx + k, y: cy - k / 2 };
  const postB = along === 'x' ? { x: cx + k, y: cy + k / 2 } : { x: cx - k, y: cy + k / 2 };
  const boardBottom = Math.min(postA.y, postB.y) - post;
  const bx0 = Math.round(cx - bw / 2);
  const by0 = Math.round(boardBottom - bh);
  const m = 3;
  const minX = Math.min(bx0, postA.x, postB.x) - m;
  const maxX = Math.max(bx0 + bw, postA.x, postB.x) + m;
  const minY = by0 - m;
  const maxY = Math.max(postA.y, postB.y) + m + 1;
  const pc = new PixelCanvas(Math.ceil(maxX - minX), Math.ceil(maxY - minY));
  const ox = -Math.floor(minX);
  const oy = -Math.floor(minY);
  // postes (el más cercano a la cámara se ve más largo) con su sombrita en el suelo
  const postC = C('slate6');
  for (const q of [postA, postB]) {
    const px = ox + Math.round(q.x);
    const gy = oy + Math.round(q.y);
    pc.hline(px - 2, px + 3, gy, C('ink', 70));
    for (let y = oy + Math.round(boardBottom); y <= gy; y++) {
      pc.set(px, y, postC);
      pc.set(px + 1, y, shade(postC, 0.72));
    }
  }
  // tablero: canto inferior y lateral más oscuros (grosor), borde de color
  const bg = C(p.bg);
  const border = C(p.border ?? 'white');
  const X0 = ox + bx0;
  const Y0 = oy + by0;
  pc.rect(X0, Y0, bw, bh, bg);
  pc.rect(X0 + bw, Y0 + 1, 1, bh, shade(bg, 0.55));
  pc.rect(X0 + 1, Y0 + bh, bw, 1, shade(bg, 0.55));
  pc.hline(X0, X0 + bw - 1, Y0, border);
  pc.hline(X0, X0 + bw - 1, Y0 + bh - 1, border);
  pc.vline(X0, Y0, Y0 + bh - 1, border);
  pc.vline(X0 + bw - 1, Y0, Y0 + bh - 1, border);
  let tx = X0 + pad;
  if (p.logo) {
    const ly = Y0 + Math.floor((bh - logoSize) / 2);
    drawLogo(p.logo, (x, y, c) => pc.set(tx + x, ly + y, c), logoSize);
    tx += logoW;
  }
  const areaW = X0 + bw - pad - tx;
  let ty = Y0 + Math.floor((bh - textH) / 2) + 1;
  for (const r of rows) {
    const sx = tx + Math.max(0, Math.floor((areaW - r.w) / 2));
    drawText(pc, r.text, sx, ty + (r.scale > 1 ? 1 : 0), C(r.fg), { spacing: r.spacing, scale: r.scale });
    ty += lineH(r.scale);
  }
  return { pc: outlined(pc, 190), anchorX: ox, anchorY: oy };
}

/** Pancarta de protesta frontal sostenida por dos palos. */
export function propProtestBanner(p: { text: string; text2?: string; bg?: string; fg?: string }): GenOutput {
  const lines = p.text2 ? [p.text, p.text2] : [p.text];
  const tw = Math.max(...lines.map((l) => measureText(l, 1)));
  const w = tw + 8;
  const h = lines.length * 9 + 3;
  const pc = new PixelCanvas(w + 2, h + 16);
  const bg = C(p.bg ?? 'snow');
  pc.rect(1, 2, w, h, bg);
  for (let x = 1; x <= w; x += 3) pc.set(x, 2 + h, shade(bg, 0.8));
  lines.forEach((l, i) => drawText(pc, l, 5, 4 + i * 9 + 1, C(p.fg ?? 'signRed')));
  pc.vline(1, 0, pc.h - 1, C('wood'));
  pc.vline(w, 0, pc.h - 1, C('wood'));
  return { pc: outlined(pc, 200), anchorX: Math.floor(pc.w / 2), anchorY: pc.h - 1 };
}

export function propBeanie(p: { color?: string }): GenOutput {
  const pc = new PixelCanvas(9, 7);
  const c = C(p.color ?? 'red');
  pc.rect(1, 2, 6, 3, c);
  pc.rect(2, 1, 4, 1, c);
  pc.hline(1, 6, 4, shade(c, 0.75));
  pc.set(4, 0, shade(c, 1.2));
  return { pc: outlined(pc, 200), anchorX: 4, anchorY: 5 };
}

export function propPotholeSign(): GenOutput {
  const { pc, ax, ay } = pointCanvas(6, 18, 2);
  pc.vline(ax, ay - 10, ay, C('slate5'));
  pc.poly([ax, ay - 17, ax + 5, ay - 12, ax, ay - 7, ax - 5, ay - 12], C('hazard'));
  pc.vline(ax, ay - 15, ay - 11, C('ink'));
  pc.set(ax, ay - 9, C('ink'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

// ---------------------------------------------------------------- interiores

export function propDesk(p: { axis?: Axis; len?: number; color?: string; crt?: boolean; papers?: boolean; mate?: boolean }): GenOutput {
  const along = p.axis ?? 'x';
  const len = p.len ?? 1.5;
  const w = along === 'x' ? len : 0.8;
  const d = along === 'x' ? 0.8 : len;
  const { pc, iso, ax, ay } = isoCanvas(w, d, 26, 3);
  const top = C(p.color ?? '#9a8468');
  iso.groundShadow(0, 0, w, d, 40);
  const legs = C('slate6');
  iso.box(0.05, 0.05, 0.13, 0.13, 0, 11, legs);
  iso.box(w - 0.13, 0.05, w - 0.05, 0.13, 0, 11, legs);
  iso.box(0.05, d - 0.13, 0.13, d - 0.05, 0, 11, legs);
  iso.box(w - 0.13, d - 0.13, w - 0.05, d - 0.05, 0, 11, legs);
  iso.box(0, 0, w, d, 11, 13, top);
  if (along === 'x') iso.box(0.1, 0.05, w - 0.1, 0.12, 4, 11, shade(top, 0.8));
  if (p.crt) {
    const cx = along === 'x' ? w * 0.55 : 0.2;
    const cy = along === 'x' ? 0.15 : d * 0.4;
    const f = iso.box(cx, cy, cx + 0.42, cy + 0.42, 13, 24, C('#cfc6ad'));
    const screen = along === 'x' ? f.left : f.right;
    screen.rect(2, screen.len - 2, 3, 10, C('#1f3a3a'));
    screen.rect(3, 5, 7, 9, C('#4fb08a'));
    iso.box(cx + 0.1, cy + 0.1, cx + 0.32, cy + 0.32, 13, 14, C('slate5'));
  }
  if (p.papers) {
    const px = along === 'x' ? 0.15 : 0.35;
    const py = along === 'x' ? 0.35 : 0.1;
    for (let i = 0; i < 4; i++) iso.box(px, py, px + 0.32, py + 0.26, 13 + i * 2, 15 + i * 2, i % 2 ? C('#e7dcc2') : C('#d8b67a'));
  }
  if (p.mate) {
    const mx = along === 'x' ? w - 0.35 : 0.5;
    const my = along === 'x' ? 0.5 : d - 0.35;
    iso.box(mx, my, mx + 0.1, my + 0.1, 13, 17, C('#6b4a2a'));
    iso.box(mx + 0.15, my - 0.05, mx + 0.25, my + 0.05, 13, 22, C('slate2'));
  }
  return { pc: outlined(pc, 190), anchorX: ax, anchorY: ay };
}

export function propChair(p: { color?: string; facing?: 'L' | 'R' }): GenOutput {
  const { pc, iso, ax, ay } = isoCanvas(0.4, 0.4, 16, 2);
  const c = C(p.color ?? '#d8772f');
  iso.box(0.05, 0.05, 0.1, 0.1, 0, 7, C('slate6'));
  iso.box(0.3, 0.05, 0.35, 0.1, 0, 7, C('slate6'));
  iso.box(0.05, 0.3, 0.1, 0.35, 0, 7, C('slate6'));
  iso.box(0.3, 0.3, 0.35, 0.35, 0, 7, C('slate6'));
  iso.box(0, 0, 0.4, 0.4, 7, 8, c);
  if (p.facing === 'R') iso.box(0, 0, 0.07, 0.4, 8, 15, c);
  else iso.box(0, 0, 0.4, 0.07, 8, 15, c);
  return { pc: outlined(pc, 200), anchorX: ax, anchorY: ay };
}

/** Mostrador con vidrio de ventanilla. */
export function propCounter(p: { axis?: Axis; len?: number; glass?: boolean; label?: string; color?: string }): GenOutput {
  const along = p.axis ?? 'x';
  const len = p.len ?? 3;
  const w = along === 'x' ? len : 0.5;
  const d = along === 'x' ? 0.5 : len;
  const { pc, iso, ax, ay } = isoCanvas(w, d, 34, 3);
  const body = C(p.color ?? '#8c7a62');
  const f = iso.box(0, 0, w, d, 0, 14, body);
  const front = along === 'x' ? f.left : f.right;
  front.hline(0, front.len, 7, shade(body, 0.85));
  iso.box(-0.03, -0.03, w + 0.03, d + 0.03, 14, 15, C('slate2'));
  if (p.glass) {
    const g = iso.box(0, 0.2, w, 0.26, 15, 32, { top: C('slate3'), left: C('glassLight', 110), right: C('glassLight', 140) });
    const gf = along === 'x' ? g.left : g.right;
    for (let u = 0; u < gf.len; u += 32) gf.rect(u, u + 1, 0, 32, C('slate4'));
    for (let u = 12; u < gf.len; u += 32) gf.rect(u, u + 8, 15, 18, C('slate8', 200));
    if (p.label) drawTextOnFace(gf, p.label, 4, 31, C('ink'), { spacing: 1 });
  }
  return { pc: outlined(pc, 190), anchorX: ax, anchorY: ay };
}

export function propTicketMachine(): GenOutput {
  const { pc, ax, ay } = pointCanvas(5, 22, 2);
  pc.vline(ax, ay - 12, ay, C('slate6'));
  pc.rect(ax - 3, ay - 20, 7, 9, C('signRed'));
  pc.rect(ax + 2, ay - 20, 2, 9, shade(C('signRed'), 0.78));
  pc.rect(ax - 2, ay - 18, 4, 2, C('slate9'));
  pc.set(ax - 1, ay - 17, C('lightRed'));
  pc.rect(ax - 1, ay - 13, 2, 1, C('white'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propCabinet(): GenOutput {
  const { pc, iso, ax, ay } = isoCanvas(0.5, 0.45, 26, 2);
  const f = iso.box(0, 0, 0.5, 0.45, 0, 24, C('#8c9296'));
  for (const z of [6, 12, 18]) {
    f.left.hline(0, f.left.len, z, C('slate5'));
    f.left.rect(3, 6, z + 2, z + 3, C('slate3'));
  }
  iso.box(0.05, 0.05, 0.4, 0.35, 24, 28, C('#d8b67a'));
  return { pc: outlined(pc, 190), anchorX: ax, anchorY: ay };
}

export function propWaterCooler(): GenOutput {
  const { pc, ax, ay } = pointCanvas(4, 22, 2);
  pc.rect(ax - 3, ay - 12, 6, 12, C('slate1'));
  pc.rect(ax + 1, ay - 12, 2, 12, C('slate3'));
  pc.rect(ax - 2, ay - 19, 4, 7, C('#9fc3d6', 120));
  pc.set(ax - 1, ay - 8, C('signBlue'));
  pc.set(ax + 1, ay - 8, C('signRed'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function propPlant(p: { dying?: boolean }): GenOutput {
  const rng = new Rng(7);
  const { pc, ax, ay } = pointCanvas(6, 22, 2);
  pc.rect(ax - 3, ay - 5, 6, 5, C('#8a5a3c'));
  pc.hline(ax - 3, ax + 2, ay - 5, shade(C('#8a5a3c'), 1.2));
  const cols = p.dying ? [C('#7d7a45'), C('#8f8450'), C('#6a6a3c')] : [C('#4f6f3f'), C('#5d7f49')];
  for (let i = 0; i < 40; i++) {
    const x = ax + rng.int(-4, 4);
    const y = ay - 6 - rng.int(0, 13);
    if (Math.abs(x - ax) < 5 - (ay - 6 - y) / 5) pc.set(x, y, rng.pick(cols));
  }
  return { pc: outlined(pc, 170), anchorX: ax, anchorY: ay };
}

/** Góndola de supermercado con mercadería. */
export function propShelf(p: { axis?: Axis; len?: number; seed?: number }): GenOutput {
  const along = p.axis ?? 'x';
  const len = p.len ?? 2;
  const rng = new Rng(p.seed ?? 21);
  const w = along === 'x' ? len : 0.5;
  const d = along === 'x' ? 0.5 : len;
  const { pc, iso, ax, ay } = isoCanvas(w, d, 28, 2);
  const f = iso.box(0, 0, w, d, 0, 26, C('slate2'));
  const front = along === 'x' ? f.left : f.right;
  const k = along === 'x' ? 1 : 0.84;
  const prods = ['#c8413a', '#e0b43c', '#3f8ac0', '#5aa35a', '#e07a2e', '#f2f4f5', '#8a5a9a', '#1f3f73'];
  for (const z of [2, 9, 16]) {
    front.hline(0, front.len, z, shade(C('slate5'), k));
    for (let u = 1; u < front.len - 1; u += 2) {
      const col = shade(C(rng.pick(prods)), k);
      const hh = rng.int(3, 5);
      front.rect(u, u + 2, z + 1, z + 1 + hh, col);
    }
  }
  return { pc: outlined(pc, 180), anchorX: ax, anchorY: ay };
}

export function propFridge(p: { axis?: Axis }): GenOutput {
  const along = p.axis ?? 'x';
  const w = along === 'x' ? 1 : 0.5;
  const d = along === 'x' ? 0.5 : 1;
  const { pc, iso, ax, ay } = isoCanvas(w, d, 30, 2);
  const f = iso.box(0, 0, w, d, 0, 28, C('slate7'));
  const front = along === 'x' ? f.left : f.right;
  front.rect(2, front.len - 2, 3, 25, C('#9fc3d6', 130));
  for (let z = 5; z < 24; z += 5)
    for (let u = 3; u < front.len - 3; u += 2) front.px(u, z, C((u + z) % 3 ? '#c8413a' : '#3f8ac0'));
  front.rect(Math.floor(front.len / 2), Math.floor(front.len / 2) + 1, 3, 25, C('slate5'));
  return { pc: outlined(pc, 180), anchorX: ax, anchorY: ay };
}

export function propCheckout(p: { axis?: Axis }): GenOutput {
  const along = p.axis ?? 'x';
  const w = along === 'x' ? 1.6 : 0.6;
  const d = along === 'x' ? 0.6 : 1.6;
  const { pc, iso, ax, ay } = isoCanvas(w, d, 24, 2);
  iso.box(0, 0, w, d, 0, 12, C('anOrange'));
  iso.box(0, 0, w, d, 12, 13, C('slate1'));
  const rx = along === 'x' ? w - 0.5 : 0.1;
  const ry = along === 'x' ? 0.1 : d - 0.5;
  const r = iso.box(rx, ry, rx + 0.4, ry + 0.35, 13, 19, C('slate8'));
  (along === 'x' ? r.left : r.right).rect(1, 5, 3, 5, C('#4fb08a'));
  return { pc: outlined(pc, 190), anchorX: ax, anchorY: ay };
}

export function propHeater(): GenOutput {
  const pc = new PixelCanvas(12, 10);
  pc.rect(1, 1, 10, 7, C('#d9d4c4'));
  for (let x = 2; x < 10; x += 2) pc.vline(x, 2, 6, C('slate3'));
  pc.set(9, 7, C('lightRed'));
  return { pc: outlined(pc, 180), anchorX: 6, anchorY: 9 };
}

export function propPapers(): GenOutput {
  const { pc, iso, ax, ay } = isoCanvas(0.4, 0.35, 14, 2);
  for (let i = 0; i < 5; i++)
    iso.box(0.02 * (i % 2), 0.02 * ((i + 1) % 2), 0.36 + 0.02 * (i % 2), 0.3, i * 2, i * 2 + 2, i % 2 ? C('#e7dcc2') : C('#d8b67a'));
  return { pc: outlined(pc, 170), anchorX: ax, anchorY: ay };
}

/** Tendedero con ropa flameando (patio patagónico). 3 cuadros. axis: dirección de la soga. */
export function propClothesline(p: { axis?: Axis; seed?: number }): GenOutput {
  const along = p.axis ?? 'x';
  const rng = new Rng(p.seed ?? 4);
  const clothes = [0, 1, 2, 3].map(() => ({
    c: C(rng.pick(['#c8413a', '#3f8ac0', '#e0b43c', '#f2f4f5', '#5aa35a', '#8a5a9a', '#e07a2e'])),
    w: rng.int(3, 5),
    h: rng.int(4, 6),
  }));
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 3; f++) {
    const w = along === 'x' ? 2 : 0.06;
    const d = along === 'x' ? 0.06 : 2;
    const c = isoCanvas(w, d, 20, 3);
    ax = c.ax;
    ay = c.ay;
    const face = along === 'x' ? c.iso.faceY(0, 2, 0.06) : c.iso.faceX(0, 2, 0.06);
    face.rect(0, 1, 0, 16, C('slate6'));
    face.rect(face.len - 1, face.len, 0, 16, C('slate6'));
    face.hline(0, face.len, 15, C('slate3'));
    let u = 3;
    for (const cl of clothes) {
      const sway = f === 1 ? 1 : f === 2 ? 2 : 0;
      for (let x = 0; x < cl.w; x++) {
        for (let z = 0; z < cl.h; z++) {
          const lift = Math.round((z / cl.h) * sway);
          face.px(u + x + lift, 14 - z, x === cl.w - 1 ? shade(cl.c, 0.8) : cl.c);
        }
      }
      u += cl.w + 2;
      if (u > face.len - 4) break;
    }
    frames.push(outlined(c.pc, 160));
  }
  return strip(frames, ax, ay);
}

/** Marco genérico para objetos de pared frontales (reloj, cartel chico) — plano, sin cizallar. */
export function propWallClock(): GenOutput {
  const pc = new PixelCanvas(9, 9);
  pc.ellipse(4.5, 4.5, 4, 4, C('white'));
  pc.vline(4, 2, 4, C('ink'));
  pc.hline(4, 6, 4, C('ink'));
  return { pc: outlined(pc, 220), anchorX: 4, anchorY: 8 };
}

export { mix };
