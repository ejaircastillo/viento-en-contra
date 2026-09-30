import type { App } from '../core/app';
import type { Sound } from '../core/audio';
import type { Effect } from '../core/post';
import { el } from './hud';

/**
 * Panel "Herramientas" (arriba a la derecha): fps, calidad, resolución, efectos de postproceso, exposición,
 * bloom y sonido. Los cambios se aplican al instante (menos la calidad, que recarga la página) y se
 * recuerdan en el navegador salvo con ?nosave.
 */
interface Saved {
  fx: Partial<Record<Effect, boolean>>;
  exposure: number;
  bloom: number;
  res: string;
  sound: boolean;
}

const KEY = 'haunted.tools.v1';
const EFFECTS: [Effect, string][] = [
  ['bloom', 'Resplandor (bloom)'],
  ['outline', 'Contorno naranja'],
  ['tilt', 'Diorama (desenfoque)'],
  ['grain', 'Grano de película'],
  ['vignette', 'Viñeta'],
];
const RES: [string, string][] = [
  ['auto', 'Automática'],
  ['0.75', '×0,75 (liviana)'],
  ['1', '×1'],
  ['1.5', '×1,5'],
  ['2', '×2 (nítida)'],
];

const read = (): Partial<Saved> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
  } catch {
    return {};
  }
};

export class Tools {
  private panel: HTMLElement;
  private fpsEl: HTMLElement;
  private saved: Saved;
  private persist: boolean;
  private acc = 0;

  constructor(
    root: HTMLElement,
    private app: App,
    private sound: Sound,
  ) {
    this.persist = !new URLSearchParams(location.search).has('nosave');
    const s = this.persist ? read() : {};
    this.saved = { fx: s.fx ?? {}, exposure: s.exposure ?? app.renderer.toneMappingExposure, bloom: s.bloom ?? app.post.bloomBase, res: s.res ?? 'auto', sound: s.sound ?? true };
    this.applyAll();

    const btn = el('button', 'tools-btn', '▸ Herramientas');
    btn.addEventListener('click', () => this.panel.classList.toggle('on'));
    this.panel = el('div', 'tools-panel');
    this.fpsEl = el('div', 'fps');
    this.build();
    root.append(btn, this.panel);
    // el panel no debe mover al fantasma ni recibir las teclas del juego
    for (const e of ['keydown', 'keyup'] as const) this.panel.addEventListener(e, (ev) => ev.stopPropagation());
  }

  private save(): void {
    if (!this.persist) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.saved));
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }

  private applyAll(): void {
    const { app, saved } = this;
    for (const [fx] of EFFECTS) if (saved.fx[fx] !== undefined) app.post.toggle(fx, saved.fx[fx]!);
    app.renderer.toneMappingExposure = saved.exposure;
    app.post.setBloomStrength(saved.bloom);
    app.setResolution(saved.res === 'auto' ? null : Number(saved.res));
    this.sound.setMuted(!saved.sound);
  }

  private row(label: string, control: HTMLElement): HTMLElement {
    const l = el('label', '', `<span>${label}</span>`);
    l.appendChild(control);
    return l;
  }

  private build(): void {
    const { app, saved, panel } = this;
    panel.appendChild(el('h4', '', 'Herramientas'));
    panel.appendChild(this.fpsEl);

    const quality = el('select');
    for (const q of ['low', 'medium', 'high']) quality.add(new Option({ low: 'Baja', medium: 'Media', high: 'Alta' }[q]!, q, false, q === app.quality.id));
    quality.addEventListener('change', () => {
      const u = new URL(location.href);
      u.searchParams.set('q', quality.value);
      location.href = u.toString();
    });
    panel.appendChild(this.row('Calidad (reinicia)', quality));

    const res = el('select');
    for (const [v, t] of RES) res.add(new Option(t, v, false, v === saved.res));
    res.addEventListener('change', () => {
      saved.res = res.value;
      app.setResolution(res.value === 'auto' ? null : Number(res.value));
      this.save();
      res.blur();
    });
    panel.appendChild(this.row('Resolución', res));

    const state = app.post.state();
    for (const [fx, label] of EFFECTS) {
      const c = el('input');
      c.type = 'checkbox';
      c.checked = state[fx];
      c.disabled = !app.post.has(fx);
      c.addEventListener('change', () => {
        saved.fx[fx] = c.checked;
        app.post.toggle(fx, c.checked);
        this.save();
        c.blur();
      });
      panel.appendChild(this.row(label, c));
    }

    const exp = el('input');
    exp.type = 'range';
    Object.assign(exp, { min: '0.6', max: '1.9', step: '0.05', value: String(saved.exposure) });
    exp.addEventListener('input', () => {
      saved.exposure = Number(exp.value);
      app.renderer.toneMappingExposure = saved.exposure;
    });
    exp.addEventListener('change', () => {
      this.save();
      exp.blur();
    });
    panel.appendChild(this.row('Exposición', exp));

    const bl = el('input');
    bl.type = 'range';
    Object.assign(bl, { min: '0', max: '1.6', step: '0.05', value: String(saved.bloom) });
    bl.disabled = !app.post.has('bloom');
    bl.addEventListener('input', () => {
      saved.bloom = Number(bl.value);
      app.post.setBloomStrength(saved.bloom);
    });
    bl.addEventListener('change', () => {
      this.save();
      bl.blur();
    });
    panel.appendChild(this.row('Intensidad del bloom', bl));

    const snd = el('input');
    snd.type = 'checkbox';
    snd.checked = saved.sound;
    snd.addEventListener('change', () => {
      saved.sound = snd.checked;
      this.sound.unlock();
      this.sound.setMuted(!snd.checked);
      this.save();
      snd.blur();
    });
    panel.appendChild(this.row('Sonido', snd));
  }

  /** Actualiza el contador de fps (medio segundo de promedio). */
  update(dt: number): void {
    this.acc += dt;
    if (this.acc < 0.5 || !this.panel.classList.contains('on')) return;
    this.acc = 0;
    this.fpsEl.textContent = `${Math.round(this.app.fps)} fps · calidad ${{ low: 'baja', medium: 'media', high: 'alta' }[this.app.quality.id]}`;
  }
}
