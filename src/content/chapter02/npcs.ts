import type { NpcDef } from '../../engine/mission/types';
import { characters } from '../characters';
import { npcs as ch1 } from '../chapter01/npcs';

/**
 * NPCs del Capítulo 2 (se suman a los del 1, que siguen disponibles). Los ids con "@personaje"
 * son variantes según quién juegue. Nombres de pila y cargos inventados: cualquier parecido con
 * personas reales es casualidad (ver docs/DECISIONES.md).
 */
export const npcs: Record<string, NpcDef> = {
  ...ch1,

  // ---- la familia, con id propio para cuando aparecen los dos juntos
  tomi: { ...ch1['kid@municipal'], id: 'tomi' },
  benja: { ...ch1['kid@emprendedor'], id: 'benja' },
  caro: { ...ch1['sister@municipal'], id: 'caro' },
  'vero@emprendedor': { ...ch1['sister@emprendedor'], id: 'vero', name: 'Vero (hermana)' },
  'vero@municipal': { ...ch1['sister@emprendedor'], id: 'vero', name: 'Vero (peluquera)' },

  // ---- feria de emprendedores
  facundo: {
    id: 'facundo',
    name: 'Facundo (Sub. de Anuncios)',
    voice: 1.0,
    look: { body: 'adult', skin: 'skin1', hair: 'hairBrown', hairStyle: 'short', top: 'navy', topStyle: 'suit', tie: 'muniTeal', bottom: 'navy', shoes: 'black', lanyard: 'muniTeal' },
  },
  prensa: {
    id: 'prensa',
    name: 'Prensa de Gestión',
    voice: 1.2,
    look: { body: 'adult', skin: 'skin2', hair: 'hairBlack', hairStyle: 'cap', hat: 'muniTeal', top: 'muniTeal', topStyle: 'vest', accent: 'white', bottom: 'black', shoes: 'black', holding: 'phone' },
  },
  nelly: {
    id: 'nelly',
    name: 'Nelly (Tejidos)',
    voice: 1.1,
    look: { body: 'elder', skin: 'skin1', hair: 'hairGrey', hairStyle: 'bun', top: 'wallTeal', topStyle: 'cardigan', bottom: 'grey', shoes: 'black', scarf: 'mustard' },
  },
  lucas: {
    id: 'lucas',
    name: 'Lucas (Alfajores del Viento)',
    voice: 0.95,
    look: { body: 'adult', skin: 'skin2', hair: 'hairBrown', hairStyle: 'beanie', hat: 'mustard', top: 'brown', topStyle: 'puffer', bottom: 'denim', shoes: 'brown', beard: 'stubble' },
  },
  marta: {
    id: 'marta',
    name: 'Marta (Mates y termos)',
    voice: 1.2,
    look: { body: 'adult', skin: 'skin3', hair: 'hairBlack', hairStyle: 'ponytail', top: 'red', topStyle: 'puffer', bottom: 'black', shoes: 'black', scarf: 'white', holding: 'mate' },
  },
  beto: {
    id: 'beto',
    name: 'Beto (Ensayos Eólicos)',
    voice: 0.85,
    look: { body: 'adult', skin: 'skin2', hair: 'hairBlack', hairStyle: 'cap', hat: 'ppNavy', top: 'slate5', topStyle: 'vest', accent: 'ppNavy', bottom: 'navy', shoes: 'black', beard: 'stubble', holding: 'folder' },
  },

  // ---- Municipalidad
  graciela: { ...ch1.empleada, id: 'graciela', name: 'Graciela (Obras Particulares)' },
  norma: {
    id: 'norma',
    name: 'Norma (Tesorería)',
    voice: 1.15,
    look: { body: 'adult', skin: 'skin1', hair: 'hairGrey', hairStyle: 'curly', top: 'slate4', topStyle: 'cardigan', bottom: 'black', shoes: 'black', glasses: true, lanyard: 'muniTeal' },
  },
  custodio: {
    id: 'custodio',
    name: 'Custodio (Municipalidad)',
    voice: 0.8,
    look: { body: 'adult', skin: 'skin3', hair: 'hairBlack', hairStyle: 'cap', hat: 'navy', top: 'navy', topStyle: 'uniform', accent: 'slate3', bottom: 'navy', shoes: 'black', beard: 'mustache', heavy: true },
  },
  empleado_asamblea: {
    id: 'empleado_asamblea',
    name: 'Empleada (en asamblea)',
    voice: 1.25,
    look: { body: 'adult', skin: 'skin1', hair: 'hairRed', hairStyle: 'ponytail', top: 'muniTeal', topStyle: 'puffer', bottom: 'black', shoes: 'black', lanyard: 'muniTeal' },
  },

  // ---- obra del Centro de Distribución 2 y Acá Nomás Suc. 15
  sereno: {
    id: 'sereno',
    name: 'Cacho (sereno)',
    voice: 0.75,
    look: { body: 'adult', skin: 'skin3', hair: 'hairGrey', hairStyle: 'cap', hat: 'orange', top: 'brown', topStyle: 'coat', bottom: 'grey', shoes: 'black', beard: 'beard', holding: 'mate', heavy: true },
  },
  julian: {
    id: 'julian',
    name: 'Julián (Gerente de Expansión)',
    voice: 1.0,
    look: { body: 'adult', skin: 'skin1', hair: 'hairDark', hairStyle: 'short', top: 'anOrange', topStyle: 'jacket', accent: 'anCream', bottom: 'black', shoes: 'black', lanyard: 'anCream', holding: 'folder' },
  },
  promotora: {
    id: 'promotora',
    name: 'Promotora (Acá Nomás)',
    voice: 1.35,
    look: { body: 'adult', skin: 'skin2', hair: 'hairBrown', hairStyle: 'ponytail', hat: 'anOrange', top: 'anOrange', topStyle: 'uniform', accent: 'anCream', bottom: 'black', shoes: 'black', holding: 'folder' },
  },

  // ---- la voz del teléfono de "atención"
  ivr: {
    id: 'ivr',
    name: 'Atención automática',
    voice: 0.6,
    look: { body: 'adult', skin: 'skin1', hair: 'hairGrey', hairStyle: 'bald', top: 'slate7', topStyle: 'suit', tie: 'muniTeal', bottom: 'slate7', shoes: 'black', glasses: true },
  },

  // ---- cameos del otro protagonista (el aspecto de Nahuel ya sin la carpeta, para la feria)
  diego_feria: { ...ch1.diego, id: 'diego_feria', name: 'Diego (Habilitaciones)', sprite: undefined, look: { ...characters.municipal.look, holding: 'phone' } },
};
