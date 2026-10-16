import { PixelCanvas } from '../engine/assets/PixelCanvas';
import { C, shade } from '../engine/assets/Palette';
import { IsoPainter } from '../engine/assets/gen/iso';
import { drawTextOnFace, measureText } from '../engine/assets/BitmapFont';
import { drawCharacterSheet, CHAR_FRAME_W, CHAR_FRAME_H, type CharacterLook } from '../engine/assets/gen/characters';
import { propCabinet, propCounter, propPlant, propTicketMachine, propWallClock } from '../engine/assets/gen/props';
import type { GenOutput } from '../engine/assets/AssetRegistry';
import { Rng } from '../engine/core/math';
import { characters } from '../content/characters';

/**
 * Escena del reel de anuncio: una sala "en corte" como los interiores del juego (dos paredes
 * del fondo, piso isométrico, afiches, reloj y LED de turnos), con los personajes y props que
 * ya genera el motor. Sólo usa generadores puros: no necesita Phaser ni el mundo cargado.
 *
 * El lienzo es 9:16 exacto; la página lo escala sin suavizado (pixel art).
 */
export const ESCENA_W = 180;
export const ESCENA_H = 320;

// Sala: SALA_W baldosas a lo largo de la pared del fondo derecha (eje x), SALA_D a lo largo de la izquierda (eje y).
const SALA_W = 6;
const SALA_D = 5;
const PARED_H = 60;
// P(0,0,0) del piso en el lienzo: el ancho de la sala (SALA_W + SALA_D) · 16 cabe en 180 px.
const OX = 82;
const OY = 70;

const PISO_A = '#9aa191';
const PISO_B = '#8d9384';
const CREMA = 'wallCream';
const ZOCALO = 'wallTeal';
const TINTA = '#2a2622';
const PAPEL = '#efe9da';

/** Personajes del juego (los mismos looks que usa el motor). */
const tomi: CharacterLook = {
  body: 'kid',
  skin: 'skin0',
  hair: 'hairBrown',
  hairStyle: 'short',
  top: 'white',
  topStyle: 'guardapolvo',
  bottom: 'grey',
  shoes: 'black',
};

const ventanilla: CharacterLook = {
  body: 'adult',
  skin: 'skin2',
  hair: 'hairBlack',
  hairStyle: 'bun',
  top: 'muniTeal',
  topStyle: 'vest',
  bottom: 'black',
  shoes: 'black',
  glasses: true,
  lanyard: 'white',
};

interface Colocado {
  g: GenOutput;
  /** Punto de apoyo en baldosas. */
  x: number;
  y: number;
  /** Orden de profundidad (menor = más atrás). */
  k: number;
}

/** Un cuadro del spritesheet de personaje (16x24, pies en (8,23)). */
function cuadro(look: CharacterLook, frame: number): GenOutput {
  const hoja = drawCharacterSheet(look).pc;
  const pc = new PixelCanvas(CHAR_FRAME_W, CHAR_FRAME_H);
  for (let y = 0; y < CHAR_FRAME_H; y++) {
    for (let x = 0; x < CHAR_FRAME_W; x++) pc.put(x, y, hoja.get(frame * CHAR_FRAME_W + x, y));
  }
  return { pc, anchorX: 8, anchorY: 23 };
}

function suelo(iso: IsoPainter): void {
  const rng = new Rng(11);
  for (let x = 0; x < SALA_W; x++) {
    for (let y = 0; y < SALA_D; y++) {
      const c = shade((x + y) % 2 ? C(PISO_A) : C(PISO_B), rng.range(0.97, 1.03));
      const p = [iso.P(x, y), iso.P(x + 1, y), iso.P(x + 1, y + 1), iso.P(x, y + 1)];
      iso.pc.poly(p.flat(), c);
      for (let i = 0; i < 4; i++) {
        const [ax, ay] = p[i];
        const [bx, by] = p[(i + 1) % 4];
        iso.pc.line(ax, ay, bx, by, shade(c, 0.86));
      }
    }
  }
}

function paredes(iso: IsoPainter): void {
  const rng = new Rng(29);
  // u avanza hacia la derecha en pantalla: en la pared del eje x, u = x·16; en la del eje y, u = (SALA_D − y)·16.
  const fondoD = iso.faceY(0, SALA_W, 0);
  const fondoI = iso.faceX(0, SALA_D, 0);
  const cremaD = C(CREMA);
  const cremaI = shade(cremaD, 0.9);
  const lenD = SALA_W * 16;
  const lenI = SALA_D * 16;

  fondoD.rect(0, lenD, 0, PARED_H, cremaD);
  fondoD.rect(0, lenD, 0, 18, C(ZOCALO));
  fondoD.hline(0, lenD, 18, shade(C(ZOCALO), 0.7));
  fondoD.hline(0, lenD, PARED_H - 2, C('slate5'));

  fondoI.rect(0, lenI, 0, PARED_H, cremaI);
  fondoI.rect(0, lenI, 0, 18, shade(C(ZOCALO), 0.9));
  fondoI.hline(0, lenI, 18, shade(C(ZOCALO), 0.6));
  fondoI.hline(0, lenI, PARED_H - 2, shade(C('slate5'), 0.9));

  // manchas y roce de la pared (la misma textura sucia de los interiores)
  for (let i = 0; i < 220; i++) {
    fondoD.px(rng.range(0, lenD), rng.range(20, PARED_H - 4), shade(cremaD, rng.range(0.84, 0.96)));
  }
  for (let i = 0; i < 160; i++) {
    fondoI.px(rng.range(0, lenI), rng.range(20, PARED_H - 4), shade(cremaI, rng.range(0.84, 0.96)));
  }

  // ventana con parteluz (pared derecha)
  const marco = C('slate2');
  fondoD.rect(10, 36, 24, 52, marco);
  fondoD.rect(12, 34, 26, 50, C('#aebfcc'));
  fondoD.rect(22, 24, 26, 50, marco);
  fondoD.hline(12, 34, 38, marco);
  fondoD.rect(14, 18, 42, 45, C('#e6eff4'));

  // afiche de turnos: el "horario de atención" de la Municipalidad
  fondoD.rect(39, 73, 21, 53, C(TINTA));
  fondoD.rect(40, 72, 22, 52, C(PAPEL));
  fondoD.rect(40, 72, 42, 50, C('signRed'));
  const tTurno = measureText('TURNO');
  drawTextOnFace(fondoD, 'TURNO', 40 + Math.floor((32 - tTurno) / 2), 49, C('white'));
  const tHoras = measureText('8 A 13');
  drawTextOnFace(fondoD, '8 A 13', 40 + Math.floor((32 - tHoras) / 2), 36, C(TINTA));

  // reloj de pared
  const reloj = propWallClock();
  const rx = fondoD.x0 + 84;
  const ry = fondoD.bottom(84) - 40;
  iso.pc.blit(reloj.pc, rx - reloj.anchorX, ry - reloj.anchorY);

  // LED de turnos (pared izquierda), sobre el dispensador de números
  fondoI.rect(18, 64, 18, 46, C('slate8'));
  fondoI.rect(20, 62, 20, 44, C('#140807'));
  drawTextOnFace(fondoI, 'AHORA', 22, 41, C('#a33a2c'));
  const tNum = measureText('042');
  drawTextOnFace(fondoI, '042', 20 + Math.floor((42 - tNum) / 2), 28, C('#ff5a3c'));
}

/** Escena completa (piso, paredes y personajes) en un lienzo de ESCENA_W × ESCENA_H. */
export function drawEscena(): PixelCanvas {
  const pc = new PixelCanvas(ESCENA_W, ESCENA_H);
  const iso = new IsoPainter(pc, OX, OY);
  suelo(iso);
  paredes(iso);

  const cosas: Colocado[] = [
    { g: propCabinet(), x: 4.6, y: 0.2, k: 4.8 },
    { g: propTicketMachine(), x: 0.2, y: 1.8, k: 2.0 },
    { g: cuadro(ventanilla, 0), x: 2.6, y: 1.1, k: 3.7 },
    { g: propCounter({ axis: 'x', len: 3, glass: true, label: 'TASAS' }), x: 1.2, y: 2.2, k: 5.2 },
    { g: propPlant({}), x: 0.3, y: 4.3, k: 4.6 },
    { g: cuadro(characters.municipal.look, 6), x: 2.9, y: 3.9, k: 6.8 },
    { g: cuadro(tomi, 0), x: 4.6, y: 4.2, k: 8.8 },
  ];
  cosas.sort((a, b) => a.k - b.k);
  for (const c of cosas) {
    const [sx, sy] = iso.P(c.x, c.y, 0);
    pc.blit(c.g.pc, Math.round(sx - c.g.anchorX), Math.round(sy - c.g.anchorY));
  }
  return pc;
}
