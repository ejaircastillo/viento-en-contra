import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { BuildCtx } from './ctx';
import { shadows } from './ctx';
import { V3, blob, boxUV, jitterColor, merge, prep, tube, xf } from '../gfx/geom';
import { createFlame, tickFlame } from '../gfx/flame';
import { glowBasic } from '../gfx/materials';
import { haloSprite } from '../gfx/lights';
import { glowTexture } from '../gfx/textures';
import { noise1 } from '../core/noise';

/**
 * Muebles y adornos de la cripta: cráneos, libros, frascos, escritorio del escribano, estante, cofre con manto,
 * cajón de huesos, ataúd con esqueleto, barril y antorchas de pared. Todos low-poly con bordes redondeados
 * (los biseles atrapan la luz de las velas) y colores pintados por vértice.
 */
const rb = (w: number, h: number, d: number, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, r);

export function makeSkull(ctx: BuildCtx, scale = 1): THREE.Group {
  const bone = '#e6dbc0';
  const cranium = blob(0.13, 2, 0.03, 3, [1, 0.95, 1.08], bone);
  const jaw = xf(blob(0.07, 1, 0.03, 4, [1.1, 0.55, 0.95], '#b9ad90'), [0, -0.095, 0.03]);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge([xf(cranium, [0, 0.13, 0]), jaw]), ctx.mats.bone));
  const black = new THREE.MeshBasicMaterial({ color: 0x07060a, toneMapped: false });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), black);
    eye.scale.set(1, 1.2, 0.5);
    eye.position.set(s * 0.05, 0.14, 0.115);
    g.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 3), black);
  nose.position.set(0, 0.095, 0.135);
  nose.rotation.x = Math.PI;
  g.add(nose);
  g.scale.setScalar(scale);
  shadows(g);
  return g;
}

/** Pila de libros encuadernados (cada uno con su color y su ángulo). */
export function makeBooks(ctx: BuildCtx, n = 4): THREE.Mesh {
  const cols = ['#5a2a24', '#2c3f5a', '#3f5a2c', '#6a4a24', '#4a2c5a'];
  const parts: THREE.BufferGeometry[] = [];
  let y = 0;
  for (let i = 0; i < n; i++) {
    const h = 0.06 + ctx.rnd() * 0.04;
    const w = 0.34 - i * 0.02 + ctx.rnd() * 0.04;
    parts.push(prep(xf(rb(w, h, w * 0.75, 0.012), [(ctx.rnd() - 0.5) * 0.04, y + h / 2, (ctx.rnd() - 0.5) * 0.04], [0, (ctx.rnd() - 0.5) * 0.4, 0]), cols[i % cols.length]));
    parts.push(prep(xf(rb(w * 0.96, h * 0.6, w * 0.7, 0.01), [0.012, y + h / 2, 0.01]), '#d8cfae'));
    y += h;
  }
  const m = new THREE.Mesh(merge(parts), ctx.mats.vertex);
  shadows(m);
  return m;
}

/** Frasco / botella de vidrio con líquido de color (verde, ámbar o violeta). */
export function makeJar(ctx: BuildCtx, color = '#3a7a4a', h = 0.22): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [
    prep(xf(new THREE.CylinderGeometry(0.06, 0.07, h, 8), [0, h / 2, 0]), color),
    prep(xf(new THREE.CylinderGeometry(0.03, 0.05, 0.06, 8), [0, h + 0.03, 0]), color),
    prep(xf(new THREE.CylinderGeometry(0.035, 0.035, 0.035, 8), [0, h + 0.075, 0]), '#8a6a3c'),
  ];
  const m = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1, emissive: 0x0a140c, emissiveIntensity: 0.8 }));
  shadows(m);
  return m;
}

/** Antorcha de pared: placa de madera rojiza, copa de hierro, llama, halo y luz al pozo. Devuelve el grupo. */
export function makeSconce(ctx: BuildCtx, x: number, y: number, z: number, facing: 'east' | 'south'): THREE.Group {
  const g = new THREE.Group();
  const plate = prep(xf(rb(0.16, 0.56, 0.06, 0.02), [0, 0, 0.03]), '#7b3b22');
  const cup = prep(xf(new THREE.CylinderGeometry(0.1, 0.06, 0.13, 8), [0, 0.06, 0.15]), '#2a2c33');
  const arm = prep(xf(rb(0.04, 0.04, 0.16, 0.01), [0, -0.05, 0.1]), '#2a2c33');
  const stick = prep(xf(new THREE.CylinderGeometry(0.035, 0.03, 0.22, 6), [0, 0.11, 0.15]), '#4a3020');
  g.add(new THREE.Mesh(merge([plate, cup, arm, stick]), ctx.mats.vertex));
  const flame = createFlame(0.26, 0.42, Math.random() * 30, 2.6);
  flame.position.set(0, 0.22, 0.15);
  g.add(flame);
  const halo = haloSprite(0xffa050, 0.9, 0.7);
  halo.position.set(0, 0.3, 0.2);
  g.add(halo);
  // charco de luz sobre la pared
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: glowTexture(128, 1.6), color: 0xff9a45, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  wall.scale.setScalar(4.2);
  wall.position.set(0, -0.2, 0.07);
  wall.renderOrder = 2;
  g.add(wall);
  // la placa mira hacia +z local: east → +x del mundo, south → +z del mundo
  g.rotation.y = facing === 'east' ? Math.PI / 2 : 0;
  g.position.set(x, y, z);
  const n = facing === 'east' ? V3(1, 0, 0) : V3(0, 0, 1);
  ctx.pool.add({ pos: V3(x + n.x * 0.35, y + 0.35, z + n.z * 0.35), area: ctx.area, intensity: 12, distance: 8.5, flicker: 0.16, seed: x * 2 + z * 5 });
  ctx.tick.push((_dt, t) => {
    tickFlame(flame, t);
    const k = 0.88 + 0.24 * noise1(t * 8 + x, z);
    halo.material.opacity = 0.7 * k;
    (wall.material as THREE.MeshBasicMaterial).opacity = 0.12 * k;
  });
  return g;
}

/** Barril de duelas con aros de hierro y tapa de color. */
export function makeBarrel(ctx: BuildCtx, x: number, z: number, lid = '#2b4f8c'): THREE.Group {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.CylinderGeometry(0.4, 0.36, 0.85, 12);
  parts.push(prep(xf(body, [0, 0.43, 0]), (_px, py) => new THREE.Color('#6b4426').multiplyScalar(0.7 + 0.4 * Math.min(1, py + 0.3))));
  for (const y of [0.15, 0.7]) parts.push(prep(xf(new THREE.TorusGeometry(0.39 - (y < 0.3 ? 0.03 : 0), 0.022, 5, 14), [0, y, 0], [Math.PI / 2, 0, 0]), '#23262e'));
  parts.push(prep(xf(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 12), [0, 0.86, 0]), lid));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(boxUV(merge(parts), 0.8), ctx.mats.wood));
  g.position.set(x, 0, z);
  shadows(g);
  ctx.cols.circle(x, z, 0.42);
  return g;
}

/** Telaraña en una esquina: tres hilos y arcos concéntricos casi transparentes. */
export function makeCobweb(size = 1.2): THREE.LineSegments {
  const pts: number[] = [];
  const spokes = 5;
  for (let i = 0; i < spokes; i++) {
    const a = (i / (spokes - 1)) * (Math.PI / 2);
    pts.push(0, 0, 0, Math.cos(a) * size, Math.sin(a) * size, 0);
  }
  for (let r = 1; r <= 3; r++)
    for (let i = 0; i < spokes - 1; i++) {
      const a0 = (i / (spokes - 1)) * (Math.PI / 2);
      const a1 = ((i + 1) / (spokes - 1)) * (Math.PI / 2);
      const k = (r / 3) * size * (0.9 - r * 0.04);
      pts.push(Math.cos(a0) * k, Math.sin(a0) * k, 0, Math.cos(a1) * k * 0.96, Math.sin(a1) * k * 0.96, 0);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xcfd6e6, transparent: true, opacity: 0.35 }));
}

export { tube, jitterColor, glowBasic };

/** Escritorio del escribano: tablero grueso, patas, cajón; encima libros, tintero, pergamino, vela y farolito. */
export function makeDesk(ctx: BuildCtx, len = 3): THREE.Group {
  const g = new THREE.Group();
  const wood: THREE.BufferGeometry[] = [
    prep(xf(rb(len, 0.1, 1.05, 0.03), [0, 0.92, 0]), '#8a5230'),
    prep(xf(rb(len - 0.2, 0.22, 0.9, 0.02), [0, 0.76, 0]), '#5e3520'),
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.push(prep(xf(rb(0.13, 0.9, 0.13, 0.02), [sx * (len / 2 - 0.15), 0.45, sz * 0.38]), '#4e2c1a'));
  wood.push(prep(xf(rb(len - 0.3, 0.06, 0.06, 0.01), [0, 0.3, 0.38]), '#4e2c1a'));
  wood.push(prep(xf(rb(len - 0.3, 0.06, 0.06, 0.01), [0, 0.3, -0.38]), '#4e2c1a'));
  const geo = boxUV(merge(wood), 0.9);
  jitterColor(geo, 0.08, 3);
  g.add(new THREE.Mesh(geo, ctx.mats.wood));
  // objetos sobre el escritorio
  const books = makeBooks(ctx, 4);
  books.position.set(-len / 2 + 0.5, 0.97, -0.15);
  g.add(books);
  const scroll = new THREE.Mesh(merge([prep(xf(rb(0.7, 0.012, 0.5, 0.004), [0, 0, 0]), '#dccfa6'), prep(xf(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), [0.36, 0.02, 0], [Math.PI / 2, 0, 0]), '#c9b98a')]), ctx.mats.vertex);
  scroll.position.set(0.1, 0.98, 0.1);
  scroll.rotation.y = 0.25;
  g.add(scroll);
  const ink = prep(xf(new THREE.CylinderGeometry(0.05, 0.06, 0.09, 8), [0, 0.045, 0]), '#16161c');
  const quill = prep(xf(new THREE.CylinderGeometry(0.004, 0.012, 0.3, 4), [0.05, 0.16, 0], [0, 0, -0.6]), '#e6e0d0');
  const inkM = new THREE.Mesh(merge([ink, quill]), ctx.mats.vertex);
  inkM.position.set(0.85, 0.97, 0.22);
  g.add(inkM);
  // vela encendida sobre un platillo
  const candle = new THREE.Group();
  candle.add(new THREE.Mesh(merge([prep(xf(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10), [0, 0.01, 0]), '#8a8f9a'), prep(xf(new THREE.CylinderGeometry(0.035, 0.04, 0.17, 8), [0, 0.105, 0]), '#e8dfc4')]), ctx.mats.vertex));
  const f = createFlame(0.12, 0.22, 4.2, 2.6);
  f.position.y = 0.2;
  candle.add(f);
  const halo = haloSprite(0xffb060, 0.6, 0.35);
  halo.position.y = 0.26;
  candle.add(halo);
  candle.position.set(-0.45, 0.97, 0.05);
  g.add(candle);
  ctx.pool.add({ pos: V3(0, 1.4, 0), area: ctx.area, intensity: 4, distance: 5, flicker: 0.22, seed: 7.7 });
  g.userData.candleLight = ctx.pool.all[ctx.pool.all.length - 1];
  ctx.tick.push((_dt, t) => {
    tickFlame(f, t);
    halo.material.opacity = 0.35 * (0.85 + 0.3 * noise1(t * 9, 5));
  });
  shadows(g);
  return g;
}

/** Estante de pared con frascos, libros y un cráneo. El origen está en el centro, pegado a la pared (+z sale del muro). */
export function makeShelf(ctx: BuildCtx, len = 1.7): THREE.Group {
  const g = new THREE.Group();
  const wood: THREE.BufferGeometry[] = [];
  for (const y of [0, 0.62]) wood.push(prep(xf(rb(len, 0.06, 0.4, 0.015), [0, y, 0.2]), '#6b3a22'));
  for (const sx of [-1, 1]) wood.push(prep(xf(rb(0.05, 0.62, 0.4, 0.01), [sx * (len / 2 - 0.03), 0.31, 0.2]), '#5a301c'));
  g.add(new THREE.Mesh(boxUV(merge(wood), 1), ctx.mats.wood));
  const jars = ['#3a7a4a', '#a06a26', '#6a3a86', '#3a5a9a'];
  jars.forEach((c, i) => {
    const j = makeJar(ctx, c, 0.16 + (i % 2) * 0.06);
    j.position.set(-len / 2 + 0.2 + i * 0.21, 0.03, 0.2);
    g.add(j);
  });
  const books = makeBooks(ctx, 3);
  books.position.set(0.45, 0.65, 0.2);
  books.scale.setScalar(0.85);
  g.add(books);
  const skull = makeSkull(ctx, 0.75);
  skull.position.set(-0.3, 0.65, 0.2);
  skull.rotation.y = 0.5;
  g.add(skull);
  const j2 = makeJar(ctx, '#2f6a52', 0.14);
  j2.position.set(0.05, 0.65, 0.22);
  g.add(j2);
  shadows(g);
  return g;
}

/** Cofre de madera con herrajes y un manto azul encima (se pone un cráneo arriba desde afuera). */
export function makeChest(ctx: BuildCtx, x: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const wood: THREE.BufferGeometry[] = [prep(xf(rb(1.25, 0.6, 0.78, 0.05), [0, 0.3, 0]), '#6a3a22'), prep(xf(rb(1.3, 0.22, 0.82, 0.08), [0, 0.68, 0]), '#72402a')];
  const iron: THREE.BufferGeometry[] = [];
  for (const sx of [-0.45, 0.45]) iron.push(prep(xf(rb(0.1, 0.92, 0.84, 0.02), [sx, 0.45, 0]), '#22252d'));
  iron.push(prep(xf(rb(0.14, 0.2, 0.06, 0.01), [0, 0.6, 0.42]), '#8a7a3a'));
  g.add(new THREE.Mesh(boxUV(merge(wood), 0.9), ctx.mats.woodDark));
  g.add(new THREE.Mesh(merge(iron), ctx.mats.iron));
  const cloth = new THREE.Mesh(merge([prep(xf(rb(0.75, 0.06, 0.6, 0.03), [0.2, 0.83, 0], [0, 0.3, 0]), '#1f2a4a'), prep(xf(rb(0.3, 0.3, 0.5, 0.05), [-0.42, 0.72, 0.1], [0.1, 0, 0.35]), '#222f52')]), ctx.mats.cloth);
  g.add(cloth);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  shadows(g);
  ctx.cols.box(x - 0.7, z - 0.5, x + 0.7, z + 0.5);
  return g;
}

/** Cajón abierto con huesos y una calavera pequeña. */
export function makeBoneCrate(ctx: BuildCtx, x: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const w: THREE.BufferGeometry[] = [prep(xf(rb(0.85, 0.06, 0.65, 0.01), [0, 0.03, 0]), '#5a3a22')];
  for (const s of [-1, 1]) {
    w.push(prep(xf(rb(0.06, 0.5, 0.65, 0.01), [s * 0.4, 0.25, 0]), '#6a4426'));
    w.push(prep(xf(rb(0.85, 0.5, 0.06, 0.01), [0, 0.25, s * 0.3]), '#6a4426'));
  }
  g.add(new THREE.Mesh(boxUV(merge(w), 0.9), ctx.mats.wood));
  const bones: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) bones.push(tube([V3(-0.25 + ctx.rnd() * 0.5, 0.14 + i * 0.02, -0.15 + ctx.rnd() * 0.3), V3(-0.25 + ctx.rnd() * 0.5, 0.18 + i * 0.02, -0.15 + ctx.rnd() * 0.3)], () => 0.025, 5, '#e6dbc0'));
  g.add(new THREE.Mesh(merge(bones), ctx.mats.bone));
  const sk = makeSkull(ctx, 0.6);
  sk.position.set(0.05, 0.15, 0.05);
  sk.rotation.y = 2.4;
  g.add(sk);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  shadows(g);
  ctx.cols.box(x - 0.45, z - 0.35, x + 0.45, z + 0.35);
  return g;
}

/** Ataúd azul oscuro sobre un zócalo de piedra, con relleno rojo y un esqueleto acostado; la tapa apoyada al lado. */
export function makeCoffin(ctx: BuildCtx, x: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const stone: THREE.BufferGeometry[] = [prep(xf(rb(2.7, 0.3, 1.3, 0.05), [0, 0.15, 0]), '#9a9ea9'), prep(xf(rb(2.4, 0.12, 1.05, 0.04), [0, 0.36, 0]), '#8d919c')];
  const sg = boxUV(merge(stone), 0.6);
  jitterColor(sg, 0.08, 6);
  g.add(new THREE.Mesh(sg, ctx.mats.stone));
  const shell: THREE.BufferGeometry[] = [];
  const navy = '#262a4a';
  shell.push(prep(xf(rb(2.05, 0.1, 0.78, 0.03), [0, 0.47, 0]), navy));
  for (const s of [-1, 1]) {
    shell.push(prep(xf(rb(2.05, 0.4, 0.09, 0.03), [0, 0.65, s * 0.35]), navy));
    shell.push(prep(xf(rb(0.09, 0.4, 0.78, 0.03), [s * 0.98, 0.65, 0]), navy));
  }
  g.add(new THREE.Mesh(merge(shell), ctx.mats.vertex));
  const cloth = prep(xf(rb(1.85, 0.05, 0.62, 0.02), [0, 0.55, 0]), '#8a2431');
  const pillow = prep(xf(rb(0.42, 0.1, 0.5, 0.04), [-0.72, 0.6, 0]), '#a8323f');
  g.add(new THREE.Mesh(merge([cloth, pillow]), ctx.mats.cloth));
  // esqueleto acostado: cráneo sobre la almohada, costillas, brazos cruzados y piernas
  const bones: THREE.BufferGeometry[] = [];
  bones.push(tube([V3(-0.5, 0.62, 0), V3(0.15, 0.62, 0)], () => 0.02, 5, '#e6dbc0'));
  for (let i = 0; i < 5; i++) bones.push(prep(xf(new THREE.TorusGeometry(0.15 - i * 0.012, 0.012, 4, 10), [-0.42 + i * 0.065, 0.66, 0], [0, Math.PI / 2, 0], [1, 1, 0.9]), '#e6dbc0'));
  bones.push(tube([V3(-0.3, 0.66, -0.16), V3(-0.1, 0.68, 0.0), V3(-0.3, 0.68, 0.14)], () => 0.018, 5, '#e6dbc0'));
  for (const s of [-1, 1]) bones.push(tube([V3(0.2, 0.62, s * 0.08), V3(0.65, 0.62, s * 0.1), V3(0.92, 0.62, s * 0.11)], (t) => 0.025 * (1 - t * 0.3), 5, '#e6dbc0'));
  bones.push(xf(blob(0.1, 1, 0.05, 5, [1.2, 0.6, 1], '#d8cdb0'), [0.15, 0.62, 0]));
  g.add(new THREE.Mesh(merge(bones), ctx.mats.bone));
  const skull = makeSkull(ctx, 0.85);
  skull.position.set(-0.78, 0.6, 0);
  skull.rotation.set(0.25, Math.PI / 2, 0);
  g.add(skull);
  // tapa apoyada contra el zócalo
  const lid = new THREE.Mesh(merge([prep(xf(rb(2.05, 0.09, 0.8, 0.03), [0, 0, 0]), '#2e3358')]), ctx.mats.vertex);
  lid.position.set(0.2, 0.62, 0.95);
  lid.rotation.set(-0.95, 0, 0);
  g.add(lid);
  const c = new THREE.Mesh(merge([prep(xf(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 6), [0, 0.12, 0]), '#c9c2a4'), prep(xf(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), [0, 0.01, 0]), '#8a8f9a')]), ctx.mats.vertex);
  c.position.set(1.12, 0.42, -0.42);
  g.add(c);
  const f = createFlame(0.1, 0.2, 9, 2.4);
  f.position.set(1.12, 0.7, -0.42);
  g.add(f);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  shadows(g);
  ctx.tick.push((_dt, t) => tickFlame(f, t));
  ctx.cols.box(x - 1.45, z - 0.75, x + 1.45, z + 0.75);
  return g;
}

/** Cajón de frutas rojas y verdes (manzanas y pimientos) como el del rincón de la referencia. */
export function makeProduceCrate(ctx: BuildCtx, x: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const w: THREE.BufferGeometry[] = [prep(xf(rb(1.0, 0.06, 0.8, 0.01), [0, 0.03, 0]), '#6a4426')];
  for (const s of [-1, 1]) {
    w.push(prep(xf(rb(0.06, 0.42, 0.8, 0.01), [s * 0.47, 0.21, 0]), '#7a4e2c'));
    w.push(prep(xf(rb(1.0, 0.42, 0.06, 0.01), [0, 0.21, s * 0.37]), '#7a4e2c'));
  }
  g.add(new THREE.Mesh(boxUV(merge(w), 0.9), ctx.mats.wood));
  const fruit: THREE.BufferGeometry[] = [];
  const cols = ['#b32222', '#c93a22', '#3f7a2c', '#a32a26', '#6a8a2c', '#d04a24'];
  for (let i = 0; i < 16; i++) {
    const c = cols[Math.floor(ctx.rnd() * cols.length)];
    fruit.push(xf(blob(0.1 + ctx.rnd() * 0.03, 1, 0.12, i + 1, [1, 0.9, 1], c), [(ctx.rnd() - 0.5) * 0.8, 0.36 + ctx.rnd() * 0.08, (ctx.rnd() - 0.5) * 0.6]));
  }
  g.add(new THREE.Mesh(merge(fruit), ctx.mats.vertex));
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  shadows(g);
  ctx.cols.box(x - 0.55, z - 0.45, x + 0.55, z + 0.45);
  return g;
}

/** Mesita con un caldero negro y una araña. */
export function makeCauldronTable(ctx: BuildCtx, x: number, z: number, yaw = 0): THREE.Group {
  const g = new THREE.Group();
  const w: THREE.BufferGeometry[] = [prep(xf(rb(0.9, 0.08, 0.9, 0.02), [0, 0.7, 0]), '#6a4426')];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.push(prep(xf(rb(0.09, 0.7, 0.09, 0.01), [sx * 0.38, 0.35, sz * 0.38]), '#4e2c1a'));
  g.add(new THREE.Mesh(boxUV(merge(w), 0.9), ctx.mats.wood));
  const pot = new THREE.Mesh(merge([prep(xf(new THREE.SphereGeometry(0.26, 12, 10, 0, 6.3, 0.35, 2.4), [0, 0.98, 0]), '#16171c'), prep(xf(new THREE.TorusGeometry(0.22, 0.03, 5, 12), [0, 1.14, 0], [Math.PI / 2, 0, 0]), '#23252c')]), ctx.mats.iron);
  g.add(pot);
  const spider = new THREE.Mesh(merge([xf(blob(0.04, 1, 0.05, 2, [1, 0.7, 1.2], '#0a0a0e'), [0.3, 0.78, 0.05]), ...[-1, 1].flatMap((s) => [0, 1, 2].map((i) => tube([V3(0.3, 0.78, 0.05), V3(0.3 + s * 0.06, 0.82, 0.03 + i * 0.03 - 0.03), V3(0.3 + s * 0.11, 0.78, 0.0 + i * 0.05 - 0.05)], () => 0.004, 3, '#0a0a0e')))]), ctx.mats.vertex);
  g.add(spider);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  shadows(g);
  ctx.cols.box(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
  return g;
}
