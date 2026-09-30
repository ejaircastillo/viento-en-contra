import * as THREE from 'three';
import type { Materials } from '../gfx/materials';
import type { Particles } from '../gfx/particles';
import { damp, smoothstep } from '../core/noise';
import type { Colliders } from './colliders';
import { makeCanvas, toTexture } from '../gfx/textures';

/**
 * El fantasma protagonista: una sábana blanca con un par de ojos negros, que flota un poco sobre el suelo,
 * se inclina al avanzar, deja el ruedo atrás y suelta destellos. La malla se deforma en CPU (unos cientos de
 * vértices) para que el ruedo ondule como tela.
 */
const PROFILE: [number, number][] = [
  [0.5, 0],
  [0.49, 0.07],
  [0.45, 0.2],
  [0.4, 0.42],
  [0.355, 0.7],
  [0.34, 0.98],
  [0.325, 1.16],
  [0.29, 1.3],
  [0.22, 1.41],
  [0.12, 1.48],
  [0.0, 1.5],
];
const SEG = 32;

let shadowTex: THREE.CanvasTexture | null = null;
export function blobShadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const [cv, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.95)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  shadowTex = toTexture(cv, { wrap: false });
  return shadowTex;
}

export class Ghost {
  readonly root = new THREE.Group();
  readonly pivot = new THREE.Group();
  readonly body: THREE.Mesh;
  readonly light: THREE.PointLight;
  vx = 0;
  vz = 0;
  yaw = 0;
  readonly radius = 0.42;
  maxSpeed = 3.4;
  /** Velocidad escalar suavizada (para animaciones). */
  speed = 0;
  private geo: THREE.LatheGeometry;
  private base: Float32Array;
  private shadow: THREE.Mesh;
  private hover = 0;
  private sparkT = 0;
  private lean = new THREE.Vector2();

  constructor(mats: Materials, private sparks: Particles | null) {
    this.geo = new THREE.LatheGeometry(
      PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      SEG,
    );
    this.base = Float32Array.from(this.geo.getAttribute('position').array as ArrayLike<number>);
    this.body = new THREE.Mesh(this.geo, mats.ghost);
    this.body.castShadow = true;
    this.pivot.add(this.body);

    const eyeGeo = new THREE.SphereGeometry(1, 12, 10);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x06070b, toneMapped: false });
    for (const side of [-1, 1]) {
      const a = side * 0.36;
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.scale.set(0.055, 0.092, 0.03);
      eye.position.set(Math.sin(a) * 0.318, 1.02, Math.cos(a) * 0.318);
      eye.rotation.y = a;
      this.pivot.add(eye);
    }
    this.root.add(this.pivot);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.04;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);

    // una luz fría muy tenue que lo acompaña: nunca se pierde en la oscuridad
    this.light = new THREE.PointLight(0xaec4ff, 2.2, 4.6, 2);
    this.light.position.set(0, 1.1, 0.2);
    this.root.add(this.light);
  }

  get x(): number {
    return this.root.position.x;
  }
  get z(): number {
    return this.root.position.z;
  }

  place(x: number, z: number, yaw = this.yaw): void {
    this.root.position.set(x, 0, z);
    this.vx = 0;
    this.vz = 0;
    this.yaw = yaw;
    this.pivot.rotation.y = yaw;
  }

  /** Gira hacia un punto del mundo (al hablar con alguien). */
  faceTowards(x: number, z: number): void {
    this.yaw = Math.atan2(x - this.x, z - this.z);
  }

  /**
   * Un paso de simulación: `want` es la dirección deseada en el mundo (longitud ≤ 1). Avanza con aceleración,
   * respeta los colisionadores y anima inclinación, flote y ruedo.
   */
  step(dt: number, time: number, want: { x: number; z: number }, cols: Colliders | null): void {
    const tx = want.x * this.maxSpeed;
    const tz = want.z * this.maxSpeed;
    const moving = Math.hypot(want.x, want.z) > 0.01;
    const k = moving ? 9 : 7;
    this.vx = damp(this.vx, tx, k, dt);
    this.vz = damp(this.vz, tz, k, dt);
    let nx = this.x + this.vx * dt;
    let nz = this.z + this.vz * dt;
    if (cols) {
      const [rx, rz] = cols.resolve(nx, nz, this.radius);
      // lo que chocó deja de contar como velocidad (el fantasma se desliza en vez de temblar contra la pared)
      if (Math.abs(rx - nx) > 1e-5) this.vx *= 0.4;
      if (Math.abs(rz - nz) > 1e-5) this.vz *= 0.4;
      nx = rx;
      nz = rz;
    }
    this.root.position.x = nx;
    this.root.position.z = nz;
    const sp = Math.hypot(this.vx, this.vz);
    this.speed = damp(this.speed, sp, 8, dt);
    if (sp > 0.35) {
      const want = Math.atan2(this.vx, this.vz);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 9);
    }
    this.animate(dt, time);
  }

  private animate(dt: number, time: number): void {
    const s = this.speed / this.maxSpeed;
    this.hover = 0.2 + Math.sin(time * 2.3) * 0.055 + s * 0.04;
    this.pivot.position.y = this.hover;
    this.pivot.rotation.y = this.yaw;
    // inclinación hacia donde va (en el sistema local del fantasma: +z adelante)
    const c = Math.cos(this.yaw);
    const sn = Math.sin(this.yaw);
    const lx = this.vx * c - this.vz * sn;
    const lz = this.vx * sn + this.vz * c;
    this.lean.x = damp(this.lean.x, lx / this.maxSpeed, 10, dt);
    this.lean.y = damp(this.lean.y, lz / this.maxSpeed, 10, dt);
    this.pivot.rotation.z = -this.lean.x * 0.16;
    this.pivot.rotation.x = this.lean.y * 0.2;
    const squash = 1 + Math.sin(time * 2.3 + 1) * 0.012;
    this.pivot.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    // sombra: más chica y clara cuanto más alto flota
    const h = this.hover;
    this.shadow.scale.setScalar(1.25 - h * 0.6);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.55 - h * 0.35;
    this.shadow.position.set(0, 0.04, 0);

    this.deformHem(time, lx, lz);

    // destellos en la estela
    if (this.sparks && this.speed > 0.6) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) {
        this.sparkT = 0.05 + Math.random() * 0.05;
        const sp = this.sparks;
        sp.spawn((p) => {
          p.x = this.x - Math.sin(this.yaw) * 0.25 + (Math.random() - 0.5) * 0.45;
          p.y = 0.25 + Math.random() * 0.5;
          p.z = this.z - Math.cos(this.yaw) * 0.25 + (Math.random() - 0.5) * 0.45;
          p.vx = (Math.random() - 0.5) * 0.15;
          p.vy = 0.12 + Math.random() * 0.2;
          p.vz = (Math.random() - 0.5) * 0.15;
          p.life = 1.1 + Math.random() * 0.9;
          p.size0 = 0.045 + Math.random() * 0.04;
          p.size1 = 0.02;
          p.c0.setRGB(1.6, 1.7, 2.0);
          p.c1.setRGB(0.5, 0.65, 1.0);
          p.peak = 0.9;
        });
      }
    }
  }

  /** Ondula el ruedo de la sábana y lo arrastra en contra del movimiento. */
  private deformHem(time: number, lx: number, lz: number): void {
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const n = PROFILE.length;
    const s = this.speed / this.maxSpeed;
    for (let i = 0; i <= SEG; i++) {
      for (let j = 0; j < n; j++) {
        const idx = i * n + j;
        const bx = this.base[idx * 3];
        const by = this.base[idx * 3 + 1];
        const bz = this.base[idx * 3 + 2];
        const r0 = Math.hypot(bx, bz);
        if (r0 < 1e-5) {
          pos.setXYZ(idx, bx, by, bz);
          continue;
        }
        const a = Math.atan2(bz, bx);
        const hem = smoothstep(1.0, 0.0, by);
        let r = r0 * (1 + 0.04 * Math.sin(a * 6 + 0.6) * hem);
        r += 0.028 * hem * Math.sin(a * 5 - time * 3.2 + by * 4) * (0.6 + s);
        const drag = hem * hem * 0.24 * s;
        pos.setXYZ(idx, r * Math.cos(a) - lx * drag, by, r * Math.sin(a) - lz * drag);
      }
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    // la costura de la lathe duplica vértices: se promedian las normales para que no se vea una raya
    const nor = this.geo.getAttribute('normal') as THREE.BufferAttribute;
    for (let j = 0; j < n; j++) {
      const a = j;
      const b = SEG * n + j;
      const x = nor.getX(a) + nor.getX(b);
      const y = nor.getY(a) + nor.getY(b);
      const z = nor.getZ(a) + nor.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      nor.setXYZ(a, x / l, y / l, z / l);
      nor.setXYZ(b, x / l, y / l, z / l);
    }
    nor.needsUpdate = true;
  }
}
