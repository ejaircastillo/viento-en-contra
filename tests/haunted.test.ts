import { describe, expect, it } from 'vitest';
import { Colliders } from '../src/haunted/world/colliders';
import { Story, type StoryHost } from '../src/haunted/game/story';
import { DIALOGUES, EPITAPHS, SPEAKERS } from '../src/haunted/game/content';
import type { DialogueNode } from '../src/engine/dialogue/Dialogue';
import { detectQuality, QUALITY } from '../src/haunted/core/quality';
import { CameraRig, GRAVEYARD_RIG } from '../src/haunted/core/cameraRig';
import { damp, fbm, hashStr, rng, smoothstep, valueNoise } from '../src/haunted/core/noise';
import * as THREE from 'three';
import { blob } from '../src/haunted/gfx/geom';
import { windGust } from '../src/haunted/gfx/wind';
import { MOON_DIR, moonPool, patchMoon, updateSky } from '../src/haunted/gfx/sky';

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

describe('luz de luna y viento (técnicas del desglose de la referencia)', () => {
  it('el charco de luna se inyecta en el bucle de luces direccionales de three.js', () => {
    const glsl = ['#include <common>', 'void main() {', '#include <lights_fragment_begin>', '}'].join(String.fromCharCode(10));
    const sh = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: glsl };
    patchMoon(sh);
    // si una versión nueva de three cambia ese chunk, esta prueba avisa antes de que la luna deje de caer
    expect(sh.fragmentShader).toContain('directLight.color *= moonPool( geometryPosition );');
    expect(sh.fragmentShader).toContain('float moonPool( vec3 viewPos )');
    for (const k of ['uGhostView', 'uCamWorld', 'uPool', 'uCloud', 'uSkyTime']) expect(sh.uniforms[k]).toBe(moonPool[k as keyof typeof moonPool]);
  });

  it('la distancia al fantasma se mide bien en espacio de vista y la luna apunta hacia arriba', () => {
    const cam = new THREE.PerspectiveCamera(27, 1.6, 0.5, 140);
    cam.position.set(12, 14, 12);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
    updateSky(cam, 2, -3, 5);
    expect(moonPool.uGhostView.value.length()).toBeCloseTo(cam.position.distanceTo(new THREE.Vector3(2, 0.6, -3)), 4);
    expect(moonPool.uSkyTime.value).toBe(5);
    expect(MOON_DIR.length()).toBeCloseTo(1);
    expect(MOON_DIR.y).toBeGreaterThan(0.5);
  });

  it('el viento de la CPU (hojas y humo) queda acotado y cambia con el tiempo y el lugar', () => {
    let min = 9;
    let max = -9;
    for (let i = 0; i < 400; i++) {
      const v = windGust(i * 0.7, i * 0.3, i * 0.05);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThanOrEqual(-1.4);
    expect(max).toBeLessThanOrEqual(1.4);
    expect(max - min).toBeGreaterThan(1);
    expect(windGust(1, 2, 3)).not.toBe(windGust(1, 2, 3.5));
    expect(windGust(1, 2, 3)).toBe(windGust(1, 2, 3));
  });

  it('las copas con normales suaves apuntan hacia afuera (luz que resbala, como en los árboles de la referencia)', () => {
    const soft = blob(1, 1, 0.3, 4, [1, 1, 1], undefined, 1);
    const pos = soft.getAttribute('position');
    const nor = soft.getAttribute('normal');
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).normalize();
      n.fromBufferAttribute(nor, i);
      expect(p.dot(n)).toBeGreaterThan(0.999);
    }
    const flat = blob(1, 1, 0.3, 4);
    const fn = flat.getAttribute('normal');
    const fp = flat.getAttribute('position');
    let differs = 0;
    for (let i = 0; i < fp.count; i++) {
      p.fromBufferAttribute(fp, i).normalize();
      n.fromBufferAttribute(fn, i);
      if (p.dot(n) < 0.99) differs++;
    }
    expect(differs).toBeGreaterThan(0);
  });
});
