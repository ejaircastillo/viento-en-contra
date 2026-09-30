import * as THREE from 'three';
import { CameraRig } from './cameraRig';
import { Post } from './post';
import { detectQuality, type Quality } from './quality';

/** Color del vacío que rodea al diorama (casi negro azulado, como en la referencia). */
export const VOID_COLOR = 0x03040a;

/**
 * Renderer + escena + cámara + postproceso y el bucle principal.
 * `?timer` usa setTimeout en vez de requestAnimationFrame (útil para QA con la pestaña en segundo plano),
 * igual que el juego 2D.
 */
export class App {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  readonly post: Post;
  readonly quality: Quality;
  readonly touch: boolean;
  time = 0;
  fps = 60;
  onUpdate: (dt: number, t: number) => void = () => {};
  private last = 0;
  private running = false;
  private pixelRatio = 1;
  private userRatio: number | null = null;
  /** Resolución dinámica: baja si los fps se clavan por debajo de 40 y sube despacio cuando sobra. */
  private autoRatio: number | null = null;
  private autoScale: boolean;
  private slow = 0;
  private fast = 0;
  private cool = 0;
  private useTimer: boolean;
  private fpsAcc = { t: 0, n: 0 };

  constructor(readonly canvas: HTMLCanvasElement) {
    const params = new URLSearchParams(location.search);
    this.useTimer = params.has('timer');
    this.autoScale = !params.has('timer') && !params.has('pr');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
    this.touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.quality = detectQuality(location.search, gpuName(this.renderer), this.touch, navigator.hardwareConcurrency ?? 8);

    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(VOID_COLOR, 1);

    this.scene.background = new THREE.Color(VOID_COLOR);
    this.rig = new CameraRig(1);
    this.post = new Post(r, this.scene, this.rig.camera, this.quality);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = Math.max(2, innerWidth);
    const h = Math.max(2, innerHeight);
    this.pixelRatio = this.userRatio ?? Math.min(this.autoRatio ?? this.baseRatio(), this.baseRatio());
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.rig.setAspect(w / h);
    this.post.setSize(w, h, this.pixelRatio);
  }

  private baseRatio(): number {
    const override = parseFloat(new URLSearchParams(location.search).get('pr') ?? '');
    return Math.min(Number.isFinite(override) && override > 0 ? override : devicePixelRatio || 1, this.quality.pixelRatio);
  }

  /** Cada medio segundo: si va lento baja la resolución; si sobra, la sube de a poco. */
  private adapt(): void {
    if (!this.autoScale || this.userRatio !== null) return;
    this.cool = Math.max(0, this.cool - 0.5);
    if (this.fps < 40) [this.slow, this.fast] = [this.slow + 0.5, 0];
    else if (this.fps > 57) [this.slow, this.fast] = [0, this.fast + 0.5];
    else [this.slow, this.fast] = [0, 0];
    const cur = this.autoRatio ?? this.baseRatio();
    if (this.slow >= 2 && cur > 0.75) {
      this.autoRatio = Math.max(0.75, cur - 0.25);
      [this.slow, this.cool] = [0, 12];
      this.resize();
    } else if (this.fast >= 8 && this.cool <= 0 && this.autoRatio !== null) {
      this.autoRatio = this.autoRatio + 0.25 >= this.baseRatio() ? null : this.autoRatio + 0.25;
      this.fast = 0;
      this.resize();
    }
  }

  /** Fija la densidad de píxeles (null = automática según la calidad y la pantalla). */
  setResolution(ratio: number | null): void {
    this.userRatio = ratio && ratio > 0 ? Math.min(2, ratio) : null;
    this.resize();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.0005, (now - this.last) / 1000));
      this.last = now;
      this.time += dt;
      this.fpsAcc.t += dt;
      this.fpsAcc.n++;
      if (this.fpsAcc.t >= 0.5) {
        this.fps = this.fpsAcc.n / this.fpsAcc.t;
        this.fpsAcc = { t: 0, n: 0 };
        this.adapt();
      }
      this.onUpdate(dt, this.time);
      this.rig.update(dt);
      this.post.render(dt, this.time);
      if (this.useTimer) setTimeout(tick, 16);
      else requestAnimationFrame(tick);
    };
    if (this.useTimer) setTimeout(tick, 16);
    else requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
  }
}

function gpuName(renderer: THREE.WebGLRenderer): string {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch {
    return '';
  }
}
