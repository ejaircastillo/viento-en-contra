import * as THREE from 'three';
import { clamp, fbm, rng } from '../core/noise';

/**
 * Texturas procedurales dibujadas en canvas 2D (no hay archivos de imagen): empedrados, baldosas, madera,
 * yeso, pizarra, humo, brillos. Todas son deterministas (semilla fija) y se generan una sola vez al cargar.
 */

export type RGB = [number, number, number];

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: false })!;
  return [cv, ctx];
}

export function hex(c: string): RGB {
  const n = parseInt(c.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export interface TexOpts {
  srgb?: boolean;
  repeat?: [number, number];
  wrap?: boolean;
}

export function toTexture(cv: HTMLCanvasElement, o: TexOpts = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (o.wrap !== false) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Rellena un canvas calculando cada píxel con `fn` (x, y) → [r,g,b]. */
export function fillPixels(ctx: CanvasRenderingContext2D, w: number, h: number, fn: (x: number, y: number) => RGB): void {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      d[i++] = clamp(c[0], 0, 255);
      d[i++] = clamp(c[1], 0, 255);
      d[i++] = clamp(c[2], 0, 255);
      d[i++] = 255;
    }
  ctx.putImageData(img, 0, 0);
}

/** Ruido de valor periódico (se repite cada `period` celdas): para texturas que tienen que "tilear". */
export function tileNoise(x: number, y: number, period: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const h = (px: number, py: number) => {
    const a = ((px % period) + period) % period;
    const b = ((py % period) + period) % period;
    let n = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy);
  const b = h(ix + 1, iy);
  const c = h(ix, iy + 1);
  const d = h(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Ruido fractal periódico en [0,1] sobre un lienzo de `size` píxeles con `cells` celdas en la primera octava. */
export function tileFbm(x: number, y: number, size: number, cells: number, octaves = 4, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let c = cells;
  for (let o = 0; o < octaves; o++) {
    sum += tileNoise((x / size) * c, (y / size) * c, c, seed + o * 13) * amp;
    norm += amp;
    amp *= 0.5;
    c *= 2;
  }
  return sum / norm;
}

// ------------------------------------------------------------------------------------------------ brillos y humo

/** Degradé radial blanco → transparente (brillos de luz, charcos de luz, chispas). */
export function glowTexture(size = 128, power = 2.2): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2);
      const a = Math.pow(1 - r, power);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  return toTexture(cv, { wrap: false });
}

/** Bocanada de humo: máscara redonda con bordes deshilachados (se tiñe con el color de la partícula). */
export function smokeTexture(size = 128): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const n = fbm(x * 0.045, y * 0.045, 4, 11);
      const edge = clamp(1 - (r + (n - 0.5) * 0.7), 0, 1);
      const a = Math.pow(edge, 1.35);
      const shade = 190 + n * 60;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = shade;
      img.data[i + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  ctx.putImageData(img, 0, 0);
  return toTexture(cv, { wrap: false });
}

/** Ruido de detalle en gris, tileable: se multiplica sobre otros materiales para que no se vean lisos. */
export function detailTexture(size = 256): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size);
  fillPixels(ctx, size, size, (x, y) => {
    const n = tileFbm(x, y, size, 8, 4, 3) * 0.7 + tileNoise((x / size) * 64, (y / size) * 64, 64, 5) * 0.3;
    const v = 128 + (n - 0.5) * 255;
    return [v, v, v];
  });
  return toTexture(cv, { srgb: false });
}

// ------------------------------------------------------------------------------------------------ suelo del cementerio

/**
 * Pintor del suelo: un lienzo grande (albedo) + otro de relieve en escala de grises que cubren todo el terreno.
 * Coordenadas del mundo (x, z) en unidades; el centro del terreno es el centro del lienzo.
 * Pasto, caminos de tierra y empedrados (las "losas de piedra") se dibujan con pinceladas y gradientes.
 */
export class GroundPainter {
  readonly w: number;
  readonly h: number;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bcv: HTMLCanvasElement;
  private bctx: CanvasRenderingContext2D;
  private dirt: CanvasPattern;
  private r: () => number;

  constructor(
    readonly width: number,
    readonly depth: number,
    readonly pxPerUnit: number,
    readonly seed = 1,
  ) {
    this.w = Math.round(width * pxPerUnit);
    this.h = Math.round(depth * pxPerUnit);
    [this.cv, this.ctx] = makeCanvas(this.w, this.h);
    [this.bcv, this.bctx] = makeCanvas(this.w, this.h);
    this.bctx.fillStyle = 'rgb(128,128,128)';
    this.bctx.fillRect(0, 0, this.w, this.h);
    this.r = rng(seed * 7919 + 13);
    this.dirt = this.makeDirtPattern();
  }

  /** Mundo → píxel del lienzo. */
  px(x: number, z: number): [number, number] {
    return [(x + this.width / 2) * this.pxPerUnit, (z + this.depth / 2) * this.pxPerUnit];
  }

  private makeDirtPattern(): CanvasPattern {
    const s = 256;
    const [cv, ctx] = makeCanvas(s, s);
    const base = hex('#5a4026');
    const dark = hex('#33261a');
    const light = hex('#7a5d3a');
    fillPixels(ctx, s, s, (x, y) => {
      const n = tileFbm(x, y, s, 6, 4, 21);
      const f = tileNoise((x / s) * 48, (y / s) * 48, 48, 4);
      const c = n < 0.5 ? mix(dark, base, n * 2) : mix(base, light, (n - 0.5) * 2);
      const g = 0.9 + f * 0.2;
      return [c[0] * g, c[1] * g, c[2] * g];
    });
    const r = rng(77);
    for (let i = 0; i < 70; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 0.8 + r() * 2.2;
      ctx.fillStyle = `rgba(${110 + r() * 40},${96 + r() * 30},${84 + r() * 30},0.85)`;
      ctx.beginPath();
      ctx.ellipse(x, y, rad, rad * 0.75, r() * 3, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,12,8,0.5)';
      ctx.beginPath();
      ctx.ellipse(x + rad * 0.35, y + rad * 0.35, rad * 0.8, rad * 0.55, 0, 0, 6.3);
      ctx.fill();
    }
    return this.ctx.createPattern(cv, 'repeat')!;
  }

  /** Césped oscuro con manchas secas y pinceladas de hojas de pasto. */
  paintGrass(): void {
    const { w, h, seed } = this;
    const hw = Math.floor(w / 2);
    const hh = Math.floor(h / 2);
    const [tc, tctx] = makeCanvas(hw, hh);
    const dark = hex('#142210');
    const mid = hex('#2b4619');
    const light = hex('#4a6a26');
    const dry = hex('#5f4d22');
    fillPixels(tctx, hw, hh, (x, y) => {
      const wx = x * 2;
      const wy = y * 2;
      const n1 = fbm(wx * 0.011, wy * 0.011, 4, seed);
      const n2 = fbm(wx * 0.026 + 40, wy * 0.026 + 90, 3, seed + 5);
      const n3 = fbm(wx * 0.34, wy * 0.34, 2, seed + 9);
      let c = mix(dark, mid, clamp(n1 * 1.4, 0, 1));
      c = mix(c, light, clamp((n1 - 0.55) * 2.2, 0, 1) * 0.6);
      c = mix(c, dry, clamp((n2 - 0.55) * 3.2, 0, 1) * 0.5);
      const g = 0.82 + n3 * 0.36;
      return [c[0] * g, c[1] * g, c[2] * g];
    });
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(tc, 0, 0, w, h);
    const r = this.r;
    const n = Math.floor((w * h) / 70);
    this.ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = r() * w;
      const y = r() * h;
      const len = 4 + r() * 8;
      const a = -Math.PI / 2 + (r() - 0.5) * 1.3;
      const lightBlade = r() < 0.62;
      this.ctx.strokeStyle = lightBlade ? `rgba(${70 + r() * 30},${104 + r() * 36},${40 + r() * 20},0.5)` : `rgba(${8 + r() * 10},${18 + r() * 12},${6 + r() * 8},0.5)`;
      this.ctx.lineWidth = 0.8 + r() * 0.9;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      this.ctx.stroke();
    }
  }

  /** Subdivide y agita una polilínea (en píxeles) para que los bordes del camino no sean rectos. */
  private jitter(pts: [number, number][], amp: number): [number, number][] {
    const out: [number, number][] = [];
    const src = pts.map(([x, z]) => this.px(x, z));
    for (let i = 0; i < src.length - 1; i++) {
      const [x0, y0] = src[i];
      const [x1, y1] = src[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.floor(len / 26));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push([x0 + (x1 - x0) * t + (this.r() - 0.5) * amp, y0 + (y1 - y0) * t + (this.r() - 0.5) * amp]);
      }
    }
    out.push(src[src.length - 1]);
    return out;
  }

  /** Camino de tierra: borde embarrado difuso, cuerpo con textura de tierra y centro más gastado. */
  path(pts: [number, number][], widthUnits: number): void {
    const { ctx, bctx, r } = this;
    const wpx = widthUnits * this.pxPerUnit;
    const line = this.jitter(pts, wpx * 0.07);
    const trace = (c: CanvasRenderingContext2D) => {
      c.beginPath();
      line.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [k, a] of [[1.5, 0.1], [1.36, 0.14], [1.22, 0.2]] as const) {
      ctx.strokeStyle = `rgba(22,14,9,${a})`;
      ctx.lineWidth = wpx * k;
      trace(ctx);
      ctx.stroke();
    }
    ctx.strokeStyle = this.dirt;
    ctx.lineWidth = wpx;
    trace(ctx);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(132,88,58,0.22)';
    ctx.lineWidth = wpx * 0.5;
    trace(ctx);
    ctx.stroke();
    // relieve: el camino queda un poco hundido respecto del pasto
    bctx.lineCap = 'round';
    bctx.lineJoin = 'round';
    bctx.strokeStyle = 'rgb(104,104,104)';
    bctx.lineWidth = wpx;
    trace(bctx);
    bctx.stroke();
    // mechones de pasto en las orillas
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i];
      const [x1, y1] = line[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const nx = -(y1 - y0) / (len || 1);
      const ny = (x1 - x0) / (len || 1);
      const count = Math.floor(len / 6);
      for (let k = 0; k < count; k++) {
        const t = r();
        const side = r() < 0.5 ? -1 : 1;
        const off = (wpx * 0.5 + (r() - 0.3) * 5) * side;
        const x = x0 + (x1 - x0) * t + nx * off;
        const y = y0 + (y1 - y0) * t + ny * off;
        ctx.strokeStyle = r() < 0.5 ? 'rgba(78,112,44,0.7)' : 'rgba(30,54,22,0.75)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5);
        ctx.stroke();
      }
    }
  }

  /** Losa de piedras redondeadas (elipse en unidades del mundo). */
  pad(cx: number, cz: number, rx: number, rz: number, stone = 0.3): void {
    const { ctx, bctx, r } = this;
    const [px, py] = this.px(cx, cz);
    const a = rx * this.pxPerUnit;
    const b = rz * this.pxPerUnit;
    const s = stone * this.pxPerUnit;
    // mortero / tierra oscura
    ctx.fillStyle = 'rgba(17,14,11,0.9)';
    ctx.beginPath();
    ctx.ellipse(px, py, a * 1.03, b * 1.03, 0, 0, 6.3);
    ctx.fill();
    const tones = ['#3a3732', '#45423a', '#504b41', '#32302b', '#403c35', '#48453c'];
    const rowH = s * 0.86;
    for (let yy = -b; yy <= b; yy += rowH) {
      const off = (Math.round(yy / rowH) % 2) * s * 0.5;
      for (let xx = -a; xx <= a; xx += s) {
        const x = xx + off + (r() - 0.5) * s * 0.3;
        const y = yy + (r() - 0.5) * s * 0.3;
        const d = Math.hypot(x / a, y / b);
        if (d > 1 || (d > 0.82 && r() < (d - 0.8) * 3.2)) continue;
        const sx = s * (0.42 + r() * 0.12);
        const sy = sx * (0.78 + r() * 0.2);
        const rot = r() * 3;
        const col = hex(tones[Math.floor(r() * tones.length)]);
        const g = ctx.createRadialGradient(px + x - sx * 0.3, py + y - sy * 0.3, 1, px + x, py + y, sx * 1.15);
        g.addColorStop(0, css(mix(col, [255, 250, 235], 0.22)));
        g.addColorStop(0.7, css(col));
        g.addColorStop(1, css(mix(col, [10, 8, 6], 0.55)));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(px + x, py + y, sx, sy, rot, 0, 6.3);
        ctx.fill();
        const bg = bctx.createRadialGradient(px + x, py + y, 1, px + x, py + y, sx);
        bg.addColorStop(0, 'rgb(236,236,236)');
        bg.addColorStop(1, 'rgb(150,150,150)');
        bctx.fillStyle = bg;
        bctx.beginPath();
        bctx.ellipse(px + x, py + y, sx, sy, rot, 0, 6.3);
        bctx.fill();
      }
    }
  }

  /** Hojas caídas (motas naranjas, amarillas y rojizas) repartidas al azar. */
  leaves(count: number, area?: [number, number, number, number]): void {
    const { ctx, r } = this;
    const cols = ['#b4561e', '#d48a26', '#8c2f1c', '#c9a13a', '#7a4a1c'];
    const [x0, z0, x1, z1] = area ?? [-this.width / 2, -this.depth / 2, this.width / 2, this.depth / 2];
    for (let i = 0; i < count; i++) {
      const [x, y] = this.px(x0 + r() * (x1 - x0), z0 + r() * (z1 - z0));
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.globalAlpha = 0.55 + r() * 0.4;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.6 + r() * 2.2, 0.9 + r() * 1.2, r() * 3.14, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Oscurece los bordes del terreno para que se "hunda" en el vacío. */
  edgeFade(units = 2.5, strength = 0.85): void {
    const { ctx, w, h } = this;
    const m = units * this.pxPerUnit;
    const grads: [number, number, number, number, number, number, number, number][] = [
      [0, 0, 0, m, 0, 0, w, m],
      [0, h, 0, h - m, 0, h - m, w, m],
      [0, 0, m, 0, 0, 0, m, h],
      [w, 0, w - m, 0, w - m, 0, m, h],
    ];
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of grads) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(3,4,8,${strength})`);
      g.addColorStop(1, 'rgba(3,4,8,0)');
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  textures(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
    return { map: toTexture(this.cv, { wrap: false }), bump: toTexture(this.bcv, { srgb: false, wrap: false }) };
  }
}

// ------------------------------------------------------------------------------------------------ cripta

/** Baldosas de pizarra azulada: cada baldosa con su tono, bisel, grietas, manchas y juntas oscuras. */
export function floorTiles(tilesX: number, tilesY: number, px = 128, seed = 5): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const w = tilesX * px;
  const h = tilesY * px;
  const [cv, ctx] = makeCanvas(w, h);
  const [bcv, bctx] = makeCanvas(w, h);
  const r = rng(seed);
  bctx.fillStyle = 'rgb(40,40,40)';
  bctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0d1118';
  ctx.fillRect(0, 0, w, h);
  const joint = Math.max(3, Math.round(px * 0.03));
  for (let ty = 0; ty < tilesY; ty++)
    for (let tx = 0; tx < tilesX; tx++) {
      const x = tx * px;
      const y = ty * px;
      const l = 30 + r() * 10;
      const sat = 14 + r() * 8;
      const hue = 212 + (r() - 0.5) * 12;
      const base = `hsl(${hue},${sat}%,${l}%)`;
      ctx.fillStyle = base;
      ctx.fillRect(x + joint, y + joint, px - joint * 2, px - joint * 2);
      // desgaste: el centro un poco más claro, las esquinas más oscuras
      const g = ctx.createRadialGradient(x + px * 0.5, y + px * 0.5, px * 0.1, x + px * 0.5, y + px * 0.5, px * 0.75);
      g.addColorStop(0, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,10,0.22)');
      ctx.fillStyle = g;
      ctx.fillRect(x + joint, y + joint, px - joint * 2, px - joint * 2);
      // bisel de luz arriba/izquierda y sombra abajo/derecha
      ctx.fillStyle = 'rgba(190,210,240,0.16)';
      ctx.fillRect(x + joint, y + joint, px - joint * 2, 2);
      ctx.fillRect(x + joint, y + joint, 2, px - joint * 2);
      ctx.fillStyle = 'rgba(0,0,12,0.3)';
      ctx.fillRect(x + joint, y + px - joint - 2, px - joint * 2, 2);
      ctx.fillRect(x + px - joint - 2, y + joint, 2, px - joint * 2);
      // motas
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(210,225,255,0.09)' : 'rgba(0,0,10,0.14)';
        const s = 1 + r() * 2;
        ctx.fillRect(x + joint + r() * (px - joint * 2), y + joint + r() * (px - joint * 2), s, s);
      }
      // manchas de humedad
      if (r() < 0.22) {
        const sx = x + r() * px;
        const sy = y + r() * px;
        const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, px * (0.25 + r() * 0.25));
        sg.addColorStop(0, 'rgba(8,14,22,0.38)');
        sg.addColorStop(1, 'rgba(8,14,22,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(x + joint, y + joint, px - joint * 2, px - joint * 2);
      }
      // grietas
      if (r() < 0.14) {
        ctx.strokeStyle = 'rgba(6,9,14,0.75)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        let cx = x + r() * px;
        let cy = y + joint;
        ctx.moveTo(cx, cy);
        for (let k = 0; k < 5; k++) {
          cx += (r() - 0.5) * 18;
          cy += px * 0.17;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
      const bg = bctx.createLinearGradient(x, y, x + px, y + px);
      bg.addColorStop(0, 'rgb(225,225,225)');
      bg.addColorStop(1, 'rgb(190,190,190)');
      bctx.fillStyle = bg;
      bctx.fillRect(x + joint, y + joint, px - joint * 2, px - joint * 2);
    }
  return { map: toTexture(cv, { wrap: false }), bump: toTexture(bcv, { srgb: false, wrap: false }) };
}

/** Yeso azul grisáceo con vetas verticales y manchas (tileable). */
export function plasterTexture(size = 512): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size);
  const base = hex('#8793a3');
  const dark = hex('#5d6978');
  fillPixels(ctx, size, size, (x, y) => {
    const n = tileFbm(x, y, size, 4, 5, 31);
    const streak = tileNoise((x / size) * 26, (y / size) * 3, 26, 8);
    const c = mix(dark, base, clamp(n * 1.25 + (streak - 0.5) * 0.3, 0, 1));
    const g = 0.94 + tileNoise((x / size) * 90, (y / size) * 90, 90, 2) * 0.12;
    return [c[0] * g, c[1] * g, c[2] * g];
  });
  const r = rng(99);
  for (let i = 0; i < 6; i++) {
    const x = r() * size;
    const y = r() * size;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 40 + r() * 70);
    g.addColorStop(0, 'rgba(30,40,54,0.22)');
    g.addColorStop(1, 'rgba(30,40,54,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return toTexture(cv);
}

/** Madera con veta horizontal, junturas de tablas y nudos (tileable en x). */
export function woodTexture(base = '#6b3a22', size = 512): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [cv, ctx] = makeCanvas(size, size);
  const [bcv, bctx] = makeCanvas(size, size);
  const c0 = hex(base);
  const dark = mix(c0, [10, 5, 2], 0.5);
  const light = mix(c0, [210, 150, 100], 0.28);
  const plank = size / 4;
  const hmap = new Float32Array(size * size);
  fillPixels(ctx, size, size, (x, y) => {
    const py = y % plank;
    const warp = tileFbm(x, y, size, 3, 3, 14) * 14;
    const grain = tileNoise((x / size) * 5, ((y + warp) / size) * 70, 70, 17);
    const fine = tileNoise((x / size) * 9, (y / size) * 170, 170, 4);
    const v = clamp(grain * 0.62 + fine * 0.3 + (py < 3 || py > plank - 3 ? -0.5 : 0), 0, 1);
    hmap[y * size + x] = v;
    const c = v < 0.45 ? mix(dark, c0, v / 0.45) : mix(c0, light, (v - 0.45) / 0.55);
    return c;
  });
  const r = rng(61);
  for (let i = 0; i < 5; i++) {
    const x = r() * size;
    const y = r() * size;
    for (let k = 4; k > 0; k--) {
      ctx.strokeStyle = `rgba(20,10,4,${0.12 + (4 - k) * 0.07})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, k * 5, k * 2.2, 0, 0, 6.3);
      ctx.stroke();
    }
  }
  fillPixels(bctx, size, size, (x, y) => {
    const v = 90 + hmap[y * size + x] * 120;
    return [v, v, v];
  });
  return { map: toTexture(cv), bump: toTexture(bcv, { srgb: false }) };
}

/** Piedra gris azulada con manchas, poros y astillas (tileable). */
export function stoneTexture(tint = '#9a9ea8', size = 512): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [cv, ctx] = makeCanvas(size, size);
  const [bcv, bctx] = makeCanvas(size, size);
  const c0 = hex(tint);
  const dark = mix(c0, [18, 20, 28], 0.55);
  const light = mix(c0, [245, 245, 235], 0.25);
  const hmap = new Float32Array(size * size);
  fillPixels(ctx, size, size, (x, y) => {
    const n = tileFbm(x, y, size, 5, 5, 41);
    const pit = tileNoise((x / size) * 70, (y / size) * 70, 70, 6);
    const v = clamp(n * 1.1 + (pit - 0.5) * 0.25, 0, 1);
    hmap[y * size + x] = v;
    return v < 0.5 ? mix(dark, c0, v * 2) : mix(c0, light, (v - 0.5) * 2);
  });
  const r = rng(23);
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    const y = r() * size;
    ctx.fillStyle = r() < 0.6 ? 'rgba(8,10,16,0.35)' : 'rgba(235,240,245,0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + r() * 2.4, 0.8 + r() * 1.6, r() * 3, 0, 6.3);
    ctx.fill();
  }
  fillPixels(bctx, size, size, (x, y) => {
    const v = 70 + hmap[y * size + x] * 150;
    return [v, v, v];
  });
  return { map: toTexture(cv), bump: toTexture(bcv, { srgb: false }) };
}

/** Tejas de pizarra azul grisácea en hileras desfasadas (techo del mausoleo). */
export function slateRoofTexture(size = 512): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [cv, ctx] = makeCanvas(size, size);
  const [bcv, bctx] = makeCanvas(size, size);
  const r = rng(58);
  const rows = 8;
  const rh = size / rows;
  const cw = size / 6;
  ctx.fillStyle = '#10141b';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = 'rgb(50,50,50)';
  bctx.fillRect(0, 0, size, size);
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * cw * 0.5;
    for (let c = -1; c < 7; c++) {
      const x = c * cw + off;
      const y = row * rh;
      const l = 30 + r() * 12;
      ctx.fillStyle = `hsl(${216 + (r() - 0.5) * 10},${12 + r() * 10}%,${l}%)`;
      ctx.fillRect(x + 2, y + 2, cw - 4, rh - 3);
      const g = ctx.createLinearGradient(x, y, x, y + rh);
      g.addColorStop(0, 'rgba(0,0,8,0.0)');
      g.addColorStop(1, 'rgba(0,0,8,0.34)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 2, y + 2, cw - 4, rh - 3);
      ctx.fillStyle = 'rgba(200,215,240,0.14)';
      ctx.fillRect(x + 2, y + 2, cw - 4, 2);
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(200,215,240,0.08)' : 'rgba(0,0,10,0.16)';
        ctx.fillRect(x + 3 + r() * (cw - 7), y + 3 + r() * (rh - 6), 1.5, 1.5);
      }
      const bg = bctx.createLinearGradient(x, y, x, y + rh);
      bg.addColorStop(0, 'rgb(215,215,215)');
      bg.addColorStop(1, 'rgb(120,120,120)');
      bctx.fillStyle = bg;
      bctx.fillRect(x + 2, y + 2, cw - 4, rh - 3);
    }
  }
  return { map: toTexture(cv), bump: toTexture(bcv, { srgb: false }) };
}

/** Lona / paño con trama fina (mantos sobre cofres, relleno del ataúd). */
export function clothTexture(base = '#7a1f2a', size = 256): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size);
  const c0 = hex(base);
  fillPixels(ctx, size, size, (x, y) => {
    const weave = ((x >> 1) + (y >> 1)) % 2 ? 1.06 : 0.92;
    const n = tileFbm(x, y, size, 4, 4, 77);
    const g = weave * (0.72 + n * 0.5);
    return [c0[0] * g, c0[1] * g, c0[2] * g];
  });
  return toTexture(cv);
}

/** Inscripción para una lápida: texto centrado sobre piedra (canvas pequeño, sRGB). */
export function engravingTexture(lines: string[], size = 256): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(20,22,28,0.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    ctx.font = `${i === 0 ? 34 : 26}px Georgia, serif`;
    ctx.fillText(l, size / 2, size * 0.3 + i * 40);
  });
  const t = toTexture(cv, { wrap: false });
  return t;
}

/** Hoja suelta (silueta blanca con nervadura): se tiñe con el color de cada partícula. */
export function leafSpriteTexture(size = 64): THREE.CanvasTexture {
  const [cv, ctx] = makeCanvas(size, size);
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(c, size * 0.08);
  ctx.bezierCurveTo(size * 0.92, size * 0.3, size * 0.88, size * 0.72, c, size * 0.94);
  ctx.bezierCurveTo(size * 0.12, size * 0.72, size * 0.08, size * 0.3, c, size * 0.08);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(c, size * 0.1);
  ctx.lineTo(c, size * 0.92);
  ctx.stroke();
  return toTexture(cv, { wrap: false });
}
