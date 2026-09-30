import * as THREE from 'three';
import { fillPixels, makeCanvas, tileFbm } from './textures';

/**
 * Cielo nocturno y luz de luna, siguiendo el desglose de la referencia:
 *  - una luz direccional fuerte (la luna) con una caída exponencial suave desde el 100 % sobre el fantasma hasta
 *    ~20 % a unos 6 metros (`moonPool`), modulada por un "mapa de nubes" que se desplaza (ruido tipo Perlin-Worley);
 *  - un entorno (aquí procedural, en la referencia un HDRI de polyhaven) que aporta la luz ambiente y los brillos.
 * La luna es una DirectionalLight con sombras que sigue al jugador desde `MOON_DIR`; el humo la usa para
 * iluminarse con normales de esfera.
 */
export const MOON_DIR = new THREE.Vector3(-8, 16, -6).normalize();

export const skyUniforms = {
  /** Dirección hacia la luna en espacio de vista (se actualiza cada cuadro con la cámara). */
  uMoonDirView: { value: new THREE.Vector3(0, 1, 0) },
};

/** Uniforms compartidas del "charco" de luna. `uPool` = (escala de la caída en m, mínimo, cantidad de nubes, activo). */
export const moonPool = {
  uGhostView: { value: new THREE.Vector3() },
  uCamWorld: { value: new THREE.Matrix4() },
  uPool: { value: new THREE.Vector4(2.6, 0.28, 0.5, 1) },
  uCloud: { value: null as THREE.Texture | null },
  uSkyTime: { value: 0 },
};

const GHOST_AT = new THREE.Vector3();

/** Una vez por cuadro: fantasma y cámara (para medir la distancia en espacio de vista) y el tiempo de las nubes. */
export function updateSky(camera: THREE.Camera, gx: number, gz: number, time: number): void {
  skyUniforms.uMoonDirView.value.copy(MOON_DIR).transformDirection(camera.matrixWorldInverse);
  moonPool.uGhostView.value.copy(GHOST_AT.set(gx, 0.6, gz)).applyMatrix4(camera.matrixWorldInverse);
  moonPool.uCamWorld.value.copy(camera.matrixWorld);
  moonPool.uSkyTime.value = time;
}

/** Mapa de nubes (128², repetible): ruido fractal con contraste, como sombra de nubes que pasan. */
export function cloudTexture(size = 128): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size);
  fillPixels(ctx, size, size, (x, y) => {
    const n = tileFbm(x, y, size, 4, 4, 91);
    const v = THREE.MathUtils.smoothstep(n, 0.3, 0.72) * 255;
    return [v, v, v];
  });
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Entorno nocturno procedural (gradiente de cielo + disco de luna brillante) filtrado con PMREM. */
export function makeSkyEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const zenith = new THREE.Color(0x0a1230);
  const horizon = new THREE.Color(0x2c3c6a);
  const ground = new THREE.Color(0x0d0b0a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 50;
    if (t >= 0) c.copy(horizon).lerp(zenith, Math.pow(t, 0.6));
    else c.copy(horizon).lerp(ground, Math.min(1, -t * 3));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false })));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 8.5, 12), toneMapped: false }));
  moon.position.copy(MOON_DIR).multiplyScalar(42);
  scene.add(moon);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.03);
  pm.dispose();
  geo.dispose();
  return rt.texture;
}

const POOL_GLSL = `
uniform vec3 uGhostView;
uniform mat4 uCamWorld;
uniform vec4 uPool;
uniform sampler2D uCloud;
uniform float uSkyTime;
float moonPool( vec3 viewPos ) {
  float d = distance( viewPos, uGhostView );
  float pool = uPool.y + ( 1.0 - uPool.y ) * exp( -d / uPool.x );
  vec2 w = ( uCamWorld * vec4( viewPos, 1.0 ) ).xz;
  float cloud = texture2D( uCloud, w * 0.04 + vec2( uSkyTime * 0.010, uSkyTime * 0.004 ) ).r;
  float clouds = mix( 1.0, 0.5 + 0.95 * cloud, uPool.z );
  return mix( 1.0, pool * clouds, uPool.w );
}
`;

/** Inyecta la caída de la luz de luna en un shader estándar/lambert (se aplica a las luces direccionales). */
export function patchMoon(shader: { uniforms: Record<string, { value: unknown }>; fragmentShader: string }): void {
  Object.assign(shader.uniforms, moonPool);
  const chunk = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= moonPool( geometryPosition );');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${POOL_GLSL}`).replace('#include <lights_fragment_begin>', chunk);
}

/** Envuelve `onBeforeCompile` del material para sumar el charco de luna (una sola vez por material). */
export function withMoon<T extends THREE.Material>(m: T): T {
  if (m.userData.moon) return m;
  m.userData.moon = true;
  const prev = m.onBeforeCompile;
  const key = `${m.customProgramCacheKey()}|moon`; // antes de reemplazar onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    patchMoon(shader);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/** Aplica `withMoon` a todos los materiales con iluminación de un árbol de objetos. */
export function applyMoon(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshLambertMaterial).isMeshLambertMaterial) withMoon(m);
  });
}
