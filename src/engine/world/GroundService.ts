import { paintChunk, type GroundModel, type PaintedChunk } from './ground';

interface Pending {
  cx: number;
  cy: number;
  size: number;
  resolve: (r: PaintedChunk) => void;
}

/**
 * Pide chunks de suelo al Web Worker. Si el navegador no soporta workers de módulo
 * (o el worker falla), pinta en el hilo principal: degradación elegante.
 */
export class GroundService {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private model: GroundModel;

  constructor(model: GroundModel) {
    this.model = model;
    try {
      this.worker = new Worker(new URL('./ground.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type !== 'chunk') return;
        const p = this.pending.get(m.id);
        if (p) {
          this.pending.delete(m.id);
          p.resolve(m as PaintedChunk);
        }
      };
      this.worker.onerror = (err) => {
        console.warn('[Ground] el worker falló; pinto en el hilo principal', err);
        this.fallback();
      };
      this.worker.postMessage({
        type: 'model',
        model: {
          w: model.w,
          h: model.h,
          seed: model.seed,
          ground: model.ground,
          marks: model.marks,
          lanes: model.lanes,
          deco: model.deco,
        },
      });
    } catch (err) {
      console.warn('[Ground] sin Web Worker; pinto en el hilo principal', err);
      this.worker = null;
    }
  }

  private fallback(): void {
    this.worker?.terminate();
    this.worker = null;
    const waiting = [...this.pending.values()];
    this.pending.clear();
    for (const p of waiting) this.paintLocal(p);
  }

  private paintLocal(p: Pending): void {
    setTimeout(() => p.resolve(paintChunk(this.model, p.cx, p.cy, p.size)), 0);
  }

  request(cx: number, cy: number, size: number): Promise<PaintedChunk> {
    return new Promise((resolve) => {
      const p: Pending = { cx, cy, size, resolve };
      if (this.worker) {
        const id = this.nextId++;
        this.pending.set(id, p);
        this.worker.postMessage({ type: 'chunk', id, cx, cy, size });
      } else {
        this.paintLocal(p);
      }
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
