import { describe, expect, it, vi } from 'vitest';
import { PERSONAS, Speech, estimateMs, genderOf, pickVoice, speechText, voiceScore, type VoiceLike } from '../src/haunted/core/speech';

const v = (name: string, lang: string, local = true): VoiceLike => ({ name, lang, voiceURI: name, localService: local });
const EDGE = [
  v('Microsoft Elena Online (Natural) - Spanish (Argentina)', 'es-AR', false),
  v('Microsoft Tomas Online (Natural) - Spanish (Argentina)', 'es-AR', false),
  v('Microsoft Helena - Spanish (Spain)', 'es-ES'),
  v('Microsoft Raul - Spanish (Mexico)', 'es-MX'),
  v('Microsoft David - English (United States)', 'en-US'),
];
const PANE = [v('Microsoft Raul - Spanish (Mexico)', 'es-MX'), v('Microsoft Sabina - Spanish (Mexico)', 'es-MX')];

describe('texto para la voz', () => {
  it('quita etiquetas (los párrafos son pausas), decodifica y dice los símbolos en palabras', () => {
    expect(speechText('<p>La ventanilla del más allá</p><p><i>Mañana: formulario nuevo.<br>Todavía no existe.</i></p>')).toBe('La ventanilla del más allá. Mañana: formulario nuevo. Todavía no existe.');
    expect(speechText('Certificado N° 000001 · Formulario 26-B')).toBe('Certificado número 000001 · Formulario 26 B');
    expect(speechText('Turno 47… ¿o 48?   ')).toContain('Turno 47... ¿o 48?');
    expect(speechText('a &amp; b &lt;c&gt;')).toBe('a & b <c>');
    expect(speechText('▸ continuar')).toBe('continuar');
    expect(speechText('   ')).toBe('');
  });

  it('la duración estimada crece con el largo y baja con la velocidad', () => {
    expect(estimateMs('a'.repeat(120))).toBeGreaterThan(estimateMs('a'.repeat(60)));
    expect(estimateMs('hola mundo', 1.3)).toBeLessThan(estimateMs('hola mundo', 0.7));
  });
});

describe('elección de voz', () => {
  it('prefiere las voces neuronales argentinas y nunca elige una que no sea en español', () => {
    expect(voiceScore(EDGE[0])).toBeGreaterThan(voiceScore(EDGE[2]));
    expect(voiceScore(EDGE[4])).toBeLessThan(0);
    expect(pickVoice('female', EDGE)!.name).toContain('Elena');
    expect(pickVoice('male', EDGE)!.name).toContain('Tomas');
    expect(pickVoice('any', [EDGE[4]])).toBeNull();
    expect(pickVoice('any', [])).toBeNull();
  });

  it('con las voces del panel (Raúl y Sabina) usa una de cada género', () => {
    expect(pickVoice('male', PANE)!.name).toContain('Raul');
    expect(pickVoice('female', PANE)!.name).toContain('Sabina');
    expect(genderOf('Microsoft Sabina - Spanish (Mexico)')).toBe('female');
    expect(genderOf('Microsoft Raul - Spanish (Mexico)')).toBe('male');
    expect(genderOf('Voz desconocida')).toBeNull();
  });

  it('respeta la voz elegida a mano y la ignora si ya no está instalada; sin el género pedido usa la mejor', () => {
    expect(pickVoice('female', PANE, 'Microsoft Raul - Spanish (Mexico)')!.name).toContain('Raul');
    expect(pickVoice('female', PANE, 'Voz que ya no existe')!.name).toContain('Sabina');
    expect(pickVoice('male', [PANE[1]])!.name).toContain('Sabina');
  });

  it('cada personaje suena distinto y los tonos están en rango', () => {
    expect(PERSONAS.huesos.pitch).toBeLessThan(PERSONAS.narrator.pitch);
    expect(PERSONAS.lutin.pitch).toBeGreaterThan(PERSONAS.narrator.pitch);
    for (const p of Object.values(PERSONAS)) {
      expect(p.pitch).toBeGreaterThan(0);
      expect(p.pitch).toBeLessThanOrEqual(2);
      expect(p.rate).toBeGreaterThan(0.5);
      expect(p.rate).toBeLessThan(2);
    }
  });
});

class FakeUtter {
  voice: VoiceLike | null = null;
  lang = '';
  pitch = 1;
  rate = 1;
  volume = 1;
  onboundary: ((e: { charIndex?: number; charLength?: number }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function fake(voices: VoiceLike[] = PANE) {
  const spoken: FakeUtter[] = [];
  const st = { cancels: 0 };
  const synth = { speak: (u: FakeUtter) => void spoken.push(u), cancel: () => void st.cancels++, getVoices: () => voices };
  const speech = new Speech(synth as never, FakeUtter as never);
  return { speech, spoken, st };
}

describe('lectura en voz alta', () => {
  it('habla con la voz del personaje, su tono y su velocidad (por el multiplicador del jugador)', () => {
    const { speech, spoken } = fake();
    speech.set({ rate: 1.2 });
    const u = speech.speak('huesos', '<p>Hola, soy Huesos.</p>')!;
    expect(u).not.toBeNull();
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe('Hola, soy Huesos.');
    expect(spoken[0].voice!.name).toContain('Raul');
    expect(spoken[0].pitch).toBeCloseTo(PERSONAS.huesos.pitch);
    expect(spoken[0].rate).toBeCloseTo(PERSONAS.huesos.rate * 1.2);
    expect(spoken[0].lang).toBe('es-MX');
    expect(u.msPerChar).toBeGreaterThanOrEqual(35);
    expect(u.msPerChar).toBeLessThanOrEqual(120);
  });

  it('informa la fracción del texto que lleva y avisa una sola vez cuando termina', () => {
    const { speech, spoken } = fake();
    const fr: number[] = [];
    let ends = 0;
    speech.speak('narrator', 'uno dos tres cuatro', { onBoundary: (f) => fr.push(f), onEnd: () => ends++ });
    spoken[0].onboundary!({ charIndex: 0, charLength: 3 });
    spoken[0].onboundary!({ charIndex: 14, charLength: 6 });
    expect(fr[0]).toBeCloseTo(3 / 19);
    expect(fr[1]).toBe(1);
    spoken[0].onend!();
    spoken[0].onend!();
    spoken[0].onerror!();
    expect(ends).toBe(1);
  });

  it('cortar la lectura no avisa "terminó", y una línea nueva corta la anterior sin que ésta avise', () => {
    const { speech, spoken, st } = fake();
    let a = 0;
    let b = 0;
    const first = speech.speak('narrator', 'primera', { onEnd: () => a++ })!;
    first.stop();
    spoken[0].onend!();
    expect(a).toBe(0);
    speech.speak('lutin', 'segunda', { onEnd: () => a++ });
    speech.speak('ghost', 'tercera', { onEnd: () => b++ });
    spoken[1].onend!(); // la segunda ya estaba cortada
    expect(a).toBe(0);
    spoken[2].onend!();
    expect(b).toBe(1);
    expect(st.cancels).toBeGreaterThanOrEqual(3);
  });

  it('apagada no habla, y al apagarla corta lo que estaba diciendo', () => {
    const { speech, spoken, st } = fake();
    speech.speak('narrator', 'algo');
    const before = st.cancels;
    speech.set({ enabled: false });
    expect(st.cancels).toBeGreaterThan(before);
    expect(speech.active).toBe(false);
    expect(speech.speak('narrator', 'otra cosa')).toBeNull();
    expect(spoken).toHaveLength(1);
    speech.set({ enabled: true, rate: 9, voiceURI: 'auto' });
    expect(speech.rate).toBe(1.3);
    expect(speech.speak('narrator', '   ')).toBeNull();
  });

  it('mantiene viva la voz de red de Google (se corta sola a los ~15 s) hasta que termina', () => {
    vi.useFakeTimers();
    const google = v('Google español', 'es-ES', false);
    const spoken: FakeUtter[] = [];
    const calls: string[] = [];
    const synth = { speak: (u: FakeUtter) => void spoken.push(u), cancel: () => undefined, getVoices: () => [google], pause: () => void calls.push('pause'), resume: () => void calls.push('resume') };
    const speech = new Speech(synth as never, FakeUtter as never);
    speech.speak('narrator', 'una línea larga');
    vi.advanceTimersByTime(9100);
    expect(calls).toEqual(['pause', 'resume']);
    spoken[0].onend!();
    vi.advanceTimersByTime(30000);
    expect(calls).toHaveLength(2);
    vi.useRealTimers();
  });

  it('sin síntesis de voz en el navegador todo es un no-op', () => {
    const speech = new Speech(null, null);
    expect(speech.supported).toBe(false);
    expect(speech.active).toBe(false);
    expect(speech.speak('narrator', 'hola')).toBeNull();
    expect(speech.voices()).toEqual([]);
    expect(() => {
      speech.unlock();
      speech.stop();
      speech.sample();
    }).not.toThrow();
  });

  it('la muestra encadena a los cuatro personajes y el primer toque "prepara" la voz en silencio', () => {
    const { speech, spoken } = fake();
    speech.unlock();
    speech.unlock();
    expect(spoken).toHaveLength(1);
    expect(spoken[0].volume).toBe(0);
    spoken.length = 0;
    speech.sample();
    for (let i = 0; i < 4; i++) {
      expect(spoken).toHaveLength(i + 1);
      spoken[i].onend!();
    }
    expect(spoken.map((u) => u.pitch)).toEqual([PERSONAS.narrator.pitch, PERSONAS.huesos.pitch, PERSONAS.lutin.pitch, PERSONAS.pelusa.pitch].map((x) => expect.closeTo(x)));
    expect(spoken).toHaveLength(4);
  });
});
