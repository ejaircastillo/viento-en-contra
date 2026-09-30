import { engine } from '../core/Engine';
import { CancelToken, CancelledError } from '../core/Scheduler';
import { ChapterContext } from './ChapterContext';
import type { ChapterDef, PlayableCharacter, StateFn } from './types';
import type { Flags } from '../dialogue/Dialogue';
import { formatHHMM, parseHHMM } from '../core/math';

/**
 * Máquina de estados explícita del capítulo: cada estado es una función async que prepara
 * su escena desde cero y devuelve el id del siguiente. Al entrar a cada estado se guarda un
 * checkpoint (personaje, estado, flags, hora), así "Continuar" retoma exactamente ahí.
 */
export class ChapterRunner {
  readonly token = new CancelToken();
  readonly ctx: ChapterContext;
  current = '';
  private offClock: (() => void) | null = null;

  constructor(
    readonly chapter: ChapterDef,
    readonly character: PlayableCharacter,
    flags: Flags = {},
  ) {
    // decisiones de capítulos anteriores de este personaje: prev_<flag> (no pisan lo restaurado de un guardado)
    const prev: Flags = {};
    for (const [k, v] of Object.entries(engine.save.data.global)) {
      if (k.startsWith(`${character.id}.`)) prev[`prev_${k.slice(character.id.length + 1)}`] = v;
    }
    this.ctx = new ChapterContext(chapter, character, { ...prev, ...flags }, this.token);
  }

  private hookClockHud(): void {
    const hud = engine.ui.hud;
    this.offClock = engine.clock.onChange((m) => {
      const meaning = engine.clock.meaning;
      if (!meaning) {
        hud.clock(formatHHMM(m), '', 'ok');
        return;
      }
      const left = parseHHMM(meaning.deadline) - m;
      const warn = meaning.warnMinutes ?? 10;
      if (left > warn) hud.clock(formatHHMM(m), meaning.label, 'ok');
      else if (left > 0) hud.clock(formatHHMM(m), meaning.label, 'warn');
      else hud.clock(formatHHMM(m), meaning.lateLabel.replace('{m}', String(Math.floor(-left))), 'late');
    });
  }

  async run(startState?: string, clock?: number): Promise<'done' | 'aborted' | 'error'> {
    engine.chapter = this.chapter;
    engine.character = this.character;
    engine.runToken = this.token;
    engine.radio.setLibrary(this.chapter.radio);
    engine.radio.characterId = this.character.id;
    engine.clock.meaning = this.chapter.clock?.[this.character.id] ?? this.character.clock;
    engine.wind.base = this.chapter.windBase ?? 0.45;
    engine.wind.carry = 1;
    engine.wind.forced = null;
    if (clock) engine.clock.set(clock);
    engine.clock.running = true;
    engine.ui.hud.setVisible(true);
    engine.ui.hud.showClock(true);
    this.hookClockHud();
    let state: string | null = startState ?? this.chapter.initialState;
    try {
      while (state) {
        const fn: StateFn | undefined = this.chapter.states[state];
        if (!fn) throw new Error(`[Runner] estado inexistente: ${state}`);
        this.current = state;
        this.ctx.state = state;
        engine.save.checkpoint(state, this.ctx.flags, engine.clock.minutes);
        engine.events.emit('state:enter', { state });
        if (engine.debug.enabled) console.info(`[Capítulo] → ${state} (${engine.clock.text})`);
        const next: string | null = await fn(this.ctx);
        this.ctx.endState();
        state = next;
      }
      return 'done';
    } catch (err) {
      this.ctx.endState();
      if (err instanceof CancelledError || this.token.cancelled) return 'aborted';
      console.error('[Runner] error en estado', this.current, err);
      return 'error';
    } finally {
      this.offClock?.();
      engine.clock.running = false;
      engine.wind.base = 0.45;
      engine.wind.carry = 1;
      engine.wind.forced = null;
    }
  }

  abort(): void {
    this.token.cancel();
  }
}
