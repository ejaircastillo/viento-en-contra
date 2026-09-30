import { h, richText } from './dom';
import type { AudioEngine } from '../audio/AudioEngine';

/**
 * HUD mínimo y táctil: reloj con significado, objetivo, radio, botón contextual,
 * bocina, teléfono, nombre de calle, próxima maniobra, semáforo y flecha al objetivo.
 */
export class Hud {
  readonly root: HTMLElement;
  private top: HTMLDivElement;
  private objEl: HTMLDivElement;
  private objText: HTMLSpanElement;
  private clockEl: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private labelEl: HTMLDivElement;
  private pauseBtn: HTMLButtonElement;
  private radioEl: HTMLDivElement;
  private radioTxt: HTMLDivElement;
  private radioToggle: HTMLButtonElement;
  private actions: HTMLDivElement;
  private actBtn: HTMLButtonElement | null = null;
  private hornBtn: HTMLButtonElement;
  private phoneBtn: HTMLButtonElement | null = null;
  private streetEl: HTMLDivElement;
  private streetTimer = 0;
  private turnEl: HTMLDivElement;
  private turnArrow: HTMLDivElement;
  private turnText: HTMLSpanElement;
  private signalEl: HTMLDivElement;
  private targetEl: HTMLDivElement;
  private hintEl: HTMLDivElement | null = null;
  private hintTimed = false;
  private toastEl: HTMLDivElement | null = null;
  private offerEl: HTMLDivElement | null = null;
  private actHandler: (() => void) | null = null;
  onPause: () => void = () => {};
  onRadioToggle: () => void = () => {};
  onHorn: () => void = () => {};

  constructor(root: HTMLElement, private audio: AudioEngine) {
    this.root = root;
    this.objText = h('span');
    this.objEl = h('div', { class: 'px-panel hud-objective hidden' }, [h('i', { class: 'dot' }), this.objText]);
    this.timeEl = h('div', { class: 'time', text: '07:28' });
    this.labelEl = h('div', { class: 'label', text: '' });
    this.clockEl = h('div', { class: 'px-panel hud-clock hidden' }, [this.timeEl, this.labelEl]);
    this.pauseBtn = h('button', {
      class: 'px-btn hud-pause hidden',
      text: 'II',
      attrs: { 'aria-label': 'Pausa' },
      on: {
        click: () => {
          this.audio.sfx('ui_click');
          this.onPause();
        },
      },
    });
    this.top = h('div', { class: 'hud-top' }, [this.objEl, h('div', { style: { flex: '1 1 0' } }), this.clockEl, this.pauseBtn]);
    this.radioTxt = h('div', { class: 'txt' });
    this.radioToggle = h('button', {
      class: 'px-btn toggle',
      text: '⏻',
      attrs: { 'aria-label': 'Encender o apagar la radio' },
      on: {
        click: () => {
          this.audio.sfx('ui_click');
          this.onRadioToggle();
        },
      },
    });
    this.radioEl = h('div', { class: 'hud-radio hidden' }, [
      h('div', { class: 'dial', html: 'RADIO<b>89</b>FM' }),
      this.radioTxt,
      this.radioToggle,
    ]);
    this.hornBtn = h('button', {
      class: 'px-btn horn-btn hidden',
      text: 'BOCINA',
      on: {
        pointerdown: (e) => {
          e.preventDefault();
          this.onHorn();
        },
      },
    });
    this.actions = h('div', { class: 'hud-actions' }, [this.hornBtn]);
    this.streetEl = h('div', { class: 'hud-street' });
    this.turnArrow = h('div', { class: 'arrow', text: '➜' });
    this.turnText = h('span');
    this.turnEl = h('div', { class: 'px-panel hud-turn hidden' }, [this.turnArrow, this.turnText]);
    this.signalEl = h('div', { class: 'hud-signal hidden' }, [h('i'), h('i'), h('i')]);
    this.targetEl = h('div', { class: 'hud-target hidden', text: '➤' });
    root.append(this.top, this.radioEl, this.actions, this.streetEl, this.turnEl, this.signalEl, this.targetEl);
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  showClock(v: boolean): void {
    this.clockEl.classList.toggle('hidden', !v);
    this.pauseBtn.classList.toggle('hidden', !v);
  }

  clock(time: string, label: string, state: 'ok' | 'warn' | 'late'): void {
    this.timeEl.textContent = time;
    this.labelEl.textContent = label;
    this.clockEl.classList.toggle('warn', state === 'warn');
    this.clockEl.classList.toggle('late', state === 'late');
  }

  objective(text: string | null, flash = true): void {
    if (!text) {
      this.objEl.classList.add('hidden');
      return;
    }
    this.objText.innerHTML = richText(text);
    this.objEl.classList.remove('hidden');
    if (flash) {
      this.objEl.classList.remove('flash');
      void this.objEl.offsetWidth;
      this.objEl.classList.add('flash');
    }
  }

  radio(visible: boolean, on: boolean): void {
    this.radioEl.classList.toggle('hidden', !visible);
    this.radioEl.classList.toggle('off', !on);
    if (!on) this.radioTxt.innerHTML = '<span class="kind">APAGADA</span>Tocá ⏻ para encenderla';
  }

  radioText(kind: string, text: string, typed = true): Promise<void> {
    this.radioTxt.innerHTML = `<span class="kind">${kind}</span><span class="line"></span>`;
    const line = this.radioTxt.querySelector('.line') as HTMLSpanElement;
    if (!typed) {
      line.innerHTML = richText(text);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let i = 0;
      const chars = [...text];
      const tick = () => {
        i = Math.min(chars.length, i + 2);
        line.textContent = chars.slice(0, i).join('');
        if (i < chars.length) window.setTimeout(tick, 32);
        else resolve();
      };
      tick();
    });
  }

  action(label: string | null, onPress?: () => void, icon = '✋'): void {
    this.actHandler = onPress ?? null;
    if (!label) {
      this.actBtn?.remove();
      this.actBtn = null;
      return;
    }
    if (this.actBtn && this.actBtn.dataset.label === label) return;
    this.actBtn?.remove();
    this.actBtn = h(
      'button',
      {
        class: 'px-btn act-btn',
        attrs: { 'data-label': label },
        on: {
          pointerdown: (e) => {
            e.preventDefault();
            this.audio.sfx('ui_click');
            this.actHandler?.();
          },
        },
      },
      [h('span', { class: 'ico', text: icon }), h('span', { text: label })],
    );
    this.actions.appendChild(this.actBtn);
  }

  horn(visible: boolean): void {
    this.hornBtn.classList.toggle('hidden', !visible);
  }

  phone(label: string | null, onPress?: () => void): void {
    this.phoneBtn?.remove();
    this.phoneBtn = null;
    if (!label) return;
    this.phoneBtn = h(
      'button',
      {
        class: 'px-btn act-btn phone-btn',
        on: {
          click: () => {
            this.audio.sfx('ui_confirm');
            onPress?.();
          },
        },
      },
      [h('span', { class: 'ico', text: '📱' }), h('span', { text: label })],
    );
    this.actions.appendChild(this.phoneBtn);
  }

  street(name: string): void {
    this.streetEl.textContent = name;
    this.streetEl.classList.add('on');
    window.clearTimeout(this.streetTimer);
    this.streetTimer = window.setTimeout(() => this.streetEl.classList.remove('on'), 2600);
  }

  /** Próxima maniobra. state: 'gps' = sugerencia pendiente (resaltada), 'ok' = ya elegida / automática. */
  turn(deg: number | null, text = '', state: '' | 'gps' | 'ok' = ''): void {
    if (deg === null) {
      this.turnEl.classList.add('hidden');
      return;
    }
    this.turnEl.classList.remove('hidden');
    this.turnEl.classList.toggle('gps', state === 'gps');
    this.turnEl.classList.toggle('ok', state === 'ok');
    this.turnArrow.style.transform = `rotate(${deg}deg)`;
    this.turnText.textContent = text;
  }

  /** Propuesta con botón (ej. activar la conducción asistida). Se cierra sola si no se responde. */
  offer(text: string, yes: string, onYes: () => void, ms = 12000): void {
    this.offerEl?.remove();
    const close = () => {
      if (this.offerEl === el) this.offerEl = null;
      el.remove();
    };
    const el = h('div', { class: 'px-panel hud-offer' }, [
      h('div', { class: 't', text }),
      h('div', { class: 'row' }, [
        h('button', {
          class: 'px-btn primary',
          text: yes,
          on: {
            click: () => {
              this.audio.sfx('ui_confirm');
              onYes();
              close();
            },
          },
        }),
        h('button', {
          class: 'px-btn',
          text: 'No, gracias',
          on: {
            click: () => {
              this.audio.sfx('ui_click');
              close();
            },
          },
        }),
      ]),
    ]);
    this.offerEl = el;
    this.root.appendChild(el);
    window.setTimeout(close, ms);
  }

  signal(state: 'red' | 'yellow' | 'green' | 'blink' | null): void {
    this.signalEl.className = `hud-signal ${state ?? 'hidden'}`;
  }

  target(pos: { x: number; y: number; angle: number } | null): void {
    if (!pos) {
      this.targetEl.classList.add('hidden');
      return;
    }
    this.targetEl.classList.remove('hidden');
    this.targetEl.style.left = `${pos.x}px`;
    this.targetEl.style.top = `${pos.y}px`;
    this.targetEl.style.transform = `rotate(${pos.angle}rad)`;
  }

  /** Ayuda en pantalla. Con `ms` se cierra sola (y sobrevive al cambio de estado del capítulo). */
  hint(html: string | null, ms?: number): void {
    this.hintEl?.remove();
    this.hintEl = null;
    this.hintTimed = false;
    if (!html) return;
    const el = h('div', { class: 'px-panel hud-hint', html });
    this.hintEl = el;
    this.root.appendChild(el);
    if (ms) {
      this.hintTimed = true;
      window.setTimeout(() => {
        if (this.hintEl === el) this.hint(null);
      }, ms);
    }
  }

  /** Al terminar un estado se cierran sus ayudas sin tiempo (las temporizadas siguen). */
  clearStateHint(): void {
    if (this.hintEl && !this.hintTimed) this.hint(null);
  }

  toast(text: string, ms = 2200): void {
    this.toastEl?.remove();
    const el = h('div', { class: 'px-panel hud-toast', text });
    this.toastEl = el;
    this.root.appendChild(el);
    window.setTimeout(() => {
      if (this.toastEl === el) this.toastEl = null;
      el.remove();
    }, ms);
  }
}
