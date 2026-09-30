import type { CityModel } from '../src/engine/world/CityBuilder';

type Spot = { edge: { id: number; opposite: number }; d: number };

/** ¿Arrancar desde este lugar de estacionamiento obliga a una vuelta en U para llegar a `to`? (mismo criterio que el GPS) */
export function uturnNeeded(city: CityModel, to: string, s: Spot): boolean {
  const at = city.markers.get(to)!.at as [number, number];
  const goals = city.roads.parkingSpots(...at);
  const cost = (edge: number, d: number, extra = 0) =>
    Math.min(...goals.map((g) => city.roads.route(edge, d, g.edge.id, g.d, true, extra)?.cost ?? Infinity));
  const direct = cost(s.edge.id, s.d);
  const opp = city.roads.edges[s.edge.opposite];
  const viaUturn = opp ? cost(opp.id, Math.max(0, opp.length - s.d), 6) : Infinity;
  return viaUturn < direct - 1;
}

/** Lugar donde arranca una escena de manejo con `car: { at: from, toward: to }`. */
export function startSpot(city: CityModel, from: string, to: string) {
  const a = city.markers.get(from)!.at as [number, number];
  const b = city.markers.get(to)!.at as [number, number];
  return city.roads.parkingSpotToward(a, b);
}
