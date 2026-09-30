import type { Action } from '../core/input';

/**
 * HUD y paneles HTML: barra inferior (diario, bolso, ayuda) con el objetivo, etiqueta flotante de lo
 * interactuable, inscripciones de lápidas y diálogos con marco ornamental, elecciones, listas y tarjetas.
 * Todo devuelve promesas que se resuelven al cerrar, así la historia se escribe con `await`.
 */
const ICON_BOOK = '<svg viewBox="0 0 32 32"><path d="M7 4h16a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M5 9H3m2 6H3m2 6H3M11 10h9m-9 5h9m-9 5h6"/></svg>';
const ICON_BAG = '<svg viewBox="0 0 32 32"><path d="M8 13h16l2.4 13.2a2 2 0 0 1-2 2.3H7.6a2 2 0 0 1-2-2.3z"/><path d="M11 13V9a5 5 0 0 1 10 0v4"/><path d="M14 18h4"/></svg>';
const ICON_HELP = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11.5"/><path d="M12.4 12.6a3.8 3.8 0 1 1 5.4 3.4c-1.2.7-1.8 1.4-1.8 2.8"/><path d="M16 22.4v.2"/></svg>';
const FLOR = '<svg class="flor %C" viewBox="0 0 26 26"><path d="M2 24V11C2 6 6 2 11 2h13"/><path d="M6 24V13c0-3.3 3.7-7 7-7h11"/><circle cx="6" cy="6" r="1.4"/></svg>';

export interface HudHooks {
  onButton: (b: 'journal' | 'bag' | 'help') => void;
  onTag: () => void;
  onModal: (open: boolean) => void;
  /** Se abrió un panel de lectura (diario, bolso, ayuda, lápida…). */
  onPanel?: () => void;
  /** Sale una letra del diálogo de `name` (para el "blip" de voz). */
  onVoice?: (name: string) => void;
}

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

interface Modal {
  close: () => void;
  action: (a: Action) => void;
}

export class Hud {
  private objective: HTMLElement;
  private tag: HTMLElement;
  private buttons: Record<string, HTMLButtonElement> = {};
  private modal: Modal | null = null;
  private toastEl: HTMLElement;
  private toastT = 0;

  constructor(
    private roots: { hud: HTMLElement; panels: HTMLElement; tags: HTMLElement },
    private hooks: HudHooks,
    private touch: boolean,
  ) {
    document.body.classList.toggle('touch', touch);
    const wrap = el('div', 'bar-wrap');
    this.objective = el('div', 'objective');
    const bar = el('div', 'bar');
    const defs: [string, string, string][] = [
      ['journal', ICON_BOOK, 'Diario (J)'],
      ['bag', ICON_BAG, 'Bolso (B)'],
      ['help', ICON_HELP, 'Ayuda (H)'],
    ];
    for (const [id, icon, label] of defs) {
      const b = el('button', '', `${icon}<span class="dot"></span>`);
      b.setAttribute('aria-label', label);
      b.title = label;
      b.addEventListener('click', () => hooks.onButton(id as 'journal' | 'bag' | 'help'));
      bar.appendChild(b);
      this.buttons[id] = b;
    }
    wrap.append(this.objective, bar);
    roots.hud.appendChild(wrap);
    this.tag = el('div', 'tag');
    this.tag.addEventListener('click', (e) => {
      e.stopPropagation();
      hooks.onTag();
    });
    roots.tags.appendChild(this.tag);
    this.toastEl = el('div', 'objective');
    Object.assign(this.toastEl.style, { position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', opacity: '0', pointerEvents: 'none', textAlign: 'center', width: '90vw' });
    roots.hud.appendChild(this.toastEl);
    window.addEventListener('keydown', (e) => this.digit(e));
  }

  get isOpen(): boolean {
    return this.modal !== null;
  }

  /** Redirige una acción de teclado al panel abierto (devuelve true si la consumió). */
  handleAction(a: Action): boolean {
    if (!this.modal) return false;
    this.modal.action(a);
    return true;
  }

  private digit(e: KeyboardEvent): void {
    if (!this.modal || !/^[1-9]$/.test(e.key)) return;
    const btns = this.roots.panels.querySelectorAll<HTMLButtonElement>('.choices button');
    btns[Number(e.key) - 1]?.click();
  }

  // ------------------------------------------------------------------ objetivo, etiqueta, avisos
  setObjective(text: string | null, flash = true): void {
    this.objective.textContent = text ?? '';
    if (flash && text) {
      this.objective.classList.remove('flash');
      void this.objective.offsetWidth;
      this.objective.classList.add('flash');
    }
  }

  setNew(btn: 'journal' | 'bag', on: boolean): void {
    this.buttons[btn].classList.toggle('new', on);
  }

  showTag(label: string, sx: number, sy: number): void {
    if (this.tag.dataset.label !== label) {
      this.tag.dataset.label = label;
      this.tag.innerHTML = `${label}${this.touch ? '' : '<span class="key">E</span>'}`;
    }
    this.tag.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
    this.tag.classList.add('on');
  }

  hideTag(): void {
    this.tag.classList.remove('on');
  }

  toast(text: string, ms = 2600): void {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    window.clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => (this.toastEl.style.opacity = '0'), ms);
  }

  // ------------------------------------------------------------------ paneles
  private read(panel: HTMLElement, opts: Parameters<Hud['open']>[1]): Promise<void> {
    this.hooks.onPanel?.();
    return this.open(panel, opts);
  }

  private open(panel: HTMLElement, opts: { bottom?: boolean; dim?: boolean; action: (a: Action, close: () => void) => void; clickClose?: boolean }): Promise<void> {
    return new Promise((resolve) => {
      const veil = el('div', `veil${opts.bottom ? ' bottom' : ''}${opts.dim ? ' dim' : ''}`);
      veil.appendChild(panel);
      this.roots.panels.appendChild(veil);
      setTimeout(() => veil.classList.add('on'), 16);
      this.hooks.onModal(true);
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        this.modal = null;
        veil.classList.remove('on');
        setTimeout(() => veil.remove(), 240);
        this.hooks.onModal(false);
        resolve();
      };
      this.modal = { close, action: (a) => opts.action(a, close) };
      if (opts.clickClose) veil.addEventListener('click', (e) => (!panel.contains(e.target as Node) ? close() : undefined));
      panel.querySelector('.close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
      });
    });
  }

  private frame(cls: string, inner: string, closable = true): HTMLElement {
    const p = el('div', `panel ${cls}`);
    p.innerHTML = `${['tl', 'tr', 'bl', 'br'].map((c) => FLOR.replace('%C', c)).join('')}${closable ? '<button class="close" aria-label="Cerrar">×</button>' : ''}${inner}`;
    return p;
  }

  /** Inscripción de una lápida o cartel: "AQUÍ YACE / NOMBRE / ─◆─ / texto". */
  inscription(o: { kicker: string; name: string; lines: string[] }): Promise<void> {
    const body = o.lines.map((l) => `<p>${l}</p>`).join('');
    const p = this.frame('', `<div class="kicker">${o.kicker}</div><div class="name">${o.name}</div><div class="rule"><i></i><b></b><i></i></div><div class="body">${body}</div>`);
    return this.read(p, { dim: true, clickClose: true, action: (a, close) => (a === 'close' || a === 'interact') && close() });
  }

  /** Línea de diálogo con máquina de escribir: un toque completa el texto, otro avanza. */
  say(name: string, text: string): Promise<void> {
    const p = this.frame('talk', `<div class="name">${name}</div><div class="body"></div><div class="more">▸ continuar</div>`, false);
    const body = p.querySelector('.body') as HTMLElement;
    const more = p.querySelector('.more') as HTMLElement;
    more.style.visibility = 'hidden';
    let shown = 0;
    let timer = 0;
    const finish = () => {
      window.clearInterval(timer);
      shown = text.length;
      body.textContent = text;
      more.style.visibility = 'visible';
    };
    timer = window.setInterval(() => {
      shown += 1;
      body.textContent = text.slice(0, shown);
      if (shown % 2 === 1 && text[shown - 1] !== ' ') this.hooks.onVoice?.(name);
      if (shown >= text.length) finish();
    }, 22);
    const done = this.open(p, { bottom: true, action: (a, close) => (a === 'interact' || a === 'close') && (shown < text.length ? finish() : close()) });
    p.addEventListener('click', () => this.modal?.action('interact'));
    return done.then(() => window.clearInterval(timer));
  }

  /** Opciones numeradas; resuelve con el índice elegido. */
  choose(prompt: string | null, options: string[]): Promise<number> {
    const head = prompt ? `<div class="body">${prompt}</div>` : '';
    const list = options.map((o, i) => `<button data-i="${i}"><span class="n">${i + 1}</span>${o}</button>`).join('');
    const p = this.frame('talk', `${head}<div class="choices">${list}</div>`, false);
    let picked = 0;
    const done = this.open(p, { bottom: true, action: () => undefined });
    p.querySelectorAll<HTMLButtonElement>('.choices button').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        picked = Number(b.dataset.i);
        this.modal?.close();
      }),
    );
    return done.then(() => picked);
  }

  /** Lista (diario, bolso): cada ítem con título, nota y estado. */
  list(kicker: string, title: string, items: { text: string; note?: string; done?: boolean }[], empty: string): Promise<void> {
    const rows = items.length ? `<ul class="list">${items.map((i) => `<li class="${i.done ? 'done' : ''}">${i.text}${i.note ? `<small>${i.note}</small>` : ''}</li>`).join('')}</ul>` : `<div class="empty">${empty}</div>`;
    const p = this.frame('', `<div class="kicker">${kicker}</div><div class="name">${title}</div><div class="rule"><i></i><b></b><i></i></div><div class="body">${rows}</div>`);
    return this.read(p, { dim: true, clickClose: true, action: (a, close) => (a === 'close' || a === 'interact') && close() });
  }

  /** Panel libre (ayuda, tarjetas de título y de final). */
  page(kicker: string, title: string, html: string): Promise<void> {
    const p = this.frame('', `<div class="kicker">${kicker}</div><div class="name">${title}</div><div class="rule"><i></i><b></b><i></i></div><div class="body">${html}</div><div class="more">▸ tocá para seguir</div>`);
    return this.read(p, { dim: true, clickClose: true, action: (a, close) => (a === 'close' || a === 'interact') && close() });
  }

  close(): void {
    this.modal?.close();
  }
}
