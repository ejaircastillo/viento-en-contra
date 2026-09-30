import * as THREE from 'three';
import { damp } from './noise';

/**
 * Cámara perspectiva en ángulo alto y giro de 45° (la "diagonal isométrica" del diorama):
 * sigue al objetivo con amortiguación y se queda dentro de los límites del mapa, para que el borde
 * del terreno (y el vacío negro de más allá) se vea al llegar a las orillas.
 */
export interface RigConfig {
  fov: number;
  /** Ángulo de picada en grados (90 = desde arriba). */
  pitch: number;
  /** Giro alrededor del eje vertical en grados (45 = esquina hacia el fondo). */
  yaw: number;
  distance: number;
  /** Rectángulo [x0, z0, x1, z1] donde puede estar el punto de mira. */
  bounds: [number, number, number, number];
  /** Velocidad de seguimiento (más alto = más pegada). */
  follow: number;
}

export const GRAVEYARD_RIG: RigConfig = { fov: 27, pitch: 50, yaw: 45, distance: 31, bounds: [-13, -9, 13, 9], follow: 3.2 };
export const CRYPT_RIG: RigConfig = { fov: 27, pitch: 52, yaw: 45, distance: 20, bounds: [-1.2, -1, 1.2, 1], follow: 4 };

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  /** Punto de mira actual (suavizado). */
  readonly look = new THREE.Vector3();
  private want = new THREE.Vector3();
  private cfg: RigConfig;
  private shakeT = 0;
  private shakeAmp = 0;
  private dist: number;

  constructor(aspect: number, cfg: RigConfig = GRAVEYARD_RIG) {
    this.cfg = cfg;
    this.dist = cfg.distance;
    this.camera = new THREE.PerspectiveCamera(cfg.fov, aspect, 0.5, 140);
    this.place();
  }

  get config(): RigConfig {
    return this.cfg;
  }

  configure(cfg: RigConfig, snap = true): void {
    this.cfg = cfg;
    this.camera.fov = cfg.fov;
    this.camera.updateProjectionMatrix();
    if (snap) {
      this.dist = cfg.distance;
      this.shownDist = 0;
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    // en pantallas angostas (celular vertical) se aleja para que entre el mismo ancho de escena
    const k = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;
    this.dist = this.cfg.distance * k;
    this.camera.updateProjectionMatrix();
  }

  /** Mueve el objetivo; con `snap` no hay transición (cambio de área). */
  setTarget(x: number, z: number, snap = false): void {
    const [x0, z0, x1, z1] = this.cfg.bounds;
    this.want.set(Math.min(x1, Math.max(x0, x)), 0, Math.min(z1, Math.max(z0, z)));
    if (snap) this.look.copy(this.want);
  }

  shake(amp = 0.12, seconds = 0.35): void {
    this.shakeAmp = amp;
    this.shakeT = seconds;
  }

  update(dt: number): void {
    this.look.x = damp(this.look.x, this.want.x, this.cfg.follow, dt);
    this.look.z = damp(this.look.z, this.want.z, this.cfg.follow, dt);
    this.distSmooth(dt);
    this.place();
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT) * this.shakeAmp;
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k;
    }
  }

  private shownDist = 0;
  private distSmooth(dt: number): void {
    if (!this.shownDist) this.shownDist = this.dist;
    this.shownDist = damp(this.shownDist, this.dist, 4, dt);
  }

  private place(): void {
    const { pitch, yaw } = this.cfg;
    const p = THREE.MathUtils.degToRad(pitch);
    const y = THREE.MathUtils.degToRad(yaw);
    const d = this.shownDist || this.dist;
    this.camera.position.set(this.look.x + Math.sin(y) * Math.cos(p) * d, this.look.y + Math.sin(p) * d, this.look.z + Math.cos(y) * Math.cos(p) * d);
    this.camera.lookAt(this.look);
  }

  /** Direcciones del suelo según la cámara: adelante = hacia el fondo de la pantalla. */
  groundBasis(): { forward: THREE.Vector3; right: THREE.Vector3 } {
    const y = THREE.MathUtils.degToRad(this.cfg.yaw);
    const forward = new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y));
    const right = new THREE.Vector3(Math.cos(y), 0, -Math.sin(y));
    return { forward, right };
  }
}
