import * as THREE from 'three';
import type { BuildCtx } from './ctx';
import { bladeGeometry, blob, merge, xf } from '../gfx/geom';
import { fbm, smoothstep } from '../core/noise';

/**
 * Vegetación instanciada: pasto seco (el "trigal" oscuro que bordea el diorama), helechos de hojas anchas,
 * arbustos y hojarasca. Cada familia es un único InstancedMesh; el viento lo mueve el material.
 */
export interface Spot {
  x: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  color: THREE.Color;
}

const DRY = ['#a07a36', '#b98d3c', '#82602a', '#cc9e44', '#6e5028', '#b56e2e', '#94692c'];
const GREEN = ['#44702a', '#57843a', '#345c22', '#66903a'];

/** Muestrea hasta `count` puntos aceptados por `density(x, z) ∈ [0, 1]` dentro de un rectángulo. */
export function scatter(ctx: BuildCtx, rect: [number, number, number, number], count: number, density: (x: number, z: number) => number, palette: string[], sy: [number, number], sx: [number, number]): Spot[] {
  const [x0, z0, x1, z1] = rect;
  const out: Spot[] = [];
  let tries = 0;
  const cols = palette.map((c) => new THREE.Color(c));
  while (out.length < count && tries < count * 14) {
    tries++;
    const x = x0 + ctx.rnd() * (x1 - x0);
    const z = z0 + ctx.rnd() * (z1 - z0);
    if (ctx.rnd() > density(x, z)) continue;
    const c = cols[Math.floor(ctx.rnd() * cols.length)].clone();
    c.multiplyScalar(0.75 + ctx.rnd() * 0.5);
    out.push({ x, z, rot: ctx.rnd() * Math.PI * 2, sx: sx[0] + ctx.rnd() * (sx[1] - sx[0]), sy: sy[0] + ctx.rnd() * (sy[1] - sy[0]), color: c });
  }
  return out;
}

export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, spots: Spot[], lift = 0): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, s.rot);
    m.compose(new THREE.Vector3(s.x, lift, s.z), q, new THREE.Vector3(s.sx, s.sy, s.sx));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, s.color);
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Pasto seco: denso hacia las orillas del terreno y en manchas sueltas; nunca sobre caminos ni props. */
export function makeDryGrass(ctx: BuildCtx, land: { w: number; d: number }, free: (x: number, z: number) => number, amount = 1): THREE.InstancedMesh {
  const hw = land.w / 2;
  const hd = land.d / 2;
  const blade = bladeGeometry(1, 0.13, 0.4, 3);
  const density = (x: number, z: number) => {
    const edge = Math.min(hw - Math.abs(x), hd - Math.abs(z));
    const rim = smoothstep(10, 0.5, edge);
    const patch = smoothstep(0.62, 0.85, fbm(x * 0.16 + 5, z * 0.16 + 9, 3, 2)) * 0.55;
    return Math.min(1, rim * 1.1 + patch) * free(x, z);
  };
  const count = Math.floor(36000 * amount * ctx.quality.grass);
  const spots = scatter(ctx, [-hw + 0.3, -hd + 0.3, hw - 0.3, hd - 0.3], count, density, DRY, [0.6, 1.5], [0.8, 1.5]);
  // los que están cerca de los bordes se inclinan hacia afuera: "esponjan" el límite del diorama
  return instanced(blade, ctx.mats.grass, spots);
}

/** Abanico de hojas anchas (helecho / hosta): 7 hojas que salen de un punto, más cortas al centro. */
function fernGeometry(): THREE.BufferGeometry {
  const leaves: THREE.BufferGeometry[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.3;
    const len = 0.55 + (i % 3) * 0.14;
    const pitch = 0.75 + (i % 2) * 0.35;
    const leaf = bladeGeometry(len, 0.4, 0.9, 3);
    leaves.push(xf(leaf, [0, 0.03, 0], [pitch, a, 0]));
  }
  return merge(leaves);
}

export function makeFerns(ctx: BuildCtx, spots: Spot[]): THREE.InstancedMesh {
  return instanced(fernGeometry(), ctx.mats.plant, spots);
}

/** Helechos junto a los caminos y alrededor de los elementos: `near(x, z)` devuelve densidad 0..1. */
export function fernSpots(ctx: BuildCtx, rect: [number, number, number, number], count: number, near: (x: number, z: number) => number): Spot[] {
  return scatter(ctx, rect, Math.floor(count * ctx.quality.plants), near, GREEN, [0.75, 1.5], [0.8, 1.35]);
}

/** Arbustos bajos de blobs verdes (en las esquinas de los cercos y al pie de los árboles). */
export function makeBush(ctx: BuildCtx, x: number, z: number, s = 1): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = ctx.rnd() * Math.PI * 2;
    const c = new THREE.Color(GREEN[Math.floor(ctx.rnd() * GREEN.length)]);
    const b = blob(0.34 + ctx.rnd() * 0.16, 1, 0.3, i + 2, [1, 0.8, 1], (_px, py) => c.clone().multiplyScalar(0.55 + 0.7 * THREE.MathUtils.clamp(py + 0.3, 0, 1)));
    parts.push(xf(b, [Math.cos(a) * 0.32 * s, 0.22 * s, Math.sin(a) * 0.32 * s], [0, ctx.rnd() * 6, 0], s));
  }
  const m = new THREE.Mesh(merge(parts), ctx.mats.leaf);
  m.position.set(x, 0, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Hojarasca: hojas planas naranjas, amarillas y rojas repartidas al pie de los árboles y sobre los caminos. */
export function makeLeafLitter(ctx: BuildCtx, centers: [number, number, number][], perCenter = 60): THREE.InstancedMesh {
  const leaf = new THREE.PlaneGeometry(0.2, 0.13);
  leaf.rotateX(-Math.PI / 2);
  const geo = merge([leaf]);
  const cols = ['#b4561e', '#d48a26', '#8c2f1c', '#c9a13a', '#7a4a1c', '#a8401a'].map((c) => new THREE.Color(c));
  const spots: Spot[] = [];
  for (const [cx, cz, r] of centers)
    for (let i = 0; i < perCenter * ctx.quality.plants; i++) {
      const a = ctx.rnd() * Math.PI * 2;
      const d = Math.sqrt(ctx.rnd()) * r;
      spots.push({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, rot: ctx.rnd() * 6, sx: 0.8 + ctx.rnd() * 1.1, sy: 1, color: cols[Math.floor(ctx.rnd() * cols.length)].clone().multiplyScalar(1.0 + ctx.rnd() * 0.5) });
    }
  // Lambert (sin brillo especular): con albedo tan oscuro el reflejo azul de la luna se comía el color de las hojas
  const mesh = instanced(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), spots, 0.04);
  mesh.receiveShadow = true;
  return mesh;
}
