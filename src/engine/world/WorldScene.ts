import Phaser from 'phaser';
import { engine } from '../core/Engine';
import { IsoScene, type At } from './IsoScene';
import { buildCity, type CityModel } from './CityBuilder';
import { GroundService } from './GroundService';
import { Streamer } from './Streaming';
import { VehicleSystem, type PlayerIntent, type ScreenSide } from '../vehicles/Vehicles';
import { Weather } from './Weather';
import { fxCable, fxChevron } from '../assets/gen/fx';
import { DIR_SCREEN, angleToDir8, isoToScreen, type Dir4, type Vec2 } from '../core/math';
import type { ExitChip } from '../ui/DriveUi';
import type { StaticObject } from './types';
import type { ChapterDef } from '../mission/types';
import type { LaneEdge } from './RoadNetwork';
import type { CharacterLook } from '../assets/gen/characters';
import type { VehicleLook } from '../assets/gen/vehicles';
import { canStand, findPath } from './Walk';
import { G } from './ground';

export interface CitySetup {
  mode: 'walk' | 'drive' | 'attract';
  /** `look`/`sprite`: aspecto propio en esta escena (ej. cargando un cartel). */
  player?: { at: At; facing?: Dir4; look?: CharacterLook; sprite?: string };
  /**
   * `look`: auto distinto del habitual del personaje (ej. la camioneta municipal).
   * `toward`: marcador del primer destino; el auto se estaciona del lado de la calle que ya mira hacia allá
   * (sin esto, el lado más cercano al marcador: a veces obliga a arrancar con una vuelta en U).
   */
  car?: { at: string; parked?: boolean; look?: VehicleLook; toward?: string };
  /** Compañeros que aparecen a pie (ej. el hijo siguiendo al jugador). */
  companions?: { id: string; at?: At; follow?: boolean }[];
  /** Pasajeros que viajan dentro del auto. */
  passengers?: string[];
  traffic?: boolean;
  bounds?: [number, number, number, number];
  boundsMsg?: string;
}

const groundServices = new Map<string, GroundService>();

/** Escena de ciudad: mapa por chunks, caminata, conducción, tránsito, GPS y clima. */
export class WorldScene extends IsoScene {
  model!: CityModel;
  chapter!: ChapterDef;
  vehicles!: VehicleSystem;
  weather!: Weather;
  mode: 'walk' | 'drive' | 'attract' = 'walk';
  passengers: string[] = [];
  destination: {
    marker: string;
    x: number;
    y: number;
    edge: LaneEdge;
    d: number;
    alts: { edge: LaneEdge; d: number; px: number; py: number; angle: number }[];
  } | null = null;
  private route: number[] | null = null;
  private uturnFirst = false;
  private chevrons: Phaser.GameObjects.Image[] = [];
  private chevronRef!: { texture: string; frames: (string | number)[] };
  private guideT = 0;
  private hudT = 0;
  private lightT = 0;
  private lastStreet = '';
  private pedT = 0;
  private attractT = 0;
  private autopilot = false;
  private peds: string[] = [];
  private pedCounter = 0;
  /** Aspecto del jugador cuando baja del auto (si un guion lo cambió, ej. lleva un cartel). */
  playerLook: CharacterLook | null = null;
  private chipT = 0;
  private lastIntent: PlayerIntent = { move: { x: 0, y: 0 }, pedal: 0, followRoute: false, autopilot: false };
  /** Giros del GPS que el jugador se pasó (para ofrecer la conducción asistida). */
  private missedTurns = 0;
  private assistOffered = false;
  arrivedHandler: ((marker: string) => void) | null = null;

  constructor() {
    super('world');
  }

  init(data: { chapter: ChapterDef }): void {
    this.chapter = data.chapter;
  }

  preload(): void {
    // assets finales declarados en el manifiesto para esta escena (carga por escena)
    engine.assets.queueFinals(this.load, 'world');
  }

  create(): void {
    const src = this.chapter.city;
    const plan = typeof src === 'function' ? src(engine.character?.id ?? this.chapter.characters[0]) : src;
    let model = engine.cityCache.get(plan.id);
    if (!model) {
      model = buildCity(plan);
      engine.cityCache.set(plan.id, model);
    }
    this.model = model;
    for (const I of model.roads.inters) I.occupants.clear();
    let svc = groundServices.get(plan.id);
    if (!svc) {
      svc = new GroundService(model.ground);
      groundServices.set(plan.id, svc);
    }
    this.setupGrid(
      {
        w: model.w,
        h: model.h,
        walkGrid: model.walkGrid,
        solidGrid: model.solidGrid,
        groundTypes: model.ground.ground,
        markers: model.markers,
        zones: model.zones,
        statics: model.statics,
        captions: model.captions,
      },
      model.w,
      model.h,
    );
    const cableStatics: StaticObject[] = model.cables.map((c) => {
      const a = isoToScreen(c.ax, c.ay, c.z);
      const b = isoToScreen(c.bx, c.by, c.z);
      const dx = Math.round(b.x - a.x);
      const dy = Math.round(b.y - a.y);
      return {
        kind: 'cable',
        texKey: `cable:${dx}:${dy}`,
        gen: () => {
          const out = fxCable(dx, dy, 4);
          return { ...out, anchorY: out.anchorY + c.z };
        },
        x: c.ax,
        y: c.ay,
        solid: false,
        bias: (c.bx - c.ax + (c.by - c.ay)) / 2 + 0.35,
      };
    });
    this.streamer = new Streamer(this, model.ground, svc, engine.assets, [...model.statics, ...cableStatics]);
    this.streamer.margin = engine.device.budget.chunkMargin;
    this.vehicles = new VehicleSystem(this, model.roads, engine.assets, this.chapter.traffic);
    this.vehicles.maxTraffic = engine.device.budget.trafficCars;
    this.vehicles.extraObstacles = () => this.roadObstacles();
    this.vehicles.onPlayerEdge = (e) => this.onPlayerEdge(e);
    this.vehicles.onParked = () => this.onParked();
    this.vehicles.onStuckAtJunction = () => {
      if (this.mode === 'drive') engine.ui.hud.toast(engine.device.touch ? 'Acá no se sigue derecho: tocá ◀ o ▶' : 'Acá no se sigue derecho: ← o → para doblar');
    };
    engine.ui.drive.onPick = (id) => this.pickExit(id);
    this.weather = new Weather(this, ['snow', 'anOrange', 'snow']);
    const cr = engine.assets.ensure('fx.chevron', () => fxChevron());
    this.chevronRef = { texture: cr.texture, frames: cr.frames };
    engine.assets.flush();
    engine.device.onChange = () => {
      this.vehicles.maxTraffic = engine.device.budget.trafficCars;
      this.streamer.margin = engine.device.budget.chunkMargin;
    };
    this.events.once('shutdown', () => this.shutdownWorld());
    this.sceneReady = true;
    engine.events.emit('scene:ready', this);
  }

  private shutdownWorld(): void {
    engine.input.setMode('walk');
    engine.ui.drive.show(false);
    engine.audio.setEngine(false);
    engine.radio.setActive(false);
    this.vehicles?.destroy();
    this.weather?.destroy();
    for (const c of this.chevrons) c.destroy();
    this.chevrons = [];
    engine.ui.hud.turn(null);
    engine.ui.hud.signal(null);
    engine.ui.hud.target(null);
    engine.ui.hud.horn(false);
    engine.ui.hud.radio(false, false);
    engine.ui.bubbles.removeMarker('dest');
    this.cleanupIso();
    this.destination = null;
    this.route = null;
    this.peds = [];
  }

  // ------------------------------------------------------------ preparación

  applySetup(s: CitySetup): void {
    this.mode = s.mode;
    this.vehicles.trafficEnabled = s.traffic ?? true;
    this.walkBounds = s.bounds ? { rect: s.bounds, msg: s.boundsMsg } : null;
    const ch = engine.character!;
    this.carLook = s.car?.look ?? null;
    if (s.car) this.placeCar(s.car.at, s.car.parked ?? true, s.car.toward);
    if (s.player && s.mode !== 'attract') {
      const look = s.player.look ?? ch.look;
      const sprite = s.player.look ? s.player.sprite : ch.sprite;
      this.player = this.spawn('player', look, s.player.at, { facing: s.player.facing, name: ch.name, voice: ch.voice, sprite });
      this.player.speed = 2.15;
    }
    for (const c of s.companions ?? []) {
      const npc = this.npcDef(c.id) ?? null;
      if (!npc) continue;
      const at = c.at ?? (this.player ? { x: this.player.x - 0.6, y: this.player.y + 0.4 } : [0, 0]);
      const k = this.spawn(c.id, npc.look, at, { name: npc.name, voice: npc.voice, sprite: npc.sprite });
      k.speed = 2.4;
      if (c.follow && this.player) this.follow(c.id, 'player', 1.0);
    }
    this.passengers = s.passengers ?? [];
    if (s.mode === 'drive') {
      if (!this.vehicles.player) throw new Error('[World] modo manejo sin auto');
      this.beginDriving(false);
    } else if (s.mode === 'walk') {
      this.camFollow = { kind: 'char', id: 'player' };
      engine.ui.hud.horn(false);
      engine.input.setMode('walk');
      engine.ui.drive.show(false);
    } else {
      this.camFollow = { kind: 'fn', fn: () => this.attractPoint() };
    }
    this.snapCamera();
  }

  /** Auto del jugador de esta escena (si el capítulo lo cambia respecto del habitual). */
  private carLook: VehicleLook | null = null;

  placeCar(marker: string, parked = true, toward?: string): void {
    const p = this.point(marker);
    const roads = this.model.roads;
    const goal = toward ? this.point(toward) : null;
    const spot = (goal && roads.parkingSpotToward([p.x, p.y], [goal.x, goal.y])) || roads.parkingSpot(p.x, p.y);
    if (!spot) throw new Error(`[World] no hay lugar de estacionamiento cerca de ${marker}`);
    this.vehicles.removePlayerCar();
    this.vehicles.createPlayerCar(this.carLook ?? engine.character!.car, spot, parked);
    this.setInteract('car', null);
  }

  /** Punto de vereda junto a la puerta del auto estacionado. */
  carDoor(): Vec2 {
    const v = this.vehicles.player!;
    const nx = -Math.sin(v.angle);
    const ny = Math.cos(v.angle);
    for (const k of [0.95, 0.8, 1.15, 0.65]) {
      const x = v.x + nx * k - Math.cos(v.angle) * 0.1;
      const y = v.y + ny * k - Math.sin(v.angle) * 0.1;
      if (canStand(this.grid, x, y, 0.18)) return { x, y };
    }
    return { x: v.x + nx * 0.95, y: v.y + ny * 0.95 };
  }

  enableCarInteract(label = 'Subir al auto'): void {
    this.setInteract('car', { label, icon: '🚗', radius: 1.6 }, this.carDoor());
  }

  private beginDriving(fromWalk: boolean): void {
    this.mode = 'drive';
    this.lastArrived = null;
    this.vehicles.startDriving();
    if (fromWalk) this.vehicles.player!.lateralTarget = 0;
    this.camFollow = { kind: 'fn', fn: () => this.carCamPoint() };
    engine.input.setMode('drive');
    engine.ui.drive.show(true);
    engine.ui.hud.horn(true);
    engine.audio.setEngine(true, 0, 0);
    this.clearInteractHud();
    this.setInteract('car', null);
  }

  async enterCar(passengers: string[] = []): Promise<void> {
    const v = this.vehicles.player;
    if (!v || !this.player) return;
    engine.audio.sfx('door_open');
    await engine.scheduler.wait(220);
    for (const id of passengers) this.chars.get(id)?.setVisible(false);
    this.player.setVisible(false);
    engine.audio.sfx('car_door');
    this.passengers = passengers;
    this.beginDriving(true);
  }

  async exitCar(passengers: string[] = this.passengers): Promise<void> {
    const v = this.vehicles.player;
    if (!v) return;
    engine.audio.setEngine(false);
    engine.radio.setActive(false);
    engine.ui.hud.radio(false, false);
    engine.ui.hud.horn(false);
    engine.ui.hud.turn(null);
    engine.ui.hud.signal(null);
    engine.input.setMode('walk');
    engine.ui.drive.show(false);
    engine.audio.sfx('door_open');
    await engine.scheduler.wait(200);
    const door = this.carDoor();
    const ch = engine.character!;
    if (!this.player) this.player = this.spawn('player', this.playerLook ?? ch.look, door, { name: ch.name, voice: ch.voice, sprite: this.playerLook ? undefined : ch.sprite });
    this.teleport('player', door);
    this.player.setVisible(true);
    this.player.speed = 2.15;
    passengers.forEach((id, i) => {
      let c = this.chars.get(id);
      const npc = this.npcDef(id);
      if (!c && npc) c = this.spawn(id, npc.look, door, { name: npc.name, voice: npc.voice, sprite: npc.sprite });
      if (!c) return;
      const off = { x: door.x - Math.cos(v.angle) * (0.55 + i * 0.4), y: door.y - Math.sin(v.angle) * (0.55 + i * 0.4) };
      this.teleport(id, canStand(this.grid, off.x, off.y, 0.18) ? off : door);
      c.setVisible(true);
    });
    engine.audio.sfx('car_door');
    this.passengers = [];
    this.mode = 'walk';
    this.camFollow = { kind: 'char', id: 'player' };
    this.vehicles.player!.mode = 'parked';
  }

  // ------------------------------------------------------------ GPS

  setDestination(marker: string | null): void {
    engine.ui.bubbles.removeMarker('dest');
    if (!marker) {
      this.destination = null;
      this.route = null;
      this.updateChevrons();
      return;
    }
    const p = this.point(marker);
    const spots = this.model.roads.parkingSpots(p.x, p.y);
    if (!spots.length) throw new Error(`[World] destino sin estacionamiento: ${marker}`);
    const spot = spots[0];
    this.destination = { marker, x: spot.px, y: spot.py, edge: spot.edge, d: spot.d, alts: spots };
    engine.ui.bubbles.marker('dest', this.anchorPoint([p.x, p.y], 26), '★');
    this.replan(false);
  }

  replan(announce: boolean): void {
    const d = this.destination;
    if (!d || !this.vehicles.player) return;
    // se puede estacionar de cualquiera de los dos lados: el GPS elige el más corto
    let best: { r: { edges: number[]; uturnFirst: boolean }; cost: number; spot: (typeof d.alts)[number] } | null = null;
    for (const s of d.alts) {
      const r = this.vehicles.planRoute({ edge: s.edge, d: s.d });
      if (!r) continue;
      let cost = 0;
      for (const id of r.edges) cost += this.model.roads.edges[id].length;
      if (r.uturnFirst) cost += 6;
      if (!best || cost < best.cost) best = { r, cost, spot: s };
    }
    if (best) {
      d.edge = best.spot.edge;
      d.d = best.spot.d;
      d.x = best.spot.px;
      d.y = best.spot.py;
    }
    const r = best?.r ?? null;
    this.route = r?.edges ?? null;
    this.uturnFirst = r?.uturnFirst ?? false;
    this.vehicles.player.route = this.route;
    this.vehicles.player.nextEdge = null;
    if (announce) engine.ui.hud.toast('GPS: recalculando…', 1800);
    this.updateChevrons();
  }

  blockIntersection(key: string, known: boolean): number[] {
    const ids = this.model.roads.blockIntersection(key, known);
    if (known) this.replan(true);
    return ids;
  }

  blockStreet(street: string, from: number, to: number, known: boolean): number[] {
    const ids = this.model.roads.blockStreet(street, from, to, known);
    if (known) this.replan(true);
    return ids;
  }

  /** El GPS "se entera" de bloqueos (ej. al ver el accidente). */
  learn(ids: number[]): void {
    this.model.roads.learn(ids);
    this.replan(true);
  }

  learnStreet(street: string, from: number, to: number): void {
    const ids: number[] = [];
    for (const e of this.model.roads.edges) {
      if (e.kind !== 'lane' || e.street?.id !== street) continue;
      const a = Math.min(e.span[0], e.span[1]);
      const b = Math.max(e.span[0], e.span[1]);
      if (b > Math.min(from, to) && a < Math.max(from, to) && this.model.roads.blocked.has(e.id)) ids.push(e.id);
    }
    this.learn(ids);
  }

  learnIntersection(key: string): void {
    const I = this.model.roads.intersectionByKey(key);
    if (!I) return;
    const ids = this.model.roads.edges.filter((e) => e.inter === I.id && this.model.roads.blocked.has(e.id)).map((e) => e.id);
    this.learn(ids);
  }

  setAutopilot(on: boolean): void {
    this.autopilot = on;
  }

  private onPlayerEdge(e: LaneEdge): void {
    if (this.route && this.route[0] === e.id) this.uturnFirst = false;
    if (e.street && e.street.name !== this.lastStreet) {
      this.lastStreet = e.street.name;
      engine.ui.hud.street(e.street.name);
      engine.events.emit('car:street', { street: e.street.id });
    }
    // ¿se salió de la ruta?
    if (this.route && !this.route.includes(e.id)) {
      this.replan(false);
      this.noteMissedTurn();
    }
  }

  /** Último destino donde el auto quedó estacionado (evita perder la llegada entre estados). */
  private lastArrived: string | null = null;

  private onParked(): void {
    engine.audio.sfx('brake', 0.4);
    const m = this.destination?.marker;
    if (m) {
      this.lastArrived = m;
      engine.events.emit(`car:arrived:${m}`, { marker: m });
      engine.events.emit('car:arrived', { marker: m });
      engine.ui.bubbles.removeMarker('dest');
    }
  }

  waitArrival(marker: string): Promise<unknown> {
    const v = this.vehicles.player;
    if (v && v.mode === 'parked' && this.lastArrived === marker) return Promise.resolve({ marker });
    return engine.events.waitFor(`car:arrived:${marker}`, undefined, engine.runToken ?? undefined);
  }

  private checkArrival(): void {
    const d = this.destination;
    const v = this.vehicles.player;
    if (!d || !v || v.mode !== 'drive' || v.stopAt || v.edge.kind !== 'lane') return;
    const dist = Math.hypot(v.x - d.x, v.y - d.y);
    if (dist > 5.5 || v.edge.street !== d.edge.street) return;
    const pr = this.model.roads.project(v.edge, d.x, d.y);
    if (pr.d > v.d + 0.8 && pr.d < v.edge.length - 0.4) {
      v.stopAt = { edge: v.edge.id, d: pr.d };
      engine.ui.hud.toast('Estacionando…', 1400);
    }
  }

  private updateChevrons(): void {
    const v = this.vehicles?.player;
    const want: { x: number; y: number; a: number }[] = [];
    if (this.route && v && this.mode === 'drive') {
      const idx = this.route.indexOf(v.edge.id);
      if (idx >= 0) {
        let d = v.d + 1.4;
        let i = idx;
        let placed = 0;
        const goal = this.destination;
        while (i < this.route.length && placed < 24) {
          const e = this.model.roads.edges[this.route[i]];
          const limit = i === this.route.length - 1 && goal ? Math.min(e.length, goal.d) : e.length;
          while (d < limit && placed < 24) {
            const p = this.model.roads.pointAt(e, d);
            want.push({ x: p.x, y: p.y, a: p.angle });
            placed++;
            d += 1.15;
          }
          d -= e.length;
          i++;
        }
      }
    }
    while (this.chevrons.length < want.length) {
      const img = this.add.image(0, 0, this.chevronRef.texture, this.chevronRef.frames[0]).setDepth(-9e6 + 5);
      this.chevrons.push(img);
    }
    this.chevrons.forEach((img, i) => {
      const w = want[i];
      if (!w) {
        img.setVisible(false);
        return;
      }
      const s = isoToScreen(w.x, w.y);
      img.setVisible(true);
      img.setPosition(Math.round(s.x), Math.round(s.y));
      img.setFrame(this.chevronRef.frames[angleToDir8(w.a)]);
      img.setData('i', i);
    });
  }

  // ------------------------------------------------------------ bucle

  protected beforeStep(dt: number): void {
    const cam = this.cameras.main;
    const cc = { x: cam.scrollX + cam.width / 2, y: cam.scrollY + cam.height / 2 };
    const a = (cc.x / 16 + cc.y / 8) / 2;
    const b = (cc.y / 8 - cc.x / 16) / 2;
    const viewTiles = Math.max(cam.width, cam.height) / 16;
    const drivingInput = this.mode === 'drive' && !engine.ui.dialogue.active;
    const auto = this.autopilot || (engine.debug.autoplay && !!this.destination);
    const intent: PlayerIntent = {
      move: drivingInput ? engine.input.move : { x: 0, y: 0 },
      pedal: drivingInput ? engine.input.pedal : 0,
      followRoute: engine.save.settings.assistedDriving || auto,
      autopilot: auto && this.mode === 'drive',
    };
    this.lastIntent = intent;
    const req = engine.input.consumeTurn();
    if (req && drivingInput) this.requestTurn(req);
    // el autopiloto (asistido/QA) también ejecuta el giro en U que pide el GPS
    const pv = this.vehicles.player;
    if (auto && this.mode === 'drive' && pv && this.uturnFirst && this.route && pv.mode === 'drive' && pv.edge.kind === 'lane' && pv.edge.opposite === this.route[0]) {
      if (this.vehicles.uturn(pv)) this.uturnFirst = false;
    }
    this.vehicles.update(dt, intent, { x: a, y: b }, viewTiles);
    if (this.mode === 'drive') {
      const v = this.vehicles.player!;
      if (engine.input.consumeHorn()) {
        engine.audio.sfx('horn');
        engine.events.emit('player:horn');
      }
      engine.input.consumeAction();
      engine.input.consumeTap();
      const thr = intent.autopilot ? 0.7 : Math.min(1, Math.hypot(intent.move.x, intent.move.y));
      engine.audio.setEngine(true, v.speed / v.maxSpeed, v.speed > 0.05 ? thr : 0);
      this.checkArrival();
      this.checkZones(v.x, v.y);
      // compañeros viajan con el auto
      for (const id of this.passengers) {
        const c = this.chars.get(id);
        if (c) {
          c.x = v.x;
          c.y = v.y;
        }
      }
      if (this.player) {
        this.player.x = v.x;
        this.player.y = v.y;
      }
    }
    this.stepPeds(dt);
    this.weather.update(dt);
  }

  protected captionFocus(): Vec2 | null {
    if (this.mode === 'drive' && this.vehicles.player) return { x: this.vehicles.player.x, y: this.vehicles.player.y };
    return this.mode === 'attract' ? null : super.captionFocus();
  }

  protected captionRadius(): number {
    return this.mode === 'drive' ? 9 : 6.5;
  }

  protected walkingEnabled(): boolean {
    return this.mode === 'walk' && super.walkingEnabled();
  }

  protected afterStep(dt: number): void {
    this.chipT -= dt;
    if (this.chipT <= 0) {
      this.chipT = 0.1;
      this.updateExitChips();
    }
    this.guideT -= dt;
    if (this.guideT <= 0) {
      this.guideT = 0.25;
      this.updateChevrons();
    }
    // pulso de las flechas
    const t = performance.now() / 1000;
    for (const img of this.chevrons) if (img.visible) img.setAlpha(0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * 5 - (img.getData('i') as number) * 0.7)));
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.15;
      this.updateDriveHud();
    }
    this.lightT -= dt;
    if (this.lightT <= 0) {
      this.lightT = 0.25;
      this.updateLights();
    }
    if (this.mode === 'attract') this.attractT += dt;
  }

  private updateLights(): void {
    const blink = Math.floor(performance.now() / 600) % 2 === 0;
    for (const l of this.model.lights) {
      const I = this.model.roads.inters[l.inter];
      const st = this.model.roads.lightFor(I, l.axis);
      const f = st === 'red' ? 1 : st === 'yellow' ? 2 : st === 'green' ? 3 : st === 'blink' ? (blink ? 2 : 0) : 0;
      this.streamer.setFrame(l.obj, f);
    }
  }

  private updateDriveHud(): void {
    const hud = engine.ui.hud;
    const v = this.vehicles.player;
    if (this.mode !== 'drive' || !v) {
      hud.turn(null);
      hud.signal(null);
      this.updateTargetArrow(null);
      return;
    }
    // semáforo por delante
    let sig: 'red' | 'yellow' | 'green' | 'blink' | null = null;
    if (v.edge.kind === 'lane' && v.edge.inter >= 0 && v.edge.street && v.edge.length - v.d < 7) {
      sig = this.model.roads.lightFor(this.model.roads.inters[v.edge.inter], v.edge.street.axis);
    }
    hud.signal(sig);
    // próxima maniobra (el texto dice qué botón tocar; ◀ ▶ son lados de la pantalla)
    if (this.route && this.destination) {
      const touch = engine.device.touch;
      const btn = (side: ScreenSide) => (side === 'left' ? (touch ? '◀' : '◀ / ←') : touch ? '▶' : '▶ / →');
      const assisted = this.lastIntent.followRoute;
      if (this.uturnFirst && this.route[0] !== v.edge.id && v.edge.kind === 'lane' && !this.route.includes(v.edge.id)) {
        hud.turn(
          this.screenDeg(v.edge.dir === 'E' ? 'W' : v.edge.dir === 'W' ? 'E' : v.edge.dir === 'N' ? 'S' : 'N'),
          touch ? 'GPS: pegá la vuelta · frená y mantené ▼' : 'GPS: pegá la vuelta · frená y mantené ▼ / ↓',
          'gps',
        );
      } else {
        const roads = this.model.roads;
        const idx = this.route.indexOf(v.edge.id);
        let dist = v.edge.length - v.d;
        let text = 'Seguí derecho';
        let state: '' | 'gps' | 'ok' = '';
        let deg = this.screenDeg(v.edge.dir);
        for (let i = idx + 1; i < this.route.length && idx >= 0; i++) {
          const e = roads.edges[this.route[i]];
          if (e.kind === 'turn' && e.turn !== 'straight') {
            const m = Math.max(10, Math.round((dist * 4) / 10) * 10);
            const street = roads.edges[e.target].street?.name ?? 'la próxima';
            deg = this.screenDeg(e.dir);
            if (e.turn === 'uturn') {
              text = `GPS: en ${m} m, pegá la vuelta`;
              state = 'gps';
            } else if (this.vehicles.plannedExit(v, roads.edges[e.source], this.lastIntent) === e.id) {
              text = `Doblás por ${street} · ${m} m`;
              state = 'ok';
            } else if (assisted) {
              text = `GPS: dobla solo por ${street} · ${m} m`;
              state = 'ok';
            } else {
              text = `GPS: en ${m} m doblá por ${street} · tocá ${btn(this.vehicles.sideOf(e))}`;
              state = 'gps';
            }
            break;
          }
          dist += e.length;
          if (dist > 30) break;
        }
        const goalDist = Math.hypot(v.x - this.destination.x, v.y - this.destination.y);
        if (goalDist < 6) {
          text = 'Llegando: estaciona solo';
          state = 'ok';
          deg = this.screenDeg(v.edge.dir);
        }
        hud.turn(deg, text, state);
      }
      this.updateTargetArrow({ x: this.destination.x, y: this.destination.y });
    } else {
      hud.turn(null);
      this.updateTargetArrow(null);
    }
  }

  // ------------------------------------------------------------ elegir la calle en la esquina

  private requestTurn(side: ScreenSide): void {
    const v = this.vehicles.player;
    if (!v || this.mode !== 'drive') return;
    const r = this.vehicles.requestTurn(v, side);
    if (r === 'none') engine.ui.hud.toast(`${side === 'left' ? '◀' : '▶'} En esta esquina no se puede doblar para ese lado`, 1700);
    else if (r === 'blocked') engine.ui.hud.toast('Esa calle está cortada', 1600);
    else if (r === 'cancel') engine.ui.hud.toast('Seguís derecho', 1000);
    this.chipT = 0;
  }

  private pickExit(id: number): void {
    const v = this.vehicles.player;
    if (!v || this.mode !== 'drive') return;
    if (this.vehicles.pickExit(v, id) === 'blocked') engine.ui.hud.toast('Esa calle está cortada', 1600);
    this.chipT = 0;
  }

  /** Salida que indica el GPS al final de un carril (si la ruta pasa por él). */
  private gpsExitAfter(laneId: number): number | null {
    if (!this.route) return null;
    const i = this.route.indexOf(laneId);
    return i >= 0 && i + 1 < this.route.length ? this.route[i + 1] : null;
  }

  /** Flechas en la esquina que viene: por dónde va el auto, qué sugiere el GPS y qué está cortado. */
  private updateExitChips(): void {
    const drive = engine.ui.drive;
    const v = this.vehicles?.player;
    const clear = () => {
      drive.setChips([]);
      drive.hint(null);
    };
    if (this.mode !== 'drive' || !v || v.mode !== 'drive' || engine.ui.dialogue.active || v.stopAt) return clear();
    const roads = this.model.roads;
    const lane = this.vehicles.upcomingLane(v);
    const dist = lane === v.edge ? lane.length - v.d : v.edge.length - v.d + lane.length;
    if ((lane.inter < 0 && !lane.deadEnd) || dist > 9) return clear();
    const planned = this.vehicles.plannedExit(v, lane, this.lastIntent);
    const gps = this.gpsExitAfter(lane.id);
    const exits = this.vehicles.exitsOf(lane);
    const chips: ExitChip[] = exits.map((x) => {
      const tgt = roads.edges[x.edge.target];
      const p = roads.pointAt(tgt, Math.min(1.4, tgt.length * 0.5));
      return {
        id: x.edge.id,
        name: x.turn === 'uturn' ? 'Pegar la vuelta' : (tgt.street?.name ?? ''),
        deg: this.screenDeg(x.edge.dir),
        side: x.side,
        chosen: planned === x.edge.id,
        gps: gps === x.edge.id,
        blocked: x.known,
        anchor: () => {
          const s = isoToScreen(p.x, p.y, 4);
          return this.cssIfVisible(s.x, s.y);
        },
      };
    });
    drive.setChips(chips);
    // botones: el lado elegido queda encendido; el que sugiere el GPS, titila
    const sideOfId = (id: number | null): ScreenSide | null => {
      const x = exits.find((e) => e.edge.id === id);
      return x && x.side !== 'straight' ? x.side : null;
    };
    drive.hint(this.lastIntent.followRoute ? null : sideOfId(gps), sideOfId(planned));
  }

  /** Si el jugador se pasa dos giros del GPS, se le ofrece (una vez) que el auto doble solo. */
  private noteMissedTurn(): void {
    if (this.assistOffered || engine.save.settings.assistedDriving || engine.debug.autoplay) return;
    this.missedTurns++;
    if (this.missedTurns < 2) return;
    this.assistOffered = true;
    engine.ui.hud.offer('¿Querés que el auto doble solo siguiendo al GPS? Vos sólo acelerás y frenás. (Se cambia en Pausa.)', 'Sí, que doble solo', () =>
      engine.save.setSetting('assistedDriving', true),
    );
  }

  private screenDeg(d: Dir4): number {
    const s = DIR_SCREEN[d];
    return (Math.atan2(s.y, s.x) * 180) / Math.PI;
  }

  private updateTargetArrow(p: Vec2 | null): void {
    if (!p) {
      engine.ui.hud.target(null);
      return;
    }
    const s = isoToScreen(p.x, p.y);
    const cam = this.cameras.main;
    const css = engine.toCss(cam, s.x, s.y);
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (css.x > 30 && css.y > 90 && css.x < W - 30 && css.y < H - 40) {
      engine.ui.hud.target(null);
      return;
    }
    const cx = W / 2;
    const cy = H / 2;
    const ang = Math.atan2(css.y - cy, css.x - cx);
    const rx = W / 2 - 34;
    const ry = H / 2 - 70;
    const k = Math.min(rx / Math.abs(Math.cos(ang) || 1e-6), ry / Math.abs(Math.sin(ang) || 1e-6));
    engine.ui.hud.target({ x: cx + Math.cos(ang) * k, y: cy + Math.sin(ang) * k, angle: ang });
  }

  private carCamPoint(): Vec2 {
    const v = this.vehicles.player!;
    const s = isoToScreen(v.x, v.y);
    const lead = Math.min(1, v.speed / v.maxSpeed) * 42;
    const d = DIR_SCREEN[v.edge.dir];
    const p = { x: s.x + d.x * lead, y: s.y + d.y * lead - 8 };
    // al acercarse a una esquina, la cámara mira un poco hacia el cruce: se ven sus salidas
    if (this.mode === 'drive' && v.mode === 'drive') {
      const lane = this.vehicles.upcomingLane(v);
      const I = lane.inter >= 0 ? this.model.roads.inters[lane.inter] : null;
      if (I) {
        const dist = lane === v.edge ? lane.length - v.d : v.edge.length - v.d + lane.length;
        const k = dist < 9 ? 0.45 * (1 - Math.max(0, dist - 3) / 6) : 0;
        if (k > 0) {
          const c = isoToScreen((I.x0 + I.x1) / 2, (I.y0 + I.y1) / 2);
          p.x += (c.x - p.x) * k;
          p.y += (c.y - 8 - p.y) * k;
        }
      }
    }
    return p;
  }

  private attractPoint(): Vec2 {
    const a = this.model.markers.get('attract_a')?.at ?? [this.model.w / 2 - 8, this.model.h / 2];
    const b = this.model.markers.get('attract_b')?.at ?? [this.model.w / 2 + 8, this.model.h / 2];
    const k = 0.5 - 0.5 * Math.cos(this.attractT * 0.05);
    return isoToScreen(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k);
  }

  protected anchorFallback(id: string): Vec2 | null {
    if ((id === 'player' || this.passengers.includes(id)) && this.mode === 'drive' && this.vehicles.player) {
      const v = this.vehicles.player;
      const s = isoToScreen(v.x, v.y, 18);
      return this.cssIfVisible(s.x, s.y);
    }
    return null;
  }

  carAnchor(): () => Vec2 | null {
    return () => {
      const v = this.vehicles.player;
      if (!v) return null;
      const s = isoToScreen(v.x, v.y, 18);
      return this.cssIfVisible(s.x, s.y);
    };
  }

  // ------------------------------------------------------------ peatones

  private roadObstacles(): { x: number; y: number; r: number }[] {
    const out: { x: number; y: number; r: number }[] = [];
    for (const c of this.chars.values()) {
      if (!c.visible) continue;
      const g = this.model.ground.ground[Math.floor(c.y) * this.model.w + Math.floor(c.x)];
      if (g === G.ROAD || g === G.PARKING || g === G.ROAD_DIRT) out.push({ x: c.x, y: c.y, r: 0.3 });
    }
    return out;
  }

  private stepPeds(dt: number): void {
    if (this.mode === 'attract' || !this.chapter.pedestrians.length) return;
    this.pedT -= dt;
    if (this.pedT > 0) return;
    this.pedT = 1.2;
    const cam = this.cameras.main;
    const cc = { x: cam.scrollX + cam.width / 2, y: cam.scrollY + cam.height / 2 };
    const ca = (cc.x / 16 + cc.y / 8) / 2;
    const cb = (cc.y / 8 - cc.x / 16) / 2;
    // despawn lejanos
    for (const id of [...this.peds]) {
      const c = this.chars.get(id);
      if (!c || Math.hypot(c.x - ca, c.y - cb) > 34) {
        this.despawn(id);
        this.peds = this.peds.filter((p) => p !== id);
      } else if (!c.path) {
        this.pedTarget(c.id);
      }
    }
    if (this.peds.length >= engine.device.budget.pedestrians) return;
    // aparecer en una vereda cercana (fuera de pantalla)
    for (let tries = 0; tries < 12; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 8;
      const x = Math.floor(ca + Math.cos(ang) * r) + 0.5;
      const y = Math.floor(cb + Math.sin(ang) * r) + 0.5;
      if (x < 1 || y < 1 || x >= this.model.w - 1 || y >= this.model.h - 1) continue;
      const g = this.model.ground.ground[Math.floor(y) * this.model.w + Math.floor(x)];
      if (g !== G.SIDEWALK && g !== G.PAVER && g !== G.SIDEWALK_DIRT) continue;
      if (!canStand(this.grid, x, y, 0.2)) continue;
      const look = this.chapter.pedestrians[Math.floor(Math.random() * this.chapter.pedestrians.length)];
      const id = `ped:${this.pedCounter++}`;
      const c = this.spawn(id, look, [x, y]);
      c.speed = 0.9 + Math.random() * 0.5;
      this.peds.push(id);
      this.pedTarget(id);
      break;
    }
  }

  private pedTarget(id: string): void {
    const c = this.chars.get(id);
    if (!c) return;
    for (let tries = 0; tries < 6; tries++) {
      const x = Math.floor(c.x + (Math.random() * 2 - 1) * 10) + 0.5;
      const y = Math.floor(c.y + (Math.random() * 2 - 1) * 10) + 0.5;
      if (x < 1 || y < 1 || x >= this.model.w - 1 || y >= this.model.h - 1) continue;
      const g = this.model.ground.ground[Math.floor(y) * this.model.w + Math.floor(x)];
      if (g !== G.SIDEWALK && g !== G.PAVER) continue;
      const path = findPath(this.grid, c.x, c.y, x, y, 0.2, 1500);
      if (path) {
        c.path = path;
        return;
      }
    }
  }

  clearPeds(): void {
    for (const id of this.peds) this.despawn(id);
    this.peds = [];
  }
}
