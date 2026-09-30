/**
 * Viento compartido entre CPU y GPU: es la MISMA fórmula que usa el vertex shader del pasto (`WIND_VERTEX` en
 * materials.ts), así las hojas y el humo que simula la CPU van con las ráfagas que se ven mover los yuyos
 * (la misma idea que en la referencia: el ruido del viento se puede muestrear desde ambos lados).
 * Devuelve un valor aproximadamente en [-1,4; 1,4].
 */
export function windGust(x: number, z: number, t: number): number {
  const ph = t * 1.5 + x * 0.55 + z * 0.43;
  return Math.sin(ph) * 0.6 + Math.sin(ph * 2.3 + z * 0.8) * 0.3 + Math.sin(t * 0.37 + x * 0.12) * 0.5;
}
