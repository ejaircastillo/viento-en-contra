import { engine } from '../../engine/core/Engine';
import { isoToScreen } from '../../engine/core/math';
import type { StateFn } from '../../engine/mission/types';
import type { ChapterContext } from '../../engine/mission/ChapterContext';
import type { WorldScene } from '../../engine/world/WorldScene';
import type { VehicleLook } from '../../engine/assets/gen/vehicles';
import { characters } from '../characters';
import { think, baseHooks, driveHint, arriveOnFoot, spawnNpc, waitPhoneTap } from '../shared/flowKit';
import { CONFIG2 } from './config';
import { FAIR_BOUNDS } from './city';
import { propBannerFly } from './props';

/**
 * Capítulo 2 · "Horario de atención" (jueves, segundo día de paro).
 * Dos rutas distintas que se cruzan en la feria y terminan juntas en el kiosco:
 *   Diego  → operativo de actas: feria (zona libre de actas), obra "jurisdicción viento", inauguración de Acá Nomás.
 *   Nahuel → circuito del certificado: ensayo eólico (aguantar el cartel), Tesorería y Obras Particulares.
 * Cada estado arma su escena desde cero (así "Continuar" retoma en cualquiera) y devuelve el siguiente.
 */
export const stateOrder = [
  'ARRANQUE',
  'D_BRIEFING',
  'D_A_LA_FERIA',
  'D_FERIA',
  'D_A_LA_OBRA',
  'D_OBRA',
  'D_A_ACA_NOMAS',
  'D_ACA_NOMAS',
  'D_AL_KIOSCO',
  'N_AMANECER',
  'N_A_LA_FERIA',
  'N_ENSAYO',
  'N_A_LA_MUNI',
  'N_TESORERIA',
  'N_OBRAS',
  'N_AL_KIOSCO',
  'FINAL_KIOSCO',
];

/** La camioneta de Habilitaciones (Diego no usa su auto en el operativo). */
const PICKUP: VehicleLook = { model: 'pickup', body: 'carWhite', accent: 'muniTeal' };
/** Nahuel con el cartel en las manos. */
const SIGN_LOOK = { ...characters.emprendedor.look, holding: 'sign' as const };

// ------------------------------------------------------------------------------------------ la feria

interface StallDef {
  id: string;
  dlg: string;
  flag: string;
  name: string;
  law: string;
  required: boolean;
}

const STALLS: StallDef[] = [
  { id: 'nelly', dlg: 'd_stall_nelly', flag: 'acta_nelly', name: 'Tejidos Nelly', law: 'Art. 12 bis: exhibir lana sin permiso, aun siendo temporario.', required: true },
  { id: 'lucas', dlg: 'd_stall_lucas', flag: 'acta_lucas', name: 'Alfajores del Viento', law: 'Art. 31: elaborar alfajores sin bromatología (en trámite).', required: false },
  { id: 'vero', dlg: 'd_stall_vero', flag: 'acta_vero', name: 'Vero Estilo', law: 'Art. 7: cortar el pelo en la vía pública sin habilitación.', required: true },
  { id: 'tito', dlg: 'd_stall_tito', flag: 'acta_tito', name: 'Escobas Don Tito', law: 'Art. 88: barrer sin autorización, aun para atrás.', required: true },
  { id: 'marta', dlg: 'd_stall_marta', flag: 'acta_marta', name: 'Mates y Termos', law: 'Art. 45: ofrecer mate cocido con folleto.', required: false },
];

function spawnFair(ctx: ChapterContext, w: WorldScene): void {
  spawnNpc(ctx, w, 'facundo', 'podium', { facing: 'S', z: 6 });
  spawnNpc(ctx, w, 'prensa', 'prensa', { facing: 'N' });
  ['vecino_a', 'vecino_b', 'vecino_c'].forEach((id, i) => spawnNpc(ctx, w, id, `crowd_${i + 1}`, { wander: 0.4 }));
  for (const s of STALLS) spawnNpc(ctx, w, s.id, `stall_${s.id}`, { facing: 'S' });
  spawnNpc(ctx, w, 'beto', 'beto', { facing: 'W' });
}

function cutRibbon(ctx: ChapterContext, w: WorldScene): void {
  ctx.sfx('whoosh');
  w.setStaticFrame('stage', 1);
}

/** El viento se lleva el telón oficial de la feria (que, claro, no tenía certificado). */
function flyBanner(w: WorldScene): void {
  const st = w.staticsById.get('stage');
  if (!st) return;
  const ref = engine.assets.ensure('banner:fly', () => propBannerFly());
  engine.assets.flush();
  const p = isoToScreen(st.x + 2.75, st.y + 0.18, 54);
  const img = w.add.image(p.x, p.y, ref.texture, ref.frames[0]).setOrigin(ref.ax / ref.w, ref.ay / ref.h).setDepth(8.9e6);
  w.tweens.add({ targets: img, x: p.x + 240, y: p.y - 110, angle: 400, duration: 3600, ease: 'Sine.easeIn', onComplete: () => img.destroy() });
  w.tweens.add({ targets: img, scaleX: 1.25, scaleY: 0.75, yoyo: true, repeat: 7, duration: 230 });
}

function bannerGust(ctx: ChapterContext, w: WorldScene): void {
  ctx.gust(0.95, 3.4);
  w.setStaticFrame('stage', 2);
  flyBanner(w);
}

function feriaHooks(ctx: ChapterContext, w: WorldScene): void {
  ctx.hooks.set('cut_ribbon', () => cutRibbon(ctx, w));
  ctx.hooks.set('gust', () => bannerGust(ctx, w));
}

async function actaPaper(ctx: ChapterContext, title: string, law: string): Promise<void> {
  const n = Number(ctx.flags.actas ?? 0);
  ctx.sfx('stamp');
  await ctx.paper({
    title: `ACTA DE INFRACCIÓN N° ${String(411 + n).padStart(4, '0')}`,
    small: `Operativo "Comercio en Regla" · ${title}`,
    lines: [law, 'Firmada por el inspector. Notificada al infractor. Cobrada: próximamente.'],
    handwritten: 'LABRADA',
    button: 'Firmar y guardar',
  });
}

// ------------------------------------------------------------------------------------- la línea de "jurisdicciones"

/** Contestador automático con menú: cada opción manda a otra jurisdicción, hasta que alguien prueba el 4. */
async function jurisdictionLine(ctx: ChapterContext): Promise<void> {
  await ctx.phoneSession(
    'ivr',
    async () => {
      await ctx.line('ivr', 'Línea de Jurisdicciones. Su llamada es importante para nosotros. Usted es el llamante número 1.204.');
      const replies: Record<string, string> = {
        '1': 'Consulta municipal: comuníquese con la Provincia. Marque 2.',
        '2': 'Consulta provincial: eso es de Nación. Marque 3.',
        '3': 'Consulta nacional: eso es del Municipio. Marque 1.',
      };
      // en ?autoplay se elige primero el 4, si no el menú no terminaría nunca
      const order = engine.debug.autoplay ? ['4', '1', '2', '3'] : ['1', '2', '3', '4'];
      const label: Record<string, string> = {
        '1': '1 · Consulta municipal',
        '2': '2 · Consulta provincial',
        '3': '3 · Consulta nacional',
        '4': '4 · No sé de quién es',
      };
      let wrong = 0;
      for (;;) {
        await ctx.say([
          { who: 'ivr', text: wrong === 0 ? 'Elija una opción.' : 'Elija una opción. Su llamada sigue siendo importante.' },
          ...(wrong >= 3 ? [{ who: 'tomi', text: 'Papá, probá el cuatro.' } as const] : []),
          { choice: order.map((k) => ({ text: label[k], set: { ivr_pick: k } })) },
        ]);
        const pick = String(ctx.flags.ivr_pick);
        if (pick === '4') break;
        wrong++;
        await ctx.line('ivr', replies[pick]);
      }
      await ctx.line('ivr', 'Si no sabe de quién es, es del viento. Su reclamo fue derivado al viento. Gracias por comunicarse.');
    },
    'Línea de Jurisdicciones',
  );
}

// --------------------------------------------------------------------------------------------- estados

export const states: Record<string, StateFn> = {
  // ============================================================== los dos: la mañana del jueves
  async ARRANQUE(ctx) {
    baseHooks(ctx);
    ctx.clock.set(CONFIG2.clock.start);
    ctx.clock.window('08:00', '08:14', 0.1);
    await ctx.card('Capítulo 2 · Horario de atención', 'Jueves · segundo día de paro · alerta naranja por viento', 3400);
    await ctx.card('Ayer', 'Un paro sorpresa, un choque, una tasa nueva y un certificado obligatorio que rigió ese mismo día.', 3200);
    return ctx.is('municipal') ? 'D_BRIEFING' : 'N_AMANECER';
  },

  // ============================================================== DIEGO · el operativo
  async D_BRIEFING(ctx) {
    baseHooks(ctx);
    ctx.clock.set('08:12');
    ctx.clock.window('08:26', '08:32', 0.08);
    const room = await ctx.interior('muni_hab', { player: { at: 'entry', facing: 'E' }, companions: [{ id: 'kid', at: 'door_in', follow: true }] });
    ctx.music('interior');
    spawnNpc(ctx, room, 'mirta', 'mirta_desk', { facing: 'E', pose: 'sit' });
    spawnNpc(ctx, room, 'ciudadano_a', 'seat_2', { pose: 'sit' });
    spawnNpc(ctx, room, 'empleado_asamblea', 'seat_5', { pose: 'sit' });
    spawnNpc(ctx, room, 'ponce', 'ponce_entry', { facing: 'W' });
    room.face('player', 'ponce');
    void ctx.notify('Caro', 'Doble guardia. No puedo con Tomi. Perdón. Te quiero. Devolvémelo entero.').catch(() => undefined);
    await ctx.say('d_brief');
    await ctx.say('d_brief_tablet');
    await ctx.crt({
      title: 'PATAGONIA PUEDE DIGITAL · MÓDULO DE ACTAS v0.3 (BETA)',
      lines: ['Sincronizando con el servidor…', '**3 %**', 'Tiempo estimado: 4 h 12 min', '⚠ Actualización disponible: 4,2 GB', 'Mientras tanto, use la planilla en papel.'],
      button: 'Aceptar',
    });
    await ctx.paper({
      title: 'PLANILLA DE INSPECCIONES',
      small: 'Operativo "Comercio en Regla" · jueves',
      rows: [
        { label: '1. Feria de Emprendedores (costanera)', value: '—' },
        { label: '2. Obra Centro de Distribución 2 (Alcorta)', value: '—' },
        { label: '3. Acá Nomás Sucursal 15 (Errázuriz)', value: '—' },
        { label: '4. Kiosco El Refugio (Fagnano 1180)', value: '11:00' },
      ],
      total: 'META: 5 ACTAS',
      button: 'Guardar la planilla',
    });
    ctx.objective('Notificá la inspección al kiosco');
    await waitPhoneTap(ctx, 'Llamar a Nahuel');
    await ctx.phoneCall('nahuel', 'd_call_notify');
    ctx.objective('Salí con Tomi hacia la camioneta', 'exit');
    await ctx.waitZone('exit');
    ctx.sfx('door_open');
    await ctx.fadeOut(400);
    ctx.music(null);
    return 'D_A_LA_FERIA';
  },

  async D_A_LA_FERIA(ctx) {
    baseHooks(ctx);
    ctx.clock.window('08:50', '08:56', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'muni_car', parked: true, look: PICKUP, toward: 'feria_car' }, passengers: ['kid'] });
    w.setDestination('feria_car');
    ctx.objective('Andá a la Feria de Emprendedores (costanera)', 'feria_car');
    driveHint(ctx);
    ctx.radio.program('d1');
    ctx.radio.on();
    ctx.spawnTask(async () => {
      await ctx.twait(4500);
      ctx.bark('kid', '¿Vamos a inspeccionar a alguien que conozco?');
      await ctx.twait(2400);
      ctx.bark('player', 'Ojalá que no.', { name: false });
      await ctx.twait(8000);
      await ctx.notify('Ponce (jefe)', 'La asamblea votó: no se trabaja. El operativo sigue: no es trabajo.');
    });
    ctx.onZone('feria_view', () => think(ctx, { all: 'La costanera. Con este viento, la feria dura lo que dure la cinta.' }));
    await w.waitArrival('feria_car');
    ctx.radio.off();
    return 'D_FERIA';
  },

  async D_FERIA(ctx) {
    baseHooks(ctx);
    ctx.clock.window('09:36', '09:42', 0.06);
    const w = await arriveOnFoot(ctx, 'feria_car', [57.2, 9.5], ['kid'], { carLook: PICKUP });
    w.walkBounds = { rect: FAIR_BOUNDS, msg: 'Primero los puestos de la feria.' };
    feriaHooks(ctx, w);
    spawnFair(ctx, w);
    ctx.music('feria');
    ctx.objective('Acercate al escenario', 'feria_stage_zone');
    await ctx.waitZone('feria_stage_zone');
    w.face('player', 'facundo');
    await ctx.say('d_feria_ceremony');
    ctx.music(null);
    // a recorrer los puestos: tres obligatorios, dos opcionales
    const done = new Set<string>();
    const remaining = () => STALLS.filter((s) => s.required && !done.has(s.id));
    const refresh = () => {
      const next = remaining()[0] ?? STALLS.find((s) => !done.has(s.id));
      const need = remaining().length;
      const head = need ? `Inspeccioná los puestos (${done.size}/5 · faltan ${need} obligatorios)` : `Podés seguir con los otros puestos (${done.size}/5) o subir a la camioneta`;
      ctx.objective(head, need ? next?.id : 'car');
      if (!need) w.enableCarInteract('Subir a la camioneta');
    };
    for (const s of STALLS) {
      w.setInteract(s.id, { label: 'Inspeccionar el puesto', icon: '📋', radius: 2.4 });
      ctx.onInteract(
        s.id,
        async () => {
          w.setInteract(s.id, null);
          w.face('player', s.id);
          await ctx.say(s.dlg);
          if (ctx.flags[s.flag] === 'si') {
            await actaPaper(ctx, s.name, s.law);
            ctx.flags.actas = Number(ctx.flags.actas ?? 0) + 1;
          }
          done.add(s.id);
          ctx.toast(`Actas: ${ctx.flags.actas ?? 0} de 5`, 2200);
          refresh();
        },
        true,
      );
    }
    refresh();
    await ctx.waitUntil(() => remaining().length === 0);
    await ctx.say('d_feria_fin');
    w.enableCarInteract('Subir a la camioneta');
    refresh();
    await ctx.waitInteract('car');
    await w.enterCar(['kid']);
    return 'D_A_LA_OBRA';
  },

  async D_A_LA_OBRA(ctx) {
    baseHooks(ctx);
    ctx.clock.window('09:50', '09:56', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'feria_car', parked: true, look: PICKUP, toward: 'obra_car' }, passengers: ['kid'] });
    w.setDestination('obra_car');
    ctx.objective('Andá a la obra del Centro de Distribución 2 (Alcorta)', 'obra_car');
    ctx.radio.program('d2');
    ctx.radio.on();
    ctx.onZone('cd2_view', () => think(ctx, { all: 'El cartel más grande de la ciudad. La obra, lo que se ve de atrás.' }));
    ctx.spawnTask(async () => {
      await ctx.twait(6000);
      ctx.bark('kid', '¿Podemos comprar facturas? Estamos trabajando, pero con hambre.');
      await ctx.twait(2600);
      ctx.bark('player', 'Cuando terminemos el operativo. Si termina.', { name: false });
    });
    await w.waitArrival('obra_car');
    ctx.radio.off();
    return 'D_OBRA';
  },

  async D_OBRA(ctx) {
    baseHooks(ctx);
    ctx.clock.window('10:12', '10:18', 0.05);
    const w = await arriveOnFoot(ctx, 'obra_car', [40.6, 60.4], ['kid'], { carLook: PICKUP });
    w.walkBounds = { rect: [36.5, 55.5, 47.5, 63], msg: 'Primero la obra.' };
    spawnNpc(ctx, w, 'sereno', 'sereno', { facing: 'S' });
    ctx.objective('Hablá con el sereno de la obra', 'sereno');
    w.setInteract('sereno', { label: 'Hablar con el sereno', icon: '💬', radius: 2.2 });
    await ctx.waitInteract('sereno');
    w.setInteract('sereno', null);
    w.face('player', 'sereno');
    await ctx.say('d_obra');
    ctx.objective('Llamá a Ponce');
    await waitPhoneTap(ctx, 'Llamar a Ponce');
    await ctx.phoneCall('ponce', 'd_obra_ponce');
    ctx.objective('Llamá a la Línea de Jurisdicciones');
    await waitPhoneTap(ctx, 'Llamar a la Línea de Jurisdicciones');
    await jurisdictionLine(ctx);
    await ctx.say('d_obra_fin');
    ctx.objective('Volvé a la camioneta con Tomi', 'car');
    w.enableCarInteract('Subir a la camioneta');
    await ctx.waitInteract('car');
    await w.enterCar(['kid']);
    return 'D_A_ACA_NOMAS';
  },

  async D_A_ACA_NOMAS(ctx) {
    baseHooks(ctx);
    ctx.clockMeaning(CONFIG2.meaning.municipal_late);
    ctx.clock.window('10:24', '10:30', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'obra_car', parked: true, look: PICKUP, toward: 'an15_car' }, passengers: ['kid'] });
    w.setDestination('an15_car');
    ctx.objective('Andá a Acá Nomás, sucursal 15 (Errázuriz)', 'an15_car');
    ctx.radio.program('d3');
    ctx.radio.on();
    ctx.onZone('an15_view', () => think(ctx, { all: 'La ex farmacia. Hoy, sucursal quince. Mañana, sucursal dieciséis.' }));
    await w.waitArrival('an15_car');
    ctx.radio.off();
    return 'D_ACA_NOMAS';
  },

  async D_ACA_NOMAS(ctx) {
    baseHooks(ctx);
    ctx.clock.window('10:40', '10:46', 0.05);
    const w = await arriveOnFoot(ctx, 'an15_car', 'an15_door', ['kid'], { carLook: PICKUP });
    w.walkBounds = { rect: [70, 49, 79.5, 60], msg: 'Primero la inauguración.' };
    spawnNpc(ctx, w, 'julian', 'julian', { facing: 'W' });
    spawnNpc(ctx, w, 'promotora', 'promo_1', { facing: 'W', wander: 0.5 });
    ctx.objective('Hablá con el gerente de Acá Nomás', 'julian');
    w.setInteract('julian', { label: 'Pedir la habilitación', icon: '📋', radius: 2.2 });
    await ctx.waitInteract('julian');
    w.setInteract('julian', null);
    w.face('player', 'julian');
    await ctx.say('d_an15');
    if (ctx.flags.d_an15 === 'acta') await ctx.say('d_an15_acta');
    await ctx.say('d_an15_fin');
    ctx.objective('Volvé a la camioneta con Tomi', 'car');
    w.enableCarInteract('Subir a la camioneta');
    await ctx.waitInteract('car');
    await w.enterCar(['kid']);
    return 'D_AL_KIOSCO';
  },

  async D_AL_KIOSCO(ctx) {
    baseHooks(ctx);
    ctx.clock.window('10:56', '11:00', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'an15_car', parked: true, look: PICKUP, toward: 'home_car' }, passengers: ['kid'] });
    w.setDestination('home_car');
    ctx.objective('Andá al Kiosco El Refugio (Fagnano 1180)', 'home_car');
    ctx.radio.program('d4');
    ctx.radio.on();
    ctx.onZone(
      'kiosk_view',
      async () => {
        ctx.bark('kid', '¿Este es el kiosco de Benja?');
        await ctx.twait(2400);
        ctx.bark('player', 'Sí. Y hoy soy el inspector.', { name: false });
        await ctx.twait(2600);
        ctx.bark('kid', '¿Eso es peor que ser papá?');
        await ctx.twait(2600);
        ctx.bark('player', 'Depende de la meta.', { name: false });
      },
      true,
    );
    await w.waitArrival('home_car');
    ctx.radio.off();
    return 'FINAL_KIOSCO';
  },

  // ============================================================== NAHUEL · el certificado
  async N_AMANECER(ctx) {
    baseHooks(ctx);
    ctx.clock.set('08:05');
    ctx.clock.window('08:18', '08:24', 0.08);
    const w = await ctx.city({
      mode: 'walk',
      player: { at: 'home_door', facing: 'S' },
      car: { at: 'home_car' },
      bounds: [34.3, 74.6, 43.4, 79.3],
      boundsMsg: 'Primero el certificado del cartel.',
    });
    spawnNpc(ctx, w, 'elba', 'elba', { facing: 'S' });
    spawnNpc(ctx, w, 'benja', 'home_kid', { facing: 'S', wander: 0.3 });
    ctx.music(null);
    await ctx.say('n_amanecer');
    ctx.objective('Atendé la llamada del inspector');
    await waitPhoneTap(ctx, 'Atender: Diego (Habilitaciones)');
    await ctx.phoneCall('diego', 'n_call_notify');
    ctx.objective('Sacá el cartel del kiosco', 'kiosk_sign');
    w.setInteract('kiosk_sign', { label: 'Sacar el cartel', icon: '🪧', radius: 1.7 });
    await ctx.waitInteract('kiosk_sign');
    w.setInteract('kiosk_sign', null);
    w.setStaticHidden('kiosk_sign', true);
    ctx.sfx('whoosh');
    ctx.reskinPlayer(SIGN_LOOK);
    ctx.carry(2.1);
    ctx.flags.cartel = true;
    await think(ctx, { all: 'Pesa poco. Pero con este viento pesa el doble.' });
    ctx.hint('Con el cartel en las manos, caminar contra el viento cuesta el doble.', 6000);
    ctx.objective('Subí al utilitario', 'car');
    w.enableCarInteract('Subir al utilitario');
    await ctx.waitInteract('car');
    await w.enterCar([]);
    return 'N_A_LA_FERIA';
  },

  async N_A_LA_FERIA(ctx) {
    baseHooks(ctx);
    ctx.clock.window('08:40', '08:46', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'home_car', parked: true, toward: 'feria_car' } });
    w.playerLook = SIGN_LOOK;
    w.setDestination('feria_car');
    ctx.objective('Llevá el cartel a la Feria (Estación de Ensayos)', 'feria_car');
    driveHint(ctx);
    ctx.radio.program('n1');
    ctx.radio.on();
    ctx.spawnTask(async () => {
      await ctx.twait(5000);
      await ctx.notify('Vero (hermana)', 'Te guardé lugar en la feria, al lado del puesto de mates. Ojo: no hay lugar. Es un decir.');
      await ctx.twait(9000);
      await ctx.notify('Mamá', 'Benja vendió tres alfajores. A crédito. A Don Tito.');
    });
    ctx.onZone('feria_view', () => think(ctx, { all: 'La feria. Ojalá el ensayo sea más fácil que el trámite.' }));
    await w.waitArrival('feria_car');
    ctx.radio.off();
    return 'N_ENSAYO';
  },

  async N_ENSAYO(ctx) {
    baseHooks(ctx);
    ctx.clock.window('09:26', '09:32', 0.06);
    const w = await arriveOnFoot(ctx, 'feria_car', [57.2, 9.5], [], { playerLook: SIGN_LOOK });
    ctx.carry(2.1);
    w.walkBounds = { rect: FAIR_BOUNDS, msg: 'Primero el ensayo del cartel.' };
    feriaHooks(ctx, w);
    spawnFair(ctx, w);
    spawnNpc(ctx, w, 'diego_feria', 'cameo_diego', { facing: 'N', wander: 0.5 });
    spawnNpc(ctx, w, 'tomi', 'cameo_tomi', { wander: 0.6 });
    ctx.music('feria');
    // la ceremonia sigue de fondo mientras el jugador camina
    ctx.spawnTask(async () => {
      await ctx.twait(3500);
      ctx.bark('facundo', '¡Hoy inauguramos la feria! Fruto de la escucha y de un decreto de esta mañana.');
      await ctx.twait(3400);
      ctx.bark('prensa', 'Un poquito a la izquierda, Facundo. Que se vea la ría.');
      await ctx.twait(3000);
      ctx.bark('facundo', '¡Y ahora, el corte de cinta!', { shout: true });
      await ctx.twait(1400);
      cutRibbon(ctx, w);
      await ctx.twait(2600);
      bannerGust(ctx, w);
      ctx.bark('prensa', '¡Se voló el telón!', { shout: true });
      await ctx.twait(2600);
      ctx.bark('facundo', 'Los carteles oficiales… no llevan certificado.');
      ctx.music(null);
    });
    ctx.objective('Buscá al técnico de la Estación de Ensayos', 'beto');
    w.setInteract('vero', { label: 'Saludar a Vero', icon: '💇', radius: 2.4 });
    ctx.onInteract(
      'vero',
      async () => {
        w.setInteract('vero', null);
        w.face('player', 'vero');
        await ctx.say('n_feria_vero');
      },
      true,
    );
    w.setInteract('diego_feria', { label: 'Saludar a Diego', icon: '📋', radius: 2.0 });
    ctx.onInteract(
      'diego_feria',
      async () => {
        w.setInteract('diego_feria', null);
        w.face('player', 'diego_feria');
        await ctx.say('n_feria_diego');
      },
      true,
    );
    w.setInteract('beto', { label: 'Hablar con el técnico', icon: '🔧', radius: 2.2 });
    await ctx.waitInteract('beto');
    w.setInteract('beto', null);
    w.face('player', 'beto');
    await ctx.say('n_beto_intro');
    w.control = false;
    await w.walkTo('player', 'lab_spot');
    w.face('player', 'N');
    w.control = true;
    const res = await ctx.brace({ title: 'ENSAYO EÓLICO', subtitle: 'Cartel: KIOSCO EL REFUGIO' });
    const kind = res.slips === 0 ? 'ok' : res.slips === 1 ? 'obs' : 'canso';
    ctx.flags.n_ensayo = kind;
    ctx.flags.n_rafagas = res.held;
    await ctx.say(`n_beto_${kind}`);
    await ctx.paper({
      title: 'ACTA DE ENSAYO EÓLICO N° 0001',
      small: 'Estación Móvil · Patagonia Puede',
      lines: [
        'Cartel: "KIOSCO EL REFUGIO" (madera y cinta de embalar).',
        `Ráfagas aguantadas: ${res.held} de ${res.total}.`,
        kind === 'ok' ? 'Resultado: APROBADO.' : kind === 'obs' ? 'Resultado: APROBADO CON OBSERVACIONES ("se voló").' : 'Resultado: APROBADO POR CANSANCIO (del técnico).',
      ],
      handwritten: 'APROBADO',
      button: 'Guardar el acta',
    });
    await ctx.say('n_beto_fin');
    // el cartel queda guardado en el utilitario
    ctx.reskinPlayer(null);
    ctx.carry(1);
    ctx.flags.cartel = false;
    await think(ctx, { all: 'Un acta de ensayo. Con birome. Es lo más oficial que tuve en ocho meses.' });
    ctx.objective('Volvé al utilitario: Obras cierra a las diez', 'car');
    w.enableCarInteract('Subir al utilitario');
    await ctx.waitInteract('car');
    await w.enterCar([]);
    return 'N_A_LA_MUNI';
  },

  async N_A_LA_MUNI(ctx) {
    baseHooks(ctx);
    ctx.clock.window('09:40', '09:46', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'feria_car', parked: true, toward: 'muni_car' } });
    w.setDestination('muni_car');
    ctx.objective('Llegá a la Municipalidad antes de que cierre Obras (10:00)', 'muni_car');
    ctx.radio.program('n2');
    ctx.radio.on();
    ctx.spawnTask(async () => {
      await ctx.twait(6000);
      await ctx.notify('Mamá', 'Nahue: vino una señora a comprar y preguntó si tenemos habilitación. Le dije que sí. Es casi verdad.');
    });
    await w.waitArrival('muni_car');
    ctx.radio.off();
    return 'N_TESORERIA';
  },

  async N_TESORERIA(ctx) {
    baseHooks(ctx);
    ctx.clock.window('09:52', '09:56', 0.08);
    const w = await arriveOnFoot(ctx, 'muni_car', 'muni_door', []);
    w.walkBounds = { rect: [33.5, 40.0, 42.5, 44.5], msg: 'Obras cierra a las diez.' };
    ctx.objective('Entrá a la Municipalidad', 'muni_door');
    await ctx.waitZone('muni_door');
    ctx.sfx('door_open');
    await ctx.fadeOut(400);
    const room = await ctx.interior('muni_pb', { player: { at: 'entry', facing: 'E' } });
    ctx.music('interior');
    spawnNpc(ctx, room, 'norma', 'norma_spot', { facing: 'S', pose: 'sit' });
    spawnNpc(ctx, room, 'custodio', 'custodio_spot', { facing: 'E' });
    spawnNpc(ctx, room, 'cliente_a', 'q1', { facing: 'N' });
    spawnNpc(ctx, room, 'cliente_b', 'q2', { facing: 'N' });
    spawnNpc(ctx, room, 'ciudadano_a', 'lobby_2', { wander: 0.3 });
    room.setInteract('ascensor', { label: 'Probar el ascensor', icon: '🛗', radius: 2.6 });
    ctx.onInteract('ascensor', () => ctx.say('n_pb_ascensor'));
    // la fila de la Caja 1 (breve)
    ctx.objective('Hacé la fila de la Caja 1', 'q3');
    await ctx.waitZone('queue_zone');
    room.control = false;
    await room.walkTo('player', 'q3');
    room.face('player', 'N');
    ctx.bark('cliente_a', 'Se cayó el sistema hace un rato.');
    await ctx.wait(2400);
    ctx.bark('norma', '¡Volvió! ¡Siguiente!', { shout: true });
    ctx.sfx('register');
    await room.walkTo('cliente_a', 'out_path');
    room.despawn('cliente_a');
    await room.walkTo('cliente_b', 'q1');
    await room.walkTo('player', 'q2');
    ctx.clock.advance(3);
    await ctx.wait(1200);
    ctx.bark('norma', '¡Siguiente!');
    await room.walkTo('cliente_b', 'out_path');
    room.despawn('cliente_b');
    room.control = true;
    room.setInteract('norma', { label: 'Abonar la tasa', icon: '💳', radius: 2.0 }, 'caja_pub');
    ctx.objective('Abonar la tasa en la Caja 1', 'norma');
    await ctx.waitInteract('norma');
    room.setInteract('norma', null);
    room.face('player', 'norma');
    await ctx.say('n_pb_norma');
    ctx.flags.n_comprobante = true;
    room.setInteract('escalera', { label: 'Subir al 2° piso', icon: '🪜', radius: 1.8 }, 'stairs_base');
    ctx.objective('Subí por la escalera al 2° piso (Obras Particulares)', 'escalera');
    await ctx.waitInteract('escalera');
    ctx.sfx('step');
    await ctx.fadeOut(400);
    ctx.music(null);
    return 'N_OBRAS';
  },

  async N_OBRAS(ctx) {
    baseHooks(ctx);
    // el reloj se frena en 09:59 (el sello sale "en el último minuto"): nunca se pasa de las diez ni retrocede
    ctx.clock.window('09:59', '09:59', 0.05);
    ctx.hooks.set('stamp_now', () => {
      ctx.sfx('stamp');
      ctx.clock.set('09:59');
      ctx.flags.n_sello = true;
    });
    const room = await ctx.interior('muni_obras', { player: { at: 'entry', facing: 'E' } });
    ctx.music('interior');
    spawnNpc(ctx, room, 'graciela', 'g1', { facing: 'S' });
    spawnNpc(ctx, room, 'ciudadano_b', 'wait_1', { pose: 'sit' });
    spawnNpc(ctx, room, 'empleado_asamblea', 'assembly_door', { facing: 'E' });
    // 1) Consultas
    ctx.objective('Ventanilla Consultas', 'w1_zone');
    await ctx.waitZone('w1_zone');
    room.face('player', 'graciela');
    await ctx.say('n_obras_w1');
    room.control = false;
    await room.walkTo('graciela', 'g2');
    room.control = true;
    // 2) Boletas
    ctx.objective('Ventanilla Boletas', 'w2_zone');
    await ctx.waitZone('w2_zone');
    room.face('player', 'graciela');
    await ctx.say('n_obras_w2');
    room.control = false;
    await room.walkTo('graciela', 'g3');
    room.control = true;
    // 3) Sellado y firma
    ctx.objective('Ventanilla Sellado y Firma', 'w3_zone');
    await ctx.waitZone('w3_zone');
    room.face('player', 'graciela');
    await ctx.say('n_obras_w3');
    ctx.bark('empleado_asamblea', '¡ASAMBLEA! ¡ASAMBLEA!', { shout: true });
    await ctx.paper({
      title: 'CERTIFICADO C.R.E.C. N° 000001',
      small: 'Obras Particulares · Resistencia Eólica de Cartelería',
      lines: ['Se certifica que el cartel "KIOSCO EL REFUGIO" (madera y cinta de embalar) resiste los vientos ensayados el día de la fecha.', 'Vigencia: a partir de las 00:00 de mañana.'],
      handwritten: 'PROVISORIO',
      button: 'Guardar el certificado',
    });
    await ctx.wait(600);
    ctx.objective('Salí de la Municipalidad', 'exit');
    await ctx.waitZone('exit');
    ctx.sfx('door_open');
    await ctx.fadeOut(400);
    ctx.music(null);
    return 'N_AL_KIOSCO';
  },

  async N_AL_KIOSCO(ctx) {
    baseHooks(ctx);
    ctx.clockMeaning(CONFIG2.meaning.emprendedor_late);
    ctx.clock.window('10:38', '10:44', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'muni_car', parked: true, toward: 'home_car' } });
    w.setDestination('home_car');
    ctx.objective('Volvé al kiosco antes de las once', 'home_car');
    ctx.radio.program('n3');
    ctx.radio.on();
    ctx.spawnTask(async () => {
      await ctx.twait(5000);
      await ctx.notify('Mamá', 'Nahue: llamó el inspector. Dice que a las once en punto. Trae a un nene. Digo: viene con un nene. Puse la pava.');
      await think(ctx, { all: 'Ya vienen. Y yo con un certificado que vale desde mañana.' });
    });
    ctx.onZone('kiosk_view', () => think(ctx, { all: 'Mi casa. Mi kiosco. Mi habilitación: en trámite.' }), true);
    await w.waitArrival('home_car');
    ctx.radio.off();
    return 'FINAL_KIOSCO';
  },

  // ============================================================== los dos: el kiosco, a las once
  async FINAL_KIOSCO(ctx) {
    baseHooks(ctx);
    const municipal = ctx.is('municipal');
    ctx.clock.window('10:56', '11:12', 0.04);
    const w = await arriveOnFoot(ctx, 'home_car', [38.4, 76.5], municipal ? ['kid'] : [], { carLook: municipal ? PICKUP : undefined });
    w.walkBounds = { rect: [34.3, 74.6, 43.4, 79.3], msg: 'Primero el kiosco.' };
    ctx.objective('Entrá al kiosco', 'kiosk_door');
    await ctx.waitZone('kiosk_door');
    ctx.sfx('door_open');
    await ctx.fadeOut(400);
    const room = await ctx.interior('kiosco', {
      player: { at: 'entry', facing: 'E' },
      companions: municipal ? [{ id: 'kid', at: 'door_in', follow: true }] : [],
    });
    ctx.objective(null);
    ctx.music('interior');
    spawnNpc(ctx, room, 'elba', 'elba_spot', { facing: 'S' });
    spawnNpc(ctx, room, 'benja', 'benja_spot', { facing: 'W' });
    if (municipal) spawnNpc(ctx, room, 'nahuel', 'nahuel_spot', { facing: 'N' });

    // documentos y efectos que pide el guion
    ctx.hooks.set('tablet', () =>
      ctx.crt({
        title: 'PATAGONIA PUEDE DIGITAL · MÓDULO DE ACTAS',
        lines: ['Sincronizando… **97 %**', 'Error: falta el 3 %.', 'Reintentando… **97 %**'],
        button: 'Reintentar',
      }),
    );
    ctx.hooks.set('certificate', () =>
      ctx.paper({
        title: 'CERTIFICADO C.R.E.C. N° 000001',
        small: 'Obras Particulares · Resistencia Eólica de Cartelería',
        lines: ['Se certifica que el cartel "KIOSCO EL REFUGIO" (madera y cinta de embalar) resiste los vientos ensayados el día de la fecha.', 'Vigencia: a partir de las 00:00 de mañana.'],
        handwritten: 'PROVISORIO',
        button: 'Volver',
      }),
    );
    ctx.hooks.set('acta_paper', async () => {
      ctx.flags.actas = Number(ctx.flags.actas ?? 0) + 1;
      await actaPaper(ctx, 'Kiosco El Refugio', 'Art. 7 ter: exhibir un certificado con vigencia futura.');
    });
    ctx.hooks.set('diego_arrives', async () => {
      ctx.clock.set('11:00');
      ctx.sfx('door_open');
      ctx.sfx('gust', 0.5);
      spawnNpc(ctx, room, 'diego', 'door_in', { facing: 'E' });
      spawnNpc(ctx, room, 'tomi', 'door_in', { facing: 'E' });
      await Promise.all([room.walkTo('diego', 'inspector_spot'), room.walkTo('tomi', 'kids_1')]);
      room.face('diego', 'player');
    });

    await ctx.say(municipal ? 'final_municipal_1' : 'final_emprendedor_1');
    // la radio del kiosco da la novedad
    ctx.radio.on();
    ctx.radio.flash('c2_sismica');
    await ctx.wait(9500);
    ctx.radio.off();
    await ctx.say(municipal ? 'final_municipal_2' : 'final_emprendedor_2');
    // Ponce llama a Diego
    if (municipal) {
      ctx.sfx('phone_ring');
      await ctx.phoneCall('ponce', 'final_ponce_call_municipal');
    } else {
      ctx.sfx('phone_ring');
      room.char('diego').pose = 'phone';
      await ctx.say('final_ponce_call_emprendedor');
      room.char('diego').pose = 'normal';
    }
    await ctx.say(municipal ? 'final_municipal_3' : 'final_emprendedor_3');
    ctx.flags.remate_visto = true;
    ctx.music(null);
    await ctx.wait(1200);
    await ctx.fadeOut(1400);
    return null;
  },
};
