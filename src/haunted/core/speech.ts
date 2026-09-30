/**
 * Lectura en voz alta de los diálogos con la síntesis de voz del navegador (Web Speech API): sin archivos ni
 * claves, funciona sin conexión con las voces del sistema (en Edge hay voces "Natural" mucho más claras). Cada
 * personaje usa un registro distinto (voz masculina o femenina si hay, tono y velocidad). La calidad depende de
 * las voces instaladas; en «Herramientas» se puede elegir otra y probarla.
 */
export type Persona = 'narrator' | 'huesos' | 'lutin' | 'pelusa' | 'ghost';

interface Profile {
  /** Género de la voz que se prefiere (si el sistema tiene de ambas). */
  kind: 'male' | 'female' | 'any';
  pitch: number;
  rate: number;
}

export const PERSONAS: Record<Persona, Profile> = {
  narrator: { kind: 'female', pitch: 1.0, rate: 0.95 },
  huesos: { kind: 'male', pitch: 0.7, rate: 0.9 },
  lutin: { kind: 'male', pitch: 1.45, rate: 1.06 },
  pelusa: { kind: 'female', pitch: 1.75, rate: 1.1 },
  ghost: { kind: 'female', pitch: 0.85, rate: 0.95 },
};

/** Lo mínimo que se usa de una voz del sistema (así se puede probar sin navegador). */
export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
}

export interface SpeakEvents {
  /** La voz avanzó hasta esta fracción (0–1) del texto hablado: sirve para sincronizar la máquina de escribir. */
  onBoundary?: (fraction: number) => void;
  onEnd?: () => void;
}

export interface Utterance {
  stop: () => void;
  /** Milisegundos por letra estimados, para que el texto aparezca al ritmo de la voz. */
  msPerChar: number;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&nbsp;': ' ', '&#39;': "'" };

/** Texto listo para hablar: sin etiquetas (los párrafos son pausas), con abreviaturas y símbolos dichos en palabras. */
export function speechText(src: string): string {
  return src
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<\/(p|div|li)>/gi, '. ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/N[°º]\s*/g, 'número ')
    .replace(/(\d)-([A-Za-z])/g, '$1 $2')
    .replace(/[▸◆×•]/g, ' ')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/\.(?:\s*\.)+/g, (m) => (/^\.{3,}$/.test(m) ? m : '.'))
    .trim();
}

/** Duración aproximada de una lectura, en milisegundos (las voces en español hablan ~12 letras por segundo). */
export function estimateMs(text: string, rate = 1): number {
  return (text.length / (12 * Math.max(0.3, rate))) * 1000;
}

const LATAM = ['es-uy', 'es-cl', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-pe', 'es-ve', 'es-py', 'es-bo', 'es-ec'];

/** Puntaje de claridad de una voz (las que no son en español quedan fuera). */
export function voiceScore(v: VoiceLike): number {
  const lang = v.lang.replace('_', '-').toLowerCase();
  if (!lang.startsWith('es')) return -1000;
  let s = 0;
  if (lang === 'es-ar') s += 60;
  else if (LATAM.includes(lang)) s += 40;
  else if (lang === 'es-es') s += 25;
  else s += 15;
  if (/natural/i.test(v.name)) s += 60; // voces neuronales de Edge
  if (/neural|premium|enhanced|mejorada|online/i.test(v.name)) s += 25;
  if (/google/i.test(v.name)) s += 20;
  if (/compact|espeak|festival/i.test(v.name)) s -= 40;
  if (!v.localService) s += 5;
  return s;
}

const MALE = /\b(raul|raúl|pablo|jorge|juan|diego|carlos|alvaro|álvaro|tomas|tomás|enrique|miguel|andres|andrés|gonzalo|antonio|luis|manuel|hugo|daniel|martin|martín|jose|josé|pedro|sergio|rodrigo|david|fernando|ricardo|mateo|male|hombre)\b/i;
const FEMALE = /\b(sabina|helena|laura|elena|elvira|paulina|monica|mónica|marisol|paloma|carmen|lucia|lucía|maria|maría|sofia|sofía|valentina|camila|dalia|lupe|jimena|renata|ximena|isabela|isabella|marisa|soledad|catalina|abril|luciana|female|mujer)\b/i;

export function genderOf(name: string): 'male' | 'female' | null {
  if (MALE.test(name)) return 'male';
  if (FEMALE.test(name)) return 'female';
  return null;
}

/** Elige la mejor voz en español del género pedido (o la elegida a mano, si sigue instalada). */
export function pickVoice<T extends VoiceLike>(kind: Profile['kind'], voices: readonly T[], preferredURI = 'auto'): T | null {
  if (preferredURI !== 'auto') {
    const chosen = voices.find((v) => v.voiceURI === preferredURI);
    if (chosen) return chosen;
  }
  const es = voices.filter((v) => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a));
  if (!es.length) return null;
  if (kind === 'any') return es[0];
  return es.find((v) => genderOf(v.name) === kind) ?? es[0];
}

/** Lo que se necesita del `speechSynthesis` del navegador (y de un doble de pruebas). */
export interface SynthLike {
  speak: (u: never) => void;
  cancel: () => void;
  getVoices: () => VoiceLike[];
  pause?: () => void;
  resume?: () => void;
  addEventListener?: (type: string, cb: () => void) => void;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UtterCtor = new (text: string) => any;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export class Speech {
  /** Lee los diálogos en voz alta (se puede apagar con la tecla V o desde «Herramientas»). */
  enabled = true;
  /** Multiplicador de velocidad elegido por el jugador (0,7–1,3). */
  rate = 1;
  /** `voiceURI` de la voz elegida a mano, o `auto`. */
  voiceURI = 'auto';
  private listeners = new Set<() => void>();
  private current: { cancelled: boolean; keepAlive: number } | null = null;
  private primed = false;

  constructor(
    private synth: SynthLike | null = typeof speechSynthesis !== 'undefined' ? (speechSynthesis as unknown as SynthLike) : null,
    private Ctor: UtterCtor | null = typeof SpeechSynthesisUtterance !== 'undefined' ? (SpeechSynthesisUtterance as unknown as UtterCtor) : null,
  ) {
    synth?.addEventListener?.('voiceschanged', () => this.emit());
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => this.synth?.cancel());
  }

  get supported(): boolean {
    return !!this.synth && !!this.Ctor;
  }

  /** ¿Va a hablar de verdad? (soportado y encendido) */
  get active(): boolean {
    return this.supported && this.enabled;
  }

  /** Voces en español instaladas, de la más clara a la menos. */
  voices(): VoiceLike[] {
    return (this.synth?.getVoices() ?? []).filter((v) => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a));
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    this.listeners.forEach((cb) => cb());
  }

  set(o: Partial<{ enabled: boolean; rate: number; voiceURI: string }>): void {
    if (o.enabled !== undefined) this.enabled = o.enabled;
    if (o.rate !== undefined) this.rate = clamp(o.rate, 0.7, 1.3);
    if (o.voiceURI !== undefined) this.voiceURI = o.voiceURI;
    if (!this.enabled) this.stop();
    this.emit();
  }

  /** Primer gesto del usuario: algunos navegadores (iOS) sólo dejan hablar si antes hubo un toque. */
  unlock(): void {
    if (!this.supported || this.primed) return;
    this.primed = true;
    try {
      const u = new this.Ctor!(' ');
      u.volume = 0;
      this.synth!.speak(u as never);
    } catch {
      /* sin voz: el juego sigue en silencio */
    }
  }

  stop(): void {
    if (this.current) {
      this.current.cancelled = true;
      clearInterval(this.current.keepAlive);
    }
    this.current = null;
    try {
      this.synth?.cancel();
    } catch {
      /* nada que cortar */
    }
  }

  /** Lee `text` con la voz del personaje. Devuelve null si la lectura está apagada o no hay nada que decir. */
  speak(persona: Persona, text: string, ev: SpeakEvents = {}): Utterance | null {
    if (!this.active) return null;
    const spoken = speechText(text);
    if (!spoken) return null;
    this.stop();
    const profile = PERSONAS[persona];
    const voice = pickVoice(profile.kind, this.synth!.getVoices(), this.voiceURI);
    const rate = clamp(profile.rate * this.rate, 0.5, 2);
    const u = new this.Ctor!(spoken);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = 'es-AR';
    u.pitch = clamp(profile.pitch, 0.1, 2);
    u.rate = rate;
    u.volume = 1;
    const mine = { cancelled: false, keepAlive: 0 };
    this.current = mine;
    const end = () => {
      if (mine.cancelled) return;
      mine.cancelled = true;
      clearInterval(mine.keepAlive);
      if (this.current === mine) this.current = null;
      ev.onEnd?.();
    };
    u.onboundary = (e: { charIndex?: number; charLength?: number }) => {
      if (!mine.cancelled) ev.onBoundary?.(Math.min(1, ((e.charIndex ?? 0) + (e.charLength || 0)) / spoken.length));
    };
    u.onend = end;
    u.onerror = end;
    try {
      this.synth!.speak(u as never);
    } catch {
      mine.cancelled = true;
      return null;
    }
    // las voces de red de Google se cortan solas a los ~15 s: una pausa y un resume cada tanto las mantiene vivas
    if (voice && !voice.localService && /google/i.test(voice.name)) {
      mine.keepAlive = setInterval(() => {
        this.synth!.pause?.();
        this.synth!.resume?.();
      }, 9000) as unknown as number;
    }
    return {
      msPerChar: clamp(estimateMs(spoken, rate) / spoken.length, 35, 120),
      stop: () => {
        if (mine.cancelled) return;
        mine.cancelled = true;
        clearInterval(mine.keepAlive);
        if (this.current === mine) {
          this.current = null;
          this.synth!.cancel();
        }
      },
    };
  }

  /** Muestra de las voces (narrador, Don Huesos, Lutin, Pelusa), una tras otra. */
  sample(): void {
    const lines: [Persona, string][] = [
      ['narrator', 'Así suena el narrador.'],
      ['huesos', 'Yo soy Huesos. Antes era ingeniero civil.'],
      ['lutin', 'Mañana: formulario nuevo.'],
      ['pelusa', '¡Guau!'],
    ];
    const next = (i: number) => {
      if (i < lines.length) this.speak(lines[i][0], lines[i][1], { onEnd: () => next(i + 1) });
    };
    next(0);
  }
}
