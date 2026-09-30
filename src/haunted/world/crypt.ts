import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Materials } from '../gfx/materials';
import type { LightPool } from '../gfx/lights';
import type { Quality } from '../core/quality';
import { CRYPT_RIG } from '../core/cameraRig';
import { rng } from '../core/noise';
import { Colliders } from './colliders';
import type { BuildCtx, Interactable } from './ctx';
import { shadows } from './ctx';
import type { Area } from './area';
import { V3, aoBottom, boxUV, jitterColor, merge, prep, xf } from '../gfx/geom';
import { floorTiles } from '../gfx/textures';
import { makeLutin } from './chars';
import { makeBarrel, makeBoneCrate, makeCauldronTable, makeChest, makeCobweb, makeCoffin, makeDesk, makeProduceCrate, makeSconce, makeShelf, makeSkull } from './propsCrypt';
import { makeLantern } from './propsGrave';

/**
 * La cripta: una habitación en corte flotando en el vacío. Los dos muros del fondo son altos, con pilares y
 * remates de piedra; los dos del frente se bajan para ver adentro (como en la referencia). Piso de baldosas
 * de pizarra, antorchas, el escritorio de Lutin, un ataúd con esqueleto, cofres y una puerta de salida.
 */
export const ROOM = { w: 10, d: 8, wallH: 3.3, lowH: 0.95, t: 0.55 };

export interface CryptArea extends Area {
  lutinSeatX: number;
  setExitOpen: (v: number) => void;
}

export function buildCrypt(mats: Materials, pool: LightPool, quality: Quality): CryptArea {
  const group = new THREE.Group();
  const cols = new Colliders();
  const hw = ROOM.w / 2;
  const hd = ROOM.d / 2;
  cols.bounds = [-hw + 0.1, -hd + 0.1, hw - 0.1, hd - 0.1];
  const ctx: BuildCtx = { mats, pool, cols, quality, area: 'crypt', rnd: rng(7), tick: [] };

  // piso de baldosas
  const tiles = floorTiles(ROOM.w, ROOM.d, quality.id === 'low' ? 80 : 128);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshStandardMaterial({ map: tiles.map, bumpMap: tiles.bump, bumpScale: 1.2, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w + 2 * ROOM.t, 1.2, ROOM.d + 2 * ROOM.t), new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 1 }));
  slab.position.y = -0.62;
  group.add(slab);

  // muros: fondo (norte y oeste) altos; frente (este y sur) bajos
  const T = ROOM.t;
  const wallCol = (y: number) => new THREE.Color('#6b7789').multiplyScalar(0.55 + 0.45 * Math.min(1, y / 1.6));
  const walls: THREE.BufferGeometry[] = [];
  const addWall = (w: number, h: number, d: number, x: number, z: number, low = false) => {
    const box = new RoundedBoxGeometry(w, h, d, 2, 0.03);
    walls.push(prep(xf(box, [x, h / 2, z]), (_px, py) => (low ? new THREE.Color('#7f8b9b') : wallCol(py))));
  };
  const doorX = 2.6;
  const doorW = 1.7;
  // norte: dos tramos y dintel alrededor de la puerta
  const nz = -hd - T / 2;
  addWall(doorX - doorW / 2 + hw + T, ROOM.wallH, T, (-hw - T + (doorX - doorW / 2)) / 2, nz);
  addWall(hw + T - (doorX + doorW / 2), ROOM.wallH, T, (doorX + doorW / 2 + hw + T) / 2, nz);
  walls.push(prep(xf(new RoundedBoxGeometry(doorW + 0.3, ROOM.wallH - 2.45, T, 2, 0.03), [doorX, 2.45 + (ROOM.wallH - 2.45) / 2, nz]), '#7f8b9b'));
  addWall(T, ROOM.wallH, ROOM.d + T, -hw - T / 2, -T / 2);
  addWall(T, ROOM.lowH, ROOM.d + T, hw + T / 2, T / 2, true);
  addWall(ROOM.w + 2 * T, ROOM.lowH, T, 0, hd + T / 2, true);
  const wg = boxUV(merge(walls), 0.5);
  jitterColor(wg, 0.05, 2);
  aoBottom(wg, 0, 0.9, 0.7);
  group.add(new THREE.Mesh(wg, mats.plaster));

  // remates de piedra y pilares
  const stone: THREE.BufferGeometry[] = [];
  const cap = (w: number, d: number, x: number, y: number, z: number) => stone.push(prep(xf(new RoundedBoxGeometry(w, 0.16, d, 2, 0.04), [x, y, z]), '#b4b8c4'));
  cap(ROOM.w + 2 * T + 0.1, T + 0.14, 0, ROOM.wallH + 0.08, nz);
  cap(T + 0.14, ROOM.d + T, -hw - T / 2, ROOM.wallH + 0.08, -T / 2);
  cap(T + 0.14, ROOM.d + T, hw + T / 2, ROOM.lowH + 0.08, T / 2);
  cap(ROOM.w + 2 * T + 0.1, T + 0.14, 0, ROOM.lowH + 0.08, hd + T / 2);
  const pillar = (x: number, z: number, h: number) => {
    stone.push(prep(xf(new RoundedBoxGeometry(0.62, h, 0.62, 2, 0.05), [x, h / 2, z]), (_px, py) => new THREE.Color('#a9adb9').multiplyScalar(0.75 + 0.25 * Math.min(1, py / 2))));
    stone.push(prep(xf(new RoundedBoxGeometry(0.78, 0.2, 0.78, 2, 0.05), [x, h + 0.08, z]), '#c1c5d0'));
  };
  pillar(-hw - T / 2, nz, ROOM.wallH);
  pillar(doorX - doorW / 2 - 0.3, nz, ROOM.wallH);
  pillar(doorX + doorW / 2 + 0.3, nz, ROOM.wallH);
  pillar(hw + T / 2, nz, ROOM.wallH);
  pillar(-hw - T / 2, 0.6, ROOM.wallH);
  pillar(-hw - T / 2, hd + T / 2, ROOM.lowH + 0.2);
  pillar(hw + T / 2, hd + T / 2, ROOM.lowH + 0.2);
  pillar(hw + T / 2, -1.0, ROOM.lowH + 0.2);
  const sg = boxUV(merge(stone), 0.5);
  jitterColor(sg, 0.07, 8);
  group.add(new THREE.Mesh(sg, mats.stone));
  shadows(group, true, true);
  cols.box(-hw - T, -hd - T, hw + T, -hd);
  cols.box(-hw - T, -hd - T, -hw, hd + T);
  cols.box(hw, -hd - T, hw + T, hd + T);
  cols.box(-hw - T, hd, hw + T, hd + T);

  // puerta de salida en el muro norte: marco, hoja de madera con hierros y un hueco oscuro detrás
  const door = new THREE.Group();
  const swing = new THREE.Group();
  swing.position.x = (doorW - 0.12) / 2;
  door.add(swing);
  const leaf = new THREE.Mesh(boxUV(merge([prep(xf(new THREE.BoxGeometry(doorW - 0.12, 2.3, 0.12), [0, 1.15, 0]), '#6a4630')]), 0.9), mats.woodDark);
  swing.add(leaf);
  const straps = merge([0.5, 1.8].map((y) => prep(xf(new THREE.BoxGeometry(doorW - 0.15, 0.12, 0.14), [0, y, 0]), '#23262e')));
  swing.add(new THREE.Mesh(straps, mats.iron));
  door.position.set(doorX - doorW / 2 + 0.06, 0, -hd + 0.12);
  group.add(door);
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(doorW, 2.4), new THREE.MeshBasicMaterial({ color: 0x010203 }));
  arch.position.set(doorX, 1.2, -hd - T * 0.4);
  group.add(arch);
  shadows(door);

  // antorchas (las del muro oeste miran al este; las del muro norte miran al sur)
  group.add(makeSconce(ctx, -hw + 0.02, 2.0, -2.5, 'east'));
  group.add(makeSconce(ctx, -hw + 0.02, 2.0, 1.8, 'east'));
  group.add(makeSconce(ctx, -2.4, 2.0, -hd + 0.02, 'south'));
  group.add(makeSconce(ctx, 0.6, 2.0, -hd + 0.02, 'south'));
  group.add(makeSconce(ctx, 4.6, 2.0, -hd + 0.02, 'south'));

  return buildContents(ctx, group, door, cols, doorX);
}

/** Mobiliario, personajes e interactuables de la cripta. */
function buildContents(ctx: BuildCtx, group: THREE.Group, door: THREE.Group, cols: Colliders, doorX: number): CryptArea {
  const hw = ROOM.w / 2;
  const hd = ROOM.d / 2;
  const interactables: Interactable[] = [];
  const inspect = (id: string, o: THREE.Object3D, x: number, z: number, tagY: number, r = 1.6) =>
    interactables.push({ id, label: 'Inspeccionar', x, z, radius: r, outline: [o], tagY, kind: 'inspect', enabled: true });

  // escritorio del escribano pegado al muro oeste (eje a lo largo de z)
  const desk = makeDesk(ctx, 3.0);
  desk.position.set(-hw + 0.75, 0, -2.0);
  desk.rotation.y = Math.PI / 2;
  group.add(desk);
  cols.box(-hw, -3.6, -hw + 1.3, -0.4);
  const cand = desk.userData.candleLight as { pos: THREE.Vector3 };
  desk.updateMatrixWorld();
  cand.pos.copy(desk.localToWorld(new THREE.Vector3(-0.45, 1.35, 0.05)));
  inspect('desk', desk, -hw + 1.9, -1.0, 1.7, 1.6);

  // estante sobre el escritorio
  const shelf = makeShelf(ctx, 1.9);
  shelf.position.set(-hw + 0.02, 1.7, -2.2);
  shelf.rotation.y = Math.PI / 2;
  group.add(shelf);

  // Lutin sentado en el borde del escritorio (mira hacia el centro del cuarto)
  const lutin = makeLutin(ctx);
  lutin.group.position.set(-hw + 1.05, 0.98, -3.15);
  lutin.group.rotation.y = Math.PI / 2 - 0.3;
  lutin.group.scale.setScalar(1.3);
  group.add(lutin.group);
  interactables.push({ id: 'lutin', label: 'Lutin', x: -hw + 1.9, z: -3.0, radius: 2.2, outline: [lutin.group], tagY: 2.2, kind: 'npc', enabled: true });

  // cofre con cráneo y cajón de huesos contra el muro oeste; mesita con caldero en el rincón sur
  const chest = makeChest(ctx, -hw + 0.7, 1.0, Math.PI / 2);
  group.add(chest);
  const skull = makeSkull(ctx, 1.25);
  skull.position.set(-hw + 0.5, 1.0, 0.75);
  skull.rotation.y = 1.2;
  group.add(skull);
  inspect('chest', chest, -hw + 1.7, 1.0, 1.35, 1.7);
  group.add(makeBoneCrate(ctx, -hw + 1.9, 2.55, 0.4));
  group.add(makeCauldronTable(ctx, -hw + 0.75, hd - 0.75, 0.2));

  // ataúd con esqueleto, caja de fruta y barril (lado este)
  const coffin = makeCoffin(ctx, 3.3, 1.35, 0.0);
  group.add(coffin);
  inspect('coffin', coffin, 3.3, 2.6, 1.3, 1.9);
  group.add(makeProduceCrate(ctx, 3.9, 3.25, -0.2));
  group.add(makeBarrel(ctx, hw - 0.7, -1.4));
  group.add(makeBarrel(ctx, hw - 0.75, -2.3, '#7a3a2c'));

  // farol en el piso junto a la puerta
  group.add(makeLantern(ctx, doorX - 1.2, -hd + 1.0, false, 0.4));

  // telarañas en las esquinas de los muros altos
  const web = makeCobweb(1.4);
  web.position.set(-hw + 0.02, ROOM.wallH - 0.05, -hd + 0.02);
  web.rotation.set(0, Math.PI / 4, 0);
  group.add(web);
  const web2 = makeCobweb(1.0);
  web2.position.set(-hw + 0.03, ROOM.wallH - 0.05, 3.0);
  web2.rotation.set(0, Math.PI / 2, 0);
  group.add(web2);

  // puerta de salida
  interactables.push({ id: 'exit_door', label: 'Salir', x: doorX, z: -hd + 0.9, radius: 1.6, outline: [door], tagY: 2.6, kind: 'door', enabled: true });

  // luz de ambiente: un cielo muy tenue y una luz de techo que da sombras suaves en el piso
  group.add(new THREE.HemisphereLight(0x5a6890, 0x1c1814, 0.42));
  const top = new THREE.SpotLight(0x9bb0e8, 55, 26, 0.75, 0.9, 1.4);
  top.position.set(0.5, 8.5, 0.5);
  top.target.position.set(0, 0, 0);
  top.castShadow = true;
  top.shadow.mapSize.set(ctx.quality.id === 'low' ? 512 : 1024, ctx.quality.id === 'low' ? 512 : 1024);
  top.shadow.bias = -0.0006;
  top.shadow.normalBias = 0.03;
  top.shadow.radius = 4;
  group.add(top, top.target);

  return {
    id: 'crypt',
    group,
    cols,
    interactables,
    actors: { lutin },
    rig: CRYPT_RIG,
    spawns: { entry: { x: doorX, z: -hd + 1.6, yaw: 0 } },
    fog: { color: 0x03040a, density: 0 },
    lutinSeatX: -hw + 1.9,
    setExitOpen: (v) => {
      door.rotation.y = -v * 1.6;
    },
    update: (dt, t, env) => {
      ctx.tick.forEach((fn) => fn(dt, t));
      lutin.update(dt, t, env.talking === 'lutin');
    },
  };
}

export { V3 };
