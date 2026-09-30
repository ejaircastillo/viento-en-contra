import Phaser from 'phaser';
import { AtlasBuilder } from './AtlasBuilder';
import type { PixelCanvas } from './PixelCanvas';

/**
 * Registro central de assets. Cada asset tiene una clave estable (ej. "char.municipal").
 * - Si assets/manifest.json lo marca como `status: "final"` con `path`, se carga el archivo.
 * - Si no, se genera proceduralmente (placeholder) con el generador registrado.
 * La lógica de juego sólo pide claves: reemplazar un placeholder por arte final no toca código.
 */

export type AssetCategory =
  | 'characters'
  | 'vehicles'
  | 'environments'
  | 'brands'
  | 'ui'
  | 'audio'
  | 'documents';

export interface AssetEntry {
  key: string;
  category: AssetCategory;
  status: 'placeholder' | 'final';
  source: 'procedural' | 'file' | 'css' | 'synth';
  generator?: string;
  ref?: string;
  path?: string;
  kind?: 'image' | 'spritesheet' | 'audio';
  frame?: { w: number; h: number; count?: number };
  anchor?: { x: number; y: number };
  /** Escena que necesita el archivo final (para carga por escena). Vacío = al inicio. */
  scene?: string;
  usage: string;
  dimensions: string;
  animations?: string[];
  notes?: string;
}

export interface GenOutput {
  pc: PixelCanvas;
  /** Si es una tira de cuadros (spritesheet horizontal). */
  frameW?: number;
  frameH?: number;
  anchorX: number;
  anchorY: number;
}

export interface SpriteRef {
  key: string;
  texture: string;
  frames: (string | number)[];
  w: number;
  h: number;
  ax: number;
  ay: number;
}

export type Generator = (entry: AssetEntry | undefined, params?: any) => GenOutput;

export class AssetRegistry {
  private manifest = new Map<string, AssetEntry>();
  private generators = new Map<string, Generator>();
  private cache = new Map<string, SpriteRef>();
  private dataUrls = new Map<string, string>();
  private atlas: AtlasBuilder | null = null;
  private textures: Phaser.Textures.TextureManager | null = null;
  /** Parámetros por referencia (ej. looks de personajes) que registra el contenido. */
  readonly refs = new Map<string, any>();

  attach(textures: Phaser.Textures.TextureManager): void {
    this.textures = textures;
    this.atlas = new AtlasBuilder(textures);
  }

  async loadManifest(url: string): Promise<void> {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { assets: AssetEntry[] };
      for (const e of json.assets ?? []) this.manifest.set(e.key, e);
    } catch (err) {
      console.warn('[Assets] No se pudo leer assets/manifest.json; se usan placeholders.', err);
    }
  }

  entry(key: string): AssetEntry | undefined {
    return this.manifest.get(key);
  }

  entries(): AssetEntry[] {
    return [...this.manifest.values()];
  }

  registerGenerator(id: string, fn: Generator): void {
    this.generators.set(id, fn);
  }

  /** Encola en el loader de la escena los assets finales que correspondan a esa escena. */
  queueFinals(load: Phaser.Loader.LoaderPlugin, scene: string): number {
    let n = 0;
    for (const e of this.manifest.values()) {
      if (e.status !== 'final' || !e.path || e.kind === 'audio') continue;
      if ((e.scene ?? 'boot') !== scene) continue;
      if (this.textures?.exists(e.key)) continue;
      if (e.kind === 'spritesheet' && e.frame) {
        load.spritesheet(e.key, e.path, { frameWidth: e.frame.w, frameHeight: e.frame.h });
      } else {
        load.image(e.key, e.path);
      }
      n++;
    }
    return n;
  }

  /** Devuelve (generando si hace falta) la referencia de sprite para una clave. */
  ensure(key: string, gen?: () => GenOutput): SpriteRef {
    const cached = this.cache.get(key);
    if (cached) return cached;
    const entry = this.manifest.get(key);
    if (entry && entry.status === 'final' && this.textures?.exists(key)) {
      const ref = this.fromFile(entry);
      this.cache.set(key, ref);
      return ref;
    }
    let out: GenOutput;
    if (gen) out = gen();
    else {
      const genId = entry?.generator;
      const fn = genId ? this.generators.get(genId) : undefined;
      if (!fn) throw new Error(`[Assets] Sin generador para "${key}" (${genId ?? 'sin id'})`);
      out = fn(entry, entry?.ref ? this.refs.get(entry.ref) : undefined);
    }
    const ref = this.packOutput(key, out);
    this.cache.set(key, ref);
    return ref;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** Todas las claves generadas/cargadas (útil para reemplazar placeholders por arte final). */
  list(): SpriteRef[] {
    return [...this.cache.values()];
  }

  private fromFile(entry: AssetEntry): SpriteRef {
    const tex = this.textures!.get(entry.key);
    const src = tex.getSourceImage() as HTMLImageElement;
    const fw = entry.frame?.w ?? src.width;
    const fh = entry.frame?.h ?? src.height;
    const count = entry.kind === 'spritesheet' ? tex.frameTotal - 1 : 1;
    const frames: (string | number)[] =
      entry.kind === 'spritesheet' ? Array.from({ length: count }, (_, i) => i) : ['__BASE'];
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return {
      key: entry.key,
      texture: entry.key,
      frames,
      w: fw,
      h: fh,
      ax: entry.anchor?.x ?? fw / 2,
      ay: entry.anchor?.y ?? fh,
    };
  }

  private packOutput(key: string, out: GenOutput): SpriteRef {
    if (!this.atlas) throw new Error('[Assets] Registro sin texturas adjuntas');
    const rect = this.atlas.pack(out.pc);
    const fw = out.frameW ?? out.pc.w;
    const fh = out.frameH ?? out.pc.h;
    const cols = Math.max(1, Math.floor(out.pc.w / fw));
    const rows = Math.max(1, Math.floor(out.pc.h / fh));
    const frames: string[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const name = `${key}:${r * cols + c}`;
        this.atlas.addFrame(rect, name, c * fw, r * fh, fw, fh);
        frames.push(name);
      }
    }
    return { key, texture: rect.texture, frames, w: fw, h: fh, ax: out.anchorX, ay: out.anchorY };
  }

  /** Data URL de un lienzo generado (para la UI HTML: retratos, íconos). */
  dataUrl(key: string, gen: () => PixelCanvas, scale = 1): string {
    const k = `${key}@${scale}`;
    let url = this.dataUrls.get(k);
    if (!url) {
      url = gen().toCanvas(scale).toDataURL();
      this.dataUrls.set(k, url);
    }
    return url;
  }

  flush(): void {
    this.atlas?.flush();
  }

  stats(): { sprites: number; pages: number } {
    return { sprites: this.cache.size, pages: this.atlas?.stats().pages ?? 0 };
  }
}
