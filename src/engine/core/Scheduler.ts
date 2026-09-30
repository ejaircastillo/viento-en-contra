/**
 * Tiempo de juego pausable + esperas cancelables para los guiones de capítulo.
 * Todo `await` de un guion pasa por acá, de modo que pausar el juego congela
 * también la narrativa, y salir al menú cancela el guion limpiamente.
 */

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

export class CancelToken {
  cancelled = false;
  private cbs = new Set<() => void>();

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const cb of [...this.cbs]) cb();
    this.cbs.clear();
  }

  onCancel(cb: () => void): () => void {
    if (this.cancelled) {
      cb();
      return () => {};
    }
    this.cbs.add(cb);
    return () => this.cbs.delete(cb);
  }

  throwIfCancelled(): void {
    if (this.cancelled) throw new CancelledError();
  }
}

interface Timer {
  at: number;
  resolve: () => void;
  offCancel?: () => void;
}

interface Waiter {
  pred: () => boolean;
  resolve: () => void;
  offCancel?: () => void;
}

export class Scheduler {
  /** ms de juego transcurridos (no avanza en pausa). */
  time = 0;
  paused = false;
  /** Multiplicador global (debug ?speed=3). */
  timeScale = 1;
  private timers: Timer[] = [];
  private waiters: Waiter[] = [];

  update(realDtMs: number): number {
    if (this.paused) return 0;
    const dt = realDtMs * this.timeScale;
    this.time += dt;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > this.time);
        for (const t of due) {
          t.offCancel?.();
          t.resolve();
        }
      }
    }
    if (this.waiters.length) {
      const done: Waiter[] = [];
      for (const w of this.waiters) {
        let ok = false;
        try {
          ok = w.pred();
        } catch (err) {
          console.error('[Scheduler] predicado con error', err);
          ok = true;
        }
        if (ok) done.push(w);
      }
      if (done.length) {
        this.waiters = this.waiters.filter((w) => !done.includes(w));
        for (const w of done) {
          w.offCancel?.();
          w.resolve();
        }
      }
    }
    return dt;
  }

  wait(ms: number, token?: CancelToken): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (token?.cancelled) return reject(new CancelledError());
      const timer: Timer = { at: this.time + ms, resolve };
      if (token) {
        timer.offCancel = token.onCancel(() => {
          this.timers = this.timers.filter((t) => t !== timer);
          reject(new CancelledError());
        });
      }
      this.timers.push(timer);
    });
  }

  waitUntil(pred: () => boolean, token?: CancelToken): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (token?.cancelled) return reject(new CancelledError());
      if (pred()) return resolve();
      const w: Waiter = { pred, resolve };
      if (token) {
        w.offCancel = token.onCancel(() => {
          this.waiters = this.waiters.filter((x) => x !== w);
          reject(new CancelledError());
        });
      }
      this.waiters.push(w);
    });
  }

  clear(): void {
    this.timers = [];
    this.waiters = [];
  }
}
