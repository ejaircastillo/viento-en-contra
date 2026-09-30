import type { AssetEntry } from '../assets/AssetRegistry';

/**
 * Audio 100% procedural con WebAudio (placeholder): viento (identidad sonora), motor,
 * radio (música filtrada + "locutor" murmurado), voces de diálogo, SFX y música chiptune.
 * Si assets/manifest.json declara un audio final (kind "audio", status "final"), se carga
 * bajo demanda y reemplaza al sintetizado con la misma clave, sin tocar la lógica.
 */

export type SfxName =
  | 'door_open'
  | 'door_close'
  | 'car_door'
  | 'brake'
  | 'horn'
  | 'blinker'
  | 'phone_ring'
  | 'phone_pickup'
  | 'notify'
  | 'paper'
  | 'stamp'
  | 'step'
  | 'ui_click'
  | 'ui_confirm'
  | 'ui_back'
  | 'radio_on'
  | 'car_alarm'
  | 'ticket'
  | 'error_beep'
  | 'murmur'
  | 'dog_bark'
  | 'gust'
  | 'whoosh'
  | 'register'
  | 'thud';

export interface TrackChannel {
  inst: 'lead' | 'pluck' | 'bass' | 'pad' | 'arp' | 'kick' | 'snare' | 'hat' | 'bell';
  notes: string;
  vol?: number;
}

export interface Track {
  id: string;
  bpm: number;
  /** Pasos por negra (4 = semicorcheas). */
  spb?: number;
  channels: TrackChannel[];
  /** Nombre ficticio para mostrar en la radio. */
  title?: string;
}

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteFreq(n: string): number | null {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n);
  if (!m) return null;
  let semi = NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const oct = parseInt(m[3], 10);
  semi += (oct + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
}

interface ParsedChannel {
  inst: TrackChannel['inst'];
  steps: string[];
  vol: number;
}

class MusicPlayer {
  private track: Track | null = null;
  private parsed: ParsedChannel[] = [];
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private len = 0;

  constructor(
    private ae: AudioEngine,
    private out: GainNode,
  ) {}

  play(track: Track): void {
    if (this.track?.id === track.id && this.timer !== null) return;
    this.stop();
    const ctx = this.ae.ctx;
    if (!ctx) return;
    this.track = track;
    this.parsed = track.channels.map((c) => ({
      inst: c.inst,
      steps: c.notes.trim().split(/\s+/),
      vol: c.vol ?? 1,
    }));
    this.len = Math.max(...this.parsed.map((p) => p.steps.length));
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  get current(): Track | null {
    return this.track;
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }

  private tick(): void {
    const ctx = this.ae.ctx;
    if (!ctx || !this.track) return;
    const spb = this.track.spb ?? 4;
    const stepDur = 60 / this.track.bpm / spb;
    while (this.nextTime < ctx.currentTime + 0.14) {
      for (const ch of this.parsed) {
        const tok = ch.steps[this.step % ch.steps.length];
        if (!tok || tok === '.' || tok === '-') continue;
        // duración: cantidad de "-" siguientes
        let hold = 1;
        while (ch.steps[(this.step + hold) % ch.steps.length] === '-' && hold < 16) hold++;
        this.ae.playNote(ch.inst, tok, this.nextTime, stepDur * hold, ch.vol, this.out);
      }
      this.nextTime += stepDur;
      this.step = (this.step + 1) % this.len;
    }
  }
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicDuck!: GainNode;
  private radioFilter!: BiquadFilterNode;
  private radioFilter2!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private voiceBus!: GainNode;
  private noise!: AudioBuffer;
  private windNodes: { g: GainNode; bp: BiquadFilterNode; lp: BiquadFilterNode; wg: GainNode; wbp: BiquadFilterNode } | null = null;
  private engineNodes: { o1: OscillatorNode; o2: OscillatorNode; lp: BiquadFilterNode; g: GainNode } | null = null;
  private humNodes: { o: OscillatorNode; g: GainNode } | null = null;
  private music: MusicPlayer | null = null;
  private tracks = new Map<string, Track>();
  private files = new Map<string, AssetEntry>();
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Set<string>();
  private musicOn = true;
  private sfxOn = true;
  private viaRadio = false;
  private duckCount = 0;
  private windStrength = 0.4;
  private interior = false;

  get ready(): boolean {
    return !!this.ctx;
  }

  /** Debe llamarse desde un gesto del usuario (requisito de los navegadores móviles). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    this.musicBus = ctx.createGain();
    this.musicDuck = ctx.createGain();
    this.radioFilter = ctx.createBiquadFilter();
    this.radioFilter.type = 'bandpass';
    this.radioFilter.frequency.value = 1300;
    this.radioFilter.Q.value = 0.55;
    this.radioFilter2 = ctx.createBiquadFilter();
    this.radioFilter2.type = 'highshelf';
    this.radioFilter2.frequency.value = 3000;
    this.radioFilter2.gain.value = -10;
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
    this.musicBus.connect(this.musicDuck);
    this.musicDuck.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.8 : 0;
    this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = this.sfxOn ? 0.9 : 0;
    this.ambBus.connect(this.master);
    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = this.sfxOn ? 0.55 : 0;
    this.voiceBus.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.music = new MusicPlayer(this, this.musicBus);
    this.startWind();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  registerTrack(t: Track): void {
    this.tracks.set(t.id, t);
  }

  track(id: string): Track | undefined {
    return this.tracks.get(id);
  }

  registerFiles(entries: AssetEntry[]): void {
    for (const e of entries) if (e.kind === 'audio' && e.status === 'final' && e.path) this.files.set(e.key, e);
  }

  setEnabled(music: boolean, sfx: boolean): void {
    this.musicOn = music;
    this.sfxOn = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(music ? 0.32 : 0, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(sfx ? 0.8 : 0, t, 0.1);
    this.ambBus.gain.setTargetAtTime(sfx ? 0.9 : 0, t, 0.1);
    this.voiceBus.gain.setTargetAtTime(sfx ? 0.55 : 0, t, 0.1);
  }

  // ------------------------------------------------------------ música

  playMusic(id: string | null): void {
    if (!this.music) return;
    if (!id) {
      this.music.stop();
      return;
    }
    const t = this.tracks.get(id);
    if (t) this.music.play(t);
  }

  get currentTrack(): Track | null {
    return this.music?.current ?? null;
  }

  /** Enruta la música a través del filtro de "parlante de radio" del auto. */
  setMusicViaRadio(on: boolean): void {
    if (!this.ctx || on === this.viaRadio) return;
    this.viaRadio = on;
    this.musicBus.disconnect();
    if (on) {
      this.musicBus.connect(this.radioFilter);
      this.radioFilter.connect(this.radioFilter2);
      this.radioFilter2.connect(this.musicDuck);
    } else {
      this.radioFilter.disconnect();
      this.radioFilter2.disconnect();
      this.musicBus.connect(this.musicDuck);
    }
  }

  /** Baja la música mientras hay voz (radio o diálogo). Anidable. */
  duck(on: boolean): void {
    if (!this.ctx) return;
    this.duckCount = Math.max(0, this.duckCount + (on ? 1 : -1));
    this.musicDuck.gain.setTargetAtTime(this.duckCount > 0 ? 0.3 : 1, this.ctx.currentTime, 0.15);
  }

  playNote(inst: TrackChannel['inst'], tok: string, when: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.connect(out);
    if (inst === 'kick' || inst === 'snare' || inst === 'hat') {
      if (tok === '.' || tok === '-') return;
      if (inst === 'kick') {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, when);
        o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
        g.gain.setValueAtTime(0.9 * vol, when);
        g.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
        o.connect(g);
        o.start(when);
        o.stop(when + 0.22);
      } else {
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const f = ctx.createBiquadFilter();
        f.type = inst === 'hat' ? 'highpass' : 'bandpass';
        f.frequency.value = inst === 'hat' ? 7000 : 1800;
        const len = inst === 'hat' ? 0.04 : 0.14;
        g.gain.setValueAtTime((inst === 'hat' ? 0.18 : 0.45) * vol, when);
        g.gain.exponentialRampToValueAtTime(0.001, when + len);
        s.connect(f);
        f.connect(g);
        s.start(when, Math.random() * 1.5, len + 0.02);
      }
      return;
    }
    const freq = noteFreq(tok);
    if (!freq) return;
    const o = ctx.createOscillator();
    let peak = 0.2 * vol;
    let attack = 0.005;
    let release = Math.min(0.25, dur * 0.6);
    let sustain = dur;
    switch (inst) {
      case 'lead':
        o.type = 'square';
        peak = 0.09 * vol;
        {
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();
          lfo.frequency.value = 5.5;
          lg.gain.value = freq * 0.012;
          lfo.connect(lg);
          lg.connect(o.frequency);
          lfo.start(when);
          lfo.stop(when + dur + release);
        }
        break;
      case 'pluck':
        o.type = 'triangle';
        peak = 0.22 * vol;
        sustain = Math.min(dur, 0.12);
        release = 0.2;
        break;
      case 'arp':
        o.type = 'square';
        peak = 0.05 * vol;
        sustain = Math.min(dur, 0.08);
        release = 0.06;
        break;
      case 'bass':
        o.type = 'triangle';
        peak = 0.3 * vol;
        release = 0.08;
        break;
      case 'bell':
        o.type = 'sine';
        peak = 0.16 * vol;
        sustain = 0.02;
        release = Math.max(0.6, dur);
        break;
      case 'pad': {
        o.type = 'sawtooth';
        peak = 0.045 * vol;
        attack = Math.min(0.4, dur * 0.4);
        release = 0.5;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        o.disconnect();
        o.connect(f);
        f.connect(g);
        const o2 = ctx.createOscillator();
        o2.type = 'sawtooth';
        o2.frequency.value = freq * 1.007;
        o2.connect(f);
        o2.start(when);
        o2.stop(when + sustain + release + 0.05);
        break;
      }
    }
    o.frequency.setValueAtTime(freq, when);
    if (inst !== 'pad') o.connect(g);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + attack);
    g.gain.setValueAtTime(peak, when + Math.max(attack, sustain));
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(attack, sustain) + release);
    o.start(when);
    o.stop(when + Math.max(attack, sustain) + release + 0.05);
  }

  // ------------------------------------------------------------ viento

  private startWind(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(bp);
    bp.connect(lp);
    lp.connect(g);
    g.connect(this.ambBus);
    // silbido de ráfaga
    const src2 = ctx.createBufferSource();
    src2.buffer = this.noise;
    src2.loop = true;
    src2.loopStart = 0.5;
    const wbp = ctx.createBiquadFilter();
    wbp.type = 'bandpass';
    wbp.frequency.value = 1100;
    wbp.Q.value = 14;
    const wg = ctx.createGain();
    wg.gain.value = 0.0;
    src2.connect(wbp);
    wbp.connect(wg);
    wg.connect(this.ambBus);
    src.start();
    src2.start();
    this.windNodes = { g, bp, lp, wg, wbp };
    this.applyWind();
  }

  /** Intensidad 0..1 del viento (lo actualiza el sistema de clima con las ráfagas). */
  setWind(strength: number): void {
    this.windStrength = strength;
    this.applyWind();
  }

  setInterior(on: boolean): void {
    this.interior = on;
    this.applyWind();
    this.hum(on);
  }

  private applyWind(): void {
    const w = this.windNodes;
    if (!w || !this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.windStrength;
    const k = this.interior ? 0.35 : 1;
    w.g.gain.setTargetAtTime((0.035 + 0.13 * s) * k, t, 0.35);
    w.bp.frequency.setTargetAtTime(260 + 560 * s, t, 0.5);
    w.lp.frequency.setTargetAtTime(this.interior ? 420 : 900 + 1200 * s, t, 0.4);
    w.wg.gain.setTargetAtTime(Math.max(0, s - 0.55) * 0.05 * k, t, 0.4);
    w.wbp.frequency.setTargetAtTime(900 + 800 * s, t, 0.6);
  }

  private hum(on: boolean): void {
    if (!this.ctx) return;
    if (on && !this.humNodes) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 100; // zumbido de tubo fluorescente (red de 50 Hz)
      const g = this.ctx.createGain();
      g.gain.value = 0.012;
      o.connect(g);
      g.connect(this.ambBus);
      o.start();
      this.humNodes = { o, g };
    } else if (!on && this.humNodes) {
      this.humNodes.o.stop();
      this.humNodes = null;
    }
  }

  // ------------------------------------------------------------ motor

  setEngine(on: boolean, speed01 = 0, throttle = 0): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.engineNodes) {
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      const o2 = ctx.createOscillator();
      o2.type = 'square';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.value = 0;
      o1.connect(lp);
      o2.connect(lp);
      lp.connect(g);
      g.connect(this.sfxBus);
      o1.start();
      o2.start();
      this.engineNodes = { o1, o2, lp, g };
    }
    const e = this.engineNodes;
    if (!e) return;
    const t = ctx.currentTime;
    if (!on) {
      e.g.gain.setTargetAtTime(0, t, 0.15);
      const nodes = e;
      this.engineNodes = null;
      window.setTimeout(() => {
        try {
          nodes.o1.stop();
          nodes.o2.stop();
        } catch {
          /* ya detenido */
        }
      }, 600);
      return;
    }
    const f = 34 + speed01 * 58 + throttle * 8;
    e.o1.frequency.setTargetAtTime(f, t, 0.12);
    e.o2.frequency.setTargetAtTime(f / 2, t, 0.12);
    e.lp.frequency.setTargetAtTime(220 + throttle * 520 + speed01 * 300, t, 0.1);
    e.g.gain.setTargetAtTime(0.05 + throttle * 0.035 + speed01 * 0.02, t, 0.1);
  }

  // ------------------------------------------------------------ voces

  /** "Bip" de voz por sílaba mientras se tipea un diálogo. */
  blip(pitch = 1): void {
    if (!this.ctx || !this.sfxOn) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    const base = 180 * pitch * (0.92 + Math.random() * 0.16);
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (0.9 + Math.random() * 0.25), t + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(f);
    f.connect(g);
    g.connect(this.voiceBus);
    o.start(t);
    o.stop(t + 0.07);
  }

  /** Locutor de radio "murmurado" (sílabas con formantes, filtradas como parlante). */
  speech(seconds: number, pitch = 1): void {
    if (!this.ctx || !this.sfxOn) return;
    const ctx = this.ctx;
    const out = ctx.createBiquadFilter();
    out.type = 'bandpass';
    out.frequency.value = 1200;
    out.Q.value = 0.6;
    const og = ctx.createGain();
    og.gain.value = 0.9;
    out.connect(og);
    og.connect(this.voiceBus);
    let t = ctx.currentTime + 0.05;
    const end = t + seconds;
    const vowels = [
      [700, 1200],
      [400, 2000],
      [300, 2300],
      [500, 900],
      [600, 1700],
    ];
    while (t < end) {
      const syl = 0.07 + Math.random() * 0.08;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f0 = (105 + Math.random() * 40) * pitch;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.3), t + syl);
      const [f1, f2] = vowels[Math.floor(Math.random() * vowels.length)];
      const b1 = ctx.createBiquadFilter();
      b1.type = 'bandpass';
      b1.frequency.value = f1;
      b1.Q.value = 6;
      const b2 = ctx.createBiquadFilter();
      b2.type = 'bandpass';
      b2.frequency.value = f2;
      b2.Q.value = 8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + syl);
      o.connect(b1);
      o.connect(b2);
      b1.connect(g);
      b2.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + syl + 0.02);
      t += syl + (Math.random() < 0.18 ? 0.16 : 0.025);
    }
  }

  // ------------------------------------------------------------ SFX

  sfx(name: SfxName, vol = 1): void {
    if (!this.ctx || !this.sfxOn) return;
    const fileKey = `sfx.${name}`;
    const buf = this.buffers.get(fileKey);
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      s.connect(g);
      g.connect(this.sfxBus);
      s.start();
      return;
    }
    if (this.files.has(fileKey)) void this.loadFile(fileKey);
    this.synth(name, vol);
  }

  private async loadFile(key: string): Promise<void> {
    if (!this.ctx || this.loading.has(key) || this.buffers.has(key)) return;
    const e = this.files.get(key);
    if (!e?.path) return;
    this.loading.add(key);
    try {
      const res = await fetch(e.path);
      const arr = await res.arrayBuffer();
      this.buffers.set(key, await this.ctx.decodeAudioData(arr));
    } catch (err) {
      console.warn('[Audio] no se pudo cargar', key, err);
    }
  }

  private env(g: GainNode, t: number, peak: number, a: number, d: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private noiseShot(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, out: AudioNode = this.sfxBus): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.004, dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, out: AudioNode = this.sfxBus): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, 0.005, dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private synth(name: SfxName, vol: number): void {
    const t = this.ctx!.currentTime + 0.01;
    const v = vol;
    switch (name) {
      case 'door_open':
        this.noiseShot(t, 0.18, 'bandpass', 900, 1.2, 0.25 * v);
        this.tone(t + 0.02, 'triangle', 320, 240, 0.12, 0.08 * v);
        break;
      case 'door_close':
        this.tone(t, 'sine', 120, 60, 0.18, 0.4 * v);
        this.noiseShot(t, 0.08, 'lowpass', 600, 0.8, 0.3 * v);
        break;
      case 'car_door':
        this.tone(t, 'sine', 95, 50, 0.16, 0.5 * v);
        this.noiseShot(t, 0.06, 'bandpass', 1400, 2, 0.18 * v);
        this.noiseShot(t + 0.02, 0.1, 'lowpass', 400, 0.7, 0.25 * v);
        break;
      case 'thud':
        this.tone(t, 'sine', 80, 40, 0.2, 0.45 * v);
        break;
      case 'brake':
        this.tone(t, 'triangle', 2300, 1900, 0.35, 0.05 * v);
        this.noiseShot(t, 0.3, 'bandpass', 3000, 3, 0.07 * v);
        break;
      case 'horn':
        this.tone(t, 'square', 392, 392, 0.32, 0.07 * v);
        this.tone(t, 'square', 494, 494, 0.32, 0.06 * v);
        break;
      case 'blinker':
        this.noiseShot(t, 0.015, 'highpass', 3000, 0.7, 0.12 * v);
        break;
      case 'phone_ring':
        for (let i = 0; i < 4; i++) {
          this.tone(t + i * 0.12, 'square', i % 2 ? 1320 : 1568, i % 2 ? 1320 : 1568, 0.09, 0.05 * v);
        }
        break;
      case 'phone_pickup':
        this.tone(t, 'sine', 660, 990, 0.08, 0.06 * v);
        break;
      case 'notify':
        this.tone(t, 'sine', 988, 988, 0.08, 0.1 * v);
        this.tone(t + 0.1, 'sine', 1319, 1319, 0.12, 0.1 * v);
        break;
      case 'paper':
        this.noiseShot(t, 0.12, 'bandpass', 3500, 1.4, 0.16 * v);
        this.noiseShot(t + 0.07, 0.1, 'bandpass', 2600, 1.6, 0.12 * v);
        break;
      case 'stamp':
        this.tone(t, 'sine', 160, 70, 0.14, 0.55 * v);
        this.noiseShot(t, 0.05, 'highpass', 2500, 0.7, 0.2 * v);
        break;
      case 'step':
        this.noiseShot(t, 0.05, 'lowpass', 700 + Math.random() * 300, 0.8, 0.12 * v);
        break;
      case 'ui_click':
        this.tone(t, 'square', 880, 880, 0.03, 0.04 * v);
        break;
      case 'ui_confirm':
        this.tone(t, 'square', 660, 660, 0.05, 0.05 * v);
        this.tone(t + 0.06, 'square', 990, 990, 0.08, 0.05 * v);
        break;
      case 'ui_back':
        this.tone(t, 'square', 520, 390, 0.08, 0.04 * v);
        break;
      case 'radio_on':
        this.noiseShot(t, 0.35, 'bandpass', 2000, 0.5, 0.12 * v);
        this.tone(t + 0.3, 'square', 1200, 1200, 0.02, 0.04 * v);
        break;
      case 'car_alarm':
        for (let i = 0; i < 6; i++) this.tone(t + i * 0.25, 'square', i % 2 ? 900 : 1400, i % 2 ? 1400 : 900, 0.24, 0.03 * v);
        break;
      case 'ticket':
        this.noiseShot(t, 0.25, 'bandpass', 1800, 4, 0.08 * v);
        this.tone(t + 0.27, 'square', 1500, 1500, 0.03, 0.04 * v);
        break;
      case 'error_beep':
        this.tone(t, 'square', 440, 440, 0.12, 0.06 * v);
        this.tone(t + 0.16, 'square', 330, 330, 0.22, 0.06 * v);
        break;
      case 'register':
        this.tone(t, 'sine', 1760, 1760, 0.15, 0.08 * v);
        this.noiseShot(t + 0.05, 0.12, 'bandpass', 2500, 1, 0.08 * v);
        break;
      case 'murmur':
        this.noiseShot(t, 1.2, 'lowpass', 500, 0.5, 0.05 * v, this.ambBus);
        break;
      case 'dog_bark':
        this.tone(t, 'sawtooth', 420, 260, 0.1, 0.07 * v);
        this.noiseShot(t, 0.1, 'bandpass', 900, 2, 0.1 * v);
        break;
      case 'gust':
        this.noiseShot(t, 1.4, 'bandpass', 700, 0.6, 0.12 * v, this.ambBus);
        break;
      case 'whoosh':
        this.noiseShot(t, 0.35, 'bandpass', 1200, 0.8, 0.1 * v);
        break;
    }
  }
}
