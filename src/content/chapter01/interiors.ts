import { G } from '../../engine/world/ground';
import type { InteriorDef } from '../../engine/mission/types';
import { registerProp } from '../../engine/world/PropRegistry';
import { PixelCanvas } from '../../engine/assets/PixelCanvas';
import { C } from '../../engine/assets/Palette';
import { drawText } from '../../engine/assets/BitmapFont';

/** Visor de turnos LED (se cuelga sobre el mostrador). */
export function registerInteriorProps(): void {
  registerProp('led', (p: { n: string; label?: string }) => {
    const pc = new PixelCanvas(56, 52);
    const y0 = 2;
    pc.rect(2, y0, 52, 15, C('slate8'));
    pc.rect(3, y0 + 1, 50, 13, C('#140807'));
    drawText(pc, p.label ?? 'TURNO', 6, y0 + 4, C('#a33a2c'), { spacing: 0 });
    drawText(pc, p.n, 33, y0 + 4, C('#ff5a3c'));
    pc.vline(28, y0 + 15, y0 + 20, C('slate6'));
    pc.outline(C('ink', 200));
    return { pc, anchorX: 28, anchorY: 51 };
  });
  // radio portátil de Mirta (por ahí sale el "último momento")
  registerProp('radio_small', () => {
    const pc = new PixelCanvas(14, 12);
    pc.rect(2, 4, 10, 6, C('r89Purple'));
    pc.rect(3, 5, 4, 4, C('slate8'));
    for (let y = 5; y < 9; y += 2) pc.hline(3, 6, y, C('slate5'));
    pc.rect(8, 5, 3, 2, C('r89Yellow'));
    pc.line(10, 4, 13, 0, C('slate4'));
    pc.outline(C('ink', 200));
    return { pc, anchorX: 7, anchorY: 11 };
  });
}

export const interiors: Record<string, InteriorDef> = {
  // -------------------------------------------------------------- Acá Nomás Suc. 14 (punto de pago)
  an14: {
    id: 'an14',
    name: 'Acá Nomás · Sucursal 14',
    size: [9, 7],
    floor: G.FLOOR_STORE,
    wallH: 46,
    wallColor: '#e9dcc0',
    wallLow: 'anOrange',
    ambience: 'store',
    items: [
      { kind: 'window', wall: 'back', u: 0.4, z: 14, w: 1.4, h: 16 },
      { kind: 'poster', wall: 'back', u: 2.1, z: 15, w: 3.2, h: 20, bg: 'anOrange', fg: 'white', text: 'SUC. 14', text2: 'CRECEMOS', logo: 'an', caption: 'ACÁ NOMÁS · SUCURSAL 14 · ¡CRECEMOS!' },
      { kind: 'poster', wall: 'back', u: 5.6, z: 15, w: 2.4, h: 20, bg: 'anCream', fg: 'anBrown', text: 'PRONTO', text2: 'SUC. 15', caption: 'PRONTO: SUCURSAL 15' },
      { kind: 'clock', wall: 'back', u: 8.2, z: 30, w: 0.6, h: 9 },
      { kind: 'sign', wall: 'left', u: 0.3, z: 26, w: 4.3, h: 11, bg: 'anBrown', fg: 'anCream', text: 'PUNTO DE PAGO', caption: 'PUNTO DE PAGO' },
      { kind: 'door', wall: 'left', u: 4.8, z: 0, w: 1.2, h: 24, text: 'SALIDA' },
    ],
    props: [
      { id: 'caja', type: 'checkout', at: [0.9, 1.1], params: { axis: 'y' }, fp: [0.6, 1.6], solid: true },
      { type: 'shelf', at: [3.4, 0.7], params: { axis: 'x', len: 3, seed: 3 }, fp: [3, 0.5], solid: true },
      { type: 'shelf', at: [3.4, 2.7], params: { axis: 'x', len: 3, seed: 5 }, fp: [3, 0.5], solid: true },
      { type: 'shelf', at: [3.4, 4.7], params: { axis: 'x', len: 3, seed: 8 }, fp: [3, 0.5], solid: true },
      { type: 'fridge', at: [8.2, 1.2], params: { axis: 'y' }, fp: [0.5, 1], solid: true },
      { type: 'fridge', at: [8.2, 2.4], params: { axis: 'y' }, fp: [0.5, 1], solid: true },
      { type: 'plate', at: [7.3, 6.2], params: { text: 'YERBA 2x1', bg: 'ppNavy', fg: 'white', logo: 'pp', post: 6 }, solid: true },
      { type: 'plant', at: [8.4, 6.4], params: { dying: true }, solid: true },
      { type: 'bin', at: [1.7, 6.5], solid: true },
    ],
    markers: {
      entry: { at: [1.1, 5.4], dir: 'E' },
      cashier: { at: [0.42, 1.85], dir: 'E' },
      counter_spot: { at: [1.9, 1.95], dir: 'W' },
      q1: { at: [1.95, 2.95], dir: 'N' },
      q2: { at: [2.05, 3.9], dir: 'N' },
      queue_end: { at: [2.1, 4.8], dir: 'N' },
      out_path: { at: [2.9, 6.3] },
    },
    zones: [
      { id: 'exit', rect: [0, 4.8, 0.55, 6.0] },
      { id: 'queue_zone', rect: [1.3, 4.2, 2.9, 5.5] },
      { id: 'counter_zone', rect: [1.3, 1.4, 2.6, 2.5] },
    ],
  },

  // -------------------------------------------------------------- Municipalidad · Habilitaciones Comerciales
  muni_hab: {
    id: 'muni_hab',
    name: 'Municipalidad · Dirección de Habilitaciones Comerciales',
    size: [11, 9],
    floor: G.FLOOR_LINO,
    wallH: 50,
    wallColor: '#c3cfc6',
    wallLow: 'slate4',
    ambience: 'office',
    items: [
      { kind: 'window', wall: 'back', u: 0.3, z: 16, w: 1.2, h: 18 },
      { kind: 'poster', wall: 'back', u: 1.7, z: 12, w: 3.2, h: 22, bg: 'hazard', fg: 'ink', text: 'NUEVA', text2: 'ORDENANZA', caption: 'NUEVA ORDENANZA · RESISTENCIA EÓLICA DE CARTELERÍA' },
      { kind: 'sign', wall: 'back', u: 5.0, z: 32, w: 5.5, h: 11, bg: 'muniTeal', fg: 'white', text: 'HABILITACIONES', logo: 'muni', caption: 'DIRECCIÓN DE HABILITACIONES COMERCIALES' },
      { kind: 'clock', wall: 'back', u: 5.2, z: 14, w: 0.6, h: 10 },
      { kind: 'board', wall: 'back', u: 6.1, z: 12, w: 1.2, h: 14 },
      { kind: 'poster', wall: 'back', u: 7.45, z: 10, w: 2.25, h: 19, bg: 'ppNavy', fg: 'white', text: 'TURNOS', text2: 'ONLINE', caption: 'TURNOS ONLINE · PRÓXIMAMENTE' },
      { kind: 'door', wall: 'back', u: 9.8, z: 0, w: 0.9, h: 26 },
      { kind: 'heater', wall: 'left', u: 1.2, z: 8, w: 0.8, h: 8 },
      { kind: 'sign', wall: 'left', u: 3.5, z: 27, w: 2.8, h: 19, bg: 'white', fg: 'muniTeal', text: 'MESA', text2: 'ENTRADAS', caption: 'MESA DE ENTRADAS' },
      { kind: 'frame', wall: 'left', u: 6.5, z: 18, w: 0.8, h: 10 },
      { kind: 'door', wall: 'left', u: 7.6, z: 0, w: 0.9, h: 26, text: 'SALIDA' },
    ],
    props: [
      { id: 'ventanilla', type: 'counter', at: [0, 3.3], params: { axis: 'x', len: 7, glass: true, label: 'VENTANILLA 3' }, fp: [7, 0.5], solid: true },
      { type: 'counter', at: [8, 3.3], params: { axis: 'x', len: 3, glass: false, color: '#7d6c56' }, fp: [3, 0.5], solid: true },
      { id: 'desk_diego', type: 'desk', at: [1.2, 1.25], params: { axis: 'x', len: 1.6, crt: true, papers: true, mate: true }, fp: [1.6, 0.8], solid: true },
      { type: 'desk', at: [4.1, 1.25], params: { axis: 'x', len: 1.6, crt: true, papers: true }, fp: [1.6, 0.8], solid: true },
      { type: 'chair', at: [1.8, 0.45], params: { color: 'slate6' }, fp: [0.4, 0.4], solid: false },
      { type: 'chair', at: [4.7, 0.45], params: { color: 'slate6' }, fp: [0.4, 0.4], solid: false },
      { type: 'cabinet', at: [6.5, 0.15], fp: [0.5, 0.45], solid: true },
      { type: 'cabinet', at: [7.1, 0.15], fp: [0.5, 0.45], solid: true },
      { type: 'papers', at: [8.2, 0.4], fp: [0.4, 0.35], solid: true },
      { type: 'papers', at: [8.7, 1.1], fp: [0.4, 0.35], solid: true },
      { type: 'papers', at: [7.8, 1.6], fp: [0.4, 0.35], solid: true },
      { id: 'mesa_entradas', type: 'desk', at: [1.0, 4.45], params: { axis: 'y', len: 1.4, papers: true, color: '#8f7a5e' }, fp: [0.8, 1.4], solid: true },
      { id: 'ticket', type: 'ticket', at: [2.5, 7.7], solid: true },
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ type: 'chair', at: [3.4 + i * 0.8, 6.35] as [number, number], params: { color: '#d8772f' }, fp: [0.4, 0.4] as [number, number], solid: false })),
      { type: 'cooler', at: [9.9, 4.5], solid: true },
      { type: 'plant', at: [10.5, 4.4], params: { dying: true }, solid: true },
      { type: 'bin', at: [8.6, 8.4], solid: true },
      { id: 'led_039', type: 'led', at: [5.4, 3.32], params: { n: '039' } },
      { id: 'led_047', type: 'led', at: [5.4, 3.32], params: { n: '047' }, hidden: true },
      { id: 'radio_mirta', type: 'radio_small', at: [1.45, 5.3] },
    ],
    markers: {
      entry: { at: [1.25, 8.05], dir: 'E' },
      door_in: { at: [0.7, 8.05], dir: 'E' },
      ponce_entry: { at: [2.2, 7.6], dir: 'W' },
      ponce_office: { at: [10.1, 0.9], dir: 'S' },
      mirta_desk: { at: [0.55, 5.1], dir: 'E' },
      ticket: { at: [2.5, 7.7] },
      seat_1: { at: [3.62, 6.6], dir: 'S' },
      seat_2: { at: [4.42, 6.6], dir: 'S' },
      seat_3: { at: [5.22, 6.6], dir: 'S' },
      seat_4: { at: [6.02, 6.6], dir: 'S' },
      seat_5: { at: [6.82, 6.6], dir: 'S' },
      seat_6: { at: [7.62, 6.6], dir: 'S' },
      counter_public: { at: [3.2, 4.3], dir: 'N' },
      counter_staff: { at: [3.2, 2.55], dir: 'S' },
      diego_desk: { at: [2.0, 0.62], dir: 'S' },
      staff_gate: { at: [7.5, 3.55] },
      poster: { at: [2.6, 4.3] },
      waiting_spot: { at: [5.4, 7.6], dir: 'N' },
    },
    zones: [
      { id: 'exit', rect: [0, 7.55, 0.55, 8.55] },
      { id: 'counter_zone', rect: [2.1, 3.85, 4.5, 4.9] },
      { id: 'staff_zone', rect: [0.2, 0.2, 7.0, 3.25] },
      { id: 'desk_zone', rect: [1.0, 1.9, 3.2, 3.25] },
    ],
  },
};
