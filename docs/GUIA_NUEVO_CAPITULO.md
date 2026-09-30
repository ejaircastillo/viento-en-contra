# Cómo crear un capítulo nuevo sin modificar el motor

Un capítulo es **un objeto de datos + un guion** (`ChapterDef`). El motor (`src/engine/`) no se toca:
mapa, interiores, personajes, diálogos, radio, música, marcas y estados se escriben en `src/content/`.

- **Ejemplo completo:** el Capítulo 2 (`src/content/chapter02/`, "Horario de atención"): ciudad variada,
  interiores nuevos, minijuego, llamadas con menú, decisiones que vienen del Capítulo 1 y dos rutas que se cruzan.
- **Plantilla mínima:** `src/content/chapter03_plantilla/` (dos estados, reutiliza el mapa del Capítulo 2).
  Se abre con `?chapter=ch03_plantilla`; no figura en la lista del título.
- **Utilidades de guion compartidas:** `src/content/shared/flowKit.ts` (bajar del auto y llegar a pie,
  aparecer NPC, esperar el toque en el teléfono, pistas de manejo, ganchos comunes).

## 1. Crear la carpeta y registrarla

```text
src/content/chapter03/
  index.ts       ChapterDef (junta todo)
  flow.ts        estados (guion)
  dialogues.ts   diálogos como datos (finals.ts si querés separar la escena final)
  radio.ts       Radio 89 del día
  npcs.ts        NPCs nuevos o variantes
  interiors.ts   habitaciones nuevas (opcional)
  props.ts       props propios generados por código (opcional)
  city.ts        mapa (o reutilizar/variar uno existente)
  config.ts      nombres, horarios y textos propuestos (un solo lugar para revisar)
```

En `src/content/index.ts` se suma el capítulo a **dos** listas: `chapters` (carga bajo demanda, cada capítulo
es un chunk aparte) y `chapterInfo` (lo que muestra el título; el orden de la lista es el orden de juego):

```ts
chapters: {
  ch01: () => import('./chapter01').then((m) => m.default),
  ch02: () => import('./chapter02').then((m) => m.default),
  ch03: () => import('./chapter03').then((m) => m.default),
},
chapterInfo: [
  { id: 'ch01', number: 1, title: 'Viento en contra', subtitle: 'Miércoles: …' },
  { id: 'ch02', number: 2, title: 'Horario de atención', subtitle: 'Jueves: …' },
  { id: 'ch03', number: 3, title: '…', subtitle: '…' },
],
demoLabel: 'Demo 0.3 · Capítulos 1 a 3',
```

Al terminar un capítulo, la pantalla final ofrece **"Seguir: Capítulo N+1"** (`nextChapterId`), jugar la otra
versión del mismo capítulo, o volver al título. No hace falta tocar `Flow.ts` ni `Menus.ts`.

## 2. `index.ts`: el contrato

```ts
import type { ChapterDef } from '../../engine/mission/types';
const chapter: ChapterDef = {
  id: 'ch03',
  number: 3,
  title: 'Capítulo 3 · …',
  characters: ['municipal', 'emprendedor'],   // ids de src/content/characters.ts
  initialState: 'ARRANQUE',
  stateOrder,                                 // lista de estados (documentación y ?state=)
  states,                                     // de flow.ts
  city: cityPlan,                             // plano (función por personaje o fijo)
  interiors, dialogues, radio, npcs,
  traffic, pedestrians,                       // se pueden reutilizar los del cap. 1
  tracks,                                     // música (src/content/music.ts)
  vocab: CONFIG.vocab,                        // {clave} para textos
  ending: CONFIG.ending,                      // frase final por personaje
  credits: CONFIG.credits,
  setup: () => { registerBrands(); registerInteriorProps(); /* + props propios */ },

  // ---- opcionales (el Capítulo 2 usa todos)
  clock: { municipal: MEANING_A, emprendedor: MEANING_B },   // qué significa el reloj en este capítulo
  cards: { municipal: { role, blurb, timer }, emprendedor: { … } }, // tarjetas del selector de personaje
  selectPrompt: '¿CON QUIÉN VIVÍS EL JUEVES?',
  carry: ['d_final', 'n_final', 'actas'],     // decisiones que recuerda el capítulo siguiente (§7)
  windBase: 0.58,                             // intensidad base del viento (0..1)
};
export default chapter;
```

## 3. El mapa

- **Reutilizar la ciudad**: `city: cityPlan` de un capítulo anterior (ya incluye casa, escuela, Municipalidad,
  sucursales de Acá Nomás, obra de Patagonia Puede, Radio 89…).
- **Variarla** (así lo hace el Capítulo 2 en `chapter02/city.ts`): tomar el plano base y devolver una copia con
  cambios de datos — sacar lo que "ya pasó" (`props` filtrados: choque, desvío, carteles de la protesta), sumar
  props nuevos (feria, escenario, estación de ensayos, cartel de inauguración), reemplazar un lote (`lots`),
  cambiar `blocks` (cortes de calle), `blockedInters` (cruces cerrados), `markers` (puntos con nombre para el
  guion) y `zones` (rectángulos que disparan eventos al entrar).
- Un **destino para el auto** es un marcador cuyo nombre termina en `_car` (se reserva lugar para estacionar).
- Carteles legibles: los edificios pueden tener `signs` (texto sobre la fachada) y `roofSign` (cartel de
  techo de frente); los props usan `caption` para la **lectura ampliada**. Un tablero dibujado a mano
  (`frontBoard` en `chapter02/props.ts`) tiene que **caber dentro de su lienzo**: si el texto es más ancho
  que el sprite se recorta.
- Orden de dibujo: un prop puntual se ordena por `x + y`; si tapa o queda tapado por un edificio, correrlo
  hacia adelante (más `x`/`y`) o alejarlo del frente del edificio.

## 4. Estados (el guion)

Cada estado es una función `async (ctx) => siguiente | null` que **arma su escena desde cero**
(así se puede retomar un guardado en cualquier estado):

```ts
export const states: Record<string, StateFn> = {
  async ARRANQUE(ctx) {
    ctx.clock.set('08:05');
    ctx.clock.window('08:18', '08:24', 0.08);         // [mín, máx, ritmo]: ver "El reloj" abajo
    const w = await ctx.city({ mode: 'walk', player: { at: 'home_door' }, car: { at: 'home_car' } });
    await ctx.say(`intro_${ctx.charId}`);             // diálogo distinto para cada protagonista
    w.enableCarInteract('Subir al auto');
    ctx.objective('Subí al auto', 'car');
    await ctx.waitInteract('car');
    await w.enterCar(['kid']);
    return 'A_LA_FERIA';
  },
  async A_LA_FERIA(ctx) {
    const { world: w } = await ctx.cityContinue({ mode: 'drive', car: { at: 'home_car', parked: true } });
    w.setDestination('feria_car');                    // GPS + flechas de esquina + estacionamiento
    ctx.radio.program('n1'); ctx.radio.on();
    await w.waitArrival('feria_car');
    return null;                                      // null = fin del capítulo → "Continuará"
  },
};
```

**El reloj.** `ctx.clock.window(mín, máx, ritmo)`: durante el estado la hora avanza despacio (`ritmo` = minutos de
juego por segundo) sin pasar de `máx`; **al terminar el estado salta a `mín`**. Así cada estado deja una hora
conocida y el capítulo cierra cerca de lo previsto sin importar cuánto tarde el jugador. Las horas tienen que
crecer a lo largo de cada ruta (`tests/chapter02.test.ts` lo verifica). `ctx.clockMeaning(...)` cambia lo que
representa el reloj a mitad del capítulo (ej. "Asamblea 10:00" pasa a "Kiosco 11:00").

**Escenas de manejo:** `ctx.cityContinue({ mode: 'drive', car: { at: 'muni_car', parked: true, toward: 'feria_car' } })`.
`toward` es el marcador del primer destino: el auto se estaciona del lado de la calle que ya mira hacia allá (sin él,
del lado más cercano al marcador, que a veces obliga a arrancar con una vuelta en U; en el Capítulo 2 eran 3 de 7 tramos).
`tests/chapter02.test.ts` exige `toward` en cada escena de manejo.

Para escenas que viven en la calle, `chapter02/flow.ts` usa las utilidades de `shared/flowKit.ts`:
`arriveOnFoot(ctx, 'feria_car', punto, pasajeros, { carLook })` (estaciona, baja a todos y deja el mundo listo),
`spawnNpc(ctx, escena, 'id', 'marcador', { facing, wander, pose })`, `waitPhoneTap(ctx, 'Llamar a Ponce')`,
`driveHint(ctx)` (la pista de manejo, una sola vez por navegador).

API de `ctx` más usada (ver `src/engine/mission/ChapterContext.ts`):

| Grupo | Métodos |
|---|---|
| Escenas | `city(setup)`, `cityContinue(setup)`, `interior(id, setup)`, `fadeOut()`, `fadeIn()` |
| Diálogo | `say(id \| nodos)`, `choose(opciones)`, `line(quién, texto)`, `thought(texto)`, `bark(quién, texto)`, `phoneCall(contacto, diálogo)`, `phoneSession(contacto, async () => …, nombre?)` (llamada con menú propio: contestador, atención automática) |
| Interfaz | `objective(texto \| null, objetivo)`, `hint(html)`, `toast(texto)`, `card(grande, chico)`, `notify(de, texto)`, `paper({...})`, `documents({...})`, `crt({...})` |
| Minijuego | `brace({ title, subtitle, gusts })` — aguantar el cartel contra ráfagas manteniendo apretado (devuelve ráfagas aguantadas y perdidas) |
| Viento | `gust(pico, segundos)` (ráfaga guionada), `carry(mult)` (cargar algo grande cuesta más al caminar), `reskinPlayer(look \| null)` (ej. con el cartel en las manos) |
| Reloj | `clock.set`, `clock.window`, `clock.advance`, `clockMeaning` |
| Radio | `radio.program(id)`, `radio.on()`, `radio.off()`, `radio.flash(item)` |
| Esperas | `waitInteract(id)`, `waitZone(id)`, `waitEvent(nombre)`, `wait(ms)`, `waitUntil(fn)` |
| Reacciones | `onInteract(id, fn)`, `onZone(id, fn)`, `onEvent(nombre, fn)` |
| Paralelo | `spawnTask(async () => { await ctx.twait(3000); … })` — se cancela sola al cambiar de estado |
| Personaje | `ctx.charId`, `ctx.is('municipal')`, `ctx.flags` (se guardan), `ctx.carried('flag')` / flags `prev_*` (§7), `ctx.t('{kid}')` |

En la ciudad (`w`): `setDestination`, `waitArrival`, `enterCar`, `exitCar`, `enableCarInteract`,
`spawn`, `walkTo`, `follow`, `face`, `setInteract`, `setStaticHidden`, `setStaticFrame`, `learnStreet`,
`learnIntersection`. En un interior (`room`): `walkTo`, `face`, `char(id)` (para cambiar `pose`).

## 5. Diálogos (datos)

```ts
intro_emprendedor: [
  { who: 'kid', text: '¿Hoy tampoco hay clases?' },
  { who: 'player', text: 'Tampoco, {kid}.' },
  { choice: [
    { tone: 'resignado', text: 'Otro día igual.', set: { tono: 'res' } },
    { tone: 'irónico', text: 'Por lo menos el viento es puntual.', set: { tono: 'iro' } },
  ] },
  { who: 'elba', text: 'Andá, que yo atiendo.', if: 'tono=res' },
  { think: true, text: 'Hoy toca {office}. Segundo piso.' },
  { do: 'cut_ribbon' },                       // gancho: el guion lo define con ctx.hooks.set('cut_ribbon', …)
],
```

Condiciones: `flag`, `!flag`, `flag=valor`, `char=municipal`, combinables con `&`; `only: 'municipal'`
para una línea de un solo personaje. **Consejo de escritura:** si una escena la viven los dos
protagonistas, escribir una versión por personaje (`escena_municipal` / `escena_emprendedor`) para que
cada uno hable con su voz y su familia (Caro y Tomi para Diego; Vero, Benja y Elba para Nahuel).
Las hermanas no dicen "amor" a sus hermanos: es una regla que los tests vigilan.

## 6. NPCs, interiores, marcas y props

- **NPCs** (`npcs.ts`): `{ id, name, look, voice }`. Variante por personaje con la clave `id@personaje`
  (ej. `'vero@municipal'`). El `look` combina piezas del generador (piel, pelo, ropa, accesorios).
  Nombres de pila y cargos **inventados**: nada de personas reales (ver `docs/DECISIONES.md`).
- **Interiores** (`interiors.ts`): tamaño, piso, color de paredes, `items` en las paredes (ventanas,
  puertas, carteles con `caption`), `props`, `markers` y `zones`.
  **Carteles de pared** (`poster`, `sign`, `board`): el texto tiene que entrar en el cartel. Cada letra mide 5 px (6 con
  espacio) y cada renglón ocupa 9 px de alto: una palabra de 9 letras necesita ~3 baldosas de ancho (`w`), y dos renglones
  piden `h` ≥ 18. Una palabra que no entra se **recorta** ("AUDIEN…"); si no hay lugar, abreviar el texto visible ("ASAM.")
  y dejar el texto completo en `caption` (lectura ampliada). El rótulo de una puerta es más ancho que la puerta y tapa lo que
  quede al lado a esa altura. `tests/chapter02.test.ts` verifica que ningún texto se recorte, que entre en el alto y que
  los carteles de una pared no se pisen.
- **Marcas y props nuevos**: `registerLogo(id, fn)` y `registerProp(tipo, generador)` dentro de `setup()`.
  Siempre marcas **ficticias** dibujadas por código (ver `chapter02/props.ts`: puesto de feria, escenario,
  estación de ensayos, túnel de viento, ascensor, escalera).

## 7. Continuidad entre capítulos (consecuencias)

Un capítulo declara `carry: ['tono_final', …]`: al terminarlo se guardan esos flags **por personaje**
(`save.data.global['municipal.tono_final']`). El capítulo siguiente los recibe como flags `prev_<nombre>` desde el
primer estado, sin escribir código:

```ts
{ who: 'ponce', text: 'Ayer se quedó callado con el del kiosco. Así me gusta.', if: 'prev_tono_final=callado' },
```

El Capítulo 1 deja `tono_final`, `respuesta_mama`, `gorro`, `tono_informar`, `tono_escuela`, `tono_hermana`;
el Capítulo 2 los recuerda y deja los suyos (`d_final`, `n_final`, `actas`, `d_aviso`, `n_llamada`, `n_ensayo`)
para el Capítulo 3. Las decisiones cambian **líneas y detalles**, nunca la misión.

## 8. Arte y sonido finales

Cada placeholder tiene una clave (`__vec.keys()` con `?debug`). Para reemplazarlo: exportar la plantilla
(`__vec.png('clave')`), dibujar respetando cuadros y ancla, guardar en `assets/…` y declarar la clave como
`final` en `assets/manifest.json` (`npm run manifest` regenera `assets/ASSET_MANIFEST.md`).
El código no cambia. La música nueva se agrega en `src/content/music.ts` (pistas chiptune por datos).

## 9. Probar

| URL | Para qué |
|---|---|
| `?chapter=ch02&char=municipal&state=ARRANQUE` | Arrancar un capítulo con un personaje, sin pasar por el título |
| `?chapter=ch02&char=emprendedor&state=N_OBRAS` | Saltar a un estado (sin `debug` pide un toque para empezar) |
| `?debug&autoplay&nosave&speed=3&timer&chapter=ch02&char=emprendedor` | Recorrido automático completo (QA); al terminar encadena solo |
| `?renderer=canvas` | Forzar el respaldo Canvas 2D (si WebGL falla, el juego lo activa solo) |
| `?nosave` | No leer ni escribir el guardado (no pisa la partida de nadie) |

Con `?debug`, `window.__vec` ofrece `engine`, `keys()`, `png()`, `clock('08:25')`, `speed(x)` y `autopilot()`.

**Pruebas automáticas** (`npm test`): `tests/chapter02.test.ts` es el modelo. Verifica que todo marcador, zona,
NPC, diálogo, programa de radio y color que nombra el guion exista; que cada tramo en auto tenga ruta; que el reloj
no retroceda en ninguna ruta; que los diálogos se recorran con todas las opciones sin `{claves}` sueltas ni
hablantes desconocidos; que los flags de las condiciones estén definidos; y que la sátira no nombre personas ni
partidos reales. Un capítulo nuevo se cubre copiando ese archivo y cambiando los ids.

**Checklist antes de publicar:** `npm run typecheck`, `npm test`, `npm run build`, recorrido automático con los
dos personajes, revisión visual de cada escena nueva (también en celular, 375×812) y lectura de todos los textos
nuevos (ver `docs/DECISIONES.md`, temas sensibles).
