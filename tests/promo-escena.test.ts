import { describe, expect, it } from 'vitest';
import { drawEscena, ESCENA_H, ESCENA_W } from '../src/promo/scene';

describe('escena del reel de anuncio', () => {
  it('mantiene la proporción 9:16 del anuncio', () => {
    expect(ESCENA_W * 16).toBe(ESCENA_H * 9);
  });

  it('dibuja la sala arriba y deja la parte inferior para el texto', () => {
    const pc = drawEscena();
    expect(pc.w).toBe(ESCENA_W);
    expect(pc.h).toBe(ESCENA_H);
    const alfa = (x: number, y: number) => pc.get(x, y) >>> 24;
    // pared del fondo (dentro de la sala) y piso: opacos
    expect(alfa(82, 40)).toBe(255);
    expect(alfa(98, 120)).toBe(255);
    // debajo del piso no hay nada: lo pone el velo de la página
    expect(alfa(0, ESCENA_H - 1)).toBe(0);
  });
});
