import type { NpcDef } from '../../engine/mission/types';
import { characters } from '../characters';

/**
 * NPCs del Capítulo 1. Un id con "@personaje" es una variante para esa ruta
 * (ej. el hijo y la hermana son distintos para cada protagonista).
 */
export const npcs: Record<string, NpcDef> = {
  'kid@municipal': {
    id: 'kid',
    name: 'Tomi',
    voice: 1.55,
    sprite: 'char.kid_municipal',
    look: { body: 'kid', skin: 'skin1', hair: 'hairBrown', hairStyle: 'beanie', hat: 'blue', top: 'guardapolvo', topStyle: 'guardapolvo', bottom: 'navy', shoes: 'black', backpack: 'blue' },
  },
  'kid@emprendedor': {
    id: 'kid',
    name: 'Benja',
    voice: 1.6,
    sprite: 'char.kid_emprendedor',
    look: { body: 'kid', skin: 'skin2', hair: 'hairBlack', hairStyle: 'beanie', hat: 'red', top: 'guardapolvo', topStyle: 'guardapolvo', bottom: 'denim', shoes: 'brown', backpack: 'green' },
  },
  'sister@municipal': {
    id: 'sister',
    name: 'Caro (hermana)',
    voice: 1.25,
    look: { body: 'adult', skin: 'skin1', hair: 'hairBrown', hairStyle: 'long', top: 'purple', topStyle: 'coat', bottom: 'black', shoes: 'black', scarf: 'mustard' },
  },
  'sister@emprendedor': {
    id: 'sister',
    name: 'Vero (hermana)',
    voice: 1.3,
    look: { body: 'adult', skin: 'skin2', hair: 'hairBlack', hairStyle: 'ponytail', top: 'green', topStyle: 'puffer', bottom: 'denim', shoes: 'black' },
  },
  // Elba: la mamá de Nahuel; atiende el kiosco mientras él hace los trámites (y le escribe como "Mamá").
  elba: {
    id: 'elba',
    name: 'Elba (mamá)',
    voice: 1.15,
    look: { body: 'elder', skin: 'skin2', hair: 'hairGrey', hairStyle: 'bun', top: 'brown', topStyle: 'cardigan', bottom: 'grey', shoes: 'black', scarf: 'red' },
  },
  tito: {
    id: 'tito',
    name: 'Don Tito',
    voice: 0.75,
    look: { body: 'elder', skin: 'skin1', hair: 'hairGrey', hairStyle: 'boina', hat: 'slate7', top: 'brown', topStyle: 'coat', bottom: 'grey', shoes: 'black', holding: 'broom' },
  },
  portero: {
    id: 'portero',
    name: 'Ramón (portero)',
    voice: 0.8,
    look: { body: 'adult', skin: 'skin2', hair: 'hairGrey', hairStyle: 'cap', hat: 'navy', top: 'slate5', topStyle: 'coat', bottom: 'navy', shoes: 'black', heavy: true },
  },
  agente: {
    id: 'agente',
    name: 'Agente de tránsito',
    voice: 0.9,
    look: { body: 'adult', skin: 'skin1', hair: 'hairDark', hairStyle: 'cap', hat: 'white', top: 'lime', topStyle: 'vest', accent: 'navy', bottom: 'navy', shoes: 'black' },
  },
  mama_a: {
    id: 'mama_a',
    name: 'Una mamá',
    voice: 1.25,
    look: { body: 'adult', skin: 'skin1', hair: 'hairBlond', hairStyle: 'ponytail', top: 'red', topStyle: 'puffer', bottom: 'black', shoes: 'black' },
  },
  papa_a: {
    id: 'papa_a',
    name: 'Un papá',
    voice: 0.85,
    look: { body: 'adult', skin: 'skin3', hair: 'hairBlack', hairStyle: 'short', top: 'green', topStyle: 'jacket', bottom: 'denim', shoes: 'brown', beard: 'beard' },
  },
  mama_b: {
    id: 'mama_b',
    name: 'Otra mamá',
    voice: 1.2,
    look: { body: 'adult', skin: 'skin2', hair: 'hairDark', hairStyle: 'curly', top: 'navy', topStyle: 'coat', bottom: 'grey', shoes: 'black', scarf: 'flagBlue' },
  },
  abuelo_a: {
    id: 'abuelo_a',
    name: 'Un abuelo',
    voice: 0.7,
    look: { body: 'elder', skin: 'skin1', hair: 'hairGrey', hairStyle: 'boina', hat: 'navy', top: 'grey', topStyle: 'coat', bottom: 'brown', shoes: 'black' },
  },
  nene_a: {
    id: 'nene_a',
    name: 'Un nene',
    voice: 1.6,
    look: { body: 'kid', skin: 'skin2', hair: 'hairBlack', hairStyle: 'short', top: 'guardapolvo', topStyle: 'guardapolvo', bottom: 'navy', shoes: 'black', backpack: 'red' },
  },
  nena_a: {
    id: 'nena_a',
    name: 'Una nena',
    voice: 1.7,
    look: { body: 'kid', skin: 'skin1', hair: 'hairRed', hairStyle: 'ponytail', top: 'guardapolvo', topStyle: 'guardapolvo', bottom: 'purple', shoes: 'black', backpack: 'mustard' },
  },
  cajera: {
    id: 'cajera',
    name: 'Yésica (caja)',
    voice: 1.3,
    look: { body: 'adult', skin: 'skin2', hair: 'hairBlack', hairStyle: 'cap', hat: 'anOrange', top: 'anOrange', topStyle: 'uniform', accent: 'anCream', bottom: 'black', shoes: 'black' },
  },
  cliente_a: {
    id: 'cliente_a',
    name: 'Señora de la fila',
    voice: 1.15,
    look: { body: 'elder', skin: 'skin1', hair: 'hairGrey', hairStyle: 'curly', top: 'purple', topStyle: 'coat', bottom: 'grey', shoes: 'black', holding: 'bag' },
  },
  cliente_b: {
    id: 'cliente_b',
    name: 'Señor de la fila',
    voice: 0.85,
    look: { body: 'adult', skin: 'skin3', hair: 'hairDark', hairStyle: 'short', top: 'brown', topStyle: 'jacket', bottom: 'denim', shoes: 'brown', beard: 'mustache' },
  },
  mirta: {
    id: 'mirta',
    name: 'Mirta (Mesa de Entradas)',
    voice: 1.1,
    look: { body: 'adult', skin: 'skin1', hair: 'hairRed', hairStyle: 'curly', top: 'purple', topStyle: 'cardigan', bottom: 'black', shoes: 'black', glasses: true, heavy: true },
  },
  ponce: {
    id: 'ponce',
    name: 'Lic. Ponce (director)',
    voice: 0.8,
    look: { body: 'adult', skin: 'skin1', hair: 'hairGrey', hairStyle: 'bald', top: 'slate7', topStyle: 'suit', tie: 'red', bottom: 'slate7', shoes: 'black', glasses: true, heavy: true },
  },
  diego: {
    id: 'diego',
    name: 'Diego (Habilitaciones)',
    voice: characters.municipal.voice,
    sprite: 'char.municipal',
    look: characters.municipal.look,
  },
  nahuel: {
    id: 'nahuel',
    name: 'Nahuel',
    voice: characters.emprendedor.voice,
    sprite: 'char.emprendedor',
    look: { ...characters.emprendedor.look, holding: 'folder' },
  },
  vecino_a: {
    id: 'vecino_a',
    name: 'Vecina autoconvocada',
    voice: 1.2,
    look: { body: 'adult', skin: 'skin2', hair: 'hairDark', hairStyle: 'beanie', hat: 'green', top: 'red', topStyle: 'puffer', bottom: 'black', shoes: 'black' },
  },
  vecino_b: {
    id: 'vecino_b',
    name: 'Vecino autoconvocado',
    voice: 0.85,
    look: { body: 'adult', skin: 'skin1', hair: 'hairBrown', hairStyle: 'short', top: 'navy', topStyle: 'puffer', bottom: 'denim', shoes: 'brown', beard: 'beard' },
  },
  vecino_c: {
    id: 'vecino_c',
    name: 'Vecino',
    voice: 0.75,
    look: { body: 'elder', skin: 'skin1', hair: 'hairGrey', hairStyle: 'cap', hat: 'red', top: 'grey', topStyle: 'coat', bottom: 'brown', shoes: 'black', holding: 'mate' },
  },
  vecino_d: {
    id: 'vecino_d',
    name: 'Vecina',
    voice: 1.3,
    look: { body: 'adult', skin: 'skin3', hair: 'hairBlack', hairStyle: 'long', top: 'mustard', topStyle: 'coat', bottom: 'black', shoes: 'black' },
  },
  ciudadano_a: {
    id: 'ciudadano_a',
    name: 'Señor con número 44',
    voice: 0.8,
    look: { body: 'elder', skin: 'skin1', hair: 'hairGrey', hairStyle: 'bald', top: 'brown', topStyle: 'coat', bottom: 'grey', shoes: 'black', glasses: true },
  },
  ciudadano_b: {
    id: 'ciudadano_b',
    name: 'Chica con número 45',
    voice: 1.3,
    look: { body: 'adult', skin: 'skin2', hair: 'hairBrown', hairStyle: 'bun', top: 'blue', topStyle: 'puffer', bottom: 'black', shoes: 'black', holding: 'phone' },
  },
  ciudadano_c: {
    id: 'ciudadano_c',
    name: 'Señor con número 46',
    voice: 0.9,
    look: { body: 'adult', skin: 'skin3', hair: 'hairBlack', hairStyle: 'cap', hat: 'black', top: 'green', topStyle: 'jacket', bottom: 'denim', shoes: 'brown', holding: 'folder' },
  },
  empleada: {
    id: 'empleada',
    name: 'Empleada de Obras Particulares',
    voice: 1.2,
    look: { body: 'adult', skin: 'skin1', hair: 'hairBlond', hairStyle: 'bun', top: 'wallTeal', topStyle: 'cardigan', bottom: 'black', shoes: 'black', glasses: true },
  },
};
