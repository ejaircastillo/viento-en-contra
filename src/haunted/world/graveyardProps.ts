import * as THREE from 'three';
import type { BuildCtx, Interactable } from './ctx';
import { CAMP, CRYPT, LAND } from './graveyard';
import { makeCrossMonument, makeFence, makeLantern, makeTombstone } from './propsGrave';
import { makeAutumnTree, makeDeadTree } from './trees';
import { makeCampfire, makeLogSeat, makeMushrooms, makePumpkin, makeRock, type Campfire } from './propsCamp';
import { makeMausoleum, type Mausoleum } from './mausoleum';
import { blob, merge, xf } from '../gfx/geom';

/**
 * Colocación de todos los props del cementerio según el plano: dónde va cada lápida, cerco, farol, árbol y
 * calabaza. Devuelve lo que el resto del juego necesita (la cripta, la fogata, los interactuables y los
 * puntos de los árboles para la hojarasca).
 */
export interface GraveyardProps {
  crypt: Mausoleum;
  camp: Campfire;
  interactables: Interactable[];
  treeSpots: [number, number, number][];
  /** Posición de los puntos clave que usa la historia. */
  spots: { seal: [number, number]; dogGrave: [number, number]; skeleton: [number, number, number] };
}

/** Lápidas con inscripción: [x, z, variante, vela]. Los textos viven en game/story.ts (por id grave_N). */
const GRAVES: [number, number, 'round' | 'pointed' | 'cross', boolean][] = [
  [-12.6, -8.9, 'round', true],
  [-10.1, -9.6, 'pointed', false],
  [-7.6, -8.7, 'round', true],
  [-5.0, -9.9, 'cross', false],
  [-10.9, -2.7, 'round', false],
  [-8.3, -3.0, 'pointed', true],
  [6.6, -10.6, 'round', false],
  [9.4, -11.4, 'cross', true],
  [16.4, -8.6, 'round', false],
  [17.2, 1.6, 'pointed', false],
];

export function placeGraveyardProps(ctx: BuildCtx, group: THREE.Group): GraveyardProps {
  const interactables: Interactable[] = [];
  const add = (o: THREE.Object3D) => {
    group.add(o);
    return o;
  };

  // cripta y fogata
  const crypt = makeMausoleum(ctx, CRYPT.x, CRYPT.z);
  add(crypt.group);
  const camp = makeCampfire(ctx, CAMP.x, CAMP.z);
  add(camp.group);

  // troncos para sentarse alrededor del fuego (el esqueleto ocupa el primero)
  const skelAt: [number, number] = [7.3, 2.45];
  const skelYaw = Math.atan2(CAMP.x - skelAt[0], CAMP.z - skelAt[1]);
  add(makeLogSeat(ctx, skelAt[0] - 0.15, skelAt[1] - 0.1, skelYaw));
  add(makeLogSeat(ctx, 11.6, 5.7, Math.atan2(CAMP.x - 11.6, CAMP.z - 5.7), 1.5));
  add(makeLogSeat(ctx, 10.9, 0.8, Math.atan2(CAMP.x - 10.9, CAMP.z - 0.8), 1.4));

  // lápidas
  GRAVES.forEach(([x, z, top, candle], i) => {
    const t = makeTombstone(ctx, x, z, { top, candle });
    add(t);
    interactables.push({ id: `grave_${i + 1}`, label: 'Inspeccionar', x, z: z + 0.5, radius: 1.7, outline: [t], tagY: 1.6, kind: 'inspect', enabled: true });
  });

  // monumento de cruz a un costado del camino a la cripta
  const mon = makeCrossMonument(ctx, 5.4, -4.6);
  add(mon);
  interactables.push({ id: 'monument', label: 'Inspeccionar', x: 5.4, z: -3.6, radius: 1.9, outline: [mon], tagY: 2.6, kind: 'inspect', enabled: true });

  // parcela de Pelusa: montículo, lápida pequeña y cerquita
  const dg: [number, number] = [-11.2, 9.0];
  const mound = new THREE.Mesh(merge([xf(blob(0.9, 1, 0.12, 4, [1.3, 0.28, 0.75], '#3b3024'), [0, 0.08, 0])]), ctx.mats.vertex);
  mound.position.set(dg[0] + 0.1, 0, dg[1] + 0.9);
  mound.receiveShadow = true;
  add(mound);
  const pelusa = makeTombstone(ctx, dg[0], dg[1], { top: 'round', w: 0.62, h: 0.8, candle: true, yaw: Math.PI / 4 + 0.15, lean: 0.03 });
  add(pelusa);
  interactables.push({ id: 'grave_dog', label: 'Inspeccionar', x: dg[0] + 0.5, z: dg[1] + 0.5, radius: 1.8, outline: [pelusa], tagY: 1.4, kind: 'inspect', enabled: true });
  add(makeFence(ctx, [[-13.4, 7.2], [-8.4, 7.2], [-8.4, 11.6], [-13.4, 11.6], [-13.4, 7.2]], { damage: 0.1, h: 0.95, post: 2.5 }));

  // cercos rotos del costado oeste y detrás de las lápidas del fondo
  add(makeFence(ctx, [[-16.4, -10.5], [-16.4, -1.6], [-15.6, 4.2]], { damage: 0.3 }));
  add(makeFence(ctx, [[-14.8, -12.4], [-6.4, -12.7]], { damage: 0.35 }));

  // faroles: en poste y en el piso
  const posts: [number, number][] = [[1.9, -0.6], [-3.1, -3.4], [4.6, -6.8], [7.3, 6.6], [-7.0, 2.3], [0.2, -8.7], [5.0, -8.7]];
  posts.forEach(([x, z]) => add(makeLantern(ctx, x, z, true, 0.3)));
  const floors: [number, number][] = [[-2.0, 3.7], [3.7, 4.7], [13.3, -6.0], [11.6, 7.6], [-9.3, -4.0]];
  floors.forEach(([x, z]) => add(makeLantern(ctx, x, z, false, 0.5)));

  // árboles secos y de otoño (las posiciones de los de otoño alimentan la hojarasca)
  const treeSpots: [number, number, number][] = [];
  ([[-12.6, 1.6, 1.15], [11.4, -4.4, 1.0], [-4.2, 11.6, 1.1], [17.6, 9.6, 1.2], [-17.4, -5.4, 1.0]] as const).forEach(([x, z, s], i) => add(makeDeadTree(ctx, x, z, s, i + 1)));
  ([[5.7, 8.6, 1.1], [-8.4, -12.6, 1.05], [18.4, -10.8, 1.15], [-18.4, 6.6, 1.1], [2.4, 13.2, 1.0], [14.6, 12.2, 1.0]] as const).forEach(([x, z, s], i) => {
    add(makeAutumnTree(ctx, x, z, s, i + 11));
    treeSpots.push([x, z, 2.8]);
  });

  // calabazas, rocas y hongos
  ([[8.1, 6.6, true], [11.8, 1.1, true], [0.9, -9.3, true], [-8.4, 3.9, false], [15.6, 5.2, false]] as const).forEach(([x, z, lit]) => add(makePumpkin(ctx, x, z, lit, 0.95 + ctx.rnd() * 0.3)));
  for (let i = 0; i < 16; i++) {
    const x = (ctx.rnd() - 0.5) * (LAND.w - 6);
    const z = (ctx.rnd() - 0.5) * (LAND.d - 6);
    if (ctx.cols.hitsObstacle(x, z, 0.8)) continue;
    add(makeRock(ctx, x, z, 0.28 + ctx.rnd() * 0.3));
  }
  ([[-6.0, 12.3], [9.8, -9.6], [16.2, 7.4], [-14.6, 3.6], [4.2, -13.2]] as const).forEach(([x, z]) => add(makeMushrooms(ctx, x, z)));

  return {
    crypt,
    camp,
    interactables,
    treeSpots,
    spots: { seal: [-13.2, 2.8], dogGrave: dg, skeleton: [skelAt[0], skelAt[1], skelYaw] },
  };
}
