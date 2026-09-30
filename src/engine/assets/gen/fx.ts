import { PixelCanvas } from '../PixelCanvas';
import { C, shade } from '../Palette';
import type { GenOutput } from '../AssetRegistry';

/** Texturas chicas de efectos: estelas de viento, copos, flechas de ruta, sombras de nubes, humo, cables. */

export function fxParticles(): GenOutput {
  // tira: 0-2 estelas de viento (distintos largos), 3-4 copos, 5 gota
  const fw = 12;
  const fh = 3;
  const pc = new PixelCanvas(fw * 6, fh);
  const lens = [5, 8, 11];
  lens.forEach((L, i) => {
    for (let x = 0; x < L; x++) pc.set(i * fw + x, 1, C('snow', Math.round(80 + (x / L) * 110)));
  });
  pc.set(3 * fw + 1, 1, C('white', 230));
  pc.set(4 * fw + 1, 1, C('white', 200));
  pc.set(4 * fw + 2, 1, C('white', 150));
  pc.set(4 * fw + 1, 0, C('white', 150));
  pc.set(5 * fw + 1, 0, C('slate1', 160));
  pc.set(5 * fw + 1, 1, C('slate1', 200));
  return { pc, frameW: fw, frameH: fh, anchorX: 0, anchorY: 1 };
}

/** Flecha de ruta sobre el asfalto, 8 direcciones (misma convención que los autos). */
export function fxChevron(): GenOutput {
  const fw = 22;
  const fh = 14;
  const pc = new PixelCanvas(fw * 8, fh);
  const ax = fw / 2;
  const ay = fh / 2;
  for (let k = 0; k < 8; k++) {
    const th = (k * Math.PI) / 4;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    const P = (lx: number, ly: number): [number, number] => {
      const wx = lx * cos - ly * sin;
      const wy = lx * sin + ly * cos;
      return [k * fw + ax + (wx - wy) * 16, ay + (wx + wy) * 8];
    };
    const pts: [number, number][] = [
      [0.26, 0],
      [-0.12, -0.26],
      [-0.02, 0],
      [-0.12, 0.26],
    ];
    const flat: number[] = [];
    for (const [lx, ly] of pts) flat.push(...P(lx, ly));
    pc.poly(flat, C('#ffe27a', 235));
  }
  pc.outline(C('ink', 140));
  return { pc, frameW: fw, frameH: fh, anchorX: ax, anchorY: ay };
}

/** Sombra de nube (difusa, con tramado) que recorre el suelo empujada por el viento. */
export function fxCloudShadow(seed = 1): GenOutput {
  const w = 220;
  const h = 110;
  const pc = new PixelCanvas(w, h);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const blobs = Array.from({ length: 7 }, () => ({ x: 40 + rnd() * 140, y: 30 + rnd() * 50, r: 22 + rnd() * 30 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (const b of blobs) {
        const dx = (x - b.x) / b.r;
        const dy = ((y - b.y) * 2) / b.r;
        v = Math.max(v, 1 - (dx * dx + dy * dy));
      }
      if (v <= 0) continue;
      const a = Math.min(1, v * 1.6);
      // tramado 2x2 para mantener el look pixel
      const th = ((x & 1) + ((y & 1) << 1)) / 4;
      if (a > th + 0.12) pc.put(x, y, C('#1c2430', 46));
    }
  }
  return { pc, anchorX: w / 2, anchorY: h / 2 };
}

export function fxSmoke(): GenOutput {
  const fw = 6;
  const pc = new PixelCanvas(fw * 3, 6);
  for (let i = 0; i < 3; i++) {
    const r = 1 + i;
    pc.ellipse(i * fw + 3, 3, r, r * 0.8, C('slate1', 150 - i * 35));
  }
  return { pc, frameW: fw, frameH: 6, anchorX: 3, anchorY: 3 };
}

/** Cable entre dos postes: línea con catenaria desde (0,0) hasta (dx,dy). */
export function fxCable(dx: number, dy: number, sag = 4): GenOutput {
  const minX = Math.min(0, dx);
  const minY = Math.min(0, dy);
  const w = Math.abs(dx) + 3;
  const h = Math.abs(dy) + sag + 3;
  const pc = new PixelCanvas(w, h);
  const ox = -minX + 1;
  const oy = -minY + 1;
  const n = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
  let lx = -1;
  let ly = -1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(ox + dx * t);
    const y = Math.round(oy + dy * t + Math.sin(Math.PI * t) * sag);
    if (x !== lx || y !== ly) pc.set(x, y, C('#1e2228', 215));
    lx = x;
    ly = y;
  }
  return { pc, anchorX: ox, anchorY: oy };
}

export function fxBagSprite(color: string): GenOutput {
  const frames: PixelCanvas[] = [];
  const shapes = [
    ['.##.', '####', '.##.', '..#.'],
    ['..#.', '.###', '####', '.#..'],
    ['.#..', '####', '###.', '.##.'],
    ['.##.', '###.', '####', '..##'],
  ];
  const col = C(color);
  for (const sh of shapes) {
    const pc = new PixelCanvas(6, 6);
    sh.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && pc.set(x + 1, y + 1, x === 3 ? shade(col, 0.8) : col)));
    pc.outline(C('ink', 110));
    frames.push(pc);
  }
  const pc = new PixelCanvas(24, 6);
  frames.forEach((f, i) => pc.blit(f, i * 6, 0));
  return { pc, frameW: 6, frameH: 6, anchorX: 3, anchorY: 3 };
}
