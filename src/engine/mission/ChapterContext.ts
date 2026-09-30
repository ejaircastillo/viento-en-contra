import { engine } from '../core/Engine';
import { CancelToken, CancelledError } from '../core/Scheduler';
import { runDialogue, fillTemplate, type DialogueNode, type Flags } from '../dialogue/Dialogue';
import { drawPortrait } from '../assets/gen/characters';
import { hashStr } from '../core/math';
import type { ChapterDef, PlayableCharacter } from './types';
import type { WorldScene, CitySetup } from '../world/WorldScene';
import type { InteriorScene, InteriorSetup } from '../interior/InteriorScene';
import type { IsoScene } from '../world/IsoScene';
import type { ClockMeaning } from '../timer/GameClock';
import type { Speaker, ChoiceOption } from '../ui/DialogueBox';
import type { SfxName } from '../audio/AudioEngine';
import type { DocItem } from '../ui/Overlays';
import type { BraceResult } from '../ui/Brace';
import type { GustSpec } from '../core/Brace';
import type { CharacterLook } from '../assets/gen/characters';

/**
 * API que usan los guiones de capítulo (async/await). Todo lo que espera tiempo o eventos
 * es cancelable y respeta la pausa. Los manejadores registrados durante un estado se
 * limpian solos al terminar ese estado.
 */
export class ChapterContext {
  private cleanups: (() => void)[] = [];
  state = '';

  constructor(
    readonly chapter: ChapterDef,
    readonly character: PlayableCharacter,
    readonly flags: Flags,
    readonly token: CancelToken,
  ) {}

  get charId(): string {
    return this.character.id;
  }

  /** Envuelve una espera de UI para que se cancele si se sale del capítulo. */
  guard<T>(p: Promise<T>): Promise<T> {
    if (this.token.cancelled) return Promise.reject(new CancelledError());
    return new Promise<T>((resolve, reject) => {
      const off = this.token.onCancel(() => reject(new CancelledError()));
      p.then(
        (v) => {
          off();
          resolve(v);
        },
        (e) => {
          off();
          reject(e);
        },
      );
    });
  }

  is(id: string): boolean {
    return this.character.id === id;
  }

  /** Valor de una decisión de un capítulo anterior (ej. carried('tono_final')), o undefined si no la hay. */
  carried(key: string): string | number | boolean | undefined {
    return this.flags[`prev_${key}`];
  }

  /** Elige texto según personaje: pick({municipal: '…', emprendedor: '…'}). */
  pick<T>(byChar: Record<string, T>): T {
    return byChar[this.character.id] ?? byChar.all;
  }

  get vocab(): Record<string, string> {
    return { ...this.chapter.vocab, ...this.character.vocab, player: this.character.name, time: engine.clock.text };
  }

  t(text: string): string {
    return fillTemplate(text, this.vocab);
  }

  // ------------------------------------------------------------ escenas

  /** Id del plano de ciudad que corresponde a este capítulo y personaje. */
  private planId(): string {
    const src = this.chapter.city;
    return typeof src === 'function' ? src(this.character.id).id : src.id;
  }

  async city(setup: CitySetup): Promise<WorldScene> {
    this.token.throwIfCancelled();
    const sm = engine.game.scene;
    if (sm.isActive('interior')) sm.stop('interior');
    let world = sm.getScene('world') as WorldScene;
    const samePlan = world?.model?.plan.id === this.planId();
    if (sm.isActive('world') && world.sceneReady && world.chapter === this.chapter && samePlan) {
      this.resetWorld(world);
    } else {
      if (sm.isActive('world') || sm.isSleeping('world')) sm.stop('world');
      engine.ui.menus.loading('Cargando la ciudad…');
      const ready = engine.events.waitFor('scene:ready', (s: IsoScene) => s.scene.key === 'world', this.token);
      sm.start('world', { chapter: this.chapter });
      world = (await ready) as WorldScene;
      engine.ui.menus.loading(null);
    }
    world.applySetup(setup);
    engine.current = world;
    // esperar a que el suelo visible esté pintado antes de mostrar
    await engine.scheduler.waitUntil(() => world.streamer.pendingGround === 0, this.token);
    if (engine.ui.faded) await engine.ui.fadeIn(350);
    return world;
  }

  /**
   * Continúa en la ciudad sin reiniciarla si ya estamos en el modo pedido (ej. dos estados de
   * manejo seguidos). Si se retoma desde un guardado, prepara la escena desde cero con `setup`.
   */
  async cityContinue(setup: CitySetup): Promise<{ world: WorldScene; resumed: boolean }> {
    const sm = engine.game.scene;
    const w = sm.getScene('world') as WorldScene;
    const same =
      sm.isActive('world') &&
      w.sceneReady &&
      w.chapter === this.chapter &&
      w.model?.plan.id === this.planId() &&
      engine.current === w &&
      w.mode === setup.mode &&
      (setup.mode !== 'drive' || !!w.vehicles.player);
    if (same) return { world: w, resumed: false };
    return { world: await this.city(setup), resumed: true };
  }

  private resetWorld(w: WorldScene): void {
    for (const id of [...w.chars.keys()]) if (!id.startsWith('ped:')) w.despawn(id);
    w.player = null;
    w.interactables.clear();
    w.clearInteractHud();
    w.setDestination(null);
    w.walkBounds = null;
    w.passengers = [];
    w.setAutopilot(false);
    engine.audio.setEngine(false);
    engine.radio.setActive(false);
    engine.ui.hud.radio(false, false);
  }

  async interior(id: string, setup: InteriorSetup): Promise<InteriorScene> {
    this.token.throwIfCancelled();
    const sm = engine.game.scene;
    if (sm.isActive('world')) sm.stop('world');
    if (sm.isActive('interior')) sm.stop('interior');
    const ready = engine.events.waitFor('scene:ready', (s: IsoScene) => s.scene.key === 'interior', this.token);
    sm.start('interior', { chapter: this.chapter, id });
    const room = (await ready) as InteriorScene;
    room.applySetup(setup);
    engine.current = room;
    await engine.scheduler.waitUntil(() => room.streamer.pendingGround === 0, this.token);
    if (engine.ui.faded) await engine.ui.fadeIn(350);
    return room;
  }

  get scene(): IsoScene {
    const s = engine.current;
    if (!s) throw new Error('[Ctx] no hay escena activa');
    return s;
  }

  get world(): WorldScene {
    const s = engine.current;
    if (!s || s.scene.key !== 'world') throw new Error('[Ctx] la escena activa no es la ciudad');
    return s as WorldScene;
  }

  get room(): InteriorScene {
    const s = engine.current;
    if (!s || s.scene.key !== 'interior') throw new Error('[Ctx] la escena activa no es un interior');
    return s as InteriorScene;
  }

  // ------------------------------------------------------------ tiempo

  wait(ms: number): Promise<void> {
    return engine.scheduler.wait(ms, this.token);
  }

  waitUntil(pred: () => boolean): Promise<void> {
    return engine.scheduler.waitUntil(pred, this.token);
  }

  get clock() {
    return engine.clock;
  }

  clockMeaning(m: ClockMeaning | null): void {
    engine.clock.meaning = m;
    engine.clock.set(engine.clock.minutes);
  }

  // ------------------------------------------------------------ narrativa

  speaker(id: string): Speaker | null {
    if (id === 'player') return { name: this.character.name, portrait: this.portrait('player'), voice: this.character.voice };
    if (id === 'radio') return { name: 'Radio 89', voice: 0.8 };
    const npc = this.npc(id);
    if (npc) return { name: npc.name, portrait: this.portrait(id), voice: npc.voice ?? 1 };
    return { name: id };
  }

  npc(id: string) {
    return this.chapter.npcs[`${id}@${this.character.id}`] ?? this.chapter.npcs[id];
  }

  portrait(id: string): string {
    const look = id === 'player' ? this.character.look : this.npc(id)?.look;
    if (!look) return '';
    const key = `portrait:${hashStr(JSON.stringify(look)).toString(36)}`;
    return engine.assets.dataUrl(key, () => drawPortrait(look), 3);
  }

  /** Ejecuta un diálogo por id (de chapter.dialogues) o una lista de nodos. */
  async say(dlg: string | DialogueNode[]): Promise<void> {
    const nodes = typeof dlg === 'string' ? this.chapter.dialogues[dlg] : dlg;
    if (!nodes) throw new Error(`[Ctx] diálogo inexistente: ${dlg}`);
    const scene = engine.current;
    if (scene) scene.control = false;
    engine.input.clearQueued();
    try {
      await runDialogue(nodes, {
        characterId: this.character.id,
        flags: this.flags,
        vocab: this.vocab,
        speaker: (id) => this.speaker(id),
        say: async (sp, text, think) => {
          this.token.throwIfCancelled();
          await this.guard(
            engine.ui.dialogue.say(think ? { ...(sp ?? this.speaker('player')!), name: `${sp?.name ?? this.character.name} (piensa)` } : sp, text, { thinking: think }),
          );
          this.token.throwIfCancelled();
        },
        choose: (opts) => this.guard(engine.ui.dialogue.choose(opts)),
        thought: (text) => void this.thought(text),
        hook: (name, args) => this.hook(name, args),
        wait: (ms) => this.wait(ms),
        token: this.token,
      });
    } finally {
      if (scene) scene.control = true;
      engine.ui.dialogue.hide();
    }
  }

  line(who: string | null, text: string): Promise<void> {
    return this.say([{ who, text }]);
  }

  choose(opts: ChoiceOption[]): Promise<number> {
    return this.guard(engine.ui.dialogue.choose(opts.map((o) => ({ ...o, text: this.t(o.text) }))));
  }

  /** Pensamiento en globo sobre el personaje (no bloquea el juego). */
  thought(text: string, who = 'player'): Promise<void> {
    const scene = engine.current;
    if (!scene) return Promise.resolve();
    return this.guard(engine.ui.bubbles.thought(this.t(text), scene.anchorOf(who)));
  }

  bark(who: string, text: string, opts: { ms?: number; shout?: boolean; name?: boolean } = {}): void {
    const scene = engine.current;
    if (!scene) return;
    const npc = this.npc(who);
    engine.ui.bubbles.bark(this.t(text), scene.anchorOf(who), {
      who: opts.name === false ? undefined : npc?.name,
      ms: opts.ms,
      shout: opts.shout,
    });
  }

  /** Objetivo visible. `target` (id interactuable o punto) lo usa el modo ?autoplay de QA. */
  objective(text: string | null, target?: string | [number, number]): void {
    engine.ui.hud.objective(text ? this.t(text) : null);
    if (engine.current) engine.current.autoTarget = target ?? null;
  }

  hint(html: string | null, ms?: number): void {
    engine.ui.hud.hint(html, ms);
  }

  toast(text: string, ms?: number): void {
    engine.ui.hud.toast(this.t(text), ms);
  }

  card(big: string, small = '', ms = 2600): Promise<void> {
    return this.guard(engine.ui.menus.card(this.t(big), this.t(small), ms));
  }

  notify(from: string, text: string): Promise<void> {
    return this.guard(engine.ui.phone.notify(this.t(from), this.t(text)));
  }

  /**
   * Llamada con guion propio (ej. un contestador automático con menú): `body` corre con la llamada
   * conectada y el jugador con el teléfono en la oreja. `name` reemplaza el nombre del contacto en pantalla.
   */
  async phoneSession(contactId: string, body: () => Promise<void>, name?: string): Promise<void> {
    const sp = this.speaker(contactId)!;
    const scene = engine.current;
    if (scene) {
      scene.control = false;
      const p = scene.chars.get('player');
      if (p) p.pose = 'phone';
    }
    await this.guard(engine.ui.phone.ring({ name: name ?? sp.name, portrait: sp.portrait }, 2));
    try {
      await body();
    } finally {
      engine.ui.phone.hangUp();
      engine.audio.sfx('ui_back');
      const p = scene?.chars.get('player');
      if (p) p.pose = 'normal';
      if (scene) scene.control = true;
    }
  }

  phoneCall(contactId: string, dialogueId: string): Promise<void> {
    return this.phoneSession(contactId, () => this.say(dialogueId));
  }

  documents(opts: {
    title: string;
    subtitle: string;
    docs: DocItem[];
    mode: 'review' | 'handover';
    stamp: string;
    doneLabel: string;
  }): Promise<void> {
    return this.guard(engine.ui.docs.run({ ...opts, title: this.t(opts.title), subtitle: this.t(opts.subtitle) }));
  }

  /**
   * Minijuego "aguantar el cartel" contra ráfagas (ver core/Brace.ts). Devuelve cuántas ráfagas se
   * aguantaron y cuántas se perdieron; el guion decide qué comentario hace cada resultado.
   */
  async brace(opts: { title: string; subtitle?: string; holdLabel?: string; gusts?: GustSpec[] }): Promise<BraceResult> {
    const scene = engine.current;
    if (scene) scene.control = false;
    engine.input.clearQueued();
    engine.wind.forced = 0.14;
    try {
      return await this.guard(
        engine.ui.brace.run({
          ...opts,
          title: this.t(opts.title),
          subtitle: opts.subtitle ? this.t(opts.subtitle) : undefined,
          onLevel: (l) => {
            engine.wind.forced = 0.12 + l * 0.85;
          },
          onGust: (peak) => {
            engine.audio.sfx('gust', 0.55 + 0.45 * peak);
            scene?.cameras.main.shake(260 + peak * 260, 0.0012 + peak * 0.0028);
          },
          onSlip: () => {
            engine.audio.sfx('whoosh');
            scene?.cameras.main.shake(320, 0.006);
          },
        }),
      );
    } finally {
      engine.wind.forced = null;
      if (scene) scene.control = true;
    }
  }

  /** Ráfaga guionada (ceremonias, escenas): sonido, sacudón de cámara y viento fuerte unos segundos. */
  gust(peak = 0.85, seconds = 3): void {
    engine.wind.gustNow(peak, seconds);
    engine.audio.sfx('gust', 0.6 + 0.4 * peak);
    this.engineScene()?.cameras.main.shake(300 + peak * 300, 0.002 + peak * 0.004);
  }

  private engineScene(): IsoScene | null {
    return engine.current;
  }

  /** Cambia el aspecto del jugador (ej. levanta el cartel) en la escena actual y en las siguientes al bajar del auto. */
  reskinPlayer(look: CharacterLook | null): void {
    const scene = engine.current;
    if (!scene) return;
    const world = scene.scene.key === 'world' ? (scene as WorldScene) : null;
    if (world) world.playerLook = look;
    if (scene.chars.has('player')) scene.reskin('player', look ?? this.character.look, look ? undefined : this.character.sprite);
  }

  /** Cuánto cuesta cargar algo grande contra el viento (1 = nada; 2 = el viento pesa el doble al caminar). */
  carry(mult: number): void {
    engine.wind.carry = mult;
  }

  crt(opts: { title: string; lines: string[]; button: string }): Promise<void> {
    return this.guard(engine.ui.docs.crt({ ...opts, lines: opts.lines.map((l) => this.t(l)) }));
  }

  paper(opts: Parameters<typeof engine.ui.docs.paper>[0]): Promise<void> {
    return this.guard(engine.ui.docs.paper({ ...opts, lines: opts.lines?.map((l) => this.t(l)), handwritten: opts.handwritten ? this.t(opts.handwritten) : undefined }));
  }

  fadeOut(ms?: number): Promise<void> {
    return engine.ui.fadeOut(ms);
  }

  fadeIn(ms?: number): Promise<void> {
    return engine.ui.fadeIn(ms);
  }

  music(id: string | null): void {
    engine.audio.setMusicViaRadio(false);
    engine.audio.playMusic(id);
  }

  sfx(name: SfxName, vol?: number): void {
    engine.audio.sfx(name, vol);
  }

  readonly radio = {
    program: (id: string) => engine.radio.program(id),
    flash: (id: string) => engine.radio.flash(id),
    on: () => {
      engine.radio.setActive(true);
      engine.ui.hud.radio(true, engine.radio.enabled);
    },
    off: () => {
      engine.radio.setActive(false);
      engine.ui.hud.radio(false, false);
    },
  };

  /** Acciones que un diálogo puede disparar con { do: '...' }. */
  async hook(name: string, args: any): Promise<void> {
    const [kind, arg] = name.split(':');
    switch (kind) {
      case 'sfx':
        this.sfx(arg as SfxName);
        break;
      case 'clock':
        engine.clock.advance(parseFloat(arg));
        break;
      case 'bark':
        this.bark(args.who, args.text);
        break;
      case 'face':
        this.scene.face(args.who, args.to);
        break;
      case 'pose': {
        const c = this.scene.chars.get(args.who);
        if (c) c.pose = args.pose;
        break;
      }
      case 'notify':
        await this.notify(args.from, args.text);
        break;
      case 'shake':
        this.scene.cameras.main.shake(260, 0.004);
        break;
      default: {
        const custom = this.hooks.get(kind);
        if (custom) await custom(arg, args);
        else console.warn('[Ctx] hook desconocido', name);
      }
    }
  }

  readonly hooks = new Map<string, (arg: string, args: any) => Promise<void> | void>();

  // ------------------------------------------------------------ eventos

  waitEvent<T = any>(name: string, filter?: (p: T) => boolean): Promise<T> {
    return engine.events.waitFor<T>(name, filter, this.token);
  }

  waitInteract(id: string): Promise<void> {
    return this.waitEvent(`interact:${id}`).then(() => undefined);
  }

  /** Manejador concurrente mientras dure el estado actual. */
  onInteract(id: string, fn: () => Promise<void> | void, once = false): void {
    let busy = false;
    const off = engine.events.on(`interact:${id}`, () => {
      if (busy) return;
      busy = true;
      if (once) off();
      Promise.resolve(fn())
        .catch((e) => {
          if (!(e instanceof CancelledError)) console.error(e);
        })
        .finally(() => (busy = false));
    });
    this.cleanups.push(off);
  }

  waitZone(id: string): Promise<void> {
    if (engine.current?.inZone(id)) return Promise.resolve();
    return this.waitEvent(`zone:enter:${id}`).then(() => undefined);
  }

  onZone(id: string, fn: () => Promise<void> | void, once = true): void {
    const off = engine.events.on(`zone:enter:${id}`, () => {
      if (once) off();
      Promise.resolve(fn()).catch((e) => {
        if (!(e instanceof CancelledError)) console.error(e);
      });
    });
    this.cleanups.push(off);
  }

  onEvent(name: string, fn: (p: any) => Promise<void> | void, once = false): void {
    const off = engine.events.on(name, (p) => {
      if (once) off();
      Promise.resolve(fn(p)).catch((e) => {
        if (!(e instanceof CancelledError)) console.error(e);
      });
    });
    this.cleanups.push(off);
  }

  /** Token que se cancela al terminar el estado actual (para tareas en paralelo). */
  private stateToken = new CancelToken();

  /** Espera ligada al estado actual: usar dentro de spawnTask. */
  twait(ms: number): Promise<void> {
    return engine.scheduler.wait(ms, this.stateToken);
  }

  twaitUntil(pred: () => boolean): Promise<void> {
    return engine.scheduler.waitUntil(pred, this.stateToken);
  }

  /** ¿Sigue vivo el estado en el que se lanzó la tarea? */
  get stateAlive(): boolean {
    return !this.stateToken.cancelled && !this.token.cancelled;
  }

  /**
   * Corre una tarea en paralelo al flujo principal. Se detiene sola al cambiar de estado
   * si usa ctx.twait / ctx.twaitUntil para sus pausas.
   */
  spawnTask(fn: () => Promise<void>): void {
    const off = this.token.onCancel(() => this.stateToken.cancel());
    fn()
      .catch((e) => {
        if (!(e instanceof CancelledError)) console.error('[Ctx] tarea', e);
      })
      .finally(off);
  }

  endState(): void {
    engine.wind.forced = null;
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.stateToken.cancel();
    this.stateToken = new CancelToken();
    engine.ui.hud.clearStateHint();
    engine.clock.settle();
  }
}
