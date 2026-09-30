import * as THREE from 'three';
import { glowTexture } from './textures';
import { noise1 } from '../core/noise';

/**
 * Luces del diorama. Three.js recompila los shaders cuando cambia la CANTIDAD de luces, así que en vez de
 * prender y apagar luces se usa un pozo fijo de PointLight que se reasigna, cada cuadro, a los emisores
 * (faroles, velas, antorchas, fogata) más cercanos a la cámara. Los demás emisores quedan representados
 * por charcos de luz pintados (aditivos) que siempre están.
 */
export interface Emitter {
  pos: THREE.Vector3;
  color: THREE.Color;
  /** Intensidad base (candela). */
  intensity: number;
  /** Alcance de la luz. */
  distance: number;
  /** Amplitud del parpadeo (0 = estable). */
  flicker: number;
  seed: number;
  /** Los emisores apagados (por ejemplo una vela sin encender) no entran al pozo. */
  on: boolean;
  /** Sólo valen mientras el área esté activa. */
  area: string;
}

export class LightPool {
  readonly lights: THREE.PointLight[] = [];
  private emitters: Emitter[] = [];
  private owner = new Map<THREE.PointLight, Emitter>();
  private level = new Map<THREE.PointLight, number>();

  constructor(scene: THREE.Scene, size: number) {
    for (let i = 0; i < size; i++) {
      const l = new THREE.PointLight(0xffaa55, 0, 8, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
      this.level.set(l, 0);
    }
  }

  add(e: Partial<Emitter> & { pos: THREE.Vector3; area: string }): Emitter {
    const em: Emitter = {
      color: new THREE.Color(0xffa14a),
      intensity: 14,
      distance: 7,
      flicker: 0.18,
      seed: Math.random() * 100,
      on: true,
      ...e,
    };
    this.emitters.push(em);
    return em;
  }

  get all(): readonly Emitter[] {
    return this.emitters;
  }

  update(time: number, dt: number, focus: THREE.Vector3, area: string): void {
    const live = this.emitters.filter((e) => e.on && e.area === area);
    const ranked = live
      .map((e) => ({ e, d: Math.hypot(e.pos.x - focus.x, e.pos.z - focus.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.lights.length)
      .map((r) => r.e);
    const want = new Set(ranked);
    // liberar luces cuyo emisor ya no está entre los elegidos
    for (const l of this.lights) {
      const o = this.owner.get(l);
      if (o && !want.has(o)) {
        this.owner.delete(l);
        this.level.set(l, 0);
      }
    }
    const taken = new Set(this.owner.values());
    for (const e of ranked) {
      if (taken.has(e)) continue;
      const free = this.lights.find((l) => !this.owner.has(l));
      if (!free) break;
      this.owner.set(free, e);
      this.level.set(free, 0);
      taken.add(e);
    }
    for (const l of this.lights) {
      const e = this.owner.get(l);
      if (!e) {
        l.intensity = 0;
        continue;
      }
      const lv = Math.min(1, (this.level.get(l) ?? 0) + dt * 2.5);
      this.level.set(l, lv);
      const f = 1 - e.flicker + e.flicker * 2 * (noise1(time * 7.3 + e.seed, e.seed) * 0.6 + noise1(time * 17 + e.seed * 3, 3) * 0.4);
      l.position.copy(e.pos);
      l.color.copy(e.color);
      l.distance = e.distance;
      l.intensity = e.intensity * f * lv;
    }
  }
}

let glowTex: THREE.CanvasTexture | null = null;
const glow = () => (glowTex ??= glowTexture(128, 2));

/** Charco de luz pintado sobre el piso (aditivo, no proyecta nada): mantiene el ambiente aunque la luz real esté lejos. */
export function lightPool(color: THREE.ColorRepresentation, radius: number, opacity = 0.35): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: glow(), color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(radius * 2);
  m.renderOrder = 2;
  m.userData.baseOpacity = opacity;
  return m;
}

/** Halo de una llama o de un vidrio encendido (sprite que siempre mira a la cámara). */
export function haloSprite(color: THREE.ColorRepresentation, size: number, opacity = 0.8): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow(), color: new THREE.Color(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  s.scale.setScalar(size);
  s.userData.baseOpacity = opacity;
  return s;
}
