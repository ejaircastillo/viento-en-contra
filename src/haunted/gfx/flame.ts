import * as THREE from 'three';

/**
 * Llama procedural: un plano que siempre mira a la cámara (en cilindro, alrededor del eje vertical) y un
 * fragment shader que dibuja la forma con ruido animado, del blanco amarillento del núcleo al naranja/rojo
 * de las puntas. Se mezcla de forma aditiva con valores > 1 para que el bloom la haga brillar.
 */
const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uScale;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 toCam = cameraPosition - center;
    toCam.y = 0.0;
    toCam = normalize(toCam + vec3(1e-4));
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
    float h = position.y + 0.5;
    float sway = sin(uTime * 7.0 + uSeed + h * 3.0) * 0.07 + sin(uTime * 11.3 + uSeed * 2.0) * 0.04;
    vec3 wp = center + right * (position.x * uScale.x + sway * uScale.x * h * h) + vec3(0.0, 1.0, 0.0) * h * uScale.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 2.6 + uSeed;
    float n = vnoise(vec2(uv.x * 4.0 + uSeed, uv.y * 2.6 - t)) * 0.65 + vnoise(vec2(uv.x * 9.0 - uSeed, uv.y * 5.0 - t * 1.7)) * 0.35;
    float w = mix(0.42, 0.04, pow(uv.y, 0.75));
    float d = abs(uv.x - 0.5) / w;
    float shape = 1.0 - smoothstep(0.55, 1.0, d + (n - 0.5) * 0.9);
    shape *= smoothstep(1.0, 0.45, uv.y + (n - 0.5) * 0.45);
    shape *= smoothstep(0.0, 0.08, uv.y);
    float core = pow(clamp(shape, 0.0, 1.0), 2.2);
    vec3 col = mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.62, 0.14), clamp(core * 1.6, 0.0, 1.0));
    col = mix(col, vec3(1.0, 0.93, 0.7), pow(core, 3.0));
    gl_FragColor = vec4(col * uIntensity, shape);
  }
`;

export function createFlame(width = 0.6, height = 1, seed = 0, intensity = 2.2): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: new THREE.Vector2(width, height) },
      uSeed: { value: seed },
      uIntensity: { value: intensity },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.frustumCulled = false;
  m.renderOrder = 4;
  return m;
}

/** Hay que llamarla cada cuadro con el tiempo global. */
export function tickFlame(m: THREE.Mesh, time: number): void {
  (m.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
}
