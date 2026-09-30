import type { Packed } from '../Palette';

/**
 * Registro de logos dibujados por código. El motor sólo conoce la interfaz;
 * las marcas ficticias concretas (Patagonia Puede, Acá Nomás, Radio 89...) las registra el contenido.
 *
 * Un logo se dibuja en una grilla local 2D (x → derecha, y → abajo) de `size` px de alto,
 * mediante `plot`. Así el mismo logo sirve sobre una cara isométrica (cizallado) o de frente.
 */
export type Plot = (x: number, y: number, c: Packed) => void;
export type LogoPainter = (plot: Plot, size: number) => number;

const logos = new Map<string, LogoPainter>();

export function registerLogo(id: string, painter: LogoPainter): void {
  logos.set(id, painter);
}

export function drawLogo(id: string, plot: Plot, size: number): number {
  const p = logos.get(id);
  if (!p) return 0;
  return p(plot, size);
}

export function hasLogo(id: string): boolean {
  return logos.has(id);
}
