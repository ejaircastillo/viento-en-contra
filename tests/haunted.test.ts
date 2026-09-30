import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/haunted/world/colliders';
import { Story, type StoryHost } from '../src/haunted/game/story';
import { DIALOGUES, EPITAPHS, SPEAKERS } from '../src/haunted/game/content';
import type { DialogueNode } from '../src/engine/dialogue/Dialogue';
import { detectQuality, QUALITY } from '../src/haunted/core/quality';
import { CameraRig, GRAVEYARD_RIG } from '../src/haunted/core/cameraRig';
import { damp, fbm, hashStr, rng, smoothstep, valueNoise } from '../src/haunted/core/noise';

describe('colisiones del fantasma', () => {
  it('saca al fantasma de un círculo y lo deja tangente', () => {
    const c = new Colliders();
    c.circle(0, 0, 1);
    const [x, z] = c.resolve(0.2, 0, 0.4);
    expect(Math.hypot(x, z)).toBeCloseTo(1.4, 5);
  });

  it('se desliza por una caja y sale por el lado más cercano si quedó adentro', () => {
    const c = new Colliders();
    c.box(-1, -1, 1, 1);
    const [x] = c.resolve(0.9, 0, 0.3);
    expect(x).toBeCloseTo(1.3, 5);
    const [, z] = c.resolve(0, -0.9, 0.3);
    expect(z).toBeCloseTo(-1.3, 5);
  });

  it('respeta los límites del área y no deja huecos en un segmento', () => {
    const c = new Colliders();
    c.bounds = [-5, -5, 5, 5];
    expect(c.resolve(9, -9, 0.5)).toEqual([4.5, -4.5]);
    c.segment(-2, 0, 2, 0, 0.2);
    for (let x = -2; x <= 2; x += 0.1) expect(c.blocked(x, 0, 0.05)).toBe(true);
    expect(c.hitsObstacle(0, 3, 0.5)).toBe(false);
    expect(c.hitsObstacle(0, 0.3, 0.2)).toBe(true);
  });
});

describe('azar y ruido con semilla', () => {
  it('rng y hashStr son deterministas', () => {
    const a = rng(42);
    const b = rng(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
    expect(hashStr('cementerio')).toBe(hashStr('cementerio'));
    expect(hashStr('cementerio')).not.toBe(hashStr('cripta'));
  });

  it('el ruido queda en [0,1] y es continuo', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const v = fbm(x, x * 0.5, 4, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise(x, 1) - valueNoise(x + 0.001, 1))).toBeLessThan(0.02);
    }
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(damp(0, 10, 5, 100)).toBeCloseTo(10, 3);
  });
});

describe('calidad gráfica', () => {
  it('?q= manda, el software y los pocos núcleos bajan y el táctil va a medio', () => {
    expect(detectQuality('?q=high', 'SwiftShader', true, 2).id).toBe('high');
    expect(detectQuality('', 'Google SwiftShader').id).toBe('low');
    expect(detectQuality('', 'NVIDIA', false, 2).id).toBe('low');
    expect(detectQuality('', 'Adreno', true, 8).id).toBe('medium');
    expect(detectQuality('', 'NVIDIA', false, 16).id).toBe('high');
    expect(QUALITY.high.msaa).toBeGreaterThan(QUALITY.low.msaa);
  });
});

describe('cámara isométrica', () => {
  it('"adelante" del suelo es hacia el fondo de la pantalla y la base es ortonormal', () => {
    const rig = new CameraRig(16 / 9, GRAVEYARD_RIG);
    const { forward, right } = rig.groundBasis();
    expect(forward.length()).toBeCloseTo(1);
    expect(right.length()).toBeCloseTo(1);
    expect(forward.dot(right)).toBeCloseTo(0);
    // la cámara está en +x,+z: lo que queda "arriba" en pantalla es hacia (-x,-z)
    expect(forward.x).toBeLessThan(0);
    expect(forward.z).toBeLessThan(0);
  });

  it('se aleja en pantallas verticales y no deja salir al objetivo de los límites', () => {
    const rig = new CameraRig(16 / 9, GRAVEYARD_RIG);
    rig.setAspect(0.46);
    for (let i = 0; i < 200; i++) rig.update(0.05);
    expect(rig.camera.position.distanceTo(rig.look)).toBeGreaterThan(GRAVEYARD_RIG.distance * 1.3);
    rig.setTarget(99, -99, true);
    expect(rig.look.x).toBe(GRAVEYARD_RIG.bounds[2]);
    expect(rig.look.z).toBe(GRAVEYARD_RIG.bounds[1]);
  });
});

function fakeHost() {
  const st = {
    objective: '' as string | null,
    toasts: [] as string[],
    notes: [] as string[],
    said: [] as string[],
    inscriptions: [] as string[],
    talking: [] as (string | null)[],
    ended: 0,
    stamped: 0,
    dogLed: 0,
    sealTaken: 0,
    gate: null as Promise<void> | null,
  };
  const host: StoryHost = {
    say: async (name, text) => {
      st.said.push(`${name}: ${text}`);
      if (st.gate) await st.gate;
    },
    choose: async () => 0,
    inscription: async (e) => {
      st.inscriptions.push(e.name);
    },
    talking: (id) => void st.talking.push(id),
    objective: (t) => void (st.objective = t),
    toast: (t) => void st.toasts.push(t),
    notify: (k) => void st.notes.push(k),
    dogLead: async () => void st.dogLed++,
    takeSeal: () => void st.sealTaken++,
    stamp: async () => void st.stamped++,
    ending: async () => void st.ended++,
    sleep: async () => {},
  };
  return { host, st, story: new Story(host) };
}

describe('la misión de Fantasma en trámite', () => {
  it('avanza de la etapa 0 a la 4 en orden', async () => {
    const { story, st } = fakeHost();
    story.start();
    expect(story.stage).toBe(0);
    expect(st.objective).toMatch(/Don Huesos/);

    await story.interact('skeleton');
    expect(story.stage).toBe(1);
    expect(story.has('vela')).toBe(true);
    expect(story.objective).toMatch(/Pelusa/);

    await story.interact('dog');
    expect(story.stage).toBe(2);
    expect(st.dogLed).toBe(1);
    expect(st.talking.at(-1)).toBeNull();

    await story.interact('seal');
    expect(story.stage).toBe(3);
    expect(story.has('sello')).toBe(true);
    expect(st.sealTaken).toBe(1);

    await story.interact('lutin');
    expect(story.stage).toBe(4);
    expect(st.stamped).toBe(1);
    expect(st.ended).toBe(1);
    expect(story.has('sello')).toBe(false);
    expect(story.has('certificado')).toBe(true);
    expect(st.objective).toMatch(/mañana/);
    expect(story.journal()[0].done).toBe(true);
  });

  it('Lutin sin el sello no avanza nada, y Don Huesos no se repite la intro', async () => {
    const { story, st } = fakeHost();
    await story.interact('lutin');
    expect(story.stage).toBe(0);
    expect(st.stamped).toBe(0);
    await story.interact('skeleton');
    const first = st.said.length;
    await story.interact('skeleton');
    expect(story.stage).toBe(1);
    expect(st.said.slice(first)[0]).not.toBe(st.said[0]);
  });

  it('no deja abrir dos conversaciones a la vez', async () => {
    const { story, st } = fakeHost();
    let open!: () => void;
    st.gate = new Promise<void>((r) => (open = r));
    const p1 = story.interact('skeleton');
    await Promise.resolve();
    expect(story.busy).toBe(true);
    await story.interact('skeleton'); // se ignora
    expect(st.said.length).toBe(1);
    open();
    await p1;
    expect(story.busy).toBe(false);
  });

  it('cuenta las lápidas leídas y sólo avisa al diario la primera vez', async () => {
    const { story, st } = fakeHost();
    await story.interact('grave_1');
    await story.interact('grave_1');
    await story.interact('grave_2');
    expect(story.epitaphsRead.size).toBe(2);
    expect(st.notes.filter((n) => n === 'journal').length).toBe(2);
    expect(story.journal().at(-1)!.text).toContain(`2 de ${Object.keys(EPITAPHS).length}`);
  });
});

const HOOKS = new Set(['give_candle', 'dog_lead', 'stamp', 'finish']);
const walk = (nodes: DialogueNode[], visit: (n: DialogueNode) => void): void => {
  for (const n of nodes) {
    visit(n);
    if ('then' in n && Array.isArray(n.then)) walk(n.then, visit);
    if ('else' in n && Array.isArray(n.else)) walk(n.else, visit);
    if ('choice' in n) for (const o of n.choice) if (o.then) walk(o.then, visit);
  }
};

describe('guion e inscripciones', () => {
  it('existen las conversaciones que la historia necesita', () => {
    for (const k of ['huesos_intro', 'huesos_again', 'huesos_seal', 'huesos_done', 'pelusa_before', 'pelusa_ask', 'pelusa_after', 'lutin_noseal', 'lutin_stamp', 'lutin_done']) expect(DIALOGUES[k]?.length, k).toBeGreaterThan(0);
  });

  it('los personajes y las acciones usados están definidos, y las líneas caben en la caja', () => {
    for (const [key, nodes] of Object.entries(DIALOGUES)) {
      walk(nodes, (n) => {
        if ('who' in n && n.who) expect(SPEAKERS[n.who], `${key}: ${n.who}`).toBeTruthy();
        if ('do' in n) expect(HOOKS.has(n.do), `${key}: ${n.do}`).toBe(true);
        if ('text' in n) expect(n.text.length, `${key}: ${n.text}`).toBeLessThanOrEqual(150);
        if ('choice' in n) {
          expect(n.choice.length).toBeGreaterThan(0);
          for (const o of n.choice) expect(o.text.length).toBeLessThanOrEqual(60);
        }
      });
    }
  });

  it('las inscripciones tienen rótulo, nombre y al menos una línea', () => {
    for (const [id, e] of Object.entries(EPITAPHS)) {
      expect(e.kicker.length, id).toBeGreaterThan(0);
      expect(e.name.length, id).toBeGreaterThan(0);
      expect(e.lines.length, id).toBeGreaterThan(0);
      for (const l of e.lines) expect(l.length, `${id}: ${l}`).toBeLessThanOrEqual(80);
    }
    for (let i = 1; i <= 10; i++) expect(EPITAPHS[`grave_${i}`], `grave_${i}`).toBeTruthy();
  });
});
