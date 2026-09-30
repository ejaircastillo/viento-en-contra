import Phaser from 'phaser';
import { EventBus } from './EventBus';
import { Scheduler, type CancelToken } from './Scheduler';
import { DeviceProfile } from './Device';
import { AssetRegistry } from '../assets/AssetRegistry';
import { SaveSystem } from '../save/SaveSystem';
import { GameClock } from '../timer/GameClock';
import { RadioStation } from '../radio/RadioStation';
import { AudioEngine } from '../audio/AudioEngine';
import { InputManager } from '../input/InputManager';
import { Ui } from '../ui/Ui';
import { Wind } from '../world/Wind';
import type { ChapterDef, ContentPack, PlayableCharacter } from '../mission/types';
import type { CityModel } from '../world/CityBuilder';
import type { IsoScene } from '../world/IsoScene';

export interface DebugFlags {
  enabled: boolean;
  autoplay: boolean;
  speed: number;
  state: string | null;
  char: string | null;
  chapter: string | null;
  fps: boolean;
}

/**
 * Servicios globales del motor. No importa escenas ni contenido (evita dependencias circulares):
 * main.ts crea el juego Phaser y lo conecta con init().
 */
export class Engine {
  readonly events = new EventBus();
  readonly scheduler = new Scheduler();
  readonly assets = new AssetRegistry();
  readonly save = new SaveSystem();
  readonly device = new DeviceProfile();
  readonly clock = new GameClock();
  readonly radio = new RadioStation();
  readonly wind = new Wind();
  audio!: AudioEngine;
  input!: InputManager;
  ui!: Ui;
  game!: Phaser.Game;
  content!: ContentPack;
  chapter: ChapterDef | null = null;
  character: PlayableCharacter | null = null;
  /** Escena isométrica activa (ciudad o interior). */
  current: IsoScene | null = null;
  /** Token del capítulo en curso: toda espera de escena se cancela con él. */
  runToken: CancelToken | null = null;
  readonly cityCache = new Map<string, CityModel>();
  /** px CSS por px de arte (el canvas se dibuja en baja resolución y se escala sin suavizado). */
  cssScale = 3;
  artW = 300;
  artH = 600;
  paused = false;
  debug: DebugFlags;
  private windT = 0;
  private debugEl: HTMLDivElement | null = null;
  private fpsAcc = { t: 0, n: 0, fps: 60 };

  constructor() {
    const q = new URLSearchParams(location.search);
    this.debug = {
      enabled: q.has('debug'),
      autoplay: q.has('autoplay'),
      speed: Math.max(0.25, Math.min(8, parseFloat(q.get('speed') ?? '1') || 1)),
      state: q.get('state'),
      char: q.get('char'),
      chapter: q.get('chapter'),
      fps: q.has('debug') || q.has('fps'),
    };
    this.scheduler.timeScale = this.debug.speed;
  }

  init(game: Phaser.Game, content: ContentPack): void {
    this.game = game;
    this.content = content;
    this.audio = new AudioEngine();
    this.input = new InputManager(document.getElementById('touch-layer')!);
    this.ui = new Ui(this.audio, this.input, this.device.touch);
    this.ui.setAuto(this.debug.autoplay);
    this.ui.dialogue.fast = this.save.settings.textSpeed === 'fast';
    this.assets.attach(game.textures);
    this.audio.setEnabled(this.save.settings.music, this.save.settings.sfx);
    this.radio.setEnabled(this.save.settings.radio);
    this.save.onSettings((s) => {
      this.audio.setEnabled(s.music, s.sfx);
      this.radio.setEnabled(s.radio);
      this.ui.dialogue.fast = s.textSpeed === 'fast';
    });
    // la radio sólo conoce esta interfaz: el motor la conecta con HUD, audio y globos
    this.radio.host = {
      showText: (kind, text) => void this.ui.hud.radioText(kind, text),
      showIdle: (text) => void this.ui.hud.radioText('RADIO 89', text, false),
      speech: (s) => this.audio.speech(s, 0.95),
      music: (id) => {
        if (id) {
          this.audio.setMusicViaRadio(true);
          this.audio.playMusic(id);
        } else this.audio.playMusic(null);
      },
      trackTitle: (id) => this.audio.track(id)?.title ?? id,
      duck: (on) => this.audio.duck(on),
      react: (text) => {
        const s = this.current;
        if (s) void this.ui.bubbles.thought(text, s.anchorOf('player'));
      },
      sfx: (n) => this.audio.sfx(n),
      emit: (id) => this.events.emit(`radio:${id}`, { id }),
    };
    this.ui.hud.onRadioToggle = () => {
      const on = !this.save.settings.radio;
      this.save.setSetting('radio', on);
      this.ui.hud.radio(true, on);
    };
    this.ui.hud.onHorn = () => this.input.pressHorn();
    game.events.on('step', (_t: number, delta: number) => this.tick(delta));
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
    this.resize();
    if (this.debug.fps) {
      this.debugEl = document.createElement('div');
      this.debugEl.className = 'debug';
      document.getElementById('app')!.appendChild(this.debugEl);
    }
  }

  /** Escala pixel-perfect: cada px de arte ocupa N px físicos exactos. */
  resize(): void {
    if (!this.game) return;
    const dpr = this.device.dpr;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const shortPhys = Math.min(cw, ch) * dpr;
    const target = cw < ch ? 268 : 300;
    const N = Math.max(1, Math.round(shortPhys / target));
    const w = Math.ceil((cw * dpr) / N);
    const h = Math.ceil((ch * dpr) / N);
    this.artW = w;
    this.artH = h;
    this.cssScale = N / dpr;
    this.game.scale.resize(w, h);
    this.game.scale.setZoom(this.cssScale);
    this.events.emit('resize', { w, h });
  }

  /** Pasa de coordenadas de pantalla de mundo (px de arte) a px CSS del viewport. */
  toCss(cam: Phaser.Cameras.Scene2D.Camera, sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - cam.scrollX) * this.cssScale, y: (sy - cam.scrollY) * this.cssScale };
  }

  fromCss(cam: Phaser.Cameras.Scene2D.Camera, cx: number, cy: number): { x: number; y: number } {
    return { x: cx / this.cssScale + cam.scrollX, y: cy / this.cssScale + cam.scrollY };
  }

  private tick(delta: number): void {
    const dtReal = Math.min(delta, 60) / 1000;
    this.input?.update();
    if (!this.paused) {
      const dtMs = this.scheduler.update(dtReal * 1000);
      const dt = dtMs / 1000;
      this.clock.update(dt);
      this.radio.update(dt);
      this.wind.update(dt);
      this.ui?.brace.update(dt);
      this.windT += dt;
      if (this.windT > 0.2) {
        this.windT = 0;
        this.audio?.setWind(this.wind.strength);
      }
    }
    this.ui?.bubbles.update();
    this.ui?.captions.update();
    this.ui?.drive.update();
    // sube a la GPU las páginas de atlas con sprites nuevos (sólo si cambiaron)
    this.assets.flush();
    this.device.sample(delta);
    if (this.debugEl) {
      this.fpsAcc.t += delta;
      this.fpsAcc.n++;
      if (this.fpsAcc.t > 500) {
        this.fpsAcc.fps = Math.round((this.fpsAcc.n * 1000) / this.fpsAcc.t);
        this.fpsAcc.t = 0;
        this.fpsAcc.n = 0;
        const st = this.assets.stats();
        this.debugEl.textContent = `${this.fpsAcc.fps} fps · ${this.artW}x${this.artH} x${this.cssScale.toFixed(2)} · ${this.device.tier}\natlas ${st.pages}p ${st.sprites}s · ${this.clock.text}`;
      }
    }
  }

  get dt(): number {
    return this.paused ? 0 : 1;
  }
}

export const engine = new Engine();
