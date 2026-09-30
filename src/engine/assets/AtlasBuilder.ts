import Phaser from 'phaser';
import type { PixelCanvas } from './PixelCanvas';

/**
 * Empaqueta sprites generados en páginas de atlas de 1024x1024 (estantes).
 * Menos texturas = menos cambios de textura en WebGL = mejor rendimiento en móvil.
 */
const PAGE = 1024;
const PAD = 1;

interface Page {
  key: string;
  tex: Phaser.Textures.CanvasTexture;
  shelfY: number;
  shelfH: number;
  cursorX: number;
  dirty: boolean;
}

export interface PackedRect {
  texture: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class AtlasBuilder {
  private pages: Page[] = [];
  private textures: Phaser.Textures.TextureManager;

  constructor(textures: Phaser.Textures.TextureManager) {
    this.textures = textures;
  }

  private newPage(): Page {
    const key = `__atlas${this.pages.length}`;
    const tex = this.textures.createCanvas(key, PAGE, PAGE);
    if (!tex) throw new Error('No se pudo crear la página de atlas');
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const page: Page = { key, tex, shelfY: 0, shelfH: 0, cursorX: 0, dirty: false };
    this.pages.push(page);
    return page;
  }

  private alloc(w: number, h: number): { page: Page; x: number; y: number } {
    if (w + PAD > PAGE || h + PAD > PAGE) throw new Error(`Sprite demasiado grande para el atlas: ${w}x${h}`);
    for (const page of this.pages) {
      // ¿entra en el estante actual? (el estante actual es siempre el último: puede crecer)
      if (page.cursorX + w + PAD <= PAGE && page.shelfY + Math.max(page.shelfH, h + PAD) <= PAGE) {
        page.shelfH = Math.max(page.shelfH, h + PAD);
        const x = page.cursorX;
        page.cursorX += w + PAD;
        return { page, x, y: page.shelfY };
      }
      // nuevo estante debajo
      if (page.shelfY + page.shelfH + h + PAD <= PAGE) {
        page.shelfY += page.shelfH;
        page.shelfH = h + PAD;
        page.cursorX = w + PAD;
        return { page, x: 0, y: page.shelfY };
      }
    }
    const page = this.newPage();
    page.shelfH = h + PAD;
    page.cursorX = w + PAD;
    return { page, x: 0, y: 0 };
  }

  /** Copia el lienzo al atlas y devuelve la región. No registra frames. */
  pack(pc: PixelCanvas): PackedRect {
    const { page, x, y } = this.alloc(pc.w, pc.h);
    page.tex.context.putImageData(pc.toImageData(), x, y);
    page.dirty = true;
    return { texture: page.key, x, y, w: pc.w, h: pc.h };
  }

  addFrame(rect: PackedRect, name: string, fx: number, fy: number, fw: number, fh: number): void {
    const tex = this.textures.get(rect.texture);
    if (!tex.has(name)) tex.add(name, 0, rect.x + fx, rect.y + fy, fw, fh);
  }

  /** Sube a la GPU las páginas modificadas. Llamar una vez por cuadro como máximo. */
  flush(): void {
    for (const p of this.pages) {
      if (p.dirty) {
        p.tex.refresh();
        p.dirty = false;
      }
    }
  }

  stats(): { pages: number } {
    return { pages: this.pages.length };
  }
}
