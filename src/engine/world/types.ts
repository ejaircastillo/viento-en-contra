import type { Dir4 } from '../core/math';
import type { GroundId } from './ground';
import type { BuildingSpec } from '../assets/gen/buildings';
import type { GenOutput } from '../assets/AssetRegistry';

/**
 * Formato de mapa del motor ("sistema equivalente a Tiled"): una ciudad se describe
 * con calles, lotes, props, marcadores y zonas. El CityBuilder lo rasteriza a una grilla
 * isométrica, genera la red vial y rellena manzanas de forma determinista (semilla).
 * Ver docs/ARQUITECTURA.md §Mapas.
 */

export interface StreetDef {
  id: string;
  name: string;
  axis: 'x' | 'y';
  /** Primera fila (axis x) o columna (axis y) de la calzada, sin contar vereda. */
  at: number;
  lanes?: 1 | 2;
  median?: number;
  parking?: boolean;
  from?: number;
  to?: number;
  sidewalk?: 'paved' | 'dirt' | 'none';
  paved?: boolean;
  /** Pintar sendas peatonales en todas sus esquinas. */
  crosswalks?: boolean;
}

/** Edificio explícito. `at`/`size` = huella del edificio (baldosas, múltiplos de 1/8). */
export interface LotDef {
  id?: string;
  at: [number, number];
  size: [number, number];
  building: BuildingSpec;
  /** Rectángulo de terreno del lote [x0,y0,x1,y1] y su suelo (patio por defecto). */
  yard?: [number, number, number, number];
  yardGround?: GroundId;
  tag?: string;
}

export interface FenceDef {
  axis: 'x' | 'y';
  /** Inicio del cerco (x,y). Corre `len` baldosas a lo largo del eje. */
  at: [number, number];
  len: number;
  kind: 'picket' | 'reja' | 'wire' | 'chapa' | 'wall';
  /** Desplazamientos (en baldosas desde el inicio) donde hay un portón de 1 baldosa. */
  gates?: number[];
  color?: string;
  stencil?: string;
}

export interface PropDef {
  id?: string;
  type: string;
  at: [number, number];
  params?: any;
  /** Huella en baldosas: activa orden por tiras y colisión. */
  fp?: [number, number];
  solid?: boolean;
  anim?: { fps: number; frames?: number; seq?: number[] };
  flipX?: boolean;
  tag?: string;
  /** Oculto hasta que un guion lo muestre. */
  hidden?: boolean;
  /** Texto del cartel para la "lectura ampliada" (se muestra nítido al pasar cerca). */
  caption?: CaptionDef;
}

/** Texto legible de un cartel: string, o con colores de palette y altura del rótulo (px). */
export type CaptionDef = string | { text: string; bg?: string; fg?: string; z?: number };

/** Rótulo ya ubicado en el mundo (lo arman CityBuilder / InteriorBuilder). */
export interface SignCaption {
  key: string;
  x: number;
  y: number;
  z: number;
  text: string;
  bg: string;
  fg: string;
}

export interface MarkerDef {
  at: [number, number];
  dir?: Dir4;
}

export interface ZoneDef {
  id: string;
  rect: [number, number, number, number];
}

export interface SignalDef {
  x: string;
  y: string;
  broken?: boolean;
  id?: string;
}

export interface RoadBlockDef {
  id: string;
  street: string;
  from: number;
  to: number;
  /** Bloqueo conocido desde el inicio por el GPS (true) o sólo por el tránsito (false). */
  known?: boolean;
}

export interface CityPlan {
  id: string;
  name: string;
  size: [number, number];
  seed: number;
  base: GroundId;
  groundRects?: { rect: [number, number, number, number]; g: GroundId }[];
  streets: StreetDef[];
  signals?: SignalDef[];
  lots: LotDef[];
  fences?: FenceDef[];
  props: PropDef[];
  autoFill?: {
    exclude?: [number, number, number, number][];
    /** Rectángulos de manzana que se dejan como baldío o estepa. */
    empty?: [number, number, number, number][];
    palette?: 'center' | 'barrio';
    barrioRects?: [number, number, number, number][];
    /** Barrios de viviendas todas iguales (misma casa repetida). */
    uniform?: [number, number, number, number][];
  };
  /** Cruces bloqueados para el tránsito desde el inicio (ej. un accidente). */
  blockedInters?: { key: string; known?: boolean }[];
  autoProps?: { poles?: boolean; trees?: boolean; signs?: boolean };
  markers: Record<string, MarkerDef>;
  zones: ZoneDef[];
  deco?: { at: [number, number]; code: number }[];
  blocks?: RoadBlockDef[];
  /** Autos estacionados al azar en las dársenas (densidad 0..1 por lugar). */
  parked?: { density: number; looks: { model: string; body: string; accent?: string }[] };
}

export interface StreetInfo extends Required<Omit<StreetDef, 'crosswalks'>> {
  index: number;
  width: number;
  p: number;
  crosswalks: boolean;
}

export interface StaticObject {
  id?: string;
  tag?: string;
  kind: 'building' | 'prop' | 'cable';
  texKey: string;
  gen: () => GenOutput;
  /** Para objetos con huella: origen de la huella. Para puntuales: punto de apoyo. */
  x: number;
  y: number;
  fp?: [number, number];
  solid: boolean;
  anim?: { fps: number; frames?: number; seq?: number[] };
  /** Cuadro fijo dentro de una tira (ej. auto estacionado en cierta dirección). */
  frame?: number;
  flipX?: boolean;
  hidden?: boolean;
  /** Sesgo de profundidad para puntuales. */
  bias?: number;
  /** Punto de enganche de cables (px sobre el ancla) para postes. */
  cableTop?: number;
  /** Rectángulo de colisión propio [x0,y0,x1,y1] si difiere de la huella. */
  collide?: [number, number, number, number];
}

/** Rectángulo sólido para colisiones de caminata. */
export interface SolidRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  ref?: StaticObject;
}
