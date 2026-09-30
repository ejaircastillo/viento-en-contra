import type { PlayableCharacter } from '../engine/mission/types';

/**
 * Personajes jugables. Nombres, aspecto y vocabulario son PROPUESTAS (ver docs/DECISIONES.md):
 * se cambian acá sin tocar el motor.
 */
export const characters: Record<string, PlayableCharacter> = {
  municipal: {
    id: 'municipal',
    name: 'Diego',
    fullName: 'Diego Barría',
    role: 'Empleado municipal · Habilitaciones',
    blurb: 'Revisa carpetas y hace inspecciones. Hoy tiene que llevar a Tomi a la escuela y llegar a las 8.',
    sprite: 'char.municipal',
    look: {
      body: 'adult',
      skin: 'skin1',
      hair: 'hairDark',
      hairStyle: 'short',
      top: 'navy',
      topStyle: 'jacket',
      accent: 'slate3',
      bottom: 'grey',
      shoes: 'black',
      beard: 'mustache',
      lanyard: 'muniTeal',
    },
    voice: 0.9,
    car: { model: 'sedan', body: 'carBlue' },
    clock: { label: 'Entrada 08:00', deadline: '08:00', lateLabel: 'Tarde · +{m} min', warnMinutes: 12 },
    vocab: {
      kid: 'Tomi',
      kidFull: 'Tomás',
      sister: 'Caro',
      sisterFull: 'Carolina',
      son: 'hijo',
      carName: 'el auto',
    },
  },
  emprendedor: {
    id: 'emprendedor',
    name: 'Nahuel',
    fullName: 'Nahuel Cárcamo',
    role: 'Kiosquero · habilitación "en trámite"',
    blurb: 'Abrió el kiosco en el frente de su casa porque había que trabajar. Los papeles, bien gracias.',
    sprite: 'char.emprendedor',
    look: {
      body: 'adult',
      skin: 'skin2',
      hair: 'hairBlack',
      hairStyle: 'beanie',
      hat: 'red',
      top: 'mustard',
      topStyle: 'puffer',
      bottom: 'denim',
      shoes: 'brown',
      beard: 'stubble',
    },
    voice: 1.05,
    car: { model: 'van', body: 'carWhite' },
    clock: { label: 'Inspección ~08:30', deadline: '08:30', lateLabel: '¿Ya pasó el inspector?', warnMinutes: 12 },
    vocab: {
      kid: 'Benja',
      kidFull: 'Benjamín',
      sister: 'Vero',
      sisterFull: 'Verónica',
      son: 'hijo',
      carName: 'el utilitario',
    },
  },
};
