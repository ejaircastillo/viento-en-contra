/**
 * Guardado local simple (localStorage), versionado y tolerante a fallos:
 * si el navegador bloquea el almacenamiento, el juego sigue funcionando sin guardar.
 */

export interface Settings {
  music: boolean;
  sfx: boolean;
  radio: boolean;
  assistedDriving: boolean;
  /** Lectura ampliada de carteles (texto nítido al pasar cerca). auto = sólo en pantallas chicas. */
  signCaptions: 'auto' | 'on' | 'off';
  reducedMotion: boolean;
  textSpeed: 'normal' | 'fast';
}

export interface RunState {
  chapterId: string;
  characterId: string;
  stateId: string;
  flags: Record<string, string | number | boolean>;
  clock: number;
  startedAt: number;
}

export interface SaveData {
  v: number;
  settings: Settings;
  run: RunState | null;
  completed: Record<string, string[]>;
  /** Flags persistentes entre capítulos ("consecuencias"). */
  global: Record<string, string | number | boolean>;
}

const KEY = 'viento-en-contra/save';
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  music: true,
  sfx: true,
  radio: true,
  assistedDriving: false,
  signCaptions: 'auto',
  reducedMotion: false,
  textSpeed: 'normal',
};

function fresh(): SaveData {
  return { v: VERSION, settings: { ...DEFAULT_SETTINGS }, run: null, completed: {}, global: {} };
}

export class SaveSystem {
  data: SaveData;
  private listeners = new Set<(s: Settings) => void>();

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return this.migrate(parsed);
    } catch {
      return fresh();
    }
  }

  private migrate(p: Partial<SaveData>): SaveData {
    const base = fresh();
    return {
      v: VERSION,
      settings: { ...base.settings, ...(p.settings ?? {}) },
      run: p.run ?? null,
      completed: p.completed ?? {},
      global: p.global ?? {},
    };
  }

  /** ?nosave (QA): no escribe en localStorage para no pisar la partida real. */
  private readonly readonly = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nosave');

  persist(): void {
    if (this.readonly) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* almacenamiento no disponible: seguimos sin guardar */
    }
  }

  get settings(): Settings {
    return this.data.settings;
  }

  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void {
    this.data.settings[k] = v;
    this.persist();
    for (const l of this.listeners) l(this.data.settings);
  }

  onSettings(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  startRun(chapterId: string, characterId: string, stateId: string): void {
    this.data.run = { chapterId, characterId, stateId, flags: {}, clock: 0, startedAt: Date.now() };
    this.persist();
  }

  checkpoint(stateId: string, flags: Record<string, string | number | boolean>, clock: number): void {
    if (!this.data.run) return;
    this.data.run.stateId = stateId;
    this.data.run.flags = { ...flags };
    this.data.run.clock = clock;
    this.persist();
  }

  complete(chapterId: string, characterId: string, carry: Record<string, string | number | boolean>): void {
    const list = this.data.completed[chapterId] ?? [];
    if (!list.includes(characterId)) list.push(characterId);
    this.data.completed[chapterId] = list;
    for (const [k, v] of Object.entries(carry)) this.data.global[`${characterId}.${k}`] = v;
    this.data.run = null;
    this.persist();
  }

  clearRun(): void {
    this.data.run = null;
    this.persist();
  }

  hasRun(): boolean {
    return !!this.data.run;
  }
}
