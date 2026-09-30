import type * as THREE from 'three';
import type { Materials } from '../gfx/materials';
import type { LightPool } from '../gfx/lights';
import type { Quality } from '../core/quality';
import type { Colliders } from './colliders';

/** Lo que necesita cualquier constructor de props: materiales, luces, colisiones y el azar de la escena. */
export interface BuildCtx {
  mats: Materials;
  pool: LightPool;
  cols: Colliders;
  quality: Quality;
  /** Nombre del área (las luces del pozo sólo valen si su área está activa). */
  area: string;
  rnd: () => number;
  /** Animaciones y parpadeos: se ejecutan una vez por cuadro mientras el área está activa. */
  tick: ((dt: number, t: number) => void)[];
}

/** Algo con lo que el fantasma puede interactuar: lápidas, personajes, puertas, objetos. */
export interface Interactable {
  id: string;
  /** Texto de la etiqueta flotante ("Inspeccionar", el nombre de un personaje…). */
  label: string;
  /** Punto del suelo donde "está" (para medir la distancia). */
  x: number;
  z: number;
  /** Alcance en unidades del mundo. */
  radius: number;
  /** Objetos que se contornean en naranja mientras es el objetivo. */
  outline: THREE.Object3D[];
  /** Altura sobre el suelo a la que flota la etiqueta. */
  tagY: number;
  kind: 'npc' | 'inspect' | 'door' | 'pickup';
  enabled: boolean;
}

/** Agrega sombras a todas las mallas de un objeto. */
export function shadows(o: THREE.Object3D, cast = true, receive = true): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}
