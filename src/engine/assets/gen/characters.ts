import { PixelCanvas } from '../PixelCanvas';
import { C, shade, type Packed } from '../Palette';
import type { GenOutput } from '../AssetRegistry';

/**
 * Personajes placeholder por código. Cada personaje es una tira de 14 cuadros de 16x24:
 *   0-1  frente quieto   2-5  frente caminando
 *   6-7  espalda quieto  8-11 espalda caminando
 *   12   frente con teléfono   13 frente sentado
 * "Frente" mira abajo-derecha (E); espejado = abajo-izquierda (S).
 * "Espalda" mira arriba-derecha (N); espejado = arriba-izquierda (W).
 * Pies en y = 23, centro x = 8. Para arte final: mismo layout (ver ASSET_MANIFEST.md).
 */

export type HairStyle =
  | 'short'
  | 'long'
  | 'bun'
  | 'ponytail'
  | 'bald'
  | 'curly'
  | 'beanie'
  | 'cap'
  | 'boina';

export type TopStyle =
  | 'jacket'
  | 'puffer'
  | 'coat'
  | 'vest'
  | 'guardapolvo'
  | 'cardigan'
  | 'suit'
  | 'uniform'
  | 'sweater';

export interface CharacterLook {
  body: 'adult' | 'kid' | 'elder';
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  hat?: string;
  top: string;
  topStyle: TopStyle;
  accent?: string;
  bottom: string;
  shoes: string;
  beard?: 'mustache' | 'beard' | 'stubble';
  glasses?: boolean;
  lanyard?: string;
  backpack?: string;
  scarf?: string;
  tie?: string;
  holding?: 'folder' | 'broom' | 'mate' | 'phone' | 'bag' | 'sign';
  heavy?: boolean;
}

export const CHAR_FRAME_W = 16;
export const CHAR_FRAME_H = 24;
export const CHAR_FRAMES = 14;

interface Pose {
  view: 'front' | 'back';
  step: -1 | 0 | 1; // pierna adelantada (izq/der) o juntas
  bob: number; // desplazamiento vertical del torso (0 o -1)
  special?: 'phone' | 'sit';
}

const POSES: Pose[] = [
  { view: 'front', step: 0, bob: 0 },
  { view: 'front', step: 0, bob: 1 },
  { view: 'front', step: -1, bob: 0 },
  { view: 'front', step: 0, bob: -1 },
  { view: 'front', step: 1, bob: 0 },
  { view: 'front', step: 0, bob: -1 },
  { view: 'back', step: 0, bob: 0 },
  { view: 'back', step: 0, bob: 1 },
  { view: 'back', step: -1, bob: 0 },
  { view: 'back', step: 0, bob: -1 },
  { view: 'back', step: 1, bob: 0 },
  { view: 'back', step: 0, bob: -1 },
  { view: 'front', step: 0, bob: 0, special: 'phone' },
  { view: 'front', step: 0, bob: 0, special: 'sit' },
];

interface Metrics {
  headTop: number;
  headH: number;
  torsoTop: number;
  torsoH: number;
  legTop: number;
  legH: number;
  torsoL: number;
  torsoR: number;
  headL: number;
  headR: number;
}

function metrics(look: CharacterLook): Metrics {
  if (look.body === 'kid') {
    return {
      headTop: 9,
      headH: 6,
      torsoTop: 15,
      torsoH: 4,
      legTop: 19,
      legH: 3,
      torsoL: 5,
      torsoR: 10,
      headL: 5,
      headR: 10,
    };
  }
  const elder = look.body === 'elder' ? 1 : 0;
  const heavy = look.heavy ? 1 : 0;
  return {
    headTop: 3 + elder,
    headH: 7,
    torsoTop: 10 + elder,
    torsoH: 7 - elder,
    legTop: 17,
    legH: 5,
    torsoL: 4 - heavy,
    torsoR: 11 + heavy,
    headL: 5,
    headR: 10,
  };
}

function drawFrame(pc: PixelCanvas, ox: number, look: CharacterLook, pose: Pose): void {
  const m = metrics(look);
  const P = (x: number, y: number, c: Packed) => pc.set(ox + x, y, c);
  const R = (x: number, y: number, w: number, h: number, c: Packed) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) P(xx, yy, c);
  };

  const skin = C(look.skin);
  const skinS = shade(skin, 0.85);
  const hair = C(look.hair);
  const hairS = shade(hair, 0.78);
  const top = C(look.top);
  const topS = shade(top, 0.78);
  const topL = shade(top, 1.12);
  const bottom = C(look.bottom);
  const bottomS = shade(bottom, 0.78);
  const shoes = C(look.shoes);
  const hat = look.hat ? C(look.hat) : hair;
  const hatS = shade(hat, 0.78);
  const accent = look.accent ? C(look.accent) : topL;
  const eye = C('ink');

  const front = pose.view === 'front';
  const sit = pose.special === 'sit';
  const b = pose.bob; // bob positivo = baja 1px (respiración)
  const sitDrop = sit ? 3 : 0;

  // ---------------- piernas y zapatos ----------------
  const legTop = m.legTop + sitDrop;
  const legBottom = 21; // última fila de pantalón (zapatos 22-23)
  const legL = m.torsoL + 1;
  const legMid = 8;
  const legR = m.torsoR - 1;
  if (!sit) {
    const drawLeg = (x0: number, x1: number, lift: number, fwd: number) => {
      const yEnd = legBottom - lift + fwd;
      for (let y = legTop; y <= yEnd; y++) {
        for (let x = x0; x <= x1; x++) P(x, y, x === x1 ? bottomS : bottom);
      }
      // zapato
      R(x0, yEnd + 1, x1 - x0 + 1, 2, shoes);
      if (front) P(x1 + 1, yEnd + 2, shoes);
    };
    const coatLong = look.topStyle === 'coat' || look.topStyle === 'guardapolvo';
    drawLeg(legL, legMid - 1, pose.step === 1 ? 1 : 0, pose.step === -1 ? 0 : 0);
    drawLeg(legMid, legR, pose.step === -1 ? 1 : 0, 0);
    if (coatLong) {
      // faldón del abrigo / guardapolvo sobre los muslos
      const skirtH = look.body === 'kid' ? 2 : 3;
      R(m.torsoL, legTop, m.torsoR - m.torsoL + 1, skirtH, top);
      P(m.torsoR, legTop, topS);
      for (let y = legTop; y < legTop + skirtH; y++) P(m.torsoR, y, topS);
    }
  } else {
    // sentado: muslos hacia la cámara, zapatos abajo
    R(legL, 20, legR - legL + 1, 2, bottom);
    R(legL, 22, 3, 2, shoes);
    R(legMid, 22, 3, 2, shoes);
  }

  // ---------------- torso ----------------
  const tTop = m.torsoTop + b + sitDrop;
  const tBot = tTop + m.torsoH - 1 + (b < 0 ? -b : 0);
  for (let y = tTop; y <= Math.min(tBot, legTop + (sit ? 0 : 0)); y++) {
    for (let x = m.torsoL; x <= m.torsoR; x++) {
      let c = top;
      if (x === m.torsoR) c = topS;
      if (x === m.torsoL) c = topL;
      P(x, y, c);
    }
  }
  // Hombros redondeados
  P(m.torsoL, tTop, 0);
  P(m.torsoR, tTop, 0);
  pc.put(ox + m.torsoL, tTop, 0);
  pc.put(ox + m.torsoR, tTop, 0);

  const cx = 8;
  if (front) {
    switch (look.topStyle) {
      case 'jacket':
      case 'coat':
        for (let y = tTop + 1; y <= tBot; y++) P(cx, y, accent);
        P(cx - 1, tTop, C('frame'));
        P(cx, tTop, C('frame'));
        break;
      case 'puffer':
        for (let x = m.torsoL; x <= m.torsoR; x++) {
          P(x, tTop + 2, topS);
          if (m.torsoH > 5) P(x, tTop + 4, topS);
        }
        for (let y = tTop + 1; y <= tBot; y++) P(cx, y, shade(top, 0.7));
        break;
      case 'vest': {
        const shirt = C(look.accent ?? 'navy');
        for (let y = tTop; y <= tBot; y++) {
          P(cx - 1, y, shirt);
          P(cx, y, shirt);
        }
        for (let x = m.torsoL; x <= m.torsoR; x++) if (x < cx - 1 || x > cx) P(x, tTop + 3, C('slate1'));
        break;
      }
      case 'guardapolvo':
        for (let y = tTop + 1; y <= tBot; y += 2) P(cx, y, C('slate3'));
        P(cx - 1, tTop, C('slate2'));
        P(cx + 1, tTop, C('slate2'));
        break;
      case 'cardigan':
        for (let y = tTop; y <= tBot; y++) P(cx, y, shade(top, 0.65));
        P(cx - 1, tTop, C('frame'));
        break;
      case 'suit':
        P(cx - 1, tTop, C('frame'));
        P(cx, tTop, C('frame'));
        P(cx - 1, tTop + 1, C('frame'));
        for (let y = tTop; y <= tBot - 1; y++) P(cx, y, C(look.tie ?? 'red'));
        break;
      case 'uniform':
        for (let x = m.torsoL; x <= m.torsoR; x++) P(x, tTop + 1, accent);
        break;
      case 'sweater':
        for (let x = m.torsoL + 1; x < m.torsoR; x++) P(x, tBot, topS);
        break;
    }
    if (look.lanyard) {
      const l = C(look.lanyard);
      P(cx - 2, tTop, l);
      P(cx - 1, tTop + 1, l);
      P(cx - 1, tTop + 2, l);
      P(cx - 1, tTop + 3, C('frame'));
      P(cx, tTop + 3, C('frame'));
      P(cx - 1, tTop + 4, C('glassLight'));
    }
    if (look.scarf) {
      const s = C(look.scarf);
      for (let x = m.torsoL + 1; x < m.torsoR; x++) P(x, tTop, s);
      P(cx + 1, tTop + 1, s);
      P(cx + 1, tTop + 2, shade(s, 0.8));
    }
    if (look.backpack) {
      const s = C(look.backpack);
      P(m.torsoL + 1, tTop, s);
      P(m.torsoL + 1, tTop + 1, s);
      P(m.torsoR - 1, tTop, s);
      P(m.torsoR - 1, tTop + 1, s);
    }
  } else {
    // espalda
    if (look.topStyle === 'puffer') for (let x = m.torsoL; x <= m.torsoR; x++) P(x, tTop + 2, topS);
    if (look.topStyle === 'vest') for (let x = m.torsoL; x <= m.torsoR; x++) P(x, tTop + 3, C('slate1'));
    if (look.backpack) {
      const s = C(look.backpack);
      const bw = m.torsoR - m.torsoL - 1;
      R(m.torsoL + 1, tTop + 1, bw, Math.min(4, m.torsoH), s);
      for (let x = m.torsoL + 1; x < m.torsoL + 1 + bw; x++) P(x, tTop + 1, shade(s, 1.15));
      P(m.torsoR - 1, tTop + 2, shade(s, 0.75));
    }
    if (look.scarf) for (let x = m.torsoL + 1; x < m.torsoR; x++) P(x, tTop, C(look.scarf));
  }

  // ---------------- brazos ----------------
  const armTop = tTop + 1;
  const armLen = Math.max(3, m.torsoH - 1);
  const swingL = pose.step === -1 ? 1 : pose.step === 1 ? -1 : 0;
  const swingR = -swingL;
  const drawArm = (x: number, swing: number, shadeIt: boolean) => {
    for (let y = armTop; y < armTop + armLen + swing; y++) P(x, y, shadeIt ? topS : top);
    P(x, armTop + armLen + swing, skin);
  };
  if (pose.special === 'phone') {
    drawArm(m.torsoL - 1, 0, false);
    // brazo derecho levantado al oído
    const ax = m.torsoR + 1;
    for (let y = m.headTop + 3 + b; y < armTop + 2; y++) P(ax, y, topS);
    P(ax - 1, m.headTop + 3, skin);
    P(ax - 1, m.headTop + 2, C('ink'));
    P(ax - 1, m.headTop + 4, C('ink'));
  } else if (!sit) {
    drawArm(m.torsoL - 1, swingL, false);
    drawArm(m.torsoR + 1, swingR, true);
  } else {
    drawArm(m.torsoL - 1, -1, false);
    drawArm(m.torsoR + 1, -1, true);
  }

  // Objetos en mano (sólo frente)
  if (front && look.holding && !sit) {
    const hy = armTop + armLen;
    switch (look.holding) {
      case 'folder': {
        const f = C('#c9b27a');
        R(cx - 2, tTop + 2, 5, 4, f);
        for (let x = cx - 2; x < cx + 3; x++) P(x, tTop + 2, shade(f, 1.1));
        P(cx + 2, tTop + 3, shade(f, 0.75));
        P(cx - 3, tTop + 4, skin);
        break;
      }
      case 'broom':
        for (let y = m.headTop + 4; y <= 21; y++) P(m.torsoR + 2, y, C('wood'));
        R(m.torsoR + 1, 21, 3, 2, C('mustard'));
        break;
      case 'mate':
        P(m.torsoR + 1, hy - 1, C('#6b4a2a'));
        P(m.torsoR + 1, hy - 2, C('#c7c7c7'));
        break;
      case 'phone':
        P(m.torsoR + 1, hy - 1, C('ink'));
        break;
      case 'bag':
        R(m.torsoR + 1, hy, 3, 3, C('anOrange'));
        break;
      case 'sign': {
        // cartel sostenido con las dos manos, delante del pecho
        const bx = cx - 3;
        const by = tTop + 1;
        const red = C('#b3322a');
        R(bx, by, 7, 5, C('#f2e6c8'));
        for (let x = bx; x < bx + 7; x++) {
          P(x, by, red);
          P(x, by + 4, red);
        }
        P(bx, by + 2, red);
        P(bx + 6, by + 2, red);
        P(bx + 2, by + 2, C('ink'));
        P(bx + 4, by + 2, C('ink'));
        P(bx - 1, by + 3, skin);
        P(bx + 7, by + 3, skin);
        break;
      }
    }
  }
  // de espalda, el cartel se ve de canto a un costado
  if (!front && look.holding === 'sign' && !sit) R(m.torsoR + 1, tTop, 2, 6, C('#c9b27a'));

  // ---------------- cabeza ----------------
  const hT = m.headTop + b + sitDrop;
  const hL = m.headL;
  const hR = m.headR;
  const hB = hT + m.headH - 1;
  const faceTop = hT + 2;
  // base de piel
  for (let y = faceTop; y <= hB; y++) {
    for (let x = hL; x <= hR; x++) P(x, y, x === hR ? skinS : skin);
  }
  // mentón redondeado
  pc.put(ox + hL, hB, 0);
  pc.put(ox + hR, hB, 0);

  if (front) {
    const eyeY = faceTop + (look.body === 'kid' ? 2 : 2);
    P(hL + 2, eyeY, eye);
    P(hL + 4, eyeY, eye);
    if (look.glasses) {
      const g = C('slate8');
      P(hL + 1, eyeY, g);
      P(hL + 3, eyeY, g);
      P(hL + 5, eyeY, g);
    }
    if (look.beard === 'mustache') {
      P(hL + 2, eyeY + 2, hair);
      P(hL + 3, eyeY + 2, hair);
      P(hL + 4, eyeY + 2, hair);
    } else if (look.beard === 'beard') {
      for (let x = hL; x <= hR; x++) P(x, hB, hairS);
      P(hL + 2, eyeY + 2, hair);
      P(hL + 3, eyeY + 2, hair);
      P(hL + 4, eyeY + 2, hair);
      P(hL, hB - 1, hairS);
      P(hR, hB - 1, hairS);
    } else if (look.beard === 'stubble') {
      P(hL + 1, hB, skinS);
      P(hL + 3, hB, skinS);
    } else if (look.body !== 'kid') {
      P(hL + 3, eyeY + 2, skinS);
    }
    // mejilla
    if (look.body === 'kid') P(hL + 1, eyeY + 1, C('#d9967f'));
  } else {
    // nuca: cubierta por pelo
    for (let y = faceTop; y <= hB - 1; y++) for (let x = hL; x <= hR; x++) P(x, y, x === hR ? hairS : hair);
    P(hL, faceTop + 2, skinS);
    P(hR, faceTop + 2, skinS);
  }

  // pelo / gorro
  const drawHairTop = (rows: number) => {
    for (let y = hT; y < hT + rows; y++) for (let x = hL; x <= hR; x++) P(x, y, x === hR ? hairS : hair);
    pc.put(ox + hL, hT, 0);
    pc.put(ox + hR, hT, 0);
    P(hL + 1, hT, hair);
    P(hR - 1, hT, hairS);
  };
  switch (look.hairStyle) {
    case 'short':
      drawHairTop(2);
      if (front) {
        P(hL, faceTop, hair);
        P(hL + 1, faceTop, hair);
        P(hR, faceTop, hairS);
      }
      break;
    case 'long':
      drawHairTop(2);
      for (let y = faceTop; y <= hB + 3; y++) {
        P(hL - (y > hB ? 0 : 0), y, hair);
        P(hR, y, hairS);
        if (y > faceTop + 1) {
          P(hL - 1, y, hair);
          P(hR + 1, y, hairS);
        }
      }
      if (!front) for (let y = hB; y <= hB + 3; y++) for (let x = hL; x <= hR; x++) P(x, y, hair);
      if (front) P(hL + 1, faceTop, hair);
      break;
    case 'bun':
      drawHairTop(2);
      R(7, hT - 2, 2, 2, hair);
      if (front) {
        P(hL, faceTop, hair);
        P(hR, faceTop, hairS);
      }
      break;
    case 'ponytail':
      drawHairTop(2);
      if (front) {
        P(hL, faceTop, hair);
        P(hR + 1, faceTop + 1, hairS);
        P(hR + 1, faceTop + 2, hairS);
      } else {
        P(8, hB + 1, hair);
        P(8, hB + 2, hair);
        P(7, hB + 1, hair);
      }
      break;
    case 'bald':
      if (front) {
        for (let x = hL; x <= hR; x++) P(x, hT + 1, skin);
        for (let x = hL + 1; x < hR; x++) P(x, hT, skin);
      } else {
        for (let x = hL; x <= hR; x++) P(x, hT + 1, skin);
        for (let x = hL + 1; x < hR; x++) P(x, hT, skin);
        for (let x = hL; x <= hR; x++) P(x, faceTop + 1, hair);
      }
      P(hL, faceTop + 1, hair);
      P(hR, faceTop + 1, hairS);
      break;
    case 'curly':
      for (let y = hT - 1; y < hT + 2; y++) for (let x = hL - 1; x <= hR + 1; x++) P(x, y, (x + y) % 2 ? hair : hairS);
      pc.put(ox + hL - 1, hT - 1, 0);
      pc.put(ox + hR + 1, hT - 1, 0);
      P(hL - 1, faceTop, hair);
      P(hR + 1, faceTop, hairS);
      P(hL - 1, faceTop + 1, hairS);
      P(hR + 1, faceTop + 1, hairS);
      break;
    case 'beanie':
      for (let y = hT - 1; y < hT + 2; y++) for (let x = hL; x <= hR; x++) P(x, y, x === hR ? hatS : hat);
      pc.put(ox + hL, hT - 1, 0);
      pc.put(ox + hR, hT - 1, 0);
      for (let x = hL; x <= hR; x++) P(x, hT + 1, hatS);
      P(7, hT - 2, shade(hat, 1.15));
      P(8, hT - 2, shade(hat, 1.15));
      if (front) {
        P(hL, faceTop, hair);
        P(hR, faceTop, hairS);
      }
      break;
    case 'cap':
      drawHairTop(1);
      for (let x = hL; x <= hR; x++) P(x, hT, hat);
      for (let x = hL; x <= hR; x++) P(x, hT + 1, x === hR ? hatS : hat);
      if (front) {
        P(hR + 1, hT + 2, hatS);
        P(hR, hT + 2, hatS);
        P(hR - 1, hT + 2, hatS);
      }
      break;
    case 'boina':
      for (let x = hL - 1; x <= hR + 1; x++) P(x, hT, hat);
      for (let x = hL; x <= hR; x++) P(x, hT + 1, x === hR ? hatS : hat);
      if (front) {
        P(hL, faceTop, hairS);
        P(hR + 1, hT + 1, hatS);
      }
      break;
  }

  if (!front && (look.hairStyle === 'beanie' || look.hairStyle === 'cap' || look.hairStyle === 'boina')) {
    // en espalda el gorro tapa todo arriba
    for (let x = hL; x <= hR; x++) P(x, hT, hat);
  }
}

export function drawCharacterSheet(look: CharacterLook): GenOutput {
  const pc = new PixelCanvas(CHAR_FRAME_W * CHAR_FRAMES, CHAR_FRAME_H);
  for (let i = 0; i < CHAR_FRAMES; i++) {
    const frame = new PixelCanvas(CHAR_FRAME_W, CHAR_FRAME_H);
    drawFrame(frame, 0, look, POSES[i]);
    frame.outline(C('ink', 235));
    pc.blit(frame, i * CHAR_FRAME_W, 0);
  }
  return { pc, frameW: CHAR_FRAME_W, frameH: CHAR_FRAME_H, anchorX: 8, anchorY: 23 };
}

// ---------------------------------------------------------------------------
// Retratos 32x32 para los diálogos
// ---------------------------------------------------------------------------

export function drawPortrait(look: CharacterLook): PixelCanvas {
  const S = 32;
  const pc = new PixelCanvas(S, S);
  const skin = C(look.skin);
  const skinS = shade(skin, 0.86);
  const skinD = shade(skin, 0.72);
  const hair = C(look.hair);
  const hairS = shade(hair, 0.75);
  const hairL = shade(hair, 1.2);
  const top = C(look.top);
  const topS = shade(top, 0.78);
  const topL = shade(top, 1.12);
  const hat = look.hat ? C(look.hat) : hair;
  const hatS = shade(hat, 0.78);
  const ink = C('ink');
  const kid = look.body === 'kid';
  const elder = look.body === 'elder';

  // hombros / torso
  const sh0 = kid ? 8 : 5;
  const sh1 = kid ? 23 : 26;
  const shoulderTop = kid ? 25 : 23;
  for (let y = shoulderTop; y < S; y++) {
    const inset = Math.max(0, 2 - (y - shoulderTop));
    for (let x = sh0 + inset; x <= sh1 - inset; x++) {
      pc.set(x, y, x > sh1 - 4 ? topS : x < sh0 + 3 ? topL : top);
    }
  }
  // cuello
  const hx0 = kid ? 9 : 10;
  const hx1 = kid ? 22 : 21;
  const hy0 = kid ? 8 : 6;
  const hy1 = kid ? 24 : 22;
  for (let y = hy1 - 1; y <= shoulderTop + 1; y++) for (let x = 14; x <= 17; x++) pc.set(x, y, skinS);
  // detalles de ropa
  if (look.topStyle === 'suit') {
    pc.rect(14, shoulderTop, 4, 3, C('frame'));
    pc.rect(15, shoulderTop + 1, 2, S - shoulderTop, C(look.tie ?? 'red'));
  } else if (look.topStyle === 'vest') {
    pc.rect(13, shoulderTop, 6, S - shoulderTop, C(look.accent ?? 'navy'));
    for (let x = sh0; x <= sh1; x++) if (x < 13 || x > 18) pc.set(x, shoulderTop + 5, C('slate1'));
  } else if (look.topStyle === 'guardapolvo') {
    pc.rect(13, shoulderTop, 6, 2, C('slate2'));
  } else if (look.topStyle === 'puffer') {
    for (let x = sh0 + 1; x < sh1; x++) pc.set(x, shoulderTop + 4, topS);
    pc.vline(16, shoulderTop, S, shade(top, 0.65));
  } else {
    pc.rect(14, shoulderTop, 4, 2, C('frame'));
    pc.vline(16, shoulderTop + 2, S, look.accent ? C(look.accent) : topS);
  }
  if (look.scarf) pc.rect(sh0 + 3, shoulderTop - 1, sh1 - sh0 - 5, 3, C(look.scarf));
  if (look.lanyard) {
    pc.line(12, shoulderTop, 14, S - 3, C(look.lanyard));
    pc.rect(13, S - 4, 4, 4, C('frame'));
  }
  if (look.backpack) {
    pc.rect(sh0 + 2, shoulderTop, 2, S - shoulderTop, C(look.backpack));
    pc.rect(sh1 - 3, shoulderTop, 2, S - shoulderTop, C(look.backpack));
  }

  // cara
  for (let y = hy0 + 2; y <= hy1; y++) {
    for (let x = hx0; x <= hx1; x++) {
      const cornerCut = (y > hy1 - 3 && (x < hx0 + (y - (hy1 - 3)) || x > hx1 - (y - (hy1 - 3)))) as boolean;
      if (cornerCut) continue;
      pc.set(x, y, x >= hx1 - 1 ? skinS : skin);
    }
  }
  // orejas
  pc.rect(hx0 - 1, hy0 + 8, 1, 3, skinS);
  pc.rect(hx1 + 1, hy0 + 8, 1, 3, skinD);

  const eyeY = hy0 + (kid ? 9 : 8);
  // ojos
  pc.rect(hx0 + 3, eyeY, 2, 2, ink);
  pc.rect(hx1 - 4, eyeY, 2, 2, ink);
  pc.set(hx0 + 3, eyeY, C('white'));
  pc.set(hx1 - 4, eyeY, C('white'));
  // cejas
  pc.hline(hx0 + 2, hx0 + 5, eyeY - 2, hairS);
  pc.hline(hx1 - 5, hx1 - 2, eyeY - 2, hairS);
  if (elder) {
    pc.set(hx0 + 2, eyeY + 2, skinD);
    pc.set(hx1 - 2, eyeY + 2, skinD);
  }
  // nariz
  pc.vline(15, eyeY + 1, eyeY + 3, skinS);
  pc.set(16, eyeY + 4, skinD);
  // boca
  const mouthY = eyeY + (kid ? 5 : 6);
  pc.hline(14, 18, mouthY, skinD);
  if (kid) {
    pc.set(hx0 + 2, eyeY + 3, C('#d9967f'));
    pc.set(hx1 - 2, eyeY + 3, C('#d9967f'));
  }
  if (look.glasses) {
    const g = C('slate8');
    for (const gx of [hx0 + 2, hx1 - 5]) {
      pc.hline(gx, gx + 3, eyeY - 1, g);
      pc.hline(gx, gx + 3, eyeY + 2, g);
      pc.vline(gx, eyeY - 1, eyeY + 2, g);
      pc.vline(gx + 3, eyeY - 1, eyeY + 2, g);
    }
    pc.hline(hx0 + 6, hx1 - 6, eyeY, g);
  }
  if (look.beard === 'mustache') {
    pc.hline(13, 19, mouthY - 1, hair);
    pc.hline(14, 18, mouthY - 2, hairS);
  } else if (look.beard === 'beard') {
    for (let y = mouthY - 1; y <= hy1; y++) {
      for (let x = hx0; x <= hx1; x++) {
        if (y === mouthY && x >= 14 && x <= 18) continue;
        if (pc.get(x, y) !== 0) pc.set(x, y, (x + y) % 3 ? hair : hairS);
      }
    }
  } else if (look.beard === 'stubble') {
    for (let x = hx0 + 2; x <= hx1 - 2; x += 2) pc.set(x, hy1 - 1, skinD);
  }

  // pelo
  const topHair = (rows: number, fringe = true) => {
    for (let y = hy0; y < hy0 + rows; y++) {
      for (let x = hx0 - 1; x <= hx1 + 1; x++) {
        const edge = y === hy0 && (x < hx0 + 1 || x > hx1 - 1);
        if (edge) continue;
        pc.set(x, y, x > hx1 - 2 ? hairS : y === hy0 + 1 && x < hx0 + 4 ? hairL : hair);
      }
    }
    if (fringe) {
      pc.rect(hx0, hy0 + rows, 5, 1, hair);
      pc.rect(hx0, hy0 + rows + 1, 2, 1, hair);
    }
    pc.rect(hx0 - 1, hy0 + rows, 1, 4, hair);
    pc.rect(hx1 + 1, hy0 + rows, 1, 4, hairS);
  };
  switch (look.hairStyle) {
    case 'short':
      topHair(4);
      break;
    case 'long':
      topHair(4);
      pc.rect(hx0 - 2, hy0 + 3, 2, 18, hair);
      pc.rect(hx1 + 1, hy0 + 3, 2, 18, hairS);
      break;
    case 'bun':
      topHair(4, false);
      pc.ellipse(16, hy0 - 1, 3.5, 3, hair);
      break;
    case 'ponytail':
      topHair(4, false);
      pc.rect(hx1 + 1, hy0 + 4, 2, 9, hairS);
      break;
    case 'bald':
      pc.rect(hx0, hy0 + 2, hx1 - hx0 + 1, 3, skin);
      pc.rect(hx0 - 1, hy0 + 5, 2, 5, hair);
      pc.rect(hx1, hy0 + 5, 2, 5, hairS);
      break;
    case 'curly':
      for (let y = hy0 - 2; y < hy0 + 5; y++)
        for (let x = hx0 - 2; x <= hx1 + 2; x++) {
          const d = Math.hypot(x - 16, (y - (hy0 + 2)) * 1.4);
          if (d < 10) pc.set(x, y, (x * 3 + y * 5) % 4 === 0 ? hairS : (x + y) % 3 === 0 ? hairL : hair);
        }
      pc.rect(hx0 - 2, hy0 + 4, 2, 7, hair);
      pc.rect(hx1 + 1, hy0 + 4, 2, 7, hairS);
      break;
    case 'beanie':
      for (let y = hy0 - 2; y < hy0 + 5; y++)
        for (let x = hx0 - 1; x <= hx1 + 1; x++) {
          if (y === hy0 - 2 && (x < hx0 + 1 || x > hx1 - 1)) continue;
          pc.set(x, y, x > hx1 - 1 ? hatS : hat);
        }
      pc.hline(hx0 - 1, hx1 + 1, hy0 + 4, hatS);
      pc.hline(hx0 - 1, hx1 + 1, hy0 + 3, hatS);
      pc.ellipse(16, hy0 - 3, 2.5, 2, shade(hat, 1.18));
      pc.rect(hx0 - 1, hy0 + 5, 1, 3, hair);
      pc.rect(hx1 + 1, hy0 + 5, 1, 3, hairS);
      break;
    case 'cap':
      topHair(3, false);
      pc.rect(hx0 - 1, hy0, hx1 - hx0 + 3, 4, hat);
      pc.hline(hx0 + 4, hx1 + 4, hy0 + 4, hatS);
      pc.hline(hx0 + 5, hx1 + 3, hy0 + 5, hatS);
      break;
    case 'boina':
      topHair(4, false);
      pc.rect(hx0 - 2, hy0, hx1 - hx0 + 5, 3, hat);
      pc.hline(hx0 - 2, hx1 + 2, hy0 + 3, hatS);
      break;
  }
  pc.outline(C('ink', 230));
  return pc;
}
