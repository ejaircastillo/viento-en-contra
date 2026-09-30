import { engine } from '../core/Engine';
import { IsoScene, type At } from '../world/IsoScene';
import { buildInterior, type InteriorModel } from './InteriorBuilder';
import { GroundService } from '../world/GroundService';
import { Streamer } from '../world/Streaming';
import type { ChapterDef } from '../mission/types';
import type { Dir4 } from '../core/math';
import type { CharacterLook } from '../assets/gen/characters';

export interface InteriorSetup {
  player: { at: At; facing?: Dir4; look?: CharacterLook; sprite?: string };
  companions?: { id: string; at: At; follow?: boolean }[];
}

const cache = new Map<string, { model: InteriorModel; svc: GroundService }>();

/** Escena de interior (se carga bajo demanda al entrar y se libera al salir). */
export class InteriorScene extends IsoScene {
  chapter!: ChapterDef;
  interiorId = '';
  model!: InteriorModel;

  constructor() {
    super('interior');
  }

  init(data: { chapter: ChapterDef; id: string }): void {
    this.chapter = data.chapter;
    this.interiorId = data.id;
  }

  preload(): void {
    engine.assets.queueFinals(this.load, `interior:${this.interiorId}`);
  }

  create(): void {
    const def = this.chapter.interiors[this.interiorId];
    if (!def) throw new Error(`[Interior] no existe: ${this.interiorId}`);
    let entry = cache.get(def.id);
    if (!entry) {
      const model = buildInterior(def);
      entry = { model, svc: new GroundService(model.ground) };
      cache.set(def.id, entry);
    }
    this.model = entry.model;
    const m = this.model;
    this.cameras.main.setBackgroundColor('#101318');
    this.setupGrid(
      {
        w: m.w,
        h: m.h,
        walkGrid: m.walkGrid,
        solidGrid: m.solidGrid,
        groundTypes: m.ground.ground,
        markers: m.markers,
        zones: m.zones,
        statics: m.statics,
        captions: m.captions,
      },
      m.w,
      m.h,
    );
    this.streamer = new Streamer(this, m.ground, entry.svc, engine.assets, m.statics);
    this.streamer.margin = 400;
    this.streamer.warmTextures();
    engine.audio.setInterior(true);
    engine.ui.setInterior(true);
    this.events.once('shutdown', () => {
      engine.audio.setInterior(false);
      engine.ui.setInterior(false);
      this.cleanupIso();
    });
    this.sceneReady = true;
    engine.events.emit('scene:ready', this);
  }

  protected captionRadius(): number {
    return 4.2;
  }

  applySetup(s: InteriorSetup): void {
    const ch = engine.character!;
    const look = s.player.look ?? ch.look;
    this.player = this.spawn('player', look, s.player.at, { facing: s.player.facing, name: ch.name, voice: ch.voice, sprite: s.player.look ? s.player.sprite : ch.sprite });
    this.player.speed = 2.0;
    for (const c of s.companions ?? []) {
      const npc = this.npcDef(c.id);
      if (!npc) continue;
      this.spawn(c.id, npc.look, c.at, { name: npc.name, voice: npc.voice, sprite: npc.sprite });
      if (c.follow) this.follow(c.id, 'player', 1.0);
    }
    this.camFollow = { kind: 'char', id: 'player' };
    this.snapCamera();
  }
}
