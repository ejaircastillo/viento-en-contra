import type { ChapterDef } from '../../engine/mission/types';
import { tracks } from '../music';
import { registerBrands } from '../brands';
import { interiors as interiorsCh1, registerInteriorProps } from '../chapter01/interiors';
import { traffic, pedestrians } from '../chapter01/traffic';
import { cityPlan } from './city';
import { interiors } from './interiors';
import { npcs } from './npcs';
import { dialogues } from './dialogues';
import { radio } from './radio';
import { states, stateOrder } from './flow';
import { CONFIG2 } from './config';
import { registerChapter2Props } from './props';

/** Capítulo 2: "Horario de atención". Jueves, segundo día de paro. Mismos personajes, dos días muy distintos. */
let plan: ReturnType<typeof cityPlan> | null = null;

const chapter: ChapterDef = {
  id: 'ch02',
  number: 2,
  title: 'Capítulo 2 · Horario de atención',
  characters: ['municipal', 'emprendedor'],
  initialState: 'ARRANQUE',
  stateOrder,
  states,
  city: () => (plan ??= cityPlan()),
  // el despacho de Habilitaciones (Cap. 1) sirve para la reunión de Diego con Ponce
  interiors: { muni_hab: interiorsCh1.muni_hab, ...interiors },
  dialogues,
  radio,
  npcs,
  traffic,
  pedestrians,
  tracks,
  vocab: CONFIG2.vocab,
  ending: CONFIG2.ending,
  credits: CONFIG2.credits,
  clock: { municipal: CONFIG2.meaning.municipal, emprendedor: CONFIG2.meaning.emprendedor },
  cards: CONFIG2.cards,
  selectPrompt: '¿CON QUIÉN VIVÍS EL JUEVES?',
  carry: ['d_final', 'n_final', 'actas', 'd_aviso', 'n_llamada', 'n_ensayo'],
  windBase: 0.58,
  setup: () => {
    registerBrands();
    registerInteriorProps();
    registerChapter2Props();
  },
};

export default chapter;
