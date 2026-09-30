import * as THREE from 'three';
import type { Interactable } from '../world/ctx';
import type { Hud } from '../ui/hud';
import type { Post } from '../core/post';

/**
 * Selección de lo interactuable: el más cercano dentro de su alcance (con histéresis para que no parpadee
 * entre dos), contorno naranja sobre ese objeto y etiqueta flotante anclada en el mundo. También resuelve a
 * qué interactuable apunta un toque sobre el piso.
 */
export class Interaction {
  current: Interactable | null = null;
  private v = new THREE.Vector3();

  constructor(
    private post: Post,
    private hud: Hud,
    private camera: THREE.Camera,
  ) {}

  update(list: Interactable[], gx: number, gz: number, enabled: boolean): void {
    let best: Interactable | null = null;
    let bestD = Infinity;
    if (enabled) {
      for (const it of list) {
        if (!it.enabled) continue;
        const d = Math.hypot(it.x - gx, it.z - gz);
        if (d > it.radius) continue;
        // el actual tiene un poco de ventaja para que la etiqueta no salte
        const score = d - (it === this.current ? 0.7 : 0);
        if (score < bestD) {
          bestD = score;
          best = it;
        }
      }
    }
    if (best !== this.current) {
      this.current = best;
      this.post.setOutlined(best ? best.outline : []);
      if (!best) this.hud.hideTag();
    }
    if (best) {
      this.v.set(best.x, best.tagY, best.z).project(this.camera);
      const sx = (this.v.x * 0.5 + 0.5) * innerWidth;
      const sy = (-this.v.y * 0.5 + 0.5) * innerHeight;
      this.hud.showTag(best.label, sx, sy);
    }
  }

  clear(): void {
    this.current = null;
    this.post.setOutlined([]);
    this.hud.hideTag();
  }

  /** ¿Hay un interactuable cerca de ese punto del mundo? (para los toques). */
  pickNear(list: Interactable[], x: number, z: number, within = 1.6): Interactable | null {
    let best: Interactable | null = null;
    let bestD = within;
    for (const it of list) {
      if (!it.enabled) continue;
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }
}
