import { formatHHMM, parseHHMM } from '../core/math';

/**
 * Reloj narrativo tolerante. El tiempo corre a una tasa (minutos de juego por segundo real)
 * y cada estado del capítulo puede fijar una ventana [min, max]:
 *  - nunca supera `max` (se desacelera suavemente al acercarse),
 *  - al cerrar el estado se adelanta a `min` si quedó atrás.
 * Así la historia mantiene horarios coherentes sin castigar al jugador lento o rápido.
 *
 * El significado del reloj lo define el contenido (ej. "Entrada 08:00" / "Inspección 08:30").
 */
export interface ClockMeaning {
  label: string;
  deadline: string;
  lateLabel: string;
  warnMinutes?: number;
}

export class GameClock {
  minutes = 7 * 60 + 28;
  rate = 0.1;
  running = false;
  private windowMin: number | null = null;
  private windowMax: number | null = null;
  meaning: ClockMeaning | null = null;
  private listeners = new Set<(m: number) => void>();
  private lastWhole = -1;

  set(hhmm: string | number): void {
    this.minutes = typeof hhmm === 'number' ? hhmm : parseHHMM(hhmm);
    this.emit(true);
  }

  window(min: string | null, max: string | null, rate?: number): void {
    this.windowMin = min ? parseHHMM(min) : null;
    this.windowMax = max ? parseHHMM(max) : null;
    if (rate !== undefined) this.rate = rate;
  }

  /** Salto narrativo (ej. "pasaron 5 minutos en la llamada"). Respeta la ventana máxima si se pide. */
  advance(mins: number, clampToWindow = false): void {
    let t = this.minutes + mins;
    if (clampToWindow && this.windowMax !== null) t = Math.min(t, this.windowMax);
    this.minutes = t;
    this.emit(true);
  }

  /** Adelanta hasta el mínimo de la ventana actual (cierre de estado). */
  settle(): void {
    if (this.windowMin !== null && this.minutes < this.windowMin) {
      this.minutes = this.windowMin;
      this.emit(true);
    }
  }

  update(dtSeconds: number): void {
    if (!this.running) return;
    let r = this.rate;
    if (this.windowMax !== null) {
      const left = this.windowMax - this.minutes;
      if (left <= 0) return;
      if (left < 2) r *= Math.max(0.08, left / 2);
    }
    this.minutes += r * dtSeconds;
    if (this.windowMax !== null) this.minutes = Math.min(this.windowMax, this.minutes);
    this.emit(false);
  }

  private emit(force: boolean): void {
    const whole = Math.floor(this.minutes);
    if (!force && whole === this.lastWhole) return;
    this.lastWhole = whole;
    for (const l of this.listeners) l(this.minutes);
  }

  onChange(fn: (m: number) => void): () => void {
    this.listeners.add(fn);
    fn(this.minutes);
    return () => this.listeners.delete(fn);
  }

  get text(): string {
    return formatHHMM(this.minutes);
  }

  /** Minutos hasta la hora límite del significado actual (negativo = pasada). */
  get untilDeadline(): number | null {
    if (!this.meaning) return null;
    return parseHHMM(this.meaning.deadline) - this.minutes;
  }

  at(hhmm: string): boolean {
    return this.minutes >= parseHHMM(hhmm);
  }
}
