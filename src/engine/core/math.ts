// Matemática base del motor: proyección isométrica 2:1, direcciones, RNG determinista y utilidades.
//
// Convención de mundo (unidades = baldosas):
//   +x → abajo-derecha en pantalla ("E" en el código)
//   +y → abajo-izquierda en pantalla ("S")
//   z  → altura en píxeles de arte
// La baldosa (i, j) es un rombo de 32x16 px cuyo vértice superior está en isoToScreen(i, j).

export const TILE_W = 32;
export const TILE_H = 16;
export const HALF_W = 16;
export const HALF_H = 8;

export interface Vec2 {
  x: number;
  y: number;
}

export function isoToScreen(x: number, y: number, z = 0): Vec2 {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H - z };
}

export function screenToIso(sx: number, sy: number): Vec2 {
  const a = sx / HALF_W;
  const b = sy / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Profundidad de dibujo para un punto del suelo. Mayor = más cerca de la cámara. */
export function depthOf(x: number, y: number, bias = 0): number {
  return (x + y + bias) * 100;
}

// ---------------------------------------------------------------------------
// Direcciones
// ---------------------------------------------------------------------------

export type Dir4 = 'E' | 'S' | 'W' | 'N';
export const DIRS4: Dir4[] = ['E', 'S', 'W', 'N'];

export const DIR_VEC: Record<Dir4, Vec2> = {
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
  N: { x: 0, y: -1 },
};

/** Vector de pantalla normalizado para cada dirección de mundo. */
export const DIR_SCREEN: Record<Dir4, Vec2> = (() => {
  const out = {} as Record<Dir4, Vec2>;
  for (const d of DIRS4) {
    const v = DIR_VEC[d];
    const sx = (v.x - v.y) * HALF_W;
    const sy = (v.x + v.y) * HALF_H;
    const len = Math.hypot(sx, sy);
    out[d] = { x: sx / len, y: sy / len };
  }
  return out;
})();

export function opposite(d: Dir4): Dir4 {
  return d === 'E' ? 'W' : d === 'W' ? 'E' : d === 'S' ? 'N' : 'S';
}

/** Giro a la derecha (tránsito por la derecha, y hacia abajo en el plano). */
export function rightOf(d: Dir4): Dir4 {
  return d === 'E' ? 'S' : d === 'S' ? 'W' : d === 'W' ? 'N' : 'E';
}

export function leftOf(d: Dir4): Dir4 {
  return d === 'E' ? 'N' : d === 'N' ? 'W' : d === 'W' ? 'S' : 'E';
}

export function dirFromVec(dx: number, dy: number): Dir4 {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'E' : 'W';
  return dy >= 0 ? 'S' : 'N';
}

export function dirAngle(d: Dir4): number {
  return d === 'E' ? 0 : d === 'S' ? Math.PI / 2 : d === 'W' ? Math.PI : -Math.PI / 2;
}

/** Ángulo de mundo → índice de 8 direcciones (0 = +x, sentido horario hacia +y). */
export function angleToDir8(angle: number): number {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(a / (Math.PI / 4)) % 8;
}

/** Vector de pantalla (joystick) → vector de mundo normalizado (para caminar libremente). */
export function screenVecToWorld(sx: number, sy: number): Vec2 {
  // Inversa de la proyección para vectores (sin normalizar la escala de pantalla).
  const a = sx / HALF_W;
  const b = sy / HALF_H;
  let x = (a + b) / 2;
  let y = (b - a) / 2;
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0 };
  x /= len;
  y /= len;
  return { x, y };
}

/**
 * Resuelve qué dirección de calle quiere el jugador a partir de un vector de pantalla,
 * con histéresis a favor del rumbo actual (necesario porque en iso "arriba" o "derecha"
 * quedan exactamente entre dos calles).
 */
export function resolveDesiredDir(input: Vec2, heading: Dir4 | null): Dir4 | null {
  const mag = Math.hypot(input.x, input.y);
  if (mag < 0.3) return null;
  const nx = input.x / mag;
  const ny = input.y / mag;
  const scored = DIRS4.map((d) => ({ d, s: nx * DIR_SCREEN[d].x + ny * DIR_SCREEN[d].y })).sort(
    (a, b) => b.s - a.s,
  );
  const [best, second] = scored;
  if (best.s < 0.25) return null;
  if (best.s - second.s < 0.2 && heading) {
    const pair = [best.d, second.d];
    if (pair.includes(heading)) return heading;
    const opp = opposite(heading);
    if (pair.includes(opp)) return pair[0] === opp ? pair[1] : pair[0];
  }
  return best.d;
}

// ---------------------------------------------------------------------------
// Numérica
// ---------------------------------------------------------------------------

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  return Math.max(target, current - maxDelta);
}

/** Interpolación exponencial independiente del framerate. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

// ---------------------------------------------------------------------------
// Aleatoriedad determinista
// ---------------------------------------------------------------------------

export function hash2(x: number, y: number, seed = 0): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1442695041;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

// ---------------------------------------------------------------------------
// Tiempo de reloj ("HH:MM")
// ---------------------------------------------------------------------------

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

export function formatHHMM(minutes: number): string {
  const m = Math.floor(minutes) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
