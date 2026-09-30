import { engine } from '../core/Engine';
import { ChapterRunner } from './ChapterRunner';
import { drawPortrait } from '../assets/gen/characters';
import { hashStr } from '../core/math';
import { nextChapterId, type ChapterDef } from './types';
import type { Flags } from '../dialogue/Dialogue';
import type { WorldScene } from '../world/WorldScene';
import type { IsoScene } from '../world/IsoScene';

/**
 * Flujo de la demo: toque inicial (desbloquea audio) → título (con la ciudad de fondo y la lista de
 * capítulos) → selección de personaje → capítulo → "Continuará" → seguir con el capítulo siguiente,
 * jugar la misma historia con el otro personaje o volver al título.
 */

let runner: ChapterRunner | null = null;
let pendingAction: 'restart' | 'quit' | null = null;
const chapterCache = new Map<string, ChapterDef>();

async function loadChapter(id: string): Promise<ChapterDef> {
  let ch = chapterCache.get(id);
  if (!ch) {
    const loader = engine.content.chapters[id];
    if (!loader) throw new Error(`Capítulo desconocido: ${id}`);
    ch = await loader();
    ch.setup?.();
    for (const t of ch.tracks) engine.audio.registerTrack(t);
    chapterCache.set(id, ch);
  }
  return ch;
}

function portraitOf(charId: string): string {
  const c = engine.content.characters[charId];
  return engine.assets.dataUrl(`portrait:${hashStr(JSON.stringify(c.look)).toString(36)}`, () => drawPortrait(c.look), 3);
}

export function pauseGame(): void {
  if (engine.paused || !runner) return;
  engine.paused = true;
  engine.scheduler.paused = true;
  engine.ui.bubbles.paused = true;
  const sc = engine.current;
  if (sc && sc.sys.isActive()) sc.scene.pause();
  engine.audio.setEngine(false);
  void engine.ui.menus
    .pause(engine.save.settings, (k, v) => engine.save.setSetting(k, v), engine.device.touch)
    .then((r) => {
      engine.paused = false;
      engine.scheduler.paused = false;
      engine.ui.bubbles.paused = false;
      const s = engine.current;
      if (s && s.sys.isPaused()) s.scene.resume();
      if (r === 'resume') return;
      pendingAction = r;
      runner?.abort();
    });
}

async function startAttract(chapter: ChapterDef): Promise<void> {
  const sm = engine.game.scene;
  engine.chapter = chapter;
  if (sm.isActive('interior')) sm.stop('interior');
  if (sm.isActive('world')) sm.stop('world');
  engine.ui.menus.loading('Cargando…');
  const ready = engine.events.waitFor('scene:ready', (s: IsoScene) => s.scene.key === 'world');
  sm.start('world', { chapter });
  const w = (await ready) as WorldScene;
  engine.ui.menus.loading(null);
  w.applySetup({ mode: 'attract', traffic: true });
  engine.current = w;
}

function resetUi(): void {
  engine.ui.dialogue.forceClose();
  engine.ui.bubbles.clear();
  engine.ui.captions.clear();
  engine.ui.phone.hangUp();
  engine.ui.hud.objective(null);
  engine.ui.hud.hint(null);
  engine.ui.hud.action(null);
  engine.ui.hud.phone(null);
  engine.ui.hud.radio(false, false);
  engine.ui.hud.horn(false);
  engine.ui.hud.turn(null);
  engine.ui.hud.signal(null);
  engine.ui.hud.target(null);
  engine.ui.drive.show(false);
  engine.input.setMode('walk');
  document.querySelectorAll('#panels .modal-back, #panels .notif, #panels .phone, #panels .card, #panels .brace').forEach((e) => e.remove());
  engine.radio.reset();
  engine.audio.setEngine(false);
  engine.wind.forced = null;
  engine.wind.carry = 1;
}

/** Flags que el capítulo declara como "consecuencias" para los capítulos siguientes. */
function carryOf(chapter: ChapterDef, flags: Flags): Flags {
  const out: Flags = {};
  for (const k of chapter.carry ?? []) if (flags[k] !== undefined) out[k] = flags[k];
  return out;
}

async function play(chapter: ChapterDef, charId: string, start?: { state: string; flags: Flags; clock: number }): Promise<'done' | 'title'> {
  for (;;) {
    const character = engine.content.characters[charId];
    if (!start) engine.save.startRun(chapter.id, charId, chapter.initialState);
    runner = new ChapterRunner(chapter, character, { ...(start?.flags ?? {}) });
    engine.ui.hud.onPause = () => pauseGame();
    pendingAction = null;
    engine.audio.playMusic(null);
    const current = runner;
    const result = await current.run(start?.state ?? engine.debug.state ?? undefined, start?.clock);
    runner = null;
    resetUi();
    if (result === 'done') {
      engine.save.complete(chapter.id, charId, carryOf(chapter, current.ctx.flags));
      return 'done';
    }
    if (result === 'error') {
      await engine.ui.docs.paper({
        title: 'Se nos voló un papel',
        lines: ['Algo falló en esta escena. Reintentamos desde el último punto de guardado.'],
        button: 'Reintentar',
      });
      const run = engine.save.data.run;
      start = run ? { state: run.stateId, flags: run.flags, clock: run.clock } : undefined;
      continue;
    }
    if (pendingAction === 'restart') {
      start = undefined;
      continue;
    }
    return 'title';
  }
}

/** Esc pausa; al volver a la pestaña o salir de la app en el teléfono, la partida queda en pausa. */
function installPauseHooks(): void {
  engine.input.onKey((k) => {
    if (k === 'escape' && runner && !engine.paused && !engine.ui.faded) {
      pauseGame();
      return true;
    }
    return false;
  });
  const qa = engine.debug.enabled || engine.debug.autoplay || new URLSearchParams(location.search).has('timer');
  if (!qa) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && runner && !engine.paused) pauseGame();
    });
  }
}

export async function mainFlow(): Promise<void> {
  const ui = engine.ui;
  const pack = engine.content;
  ui.hud.setVisible(false);
  ui.menus.demoLabel = pack.demoLabel;
  installPauseHooks();
  const startId = engine.debug.chapter && pack.chapters[engine.debug.chapter] ? engine.debug.chapter : pack.firstChapter;
  const attractP = loadChapter(pack.firstChapter);
  const startP = loadChapter(startId);
  await ui.menus.tapToStart();
  engine.audio.unlock();
  const attractChapter = await attractP;
  await startP;
  await startAttract(attractChapter);
  let queued: { chapterId: string; charId: string } | null = null;
  for (;;) {
    ui.hud.setVisible(false);
    engine.audio.playMusic('title');
    let chapter: ChapterDef;
    let charId: string;
    let start: { state: string; flags: Flags; clock: number } | undefined;
    if (queued) {
      chapter = await loadChapter(queued.chapterId);
      charId = queued.charId;
      queued = null;
    } else {
      const run = engine.save.data.run;
      const resumable = run && pack.chapters[run.chapterId] ? run : null;
      const done = (id: string) => (engine.save.data.completed[id] ?? []).length > 0;
      const choice = engine.debug.state
        ? ({ kind: 'chapter', id: startId } as const)
        : await ui.menus.title({
            chapters: pack.chapterInfo.map((c) => ({ ...c, done: done(c.id) })),
            cont: resumable
              ? {
                  label: `Continuar · Cap. ${pack.chapterInfo.find((c) => c.id === resumable.chapterId)?.number ?? ''} · ${pack.characters[resumable.characterId]?.name ?? ''}`,
                }
              : undefined,
            autoId: startId,
          });
      if (choice.kind === 'continue' && resumable) {
        chapter = await loadChapter(resumable.chapterId);
        charId = resumable.characterId;
        start = { state: resumable.stateId, flags: resumable.flags, clock: resumable.clock };
      } else {
        chapter = await loadChapter(choice.kind === 'chapter' ? choice.id : startId);
        const doneHere = engine.save.data.completed[chapter.id] ?? [];
        const cards = chapter.characters.map((id) => {
          const c = pack.characters[id];
          const o = chapter.cards?.[id];
          return {
            id,
            name: c.fullName,
            role: o?.role ?? c.role,
            blurb: o?.blurb ?? c.blurb,
            timer: o?.timer ?? c.clock.label,
            portrait: portraitOf(id),
            done: doneHere.includes(id),
            doneLabel: `✔ Capítulo ${chapter.number} completado`,
          };
        });
        charId =
          engine.debug.char && pack.characters[engine.debug.char]
            ? engine.debug.char
            : await ui.menus.characterSelect(cards, chapter.selectPrompt ?? '¿CON QUIÉN ARRANCÁS?');
      }
    }
    await ui.fadeOut(350);
    const result = await play(chapter, charId, start);
    if (result === 'done') {
      engine.audio.playMusic('ending');
      const nextId = nextChapterId(pack, chapter.id);
      const nextInfo = nextId ? pack.chapterInfo.find((c) => c.id === nextId) : null;
      const others = chapter.characters.filter((c) => c !== charId);
      const other = others[0] ? pack.characters[others[0]] : null;
      const doneNow = engine.save.data.completed[chapter.id] ?? [];
      const r = await ui.menus.continueScreen({
        number: chapter.number,
        line: chapter.ending[charId] ?? '',
        next: nextInfo ? { label: `Capítulo ${nextInfo.number} · ${nextInfo.title}` } : undefined,
        other: other ? { id: other.id, name: other.name, done: doneNow.includes(other.id), chapterNumber: chapter.number } : undefined,
        credits: chapter.credits,
      });
      if (r === 'next' && nextId) queued = { chapterId: nextId, charId };
      else if (r === 'other' && other) queued = { chapterId: chapter.id, charId: other.id };
    }
    if (!queued) {
      await startAttract(attractChapter);
      await ui.fadeIn(350);
    }
  }
}
