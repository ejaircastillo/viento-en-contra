import type { ChapterDef } from '../../engine/mission/types';
import { cityPlan } from './city';
import { npcs } from './npcs';
import { traffic, pedestrians } from './traffic';
import { tracks } from '../music';
import { registerBrands } from '../brands';
import { interiors, registerInteriorProps } from './interiors';
import { dialogues } from './dialogues';
import { radio } from './radio';
import { states, stateOrder } from './flow';
import { CONFIG } from './config';

/** Capítulo 1: "Viento en contra". Una mañana cualquiera en Río Gallegos. */
const chapter: ChapterDef = {
  id: 'ch01',
  number: 1,
  title: 'Capítulo 1 · Viento en contra',
  characters: ['municipal', 'emprendedor'],
  initialState: 'LEAVE_HOME',
  stateOrder,
  states,
  city: cityPlan,
  interiors,
  dialogues,
  radio,
  npcs,
  traffic,
  pedestrians,
  tracks,
  vocab: CONFIG.vocab,
  ending: CONFIG.ending,
  credits: CONFIG.credits,
  selectPrompt: '¿CON QUIÉN ARRANCÁS LA MAÑANA?',
  // decisiones que el Capítulo 2 recuerda (llegan como prev_<flag>)
  carry: ['tono_final', 'respuesta_mama', 'gorro', 'tono_informar', 'tono_escuela', 'tono_hermana'],
  setup: () => {
    registerBrands();
    registerInteriorProps();
  },
};

export default chapter;
