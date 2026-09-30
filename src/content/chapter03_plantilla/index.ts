import type { ChapterDef, StateFn } from '../../engine/mission/types';
import { cityPlan } from '../chapter02/city';
import { npcs } from '../chapter02/npcs';
import { traffic, pedestrians } from '../chapter01/traffic';
import { tracks } from '../music';
import { registerBrands } from '../brands';
import { registerInteriorProps } from '../chapter01/interiors';
import { registerChapter2Props } from '../chapter02/props';

/**
 * PLANTILLA de capítulo (no es contenido jugable de la demo): demuestra que un capítulo nuevo se arma sólo
 * con datos + guion, reutilizando el mapa del Capítulo 2 y sin tocar el motor.
 * Probar con: ?chapter=ch03_plantilla — ver docs/GUIA_NUEVO_CAPITULO.md
 */
const states: Record<string, StateFn> = {
  async MANANA_SIGUIENTE(ctx) {
    ctx.clock.set('07:28');
    ctx.clock.window('07:28', '07:40', 0.1);
    const w = await ctx.city({
      mode: 'walk',
      player: { at: 'home_door', facing: 'S' },
      car: { at: 'home_car' },
      bounds: [34.3, 74.6, 43.4, 79.3],
    });
    await ctx.card('Capítulo 3 (plantilla)', 'Viernes. Todavía sopla.');
    await ctx.say([
      { who: 'player', text: 'Viernes. Último día de paro. Ojalá.' },
      { who: 'player', text: 'Hoy toca el Certificado de Resistencia Sísmica. Río Gallegos no tiembla. Pero rige desde hoy.', only: 'emprendedor' },
      { who: 'player', text: 'Hoy toca anular las actas de ayer. Con el formulario nuevo. Que todavía no existe.', only: 'municipal' },
    ]);
    w.enableCarInteract();
    ctx.objective('Subí al auto', 'car');
    await ctx.waitInteract('car');
    await w.enterCar([]);
    return 'A_LA_MUNI';
  },
  async A_LA_MUNI(ctx) {
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'home_car', toward: 'muni_car' } });
    w.setDestination('muni_car');
    ctx.objective('Llegá a la Municipalidad (plantilla)', 'muni_car');
    ctx.radio.program('ej');
    ctx.radio.on();
    await w.waitArrival('muni_car');
    return null;
  },
};

const chapter: ChapterDef = {
  id: 'ch03_plantilla',
  number: 3,
  title: 'Capítulo 3 (plantilla)',
  characters: ['municipal', 'emprendedor'],
  initialState: 'MANANA_SIGUIENTE',
  stateOrder: ['MANANA_SIGUIENTE', 'A_LA_MUNI'],
  states,
  city: cityPlan,
  interiors: {},
  dialogues: {},
  radio: {
    station: 'Radio 89',
    items: {
      e1: { id: 'e1', kind: 'news', text: 'Tercer día de paro docente. Hoy también sopla.', react: { all: 'Como ayer. Como siempre.' } },
      m1: { id: 'm1', kind: 'music', track: 'drive3', seconds: 20 },
    },
    programs: { ej: ['e1', 'm1'] },
    filler: ['m1'],
  },
  npcs,
  traffic,
  pedestrians,
  tracks,
  vocab: { office: 'Obras Particulares' },
  ending: { municipal: 'Fin de la plantilla.', emprendedor: 'Fin de la plantilla.' },
  credits: 'Plantilla de capítulo — Viento en Contra.',
  setup: () => {
    registerBrands();
    registerInteriorProps();
    registerChapter2Props();
  },
};

export default chapter;
