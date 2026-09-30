import { h, richText, wait } from './dom';
import type { AudioEngine } from '../audio/AudioEngine';

/** Teléfono: llamadas (pantalla de contacto) y notificaciones tipo mensajería. */
export class PhoneUi {
  private callEl: HTMLDivElement | null = null;
  private queue: Promise<void> = Promise.resolve();
  auto = false;

  constructor(
    private root: HTMLElement,
    private audio: AudioEngine,
  ) {}

  async ring(contact: { name: string; portrait?: string }, rings = 2): Promise<void> {
    this.hangUp();
    const status = h('div', { class: 'status', text: 'Llamando…' });
    const el = h('div', { class: 'phone' }, [
      contact.portrait ? h('img', { class: 'pic', attrs: { src: contact.portrait, alt: '' } }) : null,
      h('div', { class: 'who', text: contact.name }),
      status,
    ]);
    this.callEl = el;
    this.root.appendChild(el);
    for (let i = 0; i < rings; i++) {
      this.audio.sfx('phone_ring');
      await wait(this.auto ? 350 : 1100);
    }
    this.audio.sfx('phone_pickup');
    status.textContent = 'En llamada · 00:01';
    let s = 1;
    const t = window.setInterval(() => {
      s++;
      if (!el.isConnected) return window.clearInterval(t);
      status.textContent = `En llamada · 00:${String(s).padStart(2, '0')}`;
    }, 1000);
  }

  hangUp(): void {
    this.callEl?.remove();
    this.callEl = null;
  }

  /** Notificación de mensaje (encolada). */
  notify(from: string, text: string, app: 'wa' | 'sms' = 'wa'): Promise<void> {
    this.queue = this.queue.then(async () => {
      this.audio.sfx('notify');
      const el = h('div', { class: 'notif' }, [
        h('div', { class: 'app', text: app === 'wa' ? '✆' : '✉' }),
        h('div', {}, [h('div', { class: 'from', text: from }), h('div', { class: 'msg', html: richText(text) })]),
      ]);
      this.root.appendChild(el);
      await wait(this.auto ? 900 : Math.max(3000, 1600 + text.length * 45));
      el.remove();
      await wait(200);
    });
    return this.queue;
  }
}

export interface DocItem {
  id: string;
  title: string;
  detail?: string;
}

/** Mini-juego de documentación (revisar como municipal / entregar como emprendedor). */
export class DocumentsUi {
  auto = false;
  constructor(
    private root: HTMLElement,
    private audio: AudioEngine,
  ) {}

  run(opts: {
    title: string;
    subtitle: string;
    docs: DocItem[];
    mode: 'review' | 'handover';
    stamp: string;
    doneLabel: string;
    onEach?: (d: DocItem, index: number) => Promise<void> | void;
  }): Promise<void> {
    return new Promise((resolve) => {
      const back = h('div', { class: 'modal-back' });
      const grid = h('div', { class: 'grid' });
      const doneBtn = h('button', { class: 'px-btn primary hidden', text: opts.doneLabel });
      const box = h('div', { class: 'docs' }, [
        h('div', { class: 'px-panel head', html: `<b>${richText(opts.title)}</b>${richText(opts.subtitle)}` }),
        grid,
        h('div', { class: 'foot' }, [doneBtn]),
      ]);
      back.appendChild(box);
      this.root.appendChild(back);
      let left = opts.docs.length;
      let busy = false;
      const cards: HTMLDivElement[] = [];
      opts.docs.forEach((d, i) => {
        const card = h('div', { class: 'doc' }, [h('div', { class: 't', text: d.title }), d.detail ? h('div', { class: 'd', text: d.detail }) : null]);
        card.addEventListener('click', async () => {
          if (card.classList.contains('done') || busy) return;
          busy = true;
          card.classList.add('done');
          this.audio.sfx('paper');
          if (opts.mode === 'handover') card.classList.add('gone');
          await wait(this.auto ? 80 : 260);
          if (opts.mode === 'handover') card.classList.remove('gone');
          this.audio.sfx('stamp');
          card.appendChild(h('div', { class: 'stamp', text: opts.stamp }));
          await opts.onEach?.(d, i);
          busy = false;
          left--;
          if (left === 0) {
            doneBtn.classList.remove('hidden');
            if (this.auto) window.setTimeout(() => doneBtn.click(), 300);
          }
        });
        cards.push(card);
        grid.appendChild(card);
      });
      doneBtn.addEventListener('click', () => {
        this.audio.sfx('ui_confirm');
        back.remove();
        resolve();
      });
      if (this.auto) {
        let k = 0;
        const next = () => {
          if (k >= cards.length) return;
          cards[k++].click();
          window.setTimeout(next, 160);
        };
        window.setTimeout(next, 300);
      }
    });
  }

  /** Ventana de "sistema" en monitor CRT. */
  crt(opts: { title: string; lines: string[]; button: string }): Promise<void> {
    return new Promise((resolve) => {
      this.audio.sfx('error_beep');
      const btn = h('button', { class: 'px-btn', text: opts.button });
      const back = h('div', { class: 'modal-back' }, [
        h('div', { class: 'crt' }, [
          h('div', { class: 'title', text: opts.title }),
          ...opts.lines.map((l) => h('div', { class: 'line', html: richText(l) })),
          h('div', { class: 'actions' }, [btn]),
        ]),
      ]);
      btn.addEventListener('click', () => {
        this.audio.sfx('ui_click');
        back.remove();
        resolve();
      });
      this.root.appendChild(back);
      if (this.auto) window.setTimeout(() => btn.click(), 900);
    });
  }

  /** Papel en primer plano: comunicados, boletas, formularios. */
  paper(opts: {
    title: string;
    small?: string;
    lines?: string[];
    handwritten?: string;
    rows?: { label: string; value: string; isNew?: boolean }[];
    total?: string;
    button: string;
  }): Promise<void> {
    return new Promise((resolve) => {
      this.audio.sfx('paper');
      const btn = h('button', { class: 'px-btn', text: opts.button });
      const paper = h('div', { class: 'paper' }, [
        h('h2', { text: opts.title }),
        opts.small ? h('div', { class: 'small', html: richText(opts.small) }) : null,
        opts.handwritten ? h('div', { class: 'handwritten', html: richText(opts.handwritten) }) : null,
        ...(opts.lines ?? []).map((l) => h('p', { html: richText(l), style: { margin: '6px 0' } })),
        ...(opts.rows ?? []).map((r) =>
          h('div', { class: `row${r.isNew ? ' new' : ''}` }, [h('span', { html: richText(r.label) }), h('span', { text: r.value })]),
        ),
        opts.total ? h('div', { class: 'total', text: opts.total }) : null,
        h('div', { class: 'actions' }, [btn]),
      ]);
      const back = h('div', { class: 'modal-back' }, [paper]);
      btn.addEventListener('click', () => {
        this.audio.sfx('ui_click');
        back.remove();
        resolve();
      });
      this.root.appendChild(back);
      if (this.auto) window.setTimeout(() => btn.click(), 900);
    });
  }
}
