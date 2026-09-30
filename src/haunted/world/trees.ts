import * as THREE from 'three';
import type { BuildCtx } from './ctx';
import { shadows } from './ctx';
import { V3, blob, jitterColor, merge, prep, tube, xf } from '../gfx/geom';
import { noise1, rng } from '../core/noise';

/**
 * Árboles del diorama: el árbol seco de ramas negras (recursivo, con ramitas) y el árbol de otoño de copa roja
 * hecha de grumos facetados. Todo sale de tubos ahusados y blobs con color por vértice.
 */
const BARK = new THREE.Color(0x2a2019);
const BARK_LIGHT = new THREE.Color(0x4b3a2c);

function barkColor(seed: number) {
  return (x: number, y: number, z: number) => BARK.clone().lerp(BARK_LIGHT, Math.min(1, noise1(x * 4 + z * 3 + y * 2 + seed, seed) * 0.9 + y * 0.03));
}

function branch(r: () => number, start: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number, out: THREE.BufferGeometry[], seed: number): void {
  const pts = [start.clone()];
  const d = dir.clone();
  const p = start.clone();
  const segs = depth >= 3 ? 5 : 4;
  for (let i = 1; i <= segs; i++) {
    d.add(V3((r() - 0.5) * 0.45, (r() - 0.45) * 0.12, (r() - 0.5) * 0.45)).normalize();
    p.addScaledVector(d, len / segs);
    pts.push(p.clone());
  }
  out.push(tube(pts, (t) => Math.max(0.012, rad * (1 - t * 0.78)), depth >= 2 ? 6 : 4, barkColor(seed)));
  if (depth <= 0) return;
  const kids = depth >= 3 ? 3 : 2;
  for (let k = 0; k < kids; k++) {
    const t = 0.45 + r() * 0.55;
    const idx = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)));
    const base = pts[idx];
    const axis = V3(r() - 0.5, r() * 0.4, r() - 0.5).normalize();
    const nd = d.clone().applyAxisAngle(axis, 0.55 + r() * 0.6);
    nd.y = Math.max(nd.y, -0.15 + r() * 0.3);
    nd.normalize();
    branch(r, base, nd, len * (0.66 + r() * 0.12), rad * 0.6, depth - 1, out, seed + k * 7);
  }
}

/** Árbol seco: tronco retorcido con raíces en la base y una copa de ramas finas y negras. */
export function makeDeadTree(ctx: BuildCtx, x: number, z: number, scale = 1, seed = 1): THREE.Group {
  const r = rng(seed * 131 + 7);
  const geos: THREE.BufferGeometry[] = [];
  branch(r, V3(0, 0, 0), V3((r() - 0.5) * 0.25, 1, (r() - 0.5) * 0.25).normalize(), 1.7, 0.27, 4, geos, seed);
  // raíces que se abren sobre el suelo
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    const pts = [V3(Math.cos(a) * 0.05, 0.25, Math.sin(a) * 0.05), V3(Math.cos(a) * 0.35, 0.08, Math.sin(a) * 0.35), V3(Math.cos(a) * 0.7, -0.02, Math.sin(a) * 0.7)];
    geos.push(tube(pts, (t) => 0.13 * (1 - t * 0.85), 5, barkColor(seed + 50)));
  }
  const g = new THREE.Group();
  const geo = merge(geos);
  jitterColor(geo, 0.08, seed);
  g.add(new THREE.Mesh(geo, ctx.mats.vertex));
  g.position.set(x, 0, z);
  g.rotation.y = r() * Math.PI * 2;
  g.scale.setScalar(scale);
  shadows(g);
  ctx.cols.circle(x, z, 0.42 * scale);
  return g;
}

const REDS = ['#8f1f1c', '#b3301f', '#cc5220', '#7a1719', '#b8381f', '#d8701f'];

/** Árbol de otoño: tronco delgado, tres ramas y una copa de grumos rojos y naranjas, más oscura por dentro. */
export function makeAutumnTree(ctx: BuildCtx, x: number, z: number, scale = 1, seed = 1): THREE.Group {
  const r = rng(seed * 977 + 3);
  const trunk: THREE.BufferGeometry[] = [];
  const pts = [V3(0, 0, 0), V3(0.08, 0.7, 0.03), V3(-0.05, 1.4, 0.06), V3(0.05, 2.1, -0.04), V3(0, 2.6, 0)];
  trunk.push(tube(pts, (t) => 0.2 * (1 - t * 0.6), 6, barkColor(seed)));
  const limbs = 4;
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + r();
    const s = V3(0, 1.7 + r() * 0.5, 0);
    trunk.push(tube([s, V3(Math.cos(a) * 0.5, s.y + 0.45, Math.sin(a) * 0.5), V3(Math.cos(a) * 1.0, s.y + 0.8, Math.sin(a) * 1.0)], (t) => 0.09 * (1 - t * 0.7), 5, barkColor(seed + i)));
  }
  const blobs: THREE.BufferGeometry[] = [];
  const count = ctx.quality.id === 'low' ? 20 : 32;
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * 1.35;
    const cy = 2.75 + (r() - 0.35) * 1.15;
    const px = Math.cos(a) * rr;
    const pz = Math.sin(a) * rr;
    const base = new THREE.Color(REDS[Math.floor(r() * REDS.length)]);
    const rad = 0.4 + r() * 0.36;
    const inner = 1 - Math.min(1, Math.hypot(px, pz, (cy - 2.75) * 0.9) / 1.6);
    const b = blob(rad, 1, 0.3, seed * 10 + i, [1, 0.8, 1], (vx, vy) => base.clone().multiplyScalar(0.75 + 0.85 * THREE.MathUtils.clamp(0.4 + vy * 0.9 + (1 - inner) * 0.5, 0, 1)));
    blobs.push(xf(b, [px, cy, pz], [0, r() * 6, 0]));
  }
  const g = new THREE.Group();
  const tg = merge(trunk);
  jitterColor(tg, 0.08, seed);
  g.add(new THREE.Mesh(tg, ctx.mats.vertex));
  const leaves = merge(blobs);
  jitterColor(leaves, 0.1, seed + 9);
  const canopy = new THREE.Mesh(leaves, ctx.mats.leaf);
  g.add(canopy);
  g.position.set(x, 0, z);
  g.rotation.y = r() * Math.PI * 2;
  g.scale.setScalar(scale);
  shadows(g);
  ctx.cols.circle(x, z, 0.36 * scale);
  return g;
}
