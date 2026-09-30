import { h, richText, wait } from './dom';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Settings } from '../save/SaveSystem';

export interface CharacterCard {
  id: string;
  name: string;
  role: string;
  blurb: string;
  timer: string;
  portrait: string;
  done: boolean;
  doneLabel?: string;
}

export interface TitleChapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  done: boolean;
}

export type TitleChoice = { kind: 'continue' } | { kind: 'chapter'; id: string };

/** Pantallas: título, selección de personaje, pausa, "Continuará", tarjetas y carga. */
export class Menus {
  private loadingEl: HTMLDivElement | null = null;
  auto = false;
  /** Leyenda del título (ej. "Demo 0.2 · Capítulos 1 y 2"). */
  demoLabel = 'Demo';

  constructor(
    private root: HTMLElement,
    private audio: AudioEngine,
  ) {}

  private btn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    return h('button', {
      class: `px-btn ${cls}`,
      html: richText(label),
      on: {
        click: () => {
          this.audio.sfx('ui_confirm');
          onClick();
        },
      },
    });
  }

  private titleBlock(): HTMLElement {
    const word = (w: string, d: number) => h('span', { text: w, style: { animationDelay: `${d}s` } });
    return h('div', { class: 'title-block' }, [
      h('div', { class: 'title-kicker', text: 'RÍO GALLEGOS' }),
      h('div', { class: 'title-main' }, [word('VIENTO', 0), h('br'), word('EN', 0.2), ' ', word('CONTRA', 0.35)]),
      h('div', { class: 'title-sub', text: this.demoLabel }),
    ]);
  }

  /** Primera pantalla: un toque desbloquea el audio (requisito de los navegadores). */
  tapToStart(): Promise<void> {
    return new Promise((resolve) => {
      const scr = h('div', { class: 'screen dim' }, [this.titleBlock(), h('div', { class: 'tap-start', text: 'Tocá para empezar' })]);
      const go = (e: Event) => {
        e.preventDefault();
        window.removeEventListener('keydown', key);
        scr.remove();
        resolve();
      };
      const key = (e: KeyboardEvent) => go(e);
      scr.addEventListener('pointerdown', go, { once: true });
      window.addEventListener('keydown', key, { once: true });
      this.root.appendChild(scr);
      if (this.auto) window.setTimeout(() => scr.dispatchEvent(new Event('pointerdown')), 300);
    });
  }

  title(opts: { chapters: TitleChapter[]; cont?: { label: string }; autoId: string }): Promise<TitleChoice> {
    return new Promise((resolve) => {
      const close = (r: TitleChoice) => {
        scr.remove();
        resolve(r);
      };
      const chapterBtn = (c: TitleChapter, primary: boolean) => {
        const b = h('button', { class: `px-btn chapter-btn${primary ? ' primary' : ''}` }, [
          h('span', { class: 'cn', text: `CAPÍTULO ${c.number}${c.done ? '  ✔' : ''}` }),
          h('span', { class: 'ct', text: c.title }),
          h('span', { class: 'cs', text: c.subtitle }),
        ]);
        b.addEventListener('click', () => {
          this.audio.sfx('ui_confirm');
          close({ kind: 'chapter', id: c.id });
        });
        return b;
      };
      const col = h('div', { class: 'menu-col' }, [
        opts.cont ? this.btn(opts.cont.label, 'primary', () => close({ kind: 'continue' })) : null,
        ...opts.chapters.map((c, i) => chapterBtn(c, !opts.cont && i === 0)),
      ]);
      const scr = h('div', { class: 'screen dim' }, [this.titleBlock(), col]);
      this.root.appendChild(scr);
      if (this.auto) window.setTimeout(() => close({ kind: 'chapter', id: opts.autoId }), 300);
    });
  }

  characterSelect(cards: CharacterCard[], heading = '¿CON QUIÉN ARRANCÁS?'): Promise<string> {
    return new Promise((resolve) => {
      const grid = h('div', { class: 'chars' });
      const scr = h('div', { class: 'screen dim' }, [
        h('div', { class: 'title-kicker', text: heading }),
        grid,
      ]);
      for (const c of cards) {
        const card = h('div', { class: 'px-panel char-card', attrs: { role: 'button', tabindex: '0' } }, [
          h('img', { attrs: { src: c.portrait, alt: c.name } }),
          h('div', { class: 'info' }, [
            h('div', { class: 'n', text: c.name }),
            h('div', { class: 'r', text: c.role }),
            h('div', { class: 'b', html: richText(c.blurb) }),
            h('div', { class: 'timer', text: `⏱ ${c.timer}` }),
            c.done ? h('div', { class: 'done', text: c.doneLabel ?? '✔ Completado' }) : null,
          ]),
        ]);
        const pick = () => {
          this.audio.sfx('ui_confirm');
          scr.remove();
          resolve(c.id);
        };
        card.addEventListener('click', pick);
        card.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter') pick();
        });
        grid.appendChild(card);
      }
      this.root.appendChild(scr);
      if (this.auto) {
        const want = new URLSearchParams(location.search).get('char');
        window.setTimeout(() => resolve(want ?? cards[0].id), 300);
        window.setTimeout(() => scr.remove(), 300);
      }
    });
  }

  pause(
    settings: Settings,
    set: <K extends keyof Settings>(k: K, v: Settings[K]) => void,
    touch: boolean,
  ): Promise<'resume' | 'restart' | 'quit'> {
    return new Promise((resolve) => {
      const toggle = (label: string, key: 'music' | 'sfx' | 'radio' | 'assistedDriving') => {
        const b = h('button', { class: 'px-btn' });
        const render = () => (b.textContent = `${label}: ${settings[key] ? 'SÍ' : 'NO'}`);
        render();
        b.addEventListener('click', () => {
          set(key, !settings[key]);
          this.audio.sfx('ui_click');
          render();
        });
        return b;
      };
      const cycle = <K extends 'signCaptions'>(label: string, key: K, opts: [Settings[K], string][]) => {
        const b = h('button', { class: 'px-btn' });
        const render = () => (b.textContent = `${label}: ${opts.find((o) => o[0] === settings[key])?.[1] ?? opts[0][1]}`);
        render();
        b.addEventListener('click', () => {
          const i = opts.findIndex((o) => o[0] === settings[key]);
          set(key, opts[(i + 1) % opts.length][0]);
          this.audio.sfx('ui_click');
          render();
        });
        return b;
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') close('resume');
      };
      const close = (r: 'resume' | 'restart' | 'quit') => {
        window.removeEventListener('keydown', onKey);
        scr.remove();
        resolve(r);
      };
      window.addEventListener('keydown', onKey);
      const help = touch
        ? 'Caminar: arrastrá el dedo o tocá un lugar. Botón redondo: interactuar. Manejar: ▲ avanza, ▼ frena (sostenido con el auto quieto: vuelta en U). Antes de la esquina tocá ◀ ▶ o la flecha de la calle: el auto dobla solo.'
        : 'Caminar: WASD / flechas · E o espacio: interactuar / avanzar. Manejar: ↑ avanza, ↓ frena (sostenido con el auto quieto: vuelta en U), ← → antes de la esquina eligen la calle (el auto dobla solo) · H: bocina.';
      const scr = h('div', { class: 'screen dim pause' }, [
        h('div', { class: 'px-panel' }, [
          h('h3', { text: 'Pausa' }),
          this.btn('Seguir jugando', 'primary', () => close('resume')),
          h('div', { class: 'row' }, [toggle('Música', 'music'), toggle('Sonido', 'sfx')]),
          toggle('Radio en el auto', 'radio'),
          toggle('Conducción asistida', 'assistedDriving'),
          cycle('Carteles ampliados', 'signCaptions', [
            ['auto', 'AUTO'],
            ['on', 'SÍ'],
            ['off', 'NO'],
          ]),
          h('div', { class: 'help', text: help }),
          h('div', { class: 'row' }, [
            this.btn('Reiniciar capítulo', 'warn', () => close('restart')),
            this.btn('Salir al título', '', () => close('quit')),
          ]),
        ]),
      ]);
      this.root.appendChild(scr);
    });
  }

  continueScreen(opts: {
    number: number;
    line: string;
    next?: { label: string };
    other?: { id: string; name: string; done: boolean; chapterNumber: number };
    credits: string;
  }): Promise<'next' | 'other' | 'title'> {
    return new Promise((resolve) => {
      const close = (r: 'next' | 'other' | 'title') => {
        scr.remove();
        resolve(r);
      };
      const col = h('div', { class: 'menu-col', style: { marginBottom: '0' } }, [
        opts.next ? this.btn(`Seguir: ${opts.next.label}`, 'primary', () => close('next')) : null,
        opts.other
          ? this.btn(`Jugar el Capítulo ${opts.other.chapterNumber} con ${opts.other.name}${opts.other.done ? '  ✔' : ''}`, opts.next ? '' : 'primary', () => close('other'))
          : null,
        this.btn('Volver al título', '', () => close('title')),
      ]);
      const scr = h('div', { class: 'screen continue' }, [
        h('div', { class: 'big', text: 'CONTINUARÁ' }),
        h('div', { class: 'chap', text: `CAPÍTULO ${opts.number + 1}` }),
        h('div', { class: 'line', html: richText(opts.line) }),
        col,
        h('div', { class: 'credits', html: richText(opts.credits) }),
      ]);
      this.root.appendChild(scr);
      if (this.auto) window.setTimeout(() => close(opts.next ? 'next' : 'title'), 1500);
    });
  }

  async card(big: string, small = '', ms = 2600): Promise<void> {
    const el = h('div', { class: 'px-panel card' }, [h('div', { class: 'big', html: richText(big) }), small ? h('div', { class: 'small', html: richText(small) }) : null]);
    this.root.appendChild(el);
    await wait(this.auto ? 400 : ms);
    el.style.transition = 'opacity .4s';
    el.style.opacity = '0';
    await wait(400);
    el.remove();
  }

  loading(text: string | null): void {
    this.loadingEl?.remove();
    this.loadingEl = null;
    if (!text) return;
    this.loadingEl = h('div', { class: 'px-panel loading', text });
    this.root.appendChild(this.loadingEl);
  }
}
