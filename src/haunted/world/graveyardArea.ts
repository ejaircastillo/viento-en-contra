import * as THREE from 'three';
import type { Materials } from '../gfx/materials';
import type { LightPool } from '../gfx/lights';
import { haloSprite } from '../gfx/lights';
import type { Quality } from '../core/quality';
import { GRAVEYARD_RIG } from '../core/cameraRig';
import { rng, smoothstep } from '../core/noise';
import { Colliders } from './colliders';
import type { BuildCtx, Interactable } from './ctx';
import { shadows } from './ctx';
import type { Area } from './area';
import { CAMP, LAND, START, buildLand, grassFree, pathEdgeDistance } from './graveyard';
import { placeGraveyardProps } from './graveyardProps';
import { makeGraveyardFx } from './graveyardFx';
import { CrowBrain, DogBrain } from './graveyardActors';
import { fernSpots, makeBush, makeDryGrass, makeFerns, makeLeafLitter } from './vegetation';
import { makeSkeleton } from './chars';
import { merge, prep, xf } from '../gfx/geom';
import type { Mausoleum } from './mausoleum';

/** El área del cementerio ya armada, con los puntos de enganche que usa la historia. */
export interface GraveyardArea extends Area {
  crypt: Mausoleum;
  dog: DogBrain;
  seal: { it: Interactable; reveal: () => void; hide: () => void };
  /** Suelta una nubecita (ventosidad de Pelusa, tierra al cavar). */
  onPuff: (x: number, z: number, kind: 'fart' | 'dirt') => void;
}

/** Sello de goma oxidado (mango, base y goma roja) con un halo dorado para que se note entre las hojas. */
function makeSeal(ctx: BuildCtx): THREE.Group {
  const parts = [
    prep(xf(new THREE.CylinderGeometry(0.13, 0.14, 0.06, 10), [0, 0.03, 0]), '#6b4a2a'),
    prep(xf(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 10), [0, 0, 0]), '#5a1a1a'),
    prep(xf(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 8), [0, 0.14, 0]), '#7a5a34'),
    prep(xf(new THREE.SphereGeometry(0.065, 10, 8), [0, 0.25, 0]), '#8b6a3c'),
  ];
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merge(parts), ctx.mats.vertex));
  const halo = haloSprite(0xffd27a, 1.5, 0.7);
  halo.position.y = 0.2;
  g.add(halo);
  ctx.tick.push((_dt, t) => {
    halo.material.opacity = 0.45 + Math.sin(t * 3) * 0.2;
  });
  shadows(g);
  return g;
}

/** Nubecita de ventosidad (verdosa) o de tierra al cavar, con el mismo sistema de humo. */
function puffer(fx: ReturnType<typeof makeGraveyardFx>) {
  return (x: number, z: number, kind: 'fart' | 'dirt') => {
    fx.smoke.spawn((p) => {
      const fart = kind === 'fart';
      p.x = x;
      p.y = fart ? 0.35 : 0.12;
      p.z = z;
      p.vx = (Math.random() - 0.5) * 0.3;
      p.vy = fart ? 0.35 : 0.9;
      p.vz = (Math.random() - 0.5) * 0.3;
      p.life = fart ? 2.4 : 0.9;
      p.size0 = fart ? 0.2 : 0.1;
      p.size1 = fart ? 0.9 : 0.35;
      p.rot = Math.random() * 6;
      p.spin = 0.4;
      if (fart) {
        p.c0.setRGB(0.55, 0.75, 0.4);
        p.c1.setRGB(0.3, 0.4, 0.25);
        p.peak = 0.5;
      } else {
        p.c0.setRGB(0.3, 0.2, 0.12);
        p.c1.setRGB(0.22, 0.15, 0.1);
        p.peak = 0.8;
      }
      p.a = Math.random() * 20;
      p.b = Math.random() * 20;
    });
  };
}

export function buildGraveyard(mats: Materials, pool: LightPool, quality: Quality): GraveyardArea {
  const group = new THREE.Group();
  const cols = new Colliders();
  cols.bounds = [-LAND.w / 2 + 1.8, -LAND.d / 2 + 1.8, LAND.w / 2 - 1.8, LAND.d / 2 - 1.8];
  const ctx: BuildCtx = { mats, pool, cols, quality, area: 'graveyard', rnd: rng(42), tick: [] };

  group.add(buildLand(mats, quality));

  // luces del área: cielo azul grisáceo + luna con sombras que sigue al jugador
  group.add(new THREE.HemisphereLight(0x5a6a9c, 0x221a13, 0.5));
  const moon = new THREE.DirectionalLight(0x86a0e0, 1.25);
  moon.castShadow = true;
  const ms = quality.shadowMap;
  moon.shadow.mapSize.set(ms, ms);
  Object.assign(moon.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 60 });
  moon.shadow.bias = -0.0008;
  moon.shadow.normalBias = 0.04;
  moon.shadow.radius = 3.5;
  group.add(moon, moon.target);

  const props = placeGraveyardProps(ctx, group);
  const interactables = [...props.interactables];

  // esqueleto junto al fuego
  const skel = makeSkeleton(ctx);
  const [sx, sz, sy] = props.spots.skeleton;
  skel.group.position.set(sx, 0, sz);
  skel.group.rotation.y = sy;
  skel.group.scale.setScalar(1.3);
  group.add(skel.group);
  cols.circle(sx, sz, 0.5);
  interactables.push({ id: 'skeleton', label: 'Don Huesos', x: sx, z: sz, radius: 2.3, outline: [skel.group], tagY: 2.35, kind: 'npc', enabled: true });

  // perrita fantasma y cuervo
  const dog = new DogBrain(ctx, [-8.4, 5.4, 2.4]);
  group.add(dog.actor.group);
  interactables.push(dog.it);
  const crow = new CrowBrain(ctx, [-5.8, 6.8]);
  group.add(crow.actor.group);

  // sello oxidado escondido al pie del árbol seco (aparece cuando Pelusa lo desentierra)
  const sealGroup = makeSeal(ctx);
  sealGroup.position.set(props.spots.seal[0], 0, props.spots.seal[1]);
  sealGroup.visible = false;
  group.add(sealGroup);
  const sealIt: Interactable = { id: 'seal', label: 'Levantar', x: props.spots.seal[0], z: props.spots.seal[1], radius: 1.5, outline: [sealGroup], tagY: 0.75, kind: 'pickup', enabled: false };
  interactables.push(sealIt);

  // puerta de la cripta
  interactables.push({ id: 'crypt_door', label: 'Entrar', x: props.crypt.frontX, z: props.crypt.frontZ - 0.35, radius: 1.7, outline: [props.crypt.door], tagY: 2.4, kind: 'door', enabled: true });

  // vegetación: pasto seco (denso en las orillas), helechos junto a los caminos, arbustos y hojarasca
  const free = (x: number, z: number) => (cols.hitsObstacle(x, z, 0.75) ? 0 : grassFree(x, z));
  group.add(makeDryGrass(ctx, LAND, free));
  const ferns = fernSpots(ctx, [-LAND.w / 2 + 2, -LAND.d / 2 + 2, LAND.w / 2 - 2, LAND.d / 2 - 2], 360, (x, z) => {
    if (cols.hitsObstacle(x, z, 0.25)) return 0;
    const d = pathEdgeDistance(x, z);
    return smoothstep(0.15, 0.5, d) * (1 - smoothstep(1.2, 2.6, d)) * 0.7;
  });
  group.add(makeFerns(ctx, ferns));
  ([[-9.6, 6.6], [-13.6, 6.6], [-8.0, 12.2], [14.2, -6.4], [-13.4, -10.4]] as const).forEach(([x, z]) => group.add(makeBush(ctx, x, z, 1.1)));
  group.add(makeLeafLitter(ctx, [...props.treeSpots, [0, 0, 6], [CAMP.x, CAMP.z, 6], [-6, -5, 6]], 40));

  const fx = makeGraveyardFx(new THREE.Vector3(CAMP.x, 1.2, CAMP.z), quality);
  group.add(fx.group);
  const onPuff = puffer(fx);
  dog.onPuff = onPuff;

  const cell = 34 / quality.shadowMap;
  const snap = (v: number) => Math.round(v / cell) * cell;
  let sealT = -1;
  return {
    id: 'graveyard',
    group,
    cols,
    interactables,
    actors: { skeleton: skel, dog: dog.actor },
    rig: GRAVEYARD_RIG,
    spawns: {
      start: { x: START.x, z: START.z, yaw: Math.PI * 0.75 },
      fromCrypt: { x: props.crypt.frontX, z: props.crypt.frontZ + 0.7, yaw: 0.2 },
    },
    fog: { color: 0x05070f, density: 0.011 },
    env: 0.62,
    crypt: props.crypt,
    dog,
    seal: {
      it: sealIt,
      reveal: () => {
        sealGroup.visible = true;
        sealIt.enabled = true;
        sealT = 0;
      },
      hide: () => {
        sealGroup.visible = false;
        sealIt.enabled = false;
      },
    },
    onPuff,
    update: (dt, t, env) => {
      ctx.tick.forEach((fn) => fn(dt, t));
      const gx = env.ghost.x;
      const gz = env.ghost.z;
      moon.position.set(snap(gx) - 8, 16, snap(gz) - 6);
      moon.target.position.set(snap(gx), 0, snap(gz));
      moon.target.updateMatrixWorld();
      dog.update(dt, t, env.ghost, ctx, env.talking === 'dog');
      crow.update(dt, t, env.ghost, ctx);
      skel.update(dt, t, env.talking === 'skeleton');
      fx.update(dt, t, env.camera, new THREE.Vector3(gx, 0, gz));
      if (sealGroup.visible) {
        sealT += dt;
        const pop = Math.min(1, sealT / 0.6);
        sealGroup.scale.setScalar(Math.max(0.01, pop * (pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.5 : 1)));
        sealGroup.position.y = 0.12 + Math.sin(t * 2.4) * 0.04 + (1 - pop) * 0.6;
        sealGroup.rotation.y = t * 0.8;
      }
    },
  };
}
