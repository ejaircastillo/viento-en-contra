import * as THREE from 'three';
import type { BuildCtx } from './ctx';
import { shadows } from './ctx';
import { V3, aoBottom, blob, boxUV, jitterColor, merge, prep, tube, xf } from '../gfx/geom';
import { createFlame, tickFlame } from '../gfx/flame';
import { glowBasic } from '../gfx/materials';
import { haloSprite, lightPool } from '../gfx/lights';
import { makeCanvas, toTexture } from '../gfx/textures';
import { noise1 } from '../core/noise';

/**
 * La fogata y todo lo que la rodea: anillo de piedras, troncos quemados, llamas con halo y charco de luz,
 * troncos para sentarse, calabazas con cara encendida, rocas y hongos.
 */
export interface Campfire {
  group: THREE.Group;
  /** Punto desde donde sale el humo y las brasas. */
  top: THREE.Vector3;
}

export function makeCampfire(ctx: BuildCtx, x: number, z: number): Campfire {
  const { mats, rnd } = ctx;
  const g = new THREE.Group();
  // anillo de piedras
  const stones: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rnd() * 0.2;
    const r = 0.95 + rnd() * 0.12;
    const s = blob(0.26 + rnd() * 0.1, 1, 0.25, i + 3, [1.1, 0.72, 0.95], '#8b8779');
    stones.push(xf(s, [Math.cos(a) * r, 0.12, Math.sin(a) * r], [0, rnd() * 6, 0]));
  }
  const sg = boxUV(merge(stones), 0.8);
  jitterColor(sg, 0.12, 5);
  g.add(new THREE.Mesh(sg, mats.stone));
  // leña: troncos apoyados en cono, carbonizados en las puntas
  const logs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const pts = [V3(Math.cos(a) * 0.65, 0.12, Math.sin(a) * 0.65), V3(Math.cos(a) * 0.3, 0.4, Math.sin(a) * 0.3), V3(Math.cos(a) * 0.05, 0.72, Math.sin(a) * 0.05)];
    logs.push(tube(pts, () => 0.095, 6, (_px, py) => (py < 0.22 || py > 0.66 ? '#15100d' : '#4a2f1f')));
  }
  g.add(new THREE.Mesh(merge(logs), mats.vertex));
  // lecho de brasas
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16), glowBasic(0xff5a12, 1.6));
  embers.rotation.x = -Math.PI / 2;
  embers.position.y = 0.05;
  g.add(embers);
  // llamas (tres planos que miran a la cámara) + halo + charco de luz
  const flames = [createFlame(1.05, 1.7, 0, 2.4), createFlame(0.8, 1.35, 3.1, 2.2), createFlame(0.62, 1.05, 7.7, 2.0)];
  flames[1].position.set(0.22, 0, 0.1);
  flames[2].position.set(-0.2, 0, -0.14);
  flames.forEach((f) => {
    f.position.y += 0.1;
    g.add(f);
  });
  const halo = haloSprite(0xff8a30, 4.4, 0.45);
  halo.position.y = 0.9;
  g.add(halo);
  const pool = lightPool(0xff7a24, 6.2, 0.5);
  pool.position.y = 0.04;
  g.add(pool);
  g.position.set(x, 0, z);
  ctx.pool.add({ pos: new THREE.Vector3(x, 1.1, z), area: ctx.area, color: new THREE.Color(0xff8a3a), intensity: 70, distance: 15, flicker: 0.28, seed: 4.4 });
  ctx.cols.circle(x, z, 1.25);
  ctx.tick.push((_dt, t) => {
    flames.forEach((f) => tickFlame(f, t));
    const k = 0.85 + 0.3 * noise1(t * 8, 1);
    halo.material.opacity = 0.45 * k;
    (pool.material as THREE.MeshBasicMaterial).opacity = 0.5 * k;
  });
  // sólo las piedras y la leña proyectan sombra
  g.children.forEach((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh && (m.material === mats.stone || m.material === mats.vertex)) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return { group: g, top: V3(x, 1.5, z) };
}

/** Tronco caído para sentarse: el eje va a lo largo de X local. */
export function makeLogSeat(ctx: BuildCtx, x: number, z: number, yaw: number, len = 1.7): THREE.Group {
  const body = xf(new THREE.CylinderGeometry(0.24, 0.27, len, 9), [0, 0.26, 0], [0, 0, Math.PI / 2]);
  const geo = prep(body, (px, _py, pz) => new THREE.Color('#4a3020').multiplyScalar(0.75 + noise1(px * 5 + pz * 7, 3) * 0.5));
  const cap = (dx: number, ry: number) => prep(xf(new THREE.CircleGeometry(0.23, 9), [dx, 0.26, 0], [0, ry, 0]), '#8d6a48');
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge([geo, cap(-len / 2 - 0.002, -Math.PI / 2), cap(len / 2 + 0.002, Math.PI / 2)]), ctx.mats.vertex));
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  shadows(g);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  ctx.cols.segment(x - c * len * 0.4, z + s * len * 0.4, x + c * len * 0.4, z - s * len * 0.4, 0.22);
  return g;
}

let faceTex: THREE.CanvasTexture | null = null;
function pumpkinFace(): THREE.CanvasTexture {
  if (faceTex) return faceTex;
  const [cv, c] = makeCanvas(128, 128);
  c.clearRect(0, 0, 128, 128);
  c.fillStyle = '#ffd36b';
  for (const [x0, x1, xt] of [[26, 54, 40], [74, 102, 88]] as const) {
    c.beginPath();
    c.moveTo(x0, 50);
    c.lineTo(x1, 50);
    c.lineTo(xt, 26);
    c.closePath();
    c.fill();
  }
  c.beginPath();
  c.moveTo(24, 78);
  c.quadraticCurveTo(64, 122, 104, 78);
  c.lineTo(92, 76);
  c.lineTo(84, 88);
  c.lineTo(72, 78);
  c.lineTo(56, 78);
  c.lineTo(44, 88);
  c.lineTo(36, 76);
  c.closePath();
  c.fill();
  faceTex = toTexture(cv, { wrap: false });
  return faceTex;
}

/** Calabaza tallada: costillas, tallo y cara emisiva; suma una luz naranja pequeña. */
export function makePumpkin(ctx: BuildCtx, x: number, z: number, lit = true, scale = 1): THREE.Group {
  const { rnd } = ctx;
  const g = new THREE.Group();
  const ico = new THREE.IcosahedronGeometry(0.34, 2);
  const p = ico.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 + Math.cos(a * 8) * 0.07;
    p.setXYZ(i, v.x * k, v.y * 0.8, v.z * k);
  }
  ico.computeVertexNormals();
  const body = prep(ico, (_px, py) => new THREE.Color('#d9661a').multiplyScalar(0.7 + 0.45 * THREE.MathUtils.clamp((py + 0.27) / 0.54, 0, 1)));
  const stem = prep(xf(new THREE.CylinderGeometry(0.04, 0.06, 0.12, 6), [0, 0.3, 0], [0.12, 0, 0.1]), '#4d5a26');
  g.add(new THREE.Mesh(merge([xf(body, [0, 0.27, 0]), stem]), ctx.mats.vertex));
  if (lit) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.46),
      new THREE.MeshBasicMaterial({ map: pumpkinFace(), transparent: true, color: new THREE.Color(2.4, 1.5, 0.5), toneMapped: false, depthWrite: false }),
    );
    face.position.set(0, 0.29, 0.325);
    g.add(face);
    const halo = haloSprite(0xffa040, 1.2, 0.5);
    halo.position.set(0, 0.3, 0.35);
    g.add(halo);
    ctx.pool.add({ pos: new THREE.Vector3(x, 0.45, z), area: ctx.area, intensity: 5, distance: 4.2, flicker: 0.2, seed: x + z });
  }
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 4 + (rnd() - 0.5) * 0.9;
  g.scale.setScalar(scale);
  shadows(g);
  ctx.cols.circle(x, z, 0.3 * scale);
  return g;
}

/** Piedra suelta (gris facetada). */
export function makeRock(ctx: BuildCtx, x: number, z: number, s = 0.4): THREE.Mesh {
  const seed = Math.floor(ctx.rnd() * 999);
  const geo = blob(s, 1, 0.3, seed, [1.2, 0.7, 1], (_px, py) => new THREE.Color('#7a7d86').multiplyScalar(0.75 + THREE.MathUtils.clamp(py / s, -0.5, 1) * 0.3));
  aoBottom(geo, -s * 0.5, s * 0.6, 0.6);
  const m = new THREE.Mesh(boxUV(geo, 1), ctx.mats.stone);
  m.position.set(x, s * 0.3, z);
  m.rotation.y = ctx.rnd() * 6;
  shadows(m);
  ctx.cols.circle(x, z, s * 0.85);
  return m;
}

/** Racimo de hongos rojizos con manchas claras. */
export function makeMushrooms(ctx: BuildCtx, x: number, z: number): THREE.Group {
  const parts: THREE.BufferGeometry[] = [];
  const n = 3 + Math.floor(ctx.rnd() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.5 + ctx.rnd() * 0.6;
    const ox = (ctx.rnd() - 0.5) * 0.4;
    const oz = (ctx.rnd() - 0.5) * 0.4;
    parts.push(prep(xf(new THREE.CylinderGeometry(0.03 * s, 0.045 * s, 0.17 * s, 6), [ox, 0.085 * s, oz]), '#d9cfb4'));
    const cap = blob(0.1 * s, 1, 0.12, i + 4, [1.25, 0.6, 1.25], (_px, py) => (py > 0.035 * s ? '#a62e2a' : '#e8dcc4'));
    parts.push(xf(cap, [ox, 0.18 * s, oz]));
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts), ctx.mats.vertex));
  g.position.set(x, 0, z);
  shadows(g, false, true);
  return g;
}
