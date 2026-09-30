import Phaser from 'phaser';
import { isoToScreen } from '../core/math';
import type { AssetRegistry, SpriteRef } from '../assets/AssetRegistry';
import type { StaticObject } from './types';
import type { GroundService } from './GroundService';
import type { GroundModel } from './ground';

/**
 * Carga por zonas: el suelo se pinta por chunks (16x16 baldosas) en un worker y los
 * objetos estáticos se instancian sólo cuando su chunk entra en el área de la cámara.
 * Los edificios se dibujan en tiras verticales de 8 px, cada una con la profundidad
 * del borde frontal de la huella en esa columna de pantalla: así personajes y autos
 * quedan delante o detrás de cada pared de forma exacta, sin reglas especiales.
 */

export const CHUNK = 16;
const STRIP = 8;
const GROUND_DEPTH = -1e7;

export function stripKeys(fpX: number, fpY: number, W: number, D: number, texW: number, ax: number): number[] {
  const keys: number[] = [];
  const keyAt = (t: number) => {
    const tc = Math.max(-D, Math.min(W, t));
    return fpX + fpY + (tc <= W - D ? 2 * D + tc : 2 * W - tc);
  };
  for (let x = 0; x < texW; x += STRIP) {
    const t0 = (x - ax) / 16;
    const t1 = (x + STRIP - ax) / 16;
    keys.push(Math.min(keyAt(t0), keyAt(t1)));
  }
  return keys;
}

interface LiveStatic {
  obj: StaticObject;
  images: Phaser.GameObjects.Image[];
  ref: SpriteRef;
  bounds: Phaser.Geom.Rectangle;
  frame: number;
  animT: number;
  visibleFlag: boolean;
}

interface LiveChunk {
  cx: number;
  cy: number;
  ground: Phaser.GameObjects.Image | null;
  texKey: string | null;
  statics: LiveStatic[];
  bounds: Phaser.Geom.Rectangle;
  pending: boolean;
  shown: boolean;
}

export class Streamer {
  private chunks = new Map<number, LiveChunk>();
  private byChunk = new Map<number, StaticObject[]>();
  private live = new Map<StaticObject, LiveStatic>();
  private hiddenOverrides = new Map<StaticObject, boolean>();
  private frameOverrides = new Map<StaticObject, number>();
  private animated: LiveStatic[] = [];
  private cx: number;
  private cy: number;
  private nextId = 0;
  private sceneKey: string;
  margin = 220;
  onStaticCreated?: (s: StaticObject, imgs: Phaser.GameObjects.Image[]) => void;

  constructor(
    private scene: Phaser.Scene,
    private ground: GroundModel,
    private groundSvc: GroundService | null,
    private assets: AssetRegistry,
    statics: StaticObject[],
    private staticGround?: { key: string; x: number; y: number } | null,
  ) {
    this.cx = Math.ceil(ground.w / CHUNK);
    this.cy = Math.ceil(ground.h / CHUNK);
    this.sceneKey = scene.scene.key + Math.random().toString(36).slice(2, 7);
    for (const s of statics) {
      const [cxT, cyT] = s.fp ? [s.x + s.fp[0] / 2, s.y + s.fp[1] / 2] : [s.x, s.y];
      const k = this.chunkIndex(Math.floor(cxT / CHUNK), Math.floor(cyT / CHUNK));
      let arr = this.byChunk.get(k);
      if (!arr) this.byChunk.set(k, (arr = []));
      arr.push(s);
    }
  }

  private chunkIndex(cx: number, cy: number): number {
    return Math.max(0, Math.min(this.cy - 1, cy)) * this.cx + Math.max(0, Math.min(this.cx - 1, cx));
  }

  private chunkBounds(cx: number, cy: number): Phaser.Geom.Rectangle {
    const i0 = cx * CHUNK;
    const j0 = cy * CHUNK;
    const sx0 = (i0 - j0 - CHUNK) * 16;
    const sy0 = (i0 + j0) * 8;
    // margen hacia arriba por edificios altos
    return new Phaser.Geom.Rectangle(sx0, sy0 - 120, CHUNK * 32, CHUNK * 16 + 120);
  }

  /** Pre-genera texturas de todos los estáticos (lo más pesado se hace detrás de la pantalla de carga). */
  warmTextures(filter?: (s: StaticObject) => boolean): void {
    for (const list of this.byChunk.values())
      for (const s of list) if (!filter || filter(s)) this.assets.ensure(s.texKey, s.gen);
    this.assets.flush();
  }

  update(view: Phaser.Geom.Rectangle, dt: number): void {
    const want = new Set<number>();
    const m = this.margin;
    const grown = new Phaser.Geom.Rectangle(view.x - m, view.y - m, view.width + m * 2, view.height + m * 2);
    for (let cy = 0; cy < this.cy; cy++) {
      for (let cx = 0; cx < this.cx; cx++) {
        const b = this.chunkBounds(cx, cy);
        if (Phaser.Geom.Rectangle.Overlaps(b, grown)) want.add(cy * this.cx + cx);
      }
    }
    let created = 0;
    for (const k of want) {
      if (this.chunks.has(k)) continue;
      if (created >= 2) break;
      this.createChunk(k % this.cx, Math.floor(k / this.cx));
      created++;
    }
    const far = new Phaser.Geom.Rectangle(grown.x - 400, grown.y - 300, grown.width + 800, grown.height + 600);
    for (const [k, c] of this.chunks) {
      if (want.has(k)) continue;
      if (!Phaser.Geom.Rectangle.Overlaps(c.bounds, far)) this.destroyChunk(k);
    }
    if (created) this.assets.flush();
    // culling por cámara
    for (const c of this.chunks.values()) {
      const vis = Phaser.Geom.Rectangle.Overlaps(c.bounds, grown);
      if (!vis && !c.shown) continue;
      c.shown = vis;
      if (c.ground) c.ground.setVisible(vis);
      for (const ls of c.statics) {
        const hidden = this.hiddenOverrides.get(ls.obj) ?? !!ls.obj.hidden;
        const v = vis && !hidden && Phaser.Geom.Rectangle.Overlaps(ls.bounds, grown);
        if (v !== ls.visibleFlag) {
          ls.visibleFlag = v;
          for (const im of ls.images) im.setVisible(v);
        }
      }
    }
    // animación de props
    for (const a of this.animated) {
      if (!a.visibleFlag) continue;
      const fps = a.obj.anim!.fps;
      a.animT += dt * fps;
      const seq = a.obj.anim!.seq;
      const n = seq ? seq.length : (a.obj.anim!.frames ?? a.ref.frames.length);
      const f = seq ? seq[Math.floor(a.animT) % n] : Math.floor(a.animT) % n;
      if (f !== a.frame && !this.frameOverrides.has(a.obj)) {
        a.frame = f;
        for (const im of a.images) im.setFrame(a.ref.frames[f]);
      }
    }
  }

  private createChunk(cx: number, cy: number): void {
    const k = cy * this.cx + cx;
    const chunk: LiveChunk = { cx, cy, ground: null, texKey: null, statics: [], bounds: this.chunkBounds(cx, cy), pending: true, shown: true };
    this.chunks.set(k, chunk);
    if (this.groundSvc) {
      void this.groundSvc.request(cx, cy, CHUNK).then((res) => {
        if (this.chunks.get(k) !== chunk || !this.scene.sys.isActive()) return;
        chunk.pending = false;
        if (res.empty) return;
        const key = `__g${this.sceneKey}_${cx}_${cy}_${this.nextId++}`;
        const tex = this.scene.textures.createCanvas(key, res.w, res.h);
        if (!tex) return;
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
        const img = new ImageData(new Uint8ClampedArray(res.data.buffer as ArrayBuffer), res.w, res.h);
        tex.context.putImageData(img, 0, 0);
        tex.refresh();
        chunk.texKey = key;
        chunk.ground = this.scene.add.image(res.sx0, res.sy0, key).setOrigin(0, 0).setDepth(GROUND_DEPTH);
        chunk.ground.setVisible(chunk.shown);
      });
    }
    for (const s of this.byChunk.get(k) ?? []) {
      const ls = this.instantiate(s);
      if (ls) chunk.statics.push(ls);
    }
  }

  private instantiate(s: StaticObject): LiveStatic | null {
    let ref: SpriteRef;
    try {
      ref = this.assets.ensure(s.texKey, s.gen);
    } catch (err) {
      console.warn('[Streamer] no se pudo generar', s.texKey, err);
      return null;
    }
    const images: Phaser.GameObjects.Image[] = [];
    const frame0 = this.frameOverrides.get(s) ?? s.frame ?? 0;
    const frameName = ref.frames[Math.min(frame0, ref.frames.length - 1)];
    let bounds: Phaser.Geom.Rectangle;
    if (s.fp) {
      const top = isoToScreen(s.x, s.y);
      const x0 = top.x - ref.ax;
      const y0 = top.y - ref.ay;
      const keys = stripKeys(s.x, s.y, s.fp[0], s.fp[1], ref.w, ref.ax);
      keys.forEach((key, i) => {
        const img = this.scene.add.image(x0, y0, ref.texture, frameName).setOrigin(0, 0);
        img.setCrop(i * STRIP, 0, STRIP, ref.h);
        img.setDepth(key * 100 - 1);
        images.push(img);
      });
      bounds = new Phaser.Geom.Rectangle(x0, y0, ref.w, ref.h);
    } else {
      const p = isoToScreen(s.x, s.y);
      const img = this.scene.add.image(p.x, p.y, ref.texture, frameName);
      img.setOrigin(ref.ax / ref.w, ref.ay / ref.h);
      img.setDepth((s.x + s.y + (s.bias ?? 0)) * 100);
      if (s.flipX) img.setFlipX(true);
      images.push(img);
      bounds = new Phaser.Geom.Rectangle(p.x - ref.ax, p.y - ref.ay, ref.w, ref.h);
    }
    const hidden = this.hiddenOverrides.get(s) ?? !!s.hidden;
    for (const im of images) im.setVisible(!hidden);
    const ls: LiveStatic = { obj: s, images, ref, bounds, frame: frame0, animT: Math.random() * 4, visibleFlag: !hidden };
    this.live.set(s, ls);
    if (s.anim && (ref.frames.length > 1 || s.anim.seq)) this.animated.push(ls);
    this.onStaticCreated?.(s, images);
    return ls;
  }

  private destroyChunk(k: number): void {
    const c = this.chunks.get(k);
    if (!c) return;
    c.ground?.destroy();
    if (c.texKey && this.scene.textures.exists(c.texKey)) this.scene.textures.remove(c.texKey);
    for (const ls of c.statics) {
      for (const im of ls.images) im.destroy();
      this.live.delete(ls.obj);
    }
    this.animated = this.animated.filter((a) => !c.statics.includes(a));
    this.chunks.delete(k);
  }

  setHidden(s: StaticObject, hidden: boolean): void {
    this.hiddenOverrides.set(s, hidden);
    const ls = this.live.get(s);
    if (ls) {
      ls.visibleFlag = !hidden;
      for (const im of ls.images) im.setVisible(!hidden);
    }
  }

  setFrame(s: StaticObject, frame: number): void {
    this.frameOverrides.set(s, frame);
    const ls = this.live.get(s);
    if (ls && ls.frame !== frame) {
      ls.frame = frame;
      const f = ls.ref.frames[Math.min(frame, ls.ref.frames.length - 1)];
      for (const im of ls.images) im.setFrame(f);
    }
  }

  images(s: StaticObject): Phaser.GameObjects.Image[] {
    return this.live.get(s)?.images ?? [];
  }

  get pendingGround(): number {
    let n = 0;
    for (const c of this.chunks.values()) if (c.pending) n++;
    return n;
  }

  get liveCount(): number {
    let n = 0;
    for (const c of this.chunks.values()) for (const s of c.statics) n += s.images.length;
    return n;
  }

  /** Suelo pintado en una sola textura (interiores chicos): se usa en lugar del worker. */
  addStaticGround(): void {
    if (!this.staticGround) return;
    this.scene.add.image(this.staticGround.x, this.staticGround.y, this.staticGround.key).setOrigin(0, 0).setDepth(GROUND_DEPTH);
  }

  destroy(): void {
    for (const k of [...this.chunks.keys()]) this.destroyChunk(k);
  }
}
