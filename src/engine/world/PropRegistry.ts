import * as P from '../assets/gen/props';
import { drawVehicleSheet, type VehicleLook } from '../assets/gen/vehicles';
import { hashStr } from '../core/math';
import type { GenOutput } from '../assets/AssetRegistry';

/**
 * Tipos de props disponibles para los planos. El contenido puede registrar tipos propios
 * (carteles de marcas, objetos de un capítulo) con registerProp sin tocar el motor.
 */
export type PropGen = (params: any) => GenOutput;

const registry = new Map<string, PropGen>();

export function registerProp(type: string, gen: PropGen): void {
  registry.set(type, gen);
}

export function propGen(type: string): PropGen {
  const g = registry.get(type);
  if (!g) throw new Error(`[Props] tipo desconocido: ${type}`);
  return g;
}

export function hasProp(type: string): boolean {
  return registry.has(type);
}

export function propKey(type: string, params: unknown): string {
  return `prop:${type}:${hashStr(JSON.stringify(params ?? {})).toString(36)}`;
}

export function vehicleKey(look: VehicleLook): string {
  return `veh:${look.model}:${look.body}:${look.accent ?? ''}:${look.damaged ? 'd' : ''}`;
}

// Registro base del motor.
registerProp('pole', P.propPole);
registerProp('streetlight', P.propStreetlight);
registerProp('tlight', () => P.propTrafficLight());
registerProp('pare', () => P.propPare());
registerProp('streetsign', () => P.propStreetSign());
registerProp('plate', P.propPlate);
registerProp('alamo', P.propAlamo);
registerProp('tree', P.propTree);
registerProp('bush', P.propBush);
registerProp('coiron', P.propCoiron);
registerProp('bin', () => P.propBin());
registerProp('container', P.propContainer);
registerProp('bench', P.propBench);
registerProp('busstop', P.propBusStop);
registerProp('cone', () => P.propCone());
registerProp('barrier', P.propBarrier);
registerProp('fence', P.propFence);
registerProp('flag', P.propFlag);
registerProp('letters', P.propLetters);
registerProp('flamingo', () => P.propFlamingo());
registerProp('bag', P.propBag);
registerProp('dog', P.propDog);
registerProp('mixer', () => P.propMixer());
registerProp('sandpile', P.propSandpile);
registerProp('bricks', () => P.propBricks());
registerProp('antenna', P.propAntenna);
registerProp('billboard', P.propBillboard);
registerProp('banner', P.propProtestBanner);
registerProp('beanie', P.propBeanie);
registerProp('pothole_sign', () => P.propPotholeSign());
registerProp('clothesline', P.propClothesline);
registerProp('desk', P.propDesk);
registerProp('chair', P.propChair);
registerProp('counter', P.propCounter);
registerProp('ticket', () => P.propTicketMachine());
registerProp('cabinet', () => P.propCabinet());
registerProp('cooler', () => P.propWaterCooler());
registerProp('plant', P.propPlant);
registerProp('shelf', P.propShelf);
registerProp('fridge', P.propFridge);
registerProp('checkout', P.propCheckout);
registerProp('heater', () => P.propHeater());
registerProp('papers', () => P.propPapers());
registerProp('wallclock', () => P.propWallClock());
registerProp('vehicle', (p: { look: VehicleLook }) => drawVehicleSheet(p.look));
