import * as THREE from 'three';
import type { Quality } from '../core/quality';
import { Particles } from '../gfx/particles';
import { glowTexture, leafSpriteTexture, smokeTexture } from '../gfx/textures';
import { noise1 } from '../core/noise';
import { windGust } from '../gfx/wind';

/**
 * Efectos de partículas del cementerio: el humo oscuro de la fogata (con brillo anaranjado abajo), las
 * brasas que suben, y las hojas de otoño que caen alrededor de la cámara durante toda la partida.
 */
export interface GraveyardFx {
  smoke: Particles;
  embers: Particles;
  leaves: Particles;
  update: (dt: number, t: number, camera: THREE.Camera, focus: THREE.Vector3) => void;
  group: THREE.Group;
}

const LEAF_COLORS = ['#c2561c', '#d98a24', '#9a2f1c', '#d6b03a', '#7a4a1c'].map((c) => new THREE.Color(c));

export function makeGraveyardFx(camp: THREE.Vector3, quality: Quality): GraveyardFx {
  const q = quality.particles;
  const smoke = new Particles({
    max: Math.round(70 * q),
    map: smokeTexture(128),
    sort: true,
    lit: true,
    step: (p, dt, t) => {
      const w = windGust(p.x, p.z, t);
      p.vx += ((noise1(t * 0.5 + p.a, p.b) - 0.45) * 0.7 + 0.25 + w * 0.45) * dt;
      p.vz += ((noise1(t * 0.5 + p.b, p.a + 3) - 0.5) * 0.6 + w * 0.2) * dt;
      p.vy *= 1 - 0.05 * dt;
    },
  });
  const embers = new Particles({
    max: Math.round(40 * q),
    map: glowTexture(64, 2),
    additive: true,
    step: (p, dt, t) => {
      p.vx += (noise1(t * 2 + p.a, p.b) - 0.5) * 2.2 * dt;
      p.vz += (noise1(t * 2 + p.b, p.a + 9) - 0.5) * 2.2 * dt;
    },
  });
  const leaves = new Particles({
    max: Math.round(46 * q),
    map: leafSpriteTexture(64),
    step: (p, dt, t) => {
      const w = windGust(p.x, p.z, t);
      p.vx = 0.5 + w * 0.6 + Math.sin(t * 1.3 + p.a) * 0.2;
      p.vz = 0.25 + w * 0.3 + Math.cos(t * 1.1 + p.b) * 0.2;
      if (p.y < 0.05) p.age = p.life;
    },
  });
  const group = new THREE.Group();
  group.add(smoke.mesh, embers.mesh, leaves.mesh);
  let smokeT = 0;
  let emberT = 0;
  return {
    smoke,
    embers,
    leaves,
    group,
    update: (dt, t, camera, focus) => {
      smokeT -= dt;
      if (smokeT <= 0 && !smoke.full) {
        smokeT = (1 / 5.4) * (0.6 + Math.random() * 0.8) / Math.max(0.4, q);
        smoke.spawn((p) => {
          p.x = camp.x + (Math.random() - 0.5) * 0.5;
          p.y = camp.y + 0.2;
          p.z = camp.z + (Math.random() - 0.5) * 0.5;
          p.vx = (Math.random() - 0.5) * 0.25;
          p.vy = 0.85 + Math.random() * 0.5;
          p.vz = (Math.random() - 0.5) * 0.25;
          p.life = 5 + Math.random() * 2.2;
          p.size0 = 0.55 + Math.random() * 0.3;
          p.size1 = 2.6 + Math.random() * 1.1;
          p.rot = Math.random() * 6.28;
          p.spin = (Math.random() - 0.5) * 0.5;
          p.c0.setRGB(0.55, 0.38, 0.27);
          p.c1.setRGB(0.3, 0.36, 0.5);
          p.peak = 0.85;
          p.glow = 0.9;
          p.a = Math.random() * 50;
          p.b = Math.random() * 50;
        });
      }
      emberT -= dt;
      if (emberT <= 0 && !embers.full) {
        emberT = (1 / 14) * (0.5 + Math.random());
        embers.spawn((p) => {
          p.x = camp.x + (Math.random() - 0.5) * 0.7;
          p.y = 0.5 + Math.random() * 0.4;
          p.z = camp.z + (Math.random() - 0.5) * 0.7;
          p.vx = (Math.random() - 0.5) * 0.4;
          p.vy = 1.0 + Math.random() * 1.3;
          p.vz = (Math.random() - 0.5) * 0.4;
          p.life = 1.6 + Math.random() * 1.6;
          p.size0 = 0.07 + Math.random() * 0.06;
          p.size1 = 0.02;
          p.c0.setRGB(3.2, 1.5, 0.35);
          p.c1.setRGB(1.3, 0.25, 0.05);
          p.peak = 1;
          p.a = Math.random() * 40;
          p.b = Math.random() * 40;
        });
      }
      // hojas: se reponen en un círculo alrededor del punto de mira y caen despacio
      let spawn = Math.min(3, Math.max(0, Math.round(46 * q) - leaves.count));
      while (spawn-- > 0 && !leaves.full) {
        leaves.spawn((p) => {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 15;
          p.x = focus.x + Math.cos(a) * r - 4;
          p.z = focus.z + Math.sin(a) * r - 4;
          p.y = 3 + Math.random() * 7;
          p.vx = 0.6;
          p.vy = -(0.5 + Math.random() * 0.6);
          p.vz = 0.3;
          p.life = 14;
          p.size0 = 0.15 + Math.random() * 0.08;
          p.size1 = p.size0;
          p.rot = Math.random() * 6.28;
          p.spin = (Math.random() - 0.5) * 3;
          p.c0.copy(LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]).multiplyScalar(0.45 + Math.random() * 0.3);
          p.c1.copy(p.c0);
          p.peak = 0.95;
          p.a = Math.random() * 30;
          p.b = Math.random() * 30;
        });
      }
      smoke.update(dt, t, camera);
      embers.update(dt, t, camera);
      leaves.update(dt, t, camera);
    },
  };
}
