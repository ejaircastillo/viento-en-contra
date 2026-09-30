import type { Face, PixelCanvas } from './PixelCanvas';
import type { Packed } from './Palette';

// Fuente bitmap 5x7 (mayúsculas) para carteles dentro del mundo. Original, dibujada a mano.
// Soporta tildes, Ñ, Ü, ¡ ¿ y signos comunes de la cartelería argentina.

const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  ';': ['..', '..', '.#', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '¡': ['#', '.', '#', '#', '#', '#', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '¿': ['..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['...', '...', '.#.', '###', '.#.', '...', '...'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '=': ['....', '....', '####', '....', '####', '....', '....'],
  '°': ['.#.', '#.#', '.#.', '...', '...', '...', '...'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
};

// Diacríticos: filas por encima de la línea de mayúsculas (-2 y -1).
const ACCENT: Record<string, { base: string; mark: 'acute' | 'tilde' | 'diaer' }> = {
  Á: { base: 'A', mark: 'acute' },
  É: { base: 'E', mark: 'acute' },
  Í: { base: 'I', mark: 'acute' },
  Ó: { base: 'O', mark: 'acute' },
  Ú: { base: 'U', mark: 'acute' },
  Ñ: { base: 'N', mark: 'tilde' },
  Ü: { base: 'U', mark: 'diaer' },
};

export const FONT_H = 7;
export const FONT_ASCENT = 2; // píxeles extra por encima para tildes

function glyphFor(ch: string): { rows: string[]; mark?: 'acute' | 'tilde' | 'diaer' } {
  const up = ch.toUpperCase();
  const acc = ACCENT[up];
  if (acc) return { rows: G[acc.base], mark: acc.mark };
  return { rows: G[up] ?? G['?'] };
}

export function measureText(text: string, spacing = 1): number {
  let w = 0;
  const chars = [...text];
  chars.forEach((ch, i) => {
    w += glyphFor(ch).rows[0].length;
    if (i < chars.length - 1) w += spacing;
  });
  return w;
}

type Plot = (x: number, y: number) => void;

/** Dibuja un glifo con origen en (0,0) = esquina superior izquierda; devuelve su ancho (sin escala). */
function renderGlyph(ch: string, plot: Plot, scale = 1): number {
  const { rows, mark } = glyphFor(ch);
  const gw = rows[0].length;
  for (let gy = 0; gy < rows.length; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (rows[gy][gx] === '#') {
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) plot(gx * scale + sx, gy * scale + sy);
      }
    }
  }
  if (mark) {
    const mid = Math.floor(gw / 2);
    const pts: [number, number][] =
      mark === 'acute'
        ? [
            [mid + 1, -2],
            [mid, -1],
          ]
        : mark === 'diaer'
          ? [
              [mid - 1, -1],
              [mid + 1, -1],
            ]
          : [
              [0, -1],
              [1, -2],
              [2, -1],
              [3, -2],
            ];
    for (const [px, py] of pts)
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) plot(px * scale + sx, py * scale + sy);
  }
  return gw;
}

function renderText(text: string, plot: Plot, spacing = 1, scale = 1): void {
  let cx = 0;
  for (const ch of text) {
    const x0 = cx * scale;
    const gw = renderGlyph(ch, (px, py) => plot(x0 + px, py), scale);
    cx += gw + spacing;
  }
}

/** Contorno de 1 px (8 vecinos) alrededor de un conjunto de píxeles, sin pisar los propios. */
function withOutline(draw: (plot: Plot) => void, plotFg: Plot, plotOutline: Plot): void {
  const pts: [number, number][] = [];
  draw((x, y) => pts.push([x, y]));
  const own = new Set(pts.map(([x, y]) => `${x},${y}`));
  const done = new Set<string>();
  for (const [x, y] of pts) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const k = `${x + dx},${y + dy}`;
        if (own.has(k) || done.has(k)) continue;
        done.add(k);
        plotOutline(x + dx, y + dy);
      }
  }
  for (const [x, y] of pts) plotFg(x, y);
}

/** Texto plano (frontal). (x, y) = esquina superior izquierda de las mayúsculas. */
export function drawText(
  pc: PixelCanvas,
  text: string,
  x: number,
  y: number,
  color: Packed,
  opts: { spacing?: number; scale?: number; shadow?: Packed; outline?: Packed } = {},
): number {
  const spacing = opts.spacing ?? 1;
  const scale = opts.scale ?? 1;
  if (opts.shadow) renderText(text, (px, py) => pc.set(x + px + 1, y + py + 1, opts.shadow!), spacing, scale);
  const draw = (plot: Plot) => renderText(text, plot, spacing, scale);
  if (opts.outline) {
    withOutline(
      draw,
      (px, py) => pc.set(x + px, y + py, color),
      (px, py) => pc.set(x + px, y + py, opts.outline!),
    );
  } else draw((px, py) => pc.set(x + px, y + py, color));
  return measureText(text, spacing) * scale;
}

/**
 * Texto sobre una cara isométrica. Por defecto cada letra queda DERECHA y el renglón baja
 * (o sube) en escalones siguiendo la pendiente de la pared: así se lee como un cartel real
 * visto en diagonal. `sheared: true` cizalla las letras 2:1 (sólo para relieves decorativos).
 */
export function drawTextOnFace(
  face: Face,
  text: string,
  u0: number,
  zTop: number,
  color: Packed,
  opts: { spacing?: number; scale?: number; sheared?: boolean; outline?: Packed } = {},
): number {
  const spacing = opts.spacing ?? 1;
  const scale = opts.scale ?? 1;
  let draw: (plot: Plot) => void;
  if (opts.sheared) {
    draw = (plot) => renderText(text, (px, py) => plot(face.x0 + u0 + px, face.bottom(u0 + px) - zTop + py), spacing, scale);
  } else {
    draw = (plot) => {
      let cx = 0;
      for (const ch of text) {
        const gu = u0 + cx * scale;
        const gw = glyphFor(ch).rows[0].length;
        // cada letra se apoya en la altura de la pared en su columna central
        const base = face.bottom(gu + Math.floor((gw * scale) / 2)) - zTop;
        renderGlyph(ch, (px, py) => plot(face.x0 + gu + px, base + py), scale);
        cx += gw + spacing;
      }
    };
  }
  if (opts.outline) {
    withOutline(
      draw,
      (x, y) => face.pc.set(x, y, color),
      (x, y) => face.pc.set(x, y, opts.outline!),
    );
  } else draw((x, y) => face.pc.set(x, y, color));
  return measureText(text, spacing) * scale;
}

/**
 * Ajusta líneas a un ancho: primero reduce el espaciado, después parte en palabras
 * (hasta maxLines) y como último recurso recorta. Así ningún cartel se desborda.
 */
export function fitText(lines: string[], avail: number, maxLines: number): { lines: string[]; spacing: number } {
  const clean = lines.filter((l) => l && l.length);
  for (const sp of [1, 0]) if (clean.every((l) => measureText(l, sp) <= avail)) return { lines: clean, spacing: sp };
  const out: string[] = [];
  for (const l of clean) {
    if (measureText(l, 0) <= avail) {
      out.push(l);
      continue;
    }
    let cur = '';
    for (const w of l.split(' ')) {
      const t = cur ? `${cur} ${w}` : w;
      if (measureText(t, 0) <= avail) cur = t;
      else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
  }
  const trunc = (s: string) => {
    let t = s;
    while (t.length > 1 && measureText(t, 0) > avail) t = t.slice(0, -1);
    return t;
  };
  if (out.length <= maxLines) return { lines: out.map(trunc), spacing: 0 };
  return { lines: clean.slice(0, maxLines).map(trunc), spacing: 0 };
}

/**
 * Parte un renglón en palabras para que entre en `avail` px con espaciado normal
 * (más legible que apretar letras). Sólo si una palabra sola no entra, aprieta ese renglón.
 */
export function wrapLine(text: string, avail: number, maxLines = 3): { text: string; spacing: number }[] {
  const out: { text: string; spacing: number }[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (measureText(t, 1) <= avail || !cur) cur = t;
    else {
      out.push({ text: cur, spacing: 1 });
      cur = w;
    }
  }
  if (cur) out.push({ text: cur, spacing: 1 });
  for (const l of out) {
    if (measureText(l.text, 1) <= avail) continue;
    l.spacing = 0;
    while (l.text.length > 1 && measureText(l.text, 0) > avail) l.text = l.text.slice(0, -1);
  }
  return out.slice(0, maxLines);
}

/** Centra texto en una cara: devuelve u0. */
export function centerOnFace(text: string, faceLen: number, spacing = 1, scale = 1): number {
  return Math.floor((faceLen - measureText(text, spacing) * scale) / 2);
}
