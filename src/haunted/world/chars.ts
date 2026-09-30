import * as THREE from 'three';
import type { BuildCtx } from './ctx';
import { shadows } from './ctx';
import { V3, blob, jitterColor, merge, prep, tube, xf } from '../gfx/geom';
import { damp, noise1 } from '../core/noise';

/**
 * Personajes del mundo, armados con blobs y tubos (sin rig): el esqueleto sentado junto al fuego, la perrita
 * fantasma de nubes y (más abajo) el duende escribano de la cripta y un cuervo. Cada constructor devuelve
 * el grupo y una función `update` que anima cabeza, cola, flote, etc.
 */
export interface Actor {
  group: THREE.Group;
  update: (dt: number, t: number, talking: boolean) => void;
  /** Hueso o parte que mira al fantasma cuando está cerca. */
  head?: THREE.Object3D;
}

const BONE = '#e9dec2';
const BONE_DARK = '#b8ab8c';

/** Esqueleto caricaturesco sentado de cara a +Z local (cráneo grande, costillas de aros). */
export function makeSkeleton(ctx: BuildCtx): Actor {
  const { mats } = ctx;
  const bones: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const limb = (pts: THREE.Vector3[], r = 0.028) => tube(pts, (t) => r * (1 - t * 0.25), 5, BONE);
  // pelvis, columna y costillas
  bones.push(xf(blob(0.13, 1, 0.06, 2, [1.25, 0.6, 0.85], BONE_DARK), [0, 0.56, 0]));
  bones.push(limb([V3(0, 0.6, 0), V3(0, 0.8, 0.02), V3(0, 1.0, 0.05)], 0.024));
  for (let i = 0; i < 5; i++) {
    const r = 0.145 - i * 0.012;
    const ring = new THREE.TorusGeometry(r, 0.013, 4, 12);
    bones.push(prep(xf(ring, [0, 0.72 + i * 0.06, 0.03], [Math.PI / 2, 0, 0], [1, 0.72, 1]), BONE));
  }
  bones.push(prep(xf(new THREE.BoxGeometry(0.03, 0.3, 0.02), [0, 0.86, 0.12]), BONE_DARK));
  bones.push(limb([V3(-0.15, 1.02, 0.04), V3(0, 1.04, 0.08), V3(0.15, 1.02, 0.04)], 0.018));
  // brazos: manos apoyadas en las rodillas
  for (const s of [-1, 1]) {
    bones.push(limb([V3(s * 0.15, 1.0, 0.04), V3(s * 0.22, 0.82, 0.1), V3(s * 0.2, 0.66, 0.3), V3(s * 0.17, 0.66, 0.4)], 0.022));
    bones.push(xf(blob(0.04, 1, 0.1, 3, [1.3, 0.6, 1], BONE), [s * 0.17, 0.66, 0.42]));
  }
  // piernas: muslo hacia adelante, canilla hacia abajo, pie
  for (const s of [-1, 1]) {
    bones.push(limb([V3(s * 0.08, 0.56, 0), V3(s * 0.09, 0.57, 0.22), V3(s * 0.1, 0.56, 0.42)], 0.034));
    bones.push(limb([V3(s * 0.1, 0.56, 0.42), V3(s * 0.1, 0.3, 0.44), V3(s * 0.1, 0.05, 0.46)], 0.03));
    bones.push(prep(xf(new THREE.BoxGeometry(0.08, 0.04, 0.17), [s * 0.1, 0.03, 0.52]), BONE_DARK));
  }
  const body = merge(bones);
  jitterColor(body, 0.05, 11);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body, mats.bone));

  // cabeza: cráneo grande, mandíbula, cuencas y nariz (pivota en el cuello)
  const head = new THREE.Group();
  head.position.set(0, 1.08, 0.05);
  const skull = blob(0.25, 2, 0.035, 5, [1, 1, 1.05], BONE);
  const jaw = xf(blob(0.13, 1, 0.05, 6, [1.05, 0.55, 0.9], BONE_DARK), [0, -0.14, 0.1]);
  head.add(new THREE.Mesh(merge([xf(skull, [0, 0.2, 0.04]), jaw]), mats.bone));
  const black = new THREE.MeshBasicMaterial({ color: 0x07060a, toneMapped: false });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), black);
    eye.scale.set(1, 1.15, 0.45);
    eye.position.set(s * 0.09, 0.22, 0.27);
    head.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.045, 3), black);
  nose.position.set(0, 0.13, 0.285);
  nose.rotation.x = Math.PI;
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.01), black);
  mouth.position.set(0, -0.055, 0.225);
  head.add(mouth);
  g.add(head);
  void dark;
  shadows(g);

  let talk = 0;
  return {
    group: g,
    head,
    update: (dt, t, talking) => {
      talk = damp(talk, talking ? 1 : 0, 8, dt);
      head.rotation.z = Math.sin(t * 0.9) * 0.05;
      head.rotation.x = Math.sin(t * 1.3 + 1) * 0.03 + talk * Math.sin(t * 14) * 0.07;
      head.rotation.y = Math.sin(t * 0.45) * 0.12;
      mouth.scale.y = 1 + talk * Math.abs(Math.sin(t * 13)) * 6;
    },
  };
}

let furMat: THREE.MeshStandardMaterial | null = null;
const fur = () =>
  (furMat ??= new THREE.MeshStandardMaterial({ color: 0xf2f5ff, emissive: 0x27344f, emissiveIntensity: 0.8, roughness: 1, vertexColors: true, transparent: true, opacity: 0.93 }));

/**
 * La perrita fantasma: un perro hecho de nubes blancas (blobs facetados) que flota apenas sobre el piso,
 * mueve la cola y las orejas, y de vez en cuando suelta una ventosidad (un chiste de la casa: "hija del viento").
 */
export function makeDogSpirit(ctx: BuildCtx): Actor & { facing: number; puff: (() => void) | null } {
  const c = '#ffffff';
  const parts: THREE.BufferGeometry[] = [];
  parts.push(xf(blob(0.3, 1, 0.14, 1, [1.5, 0.95, 1.0], c), [0, 0.38, 0]));
  parts.push(xf(blob(0.25, 1, 0.14, 2, [1, 1, 1], c), [0.25, 0.42, 0]));
  for (const [x, z] of [[0.24, 0.15], [0.24, -0.15], [-0.22, 0.15], [-0.22, -0.15]] as const) parts.push(xf(blob(0.1, 1, 0.1, 3, [0.75, 1.6, 0.75], c), [x, 0.13, z]));
  const body = merge(parts);
  const headParts: THREE.BufferGeometry[] = [];
  headParts.push(xf(blob(0.2, 1, 0.12, 4, [1, 1, 1], c), [0, 0, 0]));
  headParts.push(xf(blob(0.11, 1, 0.08, 5, [1.4, 0.8, 1], c), [0.17, -0.06, 0]));
  const earL = xf(blob(0.085, 1, 0.08, 6, [0.6, 1.4, 0.9], c), [-0.02, 0.17, 0.16], [0.4, 0, -0.2]);
  const earR = xf(blob(0.085, 1, 0.08, 7, [0.6, 1.4, 0.9], c), [-0.02, 0.17, -0.16], [-0.4, 0, -0.2]);
  headParts.push(earL, earR);
  const g = new THREE.Group();
  const bodyMesh = new THREE.Mesh(body, fur());
  g.add(bodyMesh);
  const head = new THREE.Group();
  head.position.set(0.44, 0.6, 0);
  head.add(new THREE.Mesh(merge(headParts), fur()));
  const black = new THREE.MeshBasicMaterial({ color: 0x08090d, toneMapped: false });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), black);
  nose.position.set(0.285, -0.03, 0);
  head.add(nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), black);
    eye.position.set(0.17, 0.05, s * 0.09);
    head.add(eye);
  }
  g.add(head);
  const tail = new THREE.Group();
  tail.position.set(-0.4, 0.5, 0);
  tail.add(new THREE.Mesh(merge([xf(blob(0.09, 1, 0.1, 8, [1.6, 0.8, 0.8], c), [-0.08, 0.04, 0]), xf(blob(0.07, 1, 0.1, 9, [1.3, 0.8, 0.8], c), [-0.2, 0.12, 0])]), fur()));
  g.add(tail);
  const a: Actor & { facing: number; puff: (() => void) | null } = {
    group: g,
    head,
    facing: 0,
    puff: null,
    update: (dt, t, talking) => {
      g.position.y = 0.1 + Math.sin(t * 2.1) * 0.05;
      tail.rotation.y = Math.sin(t * (talking ? 14 : 7)) * 0.55;
      head.rotation.z = Math.sin(t * 1.7) * 0.06 + (talking ? Math.sin(t * 9) * 0.05 : 0);
      bodyMesh.scale.y = 1 + Math.sin(t * 2.1 + 1) * 0.02;
    },
  };
  shadows(g, true, false);
  return a;
}

/** Duende escribano (Lutin): orejas puntiagudas, gorro rojo con cascabel, calzas a rayas, pluma en la mano. */
export function makeLutin(ctx: BuildCtx): Actor {
  const skin = '#7d9444';
  const red = '#a3202b';
  const green = '#2f7a3a';
  const parts: THREE.BufferGeometry[] = [];
  // torso y piernas sentadas en el borde de la mesa (la cadera está en y = 0)
  parts.push(xf(blob(0.17, 1, 0.08, 1, [1, 1.2, 0.85], red), [0, 0.2, 0]));
  parts.push(xf(blob(0.13, 1, 0.06, 2, [1.1, 0.7, 0.9], '#5a1219'), [0, 0.02, 0]));
  for (const s of [-1, 1]) {
    const leg = tube([V3(s * 0.07, 0.0, 0.05), V3(s * 0.08, 0.0, 0.25), V3(s * 0.08, -0.26, 0.3)], () => 0.05, 6, (_x, y, z) => ((Math.floor((y + z) * 13) & 1) === 0 ? red : green));
    parts.push(leg);
    parts.push(xf(blob(0.065, 1, 0.1, 4 + s, [1.5, 0.8, 1], '#3b2a1c'), [s * 0.08, -0.3, 0.36]));
    parts.push(tube([V3(s * 0.15, 0.3, 0.02), V3(s * 0.23, 0.15, 0.12), V3(s * 0.16, 0.08, 0.26)], () => 0.038, 5, red));
    parts.push(xf(blob(0.04, 1, 0.1, 6 + s, [1, 1, 1], skin), [s * 0.16, 0.08, 0.28]));
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts), ctx.mats.vertex));
  // cabeza
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0.03);
  const hp: THREE.BufferGeometry[] = [];
  hp.push(xf(blob(0.17, 2, 0.06, 10, [1, 1.05, 1], skin), [0, 0.05, 0]));
  hp.push(xf(new THREE.ConeGeometry(0.055, 0.22, 6), [-0.2, 0.08, 0], [0, 0, 1.2], 1));
  hp.push(xf(new THREE.ConeGeometry(0.055, 0.22, 6), [0.2, 0.08, 0], [0, 0, -1.2], 1));
  hp.push(xf(new THREE.ConeGeometry(0.03, 0.09, 5), [0, 0.03, 0.17], [1.7, 0, 0], 1));
  const hat = [xf(new THREE.ConeGeometry(0.19, 0.42, 8), [0, 0.3, -0.02], [0.25, 0, 0]), xf(new THREE.TorusGeometry(0.17, 0.035, 5, 12), [0, 0.15, 0], [Math.PI / 2, 0, 0])];
  head.add(new THREE.Mesh(merge(hp.map((x) => prep(x, skin))), ctx.mats.vertex));
  head.add(new THREE.Mesh(merge([prep(hat[0], red), prep(hat[1], green)]), ctx.mats.vertex));
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe0b24a, metalness: 0.6, roughness: 0.4 }));
  bell.position.set(0, 0.5, -0.09);
  head.add(bell);
  const black = new THREE.MeshBasicMaterial({ color: 0x0b0a08, toneMapped: false });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), black);
    eye.scale.set(1, 1.3, 0.6);
    eye.position.set(s * 0.065, 0.08, 0.155);
    head.add(eye);
  }
  g.add(head);
  shadows(g);
  return {
    group: g,
    head,
    update: (dt, t, talking) => {
      head.rotation.z = Math.sin(t * 1.1) * 0.06;
      head.rotation.x = 0.12 + Math.sin(t * 1.6) * 0.04 + (talking ? Math.sin(t * 12) * 0.06 : 0);
      bell.position.x = Math.sin(t * 3) * 0.02;
      g.rotation.z = Math.sin(t * 0.8) * 0.015;
    },
  };
}

/** Cuervo: cuerpo, cabeza, pico y cola; salta un poquito y se espanta cuando el fantasma se acerca. */
export function makeCrow(ctx: BuildCtx): Actor {
  const dark = '#14161b';
  const parts = [
    xf(blob(0.12, 1, 0.06, 1, [1.4, 0.95, 0.9], dark), [0, 0.15, 0]),
    xf(blob(0.075, 1, 0.05, 2, [1, 1, 1], dark), [0.14, 0.24, 0]),
    xf(new THREE.ConeGeometry(0.025, 0.09, 4), [0.23, 0.23, 0], [0, 0, -Math.PI / 2], 1),
    xf(new THREE.ConeGeometry(0.05, 0.16, 4), [-0.2, 0.15, 0], [0, 0, Math.PI / 2 + 0.3], 1),
  ];
  parts[2] = prep(parts[2], '#d7a33c');
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts.map((p, i) => (i === 2 ? p : prep(p, dark)))), ctx.mats.vertex));
  shadows(g, true, false);
  return {
    group: g,
    update: (dt, t) => {
      const hop = Math.max(0, Math.sin(t * 2.4 + 2)) ** 6;
      g.position.y = hop * 0.12;
      g.rotation.z = Math.sin(t * 5) * 0.03 * hop;
      g.rotation.x = Math.sin(t * 0.7) * 0.05 + noise1(t, 4) * 0.02;
    },
  };
}
