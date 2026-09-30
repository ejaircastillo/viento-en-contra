/**
 * Niveles de calidad gráfica. `?q=low|medium|high` fuerza uno; si no, se elige según el dispositivo
 * (teléfono táctil → medio, renderizado por software o pocos núcleos → bajo).
 */
export type QualityId = 'low' | 'medium' | 'high';

export interface Quality {
  id: QualityId;
  /** Tope de la densidad de píxeles del canvas. */
  pixelRatio: number;
  /** Lado del mapa de sombras de la luna. */
  shadowMap: number;
  /** Muestras de MSAA en el buffer del compositor (0 = sin MSAA, se usa FXAA). */
  msaa: number;
  bloom: boolean;
  /** Divisor de resolución del bloom (2 = mitad). */
  bloomDivider: number;
  outline: boolean;
  tiltShift: boolean;
  /** Multiplicadores de densidad (0..1). */
  grass: number;
  particles: number;
  plants: number;
  /** Cantidad de luces puntuales simultáneas. */
  lightPool: number;
}

export const QUALITY: Record<QualityId, Quality> = {
  low: { id: 'low', pixelRatio: 1, shadowMap: 1024, msaa: 0, bloom: true, bloomDivider: 4, outline: true, tiltShift: false, grass: 0.3, particles: 0.5, plants: 0.5, lightPool: 6 },
  medium: { id: 'medium', pixelRatio: 1.5, shadowMap: 2048, msaa: 0, bloom: true, bloomDivider: 2, outline: true, tiltShift: true, grass: 0.65, particles: 0.8, plants: 0.8, lightPool: 8 },
  high: { id: 'high', pixelRatio: 2, shadowMap: 2048, msaa: 4, bloom: true, bloomDivider: 2, outline: true, tiltShift: true, grass: 1, particles: 1, plants: 1, lightPool: 10 },
};

const isQuality = (v: string | null): v is QualityId => v === 'low' || v === 'medium' || v === 'high';

/** Decide la calidad a partir de la URL y del dispositivo. `rendererName` es el texto del GPU (si se conoce). */
export function detectQuality(search: string, rendererName = '', touch = false, cores = 8): Quality {
  const forced = new URLSearchParams(search).get('q');
  if (isQuality(forced)) return QUALITY[forced];
  const soft = /swiftshader|llvmpipe|software|basic render/i.test(rendererName);
  if (soft || cores <= 2) return QUALITY.low;
  if (touch || cores <= 4) return QUALITY.medium;
  return QUALITY.high;
}
