import { describe, expect, it } from 'vitest';
import { evalCond, fillTemplate, runDialogue, type DialogueNode, type Flags } from '../src/engine/dialogue/Dialogue';
import { dialogues } from '../src/content/chapter01/dialogues';
import { characters } from '../src/content/characters';
import { npcs } from '../src/content/chapter01/npcs';
import { CONFIG } from '../src/content/chapter01/config';

const CHARS = Object.keys(characters);

function vocabFor(charId: string): Record<string, string> {
  const c = characters[charId];
  return { ...CONFIG.vocab, ...c.vocab, player: c.name, time: '08:37' };
}

function knownSpeaker(who: string, charId: string): boolean {
  if (['player', 'kid', 'sister', 'radio'].includes(who)) return true;
  return !!npcs[`${who}@${charId}`] || !!npcs[who];
}

/** Recorre un diálogo eligiendo siempre la opción `pick` y devuelve lo que se dijo. */
async function play(nodes: DialogueNode[], charId: string, pick: number, flags: Flags = {}) {
  const said: { who: string | null; text: string }[] = [];
  await runDialogue(nodes, {
    characterId: charId,
    flags,
    vocab: vocabFor(charId),
    speaker: (id) => ({ name: id }),
    say: async (sp, text) => {
      said.push({ who: sp?.name ?? null, text });
    },
    choose: async (opts) => Math.min(pick, opts.length - 1),
    thought: () => {},
    hook: () => {},
    wait: async () => {},
  });
  return said;
}

describe('condiciones y plantillas', () => {
  it('evalúa flags, negaciones, igualdades y personaje', () => {
    const env = { characterId: 'municipal', flags: { gorro: true, tono: 'ironico' } as Flags };
    expect(evalCond('gorro', env)).toBe(true);
    expect(evalCond('!gorro', env)).toBe(false);
    expect(evalCond('tono=ironico', env)).toBe(true);
    expect(evalCond('tono!=ironico', env)).toBe(false);
    expect(evalCond('char=municipal & gorro', env)).toBe(true);
    expect(evalCond('char=emprendedor', env)).toBe(false);
  });

  it('completa {claves} y deja las desconocidas', () => {
    expect(fillTemplate('Hola {kid}, soy {x}', { kid: 'Tomi' })).toBe('Hola Tomi, soy {x}');
  });
});

describe('diálogos del Capítulo 1', () => {
  const perCharacter = ['home_intro', 'hat_pickup', 'school_strike', 'call_sister', 'drop_child', 'reveal'];

  it('cada escena compartida tiene una versión por protagonista', () => {
    for (const base of perCharacter) for (const c of CHARS) expect(dialogues[`${base}_${c}`], `${base}_${c}`).toBeTruthy();
  });

  it('las escenas familiares no son iguales entre protagonistas', async () => {
    for (const base of ['school_strike', 'call_sister', 'drop_child', 'hat_pickup']) {
      const a = (await play(dialogues[`${base}_municipal`], 'municipal', 0)).map((l) => l.text).join('|');
      const b = (await play(dialogues[`${base}_emprendedor`], 'emprendedor', 0)).map((l) => l.text).join('|');
      expect(a).not.toBe(b);
    }
  });

  it('la hermana no le dice "amor" al hermano', async () => {
    for (const c of CHARS)
      for (const base of ['call_sister', 'drop_child'])
        for (const pick of [0, 1, 2])
          for (const gorro of [true, false]) {
            const lines = await play(dialogues[`${base}_${c}`], c, pick, { gorro });
            for (const l of lines.filter((x) => x.who === 'sister')) expect(l.text.toLowerCase()).not.toMatch(/\bamor\b/);
          }
  });

  it('todos los diálogos se recorren sin claves sin completar ni hablantes desconocidos', async () => {
    for (const [id, nodes] of Object.entries(dialogues)) {
      const owner = CHARS.find((c) => id.endsWith(`_${c}`));
      for (const c of owner ? [owner] : CHARS)
        for (const pick of [0, 1, 2])
          for (const gorro of [true, false]) {
            const lines = await play(nodes, c, pick, { gorro });
            for (const l of lines) {
              expect(l.text, `${id} (${c})`).not.toMatch(/\{\w+\}/);
              if (l.who) expect(knownSpeaker(l.who, c), `${id}: ${l.who}`).toBe(true);
            }
          }
    }
  });

  it('las hermanas tienen nombre y relación claros', () => {
    expect(npcs['sister@municipal'].name).toMatch(/Caro/);
    expect(npcs['sister@emprendedor'].name).toMatch(/Vero/);
    expect(npcs['sister@municipal'].name).toMatch(/hermana/);
    expect(npcs.elba.name).toMatch(/mamá/);
  });
});
