import { PixelCanvas } from '../../engine/assets/PixelCanvas';
import { C, shade } from '../../engine/assets/Palette';
import { isoCanvas, pointCanvas } from '../../engine/assets/gen/iso';
import { drawText, drawTextOnFace, measureText } from '../../engine/assets/BitmapFont';
import { registerProp } from '../../engine/world/PropRegistry';
import type { GenOutput } from '../../engine/assets/AssetRegistry';

/**
 * Objetos propios del Capítulo 2 (feria, ensayos, Municipalidad por dentro). Todo dibujado por
 * código con el pintor isométrico del motor; el contenido los registra con registerProp.
 */

function strip(frames: PixelCanvas[], ax: number, ay: number): GenOutput {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const pc = new PixelCanvas(fw * frames.length, fh);
  frames.forEach((f, i) => pc.blit(f, i * fw, 0));
  return { pc, frameW: fw, frameH: fh, anchorX: ax, anchorY: ay };
}

function outlined(pc: PixelCanvas, alpha = 200): PixelCanvas {
  pc.outline(C('ink', alpha));
  return pc;
}

/** Tablero frontal (siempre de frente a la cámara): el texto queda derecho y se lee bien. */
function frontBoard(
  pc: PixelCanvas,
  cx: number,
  top: number,
  lines: { text: string; fg: string; scale?: number }[],
  bg: string,
  border: string,
  minW = 0,
): { x0: number; y0: number; w: number; h: number } {
  const rows = lines.map((l) => ({ ...l, scale: l.scale ?? 1 }));
  const tw = Math.max(...rows.map((r) => measureText(r.text, 1) * r.scale));
  const w = Math.max(minW, tw + 8);
  const lineH = (s: number) => 7 * s + (s > 1 ? 4 : 3);
  const th = rows.reduce((a, r) => a + lineH(r.scale), 0) - 3;
  const h = th + 7;
  const x0 = Math.round(cx - w / 2);
  pc.rect(x0, top, w, h, C(bg));
  pc.rect(x0 + 1, top + h, w, 1, shade(C(bg), 0.55));
  pc.rect(x0 + w, top + 1, 1, h, shade(C(bg), 0.55));
  pc.hline(x0, x0 + w - 1, top, C(border));
  pc.hline(x0, x0 + w - 1, top + h - 1, C(border));
  pc.vline(x0, top, top + h - 1, C(border));
  pc.vline(x0 + w - 1, top, top + h - 1, C(border));
  let y = top + 4;
  for (const r of rows) {
    const rw = measureText(r.text, 1) * r.scale;
    drawText(pc, r.text, x0 + Math.floor((w - rw) / 2), y, C(r.fg), { spacing: 1, scale: r.scale });
    y += lineH(r.scale);
  }
  return { x0, y0: top, w, h };
}

// ------------------------------------------------------------------ puesto de feria

export interface StallParams {
  awning: string;
  goods: 'wool' | 'alfajores' | 'hair' | 'brooms' | 'mate';
  line1: string;
  line2?: string;
}

const STALL_W = 2.2;
const STALL_D = 0.9;

export function propStall(p: StallParams): GenOutput {
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 2; f++) {
    const { pc, iso, ax: a, ay: b } = isoCanvas(STALL_W, STALL_D, 64, 4);
    ax = a;
    ay = b;
    const awn = C(p.awning);
    iso.groundShadow(-0.05, -0.05, STALL_W + 0.12, STALL_D + 0.18, 42);
    // mesa con mantel
    const cloth = C('#f4efe2');
    const table = iso.box(0.12, 0.3, STALL_W - 0.12, STALL_D - 0.05, 0, 11, { top: shade(cloth, 1.05), left: cloth, right: shade(cloth, 0.8) });
    table.left.rect(0, table.left.len, 0, 4, awn);
    // mercadería sobre la mesa
    const gx0 = 0.22;
    const gx1 = STALL_W - 0.22;
    const gy0 = 0.38;
    const gy1 = STALL_D - 0.12;
    switch (p.goods) {
      case 'wool':
        [C('#c8413a'), C('#e0b43c'), C('#3f8ac0'), C('#5aa35a'), C('#8a5a9a'), C('#e07a2e')].forEach((c, i) => {
          const x = gx0 + i * 0.3;
          iso.box(x, gy0 + (i % 2) * 0.12, x + 0.22, gy0 + 0.22 + (i % 2) * 0.12, 11, 15, c);
        });
        break;
      case 'alfajores':
        for (let i = 0; i < 4; i++) {
          const x = gx0 + i * 0.44;
          iso.box(x, gy0, x + 0.36, gy1 - 0.1, 11, 14 + (i % 2) * 3, i % 2 ? C('#8a5a3c') : C('#d8b67a'));
          iso.box(x + 0.05, gy0 + 0.05, x + 0.31, gy1 - 0.15, 14 + (i % 2) * 3, 15 + (i % 2) * 3, C('white'));
        }
        break;
      case 'hair':
        iso.box(gx0, gy0, gx0 + 0.5, gy0 + 0.1, 11, 24, C('#9fc3d6')); // espejo
        iso.box(gx0 + 0.75, gy0 + 0.1, gx0 + 1.05, gy0 + 0.35, 11, 15, C('slate8')); // secador
        iso.box(gx0 + 1.1, gy0 + 0.1, gx0 + 1.28, gy0 + 0.25, 11, 21, C('#d8772f')); // botella
        break;
      case 'brooms':
        for (let i = 0; i < 5; i++) {
          const x = gx0 + i * 0.36;
          iso.box(x, gy0 + 0.1, x + 0.05, gy0 + 0.15, 11, 30, C('wood'));
          iso.box(x - 0.06, gy0 + 0.05, x + 0.11, gy0 + 0.22, 11, 18, C('mustard'));
        }
        break;
      case 'mate':
        for (let i = 0; i < 4; i++) {
          const x = gx0 + i * 0.32;
          iso.box(x, gy0 + 0.1, x + 0.16, gy0 + 0.26, 11, 17, C('#6b4a2a'));
        }
        iso.box(gx1 - 0.5, gy0 + 0.05, gx1 - 0.3, gy0 + 0.25, 11, 26, C('slate3'));
        iso.box(gx1 - 0.25, gy0 + 0.05, gx1 - 0.05, gy0 + 0.25, 11, 22, C('slate5'));
        break;
    }
    void gx1;
    void gy1;
    // postes
    for (const [x, y] of [
      [0.03, 0.03],
      [STALL_W - 0.08, 0.03],
      [0.03, STALL_D - 0.08],
      [STALL_W - 0.08, STALL_D - 0.08],
    ]) iso.box(x, y, x + 0.05, y + 0.05, 0, 31, C('slate6'));
    // toldo (con vaivén por el viento en el 2º cuadro)
    const sw = f * 0.0625;
    const roof = iso.box(-0.06 + sw, -0.06, STALL_W + 0.06 + sw, STALL_D + 0.06, 31, 34, awn);
    // faldón a rayas al frente y al costado
    for (let u = 0; u < roof.left.len; u += 4) {
      const c = (u / 4) % 2 ? C('white') : awn;
      iso.faceY(-0.06 + sw, STALL_W + 0.06 + sw, STALL_D + 0.06).rect(u, u + 4, 27, 31, c);
    }
    for (let u = 0; u < roof.right.len; u += 4) {
      const c = (u / 4) % 2 ? shade(C('white'), 0.8) : shade(awn, 0.8);
      iso.faceX(-0.06, STALL_D + 0.06, STALL_W + 0.06 + sw).rect(u, u + 4, 27, 31, c);
    }
    // cartel frontal sobre el toldo
    const [cx, cy] = iso.P(STALL_W / 2 + sw, STALL_D / 2, 34);
    const lines = [{ text: p.line1, fg: 'ink' }, ...(p.line2 ? [{ text: p.line2, fg: 'signRed' }] : [])];
    const lh = lines.length * 10 + 4;
    frontBoard(pc, cx, Math.round(cy) - lh - 6, lines, '#f8f4e8', p.awning, 30);
    // patitas del cartel
    pc.vline(Math.round(cx) - 8, Math.round(cy) - 6, Math.round(cy) - 1, C('slate6'));
    pc.vline(Math.round(cx) + 8, Math.round(cy) - 6, Math.round(cy) - 1, C('slate6'));
    frames.push(outlined(pc));
  }
  return strip(frames, ax, ay);
}

// ------------------------------------------------------------------ escenario de la feria

export const STAGE_W = 5.5;
export const STAGE_D = 2.2;

/** Cuadros: 0 = telón y cinta · 1 = cinta cortada · 2 = cinta cortada y telón volado. */
export function propStage(): GenOutput {
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 3; f++) {
    const { pc, iso, ax: a, ay: b } = isoCanvas(STAGE_W, STAGE_D, 74, 4);
    ax = a;
    ay = b;
    iso.groundShadow(-0.05, -0.05, STAGE_W + 0.1, STAGE_D + 0.1, 40);
    const wood = C('#8a6a45');
    const plat = iso.box(0.05, 0.05, STAGE_W - 0.05, 1.6, 0, 6, { top: shade(wood, 1.1), left: wood, right: shade(wood, 0.78) });
    for (let u = 0; u < plat.left.len; u += 8) plat.left.rect(u, u + 1, 0, 6, shade(wood, 0.8));
    // postes del telón
    for (const x of [0.25, STAGE_W - 0.3]) iso.box(x, 0.15, x + 0.06, 0.21, 6, 56, C('slate7'));
    // telón (de frente)
    const [bx, by] = iso.P(STAGE_W / 2, 0.18, 54);
    if (f < 2) {
      frontBoard(pc, bx, Math.round(by) - 2, [{ text: 'FERIA DE', fg: 'white' }, { text: 'EMPRENDEDORES', fg: 'white' }], 'muniTeal', 'muniLight', 86);
    } else {
      // sólo quedan las sogas colgando
      for (const dx of [-38, 38]) {
        pc.vline(Math.round(bx) + dx, Math.round(by) - 2, Math.round(by) + 6, C('white'));
        pc.set(Math.round(bx) + dx + (dx < 0 ? 1 : -1), Math.round(by) + 7, C('white'));
      }
    }
    // atril con micrófono
    const px = STAGE_W / 2 - 0.2;
    const pod = iso.box(px, 0.95, px + 0.42, 1.3, 6, 19, C('#7a5a38'));
    pod.left.rect(3, pod.left.len - 3, 8, 15, C('muniTeal'));
    iso.box(px + 0.18, 1.02, px + 0.23, 1.07, 19, 27, C('slate7'));
    iso.box(px + 0.14, 0.98, px + 0.27, 1.11, 27, 29, C('slate8'));
    // cinta: dos parantes y la cinta roja entre ellos
    for (const x of [0.6, STAGE_W - 0.75]) iso.box(x, 2.0, x + 0.05, 2.05, 0, 14, C('slate6'));
    const [r0x, r0y] = iso.P(0.62, 2.02, 13);
    const [r1x, r1y] = iso.P(STAGE_W - 0.72, 2.02, 13);
    if (f === 0) {
      pc.line(r0x, r0y, r1x, r1y, C('#d23b32'));
      pc.line(r0x, r0y + 1, r1x, r1y + 1, C('#d23b32'));
    } else {
      // cortada: dos tiras que cuelgan y se mueven con el viento
      const mx = Math.round((r0x + r1x) / 2);
      pc.line(r0x, r0y, mx - 3, Math.round((r0y + r1y) / 2) + 1, C('#d23b32'));
      pc.line(mx - 3, Math.round((r0y + r1y) / 2) + 1, mx - 4, Math.round((r0y + r1y) / 2) + 9, C('#d23b32'));
      pc.line(r1x, r1y, mx + 3, Math.round((r0y + r1y) / 2) - 1, C('#d23b32'));
      pc.line(mx + 3, Math.round((r0y + r1y) / 2) - 1, mx + 7, Math.round((r0y + r1y) / 2) + 6, C('#d23b32'));
    }
    frames.push(outlined(pc));
  }
  return strip(frames, ax, ay);
}

/** Cartel volador (telón de la feria arrancado por el viento), para animar con tweens. */
export function propBannerFly(): GenOutput {
  const pc = new PixelCanvas(92, 26);
  frontBoard(pc, 46, 1, [{ text: 'FERIA DE', fg: 'white' }, { text: 'EMPRENDEDORES', fg: 'white' }], 'muniTeal', 'muniLight', 86);
  // soga suelta
  pc.line(2, 24, 0, 25, C('white'));
  pc.line(88, 24, 91, 25, C('white'));
  return { pc: outlined(pc), anchorX: 46, anchorY: 13 };
}

// ------------------------------------------------------------------ Estación Móvil de Ensayos

export const RIG_W = 3.4;
export const RIG_D = 1.4;

/** Camión con ventilador gigante y mástil anemómetro. 2 cuadros: el ventilador gira. */
export function propTestRig(): GenOutput {
  const frames: PixelCanvas[] = [];
  let ax = 0;
  let ay = 0;
  for (let f = 0; f < 2; f++) {
    const { pc, iso, ax: a, ay: b } = isoCanvas(RIG_W, RIG_D, 66, 4);
    ax = a;
    ay = b;
    iso.groundShadow(-0.05, -0.05, RIG_W + 0.1, RIG_D + 0.15, 45);
    // chasis y caja
    const box = iso.box(0.05, 0.2, 2.5, RIG_D - 0.05, 3, 18, C('carWhite'));
    box.left.hline(0, box.left.len, 9, C('ppNavy'));
    box.left.rect(0, box.left.len, 10, 12, C('ppNavy'));
    // cabina
    const cab = iso.box(2.5, 0.25, RIG_W - 0.05, RIG_D - 0.1, 3, 20, C('carWhite'));
    cab.left.rect(2, cab.left.len - 2, 12, 18, C('#9fc3d6'));
    // ruedas
    for (const x of [0.5, 1.9, 2.9]) iso.box(x, RIG_D - 0.12, x + 0.32, RIG_D + 0.02, 0, 6, C('ink'));
    // ventilador: aro en el frente de la caja + aspas
    const [fx, fy] = iso.P(1.2, RIG_D - 0.05, 26);
    const cx = Math.round(fx);
    const cy = Math.round(fy);
    const R = 11;
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const d = Math.hypot(x, y * 1.15);
        if (d <= R && d > R - 2) pc.set(cx + x, cy + y, C('slate7'));
        else if (d <= R - 2) pc.set(cx + x, cy + y, C('slate2', 190));
      }
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + f * (Math.PI / 4);
      pc.line(cx, cy, Math.round(cx + Math.cos(ang) * (R - 2)), Math.round(cy + Math.sin(ang) * (R - 2)), C('slate9'));
    }
    pc.rect(cx - 1, cy - 1, 3, 3, C('slate5'));
    iso.box(0.9, RIG_D - 0.3, 1.5, RIG_D - 0.05, 18, 20, C('slate6'));
    // mástil con anemómetro (3 cazoletas)
    iso.box(2.9, 0.4, 2.96, 0.46, 20, 52, C('slate5'));
    const [mx, my] = iso.P(2.93, 0.43, 52);
    const mxx = Math.round(mx);
    const myy = Math.round(my);
    pc.hline(mxx - 4, mxx + 4, myy, C('slate7'));
    for (const dx of [-4, 4]) pc.rect(mxx + dx - 1 + (f ? 1 : 0), myy - 2, 3, 3, C('signRed'));
    // cartel de la estación: apoyado sobre el techo de la caja, dentro del lienzo (antes se cortaba a la izquierda)
    frontBoard(pc, 34, 27, [{ text: 'ENSAYOS', fg: 'white' }, { text: 'EÓLICOS', fg: 'ppCyan' }], 'ppNavy', 'ppCyan', 0);
    frames.push(outlined(pc));
  }
  return strip(frames, ax, ay);
}

// ------------------------------------------------------------------ túnel de viento (averiado)

export const TUNNEL_W = 3.8;
export const TUNNEL_D = 1.5;

export function propTunnelWreck(): GenOutput {
  const { pc, iso, ax, ay } = isoCanvas(TUNNEL_W, TUNNEL_D, 46, 4);
  iso.groundShadow(-0.05, -0.05, TUNNEL_W + 0.1, TUNNEL_D + 0.1, 40);
  const metal = C('slate5');
  // base y paredes (sin techo)
  iso.box(0.05, 0.05, TUNNEL_W - 0.05, TUNNEL_D - 0.05, 0, 3, C('slate3'));
  iso.box(0.05, 0.05, TUNNEL_W - 0.05, 0.2, 3, 22, metal);
  const front = iso.box(0.05, TUNNEL_D - 0.2, TUNNEL_W - 0.05, TUNNEL_D - 0.05, 3, 22, metal);
  for (let u = 0; u < front.left.len; u += 6) front.left.rect(u, u + 1, 3, 22, shade(metal, 0.82));
  // costillas del túnel
  for (const x of [0.5, 1.5, 2.5, 3.4]) iso.box(x, 0.05, x + 0.08, TUNNEL_D - 0.05, 22, 25, C('slate7'));
  // chapas arrancadas: apoyadas contra el frente y tiradas
  iso.poly3(
    [
      [0.4, TUNNEL_D - 0.05, 22],
      [1.9, TUNNEL_D - 0.05, 22],
      [2.1, TUNNEL_D + 0.55, 2],
      [0.6, TUNNEL_D + 0.55, 2],
    ],
    shade(metal, 1.1),
  );
  iso.poly3(
    [
      [2.7, 0.4, 26],
      [3.6, 0.4, 26],
      [3.7, 1.1, 30],
      [2.8, 1.1, 30],
    ],
    shade(metal, 0.9),
  );
  iso.box(3.0, TUNNEL_D + 0.1, 3.6, TUNNEL_D + 0.4, 0, 2, shade(metal, 0.85));
  // cinta de peligro
  for (const [x0, y0, x1, y1] of [
    [0.0, TUNNEL_D + 0.7, TUNNEL_W, TUNNEL_D + 0.7],
    [TUNNEL_W, 0.0, TUNNEL_W, TUNNEL_D + 0.7],
  ] as [number, number, number, number][]) {
    for (let i = 0; i < 24; i++) {
      const t0 = i / 24;
      const [px, py] = iso.P(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, 9);
      pc.rect(Math.round(px), Math.round(py), 3, 2, i % 2 ? C('ink') : C('hazard'));
    }
  }
  for (const [x, y] of [
    [0.0, TUNNEL_D + 0.7],
    [TUNNEL_W, TUNNEL_D + 0.7],
    [TUNNEL_W, 0.0],
  ] as [number, number][])
    iso.box(x - 0.03, y - 0.03, x + 0.03, y + 0.03, 0, 11, C('hazard'));
  // cartel
  const [sx, sy] = iso.P(TUNNEL_W / 2, TUNNEL_D, 44);
  frontBoard(pc, Math.round(sx), Math.round(sy) - 24, [{ text: 'TÚNEL DE VIENTO', fg: 'white' }, { text: 'FUERA DE SERVICIO', fg: 'hazard' }], 'slate8', 'hazard', 0);
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

// ------------------------------------------------------------------ Municipalidad por dentro

/** Escalera recta de 9 escalones (sube hacia el fondo, en dirección −y). Huella 1,4 × 2,6. */
export function propStairs(): GenOutput {
  const { pc, iso, ax, ay } = isoCanvas(1.4, 2.6, 50, 3);
  iso.groundShadow(0, 0, 1.4, 2.6, 30);
  const steps = 9;
  const run = 2.6 / steps;
  const stone = C('#b9b4a4');
  for (let i = 0; i < steps; i++) {
    const y0 = 2.6 - (i + 1) * run;
    const y1 = 2.6 - i * run;
    const z = 4 + i * 4.4;
    iso.box(0, y0, 1.4, y1, 0, z, { top: shade(stone, 1.12), left: shade(stone, 0.96 - i * 0.02), right: shade(stone, 0.72) });
  }
  // baranda del lado libre
  for (let i = 0; i <= steps; i += 3) {
    const y = 2.6 - i * run - 0.05;
    iso.box(1.32, y, 1.38, y + 0.06, 4 + i * 4.4, 16 + i * 4.4, C('slate6'));
  }
  const [ex, ey] = iso.P(1.35, 2.55, 15);
  const [tx, ty] = iso.P(1.35, 0.15, 15 + steps * 4.4);
  pc.line(Math.round(ex), Math.round(ey), Math.round(tx), Math.round(ty), C('slate8'));
  return { pc: outlined(pc, 190), anchorX: ax, anchorY: ay };
}

/** Ascensor "en obra": puertas cerradas, cartel de fuera de servicio y el papel de PRÓXIMAMENTE. */
export function propElevator(): GenOutput {
  const { pc, iso, ax, ay } = isoCanvas(1.5, 0.5, 60, 3);
  iso.groundShadow(0, 0, 1.5, 0.5, 30);
  const body = iso.box(0, 0, 1.5, 0.5, 0, 44, C('slate3'));
  const f = body.left;
  f.rect(3, f.len - 3, 2, 34, C('slate6'));
  f.rect(Math.floor(f.len / 2), Math.floor(f.len / 2) + 1, 2, 34, C('slate9'));
  f.rect(3, f.len - 3, 33, 34, C('slate8'));
  // botonera y cinta de peligro cruzada
  f.rect(f.len - 2, f.len - 1, 14, 18, C('lightRed'));
  for (let u = 4; u < f.len - 4; u += 3) {
    f.px(u, 12 + ((u / 3) % 2 ? 1 : 0), C('hazard'));
    f.px(u + 1, 12 + ((u / 3) % 2 ? 1 : 0), C('ink'));
    f.px(u, 22 - ((u / 3) % 2 ? 1 : 0), C('hazard'));
    f.px(u + 1, 22 - ((u / 3) % 2 ? 1 : 0), C('ink'));
  }
  // papel pegado con cinta
  f.rect(6, 17, 36, 43, C('white'));
  f.rect(6, 17, 43, 44, C('#c9b27a'));
  drawTextOnFace(f, 'PRONTO', 7, 42, C('signRed'), { spacing: 0 });
  drawTextOnFace(f, 'ASCENSOR', 7, 39, C('ink'), { spacing: 0 });
  return { pc: outlined(pc, 190), anchorX: ax, anchorY: ay };
}

/** Garrafa de gas (vacía): la calefacción del kiosco. */
export function propGarrafa(): GenOutput {
  const { pc, ax, ay } = pointCanvas(6, 20, 2);
  const g = C('#4f8a5c');
  pc.rect(ax - 3, ay - 12, 7, 12, g);
  pc.rect(ax - 3, ay - 12, 2, 12, shade(g, 1.2));
  pc.rect(ax + 2, ay - 12, 2, 12, shade(g, 0.72));
  pc.hline(ax - 3, ax + 3, ay - 12, shade(g, 0.6));
  pc.rect(ax - 2, ay - 15, 5, 3, shade(g, 0.85));
  pc.rect(ax - 1, ay - 17, 3, 2, C('slate6'));
  pc.rect(ax - 2, ay - 8, 5, 3, C('white'));
  pc.set(ax, ay - 7, C('signRed'));
  return { pc: outlined(pc), anchorX: ax, anchorY: ay };
}

export function registerChapter2Props(): void {
  registerProp('stall', (p: StallParams) => propStall(p));
  registerProp('stage', () => propStage());
  registerProp('banner_fly', () => propBannerFly());
  registerProp('test_rig', () => propTestRig());
  registerProp('tunnel_wreck', () => propTunnelWreck());
  registerProp('stairs', () => propStairs());
  registerProp('elevator', () => propElevator());
  registerProp('garrafa', () => propGarrafa());
}
