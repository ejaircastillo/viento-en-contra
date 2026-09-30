import type { VehicleLook } from '../../engine/assets/gen/vehicles';
import type { CharacterLook } from '../../engine/assets/gen/characters';

/** Tránsito ambiental: muchas camionetas (Patagonia), colectivo y camiones de Patagonia Puede. */
export const traffic: { look: VehicleLook; w: number }[] = [
  { look: { model: 'pickup', body: 'carWhite' }, w: 5 },
  { look: { model: 'pickup', body: 'carSilver' }, w: 4 },
  { look: { model: 'pickup', body: 'carBlack' }, w: 2 },
  { look: { model: 'pickup', body: 'carRed' }, w: 2 },
  { look: { model: 'suv', body: 'carWhite' }, w: 2 },
  { look: { model: 'suv', body: 'carTeal' }, w: 1 },
  { look: { model: 'sedan', body: 'carSilver' }, w: 3 },
  { look: { model: 'sedan', body: 'carRed' }, w: 2 },
  { look: { model: 'sedan', body: 'carBlack' }, w: 2 },
  { look: { model: 'hatch', body: 'carBeige' }, w: 2 },
  { look: { model: 'hatch', body: 'carGreen' }, w: 1 },
  { look: { model: 'van', body: 'carWhite' }, w: 2 },
  { look: { model: 'bus', body: 'mustard', accent: 'slate8' }, w: 1 },
  { look: { model: 'truck', body: 'carWhite', accent: 'ppNavy' }, w: 1 },
  { look: { model: 'truck', body: 'carWhite', accent: 'anOrange' }, w: 1 },
];

/** Peatones abrigados (pocos: con este viento camina el que no tiene más remedio). */
export const pedestrians: CharacterLook[] = [
  { body: 'adult', skin: 'skin1', hair: 'hairDark', hairStyle: 'beanie', hat: 'grey', top: 'black', topStyle: 'puffer', bottom: 'denim', shoes: 'black' },
  { body: 'adult', skin: 'skin2', hair: 'hairBlack', hairStyle: 'long', top: 'red', topStyle: 'coat', bottom: 'black', shoes: 'black', scarf: 'snow' },
  { body: 'elder', skin: 'skin1', hair: 'hairGrey', hairStyle: 'boina', hat: 'brown', top: 'grey', topStyle: 'coat', bottom: 'brown', shoes: 'black', holding: 'bag' },
  { body: 'adult', skin: 'skin3', hair: 'hairBlack', hairStyle: 'cap', hat: 'navy', top: 'green', topStyle: 'jacket', bottom: 'denim', shoes: 'brown' },
  { body: 'adult', skin: 'skin1', hair: 'hairBlond', hairStyle: 'ponytail', top: 'purple', topStyle: 'puffer', bottom: 'grey', shoes: 'black', scarf: 'mustard' },
  { body: 'adult', skin: 'skin2', hair: 'hairBrown', hairStyle: 'short', top: 'orange', topStyle: 'vest', accent: 'grey', bottom: 'navy', shoes: 'black' },
];
