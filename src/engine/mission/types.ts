import type { CharacterLook } from '../assets/gen/characters';
import type { VehicleLook } from '../assets/gen/vehicles';
import type { CityPlan, MarkerDef, PropDef, ZoneDef } from '../world/types';
import type { DialogueLibrary } from '../dialogue/Dialogue';
import type { RadioLibrary } from '../radio/RadioStation';
import type { ClockMeaning } from '../timer/GameClock';
import type { GroundId } from '../world/ground';
import type { Track } from '../audio/AudioEngine';
import type { ChapterContext } from './ChapterContext';

/**
 * Contrato entre motor y contenido. Un capítulo nuevo = un objeto ChapterDef
 * (mapa, interiores, NPCs, diálogos, radio, estados) registrado en src/content/index.ts.
 */

export interface PlayableCharacter {
  id: string;
  name: string;
  fullName: string;
  role: string;
  blurb: string;
  look: CharacterLook;
  /** Clave del manifiesto (ej. "char.municipal"): permite reemplazar el sprite por arte final. */
  sprite?: string;
  voice: number;
  car: VehicleLook;
  /** Significado del reloj para este personaje. */
  clock: ClockMeaning;
  /** Vocabulario para plantillas de texto: {kid}, {sister}, etc. */
  vocab: Record<string, string>;
}

export interface NpcDef {
  id: string;
  name: string;
  look: CharacterLook;
  sprite?: string;
  voice?: number;
}

export interface WallItem {
  kind: 'window' | 'door' | 'poster' | 'clock' | 'sign' | 'board' | 'heater' | 'frame';
  wall: 'back' | 'left';
  u: number;
  z: number;
  w: number;
  h: number;
  text?: string;
  text2?: string;
  bg?: string;
  fg?: string;
  logo?: string;
  /** Texto para la "lectura ampliada" del cartel. */
  caption?: string;
}

export interface InteriorDef {
  id: string;
  name: string;
  size: [number, number];
  floor: GroundId;
  wallH: number;
  wallColor: string;
  wallLow?: string;
  items: WallItem[];
  props: PropDef[];
  markers: Record<string, MarkerDef>;
  zones: ZoneDef[];
  ambience?: 'office' | 'store';
}

export type StateFn = (ctx: ChapterContext) => Promise<string | null>;

export interface ChapterDef {
  id: string;
  number: number;
  title: string;
  characters: string[];
  initialState: string;
  /** Orden de estados (para el menú de depuración y la documentación). */
  stateOrder: string[];
  states: Record<string, StateFn>;
  /** Plano de la ciudad (puede variar por personaje: ej. la casa del protagonista). */
  city: CityPlan | ((characterId: string) => CityPlan);
  interiors: Record<string, InteriorDef>;
  dialogues: DialogueLibrary;
  radio: RadioLibrary;
  npcs: Record<string, NpcDef>;
  traffic: { look: VehicleLook; w: number }[];
  pedestrians: CharacterLook[];
  tracks: Track[];
  vocab: Record<string, string>;
  ending: Record<string, string>;
  credits: string;
  /** Significado del reloj por personaje en este capítulo (si no, se usa el del personaje). */
  clock?: Record<string, ClockMeaning>;
  /** Pregunta de la pantalla de selección de personaje. */
  selectPrompt?: string;
  /** Textos de la tarjeta de cada personaje para este capítulo (si no, se usan los del personaje). */
  cards?: Record<string, { role?: string; blurb?: string; timer?: string }>;
  /**
   * Flags que pasan a los capítulos siguientes ("consecuencias"): al terminar se guardan por personaje
   * y el capítulo siguiente los recibe como `prev_<flag>` (ej. `prev_tono_final`).
   */
  carry?: string[];
  /** Intensidad base del viento en este capítulo (0–1; por defecto 0.45). */
  windBase?: number;
  /** Registro de logos, props y generadores propios del capítulo. */
  setup?: () => void;
}

/** Datos de un capítulo que el título necesita sin cargarlo (el capítulo se carga bajo demanda). */
export interface ChapterInfo {
  id: string;
  number: number;
  title: string;
  subtitle: string;
}

export interface ContentPack {
  characters: Record<string, PlayableCharacter>;
  chapters: Record<string, () => Promise<ChapterDef>>;
  firstChapter: string;
  /** Capítulos en orden de juego (título, selección y "siguiente capítulo"). */
  chapterInfo: ChapterInfo[];
  /** Leyenda del título (ej. "Demo 0.2 · Capítulos 1 y 2"). */
  demoLabel: string;
}

/** Id del capítulo que sigue a `id` en el orden de juego (null si es el último). */
export function nextChapterId(pack: Pick<ContentPack, 'chapterInfo'>, id: string): string | null {
  const i = pack.chapterInfo.findIndex((c) => c.id === id);
  return i >= 0 && i + 1 < pack.chapterInfo.length ? pack.chapterInfo[i + 1].id : null;
}
