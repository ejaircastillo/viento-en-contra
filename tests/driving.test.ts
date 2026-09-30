import { beforeAll, describe, expect, it } from 'vitest';
import { buildCity, type CityModel } from '../src/engine/world/CityBuilder';
import { cityPlan } from '../src/content/chapter01/city';
import { registerBrands } from '../src/content/brands';
import { registerInteriorProps } from '../src/content/chapter01/interiors';
import { VehicleSystem, type PlayerIntent, type Vehicle } from '../src/engine/vehicles/Vehicles';
import type { LaneEdge } from '../src/engine/world/RoadNetwork';

// Escena y assets de mentira: la lógica de manejo no necesita dibujar.
function stub(): any {
  const o: any = {};
  for (const m of ['setOrigin', 'setFrame', 'setPosition', 'setDepth', 'setVisible', 'destroy', 'setCrop']) o[m] = () => o;
  return o;
}
const scene: any = { add: { image: stub, rectangle: stub } };
const assets: any = { ensure: () => ({ texture: 't', frames: Array.from({ length: 16 }, (_, i) => i), ax: 8, ay: 8, w: 16, h: 16 }) };
const GAS: PlayerIntent = { move: { x: 0, y: 0 }, pedal: 1, followRoute: false, autopilot: false };

let m: CityModel;
let vs: VehicleSystem;
let v: Vehicle;

beforeAll(() => {
  registerBrands();
  registerInteriorProps();
  m = buildCity(cityPlan('municipal'));
});

function freshCar(lane: LaneEdge, d: number): void {
  vs = new VehicleSystem(scene, m.roads, assets, []);
  vs.trafficEnabled = false;
  v = vs.createPlayerCar({ model: 'sedan', body: 'carBlue' }, { edge: lane, d }, false);
  vs.startDriving();
}

function drive(frames: number, intent = GAS): void {
  for (let i = 0; i < frames; i++) vs.update(1 / 60, intent, { x: v.x, y: v.y }, 20);
}

/** Un carril libre con cruce que tenga salidas laterales a ambos lados. */
function crossingLane(): LaneEdge {
  const lane = m.roads.edges.find(
    (e) =>
      e.kind === 'lane' &&
      e.inter >= 0 &&
      e.length > 8 &&
      !m.roads.blocked.has(e.id) &&
      ['left', 'right'].every((t) => e.next.some((n) => m.roads.edges[n].turn === t && !m.roads.isBlocked(m.roads.edges[n]))),
  );
  if (!lane) throw new Error('no hay carril de prueba');
  return lane;
}

describe('elegir la calle en la esquina', () => {
  it('las dos salidas laterales quedan a lados opuestos de la pantalla', () => {
    freshCar(crossingLane(), 0);
    let checked = 0;
    for (const e of m.roads.edges.filter((x) => x.kind === 'lane' && x.inter >= 0)) {
      const lat = e.next.map((n) => m.roads.edges[n]).filter((x) => x.turn === 'left' || x.turn === 'right');
      if (lat.length !== 2) continue;
      expect(vs.sideOf(lat[0])).not.toBe(vs.sideOf(lat[1]));
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('pedido antes de la esquina: marca el guiño y dobla solo al llegar', () => {
    for (const side of ['left', 'right'] as const) {
      const lane = crossingLane();
      freshCar(lane, lane.length - 5);
      expect(vs.requestTurn(v, side)).toBe('ok');
      const exit = m.roads.edges[v.signalExit!];
      expect(vs.sideOf(exit)).toBe(side);
      expect(vs.plannedExit(v, lane, GAS)).toBe(exit.id);
      drive(20);
      expect(v.blinkSide).not.toBeNull();
      for (let i = 0; i < 600 && v.edge.id !== exit.target; i++) drive(1);
      expect(v.edge.id).toBe(exit.target);
    }
  });

  it('sin pedir nada sigue derecho', () => {
    const lane = crossingLane();
    freshCar(lane, lane.length - 3);
    const straight = lane.next.map((n) => m.roads.edges[n]).find((e) => e.turn === 'straight')!;
    for (let i = 0; i < 600 && v.edge.kind === 'lane' && v.edge.id === lane.id; i++) drive(1);
    expect(v.edge.id).toBe(straight.id);
  });

  it('apretar dos veces el mismo lado cancela', () => {
    const lane = crossingLane();
    freshCar(lane, 1);
    expect(vs.requestTurn(v, 'left')).toBe('ok');
    expect(vs.requestTurn(v, 'left')).toBe('cancel');
    expect(v.signalExit).toBeNull();
  });

  it('giro tardío: recién entrado derecho al cruce todavía dobla', () => {
    const lane = crossingLane();
    freshCar(lane, lane.length - 2);
    for (let i = 0; i < 600 && v.edge.kind === 'lane'; i++) drive(1);
    expect(v.edge.turn).toBe('straight');
    expect(vs.requestTurn(v, 'right')).toBe('late');
    expect(v.edge.turn === 'left' || v.edge.turn === 'right').toBe(true);
    expect(vs.sideOf(v.edge)).toBe('right');
  });

  it('tocar la flecha de una calle la elige', () => {
    const lane = crossingLane();
    freshCar(lane, 2);
    const left = lane.next.map((n) => m.roads.edges[n]).find((e) => e.turn === 'left')!;
    expect(vs.pickExit(v, left.id)).toBe('ok');
    expect(vs.plannedExit(v, lane, GAS)).toBe(left.id);
  });

  it('con conducción asistida sigue la ruta del GPS', () => {
    const lane = crossingLane();
    freshCar(lane, 2);
    const right = lane.next.map((n) => m.roads.edges[n]).find((e) => e.turn === 'right')!;
    v.route = [lane.id, right.id, right.target];
    expect(vs.plannedExit(v, lane, { ...GAS, followRoute: true })).toBe(right.id);
    expect(vs.plannedExit(v, lane, GAS)).not.toBe(right.id);
  });
});
