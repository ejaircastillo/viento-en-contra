import { beforeAll, describe, expect, it } from 'vitest';
import { buildCity, type CityModel } from '../src/engine/world/CityBuilder';
import { cityPlan } from '../src/content/chapter01/city';
import { registerBrands } from '../src/content/brands';
import { registerInteriorProps } from '../src/content/chapter01/interiors';
import { measureText, wrapLine } from '../src/engine/assets/BitmapFont';
import { startSpot, uturnNeeded } from './roadsHelper';

const CHARS = ['municipal', 'emprendedor'];
const models: Record<string, CityModel> = {};

beforeAll(() => {
  registerBrands();
  registerInteriorProps();
  for (const c of CHARS) models[c] = buildCity(cityPlan(c));
});

/** ¿Hay ruta de GPS entre dos marcadores de auto? (considerando sólo los cortes conocidos). */
function hasRoute(m: CityModel, from: string, to: string): boolean {
  const a = m.markers.get(from)!.at;
  const start = m.roads.parkingSpot(a[0], a[1])!;
  const b = m.markers.get(to)!.at;
  return m.roads.parkingSpots(b[0], b[1]).some((g) => !!m.roads.route(start.edge.id, start.d, g.edge.id, g.d, true));
}

describe('ciudad del Capítulo 1', () => {
  it('se arma de forma determinista', () => {
    const again = buildCity(cityPlan('municipal'));
    expect(again.statics.length).toBe(models.municipal.statics.length);
  });

  it('los destinos del auto tienen lugar para estacionar y ruta', () => {
    const legs: [string, string][] = [
      ['home_car', 'school_car'],
      ['school_car', 'sister_car'],
      ['sister_car', 'an14_car'],
      ['an14_car', 'muni_car'],
      ['sister_car', 'muni_car'],
    ];
    for (const c of CHARS) {
      const m = models[c];
      for (const [a, b] of legs) {
        expect(m.roads.parkingSpots(...(m.markers.get(b)!.at as [number, number])).length, b).toBeGreaterThan(0);
        expect(hasRoute(m, a, b), `${c}: ${a} → ${b}`).toBe(true);
      }
    }
  });

  it('las escenas de manejo del Capítulo 1 arrancan del lado que mira hacia el destino', () => {
    const legs: [string, string][] = [
      ['home_car', 'school_car'],
      ['school_car', 'sister_car'],
      ['sister_car', 'an14_car'],
      ['sister_car', 'muni_car'],
      ['an14_car', 'muni_car'],
    ];
    for (const c of CHARS)
      for (const [a, b] of legs) {
        const spot = startSpot(models[c], a, b);
        expect(spot, `${c}: ${a} → ${b}`).toBeTruthy();
        expect(uturnNeeded(models[c], b, spot!), `${c}: ${a} → ${b} arranca con vuelta en U`).toBe(false);
      }
  });

  it('el cartel obligatorio de Patagonia Puede se lee completo', () => {
    const cap = models.municipal.captions.find((c) => c.text.includes('PATAGONIA PUEDE') && c.text.includes('DISTRIBUCIÓN 2'));
    expect(cap?.text).toBe('PATAGONIA PUEDE · PRÓXIMAMENTE · CENTRO DE DISTRIBUCIÓN 2');
    // y en la valla frontal cada renglón entra sin apretar letras
    for (const line of ['PATAGONIA PUEDE', 'PRÓXIMAMENTE', 'CENTRO DE', 'DISTRIBUCIÓN 2']) {
      const rows = wrapLine(line, 7 * 16 + 16 - 10 - 19);
      expect(rows.length).toBe(1);
      expect(rows[0].spacing).toBe(1);
      expect(measureText(rows[0].text, 1)).toBeGreaterThan(0);
    }
  });

  it('las sucursales de Acá Nomás tienen rótulo legible', () => {
    const suc = models.emprendedor.captions.filter((c) => c.text.startsWith('ACÁ NOMÁS · SUCURSAL'));
    expect(suc.map((c) => c.text).sort()).toEqual(['ACÁ NOMÁS · SUCURSAL 11', 'ACÁ NOMÁS · SUCURSAL 13', 'ACÁ NOMÁS · SUCURSAL 14']);
  });

  it('cada protagonista tiene su propia casa y el kiosco sólo existe para Nahuel', () => {
    const kiosk = (c: string) => models[c].statics.some((s) => s.id === 'kiosk_sign');
    expect(kiosk('emprendedor')).toBe(true);
    expect(kiosk('municipal')).toBe(false);
  });
});

describe('texto de carteles', () => {
  it('parte renglones largos por palabras antes de apretar letras', () => {
    const rows = wrapLine('LA QUE SE ESCUCHA AUNQUE SOPLE', 60);
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) expect(r.spacing).toBe(1);
  });
});
