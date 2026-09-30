import * as THREE from 'three';
import type { BuildCtx, Interactable } from './ctx';
import { shadows } from './ctx';
import type { Actor } from './chars';
import { makeCrow, makeDogSpirit, makeSkeleton } from './chars';
import { blobShadowTexture } from './ghost';
import { haloSprite } from '../gfx/lights';
import { merge, prep, xf } from '../gfx/geom';
import { damp } from '../core/noise';

/**
 * Habitantes del cementerio con un poco de vida propia: la perrita fantasma (deambula, te sigue, te guía
 * hasta el sello y se "ventosea" de vez en cuando), el cuervo que se aparta y el esqueleto junto al fuego.
 */
type Focus = { x: number; z: number };

export class DogBrain {
  readonly actor: ReturnType<typeof makeDogSpirit>;
  readonly it: Interactable;
  x: number;
  z: number;
  heading = 0;
  mode: 'wander' | 'follow' | 'lead' | 'dig' = 'wander';
  private tx: number;
  private tz: number;
  private wait = 0;
  private digT = 0;
  private fartT = 18 + Math.random() * 10;
  private leadCb: (() => void) | null = null;
  onPuff: (x: number, z: number, kind: 'fart' | 'dirt') => void = () => {};

  constructor(
    ctx: BuildCtx,
    private home: [number, number, number],
  ) {
    this.actor = makeDogSpirit(ctx);
    [this.x, this.z] = [home[0], home[1]];
    [this.tx, this.tz] = [this.x, this.z];
    this.it = { id: 'dog', label: 'Pelusa', x: this.x, z: this.z, radius: 1.8, outline: [this.actor.group], tagY: 1.25, kind: 'npc', enabled: true };
  }

  /** La perrita corre hasta (x, z), cava un momento y avisa. */
  lead(x: number, z: number, cb: () => void): void {
    this.mode = 'lead';
    this.tx = x;
    this.tz = z;
    this.leadCb = cb;
  }

  update(dt: number, t: number, ghost: Focus, ctx: BuildCtx, talking: boolean): void {
    const dGhost = Math.hypot(ghost.x - this.x, ghost.z - this.z);
    let speed = 0;
    if (this.mode === 'dig') {
      this.digT -= dt;
      this.actor.head!.rotation.z = -0.6 + Math.sin(t * 16) * 0.25;
      if (Math.random() < dt * 14) this.onPuff(this.x + Math.cos(this.heading) * 0.5, this.z - Math.sin(this.heading) * 0.5, 'dirt');
      if (this.digT <= 0) {
        this.mode = 'wander';
        const cb = this.leadCb;
        this.leadCb = null;
        cb?.();
      }
    } else {
      if (this.mode === 'wander') {
        this.wait -= dt;
        if (dGhost < 5.5 && dGhost > 2.2) this.mode = 'follow';
        else if (this.wait <= 0 || Math.hypot(this.tx - this.x, this.tz - this.z) < 0.25) {
          this.wait = 2 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * this.home[2];
          this.tx = this.home[0] + Math.cos(a) * r;
          this.tz = this.home[1] + Math.sin(a) * r;
        }
        speed = 1.0;
      } else if (this.mode === 'follow') {
        this.tx = ghost.x - 1.3;
        this.tz = ghost.z + 0.9;
        speed = 2.1;
        if (dGhost > 9) this.mode = 'wander';
        else if (dGhost < 2.0) speed = 0;
      } else if (this.mode === 'lead') {
        speed = 2.8;
        if (Math.hypot(this.tx - this.x, this.tz - this.z) < 0.35) {
          this.mode = 'dig';
          this.digT = 2.3;
        }
      }
      const dx = this.tx - this.x;
      const dz = this.tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.2 && speed > 0 && !talking) {
        const nx = this.x + (dx / d) * speed * dt;
        const nz = this.z + (dz / d) * speed * dt;
        const [rx, rz] = ctx.cols.resolve(nx, nz, 0.3);
        this.x = rx;
        this.z = rz;
        const want = Math.atan2(-dz, dx);
        let diff = want - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.heading += diff * Math.min(1, dt * 8);
      } else if (talking) {
        const want = Math.atan2(-(ghost.z - this.z), ghost.x - this.x);
        let diff = want - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.heading += diff * Math.min(1, dt * 6);
      }
      if (this.mode !== 'dig') this.actor.head!.rotation.z = damp(this.actor.head!.rotation.z, 0, 6, dt);
    }
    this.actor.group.position.x = this.x;
    this.actor.group.position.z = this.z;
    this.actor.group.rotation.y = this.heading;
    this.it.x = this.x;
    this.it.z = this.z;
    this.actor.update(dt, t, talking);
    // la ventosidad de la casa: una nubecita verdosa detrás, cada tanto
    this.fartT -= dt;
    if (this.fartT <= 0 && dGhost < 9) {
      this.fartT = 28 + Math.random() * 22;
      this.onPuff(this.x - Math.cos(this.heading) * 0.6, this.z + Math.sin(this.heading) * 0.6, 'fart');
    }
  }
}

/** Cuervo que se queda quieto, da saltitos y se corre cuando el fantasma se le acerca demasiado. */
export class CrowBrain {
  readonly actor: Actor;
  x: number;
  z: number;
  private heading = 0;
  constructor(ctx: BuildCtx, private home: [number, number]) {
    this.actor = makeCrow(ctx);
    [this.x, this.z] = home;
  }
  update(dt: number, t: number, ghost: Focus, ctx: BuildCtx): void {
    const dx = this.x - ghost.x;
    const dz = this.z - ghost.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.3) {
      const nx = this.x + (dx / (d || 1)) * 4.2 * dt;
      const nz = this.z + (dz / (d || 1)) * 4.2 * dt;
      [this.x, this.z] = ctx.cols.resolve(nx, nz, 0.18);
      this.heading = Math.atan2(-dz, dx);
    } else if (d > 6) {
      // vuelve despacio hacia su rincón
      const hx = this.home[0] - this.x;
      const hz = this.home[1] - this.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 0.3) {
        this.x += (hx / hd) * 1.1 * dt;
        this.z += (hz / hd) * 1.1 * dt;
        this.heading = Math.atan2(-hz, hx);
      }
    }
    const g = this.actor.group;
    g.position.x = this.x;
    g.position.z = this.z;
    g.rotation.y = this.heading;
    this.actor.update(dt, t, false);
  }
}
