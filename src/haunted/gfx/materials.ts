import * as THREE from 'three';
import { clothTexture, detailTexture, plasterTexture, slateRoofTexture, stoneTexture, woodTexture } from './textures';

/**
 * Materiales compartidos del prototipo. La mayoría son MeshStandardMaterial (PBR) con color por vértice
 * multiplicado por una textura procedural; el pasto y las plantas llevan además un "meneo" de viento en el
 * vertex shader (una sola uniform de tiempo compartida por todos).
 */

/**
 * Uniforms de viento compartidas: hay que actualizar `uTime` (y `uPush`, la posición del fantasma) una vez por
 * cuadro. `uPush` = (x, z, radio, fuerza): el pasto se aplasta y se abre alrededor del fantasma, así nunca
 * queda tapado por los yuyos.
 */
export const windUniforms = { uTime: { value: 0 }, uAmp: { value: 0.3 }, uPush: { value: new THREE.Vector4(0, 0, 1.3, 1) } };

const WIND_VERTEX = /* glsl */ `
  #include <begin_vertex>
  #ifdef USE_INSTANCING
    mat4 windIm = instanceMatrix;
  #else
    mat4 windIm = mat4(1.0);
  #endif
  vec3 windPos = (modelMatrix * windIm * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float windPh = uTime * 1.5 + windPos.x * 0.55 + windPos.z * 0.43;
  float windGust = sin(windPh) * 0.6 + sin(windPh * 2.3 + windPos.z * 0.8) * 0.3 + sin(uTime * 0.37 + windPos.x * 0.12) * 0.5;
  float windBend = transformed.y * transformed.y * uSway * uAmp;
  vec3 windWorld = vec3(windGust * windBend, 0.0, windGust * windBend * 0.55);
  #ifdef WIND_PUSH
    vec2 pushD = windPos.xz - uPush.xy;
    float pushK = (1.0 - smoothstep(0.3, uPush.z, length(pushD))) * uPush.w;
    vec3 pushDir = normalize(vec3(pushD.x, 0.0, pushD.y) + vec3(0.0001, 0.0, 0.0001));
    windWorld += pushDir * pushK * transformed.y * transformed.y * 0.6;
    transformed.y *= 1.0 - 0.62 * pushK;
  #endif
  transformed += inverse(mat3(windIm)) * windWorld;
`;

/** Material estándar con viento: para pasto, helechos, hojas y flecos. `sway` escala el movimiento. */
export function windMaterial(params: THREE.MeshStandardMaterialParameters, sway = 1, push = false): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uAmp = windUniforms.uAmp;
    shader.uniforms.uPush = windUniforms.uPush;
    shader.uniforms.uSway = { value: sway };
    const head = `${push ? `#define WIND_PUSH\n` : ''}#include <common>\nuniform float uTime;\nuniform float uAmp;\nuniform float uSway;\nuniform vec4 uPush;`;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', head).replace('#include <begin_vertex>', WIND_VERTEX);
  };
  m.customProgramCacheKey = () => `wind${sway}${push ? 'p' : ''}`;
  return m;
}

/** Material emisivo "quemado" (llamas, vidrio de faroles): no se tonemapea, con color > 1 para que brille en el bloom. */
export function glowBasic(color: THREE.ColorRepresentation, intensity = 2.5): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
}

export interface Materials {
  detail: THREE.Texture;
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  plaster: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  slate: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  bone: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  flat: THREE.MeshStandardMaterial;
  /** Material liso con color por vértice (follaje, ramas, pelaje). */
  vertex: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  plant: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  ghost: THREE.MeshStandardMaterial;
}

export function createMaterials(): Materials {
  const stone = stoneTexture('#a3a7b2');
  const stoneD = stoneTexture('#6f7480');
  const wood = woodTexture('#7a4526');
  const woodD = woodTexture('#4a2714');
  const roof = slateRoofTexture();
  const plaster = plasterTexture();
  const cloth = clothTexture('#8a2431');
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...p });
  return {
    detail: detailTexture(),
    stone: std({ map: stone.map, bumpMap: stone.bump, bumpScale: 1.6, vertexColors: true }),
    stoneDark: std({ map: stoneD.map, bumpMap: stoneD.bump, bumpScale: 1.6, vertexColors: true }),
    plaster: std({ map: plaster, vertexColors: true, roughness: 1 }),
    wood: std({ map: wood.map, bumpMap: wood.bump, bumpScale: 1.2, vertexColors: true, roughness: 0.78 }),
    woodDark: std({ map: woodD.map, bumpMap: woodD.bump, bumpScale: 1.2, vertexColors: true, roughness: 0.8 }),
    slate: std({ map: roof.map, bumpMap: roof.bump, bumpScale: 2, vertexColors: true, roughness: 0.75 }),
    iron: std({ color: 0x23262e, vertexColors: true, roughness: 0.55, metalness: 0.7 }),
    bone: std({ color: 0xe8dcc0, vertexColors: true, roughness: 0.7 }),
    cloth: std({ map: cloth, vertexColors: true, roughness: 1 }),
    flat: std({ vertexColors: true }),
    vertex: std({ vertexColors: true, roughness: 0.95 }),
    grass: windMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }, 1, true),
    plant: windMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }, 0.6, true),
    leaf: windMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }, 0.05),
    ghost: softWhite(std({ color: 0xf4f0ea, roughness: 0.72, emissive: 0x1b2230, emissiveIntensity: 0.9 })),
  };
}

/**
 * Comprime la luz saliente de un material muy claro (el fantasma): junto a la fogata y los faroles una sábana
 * blanca se quema y el bloom se la come. Con esta curva conserva el volumen y los ojos siempre se leen.
 */
function softWhite(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight = 1.25 * outgoingLight / (1.0 + 0.9 * outgoingLight);
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'softWhite';
  return m;
}
