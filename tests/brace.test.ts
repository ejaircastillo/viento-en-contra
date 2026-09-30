import { describe, expect, it } from 'vitest';
import { BraceModel, DEFAULT_GUSTS, BRACE_WARN, type BracePhase } from '../src/engine/core/Brace';

const DT = 1 / 60;

/** Corre el minijuego hasta el final con una "política" de botón. */
function play(policy: (m: BraceModel, elapsedInPhase: number) => boolean, reaction = 0): BraceModel {
  const m = new BraceModel();
  let phase: BracePhase = m.phase;
  let inPhase = 0;
  for (let i = 0; i < 60 * 120 && !m.done; i++) {
    if (m.phase !== phase) {
      phase = m.phase;
      inPhase = 0;
    }
    inPhase += DT;
    void reaction;
    m.step(DT, policy(m, inPhase));
  }
  return m;
}

describe('minijuego del cartel (ensayo eólico)', () => {
  it('termina solo y dura unos 20 s', () => {
    const t = DEFAULT_GUSTS.reduce((a, g) => a + g.gap + g.dur, 0);
    expect(t).toBeGreaterThan(14);
    expect(t).toBeLessThan(30);
    const m = play(() => false);
    expect(m.done).toBe(true);
  });

  it('quien aprieta al pegar la ráfaga y suelta al pasar las resiste todas', () => {
    // reacción humana de ~0,3 s: aprieta 0,3 s después de que empiece la ráfaga
    const m = play((mm, inPhase) => mm.phase === 'gust' && inPhase > 0.3);
    expect(m.slips).toBe(0);
    expect(m.held).toBe(DEFAULT_GUSTS.length);
  });

  it('también perdona una reacción lenta (0,6 s)', () => {
    const m = play((mm, inPhase) => mm.phase === 'gust' && inPhase > 0.6);
    expect(m.slips).toBeLessThanOrEqual(1);
  });

  it('sin apretar nunca, el cartel se vuela en todas las ráfagas', () => {
    const m = play(() => false);
    expect(m.slips).toBe(DEFAULT_GUSTS.length);
    expect(m.held).toBe(0);
  });

  it('apretar todo el tiempo cansa: se pierde alguna ráfaga larga', () => {
    const m = play(() => true);
    expect(m.slips).toBeGreaterThan(0);
    expect(m.slips + m.held).toBe(DEFAULT_GUSTS.length);
  });

  it('apretar ya desde el aviso también termina por cansar en la ráfaga más larga', () => {
    const m = play((mm) => mm.phase === 'warn' || mm.phase === 'gust');
    expect(m.slips).toBeGreaterThan(0);
  });

  it('emite avisos y resultados en orden', () => {
    const m = new BraceModel([{ gap: 1.2, dur: 1, peak: 0.7 }]);
    const seen: string[] = [];
    for (let i = 0; i < 60 * 20 && !m.done; i++) {
      m.step(DT, m.phase === 'gust');
      seen.push(...m.drain());
    }
    expect(seen).toEqual(['warn', 'gust', 'held', 'done']);
  });

  it('el aviso dura lo indicado y el viento nunca sale de 0–1', () => {
    expect(BRACE_WARN).toBeGreaterThan(0.5);
    const m = new BraceModel();
    for (let i = 0; i < 60 * 40 && !m.done; i++) {
      m.step(DT, i % 90 < 45);
      expect(m.level).toBeGreaterThanOrEqual(0);
      expect(m.level).toBeLessThanOrEqual(1);
      expect(m.slip).toBeGreaterThanOrEqual(0);
      expect(m.stamina).toBeGreaterThanOrEqual(0);
      expect(m.stamina).toBeLessThanOrEqual(1);
    }
  });

  it('una lista vacía termina de inmediato', () => {
    expect(new BraceModel([]).done).toBe(true);
  });
});
