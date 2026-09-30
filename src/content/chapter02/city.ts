import type { CityPlan, PropDef } from '../../engine/world/types';
import { cityPlan as cityPlanCh1 } from '../chapter01/city';
import { acaNomasStore } from '../brands';
import type { StallParams } from './props';

/**
 * Río Gallegos, jueves. Es la misma ciudad del Capítulo 1 (datos clonados y ajustados, sin tocar el
 * motor): el choque ya se retiró, la valla del túnel de viento está caída, la costanera tiene la Feria de
 * Emprendedores y Acá Nomás inauguró la sucursal 15 en la ex farmacia. La casa del kiosco es el destino
 * de los dos protagonistas, así que el plano es el mismo para ambos.
 */

export const FAIR_BOUNDS: [number, number, number, number] = [50.5, 5.6, 86.5, 14.9];

const stall = (id: string, x: number, p: StallParams, cap: string, bg: string): PropDef => ({
  id,
  type: 'stall',
  at: [x, 7.2],
  params: p,
  fp: [2.2, 0.9],
  solid: true,
  anim: { fps: 1.3 },
  caption: { text: cap, bg, fg: 'white', z: 62 },
});

export function cityPlan(): CityPlan {
  const base = cityPlanCh1('emprendedor');
  const removeIds = new Set(['crash_a', 'crash_b', 'transito_car', 'desvio_a', 'desvio_b', 'hat']);
  // lo que quedó del choque del miércoles (conos, vallas, cartel de desvío en San Martín)
  const wreckage = (p: PropDef) =>
    p.at[0] < 34 && p.at[1] > 42 && p.at[1] < 61.5 && ['cone', 'barrier', 'pl_desvio', 'vehicle'].includes(p.type);
  // la franja de la costanera donde va la feria: sin álamos, bancos, faroles ni flamencos
  const fairStrip = (p: PropDef) => p.at[0] >= 49 && p.at[0] <= 89 && p.at[1] < 9.6 && ['alamo', 'bench', 'streetlight', 'flamingo'].includes(p.type);
  // la protesta del bache del miércoles (carteles frente a Acá Nomás) se levantó: hoy ahí va la inauguración
  const protest = (p: PropDef) => p.type === 'pl_bache' || p.type === 'pl_pp_bacheo';
  const props = base.props.filter((p) => !(p.id && removeIds.has(p.id)) && !wreckage(p) && !fairStrip(p) && !protest(p));

  props.push(
    // ---------------------------------------------------------- Feria de Emprendedores (costanera)
    stall('st_nelly', 52.4, { awning: 'wallTeal', goods: 'wool', line1: 'TEJIDOS', line2: 'NELLY' }, 'TEJIDOS NELLY', 'wallTeal'),
    stall('st_lucas', 56.0, { awning: 'mustard', goods: 'alfajores', line1: 'ALFAJORES', line2: 'DEL VIENTO' }, 'ALFAJORES DEL VIENTO', 'brown'),
    stall('st_vero', 59.6, { awning: 'purple', goods: 'hair', line1: 'VERO', line2: 'ESTILO' }, 'VERO ESTILO · PEINADOS AL PASO', 'purple'),
    { id: 'stage', type: 'stage', at: [63.6, 6.0], fp: [5.5, 2.2], solid: true, caption: { text: 'FERIA DE EMPRENDEDORES · CIUDAD EN MOVIMIENTO', bg: 'muniTeal', fg: 'white', z: 72 } },
    stall('st_tito', 70.6, { awning: 'red', goods: 'brooms', line1: 'ESCOBAS', line2: 'DON TITO' }, 'ESCOBAS DON TITO · "ANTI-VIENTO"', 'red'),
    stall('st_marta', 74.2, { awning: 'green', goods: 'mate', line1: 'MATES', line2: 'Y TERMOS' }, 'MATES Y TERMOS', 'green'),
    {
      id: 'rig',
      type: 'test_rig',
      at: [78.4, 7.0],
      fp: [3.4, 1.4],
      solid: true,
      anim: { fps: 5 },
      caption: { text: 'ESTACIÓN MÓVIL DE ENSAYOS EÓLICOS · PATAGONIA PUEDE', bg: 'ppNavy', fg: 'white', z: 68 },
    },
    { id: 'tunnel', type: 'tunnel_wreck', at: [83.4, 6.6], fp: [3.8, 1.5], solid: true, caption: { text: 'TÚNEL DE VIENTO · FUERA DE SERVICIO', bg: 'slate8', fg: 'hazard', z: 46 } },
    { type: 'flag', at: [51.2, 9.3], params: { colors: ['muniTeal', 'white', 'muniTeal'] }, anim: { fps: 6 }, solid: true },
    { type: 'flag', at: [87.6, 9.3], params: { colors: ['muniTeal', 'white', 'muniTeal'] }, anim: { fps: 6 }, solid: true },
    { type: 'cone', at: [82.9, 9.35], solid: true },
    { type: 'cone', at: [87.2, 9.35], solid: true },

    // ---------------------------------------------------------- Acá Nomás Suc. 15: inauguración
    { type: 'flag', at: [75.55, 51.5], params: { colors: ['anOrange', 'anCream', 'anOrange'] }, anim: { fps: 6 }, solid: true },
    { type: 'flag', at: [75.55, 56.3], params: { colors: ['anOrange', 'anCream', 'anOrange'] }, anim: { fps: 6 }, solid: true },
    {
      id: 'an15_plate',
      type: 'plate',
      at: [77.4, 52.4],
      params: { text: '¡INAUGURACIÓN!', text2: 'SUCURSAL 15', bg: 'anOrange', fg: 'anCream', logo: 'an', post: 8 },
      solid: true,
      caption: { text: '¡INAUGURACIÓN! ACÁ NOMÁS · SUCURSAL 15', bg: 'anOrange', fg: 'white', z: 30 },
    },

    // ---------------------------------------------------------- el kiosco (la casa de Nahuel)
    { id: 'garrafa_ext', type: 'garrafa', at: [39.3, 75.55], solid: true, caption: { text: 'GARRAFA VACÍA (SIN GAS)', bg: 'signRed', fg: 'white', z: 26 } },
  );

  const lots = base.lots.map((l) => (l.id === 'an15' ? { ...l, building: acaNomasStore(3.5, 4, 'R', '15', 15) } : l));

  return {
    ...base,
    id: 'ch02-city',
    name: 'Río Gallegos (jueves)',
    lots,
    props,
    // el choque se retiró; sigue cortada la calle de la obra de Patagonia Puede
    blocks: (base.blocks ?? []).filter((b) => b.id === 'obra'),
    blockedInters: [],
    markers: {
      ...base.markers,
      feria_car: { at: [57.2, 10.6], dir: 'W' },
      podium: { at: [66.35, 7.0] },
      prensa: { at: [64.2, 9.1], dir: 'N' },
      crowd_1: { at: [62.6, 9.4], dir: 'N' },
      crowd_2: { at: [68.9, 9.3], dir: 'N' },
      crowd_3: { at: [66.0, 9.75], dir: 'N' },
      stall_nelly: { at: [53.5, 6.7], dir: 'S' },
      stall_lucas: { at: [57.1, 6.7], dir: 'S' },
      stall_vero: { at: [60.7, 6.7], dir: 'S' },
      stall_tito: { at: [71.7, 6.7], dir: 'S' },
      stall_marta: { at: [75.3, 6.7], dir: 'S' },
      lab_spot: { at: [79.4, 9.35], dir: 'N' },
      beto: { at: [81.5, 9.3], dir: 'W' },
      cameo_diego: { at: [56.9, 9.2], dir: 'N' },
      cameo_tomi: { at: [56.0, 9.5], dir: 'N' },
      obra_car: { at: [40.5, 61.5], dir: 'W' },
      sereno: { at: [43.6, 57.4], dir: 'S' },
      an15_car: { at: [76.6, 55.6], dir: 'S' },
      an15_door: { at: [75.6, 54.9], dir: 'W' },
      julian: { at: [75.6, 54.0], dir: 'W' },
      promo_1: { at: [75.7, 56.0], dir: 'W' },
      promo_2: { at: [75.7, 52.2], dir: 'W' },
      kiosk_door: { at: [37.4, 75.4], dir: 'N' },
    },
    zones: [
      ...base.zones,
      { id: 'feria_view', rect: [49, 10, 90, 15] },
      { id: 'feria_stage_zone', rect: [61.5, 8.3, 71.0, 9.95] },
      { id: 'lab_zone', rect: [77.4, 8.3, 82.6, 9.95] },
      { id: 'obra_zone', rect: [40.5, 56.0, 44.6, 60.9] },
      { id: 'an15_door_zone', rect: [75.0, 54.1, 76.5, 55.7] },
      { id: 'kiosk_door', rect: [36.2, 75.0, 38.8, 76.1] },
      { id: 'kiosk_view', rect: [30, 72, 46, 80] },
    ],
  };
}
