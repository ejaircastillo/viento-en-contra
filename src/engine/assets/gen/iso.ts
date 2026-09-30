import { Face, PixelCanvas } from '../PixelCanvas';
import { C, shade, type Packed } from '../Palette';

/**
 * Pintor isométrico para objetos alineados a la grilla (edificios, muebles, props).
 * Coordenadas locales: x,y en baldosas (múltiplos de 1/16 para líneas limpias), z en px.
 * P(0,0,0) cae en (ox, oy) del lienzo.
 */
export class IsoPainter {
  constructor(
    readonly pc: PixelCanvas,
    readonly ox: number,
    readonly oy: number,
  ) {}

  P(x: number, y: number, z = 0): [number, number] {
    return [this.ox + (x - y) * 16, this.oy + (x + y) * 8 - z];
  }

  /** Cara +y (abajo-izquierda) ubicada en y = yf, entre x = xa..xb. */
  faceY(xa: number, xb: number, yf: number): Face {
    const [px, py] = this.P(xa, yf, 0);
    return new Face(this.pc, Math.round(px), Math.round(py), Math.round((xb - xa) * 16), 1);
  }

  /** Cara +x (abajo-derecha) ubicada en x = xf, entre y = ya..yb. */
  faceX(ya: number, yb: number, xf: number): Face {
    const [px, py] = this.P(xf, yb, 0);
    return new Face(this.pc, Math.round(px), Math.round(py), Math.round((yb - ya) * 16), -1);
  }

  poly3(pts: [number, number, number][], c: Packed): void {
    const flat: number[] = [];
    for (const [x, y, z] of pts) {
      const [px, py] = this.P(x, y, z);
      flat.push(px, py);
    }
    this.pc.poly(flat, c);
  }

  line3(a: [number, number, number], b: [number, number, number], c: Packed): void {
    const [ax, ay] = this.P(...a);
    const [bx, by] = this.P(...b);
    this.pc.line(ax, ay, bx, by, c);
  }

  top(x0: number, y0: number, x1: number, y1: number, z: number, c: Packed): void {
    this.poly3(
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      c,
    );
  }

  /**
   * Caja con sombreado estándar: tapa clara, cara +y iluminada, cara +x en sombra.
   * Devuelve las caras para dibujar detalles encima.
   */
  box(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z0: number,
    z1: number,
    color: Packed | { top: Packed; left: Packed; right: Packed },
  ): { left: Face; right: Face } {
    const cols =
      typeof color === 'number'
        ? { top: shade(color, 1.12), left: color, right: shade(color, 0.78) }
        : color;
    const left = this.faceY(x0, x1, y1);
    const right = this.faceX(y0, y1, x1);
    if (z1 > z0) {
      left.rect(0, left.len, z0, z1, cols.left);
      right.rect(0, right.len, z0, z1, cols.right);
    }
    this.top(x0, y0, x1, y1, z1, cols.top);
    return { left, right };
  }

  /** Sombra suave en el suelo (rombo desplazado). */
  groundShadow(x0: number, y0: number, x1: number, y1: number, alpha = 60): void {
    this.top(x0, y0, x1, y1, 0, C('ink', alpha));
  }
}

/** Crea lienzo + pintor para un objeto de huella w×d y altura máxima h. */
export function isoCanvas(
  w: number,
  d: number,
  h: number,
  margin = 3,
): { pc: PixelCanvas; iso: IsoPainter; ax: number; ay: number } {
  const width = Math.ceil((w + d) * 16) + margin * 2;
  const height = Math.ceil((w + d) * 8 + h) + margin * 2;
  const pc = new PixelCanvas(width, height);
  const ox = Math.round(d * 16) + margin;
  const oy = Math.ceil(h) + margin;
  return { pc, iso: new IsoPainter(pc, ox, oy), ax: ox, ay: oy };
}

/**
 * Crea lienzo para un prop "puntual" centrado en su punto de apoyo.
 * El ancla (ax, ay) corresponde a la posición del objeto en el suelo.
 */
export function pointCanvas(
  halfW: number,
  up: number,
  down = 6,
): { pc: PixelCanvas; iso: IsoPainter; ax: number; ay: number } {
  const pc = new PixelCanvas(halfW * 2, up + down);
  const ax = halfW;
  const ay = up;
  return { pc, iso: new IsoPainter(pc, ax, ay), ax, ay };
}
