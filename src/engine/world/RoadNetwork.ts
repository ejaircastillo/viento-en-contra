import { DIR_VEC, leftOf, opposite, rightOf, type Dir4 } from '../core/math';
import type { SignalDef, StreetInfo } from './types';

/**
 * Red vial dirigida construida a partir de las calles del plano.
 * Carriles = aristas rectas entre intersecciones; giros = curvas Bézier dentro de cada cruce.
 * Tránsito por la derecha (Argentina).
 */

export type TurnKind = 'straight' | 'left' | 'right' | 'uturn';

export interface LaneEdge {
  id: number;
  kind: 'lane' | 'turn';
  street: StreetInfo | null;
  dir: Dir4;
  lane: number;
  pts: number[];
  cum: number[];
  length: number;
  next: number[];
  /** Intersección al final (lane) o que contiene la curva (turn). -1 si no hay. */
  inter: number;
  entryInter: number;
  signalAxis: 'x' | 'y' | null;
  turn: TurnKind | null;
  /** Para giros: carril de salida. */
  target: number;
  /** Para giros: carril de entrada (-1 en carriles). */
  source: number;
  /** Carril opuesto (externo) en el mismo tramo, para giros en U a mitad de cuadra. */
  opposite: number;
  /** Tramo: [desde, hasta] a lo largo del eje de la calle. */
  span: [number, number];
  deadEnd: boolean;
  mapEdge: boolean;
}

export interface Signal {
  broken: boolean;
  t: number;
  phase: number;
}

export interface Intersection {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  xs: StreetInfo;
  ys: StreetInfo;
  signal: Signal | null;
  occupants: Set<number>;
  key: string;
}

// Ciclo del semáforo: [eje, estado, duración]
const CYCLE: ['x' | 'y' | null, 'green' | 'yellow' | 'red', number][] = [
  ['x', 'green', 9],
  ['x', 'yellow', 2],
  [null, 'red', 1.2],
  ['y', 'green', 9],
  ['y', 'yellow', 2],
  [null, 'red', 1.2],
];

export function laneCoord(s: StreetInfo, dir: Dir4, k: number): number {
  const { lanes: L, median: m, p, at } = s;
  if (s.axis === 'x') return dir === 'E' ? at + p + 2 * L + m - 1 - k + 0.5 : at + p + k + 0.5;
  return dir === 'S' ? at + p + k + 0.5 : at + p + 2 * L + m - 1 - k + 0.5;
}

export function parkingCoord(s: StreetInfo, dir: Dir4): number | null {
  if (!s.parking) return null;
  const { lanes: L, median: m, p, at } = s;
  if (s.axis === 'x') return dir === 'E' ? at + p + 2 * L + m + 0.5 : at + 0.5;
  return dir === 'S' ? at + 0.5 : at + p + 2 * L + m + 0.5;
}

function streetDirs(s: StreetInfo): [Dir4, Dir4] {
  return s.axis === 'x' ? ['E', 'W'] : ['S', 'N'];
}

function polyLen(pts: number[]): { cum: number[]; length: number } {
  const cum = [0];
  let L = 0;
  for (let i = 2; i < pts.length; i += 2) {
    L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    cum.push(L);
  }
  return { cum, length: L };
}

export interface EdgePoint {
  x: number;
  y: number;
  angle: number;
}

export class RoadNetwork {
  edges: LaneEdge[] = [];
  inters: Intersection[] = [];
  /** Bloqueos efectivos para el tránsito (estáticos + dinámicos). */
  blocked = new Set<number>();
  /** Bloqueos que conoce el GPS del jugador. */
  known = new Set<number>();
  private laneKey = new Map<string, number>();
  private streets: StreetInfo[];
  private mapW: number;
  private mapH: number;

  constructor(streets: StreetInfo[], signals: SignalDef[], mapW: number, mapH: number) {
    this.streets = streets;
    this.mapW = mapW;
    this.mapH = mapH;
    this.buildIntersections(signals);
    this.buildLanes();
    this.buildTurns();
  }

  // ------------------------------------------------------------ construcción

  private buildIntersections(signals: SignalDef[]): void {
    const xs = this.streets.filter((s) => s.axis === 'x');
    const ys = this.streets.filter((s) => s.axis === 'y');
    for (const X of xs) {
      for (const Y of ys) {
        const overlapY = Y.from < X.at + X.width && Y.to > X.at;
        const overlapX = X.from < Y.at + Y.width && X.to > Y.at;
        if (!overlapX || !overlapY) continue;
        const sig = signals.find((d) => d.x === X.id && d.y === Y.id);
        this.inters.push({
          id: this.inters.length,
          x0: Y.at,
          x1: Y.at + Y.width,
          y0: X.at,
          y1: X.at + X.width,
          xs: X,
          ys: Y,
          signal: sig ? { broken: !!sig.broken, t: Math.random() * 20, phase: 0 } : null,
          occupants: new Set(),
          key: `${X.id}/${Y.id}`,
        });
      }
    }
    for (const I of this.inters) if (I.signal) this.syncPhase(I.signal);
  }

  private intersOn(s: StreetInfo): Intersection[] {
    const list = this.inters.filter((I) => (s.axis === 'x' ? I.xs === s : I.ys === s));
    return list.sort((a, b) => (s.axis === 'x' ? a.x0 - b.x0 : a.y0 - b.y0));
  }

  private buildLanes(): void {
    for (const s of this.streets) {
      const list = this.intersOn(s);
      // tramos entre intersecciones
      const segs: { a: number; b: number; startI: number; endI: number }[] = [];
      let start = s.from;
      let startI = -1;
      for (const I of list) {
        const i0 = s.axis === 'x' ? I.x0 : I.y0;
        const i1 = s.axis === 'x' ? I.x1 : I.y1;
        if (i0 - start > 0.01) segs.push({ a: start, b: i0, startI, endI: I.id });
        start = i1;
        startI = I.id;
      }
      if (s.to - start > 0.01) segs.push({ a: start, b: s.to, startI, endI: -1 });
      segs.forEach((seg, si) => {
        for (const dir of streetDirs(s)) {
          const forward = dir === 'E' || dir === 'S';
          for (let k = 0; k < s.lanes; k++) {
            const c = laneCoord(s, dir, k);
            const a = forward ? seg.a : seg.b;
            const b = forward ? seg.b : seg.a;
            const pts = s.axis === 'x' ? [a, c, b, c] : [c, a, c, b];
            const { cum, length } = polyLen(pts);
            const exitI = forward ? seg.endI : seg.startI;
            const entryI = forward ? seg.startI : seg.endI;
            const endCoord = b;
            const atMapEdge =
              exitI === -1 &&
              (s.axis === 'x'
                ? endCoord <= 0.5 || endCoord >= this.mapW - 0.5
                : endCoord <= 0.5 || endCoord >= this.mapH - 0.5);
            const e: LaneEdge = {
              id: this.edges.length,
              kind: 'lane',
              street: s,
              dir,
              lane: k,
              pts,
              cum,
              length,
              next: [],
              inter: exitI,
              entryInter: entryI,
              signalAxis: exitI >= 0 && this.inters[exitI].signal ? s.axis : null,
              turn: null,
              target: -1,
              source: -1,
              opposite: -1,
              span: [seg.a, seg.b],
              deadEnd: exitI === -1,
              mapEdge: atMapEdge,
            };
            this.edges.push(e);
            this.laneKey.set(`${s.id}|${si}|${dir}|${k}`, e.id);
          }
        }
      });
      // opuestos
      segs.forEach((_, si) => {
        const [d1, d2] = streetDirs(s);
        for (let k = 0; k < s.lanes; k++) {
          const e1 = this.laneKey.get(`${s.id}|${si}|${d1}|${k}`);
          const e2 = this.laneKey.get(`${s.id}|${si}|${d2}|${k}`);
          const o1 = this.laneKey.get(`${s.id}|${si}|${d2}|0`);
          const o2 = this.laneKey.get(`${s.id}|${si}|${d1}|0`);
          if (e1 !== undefined && o1 !== undefined) this.edges[e1].opposite = o1;
          if (e2 !== undefined && o2 !== undefined) this.edges[e2].opposite = o2;
        }
      });
    }
  }

  private addCurve(from: LaneEdge, to: LaneEdge, turn: TurnKind, inter: number): LaneEdge {
    const px = from.pts[from.pts.length - 2];
    const py = from.pts[from.pts.length - 1];
    const qx = to.pts[0];
    const qy = to.pts[1];
    const dIn = DIR_VEC[from.dir];
    const dOut = DIR_VEC[to.dir];
    const pts: number[] = [];
    if (turn === 'straight') {
      pts.push(px, py, qx, qy);
    } else if (turn === 'uturn') {
      const reach = 0.9;
      const c1x = px + dIn.x * reach;
      const c1y = py + dIn.y * reach;
      const c2x = qx - dOut.x * reach;
      const c2y = qy - dOut.y * reach;
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const mt = 1 - t;
        pts.push(
          mt * mt * mt * px + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * qx,
          mt * mt * mt * py + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * qy,
        );
      }
    } else {
      // punto de control: cruce de las dos rectas de carril
      const cx = dIn.x !== 0 ? qx : px;
      const cy = dIn.y !== 0 ? qy : py;
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const mt = 1 - t;
        pts.push(mt * mt * px + 2 * mt * t * cx + t * t * qx, mt * mt * py + 2 * mt * t * cy + t * t * qy);
      }
    }
    const { cum, length } = polyLen(pts);
    const e: LaneEdge = {
      id: this.edges.length,
      kind: 'turn',
      street: null,
      dir: to.dir,
      lane: to.lane,
      pts,
      cum,
      length,
      next: [to.id],
      inter,
      entryInter: inter,
      signalAxis: null,
      turn,
      target: to.id,
      source: from.id,
      opposite: -1,
      span: [0, 0],
      deadEnd: false,
      mapEdge: false,
    };
    this.edges.push(e);
    from.next.push(e.id);
    return e;
  }

  private buildTurns(): void {
    const lanes = this.edges.filter((e) => e.kind === 'lane');
    for (const e of lanes) {
      if (e.inter >= 0) {
        const I = this.inters[e.inter];
        const outs = lanes.filter((o) => o.entryInter === I.id && o.dir !== opposite(e.dir));
        for (const o of outs) {
          let turn: TurnKind | null = null;
          if (o.dir === e.dir && o.street === e.street) {
            if (o.lane === Math.min(e.lane, o.street!.lanes - 1)) turn = 'straight';
          } else if (o.dir === rightOf(e.dir)) {
            if (o.lane === 0) turn = 'right';
          } else if (o.dir === leftOf(e.dir)) {
            if (o.lane === o.street!.lanes - 1) turn = 'left';
          }
          if (turn) this.addCurve(e, o, turn, I.id);
        }
      } else if (e.deadEnd) {
        const opp = e.opposite >= 0 ? this.edges[e.opposite] : null;
        if (opp) this.addCurve(e, opp, 'uturn', -1);
      }
    }
  }

  // ------------------------------------------------------------ semáforos

  private syncPhase(sig: Signal): void {
    const total = CYCLE.reduce((a, c) => a + c[2], 0);
    let t = ((sig.t % total) + total) % total;
    for (let i = 0; i < CYCLE.length; i++) {
      if (t < CYCLE[i][2]) {
        sig.phase = i;
        return;
      }
      t -= CYCLE[i][2];
    }
  }

  update(dt: number): void {
    for (const I of this.inters) {
      if (!I.signal || I.signal.broken) continue;
      I.signal.t += dt;
      this.syncPhase(I.signal);
    }
  }

  /** Estado del semáforo para un eje: 'green' | 'yellow' | 'red' | 'blink' | null (sin semáforo). */
  lightFor(I: Intersection, axis: 'x' | 'y'): 'green' | 'yellow' | 'red' | 'blink' | null {
    if (!I.signal) return null;
    if (I.signal.broken) return 'blink';
    const [ax, state] = CYCLE[I.signal.phase];
    if (ax === axis) return state;
    return 'red';
  }

  // ------------------------------------------------------------ consultas

  pointAt(e: LaneEdge, d: number): EdgePoint {
    const pts = e.pts;
    const cum = e.cum;
    const dd = Math.max(0, Math.min(e.length, d));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < dd) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = (dd - cum[i - 1]) / seg;
    const ax = pts[(i - 1) * 2];
    const ay = pts[(i - 1) * 2 + 1];
    const bx = pts[i * 2];
    const by = pts[i * 2 + 1];
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle: Math.atan2(by - ay, bx - ax) };
  }

  isBlocked(e: LaneEdge, forPlayerRoute = false): boolean {
    const set = forPlayerRoute ? this.known : this.blocked;
    if (set.has(e.id)) return true;
    if (e.kind === 'turn' && e.target >= 0 && set.has(e.target)) return true;
    return false;
  }

  /** Proyección de un punto sobre un carril: distancia lateral y posición a lo largo. */
  project(e: LaneEdge, x: number, y: number): { d: number; lat: number } {
    let best = { d: 0, lat: Infinity };
    for (let i = 2; i < e.pts.length; i += 2) {
      const ax = e.pts[i - 2];
      const ay = e.pts[i - 1];
      const bx = e.pts[i];
      const by = e.pts[i + 1];
      const vx = bx - ax;
      const vy = by - ay;
      const L2 = vx * vx + vy * vy || 1;
      let t = ((x - ax) * vx + (y - ay) * vy) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + vx * t;
      const py = ay + vy * t;
      const lat = Math.hypot(x - px, y - py);
      if (lat < best.lat) best = { d: e.cum[(i >> 1) - 1] + Math.sqrt(L2) * t, lat };
    }
    return best;
  }

  nearestLane(x: number, y: number, pred?: (e: LaneEdge) => boolean): { edge: LaneEdge; d: number; lat: number } | null {
    let best: { edge: LaneEdge; d: number; lat: number } | null = null;
    for (const e of this.edges) {
      if (e.kind !== 'lane') continue;
      if (pred && !pred(e)) continue;
      const p = this.project(e, x, y);
      if (!best || p.lat < best.lat) best = { edge: e, d: p.d, lat: p.lat };
    }
    return best;
  }

  /** Lugar de estacionamiento más cercano a un punto: carril de circulación adyacente + posición. */
  parkingSpot(x: number, y: number): { edge: LaneEdge; d: number; px: number; py: number; angle: number } | null {
    let best: { edge: LaneEdge; d: number; px: number; py: number; angle: number; dist: number } | null = null;
    for (const e of this.edges) {
      if (e.kind !== 'lane' || e.lane !== 0 || !e.street?.parking) continue;
      const pc = parkingCoord(e.street, e.dir)!;
      const s = e.street;
      const along = s.axis === 'x' ? x : y;
      const lo = Math.min(e.span[0], e.span[1]) + 0.8;
      const hi = Math.max(e.span[0], e.span[1]) - 0.8;
      if (along < lo || along > hi) continue;
      const lat = Math.abs((s.axis === 'x' ? y : x) - pc);
      if (lat > 2.2) continue;
      if (!best || lat < best.dist) {
        const forward = e.dir === 'E' || e.dir === 'S';
        const d = forward ? along - e.span[0] : e.span[1] - along;
        const px = s.axis === 'x' ? along : pc;
        const py = s.axis === 'x' ? pc : along;
        const angle = Math.atan2(DIR_VEC[e.dir].y, DIR_VEC[e.dir].x);
        best = { edge: e, d, px, py, angle, dist: lat };
      }
    }
    return best;
  }

  /**
   * Lugar de estacionamiento junto a `from` desde el cual se llega a `to` sin vuelta en U: del lado de la calle
   * que ya mira hacia donde hay que ir (así una escena de manejo arranca sin pedir maniobras raras).
   * Si los dos lados dan igual, o `to` no tiene ruta, devuelve el más cercano.
   */
  parkingSpotToward(from: [number, number], to: [number, number]): { edge: LaneEdge; d: number; px: number; py: number; angle: number } | null {
    const spots = this.parkingSpots(from[0], from[1]);
    if (spots.length < 2) return spots[0] ?? null;
    const goals = this.parkingSpots(to[0], to[1]);
    let best: { spot: (typeof spots)[number]; cost: number } | null = null;
    for (const s of spots)
      for (const g of goals) {
        const r = this.route(s.edge.id, s.d, g.edge.id, g.d, true);
        if (r && (!best || r.cost < best.cost - 0.5)) best = { spot: s, cost: r.cost };
      }
    return best?.spot ?? spots[0];
  }

  /** Lugares de estacionamiento a ambos lados de la calle más cercana (el más cercano primero). */
  parkingSpots(x: number, y: number): { edge: LaneEdge; d: number; px: number; py: number; angle: number }[] {
    const first = this.parkingSpot(x, y);
    if (!first) return [];
    const s = first.edge.street!;
    const other = s.axis === 'x' ? (first.edge.dir === 'E' ? 'W' : 'E') : first.edge.dir === 'S' ? 'N' : 'S';
    const oc = parkingCoord(s, other);
    if (oc === null) return [first];
    const mx = s.axis === 'x' ? x : oc;
    const my = s.axis === 'x' ? oc : y;
    const second = this.parkingSpot(mx, my);
    return second && second.edge.street === s && second.edge.dir !== first.edge.dir ? [first, second] : [first];
  }

  /** Carril vecino en el mismo tramo (para sobrepasar). */
  sideLane(e: LaneEdge, delta: number): LaneEdge | null {
    if (e.kind !== 'lane' || !e.street) return null;
    const k = e.lane + delta;
    if (k < 0 || k >= e.street.lanes) return null;
    for (const o of this.edges) {
      if (o.kind === 'lane' && o.street === e.street && o.dir === e.dir && o.lane === k && o.span[0] === e.span[0])
        return o;
    }
    return null;
  }

  /** Bloquea tramos de una calle entre dos coordenadas del eje. */
  blockStreet(streetId: string, from: number, to: number, known: boolean): number[] {
    const out: number[] = [];
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (const e of this.edges) {
      if (e.kind !== 'lane' || e.street?.id !== streetId) continue;
      const a = Math.min(e.span[0], e.span[1]);
      const b = Math.max(e.span[0], e.span[1]);
      if (b > lo && a < hi) {
        this.blocked.add(e.id);
        if (known) this.known.add(e.id);
        out.push(e.id);
      }
    }
    return out;
  }

  /**
   * Bloquea un cruce completo (todas sus curvas internas). Los carriles que desembocan
   * quedan como calles sin salida: se puede circular y estacionar en ellos, pero no cruzar.
   */
  blockIntersection(key: string, known: boolean): number[] {
    const I = this.inters.find((i) => i.key === key);
    if (!I) return [];
    const out: number[] = [];
    for (const e of this.edges) {
      if (e.kind === 'turn' && e.inter === I.id) {
        this.blocked.add(e.id);
        if (known) this.known.add(e.id);
        out.push(e.id);
      }
    }
    return out;
  }

  /** ¿La arista lleva a un carril sin ninguna salida transitable? (la IA evita meterse). */
  leadsNowhere(e: LaneEdge): boolean {
    const lane = e.kind === 'turn' ? this.edges[e.target] : e;
    if (!lane || lane.mapEdge) return false;
    if (!lane.next.length) return !lane.mapEdge;
    return lane.next.every((n) => this.isBlocked(this.edges[n]));
  }

  learn(ids: number[]): void {
    for (const id of ids) this.known.add(id);
  }

  intersectionByKey(key: string): Intersection | undefined {
    return this.inters.find((i) => i.key === key);
  }

  // ------------------------------------------------------------ rutas

  /**
   * Dijkstra sobre aristas. Devuelve la lista de aristas desde el inicio hasta el objetivo,
   * o null si no hay camino. Penaliza giros a la izquierda y en U.
   */
  route(
    startEdge: number,
    startD: number,
    goalEdge: number,
    goalD: number,
    forPlayer: boolean,
    extraStartCost = 0,
  ): { edges: number[]; cost: number } | null {
    if (startEdge === goalEdge && goalD >= startD - 0.05) {
      return { edges: [startEdge], cost: goalD - startD + extraStartCost };
    }
    const N = this.edges.length;
    const dist = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const start = this.edges[startEdge];
    // costo al llegar al FINAL de cada arista
    dist[startEdge] = start.length - startD + extraStartCost;
    const heap: [number, number][] = [[dist[startEdge], startEdge]];
    const push = (c: number, id: number) => {
      heap.push([c, id]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = (): [number, number] | undefined => {
      if (!heap.length) return undefined;
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    let bestGoal = Infinity;
    let goalPrev = -1;
    for (;;) {
      const item = pop();
      if (!item) break;
      const [c, id] = item;
      if (done[id]) continue;
      done[id] = 1;
      if (c >= bestGoal) break;
      const e = this.edges[id];
      for (const nid of e.next) {
        const n = this.edges[nid];
        if (this.isBlocked(n, forPlayer) && nid !== goalEdge) continue;
        if (!forPlayer && this.blocked.has(nid)) continue;
        let pen = 0;
        if (n.turn === 'left') pen = 0.8;
        else if (n.turn === 'right') pen = 0.2;
        else if (n.turn === 'uturn') pen = 10;
        if (nid === goalEdge) {
          const total = c + pen + goalD;
          if (total < bestGoal) {
            bestGoal = total;
            goalPrev = id;
          }
          continue;
        }
        const nc = c + pen + n.length;
        if (nc < dist[nid]) {
          dist[nid] = nc;
          prev[nid] = id;
          push(nc, nid);
        }
      }
    }
    if (goalPrev < 0) return null;
    const path = [goalEdge];
    let cur = goalPrev;
    while (cur !== -1) {
      path.push(cur);
      if (cur === startEdge) break;
      cur = prev[cur];
    }
    path.reverse();
    if (path[0] !== startEdge) return null;
    return { edges: path, cost: bestGoal };
  }
}
