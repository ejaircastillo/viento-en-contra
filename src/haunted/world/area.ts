import type * as THREE from 'three';
import type { RigConfig } from '../core/cameraRig';
import type { Actor, Interactable } from './ctx-exports';
import type { Colliders } from './colliders';

/**
 * Un "área" es un diorama completo (el cementerio, la cripta): su propio grupo de objetos, colisiones,
 * interactuables, cámara y atmósfera. El juego mete en la escena sólo el área activa.
 */
export interface Spawn {
  x: number;
  z: number;
  yaw: number;
}

/** Lo que el área necesita saber en cada cuadro. */
export interface AreaEnv {
  ghost: { x: number; z: number };
  camera: THREE.Camera;
  /** Id del personaje que está hablando ahora (para animarlo), si hay alguno. */
  talking: string | null;
}

export interface Area {
  id: string;
  group: THREE.Group;
  interactables: Interactable[];
  actors: Record<string, Actor>;
  rig: RigConfig;
  spawns: Record<string, Spawn>;
  /** Niebla y color de fondo de esta área. */
  fog: { color: number; density: number };
  cols: Colliders;
  update: (dt: number, t: number, env: AreaEnv) => void;
}
