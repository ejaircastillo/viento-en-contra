import { h, richText } from './dom';
import type { AudioEngine } from '../audio/AudioEngine';
import type { InputManager } from '../input/InputManager';

export interface Speaker {
  name: string;
  portrait?: string;
  voice?: number;
}

export interface ChoiceOption {
  text: string;
  tone?: string;
}

/**
 * Caja de diálogo grande y legible en móvil. Tocar en cualquier parte: completa el texto;
 * tocar de nuevo: avanza. Teclado: espacio / enter / E. Opciones: botones grandes o teclas 1-3.
 */
export class DialogueBox {
  private el: HTMLDivElement;
  private portrait: HTMLImageElement;
  private nameEl: HTMLDivElement;
  private textEl: HTMLDivElement;
  private more: HTMLDivElement;
  private catcher: HTMLDivElement;
  private choicesEl: HTMLDivElement | null = null;
  private advance: (() => void) | null = null;
  private skipTyping: (() => void) | null = null;
  /** Modo autoplay (QA): avanza solo y elige la primera opción. */
  auto = false;
  fast = false;
  active = false;

  constructor(
    private root: HTMLElement,
    private audio: AudioEngine,
    private input: InputManager,
  ) {
    this.portrait = h('img', { class: 'portrait', attrs: { alt: '' } });
    this.nameEl = h('div', { class: 'name' });
    this.textEl = h('div', { class: 'text' });
    this.more = h('div', { class: 'more', text: '▼' });
    this.el = h('div', { class: 'px-panel dlg hidden' }, [
      this.portrait,
      h('div', { class: 'body' }, [this.nameEl, this.textEl]),
      this.more,
    ]);
    this.catcher = h('div', { class: 'hidden', style: { position: 'absolute', inset: '0' } });
    const onTap = (e: Event) => {
      e.preventDefault();
      this.tap();
    };
    this.catcher.addEventListener('pointerdown', onTap);
    this.el.addEventListener('pointerdown', onTap);
    root.append(this.catcher, this.el);
    input.onKey((k) => {
      if (!this.active) return false;
      if (this.choicesEl) {
        const n = parseInt(k, 10);
        if (n >= 1 && n <= 4) {
          const b = this.choicesEl.querySelectorAll('button')[n - 1] as HTMLButtonElement | undefined;
          b?.click();
          return true;
        }
        return false;
      }
      if (k === ' ' || k === 'enter' || k === 'e') {
        this.tap();
        return true;
      }
      return false;
    });
  }

  private tap(): void {
    if (this.choicesEl) return;
    if (this.skipTyping) {
      this.skipTyping();
      return;
    }
    if (this.advance) {
      this.audio.sfx('ui_click', 0.6);
      const a = this.advance;
      this.advance = null;
      a();
    }
  }

  /** Muestra una línea y espera a que el jugador la cierre. */
  say(speaker: Speaker | null, text: string, opts: { thinking?: boolean; keepOpen?: boolean } = {}): Promise<void> {
    this.active = true;
    this.el.classList.remove('hidden');
    this.catcher.classList.remove('hidden');
    this.el.classList.toggle('thinking', !!opts.thinking);
    if (speaker?.portrait) {
      this.portrait.src = speaker.portrait;
      this.portrait.classList.remove('hidden');
    } else {
      this.portrait.classList.add('hidden');
    }
    this.nameEl.textContent = speaker?.name ?? '';
    this.nameEl.classList.toggle('hidden', !speaker);
    this.more.classList.add('hidden');
    this.audio.duck(true);
    const chars = [...text];
    const html = richText(text);
    const perChar = this.fast ? 10 : 24;
    return new Promise<void>((resolve) => {
      let i = 0;
      let timer = 0;
      const finish = () => {
        window.clearTimeout(timer);
        this.skipTyping = null;
        this.textEl.innerHTML = html;
        this.more.classList.remove('hidden');
        this.advance = () => {
          this.audio.duck(false);
          if (!opts.keepOpen) this.hide();
          resolve();
        };
        if (this.auto) window.setTimeout(() => this.advance?.(), 450 + text.length * 12);
      };
      this.skipTyping = finish;
      const step = () => {
        i++;
        this.textEl.textContent = chars.slice(0, i).join('');
        if (i % 3 === 1 && chars[i - 1] !== ' ' && speaker) this.audio.blip(speaker.voice ?? 1);
        if (i >= chars.length) finish();
        else timer = window.setTimeout(step, /[.,!?¿¡…]/.test(chars[i - 1]) ? perChar * 5 : perChar);
      };
      step();
    });
  }

  choose(options: ChoiceOption[]): Promise<number> {
    this.active = true;
    // si la línea anterior se acaba de cerrar, se vuelve a mostrar como contexto de la pregunta
    if (this.last && performance.now() - this.hiddenAt < 600) {
      this.el.classList.remove('hidden');
      this.textEl.innerHTML = this.last.html;
      this.nameEl.textContent = this.last.name;
      this.el.classList.toggle('thinking', this.last.thinking);
      this.more.classList.add('hidden');
    }
    this.catcher.classList.remove('hidden');
    this.choicesEl?.remove();
    const wrap = h('div', { class: 'choices' });
    this.choicesEl = wrap;
    return new Promise<number>((resolve) => {
      options.forEach((o, idx) => {
        const b = h(
          'button',
          {
            class: 'px-btn',
            style: { animationDelay: `${idx * 60}ms` },
            on: {
              click: () => {
                this.audio.sfx('ui_confirm');
                wrap.remove();
                this.choicesEl = null;
                this.hide();
                resolve(idx);
              },
            },
          },
          [o.tone ? h('span', { class: 'tone', text: o.tone.toUpperCase() }) : null, h('span', { html: richText(o.text) })],
        );
        wrap.appendChild(b);
      });
      this.root.appendChild(wrap);
      // las opciones quedan justo arriba de la caja de diálogo (o abajo si no hay caja)
      const boxVisible = !this.el.classList.contains('hidden');
      wrap.style.bottom = boxVisible
        ? `calc(${this.el.offsetHeight + 22}px + env(safe-area-inset-bottom, 0px))`
        : 'calc(20px + env(safe-area-inset-bottom, 0px))';
      if (this.auto) window.setTimeout(() => (wrap.querySelector('button') as HTMLButtonElement | null)?.click(), 700);
    });
  }

  private last: { html: string; name: string; thinking: boolean } | null = null;
  private hiddenAt = 0;

  hide(): void {
    if (!this.el.classList.contains('hidden')) {
      this.last = { html: this.textEl.innerHTML, name: this.nameEl.textContent ?? '', thinking: this.el.classList.contains('thinking') };
      this.hiddenAt = performance.now();
    }
    this.el.classList.add('hidden');
    this.catcher.classList.add('hidden');
    this.active = false;
    this.skipTyping = null;
    this.advance = null;
  }

  forceClose(): void {
    this.choicesEl?.remove();
    this.choicesEl = null;
    this.hide();
  }
}
