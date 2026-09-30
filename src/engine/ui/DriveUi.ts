import { h } from './dom';
import type { Vec2 } from '../core/math';
import type { AudioEngine } from '../audio/AudioEngine';
import type { InputManager } from '../input/InputManager';

export interface ExitChip {
  id: number;
  /** Nombre de la calle a la que sale. */
  name: string;
  /** Ángulo en pantalla de la salida (grados). */
  deg: number;
  side: 'left' | 'right' | 'straight';
  /** Es por donde va a ir el auto. */
  chosen: boolean;
  /** Es la que sugiere el GPS. */
  gps: boolean;
  /** Cortada (y el GPS lo sabe). */
  blocked: boolean;
  anchor: () => Vec2 | null;
}

interface LiveChip {
  data: ExitChip;
  el: HTMLButtonElement;
  arrow: HTMLSpanElement;
  name: HTMLSpanElement;
  badge: HTMLSpanElement;
}

/**
 * Controles de manejo: botones grandes en pantalla (◀ ▶ elegir la calle, ▲ acelerar, ▼ frenar)
 * y flechas en la esquina que viene, con el nombre de cada calle. La flecha amarilla es por
 * donde va a ir el auto; la celeste, la que sugiere el GPS. Tocar una flecha la elige.
 */
export class DriveUi {
  private pad: HTMLDivElement;
  private left: HTMLButtonElement;
  private right: HTMLButtonElement;
  private gas: HTMLButtonElement;
  private brake: HTMLButtonElement;
  private chips = new Map<number, LiveChip>();
  /** Capa de flechas (dentro del HUD, para que se puedan tocar por encima del joystick). */
  private chipLayer: HTMLDivElement;
  private visible = false;
  onPick: (edgeId: number) => void = () => {};

  constructor(
    hud: HTMLElement,
    private input: InputManager,
    private audio: AudioEngine,
    touch: boolean,
  ) {
    const key = (k: string) => (touch ? null : h('span', { class: 'key', text: k }));
    const turnBtn = (side: 'left' | 'right') =>
      h(
        'button',
        {
          class: `px-btn drive-btn turn ${side}`,
          attrs: { 'aria-label': side === 'left' ? 'Doblar hacia la izquierda de la pantalla' : 'Doblar hacia la derecha de la pantalla' },
          on: {
            pointerdown: (e) => {
              e.preventDefault();
              this.audio.sfx('ui_click');
              this.input.pressTurn(side);
            },
          },
        },
        [h('span', { class: 'ico', text: side === 'left' ? '◀' : '▶' }), key(side === 'left' ? '←' : '→')],
      );
    const pedalBtn = (kind: 'gas' | 'brake') => {
      const b = h(
        'button',
        { class: `px-btn drive-btn pedal ${kind}`, attrs: { 'aria-label': kind === 'gas' ? 'Acelerar' : 'Frenar' } },
        [h('span', { class: 'ico', text: kind === 'gas' ? '▲' : '▼' }), key(kind === 'gas' ? '↑' : '↓')],
      );
      const up = (e: PointerEvent) => {
        if (b.hasPointerCapture?.(e.pointerId)) b.releasePointerCapture(e.pointerId);
        b.classList.remove('pressed');
        this.input.setPad(kind, false);
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.classList.add('pressed');
        this.input.setPad(kind, true);
        try {
          b.setPointerCapture?.(e.pointerId);
        } catch {
          /* puntero sintético o ya liberado: el pedal queda apretado igual */
        }
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', () => {
        b.classList.remove('pressed');
        this.input.setPad(kind, false);
      });
      return b;
    };
    this.left = turnBtn('left');
    this.right = turnBtn('right');
    this.gas = pedalBtn('gas');
    this.brake = pedalBtn('brake');
    this.pad = h('div', { class: 'drive-pad hidden' }, [
      h('div', { class: 'grp turns' }, [this.left, this.right]),
      h('div', { class: 'grp pedals' }, [this.brake, this.gas]),
    ]);
    this.chipLayer = h('div', { class: 'exit-chips' });
    hud.prepend(this.chipLayer);
    hud.appendChild(this.pad);
  }

  show(on: boolean): void {
    if (on === this.visible) return;
    this.visible = on;
    this.pad.classList.toggle('hidden', !on);
    document.body.classList.toggle('driving', on);
    if (!on) {
      this.input.setPad('gas', false);
      this.input.setPad('brake', false);
      this.setChips([]);
      this.hint(null);
    }
  }

  /** Resalta el botón que hay que tocar (sugerencia del GPS) o el lado ya elegido. */
  hint(side: 'left' | 'right' | null, chosen: 'left' | 'right' | null = null): void {
    this.left.classList.toggle('suggest', side === 'left' && chosen !== 'left');
    this.right.classList.toggle('suggest', side === 'right' && chosen !== 'right');
    this.left.classList.toggle('on', chosen === 'left');
    this.right.classList.toggle('on', chosen === 'right');
  }

  setChips(list: ExitChip[]): void {
    const want = new Set(list.map((c) => c.id));
    for (const [id, c] of this.chips) {
      if (!want.has(id)) {
        c.el.remove();
        this.chips.delete(id);
      }
    }
    for (const d of list) {
      let c = this.chips.get(d.id);
      if (!c) {
        const arrow = h('span', { class: 'arr', text: '➜' });
        const name = h('span', { class: 'nm' });
        const badge = h('span', { class: 'bdg' });
        const el = h(
          'button',
          {
            class: 'exit-chip',
            on: {
              pointerdown: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.audio.sfx('ui_click');
                this.onPick(d.id);
              },
            },
          },
          [arrow, name, badge],
        );
        this.chipLayer.appendChild(el);
        c = { data: d, el, arrow, name, badge };
        this.chips.set(d.id, c);
      }
      c.data = d;
      c.arrow.style.transform = `rotate(${d.deg}deg)`;
      c.name.textContent = d.blocked ? `${d.name} · cortada` : d.name;
      c.badge.textContent = d.chosen ? '' : d.side === 'left' ? '◀' : d.side === 'right' ? '▶' : '';
      c.el.classList.toggle('chosen', d.chosen);
      c.el.classList.toggle('gps', d.gps && !d.chosen);
      c.el.classList.toggle('blocked', d.blocked);
    }
  }

  update(): void {
    for (const c of this.chips.values()) {
      const p = c.data.anchor();
      if (!p) {
        c.el.style.visibility = 'hidden';
        continue;
      }
      c.el.style.visibility = 'visible';
      c.el.style.left = `${Math.round(p.x)}px`;
      c.el.style.top = `${Math.round(p.y)}px`;
    }
  }
}
