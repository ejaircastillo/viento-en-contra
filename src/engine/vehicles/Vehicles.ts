import type Phaser from 'phaser';
import {
  DIR_SCREEN,
  angleToDir8,
  depthOf,
  isoToScreen,
  opposite,
  resolveDesiredDir,
  type Dir4,
  type Vec2,
} from '../core/math';
import type { AssetRegistry, SpriteRef } from '../assets/AssetRegistry';
import { drawVehicleSheet, vehicleLength, type VehicleLook } from '../assets/gen/vehicles';
import { vehicleKey } from '../world/PropRegistry';
import type { LaneEdge, RoadNetwork } from '../world/RoadNetwork';

/**
 * Autos: el del jugador sigue su carril solo; el jugador acelera/frena y ELIGE LA SALIDA de la
 * próxima esquina antes de llegar (◀ ▶ / ← → según el lado de la pantalla, tocando la flecha de
 * la calle o arrastrando hacia ella). La elección queda marcada con el guiño y el auto dobla solo
 * al llegar; si se pide apenas entrado al cruce, todavía dobla. Tránsito ambiental con seguimiento
 * de vehículos, semáforos, cesión de paso y giros, estacionamiento automático al llegar al destino
 * y giro en U a mitad de cuadra. No es un simulador: el jugador nunca choca (frena solo).
 */

export type ScreenSide = 'left' | 'right';

export type VehicleMode = 'drive' | 'parked' | 'maneuver' | 'parking';

interface Maneuver {
  t: number;
  dur: number;
  fx: number;
  fy: number;
  fa: number;
  toEdge: LaneEdge;
  toD: number;
  kind: 'uturn';
}

export class Vehicle {
  x = 0;
  y = 0;
  angle = 0;
  speed = 0;
  maxSpeed = 3.3;
  accel = 2.6;
  brake = 7;
  d = 0;
  lateral = 0;
  lateralTarget = 0;
  braking = false;
  hazards = false;
  mode: VehicleMode = 'drive';
  nextEdge: number | null = null;
  route: number[] | null = null;
  stopAt: { edge: number; d: number } | null = null;
  /** Salida elegida por el jugador para la esquina al final de `signalLane`. */
  signalExit: number | null = null;
  signalLane = -1;
  /** Quién la eligió: teclas/botones/flecha ('key') o arrastre del joystick ('joy'). */
  signalSrc: 'key' | 'joy' | null = null;
  /** Guiño encendido (lado del conductor). */
  blinkSide: 'L' | 'R' | null = null;
  stuckT = 0;
  waitT = 0;
  inter = -1;
  halfLen: number;
  maneuver: Maneuver | null = null;
  oppositeHeld = 0;
  straightHeld = 0;
  /** Desfase visual que se disuelve (suaviza el cambio a un giro tardío). */
  blendX = 0;
  blendY = 0;
  readonly sprite: Phaser.GameObjects.Image;
  private frame = -1;
  private blinkers: Phaser.GameObjects.Rectangle[] = [];

  constructor(
    private scene: Phaser.Scene,
    readonly id: number,
    readonly look: VehicleLook,
    readonly ref: SpriteRef,
    public edge: LaneEdge,
    readonly isPlayer = false,
  ) {
    this.halfLen = vehicleLength(look.model) / 2;
    this.sprite = scene.add.image(0, 0, ref.texture, ref.frames[0]);
    this.sprite.setOrigin(ref.ax / ref.w, ref.ay / ref.h);
  }

  get heading(): Dir4 {
    return this.edge.dir;
  }

  sync(): void {
    const dir = angleToDir8(this.angle);
    const blink = this.hazards && Math.floor(performance.now() / 450) % 2 === 0;
    const f = dir + (this.braking || blink ? 8 : 0);
    if (f !== this.frame) {
      this.frame = f;
      this.sprite.setFrame(this.ref.frames[Math.min(f, this.ref.frames.length - 1)]);
    }
    const x = this.x + this.blendX;
    const y = this.y + this.blendY;
    const p = isoToScreen(x, y);
    this.sprite.setPosition(Math.round(p.x), Math.round(p.y));
    const depth = depthOf(this.x, this.y, 0);
    this.sprite.setDepth(depth);
    this.syncBlinkers(x, y, depth);
  }

  /** Guiño: dos luces ámbar (adelante y atrás) del lado del giro, titilando. */
  private syncBlinkers(x: number, y: number, depth: number): void {
    const on = !!this.blinkSide && Math.floor(performance.now() / 330) % 2 === 0;
    if (!this.blinkSide && !this.blinkers.length) return;
    if (!this.blinkers.length) {
      for (let i = 0; i < 2; i++) this.blinkers.push(this.scene.add.rectangle(0, 0, 2, 2, 0xffb21e).setOrigin(0.5, 0.5));
    }
    const fx = Math.cos(this.angle);
    const fy = Math.sin(this.angle);
    const s = this.blinkSide === 'R' ? 1 : -1;
    const rx = -fy * s * 0.28;
    const ry = fx * s * 0.28;
    const k = this.halfLen * 0.82;
    [1, -1].forEach((dir, i) => {
      const b = this.blinkers[i];
      b.setVisible(on);
      if (!on) return;
      const p = isoToScreen(x + fx * k * dir + rx, y + fy * k * dir + ry, 5);
      b.setPosition(Math.round(p.x), Math.round(p.y));
      b.setDepth(depth + 1);
    });
  }

  destroy(): void {
    this.sprite.destroy();
    for (const b of this.blinkers) b.destroy();
    this.blinkers = [];
  }
}

export interface PlayerIntent {
  /** Joystick (vector de pantalla): hacia dónde arrastra el dedo o el mouse. */
  move: Vec2;
  /** Pedal de teclas/botones: 1 acelerar, -1 frenar, 0 = manda el joystick. */
  pedal: number;
  /** Sigue la ruta sola en los cruces (conducción asistida / autopiloto). */
  followRoute: boolean;
  /** Autopiloto total (QA/demo): acelera sola. */
  autopilot: boolean;
}

/** Salida de la próxima esquina, para dibujar flechas y armar las indicaciones. */
export interface ExitInfo {
  edge: LaneEdge;
  turn: 'left' | 'right' | 'straight' | 'uturn';
  side: ScreenSide | 'straight';
  /** Cortada y el GPS lo sabe. */
  known: boolean;
}

export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

export class VehicleSystem {
  vehicles: Vehicle[] = [];
  player: Vehicle | null = null;
  trafficEnabled = true;
  maxTraffic = 10;
  extraObstacles: () => Obstacle[] = () => [];
  onPlayerEdge?: (e: LaneEdge) => void;
  onParked?: (v: Vehicle) => void;
  onStuckAtJunction?: (v: Vehicle) => void;
  private nextId = 1;
  private spawnT = 0;
  private stuckNotified = false;

  constructor(
    private scene: Phaser.Scene,
    readonly roads: RoadNetwork,
    private assets: AssetRegistry,
    private trafficPool: { look: VehicleLook; w: number }[],
  ) {}

  refFor(look: VehicleLook): SpriteRef {
    return this.assets.ensure(vehicleKey(look), () => drawVehicleSheet(look));
  }

  // ------------------------------------------------------------ jugador

  /** Crea el auto del jugador estacionado en un lugar (carril externo + desplazamiento lateral). */
  createPlayerCar(look: VehicleLook, spot: { edge: LaneEdge; d: number }, parked = true): Vehicle {
    const v = new Vehicle(this.scene, this.nextId++, look, this.refFor(look), spot.edge, true);
    v.d = spot.d;
    v.lateral = parked ? 1 : 0;
    v.lateralTarget = v.lateral;
    v.mode = parked ? 'parked' : 'drive';
    v.maxSpeed = 3.4;
    this.place(v);
    this.player = v;
    this.vehicles.push(v);
    return v;
  }

  removePlayerCar(): void {
    if (!this.player) return;
    this.release(this.player);
    this.player.destroy();
    this.vehicles = this.vehicles.filter((x) => x !== this.player);
    this.player = null;
  }

  startDriving(): void {
    const v = this.player;
    if (!v) return;
    v.mode = 'drive';
    v.lateralTarget = 0;
    v.route = null;
  }

  /** Ruta hacia un destino (GPS). Considera un giro en U inmediato como alternativa. */
  planRoute(goal: { edge: LaneEdge; d: number }): { edges: number[]; uturnFirst: boolean } | null {
    const v = this.player;
    if (!v) return null;
    const direct = this.roads.route(v.edge.id, v.d, goal.edge.id, goal.d, true);
    let best: { edges: number[]; uturnFirst: boolean; cost: number } | null = direct
      ? { edges: direct.edges, uturnFirst: false, cost: direct.cost }
      : null;
    if (v.edge.kind === 'lane' && v.edge.opposite >= 0 && v.mode !== 'maneuver') {
      const opp = this.roads.edges[v.edge.opposite];
      const od = Math.max(0, opp.length - v.d);
      const alt = this.roads.route(opp.id, od, goal.edge.id, goal.d, true, 6);
      if (alt && (!best || alt.cost < best.cost - 1)) best = { edges: alt.edges, uturnFirst: true, cost: alt.cost };
    }
    return best ? { edges: best.edges, uturnFirst: best.uturnFirst } : null;
  }

  /** Iniciar giro en U a mitad de cuadra. */
  uturn(v: Vehicle): boolean {
    if (v.edge.kind !== 'lane' || v.edge.opposite < 0) return false;
    const opp = this.roads.edges[v.edge.opposite];
    const toD = Math.max(0.2, Math.min(opp.length - 0.2, opp.length - v.d));
    this.release(v);
    v.maneuver = { t: 0, dur: 1.3, fx: v.x, fy: v.y, fa: v.angle, toEdge: opp, toD, kind: 'uturn' };
    v.mode = 'maneuver';
    v.speed = 0;
    return true;
  }

  private controlPlayer(v: Vehicle, dt: number, intent: PlayerIntent): number {
    const heading = v.edge.dir;
    let throttle = 0;
    if (intent.autopilot) throttle = 1;
    else if (intent.pedal !== 0) throttle = intent.pedal;
    else if (Math.hypot(intent.move.x, intent.move.y) > 0.3) {
      // joystick: arrastrar hacia adelante (o hacia una calle) avanza; hacia atrás frena
      const mag = Math.min(1, Math.hypot(intent.move.x, intent.move.y));
      const desired = resolveDesiredDir(intent.move, heading);
      if (desired === opposite(heading)) throttle = -1;
      else if (desired) {
        throttle = Math.max(0.45, mag);
        if (desired === heading) {
          v.straightHeld += dt;
          if (v.straightHeld > 0.35 && v.signalSrc === 'joy') this.clearSignal(v);
        } else {
          v.straightHeld = 0;
          // arrastrar hacia una calle lateral la elige (salvo que se haya elegido con botones)
          if (v.edge.kind === 'lane' && v.signalSrc !== 'key') {
            const ex = v.edge.next.map((n) => this.roads.edges[n]).find((e) => e.dir === desired && e.turn !== 'uturn');
            if (ex && v.signalExit !== ex.id) this.setSignal(v, v.edge, ex.id, 'joy');
          }
        }
      }
    }
    let target = 0;
    v.braking = false;
    if (throttle < 0) {
      v.braking = v.speed > 0.2;
      if (v.speed < 0.25) v.oppositeHeld += dt;
      if (v.oppositeHeld > 0.45) {
        v.oppositeHeld = 0;
        // en un cul-de-sac, tomar la curva en U; si no, giro en U a mitad de cuadra
        if (v.edge.deadEnd && v.edge.length - v.d < 1.2) {
          const u = v.edge.next.find((n) => this.roads.edges[n].turn === 'uturn');
          if (u !== undefined) {
            v.nextEdge = u;
            target = 1.2;
          }
        } else this.uturn(v);
      }
    } else {
      v.oppositeHeld = 0;
      target = v.maxSpeed * throttle;
    }
    if (v.edge.kind === 'turn') target = Math.min(target, v.maxSpeed * 0.62);
    if (v.edge.street && v.edge.street.lanes === 2) target *= 1.12;
    return target;
  }

  // ------------------------------------------------------------ elegir la salida de la esquina

  /** Lado de la PANTALLA hacia el que sale una calle (las dos laterales siempre quedan a lados opuestos). */
  sideOf(e: LaneEdge): ScreenSide {
    return DIR_SCREEN[e.dir].x < 0 ? 'left' : 'right';
  }

  /** Carril cuyo final es la próxima esquina del vehículo. */
  upcomingLane(v: Vehicle): LaneEdge {
    return v.edge.kind === 'lane' ? v.edge : this.roads.edges[v.edge.target];
  }

  /** Salidas de la esquina al final de un carril (sin la vuelta en U, salvo en un cul-de-sac). */
  exitsOf(lane: LaneEdge): ExitInfo[] {
    const all = lane.next.map((n) => this.roads.edges[n]);
    const list = lane.deadEnd ? all : all.filter((e) => e.turn !== 'uturn');
    return list.map((e) => ({
      edge: e,
      turn: e.turn ?? 'straight',
      side: e.turn === 'straight' ? 'straight' : this.sideOf(e),
      known: this.roads.isBlocked(e, true),
    }));
  }

  /** Salida que va a tomar el auto al final de `lane` con la elección y el modo actuales. */
  plannedExit(v: Vehicle, lane: LaneEdge, intent: PlayerIntent | null): number | null {
    const opts = lane.next.filter((n) => !this.roads.isBlocked(this.roads.edges[n]));
    if (!opts.length) return null;
    if (v.signalExit !== null && v.signalLane === lane.id && opts.includes(v.signalExit)) return v.signalExit;
    if (v.route && (intent?.followRoute || intent?.autopilot)) {
      const idx = v.route.indexOf(lane.id);
      const nx = idx >= 0 ? v.route[idx + 1] : undefined;
      if (nx !== undefined && opts.includes(nx)) return nx;
    }
    if (lane === v.edge && v.nextEdge !== null && opts.includes(v.nextEdge)) return v.nextEdge;
    const straight = opts.find((n) => this.roads.edges[n].turn === 'straight');
    return straight ?? null;
  }

  private setSignal(v: Vehicle, lane: LaneEdge, exit: number, src: 'key' | 'joy'): void {
    v.signalExit = exit;
    v.signalLane = lane.id;
    v.signalSrc = src;
  }

  clearSignal(v: Vehicle): void {
    v.signalExit = null;
    v.signalLane = -1;
    v.signalSrc = null;
  }

  /**
   * El jugador pide doblar hacia un lado de la pantalla (◀ ▶ / ← →). Vale para la próxima
   * esquina; apretar de nuevo el mismo lado lo cancela. Si el auto recién entró derecho al
   * cruce, todavía dobla (giro tardío).
   */
  requestTurn(v: Vehicle, side: ScreenSide): 'ok' | 'late' | 'cancel' | 'none' | 'blocked' {
    if (v.mode !== 'drive') return 'none';
    if (v.edge.kind === 'turn' && v.edge.turn === 'straight' && v.edge.source >= 0 && v.d < Math.min(1.1, v.edge.length * 0.5)) {
      const src = this.roads.edges[v.edge.source];
      const alt = src.next.map((n) => this.roads.edges[n]).find((e) => (e.turn === 'left' || e.turn === 'right') && this.sideOf(e) === side);
      if (alt && !this.roads.isBlocked(alt)) {
        this.switchEdge(v, alt);
        return 'late';
      }
    }
    const lane = this.upcomingLane(v);
    const ex = this.exitsOf(lane).find((x) => (x.turn === 'left' || x.turn === 'right') && x.side === side);
    if (!ex) return 'none';
    if (ex.known) return 'blocked';
    if (v.signalExit === ex.edge.id && v.signalLane === lane.id) {
      this.clearSignal(v);
      return 'cancel';
    }
    this.setSignal(v, lane, ex.edge.id, 'key');
    return 'ok';
  }

  /** Elegir una salida concreta (tocando su flecha). */
  pickExit(v: Vehicle, exitId: number): 'ok' | 'late' | 'blocked' | 'none' {
    if (v.mode !== 'drive') return 'none';
    const e = this.roads.edges[exitId];
    if (!e) return 'none';
    if (v.edge.kind === 'turn' && v.edge.source === e.source && v.edge.id !== e.id && v.d < Math.min(1.1, v.edge.length * 0.5) && !this.roads.isBlocked(e)) {
      this.switchEdge(v, e);
      return 'late';
    }
    const lane = this.upcomingLane(v);
    if (!lane.next.includes(exitId)) return 'none';
    if (this.roads.isBlocked(e, true)) return 'blocked';
    this.setSignal(v, lane, exitId, 'key');
    return 'ok';
  }

  /** Cambia a otra curva del mismo cruce sin salto visible. */
  private switchEdge(v: Vehicle, e: LaneEdge): void {
    const ox = v.x;
    const oy = v.y;
    const d = v.d;
    this.enterEdge(v, e);
    v.d = Math.min(d, e.length * 0.5);
    this.place(v);
    v.blendX = ox - v.x;
    v.blendY = oy - v.y;
    this.clearSignal(v);
  }

  /** Próxima arista que tomaría el vehículo. */
  private peekNext(v: Vehicle, intent: PlayerIntent | null): number | null {
    if (v.edge.kind === 'turn') return v.edge.target;
    if (v.isPlayer) return this.plannedExit(v, v.edge, intent);
    if (v.nextEdge !== null) return v.nextEdge;
    const opts = v.edge.next.filter((n) => !this.roads.isBlocked(this.roads.edges[n]));
    if (!opts.length) return null;
    // IA: elección ponderada (evitando calles que terminan en un corte)
    if (v.route) {
      const idx = v.route.indexOf(v.edge.id);
      const nx = idx >= 0 ? v.route[idx + 1] : undefined;
      if (nx !== undefined && opts.includes(nx)) return (v.nextEdge = nx);
    }
    const alive = opts.filter((n) => !this.roads.leadsNowhere(this.roads.edges[n]));
    if (alive.length) opts.splice(0, opts.length, ...alive);
    const weights = opts.map((n) => {
      const t = this.roads.edges[n].turn;
      return t === 'straight' ? 5 : t === 'right' ? 2.5 : t === 'left' ? 1.8 : 0.2;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < opts.length; i++) {
      r -= weights[i];
      if (r <= 0) return (v.nextEdge = opts[i]);
    }
    return (v.nextEdge = opts[0]);
  }

  // ------------------------------------------------------------ física

  private place(v: Vehicle): void {
    const p = this.roads.pointAt(v.edge, v.d);
    const nx = -Math.sin(p.angle);
    const ny = Math.cos(p.angle);
    v.x = p.x + nx * v.lateral;
    v.y = p.y + ny * v.lateral;
    v.angle = p.angle;
    v.sync();
  }

  private release(v: Vehicle): void {
    if (v.inter >= 0) {
      this.roads.inters[v.inter]?.occupants.delete(v.id);
      v.inter = -1;
    }
  }

  private enterEdge(v: Vehicle, e: LaneEdge): void {
    this.release(v);
    v.edge = e;
    v.nextEdge = null;
    if (e.kind === 'turn' && e.inter >= 0) {
      v.inter = e.inter;
      this.roads.inters[e.inter].occupants.add(v.id);
    }
    if (e.kind === 'lane' && v.isPlayer) {
      // la elección valía para la esquina anterior (salvo que ya se haya pedido para este carril)
      if (v.signalLane !== e.id) this.clearSignal(v);
      this.onPlayerEdge?.(e);
    }
  }

  /** Distancia libre por delante (baldosas). */
  private lookahead(v: Vehicle, next: number | null): number {
    const brake = v.brake;
    const maxLook = Math.max(2.4, (v.speed * v.speed) / (2 * brake) + 2.2);
    let best = maxLook;
    const toEnd = v.edge.length - v.d;
    if (next === null) best = Math.min(best, toEnd - 0.25);
    // semáforos y cesión (sólo IA)
    if (!v.isPlayer && v.edge.kind === 'lane' && v.edge.inter >= 0) {
      const I = this.roads.inters[v.edge.inter];
      const light = v.edge.street ? this.roads.lightFor(I, v.edge.street.axis) : null;
      if (light === 'red' || (light === 'yellow' && toEnd > 1.4)) best = Math.min(best, toEnd - 0.35);
      const others = [...I.occupants].some((id) => id !== v.id);
      if ((light === null || light === 'blink') && toEnd < 2.2) {
        if (others) best = Math.min(best, toEnd - 0.35);
        else if (v.waitT < 0.5 && light === 'blink') {
          if (toEnd < 0.8) v.waitT += 1 / 60;
          best = Math.min(best, toEnd - 0.35);
        }
      } else if (light === 'green' && others && toEnd < 1.2) {
        best = Math.min(best, toEnd - 0.35);
      }
    }
    // punto de detención (estacionar)
    if (v.stopAt) {
      if (v.stopAt.edge === v.edge.id && v.stopAt.d >= v.d - 0.05) best = Math.min(best, v.stopAt.d - v.d);
      else if (next !== null && v.stopAt.edge === next) best = Math.min(best, toEnd + v.stopAt.d);
    }
    // camino por delante: arista actual + siguiente
    const segs: { e: LaneEdge; from: number; base: number }[] = [{ e: v.edge, from: v.d, base: 0 }];
    if (next !== null) segs.push({ e: this.roads.edges[next], from: 0, base: toEnd });
    const check = (x: number, y: number, halfOther: number, latTh: number) => {
      if (Math.abs(x - v.x) > maxLook + 3 || Math.abs(y - v.y) > maxLook + 3) return;
      for (const s of segs) {
        const pr = this.roads.project(s.e, x, y);
        if (pr.lat > latTh) continue;
        const along = s.base + (pr.d - s.from);
        if (along <= 0.05 && s === segs[0]) continue;
        const gap = along - v.halfLen - halfOther;
        if (gap < best) best = gap;
        return;
      }
    };
    for (const o of this.vehicles) {
      if (o === v || o.mode === 'parked') continue;
      check(o.x, o.y, o.halfLen, 0.42);
    }
    for (const ob of this.extraObstacles()) check(ob.x, ob.y, ob.r, 0.5);
    return best;
  }

  update(dt: number, intent: PlayerIntent, camTile: Vec2, viewTiles: number): void {
    this.roads.update(dt);
    if (this.trafficEnabled) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 0.6;
        this.maintainTraffic(camTile, viewTiles);
      }
    }
    for (const v of [...this.vehicles]) this.step(v, dt, v.isPlayer ? intent : null);
  }

  private step(v: Vehicle, dt: number, intent: PlayerIntent | null): void {
    if (v.mode === 'parked') {
      v.braking = false;
      v.sync();
      return;
    }
    if (v.mode === 'maneuver' && v.maneuver) {
      const m = v.maneuver;
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      const e = k * k * (3 - 2 * k);
      const to = this.roads.pointAt(m.toEdge, m.toD);
      // arco hacia la izquierda
      const mx = (m.fx + to.x) / 2 - Math.cos(m.fa) * -0.6;
      const my = (m.fy + to.y) / 2 - Math.sin(m.fa) * -0.6;
      const a = 1 - e;
      v.x = a * a * m.fx + 2 * a * e * mx + e * e * to.x;
      v.y = a * a * m.fy + 2 * a * e * my + e * e * to.y;
      v.angle = m.fa - Math.PI * e;
      v.braking = false;
      if (k >= 1) {
        v.maneuver = null;
        v.mode = 'drive';
        this.enterEdge(v, m.toEdge);
        v.d = m.toD;
        v.lateral = 0;
        v.lateralTarget = 0;
        this.place(v);
        return;
      }
      v.sync();
      return;
    }

    let target: number;
    if (v.isPlayer && intent) {
      if (v.mode === 'parking') target = 0;
      else if (intent.autopilot || (v.stopAt && this.nearStop(v))) target = v.maxSpeed * (v.edge.kind === 'turn' ? 0.6 : 0.9);
      else target = this.controlPlayer(v, dt, intent);
    } else {
      target = v.maxSpeed * (v.edge.kind === 'turn' ? 0.55 : 1);
    }
    const next = this.peekNext(v, intent);
    if (v.isPlayer) {
      // aminorar antes de una esquina donde va a doblar (se ve y se entiende el giro)
      const ne = next !== null && v.edge.kind === 'lane' ? this.roads.edges[next] : null;
      const turning = ne && (ne.turn === 'left' || ne.turn === 'right');
      if (turning && v.edge.length - v.d < 2.4) target = Math.min(target, v.maxSpeed * 0.62);
      // guiño: la curva actual o la salida elegida para la esquina que viene
      const cur = v.edge.kind === 'turn' && (v.edge.turn === 'left' || v.edge.turn === 'right') ? v.edge.turn : null;
      const plan = turning && v.edge.length - v.d < 9 ? ne!.turn : null;
      const t = cur ?? plan;
      v.blinkSide = t === 'left' ? 'L' : t === 'right' ? 'R' : null;
      const decay = Math.exp(-dt * 9);
      v.blendX *= decay;
      v.blendY *= decay;
    }
    const gap = this.lookahead(v, next);
    const allowed = gap <= 0.05 ? 0 : Math.sqrt(2 * v.brake * 0.8 * Math.max(0, gap - 0.05));
    const want = Math.min(target, allowed);
    const prev = v.speed;
    if (want > v.speed) v.speed = Math.min(want, v.speed + v.accel * dt);
    else v.speed = Math.max(want, v.speed - v.brake * dt);
    if (v.speed < prev - 0.02 && prev > 0.3) v.braking = true;
    else if (!v.isPlayer) v.braking = v.speed < 0.05 && prev < 0.05;
    if (!v.isPlayer) {
      if (v.speed < 0.05) v.stuckT += dt;
      else v.stuckT = 0;
    }
    // lateral (salir / entrar a estacionar)
    if (v.lateral !== v.lateralTarget) {
      const rate = v.mode === 'parking' ? 1.1 : v.speed > 0.2 ? 0.9 : 0;
      const dl = rate * dt;
      v.lateral = v.lateral < v.lateralTarget ? Math.min(v.lateralTarget, v.lateral + dl) : Math.max(v.lateralTarget, v.lateral - dl);
    }
    v.d += v.speed * dt;
    // cambio de arista
    let guard = 0;
    while (v.d > v.edge.length && guard++ < 4) {
      const n = next !== null ? next : this.peekNext(v, intent);
      if (n === null) {
        v.d = v.edge.length;
        v.speed = 0;
        if (v.isPlayer && !this.stuckNotified) {
          this.stuckNotified = true;
          this.onStuckAtJunction?.(v);
        }
        break;
      }
      const over = v.d - v.edge.length;
      this.enterEdge(v, this.roads.edges[n]);
      v.d = over;
      this.stuckNotified = false;
      if (v.isPlayer && v.edge.kind === 'lane') v.nextEdge = null;
    }
    // llegada al punto de estacionamiento
    if (v.isPlayer && v.stopAt && v.mode === 'drive' && v.stopAt.edge === v.edge.id && Math.abs(v.stopAt.d - v.d) < 0.35 && v.speed < 0.35) {
      v.mode = 'parking';
      v.speed = 0;
      v.lateralTarget = 1;
    }
    if (v.isPlayer && v.mode === 'parking' && Math.abs(v.lateral - 1) < 0.01) {
      v.mode = 'parked';
      v.stopAt = null;
      this.onParked?.(v);
    }
    this.place(v);
  }

  private nearStop(v: Vehicle): boolean {
    if (!v.stopAt) return false;
    if (v.stopAt.edge === v.edge.id) return v.stopAt.d - v.d < 7 && v.stopAt.d >= v.d - 0.3;
    return false;
  }

  // ------------------------------------------------------------ tránsito ambiental

  private pickLook(): VehicleLook {
    const total = this.trafficPool.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    for (const p of this.trafficPool) {
      r -= p.w;
      if (r <= 0) return p.look;
    }
    return this.trafficPool[0].look;
  }

  private maintainTraffic(cam: Vec2, viewTiles: number): void {
    const ai = this.vehicles.filter((v) => !v.isPlayer);
    // despawn lejanos o trabados
    for (const v of ai) {
      const dist = Math.hypot(v.x - cam.x, v.y - cam.y);
      const offscreen = dist > viewTiles * 0.8;
      if (dist > viewTiles * 1.9 || (v.stuckT > 10 && offscreen) || v.stuckT > 25 || (v.edge.mapEdge && v.edge.length - v.d < 0.5 && offscreen)) {
        this.release(v);
        v.destroy();
        this.vehicles = this.vehicles.filter((x) => x !== v);
      }
    }
    const count = this.vehicles.filter((v) => !v.isPlayer).length;
    if (count >= this.maxTraffic || !this.trafficPool.length) return;
    // aparecer fuera de pantalla, en un anillo alrededor de la cámara
    const lanes = this.roads.edges.filter((e) => {
      if (e.kind !== 'lane' || e.length < 3 || this.roads.blocked.has(e.id) || this.roads.leadsNowhere(e)) return false;
      const mid = this.roads.pointAt(e, e.length / 2);
      const dist = Math.hypot(mid.x - cam.x, mid.y - cam.y);
      return dist > viewTiles * 0.85 && dist < viewTiles * 1.5;
    });
    if (!lanes.length) return;
    const e = lanes[Math.floor(Math.random() * lanes.length)];
    const d = 0.8 + Math.random() * (e.length - 1.6);
    const p = this.roads.pointAt(e, d);
    if (this.vehicles.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 3)) return;
    const look = this.pickLook();
    let ref: SpriteRef;
    try {
      ref = this.refFor(look);
    } catch (err) {
      console.warn('[Tránsito] no se pudo generar el vehículo', look, err);
      return;
    }
    const v = new Vehicle(this.scene, this.nextId++, look, ref, e, false);
    v.d = d;
    v.maxSpeed = 2.4 + Math.random() * 0.9;
    v.speed = v.maxSpeed * 0.8;
    this.place(v);
    this.vehicles.push(v);
  }

  clearTraffic(): void {
    for (const v of this.vehicles.filter((x) => !x.isPlayer)) {
      this.release(v);
      v.destroy();
    }
    this.vehicles = this.vehicles.filter((x) => x.isPlayer);
  }

  destroy(): void {
    for (const v of this.vehicles) v.destroy();
    this.vehicles = [];
    this.player = null;
  }
}
