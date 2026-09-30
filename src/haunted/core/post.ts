import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import type { Quality } from './quality';

/**
 * Postproceso del prototipo: render HDR → contorno naranja de lo interactuable → bloom → tonemap ACES →
 * "grade" propio (viñeta, desenfoque tilt-shift de diorama, tinte frío en sombras / cálido en luces, grano,
 * fundido) → FXAA. El contorno va antes del bloom a propósito: así el borde naranja también brilla.
 */
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uTilt: { value: 1 },
    uGrain: { value: 0.035 },
    uSat: { value: 1.04 },
    uShadowTint: { value: new THREE.Color(0.86, 0.95, 1.12) },
    uHighTint: { value: new THREE.Color(1.08, 1.0, 0.9) },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uVignette;
    uniform float uTilt;
    uniform float uGrain;
    uniform float uSat;
    uniform vec3 uShadowTint;
    uniform vec3 uHighTint;
    uniform float uFade;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;

      // tilt-shift: el desenfoque crece con la distancia a una franja de foco algo por debajo del centro
      float band = abs(uv.y - 0.47);
      float amt = smoothstep(0.2, 0.62, band) * uTilt;
      if (amt > 0.003) {
        float radius = amt * 7.0;
        vec3 acc = col;
        float wsum = 1.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996;
          float r = sqrt((float(i) + 0.5) / 12.0);
          vec2 o = vec2(cos(a), sin(a)) * r * radius / uRes;
          acc += texture2D(tDiffuse, uv + o).rgb;
          wsum += 1.0;
        }
        col = acc / wsum;
      }

      // tinte dividido: sombras frías, luces cálidas
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, col * uShadowTint, (1.0 - smoothstep(0.0, 0.45, luma)) * 0.75);
      col *= mix(vec3(1.0), uHighTint, smoothstep(0.35, 0.95, luma));
      col = mix(vec3(luma), col, uSat);

      // viñeta
      vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y * 0.72, 1.0);
      float vig = 1.0 - uVignette * pow(clamp(length(q) * 1.25, 0.0, 1.5), 2.4);
      col *= clamp(vig, 0.0, 1.0);

      // grano de película
      col += (hash(uv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;

      col *= 1.0 - uFade;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export type Effect = 'bloom' | 'outline' | 'tilt' | 'grain' | 'vignette';

const GRAIN = 0.035;
const VIGNETTE = 0.55;

export class Post {
  /** Intensidad base del bloom (el sellado la sube un instante y vuelve a este valor). */
  bloomBase = 0.55;
  readonly composer: EffectComposer;
  readonly outline: OutlinePass | null;
  readonly bloom: UnrealBloomPass | null;
  readonly grade: ShaderPass;
  private fxaa: FXAAPass | null;
  private size = new THREE.Vector2(1, 1);
  /** Objetos que no deben entrar al pase del contorno (volúmenes: el contorno usa una silueta aparte). */
  readonly noOutline = new Set<THREE.Object3D>();

  constructor(
    readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    readonly quality: Quality,
  ) {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.msaa });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));

    this.outline = quality.outline ? new OutlinePass(new THREE.Vector2(1, 1), scene, camera) : null;
    if (this.outline) {
      this.outline.edgeStrength = 5;
      this.outline.edgeGlow = 0.6;
      this.outline.edgeThickness = 2.2;
      this.outline.pulsePeriod = 0;
      this.outline.visibleEdgeColor.set('#ff9a2e');
      this.outline.hiddenEdgeColor.set('#000000'); // el brillo no se cuela a través de lo que está delante (usa la profundidad)
      const base = this.outline.render.bind(this.outline);
      this.outline.render = (...args: Parameters<OutlinePass['render']>) => {
        const hidden: THREE.Object3D[] = [];
        for (const o of this.noOutline) {
          if (!o.visible) continue;
          o.visible = false;
          hidden.push(o);
        }
        base(...args);
        for (const o of hidden) o.visible = true;
      };
      this.composer.addPass(this.outline);
    }

    this.bloom = quality.bloom ? new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.65, 0.78) : null;
    if (this.bloom) this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());

    this.grade = new ShaderPass(GRADE_SHADER);
    this.grade.uniforms.uTilt.value = quality.tiltShift ? 1 : 0;
    this.composer.addPass(this.grade);

    this.fxaa = quality.msaa === 0 ? new FXAAPass() : null;
    if (this.fxaa) this.composer.addPass(this.fxaa);
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.size.set(w, h);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    const pw = Math.floor(w * pixelRatio);
    const ph = Math.floor(h * pixelRatio);
    this.grade.uniforms.uRes.value.set(pw, ph);
    if (this.bloom) this.bloom.resolution.set(Math.max(2, Math.floor(pw / this.quality.bloomDivider)), Math.max(2, Math.floor(ph / this.quality.bloomDivider)));
    if (this.outline) this.outline.resolution.set(pw, ph);
  }

  /** Enciende o apaga un efecto en caliente (los que la calidad no incluye no se pueden encender). */
  toggle(name: Effect, on: boolean): void {
    const u = this.grade.uniforms;
    if (name === 'bloom' && this.bloom) this.bloom.enabled = on;
    else if (name === 'outline' && this.outline) this.outline.enabled = on;
    else if (name === 'tilt') u.uTilt.value = on ? 1 : 0;
    else if (name === 'grain') u.uGrain.value = on ? GRAIN : 0;
    else if (name === 'vignette') u.uVignette.value = on ? VIGNETTE : 0;
  }

  has(name: Effect): boolean {
    return name === 'bloom' ? !!this.bloom : name === 'outline' ? !!this.outline : true;
  }

  state(): Record<Effect, boolean> {
    const u = this.grade.uniforms;
    return { bloom: !!this.bloom?.enabled, outline: !!this.outline?.enabled, tilt: u.uTilt.value > 0, grain: u.uGrain.value > 0, vignette: u.uVignette.value > 0 };
  }

  setBloomStrength(v: number): void {
    this.bloomBase = v;
    if (this.bloom) this.bloom.strength = v;
  }

  /** Objetos que llevan el contorno naranja (lo interactuable más cercano). */
  setOutlined(objects: THREE.Object3D[]): void {
    if (this.outline) this.outline.selectedObjects = objects;
  }

  setFade(v: number): void {
    this.grade.uniforms.uFade.value = v;
  }

  render(dt: number, time: number): void {
    this.grade.uniforms.uTime.value = time;
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
