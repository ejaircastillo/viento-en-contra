import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { BuildCtx } from './ctx';
import { shadows } from './ctx';
import { boxUV, jitterColor, merge, prep, xf } from '../gfx/geom';
import { makeCanvas, toTexture } from '../gfx/textures';

/**
 * La cripta (mausoleo) del cementerio: zócalo, muros de piedra con pilastras, techo de pizarra a dos aguas,
 * puerta de madera con herrajes que se abre, escalones y una placa tallada. Es la entrada al interior.
 */
export interface Mausoleum {
  group: THREE.Group;
  /** Punto del suelo frente a la puerta (donde se interactúa). */
  frontX: number;
  frontZ: number;
  /** La hoja de la puerta (para contornearla). */
  door: THREE.Object3D;
  /** 0 = cerrada, 1 = abierta del todo. */
  setOpen: (v: number) => void;
}

function plaqueTexture(lines: string[]): THREE.CanvasTexture {
  const [cv, c] = makeCanvas(512, 128);
  c.clearRect(0, 0, 512, 128);
  c.fillStyle = 'rgba(28,30,38,0.9)';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = '44px Georgia, serif';
  c.fillText(lines[0], 256, 44);
  c.font = 'italic 28px Georgia, serif';
  c.fillText(lines[1] ?? '', 256, 92);
  return toTexture(cv, { wrap: false });
}

export function makeMausoleum(ctx: BuildCtx, x: number, z: number): Mausoleum {
  const { mats } = ctx;
  const W = 5.2;
  const D = 4.2;
  const H = 2.65;
  const DW = 1.35;
  const DH = 2.0;
  const g = new THREE.Group();
  const stone: THREE.BufferGeometry[] = [];
  const add = (w: number, h: number, d: number, px: number, py: number, pz: number, col = '#a6a9b4', r = 0.05) =>
    stone.push(prep(xf(new RoundedBoxGeometry(w, h, d, 2, r), [px, py, pz]), col));
  add(W + 0.7, 0.26, D + 0.7, 0, 0.13, 0, '#8d909b');
  add(W, H, 0.42, 0, 0.26 + H / 2, -D / 2 + 0.21);
  add(0.42, H, D, -W / 2 + 0.21, 0.26 + H / 2, 0);
  add(0.42, H, D, W / 2 - 0.21, 0.26 + H / 2, 0);
  const sideW = (W - DW) / 2;
  add(sideW, H, 0.42, -(DW / 2 + sideW / 2), 0.26 + H / 2, D / 2 - 0.21);
  add(sideW, H, 0.42, DW / 2 + sideW / 2, 0.26 + H / 2, D / 2 - 0.21);
  add(DW + 0.2, H - DH - 0.26 + 0.05, 0.46, 0, 0.26 + DH + (H - DH - 0.26) / 2, D / 2 - 0.21, '#b2b5c0');
  for (const s of [-1, 1]) add(0.5, H + 0.1, 0.5, s * (W / 2 - 0.05), 0.26 + H / 2, D / 2 - 0.05, '#b8bbc6');
  add(DW + 1.3, 0.09, 0.55, 0, 0.3, D / 2 + 0.3, '#9a9da8');
  add(DW + 0.9, 0.09, 0.4, 0, 0.22, D / 2 + 0.62, '#94979f');
  const sg = boxUV(merge(stone), 0.6);
  jitterColor(sg, 0.09, 12);
  const walls = new THREE.Mesh(sg, mats.stone);
  g.add(walls);

  // techo de pizarra a dos aguas (cumbrera a lo largo de X) y frontones de piedra
  const rise = 1.4;
  const half = D / 2 + 0.45;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  const roofParts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const slab = new THREE.BoxGeometry(W + 0.8, 0.14, slope);
    roofParts.push(prep(xf(slab, [0, 0.26 + H + rise / 2 + 0.05, s * (half / 2)], [s * ang, 0, 0]), '#bfc6d4'));
  }
  const roof = boxUV(merge(roofParts), 0.8);
  const roofMesh = new THREE.Mesh(roof, mats.slate);
  g.add(roofMesh);
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2 - 0.3, 0);
  tri.lineTo(D / 2 + 0.3, 0);
  tri.lineTo(0, rise + 0.1);
  const gable = new THREE.ExtrudeGeometry(tri, { depth: 0.36, bevelEnabled: false });
  const gab: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) gab.push(prep(xf(gable, [s * (W / 2 - 0.2), 0.26 + H, 0], [0, Math.PI / 2, 0]), '#9c9fab'));
  gab.push(prep(xf(new RoundedBoxGeometry(W + 0.9, 0.16, 0.26, 2, 0.04), [0, 0.26 + H + rise + 0.1, 0]), '#b4b7c2'));
  g.add(new THREE.Mesh(boxUV(merge(gab), 0.6), mats.stone));

  // placa tallada sobre la puerta
  const plaque = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.5, 0.1, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x8d909b, roughness: 0.9 }));
  plaque.position.set(0, 0.26 + H - 0.06, D / 2 + 0.06);
  g.add(plaque);
  const text = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.52),
    new THREE.MeshBasicMaterial({ map: plaqueTexture(['CRIPTA MUNICIPAL', 'habilitación en trámite']), transparent: true, opacity: 0.85, depthWrite: false }),
  );
  text.position.set(0, 0.26 + H - 0.06, D / 2 + 0.115);
  g.add(text);

  // interior oscuro y puerta con bisagra a la izquierda
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), new THREE.MeshBasicMaterial({ color: 0x020305 }));
  dark.position.set(0, 0.26 + DH / 2, D / 2 - 0.25);
  g.add(dark);
  const pivot = new THREE.Group();
  pivot.position.set(-DW / 2, 0.26, D / 2 - 0.12);
  const leafParts: THREE.BufferGeometry[] = [prep(xf(new THREE.BoxGeometry(DW - 0.04, DH - 0.04, 0.09), [DW / 2, DH / 2, 0]), '#6a4630')];
  const leaf = new THREE.Mesh(boxUV(merge(leafParts), 0.9), mats.woodDark);
  pivot.add(leaf);
  const strapGeo: THREE.BufferGeometry[] = [];
  for (const py of [0.4, DH - 0.4]) strapGeo.push(prep(xf(new THREE.BoxGeometry(DW - 0.08, 0.1, 0.11), [DW / 2, py, 0]), '#24272f'));
  for (let i = 0; i < 8; i++) strapGeo.push(prep(xf(new THREE.CylinderGeometry(0.025, 0.025, 0.13, 6), [0.12 + i * 0.15, 0.4, 0], [Math.PI / 2, 0, 0]), '#3a3d46'));
  strapGeo.push(prep(xf(new THREE.TorusGeometry(0.07, 0.014, 6, 12), [DW - 0.22, DH * 0.48, 0.07]), '#2a2d35'));
  pivot.add(new THREE.Mesh(merge(strapGeo), mats.iron));
  g.add(pivot);

  g.position.set(x, 0, z);
  shadows(g);
  text.castShadow = false;
  text.receiveShadow = false;
  ctx.cols.box(x - W / 2 - 0.3, z - D / 2 - 0.3, x + W / 2 + 0.3, z + D / 2 + 0.05);
  return {
    group: g,
    frontX: x,
    frontZ: z + D / 2 + 0.9,
    door: pivot,
    setOpen: (v) => {
      pivot.rotation.y = -v * 1.75;
    },
  };
}
