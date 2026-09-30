import { engine } from '../../engine/core/Engine';
import type { ChapterContext } from '../../engine/mission/ChapterContext';
import type { WorldScene } from '../../engine/world/WorldScene';
import type { InteriorScene } from '../../engine/interior/InteriorScene';
import type { CharacterLook } from '../../engine/assets/gen/characters';
import type { VehicleLook } from '../../engine/assets/gen/vehicles';
import type { Dir4 } from '../../engine/core/math';

/**
 * Piezas de guion que comparten los capítulos (no son del motor: son de esta serie).
 * Cada capítulo las importa; cambiar el comportamiento acá cambia todos los capítulos.
 */

export const touch = () => engine.device.touch;

/** Globo de pensamiento por personaje: think(ctx, { municipal: '…', emprendedor: '…' }) o { all: '…' }. */
export function think(ctx: ChapterContext, byChar: Record<string, string>): Promise<void> {
  const t = byChar[ctx.charId] ?? byChar.all;
  return t ? ctx.thought(t) : Promise.resolve();
}

/** Hooks de diálogo que usan todos los capítulos. */
export function baseHooks(ctx: ChapterContext): void {
  ctx.hooks.set('radio_flash', () => {
    ctx.sfx('radio_on');
    engine.audio.speech(4.5, 0.95);
  });
}

/**
 * Ayuda de manejo. Se muestra una sola vez por navegador (queda anotado en el guardado), no en cada trayecto
 * ni en cada capítulo.
 */
export function driveHint(ctx: ChapterContext): void {
  const g = engine.save.data.global;
  if (g['seen.drive_hint']) return;
  g['seen.drive_hint'] = true;
  engine.save.persist();
  ctx.hint(
    touch()
      ? '<b>▲</b> avanza · <b>▼</b> frena<br>Antes de la esquina tocá <b>◀</b> o <b>▶</b>: el auto dobla solo. La flecha <b class="y">amarilla</b> es por donde vas.'
      : '<b>↑</b> avanzar · <b>↓</b> frenar · <b>H</b> bocina<br>Antes de la esquina, <b>←</b> o <b>→</b> (o clic en la flecha de la calle): el auto dobla solo al llegar. La flecha <b class="y">amarilla</b> es por donde vas.',
    14000,
  );
}

/**
 * Después de estacionar, bajar del auto; si se retoma de un guardado, preparar la escena a pie.
 * `carLook` / `playerLook` sólo hacen falta cuando el capítulo cambia el auto o el aspecto del jugador.
 */
export async function arriveOnFoot(
  ctx: ChapterContext,
  carMarker: string,
  playerAt: string | [number, number],
  passengers: string[],
  opts: { carLook?: VehicleLook; playerLook?: CharacterLook } = {},
): Promise<WorldScene> {
  const w = engine.current;
  if (w && w.scene.key === 'world' && (w as WorldScene).mode === 'drive') {
    const world = w as WorldScene;
    if (opts.playerLook) world.playerLook = opts.playerLook;
    await world.exitCar(passengers);
    for (const id of passengers) world.follow(id, 'player', 1.0);
    return world;
  }
  return ctx.city({
    mode: 'walk',
    car: { at: carMarker, look: opts.carLook },
    player: { at: playerAt, look: opts.playerLook },
    companions: passengers.map((id) => ({ id, follow: true })),
  });
}

/** Crea un NPC del capítulo (definido en chapter.npcs) en un marcador. */
export function spawnNpc(
  ctx: ChapterContext,
  scene: WorldScene | InteriorScene,
  id: string,
  at: string | [number, number],
  opts: { facing?: Dir4; wander?: number; pose?: 'sit' | 'phone'; z?: number } = {},
) {
  const def = ctx.npc(id);
  if (!def) throw new Error(`NPC ${id}`);
  const c = scene.spawn(id, def.look, at, { name: def.name, voice: def.voice, facing: opts.facing, sprite: def.sprite });
  if (opts.wander) scene.wander(id, opts.wander);
  if (opts.pose) c.pose = opts.pose;
  if (opts.z) c.z = opts.z;
  return c;
}

/**
 * Botón de teléfono en el HUD ("Llamar a X" / "Atender a X") que espera el toque. En ?autoplay se toca solo.
 * Devuelve cuando el jugador tocó el botón.
 */
export async function waitPhoneTap(ctx: ChapterContext, label: string): Promise<void> {
  const tapped = ctx.waitEvent('phone:call');
  engine.ui.hud.phone(ctx.t(label), () => engine.events.emit('phone:call'));
  if (engine.debug.autoplay)
    ctx.spawnTask(async () => {
      await ctx.twait(800);
      engine.events.emit('phone:call');
    });
  await tapped;
  engine.ui.hud.phone(null);
}
