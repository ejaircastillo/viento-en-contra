import * as THREE from 'three';
import type { Materials } from '../gfx/materials';
import { GroundPainter } from '../gfx/textures';
import { smoothstep } from '../core/noise';

/**
 * Plano del cementerio (datos): tamaño del terreno, caminos, losas de piedra y puntos importantes. El mundo
 * se dibuja a partir de esto: el suelo pintado, el pasto (que esquiva los caminos) y la colocación de props.
 * Coordenadas del mundo: +x y +z se ven hacia abajo de la pantalla (la cámara mira desde el sureste).
 */
export const LAND = { w: 44, d: 32 };
export const CAMP = { x: 9.2, z: 3.6 };
export const CRYPT = { x: 2.6, z: -11.4 };
export const START = { x: -1, z: 1.2 };

export const PATHS: { pts: [number, number][]; w: number }[] = [
  { pts: [[-1, 1.2], [3, 1.8], [7, 2.9], [9.4, 3.5]], w: 1.9 },
  { pts: [[-1, 1.2], [-0.7, -3], [0.7, -6.4], [2.6, -8.3]], w: 1.9 },
  { pts: [[-1, 1.2], [-4, 2.7], [-7.4, 5.2], [-9.1, 7.2]], w: 1.7 },
  { pts: [[2.6, -8.3], [7, -8.6], [12, -6.6], [15, -2], [14.6, 3], [12.2, 5.8]], w: 1.7 },
  { pts: [[-0.7, -3], [-4, -5], [-8, -6.1], [-12, -5.8]], w: 1.5 },
];

/** Losas de piedra redondeada: [x, z, radioX, radioZ, tamaño de piedra]. */
export const PADS: [number, number, number, number, number][] = [
  [-2.6, 0.2, 1.2, 0.95, 0.3],
  [0.9, 2.5, 1.05, 0.85, 0.3],
  [CAMP.x, CAMP.z, 3.1, 2.7, 0.34],
  [2.6, -7.6, 2.6, 1.3, 0.32],
  [-9.4, 8.4, 1.6, 1.2, 0.3],
];

/** Distancia del punto a una polilínea (en unidades). */
export function distToPolyline(x: number, z: number, pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/** Distancia al borde del camino más cercano (negativa adentro). */
export function pathEdgeDistance(x: number, z: number): number {
  let best = Infinity;
  for (const p of PATHS) best = Math.min(best, distToPolyline(x, z, p.pts) - p.w / 2);
  return best;
}

/** ¿Cae sobre una losa de piedra? (devuelve cuánto adentro: 0 afuera, 1 en el centro) */
export function padInside(x: number, z: number): number {
  let best = 0;
  for (const [cx, cz, rx, rz] of PADS) {
    const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
    best = Math.max(best, 1 - d);
  }
  return Math.max(0, best);
}

/** Densidad 0..1 del pasto: cero sobre caminos y losas, plena a partir de un metro. */
export function grassFree(x: number, z: number): number {
  return smoothstep(0.1, 1.1, pathEdgeDistance(x, z)) * (1 - smoothstep(-0.25, 0.25, padInside(x, z)));
}

/** Pinta el suelo: pasto, caminos de tierra, losas, hojas caídas y borde oscuro. */
export function paintGraveyardGround(quality: { id: string }): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const px = quality.id === 'low' ? 34 : 46;
  const g = new GroundPainter(LAND.w, LAND.d, px, 3);
  g.paintGrass();
  for (const p of PATHS) g.path(p.pts, p.w);
  for (const [cx, cz, rx, rz, s] of PADS) g.pad(cx, cz, rx, rz, s);
  g.leaves(1700);
  g.edgeFade(2.6, 0.85);
  return g.textures();
}

/** Material del terreno: albedo + relieve + un ruido de detalle que evita el aspecto liso. */
export function groundMaterial(mats: Materials, tex: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bump, bumpScale: 1.6, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: mats.detail };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  vec3 gDetail = texture2D(uDetail, vMapUv * vec2(44.0, 32.0) * 0.6).rgb;\n  diffuseColor.rgb *= 0.6 + 0.8 * gDetail.r;');
  };
  return m;
}

/** Terreno: una placa con el suelo pintado y un bloque oscuro debajo (el "corte" del diorama flotante). */
export function buildLand(mats: Materials, quality: { id: string }): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.PlaneGeometry(LAND.w, LAND.d), groundMaterial(mats, paintGraveyardGround(quality)));
  top.rotation.x = -Math.PI / 2;
  top.receiveShadow = true;
  g.add(top);
  const body = new THREE.Mesh(new THREE.BoxGeometry(LAND.w, 3.2, LAND.d), new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 1 }));
  body.position.y = -1.62;
  g.add(body);
  return g;
}
