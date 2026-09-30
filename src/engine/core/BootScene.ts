import Phaser from 'phaser';
import { engine } from './Engine';
import { drawCharacterSheet } from '../assets/gen/characters';
import { drawVehicleSheet } from '../assets/gen/vehicles';
import { mainFlow } from '../mission/Flow';

/**
 * Arranque: lee assets/manifest.json, registra los generadores procedurales genéricos,
 * carga los assets finales marcados para el inicio y lanza el flujo principal.
 */
export class BootScene extends Phaser.Scene {
  private manifestReady = false;

  constructor() {
    super('boot');
  }

  preload(): void {
    // el manifiesto se lee con fetch (así se puede editar sin recompilar)
  }

  async create(): Promise<void> {
    await engine.assets.loadManifest(`${import.meta.env.BASE_URL}manifest.json`);
    engine.assets.registerGenerator('character', (_e, look) => drawCharacterSheet(look));
    engine.assets.registerGenerator('vehicle', (_e, look) => drawVehicleSheet(look));
    engine.audio.registerFiles(engine.assets.entries());
    const n = engine.assets.queueFinals(this.load, 'boot');
    if (n > 0) {
      await new Promise<void>((resolve) => {
        this.load.once('complete', () => resolve());
        this.load.start();
      });
    }
    this.manifestReady = true;
    window.dispatchEvent(new Event('vec:booted'));
    try {
      await document.fonts.load('16px "Pixelify Sans"');
      await document.fonts.load('bold 16px "Pixelify Sans"');
    } catch {
      /* sin fuente: se usa la de respaldo */
    }
    void mainFlow().catch((err) => {
      console.error('[Flow] error fatal', err);
      const el = document.createElement('div');
      el.className = 'px-panel card';
      el.textContent = 'Error al iniciar el juego. Recargá la página.';
      document.getElementById('panels')!.appendChild(el);
    });
  }

  get ready(): boolean {
    return this.manifestReady;
  }
}
