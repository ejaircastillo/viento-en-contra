import { G } from './ground';
import type { SolidRect } from './types';
import type { Vec2 } from '../core/math';
import { solidsNear } from './CityBuilder';

/** Colisiones de caminata (círculo contra rectángulos) y búsqueda de caminos A* en grilla. */
export interface WalkGrid {
  w: number;
  h: number;
  walkGrid: Uint8Array;
  solidGrid: Map<number, SolidRect[]>;
  groundTypes: Uint8Array;
}

function groundOk(g: WalkGrid, x: number, y: number): boolean {
  const i = Math.floor(x);
  const j = Math.floor(y);
  if (i < 0 || j < 0 || i >= g.w || j >= g.h) return false;
  const t = g.groundTypes[j * g.w + i];
  return t !== G.WATER && t !== G.NONE;
}

export function canStand(g: WalkGrid, x: number, y: number, r: number, ignore?: (s: SolidRect) => boolean): boolean {
  if (!groundOk(g, x - r, y - r) || !groundOk(g, x + r, y - r) || !groundOk(g, x - r, y + r) || !groundOk(g, x + r, y + r))
    return false;
  for (const s of solidsNear(g, x, y, r)) {
    if (ignore?.(s)) continue;
    const cx = Math.max(s.x0, Math.min(x, s.x1));
    const cy = Math.max(s.y0, Math.min(y, s.y1));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return false;
  }
  return true;
}

export function moveWithCollision(g: WalkGrid, x: number, y: number, dx: number, dy: number, r: number, ignore?: (s: SolidRect) => boolean): Vec2 {
  if (canStand(g, x + dx, y + dy, r, ignore)) return { x: x + dx, y: y + dy };
  if (Math.abs(dx) > 1e-5 && canStand(g, x + dx, y, r, ignore)) return { x: x + dx, y };
  if (Math.abs(dy) > 1e-5 && canStand(g, x, y + dy, r, ignore)) return { x, y: y + dy };
  // si ya está trabado (ej. apareció dentro de algo), dejarlo salir
  if (!canStand(g, x, y, r, ignore)) return { x: x + dx, y: y + dy };
  return { x, y };
}

function lineClear(g: WalkGrid, a: Vec2, b: Vec2, r: number): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.ceil(d / 0.25);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!canStand(g, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r)) return false;
  }
  return true;
}

export function findPath(g: WalkGrid, sx: number, sy: number, tx: number, ty: number, r = 0.2, maxNodes = 6000): Vec2[] | null {
  const W = g.w;
  const si = Math.floor(sx);
  const sj = Math.floor(sy);
  let ti = Math.floor(tx);
  let tj = Math.floor(ty);
  const ok = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < g.h && g.walkGrid[j * W + i] === 1;
  if (!ok(ti, tj)) {
    // buscar la baldosa libre más cercana al objetivo
    let found = false;
    for (let rad = 1; rad < 4 && !found; rad++)
      for (let dj = -rad; dj <= rad && !found; dj++)
        for (let di = -rad; di <= rad && !found; di++)
          if (ok(ti + di, tj + dj)) {
            ti += di;
            tj += dj;
            found = true;
          }
    if (!found) return null;
  }
  const start = sj * W + si;
  const goal = tj * W + ti;
  const gScore = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const open: [number, number][] = [[0, start]];
  const closed = new Set<number>();
  const hfn = (k: number) => {
    const i = k % W;
    const j = (k / W) | 0;
    const dx = Math.abs(i - ti);
    const dy = Math.abs(j - tj);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  let iter = 0;
  while (open.length && iter++ < maxNodes) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, cur] = open.splice(bi, 1)[0];
    if (cur === goal) break;
    if (closed.has(cur)) continue;
    closed.add(cur);
    const ci = cur % W;
    const cj = (cur / W) | 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (!ok(ni, nj)) continue;
        if (di && dj && (!ok(ci + di, cj) || !ok(ci, cj + dj))) continue;
        const nk = nj * W + ni;
        const cost = (gScore.get(cur) ?? 0) + (di && dj ? 1.414 : 1);
        if (cost < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, cost);
          came.set(nk, cur);
          open.push([cost + hfn(nk), nk]);
        }
      }
  }
  if (!came.has(goal) && goal !== start) return null;
  const tiles: Vec2[] = [];
  let k = goal;
  while (k !== start) {
    tiles.push({ x: (k % W) + 0.5, y: ((k / W) | 0) + 0.5 });
    k = came.get(k)!;
    if (k === undefined) break;
  }
  tiles.reverse();
  // el último punto es el objetivo exacto si es alcanzable
  if (tiles.length && canStand(g, tx, ty, r)) tiles[tiles.length - 1] = { x: tx, y: ty };
  else if (!tiles.length) tiles.push({ x: tx, y: ty });
  // suavizado por línea de visión
  const out: Vec2[] = [];
  let anchor: Vec2 = { x: sx, y: sy };
  let idx = 0;
  while (idx < tiles.length) {
    let far = idx;
    for (let t = tiles.length - 1; t > idx; t--) {
      if (lineClear(g, anchor, tiles[t], r)) {
        far = t;
        break;
      }
    }
    out.push(tiles[far]);
    anchor = tiles[far];
    idx = far + 1;
  }
  return out;
}
