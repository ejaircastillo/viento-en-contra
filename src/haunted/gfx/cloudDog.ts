import * as THREE from 'three';
import { MOON_DIR } from './sky';

/**
 * Perrita de nube: un volumen con forma vagamente perruna (campo de distancias con ruido) que se recorre con
 * raymarching dentro de una caja, como el perro de la referencia (técnica de nubes de Horizon: Forbidden West).
 * La luz de la luna llega por una muestra hacia la luna (autosombra) y el resultado se compone con alfa
 * premultiplicado. El perro mira hacia +x en su espacio local.
 */
const VERT = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vCam;
  void main() {
    vObj = position;
    vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLight;   // hacia la luna, en espacio local
  uniform vec4 uAnim;    // x: cola, y: cabeza, z: rebote, w: habla
  uniform vec3 uTint;
  varying vec3 vObj;
  varying vec3 vCam;

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float capsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a; vec3 ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r; }
  float ellipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
  float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }

  float dog(vec3 p) {
    p.y -= uAnim.z;
    float d = ellipsoid(p - vec3(0.0, 0.42, 0.0), vec3(0.42, 0.27, 0.27));
    d = smin(d, ellipsoid(p - vec3(0.27, 0.47, 0.0), vec3(0.23, 0.24, 0.22)), 0.12);
    vec3 h = p - vec3(0.44, 0.6, 0.0);
    float c = cos(uAnim.y); float s = sin(uAnim.y);
    h.xy = vec2(c * h.x + s * h.y, -s * h.x + c * h.y);
    float hd = length(h) - 0.2;
    hd = smin(hd, capsule(h, vec3(0.1, -0.06, 0.0), vec3(0.24, -0.07, 0.0), 0.085), 0.08);
    hd = smin(hd, ellipsoid(h - vec3(-0.03, 0.17, 0.14), vec3(0.06, 0.13, 0.07)), 0.05);
    hd = smin(hd, ellipsoid(h - vec3(-0.03, 0.17, -0.14), vec3(0.06, 0.13, 0.07)), 0.05);
    d = smin(d, hd, 0.1);
    for (int i = 0; i < 4; i++) {
      float lx = (i < 2) ? 0.24 : -0.22; float lz = (mod(float(i), 2.0) < 1.0) ? 0.14 : -0.14;
      d = smin(d, capsule(p, vec3(lx, 0.3, lz), vec3(lx, 0.03, lz), 0.085), 0.1);
    }
    vec3 t = p - vec3(-0.4, 0.5, 0.0);
    float tc = cos(uAnim.x); float ts = sin(uAnim.x);
    t.xz = vec2(tc * t.x - ts * t.z, ts * t.x + tc * t.z);
    d = smin(d, capsule(t, vec3(0.0), vec3(-0.12, 0.09, 0.0), 0.06), 0.07);
    d = smin(d, capsule(t, vec3(-0.12, 0.09, 0.0), vec3(-0.22, 0.2, 0.0), 0.045), 0.07);
    return d;
  }

  float density(vec3 p) {
    float d = dog(p);
    if (d > 0.22) return 0.0;
    float n = noise(p * 5.0 + vec3(0.0, -uTime * 0.3, 0.0)) * 0.65 + noise(p * 11.0 - vec3(uTime * 0.2)) * 0.35;
    return clamp((-d + (n - 0.5) * 0.15) * 10.0, 0.0, 1.0);
  }

  void main() {
    vec3 ro = vCam;
    vec3 rd = normalize(vObj - vCam);
    vec3 bmin = vec3(-0.85, -0.05, -0.5);
    vec3 bmax = vec3(1.0, 1.25, 0.5);
    vec3 inv = 1.0 / rd;
    vec3 t0 = (bmin - ro) * inv; vec3 t1 = (bmax - ro) * inv;
    vec3 tmin = min(t0, t1); vec3 tmax = max(t0, t1);
    float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
    float tf = min(min(tmax.x, tmax.y), tmax.z);
    if (tf <= tn) discard;
    const int STEPS = 24;
    float dt = (tf - tn) / float(STEPS);
    float t = tn + dt * hash(vec3(gl_FragCoord.xy, uTime));
    float T = 1.0;
    vec3 col = vec3(0.0);
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * t;
      float dens = density(p);
      if (dens > 0.02) {
        float sh = density(p + uLight * 0.14);
        vec3 lit = uTint * (0.42 + 0.95 * exp(-sh * 2.4));
        float a = 1.0 - exp(-dens * dt * 16.0);
        col += T * a * lit;
        T *= 1.0 - a;
        if (T < 0.03) break;
      }
      t += dt;
    }
    gl_FragColor = vec4(col, 1.0 - T);
  }
`;

export interface CloudDog {
  mesh: THREE.Mesh;
  /** Cada cuadro: tiempo, cola (rad), inclinación de la cabeza (rad), respiración (m) y giro del perro (rad, eje y). */
  update: (t: number, tail: number, head: number, breath: number, yaw: number) => void;
}

export function makeCloudDog(): CloudDog {
  const geo = new THREE.BoxGeometry(1.85, 1.3, 1.0);
  geo.translate(0.075, 0.6, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uLight: { value: new THREE.Vector3() },
      uAnim: { value: new THREE.Vector4() },
      uTint: { value: new THREE.Color(0.62, 0.72, 0.95) },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // el contorno naranja usa la silueta del perro de baja resolución (el volumen no entra en ese pase)
  mesh.userData.noOutline = true;
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const u = mat.uniforms;
  return {
    mesh,
    update: (t, tail, head, breath, yaw) => {
      u.uTime.value = t;
      u.uLight.value.copy(MOON_DIR).applyQuaternion(q.setFromAxisAngle(up, -yaw));
      u.uAnim.value.set(tail, head, breath, 0);
    },
  };
}
