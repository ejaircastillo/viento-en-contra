import Phaser from 'phaser';
import { engine } from '../core/Engine';
import { fxBagSprite, fxCloudShadow, fxParticles } from '../assets/gen/fx';
import { isoToScreen } from '../core/math';

interface P {
  bob: Phaser.GameObjects.Bob;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'streak' | 'snow';
}

interface Bag {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  t: number;
  frames: (string | number)[];
}

/**
 * Clima visual: estelas de viento y aguanieve en espacio de pantalla (Blitter: miles de
 * partículas en un solo lote), bolsas de nylon volando y sombras de nubes en el mundo.
 * La cantidad se ajusta al presupuesto del dispositivo.
 */
export class Weather {
  private blitter: Phaser.GameObjects.Blitter;
  private parts: P[] = [];
  private bags: Bag[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private frames: (string | number)[];
  private bagRefs: { texture: string; frames: (string | number)[] }[];
  private bagT = 3;
  snow = 0.4;
  interior = false;

  constructor(private scene: Phaser.Scene, bagColors: string[]) {
    const ref = engine.assets.ensure('fx.particles', () => fxParticles());
    this.frames = ref.frames;
    this.blitter = scene.add.blitter(0, 0, ref.texture).setScrollFactor(0).setDepth(9e6);
    this.bagRefs = bagColors.map((c) => {
      const r = engine.assets.ensure(`fx.bag.${c}`, () => fxBagSprite(c));
      return { texture: r.texture, frames: r.frames };
    });
    const b = engine.device.budget;
    for (let i = 0; i < b.windStreaks; i++) this.addPart('streak');
    for (let i = 0; i < b.snowflakes; i++) this.addPart('snow');
    if (b.cloudShadows) {
      for (let i = 0; i < 3; i++) {
        const cr = engine.assets.ensure(`fx.cloud.${i}`, () => fxCloudShadow(i + 1));
        const img = scene.add.image(0, 0, cr.texture, cr.frames[0]).setDepth(-9e6 + 1);
        img.setData('ox', Math.random() * 600 - 300);
        img.setData('oy', Math.random() * 400 - 200);
        this.clouds.push(img);
      }
    }
    engine.assets.flush();
  }

  private addPart(kind: 'streak' | 'snow'): void {
    const f = kind === 'streak' ? this.frames[Math.floor(Math.random() * 3)] : this.frames[3 + Math.floor(Math.random() * 2)];
    const bob = this.blitter.create(0, 0, f);
    const cam = this.scene.cameras.main;
    this.parts.push({ bob, x: Math.random() * cam.width, y: Math.random() * cam.height, vx: 0, vy: 0, kind });
  }

  setInterior(on: boolean): void {
    this.interior = on;
    this.blitter.setVisible(!on);
    for (const c of this.clouds) c.setVisible(!on);
  }

  update(dt: number): void {
    const cam = this.scene.cameras.main;
    const w = cam.width;
    const h = cam.height;
    const s = engine.wind.strength;
    for (const p of this.parts) {
      if (p.kind === 'streak') {
        p.vx = 170 + s * 320;
        p.vy = 8 + s * 22;
        p.bob.alpha = Math.min(1, 0.15 + s * 0.9);
        p.bob.visible = s > 0.3 || Math.random() < 0.002;
      } else {
        p.vx = 55 + s * 160;
        p.vy = 26 + s * 18;
        p.bob.visible = this.snow > 0.15;
        p.bob.alpha = 0.55 + this.snow * 0.45;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x > w + 12 || p.y > h + 4) {
        p.x = -12 - Math.random() * 60;
        p.y = Math.random() * h - 20;
      }
      p.bob.x = Math.round(p.x);
      p.bob.y = Math.round(p.y);
    }
    // sombras de nubes (mundo)
    for (const c of this.clouds) {
      let ox = (c.getData('ox') as number) + (18 + s * 30) * dt;
      const oy = c.getData('oy') as number;
      if (ox > cam.width + 260) ox = -cam.width - 260;
      c.setData('ox', ox);
      c.setPosition(Math.round(cam.scrollX + cam.width / 2 + ox), Math.round(cam.scrollY + cam.height / 2 + oy));
    }
    // bolsas volando con las ráfagas
    this.bagT -= dt;
    const maxBags = engine.device.budget.flyingBags;
    if (!this.interior && this.bagT <= 0 && this.bags.length < maxBags && this.bagRefs.length) {
      this.bagT = 4 + Math.random() * 6;
      const r = this.bagRefs[Math.floor(Math.random() * this.bagRefs.length)];
      const img = this.scene.add.image(0, 0, r.texture, r.frames[0]).setDepth(8e6);
      // aparecer a la izquierda de la vista, en coordenadas de mundo
      this.bags.push({ img, x: cam.scrollX - 10, y: cam.scrollY + Math.random() * cam.height * 0.8, z: 0, vx: 60 + s * 90, vz: 0, t: 0, frames: r.frames });
    }
    for (const b of [...this.bags]) {
      b.t += dt;
      b.x += (b.vx + engine.wind.strength * 80) * dt;
      b.y += Math.sin(b.t * 2.2) * 14 * dt + 6 * dt;
      b.img.setPosition(Math.round(b.x), Math.round(b.y));
      b.img.setFrame(b.frames[Math.floor(b.t * 8) % b.frames.length]);
      if (b.x > cam.scrollX + cam.width + 20) {
        b.img.destroy();
        this.bags = this.bags.filter((x) => x !== b);
      }
    }
    void isoToScreen;
  }

  destroy(): void {
    this.blitter.destroy();
    for (const b of this.bags) b.img.destroy();
    for (const c of this.clouds) c.destroy();
    this.bags = [];
    this.parts = [];
  }
}
