import { describe, expect, it } from 'vitest';
import { GameClock } from '../src/engine/timer/GameClock';
import { parseHHMM } from '../src/engine/core/math';

describe('reloj narrativo tolerante', () => {
  it('nunca pasa el máximo de la ventana', () => {
    const c = new GameClock();
    c.running = true;
    c.set('07:50');
    c.window('07:50', '07:52', 1);
    for (let i = 0; i < 600; i++) c.update(1);
    expect(c.minutes).toBeLessThanOrEqual(parseHHMM('07:52'));
    expect(c.minutes).toBeGreaterThan(parseHHMM('07:51'));
  });

  it('al cerrar el estado se adelanta al mínimo', () => {
    const c = new GameClock();
    c.set('07:40');
    c.window('07:48', '07:52');
    c.settle();
    expect(c.text).toBe('07:48');
  });

  it('los saltos pueden respetar la ventana', () => {
    const c = new GameClock();
    c.set('08:00');
    c.window(null, '08:05');
    c.advance(10, true);
    expect(c.text).toBe('08:05');
    c.advance(10);
    expect(c.text).toBe('08:15');
  });

  it('no corre si está detenido', () => {
    const c = new GameClock();
    c.set('07:28');
    c.update(100);
    expect(c.text).toBe('07:28');
  });
});
