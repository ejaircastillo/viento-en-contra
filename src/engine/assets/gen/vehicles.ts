import { PixelCanvas } from '../PixelCanvas';
import { C, shade, mix, type Packed } from '../Palette';
import type { GenOutput } from '../AssetRegistry';

/**
 * Vehículos placeholder: pequeño rasterizador de cajas rotadas → sprites en 8 direcciones.
 * Tira de 16 cuadros: 0-7 normal (dir k = k·45°, 0 = +x/E, 2 = +y/S), 8-15 frenando.
 * Para vehículos accidentados (damaged) los cuadros 8-15 son balizas encendidas.
 */

export type VehicleModelId =
  | 'sedan'
  | 'hatch'
  | 'pickup'
  | 'suv'
  | 'van'
  | 'bus'
  | 'truck'
  | 'police'
  | 'tow';

export interface VehicleLook {
  model: VehicleModelId;
  body: string;
  accent?: string;
  damaged?: boolean;
}

interface VBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  c: string;
  top?: string;
  ends?: string;
  sides?: string;
  front?: string;
  back?: string;
}

interface Model {
  len: number;
  wid: number;
  boxes: VBox[];
  lightZ: [number, number];
  wheelZ: number;
}

function wheels(len: number, wid: number, r: number, inset = 0.16): VBox[] {
  const hx = len / 2;
  const hy = wid / 2;
  const w = 0.17;
  const out: VBox[] = [];
  for (const cx of [hx - inset - w / 2, -hx + inset + w / 2]) {
    for (const side of [-1, 1]) {
      const y0 = side < 0 ? -hy - 0.02 : hy - 0.07;
      out.push({ x0: cx - w / 2, x1: cx + w / 2, y0, y1: y0 + 0.09, z0: 0, z1: r, c: 'tire' });
    }
  }
  return out;
}

const MODELS: Record<VehicleModelId, () => Model> = {
  sedan: () => ({
    len: 1.24,
    wid: 0.56,
    lightZ: [5, 6],
    wheelZ: 4,
    boxes: [
      ...wheels(1.24, 0.56, 4),
      { x0: -0.62, x1: 0.62, y0: -0.28, y1: 0.28, z0: 2, z1: 7, c: 'body' },
      { x0: -0.3, x1: 0.2, y0: -0.25, y1: 0.25, z0: 7, z1: 12, c: 'glass', top: 'body' },
    ],
  }),
  hatch: () => ({
    len: 1.08,
    wid: 0.54,
    lightZ: [5, 6],
    wheelZ: 4,
    boxes: [
      ...wheels(1.08, 0.54, 4, 0.13),
      { x0: -0.54, x1: 0.54, y0: -0.27, y1: 0.27, z0: 2, z1: 7, c: 'body' },
      { x0: -0.46, x1: 0.16, y0: -0.24, y1: 0.24, z0: 7, z1: 12, c: 'glass', top: 'body', back: 'glass' },
    ],
  }),
  pickup: () => ({
    len: 1.44,
    wid: 0.6,
    lightZ: [6, 7],
    wheelZ: 5,
    boxes: [
      ...wheels(1.44, 0.6, 5),
      { x0: -0.72, x1: 0.72, y0: -0.3, y1: 0.3, z0: 3, z1: 8, c: 'body' },
      { x0: -0.7, x1: -0.1, y0: -0.29, y1: 0.29, z0: 8, z1: 10, c: 'body', top: 'bed' },
      { x0: -0.08, x1: 0.4, y0: -0.27, y1: 0.27, z0: 8, z1: 14, c: 'glass', top: 'body' },
    ],
  }),
  suv: () => ({
    len: 1.3,
    wid: 0.6,
    lightZ: [6, 7],
    wheelZ: 5,
    boxes: [
      ...wheels(1.3, 0.6, 5),
      { x0: -0.65, x1: 0.65, y0: -0.3, y1: 0.3, z0: 3, z1: 9, c: 'body' },
      { x0: -0.58, x1: 0.26, y0: -0.27, y1: 0.27, z0: 9, z1: 15, c: 'glass', top: 'body', back: 'body' },
    ],
  }),
  van: () => ({
    len: 1.18,
    wid: 0.58,
    lightZ: [5, 6],
    wheelZ: 4,
    boxes: [
      ...wheels(1.18, 0.58, 4, 0.14),
      { x0: -0.59, x1: 0.59, y0: -0.29, y1: 0.29, z0: 2, z1: 8, c: 'body' },
      { x0: -0.58, x1: -0.02, y0: -0.28, y1: 0.28, z0: 8, z1: 16, c: 'body' },
      { x0: -0.02, x1: 0.24, y0: -0.28, y1: 0.28, z0: 8, z1: 15, c: 'glass', top: 'body' },
    ],
  }),
  bus: () => ({
    len: 2.6,
    wid: 0.62,
    lightZ: [5, 7],
    wheelZ: 5,
    boxes: [
      ...wheels(2.6, 0.62, 5, 0.28),
      { x0: -1.3, x1: 1.3, y0: -0.31, y1: 0.31, z0: 2, z1: 20, c: 'body', top: 'roof' },
      { x0: -1.2, x1: 1.26, y0: -0.316, y1: 0.316, z0: 10, z1: 17, c: 'glass', top: 'roof' },
      { x0: -1.3, x1: 1.3, y0: -0.31, y1: 0.31, z0: 20, z1: 21, c: 'roof' },
    ],
  }),
  truck: () => ({
    len: 2.1,
    wid: 0.62,
    lightZ: [5, 7],
    wheelZ: 5,
    boxes: [
      ...wheels(2.1, 0.62, 5, 0.2),
      { x0: 0.5, x1: 1.05, y0: -0.3, y1: 0.3, z0: 2, z1: 9, c: 'body' },
      { x0: 0.55, x1: 0.98, y0: -0.29, y1: 0.29, z0: 9, z1: 15, c: 'body', front: 'glass' },
      { x0: -1.05, x1: 0.46, y0: -0.31, y1: 0.31, z0: 3, z1: 21, c: 'accent', top: 'roof' },
    ],
  }),
  police: () => ({
    len: 1.26,
    wid: 0.56,
    lightZ: [5, 6],
    wheelZ: 4,
    boxes: [
      ...wheels(1.26, 0.56, 4),
      { x0: -0.63, x1: 0.63, y0: -0.28, y1: 0.28, z0: 2, z1: 7, c: 'body' },
      { x0: -0.63, x1: 0.63, y0: -0.284, y1: 0.284, z0: 4, z1: 5, c: 'accent' },
      { x0: -0.3, x1: 0.2, y0: -0.25, y1: 0.25, z0: 7, z1: 12, c: 'glass', top: 'body' },
      { x0: -0.12, x1: 0.04, y0: -0.2, y1: 0.2, z0: 12, z1: 14, c: 'lightbar' },
    ],
  }),
  tow: () => ({
    len: 2.2,
    wid: 0.62,
    lightZ: [5, 7],
    wheelZ: 5,
    boxes: [
      ...wheels(2.2, 0.62, 5, 0.22),
      { x0: 0.55, x1: 1.1, y0: -0.3, y1: 0.3, z0: 2, z1: 9, c: 'body' },
      { x0: 0.58, x1: 1.02, y0: -0.29, y1: 0.29, z0: 9, z1: 15, c: 'body', front: 'glass' },
      { x0: -1.1, x1: 0.52, y0: -0.31, y1: 0.31, z0: 3, z1: 7, c: 'dark' },
      { x0: -0.9, x1: -0.7, y0: -0.06, y1: 0.06, z0: 7, z1: 18, c: 'accent' },
      { x0: 0.3, x1: 0.5, y0: -0.26, y1: 0.26, z0: 7, z1: 11, c: 'accent' },
    ],
  }),
};

// ---------------------------------------------------------------------------

interface FaceDraw {
  pts: number[];
  depth: number;
  color: Packed;
}

function project(wx: number, wy: number, z: number, ax: number, ay: number): [number, number] {
  return [ax + (wx - wy) * 16, ay + (wx + wy) * 8 - z];
}

function sideBrightness(nx: number, ny: number): number {
  const phi = Math.atan2(ny, nx);
  const b = 0.89 + 0.11 * Math.sin(phi) - 0.11 * Math.cos(phi);
  return Math.round(b / 0.04) * 0.04;
}

function resolveColor(key: string, look: VehicleLook): Packed {
  const body = C(look.body);
  switch (key) {
    case 'body':
      return body;
    case 'accent':
      return C(look.accent ?? look.body);
    case 'glass':
      return C('glass');
    case 'tire':
      return C('tire');
    case 'dark':
      return C('slate8');
    case 'roof':
      return mix(body, C('white'), 0.35);
    case 'bed':
      return shade(body, 0.45);
    case 'lightbar':
      return C('slate2');
    default:
      return C(key);
  }
}

function renderDir(
  pc: PixelCanvas,
  model: Model,
  look: VehicleLook,
  theta: number,
  ax: number,
  ay: number,
  braking: boolean,
): void {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rot = (lx: number, ly: number): [number, number] => [lx * cos - ly * sin, lx * sin + ly * cos];

  // sombra
  {
    const hx = model.len / 2 + 0.05;
    const hy = model.wid / 2 + 0.06;
    const corners: [number, number][] = [
      [hx, -hy],
      [hx, hy],
      [-hx, hy],
      [-hx, -hy],
    ];
    const pts: number[] = [];
    for (const [lx, ly] of corners) {
      const [wx, wy] = rot(lx, ly);
      const [px, py] = project(wx + 0.04, wy + 0.04, 0, ax, ay);
      pts.push(px, py);
    }
    pc.poly(pts, C('ink', 70));
  }

  const faces: FaceDraw[] = [];
  const damaged = !!look.damaged;
  for (const b of model.boxes) {
    let bx1 = b.x1;
    if (damaged && b.c === 'body' && b.z0 <= 3) bx1 = b.x1 - 0.1; // capó abollado
    const X = [b.x0, bx1];
    const Y = [b.y0, b.y1];
    const Z = [b.z0, b.z1];
    const corner = (ix: number, iy: number, iz: number) => {
      const [wx, wy] = rot(X[ix], Y[iy]);
      return { wx, wy, z: Z[iz] };
    };
    const faceDefs: { n: [number, number, number]; idx: [number, number, number][]; key: string }[] = [
      { n: [0, 0, 1], idx: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], key: b.top ?? b.c },
      { n: [1, 0, 0], idx: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], key: b.front ?? b.ends ?? b.c },
      { n: [-1, 0, 0], idx: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], key: b.back ?? b.ends ?? b.c },
      { n: [0, 1, 0], idx: [[1, 1, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1]], key: b.sides ?? b.c },
      { n: [0, -1, 0], idx: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], key: b.sides ?? b.c },
    ];
    for (const f of faceDefs) {
      const [nwx, nwy] = rot(f.n[0], f.n[1]);
      const nz = f.n[2];
      const vis = nz > 0 ? true : nwx + nwy > 1e-6;
      if (!vis) continue;
      let base = resolveColor(f.key, look);
      let bright = nz > 0 ? 1.12 : sideBrightness(nwx, nwy);
      if (f.key === 'glass' && nz === 0) bright = bright * 1.0;
      const col = shade(base, bright);
      const pts: number[] = [];
      let depth = 0;
      for (const [ix, iy, iz] of f.idx) {
        const c = corner(ix, iy, iz);
        const [px, py] = project(c.wx, c.wy, c.z, ax, ay);
        pts.push(px, py);
        depth += c.wx + c.wy + c.z / 8;
      }
      faces.push({ pts, depth: depth / 4 + (nz > 0 ? 0.01 : 0), color: col });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  for (const f of faces) pc.poly(f.pts, f.color);

  // luces delanteras y traseras sobre la carrocería inferior
  const lower = model.boxes.find((b) => b.c === 'body' || b.c === 'accent')!;
  const [lz0, lz1] = model.lightZ;
  const lightQuad = (lx: number, ly0: number, ly1: number, color: Packed) => {
    const pts: number[] = [];
    for (const [ly, lz] of [
      [ly0, lz0],
      [ly1, lz0],
      [ly1, lz1],
      [ly0, lz1],
    ] as [number, number][]) {
      const [wx, wy] = rot(lx, ly);
      const [px, py] = project(wx, wy, lz, ax, ay);
      pts.push(px, py);
    }
    pc.poly(pts, color);
  };
  const hy = model.wid / 2;
  const [fwx, fwy] = rot(1, 0);
  const frontVisible = fwx + fwy > 1e-6;
  const frontX = model.boxes.reduce((m, b) => Math.max(m, b.x1), -9) - (damaged ? 0.1 : 0);
  const backX = model.boxes.reduce((m, b) => Math.min(m, b.x0), 9);
  void lower;
  const head = damaged ? C('slate6') : C('headlight');
  const tail = braking && !damaged ? C('#ff6a52') : C('taillight');
  const hazard = braking && damaged ? C('hazard') : 0;
  if (frontVisible) {
    lightQuad(frontX + 0.001, -hy + 0.05, -hy + 0.15, head);
    lightQuad(frontX + 0.001, hy - 0.15, hy - 0.05, head);
    if (hazard) {
      lightQuad(frontX + 0.001, -hy + 0.0, -hy + 0.06, hazard);
      lightQuad(frontX + 0.001, hy - 0.06, hy - 0.0, hazard);
    }
  } else {
    lightQuad(backX - 0.001, hy - 0.15, hy - 0.04, tail);
    lightQuad(backX - 0.001, -hy + 0.04, -hy + 0.15, tail);
    if (hazard) {
      lightQuad(backX - 0.001, hy - 0.05, hy + 0.0, hazard);
      lightQuad(backX - 0.001, -hy - 0.0, -hy + 0.05, hazard);
    }
  }
  if (look.model === 'police' && braking) {
    // balizas azules/rojas encendidas en cuadros alternativos
    const [wx, wy] = rot(-0.04, 0);
    const [px, py] = project(wx, wy, 14, ax, ay);
    pc.set(px - 2, py - 1, C('#4a8cff'));
    pc.set(px + 1, py - 1, C('#ff4a3d'));
  }
}

export function drawVehicleSheet(look: VehicleLook): GenOutput {
  const model = MODELS[look.model]();
  // calcular bounding box de todas las direcciones
  const tmpA = 64;
  const tmpW = 128;
  const tmpH = 96;
  const frames: PixelCanvas[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let v = 0; v < 2; v++) {
    for (let k = 0; k < 8; k++) {
      const pc = new PixelCanvas(tmpW, tmpH);
      renderDir(pc, model, look, (k * Math.PI) / 4, tmpA, tmpA - 4, v === 1);
      pc.outline(C('ink', 220));
      frames.push(pc);
      for (let y = 0; y < tmpH; y++)
        for (let x = 0; x < tmpW; x++)
          if (pc.data[y * tmpW + x] >>> 24) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
    }
  }
  // cuadro simétrico alrededor del ancla para que el origen sea el mismo en todas las direcciones
  const halfW = Math.max(tmpA - minX, maxX - tmpA) + 1;
  const up = tmpA - 4 - minY + 1;
  const down = maxY - (tmpA - 4) + 1;
  const fw = halfW * 2;
  const fh = up + down;
  // 2 filas de 8 cuadros: fila 0 = normal, fila 1 = frenando/balizas (índices 0-7 y 8-15)
  const sheet = new PixelCanvas(fw * 8, fh * 2);
  frames.forEach((f, i) => {
    const ox = (i % 8) * fw;
    const oy = Math.floor(i / 8) * fh;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const sx = tmpA - halfW + x;
        const sy = tmpA - 4 - up + y;
        const c = f.get(sx, sy);
        if (c) sheet.put(ox + x, oy + y, c);
      }
    }
  });
  return { pc: sheet, frameW: fw, frameH: fh, anchorX: halfW, anchorY: up };
}

export function vehicleLength(model: VehicleModelId): number {
  return MODELS[model]().len;
}
