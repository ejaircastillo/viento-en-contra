import * as THREE from 'three';

/**
 * Partículas como quads instanciados que miran a la cámara (sin el tope de tamaño de los Points): humo,
 * brasas, hojas, destellos. La simulación corre en CPU (son pocas decenas), y con mezcla normal se ordenan
 * de atrás hacia adelante cada cuadro para que el humo no "salte".
 */
export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size0: number;
  size1: number;
  rot: number;
  spin: number;
  /** Color de salida; se interpola hacia `c1` con la edad. */
  c0: THREE.Color;
  c1: THREE.Color;
  peak: number;
  /** Datos propios del emisor (fase del vaivén, etc.). */
  a: number;
  b: number;
}

export interface ParticleOpts {
  max: number;
  map: THREE.Texture;
  additive?: boolean;
  sort?: boolean;
  /** Se ejecuta por partícula y cuadro (gravedad, turbulencia). */
  step?: (p: Particle, dt: number, time: number) => void;
}

const VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec4 aData;
  attribute vec3 aColor;
  varying vec2 vUv;
  varying vec4 vCol;
  void main() {
    vUv = uv;
    vCol = vec4(aColor, aData.z);
    vec4 mv = viewMatrix * modelMatrix * vec4(aPos, 1.0);
    float c = cos(aData.y);
    float s = sin(aData.y);
    vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aData.x;
    mv.xy += p;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec4 vCol;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    float a = t.a * vCol.a;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vCol.rgb * t.rgb, a);
  }
`;

export class Particles {
  readonly mesh: THREE.Mesh;
  readonly list: Particle[] = [];
  private geo: THREE.InstancedBufferGeometry;
  private aPos: THREE.InstancedBufferAttribute;
  private aData: THREE.InstancedBufferAttribute;
  private aColor: THREE.InstancedBufferAttribute;
  private order: number[] = [];
  private tmp = new THREE.Color();

  constructor(private opts: ParticleOpts) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(opts.max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(opts.max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(opts.max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aPos', this.aPos);
    this.geo.setAttribute('aData', this.aData);
    this.geo.setAttribute('aColor', this.aColor);
    this.geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMap: { value: opts.map } },
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.additive ? 5 : 3;
  }

  get count(): number {
    return this.list.length;
  }

  get full(): boolean {
    return this.list.length >= this.opts.max;
  }

  /** Crea una partícula (o nada si el pozo está lleno); `init` la configura. */
  spawn(init: (p: Particle) => void): Particle | null {
    if (this.full) return null;
    const p: Particle = {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 2, size0: 0.2, size1: 0.4, rot: 0, spin: 0,
      c0: new THREE.Color(1, 1, 1), c1: new THREE.Color(1, 1, 1), peak: 1, a: 0, b: 0,
    };
    init(p);
    this.list.push(p);
    return p;
  }

  clear(): void {
    this.list.length = 0;
    this.geo.instanceCount = 0;
  }

  update(dt: number, time: number, camera: THREE.Camera): void {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.age += dt;
      if (p.age >= p.life) {
        l.splice(i, 1);
        continue;
      }
      this.opts.step?.(p, dt, time);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;
    }
    const n = l.length;
    this.order.length = n;
    for (let i = 0; i < n; i++) this.order[i] = i;
    if (this.opts.sort && n > 1) {
      const cam = camera.position;
      const d = l.map((p) => (p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 + (p.z - cam.z) ** 2);
      this.order.sort((a, b) => d[b] - d[a]);
    }
    for (let k = 0; k < n; k++) {
      const p = l[this.order[k]];
      const t = p.age / p.life;
      // entra rápido (primer 15 %) y sale suave (último 60 %)
      const fade = Math.min(1, t / 0.15) * (1 - Math.max(0, (t - 0.4) / 0.6) ** 1.3);
      this.tmp.copy(p.c0).lerp(p.c1, Math.min(1, t * 1.4));
      this.aPos.setXYZ(k, p.x, p.y, p.z);
      this.aData.setXYZW(k, p.size0 + (p.size1 - p.size0) * Math.sqrt(t), p.rot, p.peak * Math.max(0, fade), 0);
      this.aColor.setXYZ(k, this.tmp.r, this.tmp.g, this.tmp.b);
    }
    this.geo.instanceCount = n;
    this.aPos.needsUpdate = true;
    this.aData.needsUpdate = true;
    this.aColor.needsUpdate = true;
  }
}
