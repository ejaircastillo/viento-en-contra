import Phaser from 'phaser';
import { isoToScreen, depthOf, type Dir4, type Vec2 } from '../core/math';
import type { SpriteRef } from '../assets/AssetRegistry';

/**
 * Personaje (jugador o NPC). Sólo maneja estado visual y posición;
 * el movimiento lo deciden los controladores de la escena.
 */
export type Pose = 'normal' | 'phone' | 'sit';

export interface InteractSpec {
  label: string;
  icon?: string;
  radius?: number;
}

export class Character {
  x: number;
  y: number;
  z = 0;
  facing: Dir4 = 'E';
  moving = false;
  speed = 2.1;
  pose: Pose = 'normal';
  radius = 0.2;
  interact: InteractSpec | null = null;
  path: Vec2[] | null = null;
  pathDone: (() => void) | null = null;
  follow: { target: Character; dist: number } | null = null;
  trail: Vec2[] = [];
  hiddenInCar = false;
  wander: { home: Vec2; radius: number; next: number } | null = null;
  voice = 1;
  bias = 0.12;
  private animT = Math.random() * 3;
  private frame = -1;
  readonly sprite: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    readonly id: string,
    public ref: SpriteRef,
    x: number,
    y: number,
    public name = '',
  ) {
    this.x = x;
    this.y = y;
    this.sprite = scene.add.image(0, 0, ref.texture, ref.frames[0]);
    this.sprite.setOrigin(ref.ax / ref.w, ref.ay / ref.h);
    this.sync(0);
  }

  get visible(): boolean {
    return this.sprite.visible;
  }

  /** Cambia el arte (ej. el jugador levanta un cartel): mismo layout de cuadros. */
  setRef(ref: SpriteRef): void {
    this.ref = ref;
    this.frame = -1;
    this.sprite.setTexture(ref.texture, ref.frames[0]);
    this.sprite.setOrigin(ref.ax / ref.w, ref.ay / ref.h);
    this.sync(0);
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
  }

  faceTowards(tx: number, ty: number): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return;
    // Elegimos la diagonal de pantalla más parecida: el sprite sólo tiene 4 orientaciones.
    const sx = dx - dy;
    const sy = dx + dy;
    if (sy >= 0) this.facing = sx >= 0 ? 'E' : 'S';
    else this.facing = sx >= 0 ? 'N' : 'W';
  }

  private pickFrame(): number {
    const front = this.facing === 'E' || this.facing === 'S';
    if (this.pose === 'phone') return front ? 12 : 6;
    if (this.pose === 'sit') return 13;
    if (this.moving) return (front ? 2 : 8) + (Math.floor(this.animT * 8) % 4);
    return (front ? 0 : 6) + (Math.floor(this.animT * 1.4) % 2);
  }

  sync(dt: number): void {
    this.animT += dt;
    const f = this.pickFrame();
    if (f !== this.frame) {
      this.frame = f;
      const name = this.ref.frames[Math.min(f, this.ref.frames.length - 1)];
      this.sprite.setFrame(name);
    }
    this.sprite.setFlipX(this.facing === 'S' || this.facing === 'W');
    const p = isoToScreen(this.x, this.y, this.z);
    this.sprite.setPosition(Math.round(p.x), Math.round(p.y));
    this.sprite.setDepth(depthOf(this.x, this.y, this.bias));
  }

  /** Posición de pantalla (px de arte) de la cabeza, para anclar globos. */
  headScreen(): Vec2 {
    const p = isoToScreen(this.x, this.y, this.z);
    return { x: p.x, y: p.y - (this.ref.ay - 1) };
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
