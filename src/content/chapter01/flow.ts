import { engine } from '../../engine/core/Engine';
import type { StateFn } from '../../engine/mission/types';
import type { ChapterContext } from '../../engine/mission/ChapterContext';
import type { WorldScene } from '../../engine/world/WorldScene';
import type { InteriorScene } from '../../engine/interior/InteriorScene';
import { CONFIG } from './config';
import { think, driveHint, arriveOnFoot, spawnNpc, baseHooks as setupHooks, touch } from '../shared/flowKit';

/**
 * Capítulo 1 como estados explícitos (spec §23). Cada estado prepara su escena desde cero
 * (así "Continuar" retoma en cualquiera) y devuelve el siguiente.
 */
export const stateOrder = [
  'LEAVE_HOME',
  'DRIVE_TO_SCHOOL',
  'TRAFFIC_LIGHT_BLOCK',
  'DETOUR',
  'SCHOOL_STRIKE',
  'CALL_SISTER',
  'DRIVE_TO_SISTER',
  'DROP_CHILD',
  'ROUTE_TO_OBJECTIVE',
  'MUNICIPAL_PAYMENT',
  'MUNICIPAL_DRIVE_TO_WORK',
  'MUNICIPAL_WORK',
  'ENTREPRENEUR_PERMIT',
  'SATIRICAL_REVEAL',
];

function spawnProtest(ctx: ChapterContext, w: WorldScene): void {
  const ids = ['vecino_a', 'vecino_b', 'vecino_c', 'vecino_d'];
  ids.forEach((id, i) => {
    if (!w.chars.has(id)) spawnNpc(ctx, w, id, `protest_${i + 1}`, { wander: 0.4 });
  });
  const chants = ['¡Que tapen el bache!', '¡Que lo tapen!', '¡Bache no, asfalto sí!', '¡Somos vecinos, no pozos!'];
  ctx.spawnTask(async () => {
    for (let i = 0; ; i++) {
      await ctx.twait(3800 + Math.random() * 2500);
      const id = ids[i % ids.length];
      if (w.chars.has(id)) ctx.bark(id, chants[i % chants.length], { shout: true });
    }
  });
}

export const states: Record<string, StateFn> = {
  // ============================================================== ESCENA 1 · salida de casa
  async LEAVE_HOME(ctx) {
    setupHooks(ctx);
    ctx.clock.set(CONFIG.clock.start);
    ctx.clock.window('07:28', '07:33', 0.08);
    const w = await ctx.city({
      mode: 'walk',
      player: { at: 'home_door', facing: 'S' },
      car: { at: 'home_car' },
      companions: [{ id: 'kid', at: 'home_kid', follow: true }],
      bounds: [34.3, 74.6, 43.4, 79.3],
      boundsMsg: 'No hay tiempo para pasear.',
    });
    w.setStaticHidden('hat', true);
    if (ctx.is('municipal')) spawnNpc(ctx, w, 'tito', 'tito', { facing: 'E', wander: 0.3 });
    else spawnNpc(ctx, w, 'elba', 'elba', { facing: 'S' });
    ctx.music(null);
    await ctx.card('Río Gallegos · {time}', 'Sensación térmica: 6 bajo cero. Viento del oeste.', 2600);
    await ctx.say(`home_intro_${ctx.charId}`);
    // el viento se lleva el gorro del nene
    ctx.spawnTask(async () => {
      await ctx.twait(1500);
      ctx.sfx('gust');
      ctx.bark('kid', '¡Mi gorro!', { shout: true });
      w.setStaticHidden('hat', false);
      w.setInteract('hat', { label: 'Agarrar el gorro', icon: '🧢', radius: 1.2 }, 'hat_land');
    });
    ctx.onInteract(
      'hat',
      async () => {
        w.setStaticHidden('hat', true);
        w.setInteract('hat', null);
        ctx.sfx('whoosh');
        await ctx.say(`hat_pickup_${ctx.charId}`);
      },
      true,
    );
    w.enableCarInteract('Subir al auto');
    ctx.objective('Subí al auto con {kid}', 'car');
    ctx.hint(
      touch()
        ? '<span class="hand">👆</span> Arrastrá el dedo para caminar · Tocá ✋ para interactuar'
        : 'WASD / flechas para caminar · E para interactuar',
    );
    w.onPlayerMoved = () => ctx.hint(null);
    await ctx.waitInteract('car');
    ctx.hint(null);
    if (!ctx.flags.gorro) ctx.flags.gorro = false;
    await w.enterCar(['kid']);
    void think(ctx, { all: 'La puerta. Agarrala fuerte, que se la lleva el viento.' });
    ctx.clock.advance(1, true);
    return 'DRIVE_TO_SCHOOL';
  },

  // ============================================================== ESCENA 2 · primer trayecto
  async DRIVE_TO_SCHOOL(ctx) {
    setupHooks(ctx);
    ctx.clock.window(null, '07:39', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'home_car', parked: true }, passengers: ['kid'] });
    w.setDestination('school_car');
    ctx.objective('Llevá a {kid} a la escuela', 'school_car');
    driveHint(ctx);
    ctx.spawnTask(async () => {
      await ctx.twait(4000);
      ctx.bark('kid', ctx.is('municipal') ? '¿Puedo poner la radio?' : '¿Ponemos la radio? ¡Fuerte!');
      await ctx.twait(1800);
      ctx.bark('player', ctx.is('municipal') ? 'Después.' : 'Después, {kid}. Primero la escuela.', { name: false });
    });
    ctx.onZone('an11_view', () => think(ctx, { municipal: 'Acá Nomás, sucursal once. Hace un año era la verdulería de Marta.', emprendedor: 'Acá Nomás, sucursal once. Ahí compro los alfajores para el kiosco. Más caros que en el kiosco.' }));
    const which = await Promise.race([
      ctx.waitZone('accident_reveal').then(() => 'reveal'),
      ctx.waitZone('accident_seen_roca').then(() => 'roca'),
      w.waitArrival('school_car').then(() => 'arrived'),
    ]);
    if (which === 'reveal') return 'TRAFFIC_LIGHT_BLOCK';
    if (which === 'roca') {
      // el jugador tomó otro camino: se entera por la radio
      ctx.flags.accidente_por_radio = true;
      w.learnStreet('sanmartin', 49, 61);
      w.learnIntersection('roca/sanmartin');
      ctx.radio.program('drive1');
      ctx.radio.on();
      ctx.radio.flash('r_transito_sm');
      return 'DETOUR';
    }
    return 'SCHOOL_STRIKE';
  },

  // ============================================================== semáforo roto + accidente
  async TRAFFIC_LIGHT_BLOCK(ctx) {
    setupHooks(ctx);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'home_car', parked: true }, passengers: ['kid'] });
    if (!w.destination) w.setDestination('school_car');
    spawnNpc(ctx, w, 'agente', 'agent_sm', { facing: 'S' });
    ctx.sfx('car_alarm', 0.6);
    ctx.bark('agente', '¡Desvío! ¡Por Alcorta!', { shout: true });
    await ctx.wait(700);
    w.learnStreet('sanmartin', 49, 61);
    w.learnIntersection('roca/sanmartin');
    ctx.clock.advance(2);
    ctx.bark('kid', '¡Uh, un choque!');
    await think(ctx, { municipal: 'El semáforo de Roca. Otra vez.', emprendedor: 'El semáforo de Roca. Roto, como siempre.' });
    ctx.spawnTask(async () => {
      for (let i = 0; i < 3; i++) {
        await ctx.twait(4200);
        if (w.chars.has('agente')) ctx.bark('agente', i % 2 ? 'Circule, circule.' : '¡Por Alcorta, jefe!', { shout: true });
      }
    });
    await ctx.wait(1200);
    ctx.bark('kid', '¿Ahora sí la radio?');
    await ctx.wait(1500);
    ctx.bark('player', 'Ahora sí.', { name: false });
    ctx.radio.program('drive1');
    ctx.radio.on();
    ctx.radio.flash('r_transito_sm');
    return 'DETOUR';
  },

  // ============================================================== desvío (obra de Patagonia Puede)
  async DETOUR(ctx) {
    setupHooks(ctx);
    ctx.clock.window('07:40', '07:48', 0.1);
    const { world: w, resumed } = await ctx.cityContinue({ mode: 'drive', car: { at: 'home_car', parked: true }, passengers: ['kid'] });
    if (resumed) {
      w.learnStreet('sanmartin', 49, 61);
      w.learnIntersection('roca/sanmartin');
      ctx.radio.program('drive1');
      ctx.radio.on();
    }
    w.setDestination('school_car');
    ctx.objective('Llevá a {kid} a la escuela (por el desvío)', 'school_car');
    ctx.onZone('cd2_view', () =>
      think(ctx, {
        municipal: '¿Centro de Distribución 2? ¿Y el 1 dónde está?',
        emprendedor: 'Si algún día terminan eso, les vendo café a los obreros. Si me habilitan.',
      }),
    );
    ctx.onZone('an12_view', () =>
      think(ctx, {
        municipal: 'La ferretería de Don Luis. Ahí compré la pala para la nieve. Próximamente, Acá Nomás.',
        emprendedor: 'Otro local que se come Acá Nomás. Algún día me come a mí.',
      }),
    );
    ctx.onZone('an13_view', () => think(ctx, { all: 'Sucursal trece. Número de la suerte.' }));
    ctx.onZone('foto_view', () => think(ctx, { all: '¿Fotocontrol? Si ni el semáforo anda.' }));
    ctx.onEvent('player:horn', () => void think(ctx, { all: 'Como si tocar bocina sirviera de algo.' }), true);
    await w.waitArrival('school_car');
    ctx.radio.off();
    return 'SCHOOL_STRIKE';
  },

  // ============================================================== ESCENA 4 · paro sorpresa
  async SCHOOL_STRIKE(ctx) {
    setupHooks(ctx);
    ctx.clock.window('07:48', '07:52', 0.08);
    const w = await arriveOnFoot(ctx, 'school_car', 'school_gate_out', ['kid']);
    w.walkBounds = { rect: [48.6, 24.95, 58.6, 29.7], msg: 'Primero lo de la escuela.' };
    spawnNpc(ctx, w, 'portero', 'portero', { facing: 'S' });
    spawnNpc(ctx, w, 'mama_a', 'parent_1', { facing: 'E', wander: 0.4 });
    spawnNpc(ctx, w, 'papa_a', 'parent_2', { facing: 'W', wander: 0.4 });
    spawnNpc(ctx, w, 'mama_b', 'parent_3', { facing: 'N', wander: 0.3 });
    spawnNpc(ctx, w, 'abuelo_a', 'parent_4', { facing: 'W' });
    spawnNpc(ctx, w, 'nene_a', 'kid_1', { wander: 0.6 });
    spawnNpc(ctx, w, 'nena_a', 'kid_2', { wander: 0.6 });
    const barks: [string, string][] = [
      ['mama_b', '¿Y el comedor? ¿Hoy no hay comedor?'],
      ['abuelo_a', 'En mi época los paros se avisaban. Con una semana.'],
      ['papa_a', 'Ya mandé audio al grupo. Cuatro minutos de audio.'],
      ['nene_a', '¡No hay clases! ¡No hay clases!'],
      ['mama_a', 'Me voy a tener que llevar a la nena a la oficina.'],
    ];
    ctx.spawnTask(async () => {
      for (let i = 0; ; i++) {
        await ctx.twait(4200 + Math.random() * 2000);
        const [id, t] = barks[i % barks.length];
        if (w.chars.has(id)) ctx.bark(id, t);
      }
    });
    w.setInteract('paro_sign', { label: 'Leer el cartel', icon: '📄', radius: 1.4 });
    ctx.onInteract('paro_sign', async () => {
      await ctx.paper({
        title: 'COMUNICADO',
        handwritten: 'PARO 48 HS',
        lines: ['Se informa a la comunidad educativa la adhesión a la medida de fuerza. Sin actividad escolar.'],
        small: 'Publicado en el grupo de padres: **23:47 hs**.',
        button: 'Cerrar',
      });
    });
    ctx.objective('Llevá a {kid} hasta la puerta de la escuela', 'school_gate_out');
    await ctx.waitZone('school_gate');
    w.face('player', 'portero');
    await ctx.say(`school_strike_${ctx.charId}`);
    ctx.clock.advance(2);
    return 'CALL_SISTER';
  },

  // ============================================================== llamada a la hermana
  async CALL_SISTER(ctx) {
    setupHooks(ctx);
    ctx.clock.window('07:52', '07:56', 0.08);
    const { world: w, resumed } = await ctx.cityContinue({
      mode: 'walk',
      car: { at: 'school_car' },
      player: { at: 'call_spot' },
      companions: [{ id: 'kid', follow: true }],
    });
    if (resumed) spawnNpc(ctx, w, 'portero', 'portero', { facing: 'S' });
    ctx.objective('Llamá a {sister}');
    const tapped = ctx.waitEvent('phone:call');
    engine.ui.hud.phone(ctx.t('Llamar a {sister}'), () => engine.events.emit('phone:call'));
    if (engine.debug.autoplay) ctx.spawnTask(async () => {
      await ctx.twait(800);
      engine.events.emit('phone:call');
    });
    await tapped;
    engine.ui.hud.phone(null);
    await ctx.phoneCall('sister', `call_sister_${ctx.charId}`);
    ctx.clock.advance(3);
    void think(ctx, { municipal: 'Primero {sister}. Después, el resto del día.', emprendedor: 'Primero {sister}. Después la Muni. Después, el inspector.' });
    w.enableCarInteract('Subir al auto');
    ctx.objective('Volvé al auto con {kid}', 'car');
    await ctx.waitInteract('car');
    await w.enterCar(['kid']);
    return 'DRIVE_TO_SISTER';
  },

  // ============================================================== ESCENA 5 · hacia lo de la hermana
  async DRIVE_TO_SISTER(ctx) {
    setupHooks(ctx);
    ctx.clock.window('07:56', '08:06', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'school_car', parked: true, toward: 'sister_car' }, passengers: ['kid'] });
    w.setDestination('sister_car');
    ctx.objective('Dejá a {kid} en lo de {sister}', 'sister_car');
    ctx.radio.program('drive2');
    ctx.radio.on();
    spawnProtest(ctx, w);
    ctx.onEvent(
      'radio:r_paro',
      async () => {
        await ctx.twait(9000);
        ctx.bark('kid', '¿Mañana tampoco hay clases?');
        await ctx.twait(2200);
        ctx.bark('player', 'Parece que no.', { name: false });
        await ctx.twait(1800);
        if (ctx.is('municipal')) {
          ctx.bark('kid', '¿Y la prueba de fracciones?');
          await ctx.twait(2000);
          ctx.bark('player', 'También de paro.', { name: false });
        } else ctx.bark('kid', '¡¡Siiii!! ¡Dos días de kiosco!', { shout: true });
      },
      true,
    );
    if (ctx.is('municipal')) {
      ctx.spawnTask(async () => {
        await ctx.twaitUntil(() => ctx.clock.at('08:00'));
        await think(ctx, { all: 'Las ocho. Oficialmente llego tarde.' });
      });
    }
    if (!ctx.flags.gorro) {
      ctx.spawnTask(async () => {
        await ctx.twait(22000);
        ctx.bark('kid', 'Tengo frío en las orejas.');
        await ctx.twait(2000);
        ctx.bark('player', 'Te dije que agarraras el gorro.', { name: false });
      });
    }
    ctx.onZone('an15_view', () => think(ctx, { all: '¿Otra? La once, la doce, la trece, la catorce… ya perdí la cuenta.' }));
    ctx.onZone('radio_view', () => ctx.bark('kid', '¡La antena de la radio!'));
    ctx.onZone('costanera_view', () => think(ctx, { all: 'La costanera. Con este viento, ni los flamencos se quedan quietos.' }));
    await w.waitArrival('sister_car');
    ctx.radio.off();
    return 'DROP_CHILD';
  },

  async DROP_CHILD(ctx) {
    setupHooks(ctx);
    ctx.clock.window('08:06', '08:10', 0.08);
    const w = await arriveOnFoot(ctx, 'sister_car', 'sister_out', ['kid']);
    w.walkBounds = { rect: [82.5, 58.9, 90.5, 66.5], msg: 'Con este frío, mejor no demorarse.' };
    spawnNpc(ctx, w, 'sister', 'sister_door', { facing: 'S' });
    ctx.objective('Llevá a {kid} hasta la puerta de {sister}', 'sister_out');
    await ctx.waitZone('sister_door');
    w.face('player', 'sister');
    await ctx.say(`drop_child_${ctx.charId}`);
    w.follow('kid', null);
    await Promise.all([w.walkTo('kid', 'sister_door'), ctx.wait(400)]);
    w.char('kid').setVisible(false);
    ctx.sfx('door_close', 0.6);
    await ctx.wait(500);
    w.despawn('kid');
    await think(ctx, {
      municipal: 'A las doce. Si salgo a las doce del trabajo, es un milagro.',
      emprendedor: 'A las doce. Para esa hora tengo que tener la habilitación. O por lo menos no tener una multa.',
    });
    w.despawn('sister');
    ctx.sfx('door_close', 0.5);
    w.enableCarInteract('Subir al auto');
    ctx.objective('Volvé al auto', 'car');
    await ctx.waitInteract('car');
    await w.enterCar([]);
    return 'ROUTE_TO_OBJECTIVE';
  },

  // ============================================================== ESCENA 6 · trayecto con presión
  async ROUTE_TO_OBJECTIVE(ctx) {
    setupHooks(ctx);
    ctx.clock.window('08:10', '08:19', 0.1);
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'sister_car', parked: true } });
    const municipal = ctx.is('municipal');
    const dest = municipal ? 'an14_car' : 'muni_car';
    w.setDestination(dest);
    ctx.objective(
      municipal ? 'Pagá la boleta municipal en Acá Nomás (vence hoy)' : 'Llegá a la Municipalidad antes de las 8:30',
      dest,
    );
    ctx.radio.program('drive3');
    ctx.radio.on();
    spawnProtest(ctx, w);
    ctx.onZone('protest_reveal', async () => {
      w.learnStreet('errazuriz', 49, 61);
      ctx.radio.flash('r_bache');
      await think(ctx, {
        municipal: 'Cortan la calle del bache para que arreglen el bache. Y el bache sigue ahí.',
        emprendedor: 'Si esto dura, les llevo termo y facturas. Si me habilitan.',
      });
    });
    ctx.spawnTask(async () => {
      await ctx.twait(9000);
      if (municipal) {
        await ctx.notify('Ponce (jefe)', 'Barría, ¿venís? Hay gente esperando.');
        await think(ctx, { all: 'Voy. Pago la boleta y voy. Vence hoy.' });
      } else {
        await ctx.notify('Mamá', 'Nahuel, se terminaron los alfajores de maicena.');
        await think(ctx, { all: 'Prioridades, mamá.' });
        await ctx.twait(16000);
        await ctx.notify('Mamá', 'Pasó una camioneta blanca despacito. ¿Será el inspector?');
        await think(ctx, { all: 'En Río Gallegos todas las camionetas son blancas.' });
      }
    });
    ctx.onZone('foto_view', () => think(ctx, { all: 'Patagonia Puede Digital. Fotocontrol. Fotos sí sacan.' }));
    await w.waitArrival(dest);
    ctx.radio.off();
    return municipal ? 'MUNICIPAL_PAYMENT' : 'ENTREPRENEUR_PERMIT';
  },

  // ============================================================== ESCENA 7A · pago personal
  async MUNICIPAL_PAYMENT(ctx) {
    setupHooks(ctx);
    ctx.clock.window('08:19', '08:31', 0.08);
    const w = await arriveOnFoot(ctx, 'an14_car', 'an14_door', []);
    w.walkBounds = { rect: [64.5, 40.0, 73.5, 44.5], msg: 'La boleta vence hoy.' };
    ctx.objective('Entrá a Acá Nomás · Punto de Pago', 'an14_door');
    await ctx.waitZone('an14_door');
    ctx.sfx('door_open');
    await ctx.fadeOut(400);
    const room = await ctx.interior('an14', { player: { at: 'entry', facing: 'E' } });
    ctx.music('interior');
    spawnNpc(ctx, room, 'cajera', 'cashier', { facing: 'E' });
    spawnNpc(ctx, room, 'cliente_a', 'q1', { facing: 'N' });
    spawnNpc(ctx, room, 'cliente_b', 'q2', { facing: 'N' });
    ctx.objective('Hacé la fila para pagar', 'queue_end');
    await ctx.waitZone('queue_zone');
    room.control = false;
    await room.walkTo('player', 'queue_end');
    room.face('player', 'N');
    ctx.bark('cliente_a', 'Se cayó el sistema hace un rato.');
    await ctx.wait(2400);
    ctx.bark('cliente_b', 'Volvió.');
    await ctx.wait(2000);
    ctx.bark('cliente_a', 'Se volvió a caer.');
    await ctx.wait(2200);
    ctx.bark('cajera', '¡Volvió! ¡Siguiente!', { shout: true });
    ctx.sfx('register');
    await room.walkTo('cliente_a', 'out_path');
    room.despawn('cliente_a');
    await room.walkTo('cliente_b', 'q1');
    await room.walkTo('player', 'q2');
    ctx.clock.advance(3);
    await ctx.wait(1500);
    ctx.bark('cajera', '¡Siguiente!');
    await room.walkTo('cliente_b', 'out_path');
    room.despawn('cliente_b');
    room.control = true;
    room.setInteract('cajera', { label: 'Pagar la boleta', icon: '💳', radius: 1.9 });
    ctx.objective('Pagá la boleta en la caja', 'cajera');
    await ctx.waitInteract('cajera');
    room.setInteract('cajera', null);
    await ctx.say('payment_1');
    await ctx.paper({
      title: 'BOLETA DE SERVICIOS MUNICIPALES',
      small: `${CONFIG.bill.lastMonth} · Vencimiento: HOY`,
      rows: CONFIG.bill.rows,
      total: CONFIG.bill.total,
      button: '¿Cómo?',
    });
    await ctx.say('payment_2');
    ctx.clock.advance(3);
    ctx.objective('Andá a trabajar (ya vas tarde)', 'exit');
    await ctx.waitZone('exit');
    ctx.sfx('door_open');
    await ctx.fadeOut(400);
    ctx.music(null);
    return 'MUNICIPAL_DRIVE_TO_WORK';
  },

  async MUNICIPAL_DRIVE_TO_WORK(ctx) {
    setupHooks(ctx);
    ctx.clock.window('08:31', '08:37', 0.1);
    const w = await ctx.city({ mode: 'drive', car: { at: 'an14_car', parked: true } });
    w.setDestination('muni_car');
    ctx.objective('Llegá al trabajo', 'muni_car');
    ctx.radio.program('drive4');
    ctx.radio.on();
    ctx.spawnTask(async () => {
      await ctx.twait(6000);
      await ctx.notify('Ponce (jefe)', 'Barría. ¿Te pasó algo?');
      await think(ctx, { all: 'Me pasó la mañana.' });
    });
    await w.waitArrival('muni_car');
    ctx.radio.off();
    return 'MUNICIPAL_WORK';
  },

  // ============================================================== ESCENA 7A · del otro lado del mostrador
  async MUNICIPAL_WORK(ctx) {
    setupHooks(ctx);
    ctx.clock.window('08:37', '08:46', 0.06);
    const w = await arriveOnFoot(ctx, 'muni_car', 'muni_door', []);
    w.walkBounds = { rect: [33.5, 40.0, 42.5, 44.5], msg: 'Ya estás tarde, Diego.' };
    ctx.objective('Entrá a la Municipalidad', 'muni_door');
    await ctx.waitZone('muni_door');
    ctx.sfx('door_open');
    await ctx.fadeOut(400);
    const room = await ctx.interior('muni_hab', { player: { at: 'entry', facing: 'E' } });
    ctx.clock.settle();
    ctx.music('interior');
    spawnNpc(ctx, room, 'mirta', 'mirta_desk', { facing: 'E', pose: 'sit' });
    spawnNpc(ctx, room, 'ciudadano_a', 'seat_1', { pose: 'sit' });
    spawnNpc(ctx, room, 'ciudadano_b', 'seat_3', { pose: 'sit' });
    spawnNpc(ctx, room, 'nahuel', 'seat_4', { pose: 'sit' });
    spawnNpc(ctx, room, 'ciudadano_c', 'seat_6', { pose: 'sit' });
    spawnNpc(ctx, room, 'ponce', 'ponce_entry', { facing: 'W' });
    room.face('player', 'ponce');
    await ctx.say('muni_boss_m');
    ctx.spawnTask(async () => {
      await room.walkTo('ponce', 'ponce_office');
      room.despawn('ponce');
      ctx.sfx('door_close', 0.5);
    });
    ctx.objective('Pasá del otro lado del mostrador', 'counter_staff');
    await ctx.waitZone('desk_zone');
    room.control = false;
    await room.walkTo('player', 'counter_staff');
    room.face('player', 'S');
    room.control = true;
    room.setInteract('ventanilla_call', { label: 'Llamar al próximo', icon: '🔔', radius: 1.6 }, 'counter_staff');
    ctx.objective('Llamá al próximo número', 'ventanilla_call');
    await ctx.waitInteract('ventanilla_call');
    room.setInteract('ventanilla_call', null);
    ctx.sfx('ui_confirm');
    room.setStaticHidden('led_039', true);
    room.setStaticHidden('led_047', false);
    ctx.bark('mirta', '¡Cuarenta y siete!', { shout: true });
    room.char('nahuel').pose = 'normal';
    await room.walkTo('nahuel', 'counter_public');
    room.face('nahuel', 'N');
    room.control = false;
    await ctx.say('muni_attend_m_1');
    await ctx.documents({
      title: 'Carpeta: {kiosk}',
      subtitle: 'Tocá cada documento para verificarlo y sellarlo.',
      docs: CONFIG.documents,
      mode: 'review',
      stamp: 'VERIFICADO',
      doneLabel: 'Cargar en el sistema',
    });
    await ctx.say('muni_attend_m_2');
    ctx.clock.advance(2);
    await ctx.crt({
      title: 'SISTEMA DE HABILITACIONES v2.3',
      lines: [
        '⚠ NUEVO REQUISITO VIGENTE DESDE HOY 00:00 HS',
        '{ordinance}: Resistencia Eólica de Cartelería.',
        'Documento obligatorio: **{certificate}** ({certificateShort}).',
        'Emite: Dirección de {office} (2° piso).',
        'Requiere: pago previo de la {tasaEolica}.',
      ],
      button: 'Informar al vecino',
    });
    await ctx.say('muni_inform_m');
    room.control = true;
    return 'SATIRICAL_REVEAL';
  },

  // ============================================================== ESCENA 7B · el trámite del kiosco
  async ENTREPRENEUR_PERMIT(ctx) {
    setupHooks(ctx);
    ctx.clock.window('08:18', '08:41', 0.07);
    const w = await arriveOnFoot(ctx, 'muni_car', 'muni_door', []);
    w.walkBounds = { rect: [33.5, 40.0, 42.5, 44.5], msg: 'El inspector puede estar llegando al kiosco.' };
    ctx.objective('Entrá a la Municipalidad', 'muni_door');
    await ctx.waitZone('muni_door');
    ctx.sfx('door_open');
    await ctx.fadeOut(400);
    const room = await ctx.interior('muni_hab', { player: { at: 'entry', facing: 'E' } });
    ctx.music('interior');
    spawnNpc(ctx, room, 'mirta', 'mirta_desk', { facing: 'E', pose: 'sit' });
    spawnNpc(ctx, room, 'ciudadano_a', 'seat_1', { pose: 'sit' });
    spawnNpc(ctx, room, 'ciudadano_b', 'seat_3', { pose: 'sit' });
    spawnNpc(ctx, room, 'ciudadano_c', 'seat_6', { pose: 'sit' });
    if (!ctx.clock.at('08:30')) await think(ctx, { all: 'Llegué. Antes de las ocho y media. Antes que el inspector.' });
    room.face('player', 'mirta');
    await ctx.say('muni_mirta_e');
    // número
    room.setInteract('ticket', { label: 'Sacar número', icon: '🎟️', radius: 1.3 });
    ctx.objective('Sacá número', 'ticket');
    await ctx.waitInteract('ticket');
    room.setInteract('ticket', null);
    ctx.sfx('ticket');
    await ctx.paper({ title: 'SU TURNO', handwritten: 'N° 047', small: 'Atendiendo: 039 · Gracias por su paciencia.', button: 'Guardar el papelito' });
    ctx.flags.numero = 47;
    // espera
    room.setInteract('seat_wait', { label: 'Sentarse a esperar', icon: '🪑', radius: 1.3 }, 'seat_4');
    room.setInteract('poster_ord', { label: 'Leer el afiche', icon: '📄', radius: 1.8 }, 'poster');
    ctx.onInteract('poster_ord', async () => {
      await ctx.paper({
        title: 'NUEVA ORDENANZA 26/2026',
        lines: [
          '**Resistencia Eólica de Cartelería.** Todo cartel comercial deberá contar con el {certificate} ({certificateShort}), emitido por {office}.',
          'Vigente desde su publicación.',
        ],
        small: 'Municipalidad · Ciudad en Movimiento',
        button: 'Mmm…',
      });
      await ctx.say('muni_waiting_poster');
    });
    ctx.objective('Esperá tu turno', 'seat_wait');
    await ctx.waitInteract('seat_wait');
    room.setInteract('seat_wait', null);
    room.control = false;
    room.teleport('player', 'seat_4', 'S');
    room.char('player').pose = 'sit';
    ctx.objective('Esperá tu turno (N° 047)');
    const waitBarks: [string, string][] = [
      ['ciudadano_a', 'Yo vine por una firma. Hace tres semanas.'],
      ['ciudadano_b', 'No, amor, sigo en la Muni. No, no llegó nadie.'],
      ['ciudadano_c', '¿Ese cartel de la ordenanza estaba ayer?'],
      ['mirta', 'Paciencia, que el sistema está lento.'],
    ];
    ctx.clock.rate = 0.9;
    ctx.spawnTask(async () => {
      for (let i = 0; i < waitBarks.length; i++) {
        await ctx.twait(3300);
        ctx.bark(waitBarks[i][0], waitBarks[i][1]);
      }
    });
    await ctx.wait(2500);
    await ctx.notify('Mamá', 'Pasó otra camioneta blanca. Se fue.');
    await think(ctx, { all: 'Tranquilo. Tranquilo.' });
    await ctx.waitUntil(() => ctx.clock.at('08:30'));
    ctx.sfx('notify');
    await ctx.notify('Mamá', 'Son las ocho y media. No vino nadie todavía.');
    await think(ctx, { all: 'Todavía.' });
    await ctx.waitUntil(() => ctx.clock.at('08:37'));
    ctx.clock.rate = 0.06;
    // llega el funcionario (Diego), tarde por la misma mañana
    ctx.sfx('door_open');
    ctx.sfx('gust', 0.6);
    const diego = spawnNpc(ctx, room, 'diego', 'door_in', { facing: 'E' });
    diego.speed = 2.6;
    spawnNpc(ctx, room, 'ponce', 'ponce_office', { facing: 'S' });
    await room.walkTo('diego', 'waiting_spot');
    room.face('diego', 'player');
    room.char('player').pose = 'normal';
    await ctx.say('muni_diego_arrives_e');
    ctx.spawnTask(async () => {
      await room.walkTo('ponce', 'ponce_office');
      room.despawn('ponce');
    });
    await room.walkTo('diego', 'staff_gate');
    await room.walkTo('diego', 'counter_staff');
    room.face('diego', 'S');
    await ctx.wait(900);
    ctx.sfx('ui_confirm');
    room.setStaticHidden('led_039', true);
    room.setStaticHidden('led_047', false);
    ctx.bark('mirta', '¡Cuarenta y siete!', { shout: true });
    room.control = true;
    ctx.objective('Andá a la ventanilla', 'counter_public');
    await ctx.waitZone('counter_zone');
    room.control = false;
    await room.walkTo('player', 'counter_public');
    room.face('player', 'N');
    await ctx.say('muni_attend_e_1');
    await ctx.documents({
      title: 'Tu carpeta: {kiosk}',
      subtitle: 'Tocá cada documento para entregarlo.',
      docs: CONFIG.documents,
      mode: 'handover',
      stamp: 'VERIFICADO',
      doneLabel: '¿Y? ¿Está todo?',
    });
    await ctx.say('muni_attend_e_2');
    ctx.clock.advance(2);
    await ctx.crt({
      title: 'PANTALLA DE DIEGO · SISTEMA DE HABILITACIONES',
      lines: [
        '⚠ NUEVO REQUISITO VIGENTE DESDE HOY 00:00 HS',
        '{ordinance}: Resistencia Eólica de Cartelería.',
        'Documento obligatorio: **{certificate}** ({certificateShort}).',
        'Emite: Dirección de {office} (2° piso).',
      ],
      button: 'Esperar lo peor',
    });
    await ctx.say('muni_inform_e');
    room.control = true;
    return 'SATIRICAL_REVEAL';
  },

  // ============================================================== REMATE
  async SATIRICAL_REVEAL(ctx) {
    setupHooks(ctx);
    ctx.clock.window('08:44', '08:50', 0.04);
    let room = engine.current as InteriorScene | null;
    if (!room || room.scene.key !== 'interior') {
      // retomado desde guardado: armar la ventanilla
      room = await ctx.interior('muni_hab', { player: { at: ctx.is('municipal') ? 'counter_staff' : 'counter_public' } });
      ctx.music('interior');
      spawnNpc(ctx, room, 'mirta', 'mirta_desk', { facing: 'E', pose: 'sit' });
      room.setStaticHidden('led_039', true);
      room.setStaticHidden('led_047', false);
      if (ctx.is('municipal')) spawnNpc(ctx, room, 'nahuel', 'counter_public', { facing: 'N' });
      else spawnNpc(ctx, room, 'diego', 'counter_staff', { facing: 'S' });
    }
    room.control = false;
    if (!room.chars.has('ponce')) spawnNpc(ctx, room, 'ponce', 'ponce_office', { facing: 'S' });
    await ctx.say(`reveal_${ctx.charId}`);
    ctx.flags.remate_visto = true;
    ctx.music(null);
    await ctx.wait(1200);
    await ctx.fadeOut(1400);
    return null;
  },
};
