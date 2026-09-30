import Phaser from 'phaser';
import { engine } from '../core/Engine';
import { Character, type InteractSpec } from '../entities/Character';
import { drawCharacterSheet, type CharacterLook } from '../assets/gen/characters';
import { damp, hashStr, isoToScreen, screenToIso, screenVecToWorld, type Dir4, type Vec2 } from '../core/math';
import type { SpriteRef } from '../assets/AssetRegistry';
import type { MarkerDef, SignCaption, StaticObject, ZoneDef } from './types';
import { C, toCss } from '../assets/Palette';
import type { NpcDef } from '../mission/types';
import { canStand, findPath, moveWithCollision, type WalkGrid } from './Walk';
import type { Streamer } from './Streaming';
import { CancelledError, type CancelToken } from '../core/Scheduler';

export type At = string | [number, number] | Vec2;

export interface IsoGrid extends WalkGrid {
  markers: Map<string, MarkerDef>;
  zones: Map<string, ZoneDef>;
  statics: StaticObject[];
  /** Rótulos de carteles para la lectura ampliada. */
  captions?: SignCaption[];
}

interface Interactable {
  at: () => Vec2 | null;
  radius: number;
  label: string;
  icon?: string;
  enabled: boolean;
}

/**
 * Base de las escenas isométricas (ciudad e interiores): personajes, caminata con colisión,
 * toque para moverse, interacción contextual, zonas, cámara y API para los guiones.
 */
export abstract class IsoScene extends Phaser.Scene {
  grid!: IsoGrid;
  streamer!: Streamer;
  chars = new Map<string, Character>();
  player: Character | null = null;
  control = true;
  walkBounds: { rect: [number, number, number, number]; msg?: string } | null = null;
  interactables = new Map<string, Interactable>();
  camFollow: { kind: 'char'; id: string } | { kind: 'point'; x: number; y: number } | { kind: 'fn'; fn: () => Vec2 } | null = null;
  sceneReady = false;
  staticsById = new Map<string, StaticObject>();
  protected nearest: string | null = null;
  protected zoneInside = new Map<string, boolean>();
  protected camX = 0;
  protected camY = 0;
  protected camInit = false;
  protected camLeadX = 0;
  protected camLeadY = 0;
  protected mapPx = new Phaser.Geom.Rectangle(0, 0, 100, 100);
  private boundsMsgT = 0;
  private stepSfxT = 0;
  private movedOnce = false;
  onPlayerMoved?: () => void;

  protected setupGrid(grid: IsoGrid, w: number, h: number): void {
    this.grid = grid;
    for (const s of grid.statics) if (s.id) this.staticsById.set(s.id, s);
    // caja de pantalla del rombo del mapa
    const left = isoToScreen(0, h).x;
    const right = isoToScreen(w, 0).x;
    const top = isoToScreen(0, 0).y - 80;
    const bottom = isoToScreen(w, h).y;
    this.mapPx.setTo(left, top, right - left, bottom - top);
    this.cameras.main.setRoundPixels(true);
  }

  // ------------------------------------------------------------ utilidades

  point(at: At): Vec2 {
    if (Array.isArray(at)) return { x: at[0], y: at[1] };
    if (typeof at === 'object') return at;
    const m = this.grid.markers.get(at);
    if (m) return { x: m.at[0], y: m.at[1] };
    const c = this.chars.get(at);
    if (c) return { x: c.x, y: c.y };
    const s = this.staticsById.get(at);
    if (s) return s.fp ? { x: s.x + s.fp[0] / 2, y: s.y + s.fp[1] / 2 } : { x: s.x, y: s.y };
    const z = this.grid.zones.get(at);
    if (z) return { x: (z.rect[0] + z.rect[2]) / 2, y: (z.rect[1] + z.rect[3]) / 2 };
    throw new Error(`[Escena] punto desconocido: ${at}`);
  }

  /** NPC del capítulo; admite variantes por personaje ("kid@municipal"). */
  npcDef(id: string): NpcDef | undefined {
    const ch = engine.chapter;
    const cid = engine.character?.id;
    return ch?.npcs[`${id}@${cid}`] ?? ch?.npcs[id];
  }

  markerDir(at: At): Dir4 | undefined {
    return typeof at === 'string' ? this.grid.markers.get(at)?.dir : undefined;
  }

  /**
   * Sprite de un personaje. Con `sprite` (clave del manifiesto) se usa el arte final si existe;
   * si no, se genera el placeholder a partir del `look`.
   */
  charRef(look: CharacterLook, sprite?: string): SpriteRef {
    const key = sprite ?? `char:${hashStr(JSON.stringify(look)).toString(36)}`;
    return engine.assets.ensure(key, () => drawCharacterSheet(look));
  }

  // ------------------------------------------------------------ personajes

  spawn(
    id: string,
    look: CharacterLook,
    at: At,
    opts: { facing?: Dir4; name?: string; voice?: number; interact?: InteractSpec; sprite?: string } = {},
  ): Character {
    this.despawn(id);
    const p = this.point(at);
    const c = new Character(this, id, this.charRef(look, opts.sprite), p.x, p.y, opts.name ?? '');
    c.facing = opts.facing ?? this.markerDir(at) ?? 'E';
    if (opts.voice) c.voice = opts.voice;
    if (opts.interact) this.setInteract(id, opts.interact);
    this.chars.set(id, c);
    c.sync(0);
    return c;
  }

  /** Cambia el aspecto de un personaje ya creado (ej. `holding: 'sign'`). */
  reskin(id: string, look: CharacterLook, sprite?: string): void {
    this.char(id).setRef(this.charRef(look, sprite));
  }

  despawn(id: string): void {
    const c = this.chars.get(id);
    if (c) {
      c.destroy();
      this.chars.delete(id);
      this.interactables.delete(id);
      engine.ui.bubbles.removeMarker(id);
    }
  }

  char(id: string): Character {
    const c = this.chars.get(id);
    if (!c) throw new Error(`[Escena] personaje inexistente: ${id}`);
    return c;
  }

  teleport(id: string, at: At, facing?: Dir4): void {
    const c = this.char(id);
    const p = this.point(at);
    c.x = p.x;
    c.y = p.y;
    c.path = null;
    if (facing) c.facing = facing;
    c.trail = [];
    c.sync(0);
  }

  face(id: string, target: At | Dir4): void {
    const c = this.char(id);
    if (typeof target === 'string' && ['E', 'S', 'W', 'N'].includes(target)) c.facing = target as Dir4;
    else {
      const p = this.point(target);
      c.faceTowards(p.x, p.y);
    }
    c.sync(0);
  }

  walkTo(id: string, at: At, opts: { speed?: number; token?: CancelToken; direct?: boolean } = {}): Promise<void> {
    const c = this.char(id);
    const p = this.point(at);
    const path = opts.direct ? [p] : findPath(this.grid, c.x, c.y, p.x, p.y, c.radius) ?? [p];
    if (opts.speed) c.speed = opts.speed;
    c.pathDone?.();
    c.path = path;
    const token = opts.token ?? engine.runToken ?? undefined;
    return new Promise<void>((resolve, reject) => {
      const off = token?.onCancel(() => {
        c.path = null;
        reject(new CancelledError());
      });
      c.pathDone = () => {
        off?.();
        c.pathDone = null;
        resolve();
      };
    });
  }

  follow(id: string, targetId: string | null, dist = 1.1): void {
    const c = this.char(id);
    c.follow = targetId ? { target: this.char(targetId), dist } : null;
  }

  wander(id: string, radius = 1.5): void {
    const c = this.char(id);
    c.wander = { home: { x: c.x, y: c.y }, radius, next: Math.random() * 3 };
  }

  setInteract(id: string, spec: InteractSpec | null, atOverride?: At): void {
    if (!spec) {
      this.interactables.delete(id);
      return;
    }
    const at = atOverride ?? id;
    this.interactables.set(id, {
      at: () => {
        if (!atOverride) {
          const c = this.chars.get(id);
          if (c) return c.visible ? { x: c.x, y: c.y } : null;
        }
        try {
          return this.point(at);
        } catch {
          return null;
        }
      },
      radius: spec.radius ?? 1.3,
      label: spec.label,
      icon: spec.icon,
      enabled: true,
    });
  }

  setStaticHidden(id: string, hidden: boolean): void {
    const s = this.staticsById.get(id);
    if (s) this.streamer.setHidden(s, hidden);
  }

  setStaticFrame(id: string, frame: number): void {
    const s = this.staticsById.get(id);
    if (s) this.streamer.setFrame(s, frame);
  }

  /** Ancla para globos de UI: cabeza del personaje en px CSS (o null si no se ve). */
  anchorOf(id: string): () => Vec2 | null {
    return () => {
      const c = this.chars.get(id);
      if (!c || !c.visible || !this.sys.isActive()) return this.anchorFallback(id);
      const h = c.headScreen();
      return this.cssIfVisible(h.x, h.y);
    };
  }

  /** Para subclases (ej. el auto del jugador cuando está manejando). */
  protected anchorFallback(_id: string): Vec2 | null {
    return null;
  }

  cssIfVisible(sx: number, sy: number): Vec2 | null {
    const cam = this.cameras.main;
    const p = engine.toCss(cam, sx, sy);
    if (p.x < -40 || p.y < -40 || p.x > window.innerWidth + 40 || p.y > window.innerHeight + 60) return null;
    return p;
  }

  anchorPoint(at: At, z = 20): () => Vec2 | null {
    return () => {
      const p = this.point(at);
      const s = isoToScreen(p.x, p.y, z);
      return this.cssIfVisible(s.x, s.y);
    };
  }

  // ------------------------------------------------------------ autoplay (QA)

  /** Objetivo actual (id de interactuable o punto). En ?autoplay el jugador va solo hasta ahí. */
  autoTarget: At | null = null;
  private autoT = 0;

  private stepAuto(dt: number): void {
    if (!engine.debug.autoplay || !this.autoTarget || !this.player || !this.walkingEnabled()) return;
    this.autoT -= dt;
    if (this.autoT > 0) return;
    this.autoT = 0.4;
    const target = this.autoTarget;
    const id = typeof target === 'string' && this.interactables.has(target) ? target : null;
    let pos: Vec2 | null = null;
    try {
      pos = id ? this.interactables.get(id)!.at() : this.point(target);
    } catch {
      pos = null;
    }
    if (!pos) return;
    const p = this.player;
    const d = Math.hypot(pos.x - p.x, pos.y - p.y);
    if (id && d <= (this.interactables.get(id)!.radius ?? 1.2) - 0.1) {
      this.fire(id);
      this.autoT = 2.5;
      return;
    }
    if (!id && d < 0.3) return;
    if (!p.path) p.path = findPath(this.grid, p.x, p.y, pos.x, pos.y, p.radius) ?? [pos];
  }

  // ------------------------------------------------------------ bucle

  private lastErr = 0;

  update(time: number, delta: number): void {
    if (engine.paused || !this.sceneReady) return;
    try {
      this.step(time, delta);
    } catch (err) {
      // un error puntual no debe congelar el juego: se informa y se sigue
      if (performance.now() - this.lastErr > 3000) {
        this.lastErr = performance.now();
        console.error('[Escena] error en el cuadro', err);
      }
    }
  }

  private step(_time: number, delta: number): void {
    const dt = (Math.min(delta, 60) / 1000) * engine.scheduler.timeScale;
    this.beforeStep(dt);
    this.stepAuto(dt);
    this.stepPlayer(dt);
    this.stepNpcs(dt);
    this.updateInteract();
    this.updateZones();
    this.updateCaptions(dt);
    for (const c of this.chars.values()) c.sync(dt);
    this.afterStep(dt);
    this.updateCamera(dt);
    const cam = this.cameras.main;
    this.streamer?.update(new Phaser.Geom.Rectangle(cam.scrollX, cam.scrollY, cam.width, cam.height), dt);
  }

  protected beforeStep(_dt: number): void {}
  protected afterStep(_dt: number): void {}

  protected walkingEnabled(): boolean {
    return this.control && !!this.player && this.player.visible && !engine.ui.dialogue.active;
  }

  private stepPlayer(dt: number): void {
    const p = this.player;
    if (!p) return;
    if (!this.walkingEnabled()) {
      if (!p.path) p.moving = false;
      engine.input.consumeTap();
      return;
    }
    const mv = engine.input.move;
    const mag = Math.hypot(mv.x, mv.y);
    const tap = engine.input.consumeTap();
    if (tap) this.handleTap(tap);
    if (mag > 0.2) {
      p.path = null;
      const w = screenVecToWorld(mv.x, mv.y);
      const speed = p.speed * Math.min(1, 0.35 + mag) * engine.wind.walkFactor(w.x, w.y);
      const dx = w.x * speed * dt;
      const dy = w.y * speed * dt;
      const np = moveWithCollision(this.grid, p.x, p.y, dx, dy, p.radius);
      const moved = Math.hypot(np.x - p.x, np.y - p.y) > 1e-4;
      this.applyBounds(p, np);
      p.x = np.x;
      p.y = np.y;
      p.faceTowards(p.x + w.x, p.y + w.y);
      p.moving = moved;
      if (moved && !this.movedOnce) {
        this.movedOnce = true;
        this.onPlayerMoved?.();
      }
    } else if (!p.path) {
      p.moving = false;
    }
    if (p.moving) {
      this.stepSfxT -= dt;
      if (this.stepSfxT <= 0) {
        this.stepSfxT = 0.34;
        engine.audio.sfx('step', 0.6);
      }
    }
    if (engine.input.consumeAction()) this.triggerNearest();
  }

  private applyBounds(p: { x: number; y: number }, np: Vec2): void {
    if (!this.walkBounds) return;
    const [x0, y0, x1, y1] = this.walkBounds.rect;
    const out = np.x < x0 || np.y < y0 || np.x > x1 || np.y > y1;
    np.x = Math.max(x0, Math.min(x1, np.x));
    np.y = Math.max(y0, Math.min(y1, np.y));
    if (out && this.walkBounds.msg && performance.now() > this.boundsMsgT) {
      this.boundsMsgT = performance.now() + 7000;
      void engine.ui.bubbles.thought(this.walkBounds.msg, this.anchorOf('player'));
    }
    void p;
  }

  private handleTap(tap: Vec2): void {
    const p = this.player!;
    const cam = this.cameras.main;
    const w = engine.fromCss(cam, tap.x, tap.y);
    // ¿tocó algo interactuable?
    let best: { id: string; d: number } | null = null;
    for (const [id, it] of this.interactables) {
      if (!it.enabled) continue;
      const pos = it.at();
      if (!pos) continue;
      const s = isoToScreen(pos.x, pos.y, 10);
      const d = Math.hypot(s.x - w.x, s.y - w.y);
      if (d < 22 && (!best || d < best.d)) best = { id, d };
    }
    if (best) {
      const it = this.interactables.get(best.id)!;
      const pos = it.at()!;
      const dist = Math.hypot(pos.x - p.x, pos.y - p.y);
      if (dist <= it.radius) {
        this.fire(best.id);
        return;
      }
      const id = best.id;
      const path = findPath(this.grid, p.x, p.y, pos.x, pos.y, p.radius);
      if (path) {
        p.path = path;
        p.pathDone = () => {
          p.pathDone = null;
          const again = this.interactables.get(id)?.at();
          if (again && Math.hypot(again.x - p.x, again.y - p.y) <= (this.interactables.get(id)?.radius ?? 1.3) + 0.3) this.fire(id);
        };
      }
      return;
    }
    const iso = screenToIso(w.x, w.y);
    const path = findPath(this.grid, p.x, p.y, iso.x, iso.y, p.radius);
    if (path) {
      p.path = path;
      p.pathDone = null;
      if (!this.movedOnce) {
        this.movedOnce = true;
        this.onPlayerMoved?.();
      }
    }
  }

  private stepNpcs(dt: number): void {
    for (const c of this.chars.values()) {
      if (c.path && c.path.length) {
        const t = c.path[0];
        const dx = t.x - c.x;
        const dy = t.y - c.y;
        const d = Math.hypot(dx, dy);
        const wf = c === this.player ? engine.wind.walkFactor(dx / (d || 1), dy / (d || 1)) : 1;
        const step = c.speed * wf * dt;
        if (d <= step || d < 0.02) {
          c.x = t.x;
          c.y = t.y;
          c.path.shift();
          if (!c.path.length) {
            c.path = null;
            c.moving = false;
            const done = c.pathDone;
            c.pathDone = null;
            done?.();
          }
        } else {
          c.x += (dx / d) * step;
          c.y += (dy / d) * step;
          c.faceTowards(t.x, t.y);
          c.moving = true;
        }
        continue;
      }
      if (c.follow) {
        const tg = c.follow.target;
        if (!tg.visible) {
          c.moving = false;
          continue;
        }
        // rastro del objetivo
        const last = tg.trail[tg.trail.length - 1];
        if (!last || Math.hypot(last.x - tg.x, last.y - tg.y) > 0.25) {
          tg.trail.push({ x: tg.x, y: tg.y });
          if (tg.trail.length > 40) tg.trail.shift();
        }
        const d = Math.hypot(tg.x - c.x, tg.y - c.y);
        if (d > c.follow.dist + 0.25) {
          const goal = tg.trail.find((q) => Math.hypot(q.x - c.x, q.y - c.y) < d + 0.01 && Math.hypot(q.x - tg.x, q.y - tg.y) < d) ?? { x: tg.x, y: tg.y };
          const dx = goal.x - c.x;
          const dy = goal.y - c.y;
          const L = Math.hypot(dx, dy) || 1;
          const spd = Math.min(c.speed * (d > 3 ? 1.5 : 1.05), (d - c.follow.dist) * 4 + 0.6);
          const np = moveWithCollision(this.grid, c.x, c.y, (dx / L) * spd * dt, (dy / L) * spd * dt, c.radius * 0.8);
          c.x = np.x;
          c.y = np.y;
          c.faceTowards(c.x + dx, c.y + dy);
          c.moving = true;
          if (d > 6) {
            c.x = tg.x;
            c.y = tg.y;
          }
        } else {
          c.moving = false;
        }
        continue;
      }
      if (c.wander) {
        c.wander.next -= dt;
        if (c.wander.next <= 0) {
          c.wander.next = 2 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * c.wander.radius;
          const tx = c.wander.home.x + Math.cos(a) * r;
          const ty = c.wander.home.y + Math.sin(a) * r;
          if (canStand(this.grid, tx, ty, c.radius)) c.path = [{ x: tx, y: ty }];
        }
        if (!c.path) c.moving = false;
      }
    }
  }

  private updateInteract(): void {
    const p = this.player;
    let best: { id: string; d: number } | null = null;
    if (p && p.visible && this.control && !engine.ui.dialogue.active) {
      for (const [id, it] of this.interactables) {
        if (!it.enabled) continue;
        const pos = it.at();
        if (!pos) continue;
        const d = Math.hypot(pos.x - p.x, pos.y - p.y);
        if (d <= it.radius && (!best || d < best.d)) best = { id, d };
      }
    }
    const id = best?.id ?? null;
    if (id !== this.nearest) {
      if (this.nearest) engine.ui.bubbles.removeMarker(`hi:${this.nearest}`);
      this.nearest = id;
      if (id) {
        const it = this.interactables.get(id)!;
        engine.ui.hud.action(it.label, () => this.triggerNearest(), it.icon ?? '✋');
        engine.ui.bubbles.marker(`hi:${id}`, () => {
          const pos = it.at();
          if (!pos) return null;
          const s = isoToScreen(pos.x, pos.y, 28);
          return this.cssIfVisible(s.x, s.y);
        }, '!');
      } else {
        engine.ui.hud.action(null);
      }
    }
  }

  clearInteractHud(): void {
    if (this.nearest) engine.ui.bubbles.removeMarker(`hi:${this.nearest}`);
    this.nearest = null;
    engine.ui.hud.action(null);
  }

  private triggerNearest(): void {
    if (this.nearest) this.fire(this.nearest);
  }

  fire(id: string): void {
    const p = this.player;
    const it = this.interactables.get(id);
    if (p && it) {
      const pos = it.at();
      if (pos) {
        p.path = null;
        p.faceTowards(pos.x, pos.y);
      }
    }
    engine.events.emit('interact', { id });
    engine.events.emit(`interact:${id}`, { id });
  }

  private updateZones(): void {
    const p = this.player;
    if (!p || !p.visible) return;
    this.checkZones(p.x, p.y);
  }

  protected checkZones(x: number, y: number): void {
    for (const z of this.grid.zones.values()) {
      const [x0, y0, x1, y1] = z.rect;
      const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
      const was = this.zoneInside.get(z.id) ?? false;
      if (inside !== was) {
        this.zoneInside.set(z.id, inside);
        engine.events.emit(`zone:${inside ? 'enter' : 'leave'}:${z.id}`, { id: z.id });
      }
    }
  }

  inZone(id: string): boolean {
    return this.zoneInside.get(id) ?? false;
  }

  // ------------------------------------------------------------ lectura ampliada de carteles

  private capT = 0;

  /** Punto desde el que se "leen" los carteles (el jugador; el auto cuando maneja). */
  protected captionFocus(): Vec2 | null {
    const p = this.player;
    return p && p.visible ? { x: p.x, y: p.y } : null;
  }

  protected captionRadius(): number {
    return 6.5;
  }

  private updateCaptions(dt: number): void {
    this.capT -= dt;
    if (this.capT > 0) return;
    this.capT = 0.15;
    const ui = engine.ui.captions;
    const list = this.grid.captions;
    const mode = engine.save.settings.signCaptions;
    // auto: sólo cuando el pixel art se ve chico (teléfonos); en pantallas grandes los carteles ya se leen
    const wanted = mode === 'on' || (mode === 'auto' && engine.cssScale < 2.3);
    const f = list?.length && wanted && !engine.ui.dialogue.active && !engine.ui.faded ? this.captionFocus() : null;
    if (!list || !f) {
      ui.show([]);
      return;
    }
    const R = this.captionRadius();
    const near: { c: SignCaption; d: number }[] = [];
    for (const c of list) {
      const d = Math.hypot(c.x - f.x, c.y - f.y);
      if (d > R) continue;
      const s = isoToScreen(c.x, c.y, c.z);
      if (!this.cssIfVisible(s.x, s.y)) continue;
      near.push({ c, d });
    }
    near.sort((a, b) => a.d - b.d);
    ui.show(
      near.slice(0, 2).map(({ c }) => ({
        key: c.key,
        text: c.text,
        bg: toCss(C(c.bg)),
        fg: toCss(C(c.fg)),
        anchor: () => {
          const s = isoToScreen(c.x, c.y, c.z);
          return this.cssIfVisible(s.x, s.y);
        },
      })),
    );
  }

  // ------------------------------------------------------------ cámara

  protected cameraTarget(): Vec2 | null {
    const f = this.camFollow;
    if (!f) return null;
    if (f.kind === 'point') return isoToScreen(f.x, f.y);
    if (f.kind === 'fn') return f.fn();
    const c = this.chars.get(f.id);
    if (!c) return null;
    const s = isoToScreen(c.x, c.y);
    return { x: s.x, y: s.y - 14 };
  }

  protected updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const t = this.cameraTarget();
    if (!t) return;
    const tx = t.x + this.camLeadX;
    const ty = t.y + this.camLeadY;
    if (!this.camInit) {
      this.camX = tx;
      this.camY = ty;
      this.camInit = true;
    } else {
      this.camX = damp(this.camX, tx, 5.5, dt);
      this.camY = damp(this.camY, ty, 5.5, dt);
    }
    let sx = this.camX - cam.width / 2;
    let sy = this.camY - cam.height / 2;
    const b = this.mapPx;
    if (b.width > cam.width) sx = Math.max(b.x, Math.min(b.right - cam.width, sx));
    else sx = b.centerX - cam.width / 2;
    if (b.height > cam.height) sy = Math.max(b.y, Math.min(b.bottom - cam.height, sy));
    else sy = b.centerY - cam.height / 2;
    cam.setScroll(Math.round(sx), Math.round(sy));
  }

  snapCamera(): void {
    this.camInit = false;
    this.updateCamera(0);
  }

  cleanupIso(): void {
    for (const c of this.chars.values()) c.destroy();
    this.chars.clear();
    this.interactables.clear();
    this.player = null;
    this.clearInteractHud();
    engine.ui.bubbles.clear();
    engine.ui.captions.clear();
    this.streamer?.destroy();
    this.sceneReady = false;
    this.camInit = false;
    this.zoneInside.clear();
    this.walkBounds = null;
  }
}
