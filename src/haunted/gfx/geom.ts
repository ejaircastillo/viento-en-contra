import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, rng } from '../core/noise';

/**
 * Utilidades de geometría low-poly: mezcla de mallas con color por vértice (un solo dibujo por prop),
 * blobs ruidosos para follaje y pelaje, tubos ahusados para ramas, hojas de pasto, lápidas redondeadas.
 * Todo produce `BufferGeometry` sin indexar (caras planas = estética low-poly) con atributo `color`.
 */

export type ColorFn = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => THREE.ColorRepresentation;

/** Garantiza que la geometría tenga uv, normal y color; la deja sin índice para poder mezclarla con otras. */
export function prep(geo: THREE.BufferGeometry, color?: THREE.ColorRepresentation | ColorFn): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g === geo) g = geo.clone();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const col = new Float32Array(n * 3);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    if (typeof color === 'function') c.set(color(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i)));
    else c.set(color ?? 0xffffff);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Une varias geometrías preparadas en una sola. */
export function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(
    list.map((x) => (x.getAttribute('color') && !x.index ? x : prep(x))),
    false,
  );
  if (!g) throw new Error('[geom] no se pudieron mezclar las geometrías');
  return g;
}

/** Copia con transformación aplicada (posición, rotación Euler, escala). */
export function xf(geo: THREE.BufferGeometry, pos: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], scale: number | [number, number, number] = 1): THREE.BufferGeometry {
  const g = geo.clone();
  const s = typeof scale === 'number' ? ([scale, scale, scale] as const) : scale;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...s));
  g.applyMatrix4(m);
  return g;
}

/** Multiplica el color de cada vértice según la altura (oscurece la base: "oclusión" pintada). */
export function aoBottom(geo: THREE.BufferGeometry, y0: number, y1: number, dark = 0.55): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) - y0) / (y1 - y0), 0, 1);
    const k = dark + (1 - dark) * t;
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  return geo;
}

/** Variación de color por cara (se ve "pintado a mano" y facetado). */
export function jitterColor(geo: THREE.BufferGeometry, amount = 0.12, seed = 1): THREE.BufferGeometry {
  const r = rng(seed);
  const col = geo.getAttribute('color');
  for (let i = 0; i + 2 < col.count; i += 3) {
    const k = 1 + (r() - 0.5) * 2 * amount;
    for (let j = 0; j < 3; j++) col.setXYZ(i + j, col.getX(i + j) * k, col.getY(i + j) * k, col.getZ(i + j) * k);
  }
  return geo;
}

/** Esfera facetada con la superficie ondulada por ruido: arbustos, copas, pelaje, cabezas. */
export function blob(radius: number, detail = 1, amp = 0.25, seed = 1, squash: [number, number, number] = [1, 1, 1], color?: THREE.ColorRepresentation | ColorFn): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.7 + 11, v.y * 1.7 + v.z * 1.3 + 7, 3, seed) - 0.5;
    const k = 1 + n * 2 * amp;
    p.setXYZ(i, v.x * k * squash[0], v.y * k * squash[1], v.z * k * squash[2]);
  }
  g.computeVertexNormals();
  return prep(g, color);
}

export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Tubo ahusado siguiendo una polilínea (ramas, patas, raíces). `radius(t)` con t en [0,1]. */
export function tube(points: THREE.Vector3[], radius: (t: number) => number, radial = 6, color?: THREE.ColorRepresentation | ColorFn): THREE.BufferGeometry {
  const n = points.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    tan.copy(b).sub(a).normalize();
    const ref = Math.abs(tan.dot(up)) > 0.95 ? new THREE.Vector3(1, 0, 0) : up;
    const side = new THREE.Vector3().crossVectors(tan, ref).normalize();
    const fwd = new THREE.Vector3().crossVectors(side, tan).normalize();
    const r = radius(i / (n - 1));
    for (let k = 0; k < radial; k++) {
      const ang = (k / radial) * Math.PI * 2;
      const c = Math.cos(ang) * r;
      const s = Math.sin(ang) * r;
      pos.push(points[i].x + side.x * c + fwd.x * s, points[i].y + side.y * c + fwd.y * s, points[i].z + side.z * c + fwd.z * s);
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k;
      const b = i * radial + ((k + 1) % radial);
      const c = (i + 1) * radial + k;
      const d = (i + 1) * radial + ((k + 1) % radial);
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return prep(flat, color);
}

/** Hoja de pasto: tira de triángulos curvada que termina en punta, con la base en y = 0 (sin índice, con color). */
export function bladeGeometry(height = 1, width = 0.08, bend = 0.25, segments = 3): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = t * height;
    const z = bend * t * t * height;
    const w = width * (1 - t * t * 0.96) * 0.5;
    pos.push(-w, y, z, w, y, z);
    if (i < segments) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  // color por altura: base oscura, punta clara (el color final lo da el material × el color por instancia)
  return prep(flat, (_x, y) => new THREE.Color().setScalar(0.62 + 0.55 * THREE.MathUtils.clamp(y / height, 0, 1)));
}

/** Perfil de lápida: base recta y tope redondeado / en punta / recto; extruido con bisel suave. */
export function tombstoneGeometry(w = 0.8, h = 1.1, d = 0.22, top: 'round' | 'cross' | 'pointed' = 'round'): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const hw = w / 2;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  if (top === 'round') {
    s.lineTo(hw, h - hw);
    s.absarc(0, h - hw, hw, 0, Math.PI, false);
  } else if (top === 'pointed') {
    s.lineTo(hw, h - hw * 0.9);
    s.lineTo(0, h);
    s.lineTo(-hw, h - hw * 0.9);
  } else {
    s.lineTo(hw, h);
    s.lineTo(-hw, h);
  }
  s.lineTo(-hw, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -d / 2);
  return g;
}

/**
 * UV por proyección en caja (según la normal de cada cara): la textura queda con la misma densidad en todas
 * las caras sin importar la forma. `scale` = repeticiones por unidad del mundo. Hay que llamarla con la
 * geometría ya transformada y sin índice.
 */
export function boxUV(geo: THREE.BufferGeometry, scale = 0.5): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else if (ax >= az) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
