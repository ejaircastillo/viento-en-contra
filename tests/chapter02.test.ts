import { beforeAll, describe, expect, it } from 'vitest';
import flowSrc from '../src/content/chapter02/flow.ts?raw';
import dialoguesSrc from '../src/content/chapter02/dialogues.ts?raw';
import finalsSrc from '../src/content/chapter02/finals.ts?raw';
import propsSrc from '../src/content/chapter02/props.ts?raw';
import configSrc from '../src/content/chapter02/config.ts?raw';
import radioSrc from '../src/content/chapter02/radio.ts?raw';
import npcsSrc from '../src/content/chapter02/npcs.ts?raw';
import interiorsSrc from '../src/content/chapter02/interiors.ts?raw';
import citySrc from '../src/content/chapter02/city.ts?raw';
import { runDialogue, type DialogueNode, type Flags } from '../src/engine/dialogue/Dialogue';
import { buildCity, type CityModel } from '../src/engine/world/CityBuilder';
import { hasProp } from '../src/engine/world/PropRegistry';
import { PAL } from '../src/engine/assets/Palette';
import { fitText, measureText } from '../src/engine/assets/BitmapFont';
import { nextChapterId, type InteriorDef } from '../src/engine/mission/types';
import { registerBrands } from '../src/content/brands';
import { registerInteriorProps, interiors as interiorsCh1 } from '../src/content/chapter01/interiors';
import ch1IndexSrc from '../src/content/chapter01/index.ts?raw';
import ch2IndexSrc from '../src/content/chapter02/index.ts?raw';
import { registerChapter2Props } from '../src/content/chapter02/props';
import { cityPlan } from '../src/content/chapter02/city';
import { interiors } from '../src/content/chapter02/interiors';
import { npcs } from '../src/content/chapter02/npcs';
import { dialogues } from '../src/content/chapter02/dialogues';
import { radio } from '../src/content/chapter02/radio';
import { CONFIG2 } from '../src/content/chapter02/config';
import { characters } from '../src/content/characters';
import { tracks } from '../src/content/music';
import { content } from '../src/content';
import { startSpot, uturnNeeded } from './roadsHelper';

const CHARS = Object.keys(characters);
/** El guion importa el motor (Phaser necesita `window`): en los tests se lee como texto en vez de importarlo. */
const listOf = (src: string, key: string) => {
  const m = new RegExp(String.raw`\b${key}\s*[:=]\s*\[`).exec(src);
  if (!m) return [];
  const open = m.index + m[0].length - 1;
  return [...src.slice(open, src.indexOf(']', open)).matchAll(/'([A-Za-z0-9_]+)'/g)].map((x) => x[1]);
};
const stateOrder = listOf(flowSrc, 'stateOrder');
const ch1Carry = listOf(ch1IndexSrc, 'carry');
const ch2Carry = listOf(ch2IndexSrc, 'carry');
const allInteriors: Record<string, InteriorDef> = { muni_hab: interiorsCh1.muni_hab, ...interiors };
let city: CityModel;

beforeAll(() => {
  registerBrands();
  registerInteriorProps();
  registerChapter2Props();
  city = buildCity(cityPlan());
  markerNames = new Set([...city.markers.keys(), ...Object.values(allInteriors).flatMap((i) => Object.keys(i.markers))]);
  zoneNames = new Set([...city.zones.keys(), ...Object.values(allInteriors).flatMap((i) => i.zones.map((z) => z.id))]);
});

/** Argumentos (texto) de cada llamada `name(...)` del código fuente, respetando comillas y paréntesis. */
function callArgs(src: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${name}\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    const start = i;
    let depth = 1;
    let q: string | null = null;
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '\\') i++;
        else if (ch === q) q = null;
      } else if (ch === "'" || ch === '"' || ch === '`') q = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}
const ids = (s: string) => [...s.matchAll(/'([a-z][a-z0-9_]*)'/g)].map((x) => x[1]);
const uniq = <T,>(a: T[]) => [...new Set(a)];

let markerNames: Set<string>;
let zoneNames: Set<string>;

function vocabFor(charId: string): Record<string, string> {
  const c = characters[charId];
  return { ...CONFIG2.vocab, ...c.vocab, player: c.name, time: '09:41' };
}
function knownSpeaker(who: string, charId: string): boolean {
  if (['player', 'kid', 'sister', 'radio'].includes(who)) return true;
  return !!npcs[`${who}@${charId}`] || !!npcs[who];
}
async function play(nodes: DialogueNode[], charId: string, pick: number, flags: Flags = {}) {
  const said: { who: string | null; text: string }[] = [];
  await runDialogue(nodes, {
    characterId: charId,
    flags,
    vocab: vocabFor(charId),
    speaker: (id) => ({ name: id }),
    say: async (sp, text) => {
      said.push({ who: sp?.name ?? null, text });
    },
    choose: async (opts) => Math.min(pick, opts.length - 1),
    thought: () => {},
    hook: () => {},
    wait: async () => {},
  });
  return said;
}

/** Flags que define el guion: `set: {...}` de los diálogos y `flags.x = ...` del flujo. */
function definedFlags(): Set<string> {
  const out = new Set<string>();
  for (const src of [dialoguesSrc, finalsSrc]) for (const m of src.matchAll(/set:\s*\{([^}]*)\}/g)) for (const k of m[1].matchAll(/(\w+)\s*:/g)) out.add(k[1]);
  for (const m of flowSrc.matchAll(/flags\.(\w+)\s*=[^=]/g)) out.add(m[1]);
  for (const m of flowSrc.matchAll(/\bflags\[['"](\w+)['"]\]\s*=[^=]/g)) out.add(m[1]);
  return out;
}

function hasRoute(m: CityModel, from: string, to: string): boolean {
  const a = m.markers.get(from)!.at;
  const start = m.roads.parkingSpot(a[0], a[1])!;
  const b = m.markers.get(to)!.at;
  return m.roads.parkingSpots(b[0], b[1]).some((g) => !!m.roads.route(start.edge.id, start.d, g.edge.id, g.d, true));
}

describe('Capítulo 2 · ciudad y recorridos', () => {
  it('se arma de forma determinista', () => {
    expect(buildCity(cityPlan()).statics.length).toBe(city.statics.length);
  });

  it('todo prop usado está registrado', () => {
    for (const p of city.plan.props) expect(hasProp(p.type), p.type).toBe(true);
    for (const [id, def] of Object.entries(allInteriors)) for (const p of def.props) expect(hasProp(p.type), `${id}: ${p.type}`).toBe(true);
  });

  it('cada tramo en auto tiene lugar para estacionar y ruta', () => {
    const legs: [string, string][] = [
      ['muni_car', 'feria_car'], ['feria_car', 'obra_car'], ['obra_car', 'an15_car'], ['an15_car', 'home_car'], // Diego
      ['home_car', 'feria_car'], ['feria_car', 'muni_car'], ['muni_car', 'home_car'], // Nahuel
    ];
    for (const [a, b] of legs) {
      expect(city.roads.parkingSpots(...(city.markers.get(b)!.at as [number, number])).length, b).toBeGreaterThan(0);
      expect(hasRoute(city, a, b), `${a} → ${b}`).toBe(true);
    }
  });

  it('cada tramo arranca estacionado del lado que mira hacia el destino (sin vuelta en U forzada)', () => {
    const legs: [string, string][] = [
      ['muni_car', 'feria_car'], ['feria_car', 'obra_car'], ['obra_car', 'an15_car'], ['an15_car', 'home_car'], // Diego
      ['home_car', 'feria_car'], ['feria_car', 'muni_car'], ['muni_car', 'home_car'], // Nahuel
    ];
    for (const [a, b] of legs) {
      const spot = startSpot(city, a, b);
      expect(spot, `${a} → ${b}: lugar`).toBeTruthy();
      expect(uturnNeeded(city, b, spot!), `${a} → ${b}: arranca con vuelta en U`).toBe(false);
      // y con `toward` siempre hay una ruta directa
      const goals = city.roads.parkingSpots(...(city.markers.get(b)!.at as [number, number]));
      expect(goals.some((g) => !!city.roads.route(spot!.edge.id, spot!.d, g.edge.id, g.d, true)), `${a} → ${b}: ruta`).toBe(true);
    }
    // el flujo pide `toward` en cada tramo de manejo (si no, arranca del lado más cercano al marcador)
    for (const a of callArgs(flowSrc, 'cityContinue')) if (/mode: 'drive'/.test(a)) expect(a, 'cityContinue drive sin toward').toMatch(/toward: '/);
  });

  it('los marcadores, zonas y objetos que nombra el guion existen', () => {
    // el analizador de texto encuentra las llamadas (si el guion se reformatea y esto baja, hay que revisarlo)
    for (const [name, min] of [['spawnNpc', 25], ['waitZone', 6], ['setDestination', 6], ['waitArrival', 6], ['setInteract', 12], ['arriveOnFoot', 5], ['say', 20]] as const)
      expect(callArgs(flowSrc, name).length, `llamadas a ${name}`).toBeGreaterThanOrEqual(min);
    for (const m of flowSrc.matchAll(/\bat: '([a-z0-9_]+)'/g)) expect(markerNames.has(m[1]), `at: ${m[1]}`).toBe(true);
    for (const a of callArgs(flowSrc, 'arriveOnFoot')) {
      const m = /^\s*ctx,\s*'([a-z0-9_]+)',\s*(?:'([a-z0-9_]+)')?/.exec(a)!;
      expect(markerNames.has(m[1]), `arriveOnFoot ${m[1]}`).toBe(true);
      if (m[2]) expect(markerNames.has(m[2]), `arriveOnFoot ${m[2]}`).toBe(true);
    }
    for (const a of [...callArgs(flowSrc, 'waitZone'), ...callArgs(flowSrc, 'onZone')]) expect(zoneNames.has(ids(a)[0]), a).toBe(true);
    for (const a of [...callArgs(flowSrc, 'setDestination'), ...callArgs(flowSrc, 'waitArrival')]) expect(city.markers.has(ids(a)[0]), a).toBe(true);
    for (const a of callArgs(flowSrc, 'walkTo')) if (ids(a)[1]) expect(markerNames.has(ids(a)[1]), a).toBe(true);
    const interactable = new Set<string>(['car', ...city.statics.map((s) => s.id ?? ''), ...Object.values(npcs).map((n) => n.id), ...Object.values(allInteriors).flatMap((i) => i.props.map((p) => p.id ?? ''))]);
    for (const a of [...callArgs(flowSrc, 'setInteract'), ...callArgs(flowSrc, 'waitInteract')]) if (/^\s*'/.test(a)) expect(interactable.has(ids(a)[0]), a).toBe(true);
    for (const a of [...callArgs(flowSrc, 'setStaticFrame'), ...callArgs(flowSrc, 'setStaticHidden')]) expect(city.statics.some((s) => s.id === ids(a)[0]), a).toBe(true);
  });

  it('los NPC del guion existen y los interiores están bien armados', () => {
    // ids literales de spawnNpc, más los de las listas que el guion recorre (puestos de la feria y vecinos)
    const spawned = new Set<string>();
    for (const a of callArgs(flowSrc, 'spawnNpc')) {
      const m = /^\s*ctx,\s*\w+,\s*'([a-z0-9_]+)'(?:,\s*'([a-z0-9_]+)')?/.exec(a);
      if (m) {
        spawned.add(m[1]);
        if (m[2]) expect(markerNames.has(m[2]), `spawnNpc ${m[1]} @ ${m[2]}`).toBe(true);
      }
    }
    for (const m of flowSrc.matchAll(/\{ id: '([a-z0-9_]+)', dlg: /g)) spawned.add(m[1]);
    for (const m of flowSrc.matchAll(/\['(vecino_[a-z])'(?:, '(vecino_[a-z])')*(?:, '(vecino_[a-z])')?\]/g)) m.slice(1).filter(Boolean).forEach((x) => spawned.add(x));
    expect(spawned.size).toBeGreaterThan(20);
    for (const id of spawned) expect(CHARS.some((c) => knownSpeaker(id, c)), `NPC inexistente: ${id}`).toBe(true);
    for (const [id, def] of Object.entries(allInteriors)) {
      for (const [name, mk] of Object.entries(def.markers)) {
        expect(mk.at[0], `${id}.${name}.x`).toBeGreaterThanOrEqual(0);
        expect(mk.at[0], `${id}.${name}.x`).toBeLessThanOrEqual(def.size[0]);
        expect(mk.at[1], `${id}.${name}.y`).toBeGreaterThanOrEqual(0);
        expect(mk.at[1], `${id}.${name}.y`).toBeLessThanOrEqual(def.size[1]);
      }
    }
    for (const a of callArgs(flowSrc, 'interior')) expect(allInteriors[ids(a)[0]], a).toBeTruthy();
  });

  it('los carteles de las paredes de los interiores se leen enteros (nada recortado)', () => {
    // misma geometría que InteriorBuilder.drawWallItem
    const cut: string[] = [];
    for (const [iid, def] of Object.entries(allInteriors))
      for (const it of def.items) {
        if (!['poster', 'sign', 'board'].includes(it.kind) || !it.text) continue;
        const u0 = Math.round(it.u * 16) & ~1;
        const u1 = Math.round((it.u + it.w) * 16) & ~1;
        const z1 = Math.min(def.wallH - 2, it.z + it.h);
        const logoW = it.logo ? Math.min(9, z1 - it.z - 3) + 2 : 0;
        const avail = u1 - (u0 + 2 + logoW) - 2;
        const lines = [it.text, it.text2].filter(Boolean) as string[];
        const fit = fitText(lines, avail, Math.max(1, Math.floor((z1 - it.z + 1) / 9)));
        if (fit.lines.join(' ') !== lines.join(' ')) cut.push(`${iid}: "${lines.join(' / ')}" (ancho útil ${avail}px → "${fit.lines.join(' / ')}")`);
        // y entran en el alto del cartel (cada renglón ocupa 9 px; si no, el texto se sale del cartel)
        else if (fit.lines.length > Math.floor((z1 - it.z + 1) / 9)) cut.push(`${iid}: "${lines.join(' / ')}" tiene ${fit.lines.length} renglones y el cartel mide ${z1 - it.z} px de alto`);
      }
    expect(cut, 'carteles recortados').toEqual([]);
  });

  it('los carteles y rótulos de una misma pared no se tapan entre sí', () => {
    type R = { name: string; u0: number; u1: number; z0: number; z1: number };
    const clash: string[] = [];
    for (const [iid, def] of Object.entries(allInteriors)) {
      const rects: Record<string, R[]> = { back: [], left: [] };
      for (const it of def.items) {
        const u0 = Math.round(it.u * 16) & ~1;
        const u1 = Math.round((it.u + it.w) * 16) & ~1;
        const z1 = Math.min(def.wallH - 2, it.z + it.h);
        if (['poster', 'sign', 'board', 'window'].includes(it.kind)) rects[it.wall].push({ name: it.text ?? it.kind, u0, u1, z0: it.z, z1 });
        if (it.kind === 'door' && it.text) {
          // el rótulo de la puerta puede ser más ancho que la puerta (misma geometría que drawWallItem)
          const tw = measureText(it.text, 0);
          const su = Math.floor((u0 + u1 - tw) / 2);
          rects[it.wall].push({ name: `puerta ${it.text}`, u0: su - 2, u1: su + tw + 2, z0: z1 + 3, z1: z1 + 12 });
        }
      }
      for (const wall of ['back', 'left'])
        for (let i = 0; i < rects[wall].length; i++)
          for (let j = i + 1; j < rects[wall].length; j++) {
            const a = rects[wall][i];
            const b = rects[wall][j];
            const overlapU = Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0);
            const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
            // 2 px de tolerancia: los márgenes del texto centrado absorben roces mínimos
            if (overlapU > 2 && overlapZ > 0) clash.push(`${iid}/${wall}: "${a.name}" pisa a "${b.name}"`);
          }
    }
    expect(clash, 'carteles superpuestos').toEqual([]);
  });

  it('los colores nombrados existen en la paleta', () => {
    const okName = (v: string) => v in PAL || /^#[0-9a-f]{3,8}$/i.test(v);
    for (const src of [propsSrc, interiorsSrc, citySrc, npcsSrc, flowSrc])
      for (const m of src.matchAll(/\bC\('([A-Za-z0-9]+)'/g)) expect(okName(m[1]), `C('${m[1]}')`).toBe(true);
    for (const [id, n] of Object.entries(npcs))
      for (const k of ['skin', 'hair', 'hat', 'top', 'accent', 'bottom', 'shoes', 'lanyard', 'backpack', 'scarf', 'tie'] as const) {
        const v = n.look[k];
        if (v) expect(okName(v), `${id}.${k}=${v}`).toBe(true);
      }
    for (const m of flowSrc.matchAll(/body: '([A-Za-z0-9]+)'|accent: '([A-Za-z0-9]+)'/g)) expect(okName(m[1] ?? m[2]), m[0]).toBe(true);
  });
});

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function stateBodies(): Record<string, string> {
  const marks = [...flowSrc.matchAll(/^ {2}async ([A-Z_0-9]+)\(ctx\) \{/gm)].map((m) => ({ id: m[1], at: m.index! }));
  const out: Record<string, string> = {};
  marks.forEach((m, i) => (out[m.id] = flowSrc.slice(m.at, i + 1 < marks.length ? marks[i + 1].at : flowSrc.length)));
  return out;
}

describe('Capítulo 2 · reloj y orden de estados', () => {
  const bodies = stateBodies();
  const info = (id: string) => {
    const b = bodies[id];
    const win = /clock\.window\('(\d\d:\d\d)', '(\d\d:\d\d)'/.exec(b);
    const set = /clock\.set\('(\d\d:\d\d)'\)/.exec(b);
    const setsFirst = set && (!win || set.index! < win.index!);
    return { start: setsFirst ? toMin(set![1]) : null, min: win ? toMin(win[1]) : null, max: win ? toMin(win[2]) : null };
  };
  const routes: Record<string, string[]> = {
    Diego: ['D_BRIEFING', 'D_A_LA_FERIA', 'D_FERIA', 'D_A_LA_OBRA', 'D_OBRA', 'D_A_ACA_NOMAS', 'D_ACA_NOMAS', 'D_AL_KIOSCO', 'FINAL_KIOSCO'],
    Nahuel: ['N_AMANECER', 'N_A_LA_FERIA', 'N_ENSAYO', 'N_A_LA_MUNI', 'N_TESORERIA', 'N_OBRAS', 'N_AL_KIOSCO', 'FINAL_KIOSCO'],
  };

  it('estados y orden consistentes', () => {
    expect(uniq(stateOrder).length).toBe(stateOrder.length);
    for (const id of stateOrder) expect(bodies[id], id).toBeTruthy();
    for (const id of Object.keys(bodies)) expect(stateOrder, id).toContain(id);
    for (const m of flowSrc.matchAll(/return '([A-Z_0-9]+)';/g)) expect(bodies[m[1]], `return ${m[1]}`).toBeTruthy();
    expect(stateOrder).toContain(/initialState: '([A-Z_0-9]+)'/.exec(ch2IndexSrc)![1]);
    for (const r of Object.values(routes)) for (const id of r) expect(bodies[id], id).toBeTruthy();
  });

  it('el tope de cada ventana no queda por debajo de la hora con la que se llega (el reloj no se "recorta")', () => {
    for (const [who, route] of Object.entries(routes)) {
      let hi = 0; // la hora más alta posible al empezar el estado
      for (const id of route) {
        const { start, max } = info(id);
        if (start !== null) hi = start;
        if (max !== null) {
          expect(max, `${who} · ${id}: tope ${max} < ${hi} (llega con más hora y el reloj retrocedería)`).toBeGreaterThanOrEqual(hi);
          hi = max;
        }
      }
    }
  });

  it('el reloj sólo avanza a lo largo de cada ruta (sin saltos hacia atrás)', () => {
    for (const [who, route] of Object.entries(routes)) {
      let now = 0;
      for (const id of route) {
        const { start, min, max } = info(id);
        if (start !== null) expect(start, `${who} · ${id} arranca antes de lo que ya pasó`).toBeGreaterThanOrEqual(now);
        if (start !== null) now = start;
        if (min !== null && max !== null) {
          expect(min, `${who} · ${id}: ventana mín ≤ máx`).toBeLessThanOrEqual(max);
          expect(min, `${who} · ${id}: la ventana termina antes de empezar`).toBeGreaterThanOrEqual(now);
          now = min;
        }
      }
      expect(now, `${who}: el capítulo termina cerca de las 11`).toBeGreaterThanOrEqual(10 * 60 + 40);
    }
  });
});

describe('Capítulo 2 · diálogos', () => {
  const flagSets: Flags[] = [
    {},
    { prev_tono_final: 'sincero', prev_respuesta_mama: 'inspector', prev_gorro: true },
    { prev_tono_final: 'callado', prev_respuesta_mama: 'nadie', prev_gorro: false },
    { prev_tono_final: 'ironico', prev_respuesta_mama: 'nose' },
  ];

  it('cada diálogo que pide el guion existe y todos se usan', () => {
    const used = new Set<string>();
    for (const a of callArgs(flowSrc, 'say')) if (!/^\s*[[{]/.test(a)) ids(a).forEach((i) => used.add(i));
    for (const a of callArgs(flowSrc, 'phoneCall')) if (ids(a)[1]) used.add(ids(a)[1]);
    for (const m of flowSrc.matchAll(/\bdlg: '([a-z0-9_]+)'/g)) used.add(m[1]);
    for (const id of used) expect(dialogues[id], `diálogo faltante: ${id}`).toBeTruthy();
    // también valen los ids armados con plantilla (`n_beto_${resultado}`)
    const prefixes = [...flowSrc.matchAll(/`([a-z0-9_]+_)\$\{/g)].map((m) => m[1]);
    const unused = Object.keys(dialogues).filter((k) => !flowSrc.includes(`'${k}'`) && !prefixes.some((p) => k.startsWith(p)));
    expect(unused, 'diálogos sin usar').toEqual([]);
  });

  it('se recorren todos, con todas las opciones, sin {claves} sueltas ni hablantes desconocidos', async () => {
    for (const [id, nodes] of Object.entries(dialogues))
      for (const c of CHARS)
        for (const pick of [0, 1, 2])
          for (const fl of flagSets) {
            const lines = await play(nodes, c, pick, { ...fl });
            for (const l of lines) {
              expect(l.text, `${id} (${c})`).not.toMatch(/\{\w+\}/);
              expect(l.text.length, `${id}: línea muy larga`).toBeLessThanOrEqual(260);
              if (l.who) expect(knownSpeaker(l.who, c), `${id}: ${l.who}`).toBe(true);
            }
          }
  });

  it('el final se cuenta desde los dos lados, y las hermanas no dicen "amor"', async () => {
    for (const n of [1, 2, 3]) for (const c of CHARS) expect(dialogues[`final_${c}_${n}`], `final_${c}_${n}`).toBeTruthy();
    for (const c of CHARS) expect(dialogues[`final_ponce_call_${c}`], `ponce ${c}`).toBeTruthy();
    for (const [id, nodes] of Object.entries(dialogues))
      for (const c of CHARS)
        for (const l of await play(nodes, c, 0, {})) if (['vero', 'caro', 'sister'].includes(l.who ?? '')) expect(l.text.toLowerCase(), id).not.toMatch(/\bamor\b/);
  });

  it('las condiciones sólo usan flags que alguien define', () => {
    const known = new Set<string>(['char', ...definedFlags(), ...ch1Carry.map((k) => `prev_${k}`)]);
    for (const src of [dialoguesSrc, finalsSrc, flowSrc])
      for (const m of src.matchAll(/\bif: '([^']+)'/g))
        for (const tok of m[1].split('&')) {
          const name = tok.trim().replace(/^!/, '').split(/!?=/)[0];
          expect(known.has(name), `flag sin definir en "${m[1]}": ${name}`).toBe(true);
        }
  });
});

describe('Capítulo 2 · radio y música', () => {
  const trackIds = new Set(tracks.map((t) => t.id));

  it('programas, ítems y pistas existen', () => {
    for (const [p, list] of Object.entries(radio.programs)) for (const id of list) expect(radio.items[id], `${p}: ${id}`).toBeTruthy();
    for (const id of radio.filler) expect(radio.items[id], `filler ${id}`).toBeTruthy();
    for (const it of Object.values(radio.items)) if (it.kind === 'music') expect(trackIds.has(it.track!), it.id).toBe(true);
  });

  it('el guion usa programas, flashes y músicas que existen', () => {
    for (const a of callArgs(flowSrc, 'program')) for (const id of ids(a)) expect(radio.programs[id], `programa ${id}`).toBeTruthy();
    for (const a of callArgs(flowSrc, 'flash')) for (const id of ids(a)) expect(radio.items[id], `flash ${id}`).toBeTruthy();
    for (const a of callArgs(flowSrc, 'music')) for (const id of ids(a)) expect(trackIds.has(id), `música ${id}`).toBe(true);
  });
});

describe('Capítulo 2 · registro y continuidad', () => {
  it('el título lista los capítulos en orden y sabe cuál sigue', () => {
    expect(content.chapterInfo.map((c) => c.id)).toEqual(['ch01', 'ch02']);
    expect(nextChapterId(content, 'ch01')).toBe('ch02');
    expect(nextChapterId(content, 'ch02')).toBeNull();
    expect(nextChapterId(content, 'nada')).toBeNull();
    for (const info of content.chapterInfo) expect(typeof content.chapters[info.id]).toBe('function');
  });

  it('el Capítulo 2 tiene final, tarjeta y reloj para los dos protagonistas', () => {
    expect(ch2IndexSrc).toMatch(/id: 'ch02'/);
    for (const c of CHARS) {
      expect(CONFIG2.ending[c], `final ${c}`).toBeTruthy();
      expect((CONFIG2.cards as Record<string, { blurb: string }>)[c]?.blurb, `tarjeta ${c}`).toBeTruthy();
      expect((CONFIG2.meaning as Record<string, unknown>)[c], `reloj ${c}`).toBeTruthy();
      expect((CONFIG2.meaning as Record<string, unknown>)[`${c}_late`], `reloj tardío ${c}`).toBeTruthy();
    }
  });

  it('lo que el Capítulo 2 deja para el 3 se define en el guion, y el 2 recuerda lo del 1', () => {
    const defined = definedFlags();
    expect(ch2Carry.length).toBeGreaterThan(0);
    for (const k of ch2Carry) expect(defined.has(k), `carry ${k}`).toBe(true);
    for (const k of ch1Carry.slice(0, 2)) expect(dialoguesSrc, `prev_${k}`).toContain(`prev_${k}`);
  });

  it('la sátira apunta a mecanismos: sin nombres reales de personas ni partidos', () => {
    const banned = /\b(vidal|grasso|kirchner|milei|macri|massa|carambia|bullrich|larreta|peronismo|justicialista|radicalismo|libertad avanza|cambiemos|pro macri)\b/i;
    for (const [name, src] of Object.entries({ dialoguesSrc, finalsSrc, flowSrc, radioSrc, configSrc, npcsSrc, interiorsSrc, citySrc, propsSrc }))
      expect(src, `${name} nombra a alguien real`).not.toMatch(banned);
  });
});
