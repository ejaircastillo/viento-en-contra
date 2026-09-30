import type { Vec2 } from '../core/math';

/**
 * Entrada unificada: joystick táctil flotante (arrastrar en cualquier parte de la pantalla),
 * toque corto (tap), y teclado (WASD / flechas / E / espacio / H / Esc).
 * El juego lee intenciones (vector de movimiento en pantalla, acción, bocina), nunca eventos crudos.
 * En modo manejo las flechas cambian de sentido: ↑/↓ = acelerar/frenar y ←/→ = elegir la calle
 * de la izquierda/derecha (de la pantalla) en la próxima esquina. Los botones en pantalla hacen lo mismo.
 */
export class InputManager {
  /** Vector en espacio de pantalla, magnitud 0..1 */
  move: Vec2 = { x: 0, y: 0 };
  enabled = true;
  lastSource: 'touch' | 'keys' | null = null;
  /** 'drive': teclas = pedal (↑↓) y pedidos de giro (←→). */
  mode: 'walk' | 'drive' = 'walk';
  /** Pedal de teclado o botones: 1 acelerar, -1 frenar, 0 nada. */
  pedal = 0;
  private padGas = false;
  private padBrake = false;
  private turns: ('left' | 'right')[] = [];

  private keys = new Set<string>();
  private action = false;
  private horn = false;
  private taps: Vec2[] = [];
  private joy: { id: number; ox: number; oy: number; x: number; y: number; active: boolean; t: number } | null = null;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private layer: HTMLElement;
  private keyListeners = new Set<(key: string) => boolean | void>();
  private readonly radius = 52;

  constructor(layer: HTMLElement) {
    this.layer = layer;
    this.base = document.createElement('div');
    this.base.className = 'joy-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.base.appendChild(this.knob);
    layer.appendChild(this.base);

    layer.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    if (this.joy) return;
    this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, active: false, t: performance.now() };
    this.lastSource = 'touch';
  };

  private onMove = (e: PointerEvent) => {
    const j = this.joy;
    if (!j || e.pointerId !== j.id) return;
    j.x = e.clientX;
    j.y = e.clientY;
    const dx = j.x - j.ox;
    const dy = j.y - j.oy;
    if (!j.active && Math.hypot(dx, dy) > 12) {
      j.active = true;
      this.base.style.left = `${j.ox}px`;
      this.base.style.top = `${j.oy}px`;
      this.base.classList.add('on');
    }
    if (j.active) {
      const len = Math.hypot(dx, dy);
      const k = len > this.radius ? this.radius / len : 1;
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      // si el dedo se aleja mucho, la base lo sigue (joystick "arrastrable")
      if (len > this.radius * 1.6) {
        j.ox = j.x - (dx / len) * this.radius * 1.6;
        j.oy = j.y - (dy / len) * this.radius * 1.6;
        this.base.style.left = `${j.ox}px`;
        this.base.style.top = `${j.oy}px`;
      }
    }
  };

  private onUp = (e: PointerEvent) => {
    const j = this.joy;
    if (!j || e.pointerId !== j.id) return;
    if (!j.active && performance.now() - j.t < 350) this.taps.push({ x: j.x, y: j.y });
    this.release();
  };

  private release(): void {
    this.joy = null;
    this.base.classList.remove('on');
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    for (const l of this.keyListeners) {
      if (l(k)) {
        e.preventDefault();
        return;
      }
    }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    this.lastSource = 'keys';
    if (!this.enabled) return;
    if (k === 'e' || k === ' ' || k === 'enter') this.action = true;
    if (k === 'h') this.horn = true;
    if (this.mode === 'drive') {
      if (k === 'arrowleft' || k === 'a') this.turns.push('left');
      if (k === 'arrowright' || k === 'd') this.turns.push('right');
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  /** Escucha teclas para UI (devolver true consume la tecla). */
  onKey(fn: (key: string) => boolean | void): () => void {
    this.keyListeners.add(fn);
    return () => this.keyListeners.delete(fn);
  }

  update(): void {
    if (!this.enabled) {
      this.move = { x: 0, y: 0 };
      this.pedal = 0;
      return;
    }
    const k = this.keys;
    if (this.mode === 'drive') {
      const up = k.has('arrowup') || k.has('w') || this.padGas;
      const down = k.has('arrowdown') || k.has('s') || this.padBrake;
      // sostener ← o → también avanza despacio (hacia la calle elegida)
      const side = k.has('arrowleft') || k.has('a') || k.has('arrowright') || k.has('d');
      this.pedal = down ? -1 : up ? 1 : side ? 0.6 : 0;
    } else this.pedal = 0;
    const j = this.joy;
    if (j && j.active) {
      const dx = j.x - j.ox;
      const dy = j.y - j.oy;
      const len = Math.hypot(dx, dy);
      const m = Math.min(1, len / this.radius);
      this.move = len > 0 ? { x: (dx / len) * m, y: (dy / len) * m } : { x: 0, y: 0 };
      return;
    }
    if (this.mode === 'drive') {
      this.move = { x: 0, y: 0 };
      return;
    }
    const x = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    const y = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') ? 1 : 0);
    const len = Math.hypot(x, y);
    this.move = len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  consumeAction(): boolean {
    const a = this.action;
    this.action = false;
    return a;
  }

  pressAction(): void {
    if (this.enabled) this.action = true;
  }

  consumeHorn(): boolean {
    const h = this.horn;
    this.horn = false;
    return h;
  }

  pressHorn(): void {
    if (this.enabled) this.horn = true;
  }

  /** Botones de manejo en pantalla. */
  setPad(kind: 'gas' | 'brake', on: boolean): void {
    if (kind === 'gas') this.padGas = on && this.enabled;
    else this.padBrake = on && this.enabled;
  }

  pressTurn(side: 'left' | 'right'): void {
    if (this.enabled) this.turns.push(side);
  }

  consumeTurn(): 'left' | 'right' | null {
    return this.turns.shift() ?? null;
  }

  setMode(mode: 'walk' | 'drive'): void {
    this.mode = mode;
    this.turns = [];
    this.padGas = false;
    this.padBrake = false;
  }

  consumeTap(): Vec2 | null {
    return this.taps.shift() ?? null;
  }

  clearQueued(): void {
    this.action = false;
    this.horn = false;
    this.taps = [];
    this.turns = [];
  }

  get holding(): boolean {
    return Math.hypot(this.move.x, this.move.y) > 0.3;
  }

  get touching(): boolean {
    return !!this.joy?.active;
  }

  destroy(): void {
    this.layer.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
