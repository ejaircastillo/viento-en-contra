import { G, MK, LN, DECO, type GroundModel, type GroundId } from './ground';
import { RoadNetwork, parkingCoord } from './RoadNetwork';
import type {
  CityPlan,
  StreetInfo,
  StaticObject,
  SolidRect,
  MarkerDef,
  ZoneDef,
  PropDef,
  FenceDef,
  SignCaption,
} from './types';
import { Rng, hash2, hashStr } from '../core/math';
import { drawBuilding, buildingKey, type BuildingSpec, type BuildingDetail } from '../assets/gen/buildings';
import { propGen, propKey, vehicleKey } from './PropRegistry';

export interface Cable {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  z: number;
}

export interface SignalLight {
  inter: number;
  axis: 'x' | 'y';
  obj: StaticObject;
}

export interface CityModel {
  plan: CityPlan;
  w: number;
  h: number;
  ground: GroundModel;
  streets: StreetInfo[];
  /** Índice de calle por baldosa de calzada (-1 = ninguna). */
  streetGrid: Int16Array;
  statics: StaticObject[];
  solids: SolidRect[];
  solidGrid: Map<number, SolidRect[]>;
  /** 1 = caminable (para pathfinding). */
  walkGrid: Uint8Array;
  roads: RoadNetwork;
  markers: Map<string, MarkerDef>;
  zones: Map<string, ZoneDef>;
  cables: Cable[];
  lights: SignalLight[];
  /** Rótulos legibles de los carteles importantes (lectura ampliada). */
  captions: SignCaption[];
}

const WALLS_CENTER = ['wallCream', 'wallBeige', 'wallBlue', 'wallGreen', 'wallSalmon', 'wallYellow', 'wallGrey', 'wallWhite', 'brick', 'wallTeal'];
const WALLS_BARRIO = ['wallCream', 'wallBlue', 'wallGreen', 'wallSalmon', 'wallYellow', 'wallWhite', 'wallGrey', 'wallBeige'];
const ROOFS = ['roofRed', 'roofGreen', 'roofBlue', 'roofGrey', 'roofBrown', 'roofTeal', 'roofRed', 'roofGrey'];

type Orient = 'S' | 'E' | 'N' | 'W';

/** Genera (determinísticamente) una casa típica según orientación, tamaño y variante. */
export function houseSpec(orient: Orient, w: number, d: number, variant: number, barrio: boolean): BuildingSpec {
  const rng = new Rng(hashStr(`house:${orient}:${w}:${d}:${variant}:${barrio ? 1 : 0}`));
  const wall = rng.pick(barrio ? WALLS_BARRIO : WALLS_CENTER);
  const roofColor = rng.pick(ROOFS);
  const floors = !barrio && rng.chance(0.2) ? 2 : 1;
  let roof: BuildingSpec['roof'];
  if (orient === 'S') roof = rng.pick(barrio ? ['shed', 'shed', 'gableX'] : ['gableX', 'gableX', 'shed', 'flat']);
  else if (orient === 'E') roof = rng.pick(barrio ? ['gableY', 'flat'] : ['gableY', 'gableY', 'flat']);
  else if (orient === 'N') roof = rng.pick(['gableX', 'gableX', 'flat']);
  else roof = rng.pick(['gableY', 'flat']);
  const details: BuildingDetail[] = [];
  if (rng.chance(0.6)) details.push('gas');
  if (rng.chance(0.4)) details.push('chimney');
  if (rng.chance(0.3)) details.push('antenna');
  if (rng.chance(0.2)) details.push('dish');
  if (rng.chance(0.45)) details.push('reja');
  if (rng.chance(barrio ? 0.15 : 0.07)) details.push('graffiti');
  if (roof === 'flat' && rng.chance(0.5)) details.push('tank');
  const spec: BuildingSpec = {
    w,
    d,
    floors,
    wall,
    roof,
    roofColor,
    windows: floors === 2 ? 'normal' : rng.pick(['few', 'normal']),
    details,
    seed: variant * 31 + w * 7 + d,
  };
  if (wall === 'brick') spec.trim = 'wallCream';
  if (orient === 'S' || orient === 'E') {
    const faceLen = orient === 'S' ? w : d;
    const u = Math.max(0.375, Math.min(faceLen - 1, rng.pick([0.5, 0.75, faceLen - 1.25, faceLen / 2 - 0.25])));
    spec.door = { face: orient === 'S' ? 'L' : 'R', u: Math.round(u * 8) / 8 };
    spec.chiflonera = rng.chance(0.35) && faceLen >= 2.5 && u + 0.6 <= faceLen;
  }
  return spec;
}

function resolveStreets(plan: CityPlan): StreetInfo[] {
  const [W, H] = plan.size;
  return plan.streets.map((s, index) => {
    const lanes = s.lanes ?? 1;
    const median = s.median ?? 0;
    const parking = s.parking ?? true;
    const p = parking ? 1 : 0;
    return {
      id: s.id,
      name: s.name,
      axis: s.axis,
      at: s.at,
      lanes,
      median,
      parking,
      from: s.from ?? 0,
      to: s.to ?? (s.axis === 'x' ? W : H),
      sidewalk: s.sidewalk ?? 'paved',
      paved: s.paved ?? true,
      crosswalks: s.crosswalks ?? false,
      index,
      p,
      width: 2 * lanes + median + 2 * p,
    };
  });
}

export function buildCity(plan: CityPlan): CityModel {
  const [W, H] = plan.size;
  const N = W * H;
  const ground = new Uint8Array(N).fill(plan.base);
  const marks = new Uint8Array(N);
  const lanes = new Uint8Array(N);
  const deco = new Uint8Array(N);
  const streetGrid = new Int16Array(N).fill(-1);
  const reserved = new Uint8Array(N);
  const statics: StaticObject[] = [];
  const solids: SolidRect[] = [];
  const cables: Cable[] = [];
  const lights: SignalLight[] = [];
  const captions: SignCaption[] = [];
  const rng = new Rng(plan.seed);

  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H;
  const setG = (i: number, j: number, g: GroundId) => {
    if (inside(i, j)) ground[j * W + i] = g;
  };
  const getG = (i: number, j: number) => (inside(i, j) ? ground[j * W + i] : G.NONE);
  const rectFill = (x0: number, y0: number, x1: number, y1: number, g: GroundId) => {
    for (let j = Math.max(0, Math.floor(y0)); j < Math.min(H, Math.ceil(y1)); j++)
      for (let i = Math.max(0, Math.floor(x0)); i < Math.min(W, Math.ceil(x1)); i++) ground[j * W + i] = g;
  };
  const reserve = (x0: number, y0: number, x1: number, y1: number) => {
    for (let j = Math.max(0, Math.floor(y0)); j < Math.min(H, Math.ceil(y1)); j++)
      for (let i = Math.max(0, Math.floor(x0)); i < Math.min(W, Math.ceil(x1)); i++) reserved[j * W + i] = 1;
  };

  for (const r of plan.groundRects ?? []) rectFill(r.rect[0], r.rect[1], r.rect[2], r.rect[3], r.g);

  // ---------------------------------------------------------------- calles
  const streets = resolveStreets(plan);
  for (const s of streets) {
    if (s.sidewalk === 'none') continue;
    const g = s.sidewalk === 'dirt' ? G.SIDEWALK_DIRT : G.SIDEWALK;
    for (let t = Math.max(0, s.from - 1); t < Math.min(s.axis === 'x' ? W : H, s.to + 1); t++) {
      for (const off of [s.at - 1, s.at + s.width]) {
        const [i, j] = s.axis === 'x' ? [t, off] : [off, t];
        const cur = getG(i, j);
        if (cur !== G.WATER && cur !== G.ROAD && cur !== G.ROAD_DIRT) setG(i, j, g);
      }
    }
  }
  for (const s of streets) {
    const road = s.paved ? G.ROAD : G.ROAD_DIRT;
    for (let t = s.from; t < s.to; t++) {
      for (let k = 0; k < s.width; k++) {
        const [i, j] = s.axis === 'x' ? [t, s.at + k] : [s.at + k, t];
        if (!inside(i, j)) continue;
        const isMedian = s.median > 0 && k >= s.p + s.lanes && k < s.p + s.lanes + s.median;
        setG(i, j, isMedian ? G.MEDIAN : road);
        streetGrid[j * W + i] = s.index;
      }
    }
  }

  const roads = new RoadNetwork(streets, plan.signals ?? [], W, H);
  for (const I of roads.inters) {
    const paved = I.xs.paved || I.ys.paved;
    rectFill(I.x0, I.y0, I.x1, I.y1, paved ? G.ROAD : G.ROAD_DIRT);
  }
  const inInter = (i: number, j: number) => roads.inters.some((I) => i >= I.x0 && i < I.x1 && j >= I.y0 && j < I.y1);

  // líneas de carril
  for (const s of streets) {
    if (!s.paved) continue;
    const { at, p, lanes: L, median: m } = s;
    const rowsDash: [number, number][] = [];
    if (m === 0) rowsDash.push([at + p + L - 1, at + p + L]);
    if (L === 2) {
      rowsDash.push([at + p, at + p + 1]);
      rowsDash.push([at + p + L + m, at + p + L + m + 1]);
    }
    for (let t = s.from; t < s.to; t++) {
      for (const [a, b] of rowsDash) {
        const [ia, ja] = s.axis === 'x' ? [t, a] : [a, t];
        const [ib, jb] = s.axis === 'x' ? [t, b] : [b, t];
        if (!inside(ia, ja) || !inside(ib, jb)) continue;
        // no pintar dentro ni junto a cruces
        const near = [-1, 0, 1].some((dt) => {
          const [ci, cj] = s.axis === 'x' ? [t + dt, a] : [a, t + dt];
          return inInter(ci, cj);
        });
        if (near) continue;
        if (s.axis === 'x') {
          lanes[ja * W + ia] |= LN.PY;
          lanes[jb * W + ib] |= LN.NY;
        } else {
          lanes[ja * W + ia] |= LN.PX;
          lanes[jb * W + ib] |= LN.NX;
        }
      }
    }
  }

  // sendas peatonales y líneas de detención
  for (const I of roads.inters) {
    const X = I.xs;
    const Y = I.ys;
    const want = !!I.signal || X.crosswalks || Y.crosswalks;
    if (!want || !(X.paved && Y.paved)) continue;
    const eRows: number[] = [];
    const wRows: number[] = [];
    for (let k = 0; k < X.lanes; k++) {
      eRows.push(X.at + X.p + X.lanes + X.median + k);
      wRows.push(X.at + X.p + k);
    }
    const sCols: number[] = [];
    const nCols: number[] = [];
    for (let k = 0; k < Y.lanes; k++) {
      sCols.push(Y.at + Y.p + k);
      nCols.push(Y.at + Y.p + Y.lanes + Y.median + k);
    }
    const mark = (i: number, j: number, bit: number) => {
      if (inside(i, j) && (ground[j * W + i] === G.ROAD || ground[j * W + i] === G.MEDIAN)) marks[j * W + i] |= bit;
    };
    if (X.from < I.x0 - 1) {
      for (let j = I.y0; j < I.y1; j++) mark(I.x0 - 1, j, MK.CW_X);
      for (const j of eRows) mark(I.x0 - 1, j, MK.STOP_NX);
    }
    if (X.to > I.x1 + 1) {
      for (let j = I.y0; j < I.y1; j++) mark(I.x1, j, MK.CW_X);
      for (const j of wRows) mark(I.x1, j, MK.STOP_PX);
    }
    if (Y.from < I.y0 - 1) {
      for (let i = I.x0; i < I.x1; i++) mark(i, I.y0 - 1, MK.CW_Y);
      for (const i of sCols) mark(i, I.y0 - 1, MK.STOP_NY);
    }
    if (Y.to > I.y1 + 1) {
      for (let i = I.x0; i < I.x1; i++) mark(i, I.y1, MK.CW_Y);
      for (const i of nCols) mark(i, I.y1, MK.STOP_PY);
    }
  }

  // ---------------------------------------------------------------- estáticos
  const addSolid = (x0: number, y0: number, x1: number, y1: number, ref?: StaticObject) => {
    solids.push({ x0, y0, x1, y1, ref });
  };

  const addBuilding = (spec: BuildingSpec, x: number, y: number, id?: string, tag?: string) => {
    const obj: StaticObject = {
      id,
      tag,
      kind: 'building',
      texKey: buildingKey(spec),
      gen: () => drawBuilding(spec),
      x,
      y,
      fp: [spec.w, spec.d],
      solid: true,
    };
    statics.push(obj);
    addSolid(x, y, x + spec.w, y + spec.d, obj);
    reserve(x, y, x + spec.w, y + spec.d);
    return obj;
  };

  const addProp = (pd: PropDef): StaticObject => {
    const gen = propGen(pd.type);
    const params = pd.params ?? {};
    const isVehicle = pd.type === 'vehicle';
    const obj: StaticObject = {
      id: pd.id,
      tag: pd.tag,
      kind: 'prop',
      texKey: isVehicle ? vehicleKey(params.look) : propKey(pd.type, params),
      gen: () => gen(params),
      x: pd.at[0],
      y: pd.at[1],
      fp: pd.fp,
      solid: pd.solid ?? false,
      anim: pd.anim,
      flipX: pd.flipX,
      hidden: pd.hidden,
      frame: isVehicle ? (params.dir ?? 0) : undefined,
      bias: isVehicle ? 0.3 : undefined,
    };
    if (pd.type === 'pole') obj.cableTop = 34;
    statics.push(obj);
    if (obj.solid) {
      if (pd.fp) addSolid(pd.at[0], pd.at[1], pd.at[0] + pd.fp[0], pd.at[1] + pd.fp[1], obj);
      else if (isVehicle) {
        const horiz = (params.dir ?? 0) % 4 === 0;
        const hx = horiz ? 0.62 : 0.3;
        const hy = horiz ? 0.3 : 0.62;
        addSolid(pd.at[0] - hx, pd.at[1] - hy, pd.at[0] + hx, pd.at[1] + hy, obj);
      } else addSolid(pd.at[0] - 0.14, pd.at[1] - 0.14, pd.at[0] + 0.14, pd.at[1] + 0.14, obj);
    }
    return obj;
  };

  const addFence = (f: FenceDef) => {
    const gates = [...(f.gates ?? [])].sort((a, b) => a - b);
    const runs: [number, number][] = [];
    let start = 0;
    for (const g of gates) {
      if (g - start > 0.01) runs.push([start, g]);
      start = g + 1;
    }
    if (f.len - start > 0.01) runs.push([start, f.len]);
    // tramos de hasta 6 baldosas (texturas chicas y orden por tiras más preciso)
    const pieces: [number, number][] = [];
    for (const [a0, b0] of runs) {
      for (let a = a0; a < b0 - 0.01; a += 6) pieces.push([a, Math.min(b0, a + 6)]);
    }
    for (const [a, b] of pieces) {
      const len = b - a;
      const x = f.axis === 'x' ? f.at[0] + a : f.at[0];
      const y = f.axis === 'y' ? f.at[1] + a : f.at[1];
      const params = { axis: f.axis, kind: f.kind, color: f.color, len, stencil: f.stencil };
      const obj: StaticObject = {
        kind: 'prop',
        texKey: propKey('fence', params),
        gen: () => propGen('fence')(params),
        x,
        y,
        fp: f.axis === 'x' ? [len, 0.06] : [0.06, len],
        solid: true,
      };
      statics.push(obj);
      if (f.axis === 'x') addSolid(x, y - 0.04, x + len, y + 0.1, obj);
      else addSolid(x - 0.04, y, x + 0.1, y + len, obj);
    }
  };

  // lotes explícitos
  for (const lot of plan.lots) {
    if (lot.yard) {
      rectFill(lot.yard[0], lot.yard[1], lot.yard[2], lot.yard[3], lot.yardGround ?? G.YARD);
      reserve(lot.yard[0], lot.yard[1], lot.yard[2], lot.yard[3]);
    }
    addBuilding({ ...lot.building, w: lot.size[0], d: lot.size[1] }, lot.at[0], lot.at[1], lot.id, lot.tag);
    (lot.building.signs ?? []).forEach((sg, i) => {
      if (!sg.caption) return;
      const [w, d] = lot.size;
      const mid = (sg.u0 + sg.u1) / 2;
      // cara L = +y (u a lo largo de x); cara R = +x (u a lo largo de y)
      const x = sg.face === 'R' ? lot.at[0] + w : lot.at[0] + mid;
      const y = sg.face === 'R' ? lot.at[1] + mid : lot.at[1] + d;
      captions.push({ key: `lot:${lot.id ?? lot.at.join(',')}:${i}`, x, y, z: sg.z1 + 4, text: sg.caption, bg: sg.bg ?? 'white', fg: sg.bg ? sg.fg : 'ink' });
    });
  }
  for (const ex of plan.autoFill?.exclude ?? []) reserve(ex[0], ex[1], ex[2], ex[3]);
  for (const f of plan.fences ?? []) addFence(f);
  for (const pd of plan.props) {
    addProp(pd);
    if (pd.caption) {
      const c = typeof pd.caption === 'string' ? { text: pd.caption } : pd.caption;
      const x = pd.fp ? pd.at[0] + pd.fp[0] / 2 : pd.at[0];
      const y = pd.fp ? pd.at[1] + pd.fp[1] / 2 : pd.at[1];
      captions.push({ key: `prop:${pd.id ?? pd.type}:${pd.at.join(',')}`, x, y, z: c.z ?? 30, text: c.text, bg: c.bg ?? pd.params?.bg ?? 'slate8', fg: c.fg ?? pd.params?.fg ?? 'white' });
    }
    if (pd.fp) reserve(pd.at[0], pd.at[1], pd.at[0] + pd.fp[0], pd.at[1] + pd.fp[1]);
  }

  // ---------------------------------------------------------------- relleno de manzanas
  const xs = streets.filter((s) => s.axis === 'y').sort((a, b) => a.at - b.at);
  const ys = streets.filter((s) => s.axis === 'x').sort((a, b) => a.at - b.at);
  const isBarrio = (x: number, y: number) =>
    (plan.autoFill?.barrioRects ?? []).some((r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3]);
  const isEmpty = (x: number, y: number) =>
    (plan.autoFill?.empty ?? []).some((r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3]);
  const isUniform = (x: number, y: number) =>
    (plan.autoFill?.uniform ?? []).some((r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3]);
  const free = (x0: number, y0: number, x1: number, y1: number) => {
    for (let j = y0; j < y1; j++)
      for (let i = x0; i < x1; i++) {
        if (!inside(i, j)) return false;
        if (reserved[j * W + i]) return false;
        const g = ground[j * W + i];
        if (g !== plan.base && g !== G.YARD && g !== G.LOT && g !== G.STEPPE && g !== G.DIRT) return false;
      }
    return true;
  };

  const fillProps: PropDef[] = [];

  const fenceKind = (barrio: boolean): FenceDef['kind'] | null => {
    const r = rng.next();
    if (barrio) return r < 0.4 ? 'wire' : r < 0.7 ? 'picket' : r < 0.8 ? 'chapa' : null;
    return r < 0.4 ? 'reja' : r < 0.65 ? 'picket' : r < 0.85 ? 'wall' : null;
  };

  const placeHouse = (orient: Orient, lx0: number, ly0: number, lx1: number, ly1: number, barrio: boolean, uniform = false) => {
    // (lx0..lx1, ly0..ly1) = lote completo incluyendo patio delantero de 1 baldosa
    if (!free(lx0, ly0, lx1, ly1)) return;
    rectFill(lx0, ly0, lx1, ly1, barrio && !uniform && rng.chance(0.4) ? G.DIRT : G.YARD);
    const lw = lx1 - lx0;
    const ld = ly1 - ly0;
    const variant = uniform ? 0 : rng.int(0, 5);
    let bx = lx0;
    let by = ly0;
    let bw = lw;
    let bd = ld;
    const side = uniform ? 0 : rng.chance(0.5) ? 0.25 : 0;
    if (orient === 'S') {
      bd = ld - 1;
      bw = lw - side;
      bx = lx0 + (rng.chance(0.5) ? side : 0);
    } else if (orient === 'N') {
      by = ly0 + 1;
      bd = ld - 1;
      bw = lw - side;
    } else if (orient === 'E') {
      bw = lw - 1;
      bd = ld - side;
    } else {
      bx = lx0 + 1;
      bw = lw - 1;
      bd = ld - side;
    }
    const spec = houseSpec(orient, bw, bd, variant, barrio);
    addBuilding(spec, bx, by);
    reserve(lx0, ly0, lx1, ly1);
    // cerco con portón frente a la puerta
    const fk = uniform ? 'wire' : fenceKind(barrio);
    if (fk) {
      if (orient === 'S' || orient === 'N') {
        const gate = spec.door ? Math.max(0, Math.min(lw - 1, Math.floor(bx - lx0 + spec.door.u))) : Math.floor(lw / 2);
        addFence({ axis: 'x', at: [lx0, orient === 'S' ? ly1 - 0.06 : ly0], len: lw, kind: fk, gates: [gate] });
      } else {
        const gate = spec.door ? Math.max(0, Math.min(ld - 1, Math.floor(by - ly0 + spec.door.u))) : Math.floor(ld / 2);
        addFence({ axis: 'y', at: [orient === 'E' ? lx1 - 0.06 : lx0, ly0], len: ld, kind: fk, gates: [gate] });
      }
    }
  };

  for (let bi = 0; bi + 1 < xs.length; bi++) {
    for (let bj = 0; bj + 1 < ys.length; bj++) {
      const A = xs[bi];
      const B = xs[bi + 1];
      const Cs = ys[bj];
      const D = ys[bj + 1];
      const bx0 = A.at + A.width + 1;
      const bx1 = B.at - 1;
      const by0 = Cs.at + Cs.width + 1;
      const by1 = D.at - 1;
      if (bx1 - bx0 < 4 || by1 - by0 < 4) continue;
      const midx = (bx0 + bx1) / 2;
      const midy = (by0 + by1) / 2;
      const barrio = isBarrio(midx, midy);
      if (isEmpty(midx, midy)) {
        for (let j = by0; j < by1; j++)
          for (let i = bx0; i < bx1; i++) {
            if (!reserved[j * W + i] && free(i, j, i + 1, j + 1)) {
              ground[j * W + i] = G.LOT;
              const hh = hash2(i, j, plan.seed + 77);
              if (hh < 0.07) fillProps.push({ type: 'coiron', at: [i + 0.5, j + 0.5], params: { seed: (hh * 1e6) | 0 }, anim: { fps: 2 } });
              else if (hh < 0.09) fillProps.push({ type: 'bush', at: [i + 0.5, j + 0.5], params: { seed: (hh * 1e6) | 0 } });
            }
          }
        continue;
      }
      const depth = 4; // casa 3 + patio 1
      const uniform = isUniform(midx, midy);
      const row = (y0: number, y1: number, orient: 'S' | 'N') => {
        let x = bx0;
        while (x < bx1) {
          let lw = uniform ? 4 : rng.chance(0.5) ? 3 : 4;
          if (bx1 - (x + lw) < 2) lw = bx1 - x;
          if (lw < 2) break;
          placeHouse(orient, x, y0, x + lw, y1, barrio || uniform, uniform && lw === 4);
          x += lw;
        }
      };
      row(by1 - depth, by1, 'S');
      if (by1 - by0 >= depth * 2) row(by0, by0 + depth, 'N');
      const cy0 = by0 + (by1 - by0 >= depth * 2 ? depth : 0);
      const cy1 = by1 - depth;
      const col = (x0: number, x1: number, orient: 'E' | 'W') => {
        let y = cy0;
        while (y < cy1) {
          let ld = rng.chance(0.5) ? 3 : 2;
          if (cy1 - (y + ld) < 2) ld = cy1 - y;
          if (ld < 2) break;
          placeHouse(orient, x0, y, x1, y + ld, barrio);
          y += ld;
        }
      };
      if (bx1 - bx0 >= 8 && cy1 - cy0 >= 2) {
        col(bx1 - depth, bx1, 'E');
        col(bx0, bx0 + depth, 'W');
      }
      // fondos: patio con árboles, tendederos y galpones
      for (let j = by0; j < by1; j++)
        for (let i = bx0; i < bx1; i++) {
          if (reserved[j * W + i]) continue;
          if (!free(i, j, i + 1, j + 1)) continue;
          ground[j * W + i] = barrio && hash2(i, j, 5) < 0.4 ? G.DIRT : G.YARD;
          const hh = hash2(i, j, plan.seed + 91);
          if (hh < 0.12) fillProps.push({ type: 'alamo', at: [i + 0.5, j + 0.5], params: { seed: (hh * 1e6) | 0, bare: hh < 0.05, h: 30 + ((hh * 400) | 0) % 14 }, anim: { fps: 1.5 }, solid: true });
          else if (hh < 0.18 && i + 1 < bx1 && !reserved[j * W + i + 1] && free(i, j, i + 2, j + 1)) {
            reserved[j * W + i + 1] = 1;
            fillProps.push({ type: 'clothesline', at: [i + 0.1, j + 0.5], params: { axis: 'x', seed: (hh * 1e6) | 0 }, fp: [1.8, 0.06], anim: { fps: 3 } });
          }
          else if (hh < 0.21) fillProps.push({ type: 'bush', at: [i + 0.5, j + 0.5], params: { seed: (hh * 1e6) | 0 } });
        }
    }
  }
  // props agregados por el relleno (no se modifica el plano original)
  for (const pd of fillProps) addProp(pd);

  // ---------------------------------------------------------------- mobiliario automático
  const ap = plan.autoProps ?? { poles: true, signs: true, trees: false };
  if (ap.poles) {
    for (const s of streets) {
      if (s.sidewalk === 'none') continue;
      const row = s.at + s.width;
      const poles: [number, number][] = [];
      for (let t = s.from + 2; t < s.to - 1; t += 6) {
        const [i, j] = s.axis === 'x' ? [t, row] : [row, t];
        if (!inside(i, j)) continue;
        const g = getG(i, j);
        if (g !== G.SIDEWALK && g !== G.SIDEWALK_DIRT) continue;
        if ([-1, 0, 1].some((dt) => (s.axis === 'x' ? inInter(t + dt, s.at) : inInter(s.at, t + dt)))) continue;
        const px = s.axis === 'x' ? i + 0.5 : i + 0.25;
        const py = s.axis === 'x' ? j + 0.25 : j + 0.5;
        if (solids.some((r) => px > r.x0 - 0.3 && px < r.x1 + 0.3 && py > r.y0 - 0.3 && py < r.y1 + 0.3)) continue;
        poles.push([px, py]);
        addProp({ type: 'pole', at: [px, py], params: { axis: s.axis }, solid: true });
      }
      for (let k = 1; k < poles.length; k++) {
        const [ax, ay] = poles[k - 1];
        const [bx, by] = poles[k];
        if (Math.hypot(bx - ax, by - ay) <= 7.5) cables.push({ ax, ay, bx, by, z: 34 });
      }
    }
  }
  if (ap.signs) {
    for (const I of roads.inters) {
      if (I.signal) {
        const corners: [number, number, 'x' | 'y'][] = [
          [I.x0 - 0.35, I.y0 - 0.35, 'x'],
          [I.x1 + 0.35, I.y1 + 0.35, 'x'],
          [I.x1 + 0.35, I.y0 - 0.35, 'y'],
          [I.x0 - 0.35, I.y1 + 0.35, 'y'],
        ];
        for (const [x, y, axis] of corners) {
          const obj = addProp({ type: 'tlight', at: [x, y], solid: true });
          lights.push({ inter: I.id, axis, obj });
        }
      } else {
        const sx = I.x1 + 0.4;
        const sy = I.y1 + 0.4;
        if (getG(Math.floor(sx), Math.floor(sy)) === G.SIDEWALK) addProp({ type: 'streetsign', at: [sx, sy], solid: true });
        const px = I.x0 - 0.4;
        const py = I.y1 + 0.4;
        const minorIsY = I.ys.lanes <= I.xs.lanes;
        if (minorIsY && getG(Math.floor(px), Math.floor(py)) === G.SIDEWALK) addProp({ type: 'pare', at: [px, py], solid: true });
      }
    }
  }

  // ---------------------------------------------------------------- autos estacionados
  if (plan.parked && plan.parked.looks.length) {
    // se reservan ambos lados de la calle en cada destino del auto del jugador
    const reservedSpots: [number, number][] = [];
    for (const [k, m] of Object.entries(plan.markers)) {
      if (!(k.endsWith('_car') || k.startsWith('car_'))) continue;
      reservedSpots.push(m.at);
      for (const s of roads.parkingSpots(m.at[0], m.at[1])) reservedSpots.push([s.px, s.py]);
    }
    const DIR8: Record<string, number> = { E: 0, S: 2, W: 4, N: 6 };
    for (const e of roads.edges) {
      if (e.kind !== 'lane' || e.lane !== 0 || !e.street?.parking || roads.blocked.has(e.id)) continue;
      const pc = parkingCoord(e.street, e.dir)!;
      const lo = Math.min(e.span[0], e.span[1]) + 1.4;
      const hi = Math.max(e.span[0], e.span[1]) - 1.4;
      for (let t = lo; t < hi; t += 1.6) {
        const hh = hash2(Math.floor(t * 10), e.id, plan.seed + 5);
        if (hh > plan.parked.density) continue;
        const x = e.street.axis === 'x' ? t : pc;
        const y = e.street.axis === 'x' ? pc : t;
        if (reservedSpots.some(([rx, ry]) => Math.hypot(rx - x, ry - y) < 2.6)) continue;
        const look = plan.parked.looks[Math.floor(hh * 1000) % plan.parked.looks.length];
        addProp({ type: 'vehicle', at: [x, y], params: { look, dir: DIR8[e.dir] }, solid: true });
        t += 0.4;
      }
    }
  }

  // ---------------------------------------------------------------- decoración de suelo
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const idx = j * W + i;
      const g = ground[idx];
      const hh = hash2(i, j, plan.seed + 3);
      if (g === G.ROAD && !inInter(i, j)) {
        if (hh < 0.015) deco[idx] = DECO.POTHOLE;
        else if (hh < 0.04) deco[idx] = DECO.PATCH;
        else if (hh < 0.05) deco[idx] = DECO.MANHOLE;
        else if (hh < 0.07) deco[idx] = DECO.CRACK;
        else if (hh < 0.08) deco[idx] = DECO.OIL;
        else if (hh < 0.1) deco[idx] = DECO.PUDDLE;
      } else if (g === G.ROAD && inInter(i, j)) {
        if (hh < 0.2) deco[idx] = DECO.TIRE;
      } else if (g === G.STEPPE) {
        if (hh < 0.05) deco[idx] = DECO.SNOW;
        else if (hh < 0.08) deco[idx] = DECO.TRASH;
      } else if (g === G.YARD) {
        if (hh < 0.03) deco[idx] = DECO.SNOW;
      } else if (g === G.SIDEWALK) {
        if (hh < 0.02) deco[idx] = DECO.SNOW;
        else if (hh < 0.05) deco[idx] = DECO.CRACK;
      }
    }
  }
  for (const d of plan.deco ?? []) {
    const [i, j] = d.at;
    if (inside(i, j)) deco[j * W + i] = d.code;
  }

  // estepa: matas de coirón
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      if (ground[j * W + i] !== G.STEPPE || reserved[j * W + i]) continue;
      const hh = hash2(i, j, plan.seed + 17);
      if (hh < 0.05) addProp({ type: 'coiron', at: [i + 0.3 + (hh * 7) % 0.4, j + 0.5], params: { seed: (hh * 1e6) | 0 }, anim: { fps: 2 } });
      else if (hh < 0.065) addProp({ type: 'bush', at: [i + 0.5, j + 0.5], params: { seed: (hh * 1e6) | 0, color: '#5a5a3a' } });
    }
  }

  // ---------------------------------------------------------------- grillas de colisión
  const solidGrid = new Map<number, SolidRect[]>();
  for (const r of solids) {
    for (let j = Math.floor(r.y0); j <= Math.floor(r.y1); j++)
      for (let i = Math.floor(r.x0); i <= Math.floor(r.x1); i++) {
        if (!inside(i, j)) continue;
        const k = j * W + i;
        let arr = solidGrid.get(k);
        if (!arr) solidGrid.set(k, (arr = []));
        arr.push(r);
      }
  }
  const walkGrid = new Uint8Array(N);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const g = ground[j * W + i];
      let ok = g !== G.WATER && g !== G.NONE;
      if (ok) {
        const cx = i + 0.5;
        const cy = j + 0.5;
        const arr = solidGrid.get(j * W + i);
        if (arr && arr.some((r) => cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1)) ok = false;
      }
      walkGrid[j * W + i] = ok ? 1 : 0;
    }

  // bloqueos estáticos del plano (obras, accidentes, cortes)
  for (const b of plan.blocks ?? []) roads.blockStreet(b.street, b.from, b.to, !!b.known);
  for (const b of plan.blockedInters ?? []) roads.blockIntersection(b.key, !!b.known);

  const markers = new Map<string, MarkerDef>(Object.entries(plan.markers));
  const zones = new Map<string, ZoneDef>(plan.zones.map((z) => [z.id, z]));

  return {
    plan,
    w: W,
    h: H,
    ground: { w: W, h: H, seed: plan.seed, ground, marks, lanes, deco },
    streets,
    streetGrid,
    statics,
    solids,
    solidGrid,
    walkGrid,
    roads,
    markers,
    zones,
    cables,
    lights,
    captions,
  };
}

/** Rectángulos sólidos cerca de un punto (para colisión de caminata). */
export function solidsNear(m: { w: number; h: number; solidGrid: Map<number, SolidRect[]> }, x: number, y: number, r: number): SolidRect[] {
  const out = new Set<SolidRect>();
  for (let j = Math.floor(y - r) - 1; j <= Math.floor(y + r) + 1; j++)
    for (let i = Math.floor(x - r) - 1; i <= Math.floor(x + r) + 1; i++) {
      if (i < 0 || j < 0 || i >= m.w || j >= m.h) continue;
      const arr = m.solidGrid.get(j * m.w + i);
      if (arr) for (const s of arr) out.add(s);
    }
  return [...out];
}
