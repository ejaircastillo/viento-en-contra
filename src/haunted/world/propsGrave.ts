import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { BuildCtx } from './ctx';
import { shadows } from './ctx';
import { aoBottom, blob, boxUV, jitterColor, merge, prep, tombstoneGeometry, xf } from '../gfx/geom';
import { createFlame, tickFlame } from '../gfx/flame';
import { glowBasic } from '../gfx/materials';
import { haloSprite, lightPool } from '../gfx/lights';
import { engravingTexture } from '../gfx/textures';
import { noise1 } from '../core/noise';

/**
 * Props del cementerio: lápidas (con musgo, inclinación y velas), monumento de cruz, cercos de hierro con
 * pilares de piedra rotos y faroles. Cada constructor devuelve un Group listo para agregar a la escena y
 * registra colisiones / luces en el contexto.
 */

const MOSS = new THREE.Color(0x3f5a2a);
const STONE = new THREE.Color(0xb9bcc6);

/** Color de piedra con musgo abajo y manchas de suciedad. */
function stoneColor(seed: number, mossy = 0.5) {
  return (x: number, y: number, z: number) => {
    const c = STONE.clone();
    const n = noise1(x * 3 + z * 2 + seed, seed) * 0.35 + noise1(y * 4 + seed * 2, seed + 4) * 0.25;
    c.multiplyScalar(0.72 + n * 0.55);
    const m = THREE.MathUtils.smoothstep(0.55 - y * 0.6, 0, 1) * mossy * (0.5 + noise1(x * 5 + y * 3 + seed, seed + 9) * 0.8);
    return c.lerp(MOSS, Math.min(0.7, m));
  };
}

export function makeCandle(ctx: BuildCtx, lit = true): THREE.Group {
  const g = new THREE.Group();
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: 0.7 }));
  wax.position.y = 0.07;
  g.add(wax);
  if (lit) {
    const f = createFlame(0.11, 0.2, Math.random() * 20, 2.6);
    f.position.y = 0.16;
    g.add(f);
    const halo = haloSprite(0xffb060, 0.55, 0.6);
    halo.position.y = 0.22;
    g.add(halo);
    ctx.tick.push((_dt, t) => {
      tickFlame(f, t);
      halo.material.opacity = (halo.userData.baseOpacity as number) * (0.85 + 0.3 * noise1(t * 9 + f.id, 2));
    });
  }
  return g;
}

export interface TombOpts {
  top?: 'round' | 'cross' | 'pointed';
  w?: number;
  h?: number;
  lean?: number;
  candle?: boolean;
  text?: string[];
  yaw?: number;
}

/** Lápida con base, inclinación aleatoria, musgo y (opcional) inscripción y vela. */
export function makeTombstone(ctx: BuildCtx, x: number, z: number, o: TombOpts = {}): THREE.Group {
  const { mats, rnd } = ctx;
  const g = new THREE.Group();
  const w = o.w ?? 0.72 + rnd() * 0.2;
  const h = o.h ?? 0.95 + rnd() * 0.35;
  const seed = Math.floor(rnd() * 1000);
  const slab = xf(prep(new RoundedBoxGeometry(w * 1.3, 0.14, 0.62, 2, 0.04), stoneColor(seed, 0.9)), [0, 0.07, 0]);
  const stone = xf(prep(tombstoneGeometry(w, h, 0.2, o.top ?? 'round'), stoneColor(seed + 3, 0.6)), [0, 0.12, 0]);
  const geo = boxUV(merge([slab, stone]), 0.7);
  jitterColor(geo, 0.1, seed);
  const mesh = new THREE.Mesh(geo, mats.stone);
  g.add(mesh);
  if (o.text) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.8, w * 0.8),
      new THREE.MeshBasicMaterial({ map: engravingTexture(o.text), transparent: true, opacity: 0.7, depthWrite: false, toneMapped: true }),
    );
    plane.position.set(0, 0.12 + h * 0.52, 0.145);
    g.add(plane);
  }
  if (o.candle) {
    const c = makeCandle(ctx, true);
    c.position.set(w * 0.4, 0.14, 0.42);
    g.add(c);
  }
  g.position.set(x, 0, z);
  g.rotation.y = o.yaw ?? Math.PI / 4 + (rnd() - 0.5) * 0.7;
  g.rotation.z = (o.lean ?? (rnd() - 0.5) * 0.14);
  g.rotation.x = (rnd() - 0.5) * 0.07;
  shadows(g);
  ctx.cols.circle(x, z, Math.max(0.42, w * 0.55));
  return g;
}

/** Monumento: pedestal escalonado con cruz de piedra (como el del fondo de la referencia). */
export function makeCrossMonument(ctx: BuildCtx, x: number, z: number): THREE.Group {
  const { mats } = ctx;
  const parts = [
    xf(new RoundedBoxGeometry(1.1, 0.22, 1.1, 2, 0.05), [0, 0.11, 0]),
    xf(new RoundedBoxGeometry(0.8, 0.3, 0.8, 2, 0.05), [0, 0.37, 0]),
    xf(new RoundedBoxGeometry(0.55, 0.9, 0.55, 2, 0.05), [0, 0.97, 0]),
    xf(new RoundedBoxGeometry(0.66, 0.1, 0.66, 2, 0.03), [0, 1.47, 0]),
    xf(new RoundedBoxGeometry(0.16, 0.7, 0.16, 2, 0.03), [0, 1.87, 0]),
    xf(new RoundedBoxGeometry(0.5, 0.15, 0.16, 2, 0.03), [0, 2.0, 0]),
  ].map((p) => prep(p, stoneColor(7, 0.7)));
  const geo = boxUV(merge(parts), 0.7);
  aoBottom(geo, 0, 1.2, 0.6);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mats.stone));
  for (const [dx, dz] of [[0.55, 0.55], [-0.5, 0.6]] as const) {
    const c = makeCandle(ctx, true);
    c.position.set(dx, 0, dz);
    g.add(c);
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 4;
  shadows(g);
  ctx.cols.circle(x, z, 0.75);
  return g;
}

export interface FenceOpts {
  /** Probabilidad de que falte una púa o esté torcida. */
  damage?: number;
  /** Altura de la reja. */
  h?: number;
  /** Distancia entre pilares de piedra. */
  post?: number;
  gapFrom?: number;
  gapTo?: number;
}

/**
 * Cerco de hierro con pilares de piedra: púas con punta de lanza, dos travesaños y algunos tramos
 * rotos o caídos. Sigue una polilínea [x, z][] y deja colisiones en cada tramo.
 */
export function makeFence(ctx: BuildCtx, pts: [number, number][], o: FenceOpts = {}): THREE.Group {
  const { mats, rnd } = ctx;
  const h = o.h ?? 1.3;
  const postEvery = o.post ?? 2.2;
  const iron: THREE.BufferGeometry[] = [];
  const stone: THREE.BufferGeometry[] = [];
  const bar = new THREE.BoxGeometry(0.045, h, 0.045);
  const tip = new THREE.ConeGeometry(0.06, 0.16, 4);
  const rail = new THREE.BoxGeometry(1, 0.05, 0.05);
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, z0] = pts[s];
    const [x1, z1] = pts[s + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const dx = (x1 - x0) / len;
    const dz = (z1 - z0) / len;
    const nPosts = Math.max(1, Math.round(len / postEvery));
    const step = len / nPosts;
    ctx.cols.segment(x0, z0, x1, z1, 0.2);
    for (let p = 0; p <= nPosts; p++) {
      const d = p * step;
      const px = x0 + dx * d;
      const pz = z0 + dz * d;
      const broken = rnd() < (o.damage ?? 0.15) && p !== 0;
      const ph = broken ? 0.45 + rnd() * 0.4 : h + 0.32;
      const lean = broken ? (rnd() - 0.5) * 0.35 : 0;
      const post = new RoundedBoxGeometry(0.36, ph, 0.36, 2, 0.04);
      stone.push(prep(xf(post, [px, ph / 2, pz], [lean, yaw, lean * 0.6]), (_x, y) => (y > ph * 0.85 ? '#bdb8aa' : '#8f8b7e')));
      if (!broken) stone.push(prep(xf(new RoundedBoxGeometry(0.46, 0.1, 0.46, 2, 0.03), [px, ph + 0.05, pz], [0, yaw, 0]), '#a9a497'));
    }
    // travesaños
    for (const ry of [h * 0.3, h * 0.78]) iron.push(prep(xf(rail, [(x0 + x1) / 2, ry, (z0 + z1) / 2], [0, yaw, 0], [len, 1, 1]), '#3b3f49'));
    // púas
    const n = Math.floor(len / 0.3);
    for (let i = 0; i < n; i++) {
      const d = (i + 0.5) * (len / n);
      const px = x0 + dx * d;
      const pz = z0 + dz * d;
      const nearPost = Math.abs(((d + step * 0.0) % step) - 0) < 0.25 || Math.abs((d % step) - step) < 0.25;
      if (nearPost) continue;
      if (rnd() < (o.damage ?? 0.15) * 0.8) continue;
      const tilt = rnd() < 0.12 ? (rnd() - 0.5) * 0.5 : 0;
      const col = '#2c2f38';
      iron.push(prep(xf(bar, [px, h / 2, pz], [tilt, yaw, tilt * 0.5]), col));
      iron.push(prep(xf(tip, [px, h + 0.05, pz], [tilt, yaw, tilt * 0.5]), col));
    }
  }
  const g = new THREE.Group();
  if (iron.length) g.add(new THREE.Mesh(boxUV(merge(iron), 1), mats.iron));
  if (stone.length) {
    const sg = boxUV(merge(stone), 0.7);
    jitterColor(sg, 0.08, 4);
    g.add(new THREE.Mesh(sg, mats.stone));
  }
  shadows(g);
  return g;
}

/** Farol de hierro con vidrio ámbar: en el piso o sobre un poste. Suma una luz al pozo y un charco de luz. */
export function makeLantern(ctx: BuildCtx, x: number, z: number, post = false, yaw = 0): THREE.Group {
  const { mats } = ctx;
  const g = new THREE.Group();
  const y0 = post ? 1.35 : 0;
  const parts: THREE.BufferGeometry[] = [];
  const dark = '#22252c';
  parts.push(prep(xf(new THREE.BoxGeometry(0.34, 0.05, 0.34), [0, y0 + 0.025, 0]), dark));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) parts.push(prep(xf(new THREE.BoxGeometry(0.035, 0.36, 0.035), [dx * 0.15, y0 + 0.23, dz * 0.15]), dark));
  parts.push(prep(xf(new THREE.ConeGeometry(0.27, 0.17, 4), [0, y0 + 0.5, 0], [0, Math.PI / 4, 0]), dark));
  parts.push(prep(xf(new THREE.TorusGeometry(0.07, 0.012, 6, 12), [0, y0 + 0.62, 0], [Math.PI / 2, 0, 0]), dark));
  if (post) {
    parts.push(prep(xf(new THREE.CylinderGeometry(0.045, 0.06, y0, 6), [0, y0 / 2, 0]), '#2d3038'));
    parts.push(prep(xf(new THREE.BoxGeometry(0.4, 0.04, 0.04), [0.12, y0 + 0.02, 0]), '#2d3038'));
  }
  g.add(new THREE.Mesh(merge(parts), mats.iron));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.32, 0.25), glowBasic(0xffa43a, 2.3));
  glass.position.y = y0 + 0.23;
  g.add(glass);
  const halo = haloSprite(0xff9d3e, 1.5, 0.5);
  halo.position.y = y0 + 0.25;
  g.add(halo);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  shadows(g, true, false);
  const pool = lightPool(0xff8f32, 2.6, 0.2);
  pool.position.set(0, 0.035, 0);
  g.add(pool);
  ctx.pool.add({ pos: new THREE.Vector3(x, y0 + 0.3, z), area: ctx.area, intensity: post ? 12 : 9, distance: 6.5, flicker: 0.12, seed: x * 3.1 + z });
  ctx.cols.circle(x, z, post ? 0.2 : 0.22);
  const seed = x * 1.7 + z;
  ctx.tick.push((_dt, t) => {
    const f = 0.88 + 0.22 * noise1(t * 6 + seed, 5);
    halo.material.opacity = 0.5 * f;
    (pool.material as THREE.MeshBasicMaterial).opacity = 0.2 * f;
  });
  return g;
}
