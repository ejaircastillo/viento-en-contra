import { engine } from './Engine';
import type { WorldScene } from '../world/WorldScene';

/**
 * Herramientas de QA en consola (window.__vec). Útiles para artistas y testers:
 *   __vec.keys()                 → lista de claves de sprites generados (para el manifiesto)
 *   __vec.png('char.municipal')  → abre el sprite como PNG (plantilla para arte final)
 *   __vec.autopilot(true)        → el auto sigue el GPS solo
 *   __vec.clock('08:25')         → mueve el reloj
 */
export function installDebugTools(): void {
  const api = {
    engine,
    keys(): { key: string; w: number; h: number; frames: number }[] {
      const rows = engine.assets.list().map((r) => ({ key: r.key, w: r.w, h: r.h, frames: r.frames.length }));
      console.table(rows);
      return rows;
    },
    png(key: string, frame = -1): string | null {
      const ref = engine.assets.list().find((r) => r.key === key);
      if (!ref) return null;
      const tex = engine.game.textures.get(ref.texture);
      const src = tex.getSourceImage() as HTMLCanvasElement;
      const frames = frame >= 0 ? [ref.frames[frame]] : ref.frames;
      const cv = document.createElement('canvas');
      cv.width = ref.w * frames.length;
      cv.height = ref.h;
      const ctx = cv.getContext('2d')!;
      frames.forEach((f, i) => {
        const fr = tex.get(f);
        ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, i * ref.w, 0, ref.w, ref.h);
      });
      const url = cv.toDataURL('image/png');
      return url;
    },
    autopilot(on = true): void {
      const w = engine.game.scene.getScene('world') as WorldScene;
      w?.setAutopilot(on);
    },
    clock(hhmm: string): void {
      engine.clock.set(hhmm);
    },
    speed(x: number): void {
      engine.scheduler.timeScale = x;
    },
  };
  (window as unknown as { __vec: typeof api }).__vec = api;
}
