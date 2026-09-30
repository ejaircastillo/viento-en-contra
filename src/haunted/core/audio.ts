/**
 * Sonido procedural con WebAudio (sin archivos): viento, crepitar del fuego, zumbido de la cripta, un búho
 * lejano, "blips" de voz por personaje y unos pocos efectos. El contexto se crea recién con el primer gesto
 * del usuario (política de autoplay) y todo falla en silencio si el navegador no lo soporta.
 */
export type AreaSound = 'graveyard' | 'crypt';
export type Voice = 'huesos' | 'lutin' | 'pelusa' | 'ghost' | 'narrator';
export type Sfx = 'open' | 'close' | 'door' | 'stamp' | 'seal' | 'bark' | 'puff' | 'dig' | 'pickup';

const VOICES: Record<Voice, { type: OscillatorType; base: number; spread: number; vol: number }> = {
  huesos: { type: 'square', base: 150, spread: 40, vol: 0.05 },
  lutin: { type: 'triangle', base: 470, spread: 90, vol: 0.09 },
  pelusa: { type: 'sine', base: 720, spread: 160, vol: 0.09 },
  ghost: { type: 'sine', base: 310, spread: 40, vol: 0.07 },
  narrator: { type: 'triangle', base: 260, spread: 30, vol: 0.06 },
};

export class Sound {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private white: AudioBuffer | null = null;
  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private fireBed: GainNode | null = null;
  private drone: GainNode | null = null;
  private area: AreaSound = 'graveyard';
  private t = 0;
  private nextCrackle = 0;
  private nextOwl = 14;

  /** Primer gesto del usuario: crea (o reanuda) el contexto de audio. */
  unlock(): void {
    try {
      if (!this.ctx) this.build();
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.08);
  }

  setArea(a: AreaSound): void {
    this.area = a;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.drone?.gain.setTargetAtTime(a === 'crypt' ? 0.035 : 0, now, 0.5);
  }

  private build(): void {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.9;
    master.connect(ctx.destination);
    this.master = master;

    // ruido blanco de 2 s y su versión "marrón" (graves) para el viento
    const len = ctx.sampleRate * 2;
    const white = ctx.createBuffer(1, len, ctx.sampleRate);
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = white.getChannelData(0);
    const b = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const r = Math.random() * 2 - 1;
      w[i] = r;
      last = (last + 0.02 * r) / 1.02;
      b[i] = last * 3.2;
    }
    this.white = white;

    const windSrc = ctx.createBufferSource();
    windSrc.buffer = brown;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.6;
    windFilter.frequency.value = 400;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    windSrc.connect(windFilter).connect(windGain).connect(master);
    windSrc.start();
    this.wind = { gain: windGain, filter: windFilter };

    const fireSrc = ctx.createBufferSource();
    fireSrc.buffer = brown;
    fireSrc.loop = true;
    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.value = 140;
    fireFilter.Q.value = 0.9;
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    fireSrc.connect(fireFilter).connect(fireGain).connect(master);
    fireSrc.start();
    this.fireBed = fireGain;

    const drone = ctx.createGain();
    drone.gain.value = 0;
    drone.connect(master);
    for (const [f, d] of [[55, 0], [82.6, 3], [110.4, -4]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(drone);
      o.start();
    }
    this.drone = drone;
    this.setArea(this.area);
  }

  /** Cada cuadro: ráfagas de viento, crepitar según la cercanía a la fogata y el búho ocasional. */
  update(dt: number, fire: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.wind) return;
    this.t += dt;
    const now = ctx.currentTime;
    const gust = 0.5 + 0.3 * Math.sin(this.t * 0.21) + 0.2 * Math.sin(this.t * 0.57 + 1.3);
    const outdoors = this.area === 'graveyard' ? 1 : 0.16;
    this.wind.filter.frequency.setTargetAtTime(220 + 420 * gust, now, 0.3);
    this.wind.gain.gain.setTargetAtTime((0.12 + 0.22 * gust) * outdoors, now, 0.3);
    const f = this.area === 'graveyard' ? fire : 0.22;
    this.fireBed?.gain.setTargetAtTime(f * 0.3, now, 0.25);
    this.nextCrackle -= dt;
    if (this.nextCrackle <= 0 && f > 0.03) {
      this.crackle(f);
      this.nextCrackle = 0.025 + (Math.random() * 0.22) / (0.25 + f);
    }
    if (this.area === 'graveyard') {
      this.nextOwl -= dt;
      if (this.nextOwl <= 0) {
        this.owl();
        this.nextOwl = 20 + Math.random() * 25;
      }
    }
  }

  private noiseBurst(dur: number, freq: number, type: BiquadFilterType, vol: number, at = 0, q = 0.8, sweepTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.white || !this.master) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    src.loopStart = Math.random() * 1.5;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(freq, t0);
    if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt).connect(g).connect(this.master);
    src.start(t0, src.loopStart, dur + 0.05);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0, lowpass = 4000): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(flt).connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private crackle(f: number): void {
    this.noiseBurst(0.012 + Math.random() * 0.035, 1800 + Math.random() * 2600, 'highpass', 0.06 + 0.2 * f * Math.random(), 0, 0.7);
  }

  private owl(): void {
    this.tone('sine', 410, 360, 0.32, 0.05, 0, 900);
    this.tone('sine', 400, 330, 0.5, 0.05, 0.5, 900);
  }

  /** Un "blip" de voz por letra (la máquina de escribir de los diálogos). */
  blip(v: Voice): void {
    if (!this.ready) return;
    const c = VOICES[v];
    const f = c.base + (Math.random() - 0.5) * c.spread;
    this.tone(c.type, f, f * 0.92, 0.045, c.vol, 0, v === 'huesos' ? 900 : 3200);
  }

  sfx(name: Sfx): void {
    if (!this.ready) return;
    switch (name) {
      case 'open':
        this.tone('sine', 660, 990, 0.12, 0.05);
        break;
      case 'close':
        this.tone('sine', 880, 560, 0.1, 0.04);
        break;
      case 'door':
        this.noiseBurst(0.7, 380, 'bandpass', 0.07, 0, 4, 120);
        this.tone('sawtooth', 96, 58, 0.7, 0.03, 0, 500);
        break;
      case 'stamp':
        this.tone('sine', 150, 42, 0.3, 0.6);
        this.noiseBurst(0.12, 320, 'lowpass', 0.4);
        this.noiseBurst(0.3, 5200, 'highpass', 0.05, 0.08);
        break;
      case 'seal':
        [523, 659, 784, 1046].forEach((f, i) => this.tone('sine', f, f, 0.5, 0.06, i * 0.09));
        break;
      case 'bark':
        this.tone('sawtooth', 520, 300, 0.11, 0.08, 0, 1400);
        this.tone('sawtooth', 560, 320, 0.11, 0.08, 0.17, 1400);
        break;
      case 'puff':
        this.tone('sawtooth', 120, 64, 0.28, 0.08, 0, 420);
        this.noiseBurst(0.22, 260, 'lowpass', 0.14);
        break;
      case 'dig':
        for (let i = 0; i < 3; i++) this.noiseBurst(0.09, 520, 'lowpass', 0.22, i * 0.16);
        break;
      case 'pickup':
        this.tone('sine', 660, 660, 0.18, 0.06);
        this.tone('sine', 990, 990, 0.3, 0.06, 0.1);
        break;
    }
  }
}
