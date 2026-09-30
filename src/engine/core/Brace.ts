/**
 * Modelo del minijuego "aguantar el cartel" (ensayo eólico). Sin DOM ni Phaser: se simula con
 * dt y el estado del botón, así se puede probar en tests y correr solo en ?autoplay.
 *
 * Reglas (sin castigo duro: el capítulo siempre avanza, sólo cambia el comentario del técnico):
 *  - Vienen ráfagas con un aviso previo. Hay que APRETAR "agarrar" cuando pega la ráfaga y SOLTAR al pasar.
 *  - Sin agarre, el cartel se va resbalando (`slip`); si llega a 1, se vuela y esa ráfaga cuenta como perdida.
 *  - Agarrar cansa (`stamina`): apretar de más, o antes de tiempo, te deja sin fuerza justo cuando pega fuerte.
 */

export interface GustSpec {
  /** Calma antes del aviso (s). */
  gap: number;
  /** Duración de la ráfaga (s). */
  dur: number;
  /** Fuerza máxima (0–1). */
  peak: number;
}

/** Cinco ráfagas: crecientes, con una doble casi seguida y la más larga al final. */
export const DEFAULT_GUSTS: GustSpec[] = [
  { gap: 1.2, dur: 1.8, peak: 0.65 },
  { gap: 1.9, dur: 2.3, peak: 0.8 },
  { gap: 1.7, dur: 1.3, peak: 0.85 },
  { gap: 0.9, dur: 1.4, peak: 0.9 },
  { gap: 2.1, dur: 2.6, peak: 1 },
];

/** Segundos de aviso antes de cada ráfaga. */
export const BRACE_WARN = 0.9;
export const BRACE_CALM = 0.12;
const DRAIN = 0.42;
const RECOVER = 0.5;
const LOCK = 0.7;

export type BracePhase = 'gap' | 'warn' | 'gust' | 'done';
export type BraceEvent = 'warn' | 'gust' | 'slip' | 'held' | 'done';

export class BraceModel {
  phase: BracePhase = 'gap';
  /** Índice de la ráfaga actual o próxima. */
  index = 0;
  /** Fuerza del viento ahora (0–1). */
  level = BRACE_CALM;
  /** 0 = cartel firme, 1 = se vuela. */
  slip = 0;
  /** 1 = descansado, 0 = sin fuerza. */
  stamina = 1;
  /** Segundos que faltan para poder agarrar de nuevo tras quedarse sin fuerza. */
  locked = 0;
  slips = 0;
  held = 0;
  /** ¿Está agarrando efectivamente (botón apretado y con fuerza)? */
  gripping = false;
  readonly events: BraceEvent[] = [];
  private t = 0;
  private gapLen: number;

  constructor(readonly gusts: GustSpec[] = DEFAULT_GUSTS) {
    this.gapLen = gusts.length ? this.calmFor(0) : 0;
    if (!gusts.length) this.finish();
  }

  get total(): number {
    return this.gusts.length;
  }

  get done(): boolean {
    return this.phase === 'done';
  }

  /** Progreso 0–1 sobre el total de ráfagas. */
  get progress(): number {
    return this.done ? 1 : (this.held + this.slips) / Math.max(1, this.total);
  }

  private calmFor(i: number): number {
    return Math.max(0.2, this.gusts[i].gap - BRACE_WARN);
  }

  private finish(): void {
    this.phase = 'done';
    this.level = BRACE_CALM;
    this.events.push('done');
  }

  private nextGust(): void {
    this.index++;
    this.t = 0;
    if (this.index >= this.gusts.length) {
      this.finish();
      return;
    }
    this.phase = 'gap';
    this.gapLen = this.calmFor(this.index);
    this.level = BRACE_CALM;
  }

  step(dt: number, holding: boolean): void {
    if (this.phase === 'done') return;
    this.t += dt;
    // fuerza y cansancio
    if (this.locked > 0) this.locked = Math.max(0, this.locked - dt);
    this.gripping = holding && this.locked <= 0 && this.stamina > 0;
    if (this.gripping) {
      this.stamina -= DRAIN * dt;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.locked = LOCK;
        this.gripping = false;
      }
    } else if (this.locked <= 0) {
      this.stamina = Math.min(1, this.stamina + RECOVER * dt);
    }
    if (this.gripping) this.slip = Math.max(0, this.slip - 1.5 * dt);

    const g = this.gusts[this.index];
    switch (this.phase) {
      case 'gap':
        this.level = BRACE_CALM;
        if (this.t >= this.gapLen) {
          this.phase = 'warn';
          this.t = 0;
          this.events.push('warn');
        }
        break;
      case 'warn':
        this.level = BRACE_CALM + (0.3 - BRACE_CALM) * Math.min(1, this.t / BRACE_WARN);
        if (this.t >= BRACE_WARN) {
          this.phase = 'gust';
          this.t = 0;
          this.events.push('gust');
        }
        break;
      case 'gust': {
        const k = Math.min(1, this.t / g.dur);
        this.level = BRACE_CALM + (g.peak - BRACE_CALM) * Math.sin(Math.PI * k);
        if (!this.gripping) this.slip += (0.55 + this.level * 1.1) * dt;
        if (this.slip >= 1) {
          this.slips++;
          this.slip = 0.35;
          this.events.push('slip');
          this.nextGust();
        } else if (k >= 1) {
          this.held++;
          this.events.push('held');
          this.nextGust();
        }
        break;
      }
    }
  }

  /** Saca (y vacía) los eventos pendientes. */
  drain(): BraceEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
