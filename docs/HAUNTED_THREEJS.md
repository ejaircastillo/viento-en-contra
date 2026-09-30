# Prototipo 3D «Fantasma en trámite» (three.js)

Página aparte del proyecto (`haunted.html`, código en `src/haunted/`) que prueba otro lenguaje visual: un **diorama 3D**
hecho con three.js, inspirado en la escena de Halloween de @iced_coffee_dev (cementerio de otoño + cripta, personajes
low-poly con contorno naranja cuando se pueden tocar, luces cálidas, bloom y un vacío negro alrededor del terreno). Se
siguió el desglose técnico que el propio autor publicó en un hilo (ver «Desglose de la referencia»).
No se copió ningún asset: geometría, texturas y sonido se generan por código. Es independiente del juego 2D (no
usa Phaser); sólo reaprovecha el motor de diálogos de datos (`src/engine/dialogue/Dialogue.ts`).

## Qué se imitó y cómo

| Rasgo de la referencia | Cómo se logra |
|---|---|
| Terreno flotando en el vacío, cámara en diagonal | `CameraRig`: perspectiva de 27°, picada de 50°, giro de 45°; bordes del mapa visibles; fondo `#03040a` + `FogExp2` |
| Personajes low-poly y flat-shaded | Geometría propia con color por vértice y normales por cara (`gfx/geom.ts`); los personajes no llevan texturas |
| Contorno naranja + etiqueta con nombre al acercarse | `OutlinePass` (antes del bloom, así el borde también brilla) + etiqueta HTML proyectada desde el objeto |
| Fogata, faroles, velas y antorchas como únicas luces | Pool fijo de `PointLight` reasignadas cada cuadro a los emisores más cercanos + manchas de luz horneadas + halos |
| Humo, brasas, hojas cayendo | `Particles`: billboards instanciados, ordenados por profundidad |
| Hierba seca, helechos, hojas en el piso | `InstancedMesh` con viento en el vertex shader; el pasto se aplasta alrededor del fantasma |
| Paneles ornamentales (lápidas, diálogos) | `ui/hud.ts` + `haunted.css`: marcos con volutas SVG, máquina de escribir, opciones numeradas |
| Panel «Herramientas» | `ui/tools.ts`: fps, calidad, resolución, efectos, exposición, bloom y sonido |
| Puerta verde de madera, ataúd con esqueleto, escritorio del escribano | `world/crypt.ts` y `world/propsCrypt.ts` |

## Arquitectura

```text
src/haunted/
  main.ts          arranque con barra de carga (pasos con setTimeout, no rAF)
  core/            app.ts (renderer + bucle), post.ts (postproceso), cameraRig.ts, input.ts, quality.ts, noise.ts, audio.ts
  gfx/             textures.ts (canvas procedurales), geom.ts, materials.ts, lights.ts, flame.ts, particles.ts
  world/           area.ts (contrato), graveyard*.ts, crypt.ts, props*.ts, chars.ts, ghost.ts, colliders.ts, vegetation.ts
  game/            game.ts (bucle, áreas, puertas), story.ts (misión), interaction.ts, content.ts (textos)
  ui/              hud.ts, tools.ts, haunted.css
```

- **`Area`** (`world/area.ts`): un diorama completo con su grupo de objetos, colisiones, interactuables, cámara, niebla y
  `update`. El cementerio y la cripta son dos áreas; el juego sólo mete en la escena la activa y cruza de una a otra con
  fundido. Para agregar un área nueva: construirla, registrarla en `Game` y poner una puerta (interactuable) que llame a `through`.
- **`Story`** (`game/story.ts`) no conoce three.js ni el DOM: habla con el juego por `StoryHost` (decir, elegir,
  inscripción, objetivo, efectos). Por eso se prueba con un host de mentira (`tests/haunted.test.ts`).
- **Textos** en `game/content.ts`: inscripciones, diálogos (formato del motor de diálogos del juego 2D) y tarjetas.
- **Interactuables**: `{ id, label, x, z, radius, outline[], tagY, kind }`; el más cercano dentro del radio (con histéresis)
  recibe el contorno y la etiqueta. `Story.interact(id)` decide qué pasa.

## Postproceso

`RenderPass` (HDR `HalfFloat`, con MSAA ×4 en calidad alta) → `OutlinePass` → `UnrealBloomPass` → `OutputPass` (ACES) → *grade*
propio (tilt-shift de diorama, tinte frío en sombras y cálido en luces, viñeta, grano, fundido) → `FXAAPass` si no hay MSAA.
Los efectos se pueden apagar en caliente desde «Herramientas».

## Luces

Un `PointLight` por farol sería carísimo y recompilaría shaders al cambiar su número. Se usa un **pool de tamaño fijo**
(`LightPool`: 6 / 8 / 10 según calidad) que cada cuadro se reparte entre los emisores más cercanos al fantasma; el resto de
los emisores conserva una mancha de luz horneada (decal aditivo) y un halo. La luna es una `DirectionalLight` con sombras que
sigue al jugador con el mapa de sombras alineado al píxel (sin temblor) y se atenúa con la distancia al fantasma (`moonPool`, con nubes
que pasan); el ambiente sale de un entorno nocturno procedural (PMREM), más bajo en la cripta. La cripta usa un `SpotLight` con sombras y antorchas.

## Desglose de la referencia (hilo del autor) y qué se hizo con cada punto

El autor publicó un hilo con el desglose de su escena. Esto dice y así se resolvió acá (✔ igual o parecido, ≈ aproximado, ✘ no hecho):

| Técnica del autor | En este prototipo |
|---|---|
| Luz: una direccional fuerte (la luna) + un HDRI; la luna cae de forma exponencial suave desde el 100 % sobre el fantasma hasta ~20 % a unos 6 m, con modulación de «mapa de nubes» (Perlin-Worley) | ✔ `gfx/sky.ts`: `moonPool` (caída exponencial alrededor del fantasma, piso del 28 %) y mapa de nubes que se desplaza. ≈ El HDRI es un entorno nocturno procedural filtrado con PMREM |
| Árboles con normales redondeadas para que la luz se vea más suave | ✔ `blob(…, soft)`: normales mezcladas con las radiales en copas y arbustos |
| Partículas propias; humo iluminado con normales derivadas de una esfera; llama y humo en un solo estado de mezcla aditivo/alfa | ✔ `gfx/particles.ts` (`lit`): normales de esfera + luna y alfa premultiplicado (parte aditiva al nacer, alfa al envejecer) |
| Suelo: un plano con splats de texturas, máscara RGBA y POM | ≈ un solo plano pintado por código (`GroundPainter`: caminos, adoquines, pasto) con bump; sin POM |
| Pasto estilo Ghost of Tsushima; viento = ruido muestreado con la misma implementación en CPU para mover partículas | ≈ hojas instanciadas con viento en el vertex shader; la **misma fórmula en CPU** (`gfx/wind.ts`) mueve hojas y humo; el pasto se aparta del fantasma; los vértices no se generan desde índices |
| Fantasma: una bola con una tela simulada encima | ≈ sábana con el dobladillo deformado en CPU (`world/ghost.ts`), sin simulación de tela |
| Perro: volumen tipo SDF con raymarching de nubes (Horizon: Forbidden West) y sombra compuesta | ✔ `gfx/cloudDog.ts`: SDF con ruido recorrido dentro de una caja, autosombra hacia la luna y alfa premultiplicado (calidad media y alta; en baja queda la malla); la sombra y el contorno salen de una silueta invisible |
| PostFX de three.js + SSAO + sombras de contacto propias + bloom propio | ≈ bloom de three.js, tilt-shift, viñeta, grano y ACES. ✘ Sin SSAO ni sombras de contacto: oclusión pintada en los vértices, manchas de luz horneadas y sombra blanda bajo los personajes |
| Resaltado: contorno desenfocado que usa la profundidad para que el brillo no se cuele por delante de otros objetos, compuesto con el bloom | ✔ `OutlinePass` antes del bloom con el color de aristas ocultas en negro (el brillo no atraviesa lo que está delante) |
| Árboles y modelos de Quaternius | ✘ Todo procedural (sin modelos externos) |

## Calidad y rendimiento

| Nivel | Píxeles | Sombras | AA | Bloom | Tilt-shift | Pasto / partículas |
|---|---|---|---|---|---|---|
| `low` | ×1 | 1024 | FXAA | ¼ | no | 30 % / 50 % |
| `medium` | ×1,5 | 2048 | FXAA | ½ | sí | 65 % / 80 % |
| `high` | ×2 | 2048 | MSAA ×4 | ½ | sí | 100 % / 100 % |

`detectQuality` elige según el dispositivo (render por software o ≤2 núcleos → `low`; táctil o ≤4 núcleos → `medium`).
Además la **resolución es dinámica**: si el promedio cae por debajo de 40 fps baja 0,25 de a un paso (mínimo ×0,75) y sube de
nuevo, despacio, cuando sobra margen; se desactiva con `?pr=` o `?timer`, o eligiendo una resolución fija en «Herramientas».
El build separa las dos páginas: el bundle de three.js (~200 kB gzip) sólo se descarga en `haunted.html`.

## Voz: lectura de los diálogos

Los diálogos, las opciones, las lápidas y las tarjetas de título y de final se leen en voz alta con la síntesis de voz del navegador
(Web Speech API, `core/speech.ts`): sin archivos, sin claves y sin conexión, con las voces del sistema.

- **Un registro por personaje**: narrador y opciones con voz femenina si la hay, Don Huesos grave y pausado, Lutin agudo y rápido, Pelusa muy
  aguda. Con una sola voz instalada se diferencian por tono y velocidad (`PERSONAS`).
- **La voz más clara**: `voiceScore` prefiere es-AR, luego el español latino, las voces neuronales «Natural» de Edge y las de Google, y descarta
  las que no son en español. En «Herramientas» se puede elegir otra voz, cambiar la velocidad y probarlas.
- **Texto y voz juntos**: la máquina de escribir no se adelanta a la voz (usa los límites de palabra que informa la síntesis; si no los informa,
  sigue una duración estimada). Un toque completa el texto; el siguiente corta la voz y pasa a la línea que sigue.
- **Controles**: tecla `V`, botón del parlante en la barra o «Herramientas» (la elección se recuerda). Con la voz encendida se apagan los «blips» de
  los diálogos.
- **Pantalla de inicio**: ahora pide un toque o una tecla antes de empezar. Los navegadores no dejan hablar ni sonar antes de un gesto, y así la
  primera tarjeta ya se lee. Con `?skipintro` no aparece.
- **Límites**: la calidad depende de las voces instaladas (Windows sin paquete de voz en español no tiene voz; Edge trae las «Natural», iOS y macOS
  traen las suyas). Si el navegador no soporta síntesis, el botón no aparece y todo sigue como antes. Las voces de red de Google se cortan solas a
  los ~15 s: se mantienen vivas con pausa y reanudación. No se pudo *escuchar* en la sesión de desarrollo: se verificó por los eventos de la
  síntesis (inicio, palabras, fin) con las voces Raúl y Sabina de Windows.

## La misión (≈5 minutos)

0. Hablar con **Don Huesos** junto al fuego (te da una vela de trámites).
1. Hablar con **Pelusa**, la perra fantasma: corre al árbol seco y desentierra algo.
2. Levantar el **sello oxidado** (el que Lutin perdió hace treinta años).
3. Entrar a la **cripta** por la puerta de madera y hablar con **Lutin**, el escribano.
4. Lutin sella el **Certificado de Descanso Eterno**… que «rige desde mañana». Tarjeta «Continuará».

Además: diez lápidas más un monumento, la tumba de Pelusa, el escritorio, el cofre y el ataúd tienen inscripciones; el diario
cuenta las leídas. La sátira apunta a mecanismos (turnos, sellos, ordenanzas que rigen «desde mañana»), no a personas ni a
partidos; los nombres (Lutin, Don Huesos, Pelusa) son provisorios y ficticios.

## Parámetros de URL

`?q=low|medium|high` · `?pr=1` (densidad de píxeles fija) · `?timer` (bucle por `setTimeout`, útil con la pestaña en segundo
plano) · `?skipintro` · `?nosave` (no recuerda los ajustes de «Herramientas»).
Para QA desde la consola: `__game` (juego) y `__app` (renderer, cámara, postproceso); por ejemplo
`__game.ghost.place(x, z, yaw)` o `__game.story.stage`.

## Pruebas

`tests/haunted.test.ts` y `tests/speech.test.ts` (Vitest, sin navegador; la voz se prueba con una síntesis de mentira): colisiones, ruido con semilla, niveles de calidad, cámara, **la misión completa
con un host de mentira** (etapas 0→4, una conversación a la vez, lápidas) y validez del guion (personajes, acciones y largos).
Lo visual se verificó a mano en el navegador integrado de Claude (calidades baja y alta, escritorio y 375×812), con las
salvedades de abajo.

## Límites conocidos y próximos pasos

- Sólo se probó en el navegador integrado de Claude: al principio con WebGL por software (~32 fps, pestaña oculta que frena los
  temporizadores) y después con una GPU real (~58 fps en calidad alta, 2542×1274 px a ×1,5). Falta medir en un teléfono real y en GPU
  integradas, y ajustar ahí el pool de luces y el costo del bloom.
- El sonido (viento, fuego, búho, blips, sellos) y la voz son cosas que **no se pudieron escuchar** en la sesión de desarrollo: conviene afinar
  volúmenes con auriculares. Arranca con el primer toque o tecla (política de autoplay) y se silencia desde «Herramientas».
- No hay guardado de la partida (es una demo de 5 minutos); los ajustes de «Herramientas» sí se recuerdan.
- Los personajes y la perra son geometría procedural: para arte final conviene reemplazarlos por modelos glTF (la interfaz
  `Actor` de `world/chars.ts` ya separa «grupo + update»).
- La perrita volumétrica (raymarching) sólo se usa en calidad media y alta; su costo depende del tamaño en pantalla y no se midió en GPU reales.
- Falta un segundo nivel de detalle para la hierba lejana y un culling por áreas si el cementerio crece.
