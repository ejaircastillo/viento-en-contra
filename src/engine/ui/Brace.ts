import { h, richText } from './dom';
import { BraceModel, DEFAULT_GUSTS, type GustSpec } from '../core/Brace';
import type { AudioEngine } from '../audio/AudioEngine';

export interface BraceRunOptions {
  title: string;
  subtitle?: string;
  holdLabel?: string;
  gusts?: GustSpec[];
  /** Fuerza del viento en cada cuadro (0–1): el motor la usa para el sonido y las partículas. */
  onLevel?: (level: number) => void;
  onGust?: (level: number) => void;
  onSlip?: () => void;
}

export interface BraceResult {
  slips: number;
  held: number;
  total: number;
}

interface Live {
  model: BraceModel;
  opts: BraceRunOptions;
  holdKey: boolean;
  holdPtr: boolean;
  el: HTMLElement;
  bars: { wind: HTMLElement; slip: HTMLElement; stamina: HTMLElement };
  call: HTMLElement;
  btn: HTMLButtonElement;
  count: HTMLElement;
  resolve: (r: BraceResult) => void;
  cleanup: () => void;
  endT: number;
  autoT: number;
  /** Segundos que faltan para borrar un mensaje de resultado (aguantó / se voló). */
  msgT: number;
}

/**
 * Minijuego del ensayo eólico: aguantar el cartel contra las ráfagas apretando y soltando un botón
 * grande (o Espacio / E). La lógica está en core/Brace.ts; esto sólo la muestra y toma la entrada.
 * Se avanza desde el tick del motor (respeta pausa y velocidad de QA).
 */
export class BraceUi {
  auto = false;
  private live: Live | null = null;

  constructor(
    private root: HTMLElement,
    private audio: AudioEngine,
    touch: boolean,
  ) {
    this.touch = touch;
  }

  private touch: boolean;

  get active(): boolean {
    return !!this.live;
  }

  run(opts: BraceRunOptions): Promise<BraceResult> {
    this.live?.cleanup();
    return new Promise((resolve) => {
      const model = new BraceModel(opts.gusts ?? DEFAULT_GUSTS);
      const bar = (cls: string, label: string) => {
        const fill = h('i');
        return { fill, el: h('div', { class: `bar ${cls}` }, [h('span', { class: 'lb', text: label }), h('div', { class: 'track' }, [fill])]) };
      };
      const wind = bar('wind', 'VIENTO');
      const slip = bar('slip', 'CARTEL');
      const stamina = bar('stamina', 'FUERZA');
      const count = h('div', { class: 'count', text: `0/${model.total}` });
      const call = h('div', { class: 'call', text: '' });
      const btn = h(
        'button',
        { class: 'px-btn brace-btn', attrs: { 'aria-label': 'Agarrar el cartel' } },
        [h('span', { class: 'ico', text: '✋' }), h('span', { class: 'lab', text: opts.holdLabel ?? 'AGARRAR' }), this.touch ? null : h('span', { class: 'key', text: 'Espacio' })],
      );
      const el = h('div', { class: 'brace' }, [
        h('div', { class: 'px-panel brace-head' }, [h('b', { html: richText(opts.title) }), opts.subtitle ? h('span', { html: richText(opts.subtitle) }) : null, count]),
        h('div', { class: 'brace-bars' }, [wind.el, slip.el, stamina.el]),
        call,
        h('div', { class: 'brace-hint', html: this.touch ? 'Mantené apretado <b>cuando pega la ráfaga</b> y soltá al pasar. Apretar de más te deja sin fuerza.' : 'Mantené <b>Espacio</b> apretado cuando pega la ráfaga y soltalo al pasar. Apretar de más te deja sin fuerza.' }),
        btn,
      ]);
      const live: Live = {
        model,
        opts,
        holdKey: false,
        holdPtr: false,
        el,
        bars: { wind: wind.fill, slip: slip.fill, stamina: stamina.fill },
        call,
        btn,
        count,
        resolve,
        cleanup: () => {},
        endT: 0,
        autoT: 0,
        msgT: 0,
      };
      // entrada: botón (puntero) y teclado
      const down = (e: PointerEvent) => {
        e.preventDefault();
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
          /* puntero sintético o ya liberado: seguimos igual */
        }
        live.holdPtr = true;
        btn.classList.add('pressed');
      };
      const up = () => {
        live.holdPtr = false;
        btn.classList.remove('pressed');
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      const isKey = (k: string) => k === ' ' || k === 'e' || k === 'enter' || k === 'arrowup';
      const kd = (e: KeyboardEvent) => {
        if (!isKey(e.key.toLowerCase())) return;
        e.preventDefault();
        live.holdKey = true;
        btn.classList.add('pressed');
      };
      const ku = (e: KeyboardEvent) => {
        if (!isKey(e.key.toLowerCase())) return;
        live.holdKey = false;
        btn.classList.remove('pressed');
      };
      const blur = () => {
        live.holdKey = false;
        live.holdPtr = false;
        btn.classList.remove('pressed');
      };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      window.addEventListener('blur', blur);
      live.cleanup = () => {
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
        window.removeEventListener('blur', blur);
        el.remove();
        opts.onLevel?.(0.12);
        if (this.live === live) this.live = null;
      };
      this.live = live;
      this.root.appendChild(el);
      this.audio.sfx('notify');
    });
  }

  /** Avanza el minijuego (llamado desde el tick del motor con dt en segundos de juego). */
  update(dt: number): void {
    const l = this.live;
    if (!l) return;
    const m = l.model;
    if (m.done) {
      l.endT += dt;
      if (l.endT > 1.6) {
        const r: BraceResult = { slips: m.slips, held: m.held, total: m.total };
        l.cleanup();
        l.resolve(r);
      }
      return;
    }
    let hold = l.holdKey || l.holdPtr;
    if (this.auto) {
      // QA: agarra 0,25 s después de que pega la ráfaga y suelta al pasar
      l.autoT = m.phase === 'gust' ? l.autoT + dt : 0;
      hold = m.phase === 'gust' && l.autoT > 0.25;
    }
    // subpasos para que un dt grande (QA acelerado) no se coma las ráfagas
    const n = Math.max(1, Math.ceil(dt / (1 / 30)));
    for (let i = 0; i < n; i++) m.step(dt / n, hold);
    l.msgT = Math.max(0, l.msgT - dt);
    for (const ev of m.drain()) {
      if (ev === 'warn') {
        l.call.textContent = '⚠ SE VIENE…';
        l.call.className = 'call warn';
        l.msgT = 0;
      } else if (ev === 'gust') {
        l.call.textContent = '¡RÁFAGA! ¡AGARRÁ!';
        l.call.className = 'call gust';
        l.opts.onGust?.(m.gusts[m.index]?.peak ?? 0.8);
      } else if (ev === 'held') {
        l.call.textContent = '¡Aguantó!';
        l.call.className = 'call ok';
        l.msgT = 1.3;
        this.audio.sfx('ui_confirm');
      } else if (ev === 'slip') {
        l.call.textContent = '¡SE VOLÓ EL CARTEL!';
        l.call.className = 'call bad';
        l.msgT = 1.5;
        l.opts.onSlip?.();
        this.audio.sfx('thud');
      } else if (ev === 'done') {
        l.call.textContent = m.slips === 0 ? 'Ensayo completo: ¡ni una!' : 'Ensayo completo · ' + m.held + '/' + m.total + ' ráfagas aguantadas';
        l.call.className = 'call ok';
        l.btn.classList.add('hidden');
      }
    }
    if (m.phase === 'gap' && l.msgT <= 0) {
      l.call.textContent = '';
      l.call.className = 'call';
    }
    l.opts.onLevel?.(m.level);
    l.bars.wind.style.width = `${Math.round(m.level * 100)}%`;
    l.bars.slip.style.width = `${Math.round(m.slip * 100)}%`;
    l.bars.stamina.style.width = `${Math.round(m.stamina * 100)}%`;
    l.el.classList.toggle('empty', m.locked > 0);
    l.el.classList.toggle('gripping', m.gripping);
    l.count.textContent = `${m.held + m.slips}/${m.total}`;
    if (m.locked > 0) l.call.textContent = '¡SIN FUERZA! Soltá un momento';
  }
}
