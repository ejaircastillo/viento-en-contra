import type { Packed } from './Palette';

/**
 * Lienzo de píxeles en CPU (Uint32 0xAABBGGRR). Todo el arte placeholder se dibuja acá
 * y después se sube como textura. Es puro (no toca el DOM salvo en toCanvas), así que
 * también puede correr dentro de un Web Worker.
 */
export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;

  constructor(w: number, h: number) {
    this.w = Math.max(1, Math.ceil(w));
    this.h = Math.max(1, Math.ceil(h));
    this.data = new Uint32Array(this.w * this.h);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: Packed): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || c === 0) return;
    const a = c >>> 24;
    if (a === 255) {
      this.data[y * this.w + x] = c;
    } else if (a > 0) {
      this.blendPx(x, y, c);
    }
  }

  /** Escribe sin mezclar (permite escribir transparencia). */
  put(x: number, y: number, c: Packed): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }

  get(x: number, y: number): Packed {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  private blendPx(x: number, y: number, c: Packed): void {
    const i = y * this.w + x;
    const d = this.data[i];
    const sa = (c >>> 24) / 255;
    const da = (d >>> 24) / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    const ch = (s: number, t: number) => Math.round((s * sa + t * da * (1 - sa)) / oa);
    const r = ch(c & 255, d & 255);
    const g = ch((c >>> 8) & 255, (d >>> 8) & 255);
    const b = ch((c >>> 16) & 255, (d >>> 16) & 255);
    this.data[i] = ((Math.round(oa * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  rect(x: number, y: number, w: number, h: number, c: Packed): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w));
    const y1 = Math.min(this.h, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
  }

  hline(x0: number, x1: number, y: number, c: Packed): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
  }

  vline(x: number, y0: number, y1: number, c: Packed): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Packed): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Relleno de polígono por scanline con muestreo en centro de píxel. pts = [x0,y0,x1,y1,...] */
  poly(pts: number[], c: Packed): void {
    const n = pts.length >> 1;
    if (n < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = pts[i * 2 + 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const ys = Math.max(0, Math.floor(minY));
    const ye = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = ys; y <= ye; y++) {
      const cy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2];
        const ay = pts[i * 2 + 1];
        const j = (i + 1) % n;
        const bx = pts[j * 2];
        const by = pts[j * 2 + 1];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
          xs.push(ax + ((cy - ay) * (bx - ax)) / (by - ay));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.ceil(xs[k] - 0.5);
        const xb = Math.ceil(xs[k + 1] - 0.5) - 1;
        for (let x = Math.max(0, xa); x <= Math.min(this.w - 1, xb); x++) this.set(x, y, c);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Packed): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  /** Copia otro lienzo (con mezcla alfa). */
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + (flipX ? src.w - 1 - x : x)];
        if (c >>> 24) this.set(dx + x, dy + y, c);
      }
    }
  }

  /** Agrega contorno exterior: píxeles transparentes con vecino opaco (4-vecindad). */
  outline(c: Packed, diagonal = false): void {
    const src = this.data.slice();
    const w = this.w;
    const h = this.h;
    const opaque = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 40;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] >>> 24 > 40) continue;
        let hit = opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1);
        if (!hit && diagonal)
          hit = opaque(x - 1, y - 1) || opaque(x + 1, y - 1) || opaque(x - 1, y + 1) || opaque(x + 1, y + 1);
        if (hit) this.data[y * w + x] = c;
      }
    }
  }

  replace(from: Packed, to: Packed): void {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === from) this.data[i] = to;
  }

  isEmpty(): boolean {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] >>> 24) return false;
    return true;
  }

  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.data.buffer.slice(0) as ArrayBuffer), this.w, this.h);
  }

  toCanvas(scale = 1): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w * scale;
    cv.height = this.h * scale;
    const ctx = cv.getContext('2d')!;
    if (scale === 1) {
      ctx.putImageData(this.toImageData(), 0, 0);
    } else {
      const tmp = this.toCanvas(1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, cv.width, cv.height);
    }
    return cv;
  }
}

/**
 * Cara vertical de una caja isométrica. Las columnas u avanzan hacia la derecha en pantalla;
 * z es la altura en píxeles desde el suelo. La fila inferior de cada columna coincide
 * exactamente con el borde de la baldosa del suelo (misma regla de centro de píxel).
 *
 *  slope +1: cara "izquierda" (+y), baja hacia la derecha. (x0,y0) = vértice izquierdo.
 *  slope -1: cara "derecha" (+x), sube hacia la derecha. (x0,y0) = vértice inferior.
 */
export class Face {
  constructor(
    readonly pc: PixelCanvas,
    readonly x0: number,
    readonly y0: number,
    readonly len: number,
    readonly slope: 1 | -1,
  ) {}

  /** Fila (y) del píxel más bajo de la columna u (u puede exceder len para aleros). */
  bottom(u: number): number {
    if (this.slope === 1) return this.y0 + Math.ceil(u / 2) - 1;
    return this.y0 - (Math.floor((u + 1) / 2) + 1);
  }

  px(u: number, z: number, c: Packed): void {
    this.pc.set(this.x0 + u, this.bottom(u) - z, c);
  }

  /** Rellena columnas [u0,u1) entre alturas [z0,z1). */
  rect(u0: number, u1: number, z0: number, z1: number, c: Packed): void {
    for (let u = Math.max(0, Math.floor(u0)); u < Math.min(this.len, Math.ceil(u1)); u++) {
      const b = this.bottom(u);
      for (let z = z0; z < z1; z++) this.pc.set(this.x0 + u, b - z, c);
    }
  }

  /** Como rect pero sin recortar a la longitud de la cara. */
  rectFree(u0: number, u1: number, z0: number, z1: number, c: Packed): void {
    for (let u = Math.floor(u0); u < Math.ceil(u1); u++) {
      const b = this.bottom(u);
      for (let z = z0; z < z1; z++) this.pc.set(this.x0 + u, b - z, c);
    }
  }

  /** Línea horizontal (sigue la pendiente iso) en altura z. */
  hline(u0: number, u1: number, z: number, c: Packed): void {
    this.rect(u0, u1, z, z + 1, c);
  }

  vline(u: number, z0: number, z1: number, c: Packed): void {
    this.rect(u, u + 1, z0, z1, c);
  }
}
