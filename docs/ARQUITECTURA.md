# Arquitectura — Río Gallegos: Viento en Contra (Demo 0.2)

Motor web propio sobre **Phaser 3 + TypeScript + Vite**. La regla de oro: **el motor no conoce el
contenido**. Todo lo que es historia, mapa, personajes, textos, marcas o música vive en
`src/content/`; `src/engine/` sólo ofrece sistemas genéricos y un contrato (`ChapterDef`).

```text
index.html ── #game (canvas) · #fx-overlay · #world-ui · #touch-layer · #hud · #fade · #panels
src/main.ts ── crea Phaser.Game y conecta motor + contenido (engine.init)
src/engine/   sistemas genéricos (este documento)
src/content/  capítulos, personajes, marcas, música (datos + guion)
assets/       arte/sonido final (reemplaza placeholders) + manifest.json
```

## 1. Núcleo (`engine/core`)

| Pieza | Qué hace |
|---|---|
| `Engine.ts` | Singleton con los servicios globales: eventos, scheduler, assets, guardado, dispositivo, reloj, radio, viento, audio, input y UI. Hace el escalado pixel-perfect y el tick global. |
| `Scheduler.ts` | Tiempo de juego pausable/acelerable. `CancelToken` para cancelar esperas cuando se sale o reinicia un capítulo. |
| `EventBus.ts` | Eventos por nombre (`interact:car`, `zone:enter:x`, `car:arrived:y`, `radio:r_paro`…). |
| `Device.ts` | Perfil del dispositivo (táctil, DPR) y presupuesto de rendimiento; baja a perfil liviano si el FPS cae. |
| `debug.ts` | Herramientas de QA (`window.__vec`). |

**Escalado pixel-perfect.** El canvas se dibuja en resolución de arte (~270 px en el lado corto en
vertical, ~300 en horizontal) y se amplía por CSS un número entero de píxeles físicos, sin suavizado.
Toda la interfaz es HTML encima del canvas: el texto queda nítido en cualquier pantalla.

## 2. Arte procedural y assets (`engine/assets`)

- `PixelCanvas` (píxeles ABGR en `Uint32Array`) y `Face` (una pared isométrica: columnas `u` × alto `z`).
- `gen/*`: generadores de placeholders originales — personajes (14 cuadros), vehículos (8 direcciones
  × normal/frenando), edificios, props, logos de marcas ficticias y efectos.
- `BitmapFont`: fuente 5×7 propia con tildes. Sobre paredes, **cada letra queda derecha y el renglón
  escalona siguiendo la pendiente** (así se lee como un cartel real visto en diagonal). Las vallas y
  carteles grandes se dibujan **de frente a la cámara**; las marcas tienen además un cartel de techo.
- `AtlasBuilder` + `AssetRegistry`: empaqueta todo en pocas páginas de atlas de 1024². `ensure(key, gen)`
  devuelve el arte final si `assets/manifest.json` lo declara `final`, o genera el placeholder.
  Reemplazar un placeholder = dejar el PNG en `assets/` y cambiar el manifiesto (ver `assets/ASSET_MANIFEST.md`).

## 3. Mundo (`engine/world`)

- **Mapa declarativo (equivalente a Tiled).** `CityPlan` describe calles (carriles, cantero, dársenas),
  lotes con edificios, cercos, props, marcadores, zonas, semáforos, cortes y relleno automático de manzanas.
  `CityBuilder` lo rasteriza a una grilla isométrica determinista (misma semilla = misma ciudad).
- **Suelo por chunks** de 16×16 baldosas pintados en un Web Worker (`ground.worker.ts`), con respaldo en
  el hilo principal. `Streaming` crea/destruye chunks y estáticos según la cámara (carga por zonas).
- **Profundidad exacta.** Edificios y props con huella se cortan en tiras verticales de 8 px; cada tira usa
  la profundidad del borde frontal de la huella en esa columna. Personajes y autos quedan delante o detrás
  de cada pared sin reglas especiales.
- `IsoScene`: base común de ciudad e interiores (personajes, caminata con colisión, tocar para moverse,
  interacción contextual, zonas, cámara, globos, **lectura ampliada de carteles** y API para los guiones).
- `WorldScene`: ciudad, auto del jugador, GPS, tránsito, peatones, clima y viento visible.
- `RoadNetwork`: red dirigida (carriles rectos + curvas Bézier en cada cruce), semáforos, cortes conocidos
  o no por el GPS, Dijkstra con penalización de giros, lugares de estacionamiento a ambos lados.

### Lectura ampliada de carteles

Los carteles importantes declaran un `caption` (en props, carteles de edificio o de interiores).
Cuando el jugador (o el auto) pasa cerca, aparece encima el texto en HTML nítido, con los colores del
cartel (máximo dos a la vez). En modo **AUTO** sólo se activa si el pixel art se ve chico (teléfonos);
se puede forzar SÍ/NO en Pausa → *Carteles ampliados*.

## 4. Autos y manejo (`engine/vehicles`)

- El auto del jugador **sigue su carril solo**; el jugador acelera y frena (▲ ▼ / ↑ ↓, o arrastrando).
- **Doblar = elegir la salida de la próxima esquina antes de llegar**: ◀ ▶ (o ← →) eligen la calle que
  sale hacia la izquierda o la derecha *de la pantalla*; también se puede tocar la flecha de la calle.
  La elección se ve en la flecha amarilla, en el botón encendido y en el guiño del auto; al llegar, dobla solo.
  Apretar de nuevo el mismo lado lo cancela.
- **Giro tardío:** si se pide recién entrado al cruce, el auto todavía dobla (con transición suave).
- Antes de una esquina donde va a doblar, el auto aminora; la cámara mira un poco hacia el cruce.
- **GPS:** indica la próxima maniobra con el botón a tocar; si el jugador se pasa dos giros, se ofrece la
  **conducción asistida** (el auto dobla solo siguiendo al GPS; se cambia en Pausa).
- Frenar sostenido con el auto quieto = vuelta en U. Al llegar al destino estaciona solo.
- Tránsito ambiental con seguimiento, semáforos, cesión de paso; el jugador nunca choca (frena solo).

## 5. Capítulo como máquina de estados (`engine/mission`)

- `ChapterDef` (contrato motor ↔ contenido): mapa, interiores, NPCs, diálogos, radio, estados, música,
  vocabulario, final y créditos. Se registra en `src/content/index.ts` y se carga con import dinámico.
- `ChapterRunner`: ejecuta estados explícitos. Cada estado es `async (ctx) => 'SIGUIENTE' | null`,
  **prepara su escena desde cero** (por eso "Continuar" retoma en cualquiera) y al entrar se guarda un
  checkpoint (personaje, estado, flags, hora).
- `ChapterContext` (`ctx`): API de guion — escenas (`city`, `cityContinue`, `interior`), diálogo
  (`say`, `choose`, `thought`, `bark`, `phoneCall`), UI (`objective`, `hint`, `toast`, `card`, `notify`,
  `paper`, `documents`, `crt`, `fadeOut/In`), reloj (`clock.window`, `clock.advance`), radio
  (`radio.program/on/off/flash`), esperas (`waitInteract`, `waitZone`, `waitEvent`, `wait`, `waitUntil`),
  reacciones (`onInteract`, `onZone`, `onEvent`) y tareas paralelas (`spawnTask` + `twait`), que se
  cancelan solas al terminar el estado o al salir del capítulo.
- `Flow.ts`: toque inicial (desbloquea audio) → título con la **lista de capítulos** (`chapterInfo`) y la ciudad
  de fondo → selección de personaje (con tarjetas y pregunta propias de cada capítulo) → capítulo → pantalla final
  con la frase del personaje y tres salidas: **"Seguir: Capítulo N+1"** (`nextChapterId`), jugar la otra versión del
  mismo capítulo o volver al título. Cada capítulo cargado es un chunk aparte.
- **Consecuencias entre capítulos:** `ChapterDef.carry` lista los flags que se guardan por personaje al terminar
  (`save.data.global['<personaje>.<flag>']`); el `ChapterRunner` del capítulo siguiente los siembra como `prev_<flag>`.
- **Pausa:** Esc (o el botón II) y pausa automática al ocultar la pestaña (salvo con `?debug`, `?autoplay` o `?timer`).
  Mientras está pausado no corre nada del guion: `Flow` detiene el planificador (esperas y tareas), los globos y la escena.
- **Piezas de guion reutilizables** en `content/shared/flowKit.ts` (llegar a pie desde el auto, NPCs con marcador,
  esperar el toque en el teléfono, ganchos comunes): los capítulos comparten ese código, no el motor.

Estados del Capítulo 1 (`?state=NOMBRE`): `LEAVE_HOME`, `DRIVE_TO_SCHOOL`, `TRAFFIC_LIGHT_BLOCK`,
`DETOUR`, `SCHOOL_STRIKE`, `CALL_SISTER`, `DRIVE_TO_SISTER`, `DROP_CHILD`, `ROUTE_TO_OBJECTIVE`,
`MUNICIPAL_PAYMENT`, `MUNICIPAL_DRIVE_TO_WORK`, `MUNICIPAL_WORK`, `ENTREPRENEUR_PERMIT`, `SATIRICAL_REVEAL`.

Estados del Capítulo 2: `ARRANQUE` · Diego: `D_BRIEFING`, `D_A_LA_FERIA`, `D_FERIA`, `D_A_LA_OBRA`, `D_OBRA`,
`D_A_ACA_NOMAS`, `D_ACA_NOMAS`, `D_AL_KIOSCO` · Nahuel: `N_AMANECER`, `N_A_LA_FERIA`, `N_ENSAYO`, `N_A_LA_MUNI`,
`N_TESORERIA`, `N_OBRAS`, `N_AL_KIOSCO` · los dos: `FINAL_KIOSCO`.

### Minijuego "aguantar el cartel"

`core/Brace.ts` es un modelo puro (sin DOM ni Phaser, con tests): una lista de ráfagas con aviso previo (calma → aviso →
ráfaga). Hay que apretar "agarrar" cuando pega y soltar al pasar: sin agarre el cartel resbala y, si llega al máximo, se
vuela (ráfaga perdida); agarrar cansa, así que apretar de más deja sin fuerza justo cuando pega fuerte. No hay castigo duro:
el capítulo siempre avanza. `ui/Brace.ts` lo dibuja (barras de resbalón y de fuerza, "¡RÁFAGA! ¡AGARRÁ!", botón grande) y lee
el mantener apretado de puntero, espacio, E, enter o ↑; en `?autoplay` aprieta solo. El guion llama `await ctx.brace({...})`
y decide qué comentario hace cada resultado (`held`, `slips`, `total`).

## 6. Diálogos, radio y reloj

- `dialogue/Dialogue.ts`: diálogos como datos (líneas, pensamientos, opciones con tono, flags,
  condiciones `flag`, `!flag`, `flag=valor`, `char=municipal`, `only: 'emprendedor'`, hooks y esperas).
  Las opciones cambian líneas posteriores, nunca la misión. Plantillas `{kid}`, `{sister}`, `{time}`…
- `radio/RadioStation.ts`: programas de Radio 89 (titulares, publicidades, música). La radio informa y el
  personaje reacciona con un pensamiento propio de cada protagonista.
- `timer/GameClock.ts`: reloj narrativo **tolerante**: cada estado define una ventana `[mín, máx, ritmo]`; el
  reloj avanza con el juego (nunca pasa de `máx`) y **al cerrar el estado salta a `mín`**, así el capítulo queda
  ordenado sin importar cuánto tarde el jugador. El significado cambia por personaje y por capítulo
  (`ChapterDef.clock`; Capítulo 1: entrada 08:00 / inspección ~08:30; Capítulo 2: asamblea 10:00 / inspección 11:00),
  y puede cambiar a mitad del capítulo con `ctx.clockMeaning(...)`.
- `world/Wind.ts`: viento visible y audible con ráfagas; cada capítulo fija su base (`windBase`), el guion puede pedir
  ráfagas (`ctx.gust`), forzar el nivel (minijuego) o encarecer el caminar cargando algo grande (`ctx.carry`).

## 7. UI, input, audio, guardado

- `ui/`: HUD (reloj, objetivo, radio, maniobra del GPS, semáforo, flecha al destino), diálogos con
  retrato, globos, teléfono y notificaciones, documentos/sellos, pantalla CRT, menús, rótulos de carteles
  y controles de manejo. Capas: el fundido negro tapa mundo y HUD, pero **nunca** los paneles
  (así "Continuará", menús y avisos siempre se ven).
- `input/InputManager.ts`: joystick flotante (arrastrar en cualquier parte), toques, teclado y botones de
  manejo. En modo manejo las flechas pasan a ser pedal (↑↓) y elección de calle (←→).
- `audio/AudioEngine.ts`: todo sintetizado en tiempo real (viento con ráfagas, motor, radio con filtro,
  SFX, música chiptune secuenciada). Sin archivos que descargar.
- `save/SaveSystem.ts`: `localStorage` versionado y tolerante a fallos (si el navegador bloquea el
  almacenamiento, el juego sigue sin guardar). Guarda el checkpoint de la partida, los capítulos completados por
  personaje, las consecuencias (`global`) y las opciones. `?nosave` para QA (lee, no escribe).
- **Render:** Phaser en modo AUTO (WebGL). Si WebGL falla al crear el contexto o se pierde, `main.ts` recuerda la
  falla en `sessionStorage` y recarga una vez con el render **Canvas 2D** (`?renderer=canvas` lo fuerza).

## 8. Pruebas

`npm test` (Vitest, sin navegador): reloj, diálogos, ciudad y rutas del Capítulo 1, manejo, modelo del minijuego y
`tests/chapter02.test.ts`, que valida el Capítulo 2 leyendo su guion como texto (el motor necesita `window`): que todo
marcador, zona, NPC, diálogo, programa de radio, pista y color exista; que cada tramo en auto tenga ruta; que el reloj no
retroceda; que los carteles de las paredes se lean enteros y no se pisen; que cada tramo de manejo arranque sin vuelta en
U forzada; que los diálogos se recorran con todas las opciones; que los flags de las condiciones estén definidos y que
el texto no nombre personas ni partidos reales. Para la parte jugable: `?debug&autoplay&nosave&timer&speed=3` recorre un
capítulo entero con cualquier personaje.

## 9. Rendimiento

- Render en baja resolución + escalado entero (barato en teléfonos).
- Carga por zonas (chunks), culling por cámara, atlas dinámicos con subida a GPU sólo si cambian.
- Suelo en un Worker; audio sin assets; capítulos en chunks JS separados.
- Presupuestos por perfil (`Device.ts`): cantidad de autos, peatones, partículas y margen de carga.
