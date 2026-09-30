/**
 * Entrada unificada: teclado (WASD / flechas), mouse (clic para caminar), táctil (toque para caminar,
 * arrastrar = joystick flotante) y acciones (interactuar, cerrar, diario, bolso, ayuda).
 * El vector de movimiento está en ejes de PANTALLA: x → derecha, y → hacia el fondo (arriba).
 */
export type Action = 'interact' | 'close' | 'journal' | 'bag' | 'help';

const KEYS: Record<string, Action> = {
  e: 'interact',
  ' ': 'interact',
  enter: 'interact',
  escape: 'close',
  j: 'journal',
  i: 'bag',
  b: 'bag',
  h: 'help',
  '?': 'help',
};

export class Input {
  /** Vector de movimiento en pantalla (longitud ≤ 1). */
  readonly axis = { x: 0, y: 0 };
  onAction: (a: Action) => void = () => {};
  /** Toque/clic corto sobre el mundo (coordenadas de cliente). */
  onTap: (clientX: number, clientY: number) => void = () => {};
  /** Se llama con `true` cuando el jugador mueve por teclado o joystick (cancela el "caminar a…"). */
  onManualMove: () => void = () => {};
  blocked = false;
  private down = new Set<string>();
  private stickEl: HTMLElement | null;
  private knob: HTMLElement | null;
  private touch: { id: number; sx: number; sy: number; x: number; y: number; t: number; stick: boolean } | null = null;

  constructor(private surface: HTMLElement) {
    this.stickEl = document.getElementById('stick');
    this.knob = this.stickEl?.querySelector('.knob') ?? null;
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.recompute();
    });
    surface.addEventListener('pointerdown', (e) => this.pdown(e));
    window.addEventListener('pointermove', (e) => this.pmove(e));
    window.addEventListener('pointerup', (e) => this.pup(e));
    window.addEventListener('pointercancel', (e) => this.pup(e));
  }

  private key(e: KeyboardEvent, isDown: boolean): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target as HTMLElement | null;
    if (tg && /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName)) return;
    const k = e.key.toLowerCase();
    if (isDown) {
      const act = KEYS[k];
      if (act) {
        if (!e.repeat) this.onAction(act);
        if (k === ' ' || k === 'enter') e.preventDefault();
        return;
      }
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) {
      if (isDown) this.down.add(k);
      else this.down.delete(k);
      this.recompute();
      if (isDown) this.onManualMove();
      e.preventDefault();
    }
  }

  private recompute(): void {
    if (this.touch?.stick) return;
    const d = this.down;
    let x = 0;
    let y = 0;
    if (d.has('a') || d.has('arrowleft')) x -= 1;
    if (d.has('d') || d.has('arrowright')) x += 1;
    if (d.has('w') || d.has('arrowup')) y += 1;
    if (d.has('s') || d.has('arrowdown')) y -= 1;
    const len = Math.hypot(x, y);
    this.axis.x = len ? x / len : 0;
    this.axis.y = len ? y / len : 0;
  }

  private pdown(e: PointerEvent): void {
    if (this.blocked || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (this.touch) return;
    if ((e.target as HTMLElement | null)?.closest('button, .tag, .tools-panel')) return;
    this.touch = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), stick: false };
  }

  private pmove(e: PointerEvent): void {
    const t = this.touch;
    if (!t || t.id !== e.pointerId) return;
    t.x = e.clientX;
    t.y = e.clientY;
    const dx = t.x - t.sx;
    const dy = t.y - t.sy;
    // arrastrar con el dedo abre el joystick; con el mouse el arrastre no mueve (se usa clic o teclado)
    if (!t.stick && e.pointerType !== 'mouse' && Math.hypot(dx, dy) > 14) {
      t.stick = true;
      if (this.stickEl) {
        this.stickEl.style.display = 'block';
        this.stickEl.style.left = `${t.sx}px`;
        this.stickEl.style.top = `${t.sy}px`;
      }
    }
    if (t.stick) {
      const R = 52;
      const len = Math.min(R, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      const kx = Math.cos(ang) * len;
      const ky = Math.sin(ang) * len;
      if (this.knob) this.knob.style.transform = `translate(${kx}px, ${ky}px)`;
      const m = len / R > 0.18 ? len / R : 0;
      this.axis.x = Math.cos(ang) * m;
      this.axis.y = -Math.sin(ang) * m;
      if (m > 0) this.onManualMove();
    }
  }

  private pup(e: PointerEvent): void {
    const t = this.touch;
    if (!t || t.id !== e.pointerId) return;
    this.touch = null;
    if (t.stick) {
      if (this.stickEl) this.stickEl.style.display = 'none';
      if (this.knob) this.knob.style.transform = 'translate(0,0)';
      this.axis.x = 0;
      this.axis.y = 0;
      this.recompute();
      return;
    }
    const moved = Math.hypot(t.x - t.sx, t.y - t.sy);
    if (!this.blocked && moved < 14 && performance.now() - t.t < 450) this.onTap(t.x, t.y);
  }
}
