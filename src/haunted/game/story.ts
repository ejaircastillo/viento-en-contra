import { runDialogue, type DialogueEnv, type Flags } from '../../engine/dialogue/Dialogue';
import { DIALOGUES, EPITAPHS, SPEAKERS, type Epitaph } from './content';

/**
 * La historia y las misiones de "Fantasma en trámite": qué pasa al interactuar con cada cosa, según en qué
 * etapa esté el jugador. No conoce three.js ni el DOM: habla con el juego a través de `StoryHost`, por eso se
 * puede probar con un host de mentira.
 *
 * Etapas: 0 recién llegado · 1 habló con Don Huesos · 2 Pelusa desenterró el sello · 3 tiene el sello ·
 * 4 certificado sellado (fin de la demo).
 */
export interface StoryHost {
  say(name: string, text: string): Promise<void>;
  choose(options: string[]): Promise<number>;
  inscription(e: Epitaph): Promise<void>;
  /** Id del personaje que habla ahora (o null) para animarlo. */
  talking(id: string | null): void;
  objective(text: string | null): void;
  toast(text: string): void;
  /** Enciende el puntito de "novedad" del diario o del bolso. */
  notify(kind: 'journal' | 'bag'): void;
  /** La perrita corre al árbol seco y desentierra el sello (resuelve cuando ya apareció). */
  dogLead(): Promise<void>;
  takeSeal(): void;
  stamp(): Promise<void>;
  ending(): Promise<void>;
  sleep(ms: number): Promise<void>;
}

export interface Item {
  id: string;
  name: string;
  note: string;
}

export interface JournalLine {
  text: string;
  note?: string;
  done?: boolean;
}

const OBJECTIVES = [
  'Acercate a la fogata y hablá con Don Huesos',
  'Pelusa sabe dónde enterró el sello: hablale',
  'Levantá el sello oxidado al pie del árbol seco',
  'Llevale el sello a Lutin, en la cripta',
  'Certificado en mano. Seguí flotando: todo vale desde mañana',
];

export class Story {
  flags: Flags = {};
  stage = 0;
  inventory: Item[] = [];
  epitaphsRead = new Set<string>();
  busy = false;

  constructor(private host: StoryHost) {}

  get objective(): string {
    return OBJECTIVES[this.stage];
  }

  start(): void {
    this.host.objective(this.objective);
  }

  has(id: string): boolean {
    return this.inventory.some((i) => i.id === id);
  }

  private give(item: Item): void {
    if (this.has(item.id)) return;
    this.inventory.push(item);
    this.host.notify('bag');
    this.host.toast(`Nuevo en el bolso: ${item.name}`);
  }

  private advance(to: number): void {
    if (to <= this.stage) return;
    this.stage = to;
    this.host.objective(this.objective);
    this.host.notify('journal');
  }

  journal(): JournalLine[] {
    const s = this.stage;
    const lines: JournalLine[] = [{ text: 'Conseguir el Certificado de Descanso Eterno', note: s >= 4 ? 'Sellado. Rige desde mañana.' : this.objective, done: s >= 4 }];
    if (s >= 1) lines.push({ text: 'Don Huesos dice que Lutin perdió el sello oficial', note: 'La perra Pelusa lo enterró "para que no se pierda".', done: s >= 3 });
    if (s >= 2) lines.push({ text: 'Pelusa cavó al pie del árbol seco', note: 'Hay algo oxidado entre las raíces.', done: s >= 3 });
    if (s >= 3) lines.push({ text: 'Tengo el sello: hay que llevarlo a la cripta', done: s >= 4 });
    lines.push({ text: `Epitafios leídos: ${this.epitaphsRead.size} de ${Object.keys(EPITAPHS).length}`, note: 'Cada lápida cuenta algo de la ciudad.' });
    return lines;
  }

  private env(): DialogueEnv {
    return {
      characterId: 'ghost',
      flags: this.flags,
      vocab: {},
      speaker: (id) => ({ name: SPEAKERS[id] ?? id }),
      say: async (sp, text) => this.host.say(sp?.name ?? '', text),
      choose: (opts) => this.host.choose(opts.map((o) => o.text)),
      thought: () => {},
      hook: (name) => this.hook(name),
      wait: (ms) => this.host.sleep(ms),
    };
  }

  private async hook(name: string): Promise<void> {
    if (name === 'give_candle') this.give({ id: 'vela', name: 'Vela de trámites', note: 'Alumbra el papeleo. No calienta, pero queda lindo.' });
    else if (name === 'dog_lead') {
      this.host.talking(null); // la perrita sale corriendo: ya no está "hablando"
      await this.host.dogLead();
      this.advance(2);
    } else if (name === 'stamp') await this.host.stamp();
    else if (name === 'finish') {
      this.inventory = this.inventory.filter((i) => i.id !== 'sello');
      this.give({ id: 'certificado', name: 'Certificado de Descanso Eterno', note: 'N° 000001 · vigente desde las 00:00 de mañana.' });
      this.advance(4);
      await this.host.ending();
    }
  }

  private async talk(id: string, key: string): Promise<void> {
    this.host.talking(id);
    try {
      await runDialogue(DIALOGUES[key], this.env());
    } finally {
      this.host.talking(null);
    }
  }

  /** Lo que pasa al usar un interactuable (las puertas las maneja el juego). */
  async interact(id: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.run(id);
    } finally {
      this.busy = false;
    }
  }

  private async run(id: string): Promise<void> {
    if (id === 'skeleton') {
      if (this.stage === 0) {
        await this.talk(id, 'huesos_intro');
        this.advance(1);
      } else if (this.stage === 3 && !this.flags.huesos_seal) {
        this.flags.huesos_seal = true;
        await this.talk(id, 'huesos_seal');
      } else await this.talk(id, this.stage >= 4 ? 'huesos_done' : 'huesos_again');
    } else if (id === 'dog') {
      if (this.stage === 0) await this.talk(id, 'pelusa_before');
      else if (this.stage === 1) await this.talk(id, 'pelusa_ask');
      else await this.talk(id, 'pelusa_after');
    } else if (id === 'seal') {
      this.host.takeSeal();
      this.give({ id: 'sello', name: 'Sello oxidado', note: 'Dice "APROBADO". O "ABROBADO". La goma está más dura que un trámite.' });
      this.advance(3);
      await this.host.inscription({ kicker: 'Encontraste', name: 'Sello oxidado', lines: ['Dice "APROBADO". O "ABROBADO".', 'La goma está más dura que un trámite.'] });
    } else if (id === 'lutin') {
      if (this.stage >= 4) await this.talk(id, 'lutin_done');
      else if (this.stage >= 3 && this.has('sello')) await this.talk(id, 'lutin_stamp');
      else await this.talk(id, 'lutin_noseal');
    } else if (EPITAPHS[id]) {
      const first = !this.epitaphsRead.has(id);
      this.epitaphsRead.add(id);
      await this.host.inscription(EPITAPHS[id]);
      if (first) {
        this.host.notify('journal');
        if (this.epitaphsRead.size === 6) this.host.toast('Ya leíste la mitad de las lápidas: la ciudad se cuenta sola.');
        if (this.epitaphsRead.size === Object.keys(EPITAPHS).length) this.host.toast('Leíste todas las inscripciones. Nadie lo había hecho antes.');
      }
    }
  }
}
