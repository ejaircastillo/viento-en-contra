import { h } from './dom';
import type { Vec2 } from '../core/math';

export interface CaptionView {
  key: string;
  text: string;
  bg: string;
  fg: string;
  anchor: () => Vec2 | null;
}

interface Live {
  view: CaptionView;
  el: HTMLDivElement;
  leaving: boolean;
}

/**
 * "Lectura ampliada" de carteles: al pasar cerca de un cartel importante aparece su texto
 * nítido (HTML) justo encima, con los colores del cartel. Complementa el pixel art en
 * pantallas chicas; se desactiva desde Pausa.
 */
export class SignCaptions {
  private live = new Map<string, Live>();

  constructor(private layer: HTMLElement) {}

  /** Conjunto deseado de rótulos (los que no están se desvanecen). */
  show(list: CaptionView[]): void {
    const want = new Set(list.map((c) => c.key));
    for (const [k, l] of this.live) {
      if (want.has(k) || l.leaving) continue;
      l.leaving = true;
      l.el.classList.add('out');
      window.setTimeout(() => {
        if (this.live.get(k) === l) this.live.delete(k);
        l.el.remove();
      }, 260);
    }
    for (const v of list) {
      const cur = this.live.get(v.key);
      if (cur && !cur.leaving) {
        cur.view = v;
        continue;
      }
      if (cur) cur.el.remove();
      const el = h('div', { class: 'sign-cap', text: v.text });
      el.style.background = v.bg;
      el.style.color = v.fg;
      this.layer.appendChild(el);
      this.live.set(v.key, { view: v, el, leaving: false });
    }
  }

  update(): void {
    const placed: { x: number; top: number; bottom: number }[] = [];
    const vw = window.innerWidth;
    for (const l of this.live.values()) {
      const p = l.view.anchor();
      if (!p) {
        l.el.style.visibility = 'hidden';
        continue;
      }
      l.el.style.visibility = 'visible';
      const w = l.el.offsetWidth;
      const hgt = l.el.offsetHeight;
      const x = Math.max(w / 2 + 6, Math.min(vw - w / 2 - 6, p.x));
      let y = p.y;
      // si pisa a otro rótulo, se sube
      for (let guard = 0; guard < 3; guard++) {
        const clash = placed.find((q) => Math.abs(q.x - x) < (w + 40) / 2 + 20 && y - hgt < q.bottom + 4 && y > q.top - 4);
        if (!clash) break;
        y = clash.top - 6;
      }
      y = Math.max(hgt + 6, y);
      placed.push({ x, top: y - hgt, bottom: y });
      l.el.style.left = `${x}px`;
      l.el.style.top = `${y}px`;
    }
  }

  clear(): void {
    for (const l of this.live.values()) l.el.remove();
    this.live.clear();
  }
}
