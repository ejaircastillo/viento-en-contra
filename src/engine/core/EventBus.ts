import { CancelToken, CancelledError } from './Scheduler';

type Handler = (payload: any) => void;

/**
 * Bus de eventos global y simple. Los nombres son strings con prefijo por sistema,
 * por ejemplo: "interact:car", "zone:enter:accident", "vehicle:arrived", "dialogue:end".
 */
export class EventBus {
  private handlers = new Map<string, Set<Handler>>();

  on(name: string, fn: Handler): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  once(name: string, fn: Handler): () => void {
    const off = this.on(name, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  emit(name: string, payload?: any): void {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] error en handler de "${name}"`, err);
      }
    }
  }

  /** Promesa que se resuelve con el próximo evento que cumpla el filtro. */
  waitFor<T = any>(name: string, filter?: (p: T) => boolean, token?: CancelToken): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (token?.cancelled) {
        reject(new CancelledError());
        return;
      }
      let offCancel: (() => void) | undefined;
      const off = this.on(name, (p: T) => {
        if (filter && !filter(p)) return;
        off();
        offCancel?.();
        resolve(p);
      });
      if (token) {
        offCancel = token.onCancel(() => {
          off();
          reject(new CancelledError());
        });
      }
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}
