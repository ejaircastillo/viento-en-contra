import { h, richText } from './dom';
import type { Vec2 } from '../core/math';

export type Anchor = () => Vec2 | null;

interface Bubble {
  el: HTMLDivElement;
  anchor: Anchor;
  until: number;
  resolve?: () => void;
  offsetY: number;
}

/**
 * Globos anclados al mundo: pensamientos (uno por vez, en cola, no bloquean el juego)
 * y "barks" (frases cortas de NPCs, pueden convivir). Se reposicionan cada cuadro.
 */
export class Bubbles {
  private thoughts: { text: string; anchor: Anchor; ms: number; resolve: () => void }[] = [];
  private current: Bubble | null = null;
  private barks: Bubble[] = [];
  private markers = new Map<string, { el: HTMLDivElement; anchor: Anchor }>();
  private nextThoughtAt = 0;
  paused = false;

  constructor(private layer: HTMLElement) {}

  /** Encola un pensamiento; resuelve cuando termina de mostrarse. */
  thought(text: string, anchor: Anchor, ms?: number): Promise<void> {
    return new Promise((resolve) => {
      this.thoughts.push({ text, anchor, ms: ms ?? Math.max(2600, 1300 + text.length * 55), resolve });
    });
  }

  get thinking(): boolean {
    return !!this.current || this.thoughts.length > 0;
  }

  bark(text: string, anchor: Anchor, opts: { who?: string; ms?: number; shout?: boolean } = {}): void {
    const el = h('div', { class: `bubble bark${opts.shout ? ' shout' : ''}` });
    el.innerHTML = (opts.who ? `<span class="who">${richText(opts.who)}</span>` : '') + richText(text);
    this.layer.appendChild(el);
    const ms = opts.ms ?? Math.max(2200, 1000 + text.length * 50);
    this.barks.push({ el, anchor, until: performance.now() + ms, offsetY: 0 });
    if (this.barks.length > 3) this.remove(this.barks.shift()!);
  }

  marker(id: string, anchor: Anchor, label = '!'): void {
    this.removeMarker(id);
    const el = h('div', { class: 'marker', text: label });
    this.layer.appendChild(el);
    this.markers.set(id, { el, anchor });
  }

  removeMarker(id: string): void {
    const m = this.markers.get(id);
    if (m) {
      m.el.remove();
      this.markers.delete(id);
    }
  }

  private remove(b: Bubble): void {
    b.el.classList.add('out');
    window.setTimeout(() => b.el.remove(), 320);
  }

  private place(el: HTMLElement, p: Vec2, extraY = 0): void {
    const w = el.offsetWidth;
    const vw = window.innerWidth;
    let x = p.x;
    const half = w / 2;
    if (x - half < 6) x = half + 6;
    if (x + half > vw - 6) x = vw - 6 - half;
    const y = Math.max(el.offsetHeight + 8, p.y - extraY);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  update(): void {
    const now = performance.now();
    if (!this.paused && !this.current && this.thoughts.length && now >= this.nextThoughtAt) {
      const t = this.thoughts.shift()!;
      const el = h('div', { class: 'bubble thought', html: richText(t.text) });
      this.layer.appendChild(el);
      this.current = { el, anchor: t.anchor, until: now + t.ms, resolve: t.resolve, offsetY: 0 };
    }
    if (this.current) {
      const c = this.current;
      const p = c.anchor();
      if (p) {
        c.el.style.visibility = 'visible';
        this.place(c.el, p, 18);
      } else c.el.style.visibility = 'hidden';
      if (!this.paused && now > c.until) {
        this.remove(c);
        c.resolve?.();
        this.current = null;
        this.nextThoughtAt = now + 450;
      }
    }
    // barks cercanos se apilan para no taparse entre sí (ni al pensamiento actual)
    const placed: { x: number; y: number; h: number }[] = [];
    if (this.current && this.current.el.style.visibility !== 'hidden') {
      const r = this.current.el.getBoundingClientRect();
      placed.push({ x: r.left + r.width / 2, y: r.top, h: r.height });
    }
    for (const b of [...this.barks]) {
      const p = b.anchor();
      if (p) {
        b.el.style.visibility = 'visible';
        let extra = 10;
        const h = b.el.offsetHeight;
        for (let guard = 0; guard < 4; guard++) {
          const top = p.y - extra - h;
          const clash = placed.find((q) => Math.abs(q.x - p.x) < 150 && top < q.y + q.h + 4 && top + h > q.y - 4);
          if (!clash) break;
          extra = p.y - clash.y + 6;
        }
        this.place(b.el, p, extra);
        placed.push({ x: p.x, y: p.y - extra - h, h });
      } else b.el.style.visibility = 'hidden';
      if (now > b.until) {
        this.remove(b);
        this.barks = this.barks.filter((x) => x !== b);
      }
    }
    for (const m of this.markers.values()) {
      const p = m.anchor();
      if (p) {
        m.el.style.display = 'grid';
        m.el.style.left = `${p.x}px`;
        m.el.style.top = `${p.y}px`;
      } else m.el.style.display = 'none';
    }
  }

  clear(): void {
    for (const t of this.thoughts) t.resolve();
    this.thoughts = [];
    if (this.current) {
      this.current.el.remove();
      this.current.resolve?.();
      this.current = null;
    }
    for (const b of this.barks) b.el.remove();
    this.barks = [];
    for (const id of [...this.markers.keys()]) this.removeMarker(id);
  }
}
