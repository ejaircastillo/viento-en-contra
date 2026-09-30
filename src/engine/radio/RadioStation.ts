/**
 * Radio 89 (nombre de trabajo): acompaña los trayectos sin detener la partida.
 * Regla narrativa: la radio informa; el personaje reacciona (pensamiento breve, opcional).
 * El contenido define ítems y programas; el motor los reproduce en orden y rellena con música.
 */

export interface RadioItem {
  id: string;
  kind: 'news' | 'traffic' | 'weather' | 'ad' | 'jingle' | 'music' | 'flash' | 'sports' | 'id';
  text?: string;
  track?: string;
  seconds?: number;
  /** Reacción por personaje (id → texto). `all` aplica a todos. */
  react?: Record<string, string>;
}

export interface RadioLibrary {
  station: string;
  items: Record<string, RadioItem>;
  programs: Record<string, string[]>;
  filler: string[];
}

const KIND_LABEL: Record<RadioItem['kind'], string> = {
  news: 'NOTICIAS',
  traffic: 'TRÁNSITO',
  weather: 'EL TIEMPO',
  ad: 'PUBLICIDAD',
  jingle: 'RADIO 89',
  music: 'MÚSICA',
  flash: 'ÚLTIMO MOMENTO',
  sports: 'DEPORTES',
  id: 'RADIO 89',
};

export interface RadioHost {
  showText(kind: string, text: string): void;
  showIdle(text: string): void;
  speech(seconds: number): void;
  music(trackId: string | null): void;
  trackTitle(trackId: string): string;
  duck(on: boolean): void;
  react(text: string): void;
  sfx(name: 'radio_on'): void;
  emit(itemId: string): void;
}

type State = 'idle' | 'speaking' | 'holding' | 'music' | 'gap';

export class RadioStation {
  private lib: RadioLibrary | null = null;
  private queue: string[] = [];
  private played = new Set<string>();
  private state: State = 'idle';
  private t = 0;
  private until = 0;
  private current: RadioItem | null = null;
  private fillerIdx = 0;
  private reactPending: string | null = null;
  private reactAt = 0;
  private active = false;
  characterId = '';
  host: RadioHost | null = null;
  enabled = true;

  setLibrary(lib: RadioLibrary): void {
    this.lib = lib;
    this.played.clear();
  }

  /** Programa a reproducir en el próximo trayecto (lista ordenada de ítems). */
  program(id: string): void {
    if (!this.lib) return;
    this.queue = (this.lib.programs[id] ?? []).filter((i) => !this.played.has(i));
  }

  /** Inserta un ítem para que suene a continuación (interrumpe música). */
  flash(itemId: string): void {
    if (!this.lib?.items[itemId]) return;
    this.queue.unshift(itemId);
    if (this.state === 'music' || this.state === 'gap' || this.state === 'idle') this.endCurrent(0.4);
  }

  markPlayed(ids: string[]): void {
    for (const id of ids) this.played.add(id);
  }

  get isOn(): boolean {
    return this.active && this.enabled;
  }

  /** El auto encendió/apagó la radio (sólo suena dentro del auto). */
  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    if (!on || !this.enabled) this.silence();
    else this.turnedOn();
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) this.silence();
    else if (this.active) this.turnedOn();
  }

  private turnedOn(): void {
    this.host?.sfx('radio_on');
    this.state = 'gap';
    this.t = 0;
    this.until = 0.8;
  }

  private silence(): void {
    if (this.state === 'speaking' || this.state === 'holding') this.host?.duck(false);
    this.host?.music(null);
    this.state = 'idle';
    this.current = null;
  }

  private endCurrent(gap: number): void {
    if (this.state === 'speaking' || this.state === 'holding') this.host?.duck(false);
    if (this.state === 'music') this.host?.music(null);
    this.state = 'gap';
    this.t = 0;
    this.until = gap;
  }

  private nextItem(): RadioItem | null {
    if (!this.lib) return null;
    while (this.queue.length) {
      const id = this.queue.shift()!;
      const it = this.lib.items[id];
      if (it && !this.played.has(id)) return it;
    }
    if (!this.lib.filler.length) return null;
    const id = this.lib.filler[this.fillerIdx++ % this.lib.filler.length];
    return this.lib.items[id] ?? null;
  }

  update(dt: number): void {
    if (this.reactPending && this.t >= this.reactAt && this.state !== 'speaking') {
      this.host?.react(this.reactPending);
      this.reactPending = null;
    }
    if (!this.isOn || !this.host) return;
    this.t += dt;
    switch (this.state) {
      case 'idle':
      case 'gap':
        if (this.t >= this.until) this.start();
        break;
      case 'speaking':
        if (this.t >= this.until) {
          this.state = 'holding';
          this.t = 0;
          this.until = 1.6;
        }
        break;
      case 'holding':
        if (this.t >= this.until) {
          const it = this.current;
          this.host.duck(false);
          const reaction = it?.react?.[this.characterId] ?? it?.react?.all;
          if (reaction) {
            this.reactPending = reaction;
            this.reactAt = 0.9;
          }
          this.state = 'gap';
          this.t = 0;
          this.until = reaction ? 6.5 : 2.4;
        }
        break;
      case 'music':
        if (this.t >= this.until) this.endCurrent(1.2);
        break;
    }
  }

  private start(): void {
    const it = this.nextItem();
    this.t = 0;
    if (!it || !this.host) {
      this.state = 'idle';
      this.until = 4;
      return;
    }
    this.current = it;
    if (it.kind !== 'music') this.played.add(it.id);
    this.host.emit(it.id);
    if (it.kind === 'music' && it.track) {
      this.state = 'music';
      this.until = it.seconds ?? 22;
      this.host.music(it.track);
      this.host.showIdle(`♪ ${this.host.trackTitle(it.track)}`);
      return;
    }
    const text = it.text ?? '';
    this.state = 'speaking';
    const secs = Math.max(2.4, text.length * 0.052);
    this.until = secs;
    this.host.duck(true);
    this.host.speech(Math.min(secs, 7));
    this.host.showText(KIND_LABEL[it.kind], text);
  }

  reset(): void {
    this.silence();
    this.queue = [];
    this.played.clear();
    this.reactPending = null;
    this.active = false;
  }
}
