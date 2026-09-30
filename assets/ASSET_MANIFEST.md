# ASSET MANIFEST — Río Gallegos: Viento en Contra (Demo 0.2)

> Generado desde `assets/manifest.json` con `npm run manifest`. No editar a mano: editar el JSON.

## Cómo reemplazar un placeholder (sin tocar lógica)

1. Exportar la plantilla del placeholder: en el juego con `?debug`, abrir la consola y ejecutar
   `__vec.keys()` (lista de claves) y `__vec.png('char.municipal')` (PNG con el layout exacto).
2. Dibujar el arte final respetando **tamaño de cuadro, orden de cuadros y ancla** indicados abajo.
3. Guardar el archivo en `assets/<ruta>` (por ejemplo `assets/characters/municipal.png`).
4. En `assets/manifest.json`: poner `"status": "final"`, `"source": "file"` y el `"path"`.
   Para una clave de familia (`veh:*`, `bld:*`, `prop:*`), agregar una entrada nueva con la **clave exacta**
   (la muestra `__vec.keys()`).
5. Recargar. El registro de assets carga el archivo en lugar de generarlo; el código de juego no cambia.

Estados: **placeholder** = generado por código (arte o sonido temporal original) · **final** = archivo definitivo.

## Personajes

| Clave | Estado | Origen | Ruta final | Uso | Dimensiones | Animaciones | Notas de reemplazo |
|---|---|---|---|---|---|---|---|
| `char.municipal` | placeholder | procedural | `characters/municipal.png` | Protagonista A: Diego Barría (empleado municipal, Habilitaciones) | 16x24 por cuadro · tira 224x24 | frente quieto 0-1; frente camina 2-5; espalda quieto 6-7; espalda camina 8-11; teléfono 12; sentado 13 | Frente mira abajo-derecha (se espeja para abajo-izquierda). Pies en y=23, centro x=8. |
| `char.emprendedor` | placeholder | procedural | `characters/emprendedor.png` | Protagonista B: Nahuel Cárcamo (kiosquero, habilitación en trámite) | 16x24 por cuadro · tira 224x24 | igual layout que char.municipal | Gorro rojo y campera inflable mostaza: rasgos para distinguirlo de lejos. |
| `char.kid_municipal` | placeholder | procedural | `characters/kid_municipal.png` | Tomi, hijo de Diego (guardapolvo blanco) | 16x24 por cuadro (cuerpo de ~15 px) | igual layout que char.municipal | Nombre provisorio (spec §30). |
| `char.kid_emprendedor` | placeholder | procedural | `characters/kid_emprendedor.png` | Benja, hijo de Nahuel (guardapolvo blanco) | 16x24 por cuadro | igual layout que char.municipal | Nombre provisorio (spec §30). |
| `char:*` | placeholder | procedural | — | NPCs (hermanas, Doña Elba, Don Tito, portero, agente de tránsito, padres, cajera, Mirta, Ponce, vecinos, ciudadanos, peatones) | 16x24 por cuadro · 14 cuadros | igual layout que char.municipal | Familia generada desde cada 'look' en content/chapter01/npcs.ts. Para arte final: agregar sprite: 'char.<id>' al NPC y una entrada con esa clave. |

## Vehículos

| Clave | Estado | Origen | Ruta final | Uso | Dimensiones | Animaciones | Notas de reemplazo |
|---|---|---|---|---|---|---|---|
| `veh:*` | placeholder | procedural | — | Autos del jugador, tránsito y estacionados: sedan, hatch, pickup, suv, van, bus, truck, police, tow | cuadro variable (sedan ~40x30, bus ~66x55) · hoja de 8x2 | fila 0: 8 direcciones (0=E, 2=S, 4=W, 6=N); fila 1: frenando / balizas / sirena | Clave exacta: veh:<modelo>:<color>:<acento>:<d si chocado>. Ej. auto de Diego = veh:sedan:carBlue::  · utilitario de Nahuel = veh:van:carWhite:: |

## Entornos y props

| Clave | Estado | Origen | Ruta final | Uso | Dimensiones | Animaciones | Notas de reemplazo |
|---|---|---|---|---|---|---|---|
| `ground` | placeholder | procedural | — | Suelo por chunks de 16x16 baldosas: asfalto, veredas, estepa, estuario, barro, patios, adoquines, pisos interiores | baldosa iso 32x16 · chunk 512x256 | — | Pintado por píxel en un Web Worker (engine/world/ground.ts). Reemplazo final: tileset por tipo de suelo (ver docs/ARQUITECTURA.md §Suelo). |
| `bld:*` | placeholder | procedural | — | Edificios: casas con chapa y chiflonera, escuela, Municipalidad, sucursales Acá Nomás, locales cerrados, Radio 89 | variable según huella (ancho = (w+d)*16 px) | — | Ancla = esquina superior de la huella. Se dibujan en tiras de 8 px para el orden de profundidad. |
| `prop:*` | placeholder | procedural | — | Postes, luminarias, semáforos (4 cuadros), PARE, carteles de calle, álamos (2), matas de coirón (2), cercos, vallas, conos, bancos, garita, contenedores, banderas (3), letras RÍO GALLEGOS, flamencos (2), bolsas (4), perro (6), obra (mezcladora, arena, ladrillos), antena Radio 89 (2), tendedero (3) | variable | — | Catálogo: engine/world/PropRegistry.ts. Ancla en el punto de apoyo (o esquina de huella si tiene fp). |
| `prop:interiores` | placeholder | procedural | — | Escritorios con CRT y mate, sillas, mostrador con vidrio, dispensador de números, visor LED de turnos, archivos, expedientes, dispenser de agua, planta, góndolas, heladeras, caja, radio portátil | variable | — | content/chapter01/interiors.ts define disposición; paredes: clave wall:<interior>. |
| `prop:capitulo2` | placeholder | procedural | — | Capítulo 2: puesto de feria (toldo y mercadería según el rubro; 2 cuadros), escenario de la feria (3 cuadros: cinta, cinta cortada, telón volado), telón que vuela (banner:fly), Estación Móvil de Ensayos Eólicos (2 cuadros: ventilador y anemómetro), túnel de viento averiado, garrafa vacía, escalera y ascensor "pronto" de la Municipalidad | puesto 58x97 · escenario 132x144 · telón 92x26 · estación 85x113 · túnel 93x97 · garrafa 12x22 | puesto: toldo al viento (2 cuadros); escenario: 0 cinta, 1 cortada, 2 sin telón; estación: aspas del ventilador (2 cuadros) | content/chapter02/props.ts. Los tableros de texto se dibujan de frente a la cámara y tienen que caber dentro del lienzo del sprite. Claves con hash de parámetros: ver __vec.keys(). |
| `fx:*` | placeholder | procedural | — | Estelas de viento, aguanieve, flechas de ruta (8 dir), sombras de nubes, humo, cables entre postes, bolsas volando | chicas (6-22 px) · nubes 220x110 | — | engine/assets/gen/fx.ts |

## Marcas ficticias

| Clave | Estado | Origen | Ruta final | Uso | Dimensiones | Animaciones | Notas de reemplazo |
|---|---|---|---|---|---|---|---|
| `logo:pp` | placeholder | procedural | — | Patagonia Puede (empresa provincial ficticia): insignia montaña + sol | cuadrado escalable (8-16 px) | — | Original: no copia identidades reales. Submarcas previstas: Alimentos, Digital, Hogar, Obras. |
| `logo:an` | placeholder | procedural | — | Acá Nomás (cadena ficticia): marcador naranja 'acá' | escalable (7-12 px) | — | Nombre de trabajo de la spec. Paleta naranja/crema propia. |
| `logo:r89` | placeholder | procedural | — | Radio 89 (radio ficticia) | escalable | — | Slogan: 'La que se escucha aunque sople'. |
| `logo:muni` | placeholder | procedural | — | Gráfica municipal ficticia 'Ciudad en Movimiento' | escalable | — | No reproduce escudos ni logos oficiales. |
| `prop:bb_pp_cd2` | placeholder | procedural | — | Cartel de obra obligatorio: PATAGONIA PUEDE · PRÓXIMAMENTE · CENTRO DE DISTRIBUCIÓN 2 | valla frontal ~114 x 49 px sobre 2 postes (huella 7 x 0.12 baldosas) | — | De frente a la cámara, texto derecho; visible sobre Alcorta durante el desvío. El ancla es la esquina (0,0) de la huella. |
| `prop:carteles_marca` | placeholder | procedural | — | Vallas frontales Radio 89 y Acá Nomás; carteles de techo de las sucursales Acá Nomás; placas Patagonia Puede Digital (fotocontrol), Obras (bacheo), cartel de obra, Plan Semáforo Inteligente, calle cerrada, desvío, PARO, protesta del bache | variable | — | content/brands.ts. Los carteles importantes tienen además un rótulo HTML (lectura ampliada) definido con `caption` en el mapa. |

## Interfaz

| Clave | Estado | Origen | Ruta final | Uso | Dimensiones | Animaciones | Notas de reemplazo |
|---|---|---|---|---|---|---|---|
| `portrait:*` | placeholder | procedural | — | Retratos de diálogo y selección de personaje | 32x32 (se muestran a 3x) | — | Generados desde el mismo 'look' del personaje (engine/assets/gen/characters.ts#drawPortrait). |
| `font.pixelify` | final | file | — | Tipografía de la interfaz (Pixelify Sans, @fontsource) | 400 y 700 | — | Licencia SIL Open Font License: redistribuible. Se empaqueta en el build. |
| `ui.hud` | placeholder | css | — | HUD (reloj, objetivo, radio, botones táctiles, joystick), diálogo, pensamientos, teléfono, menús, pantalla Continuará | responsive (mobile-first) | — | src/styles/game.css · variables de color en :root. |

## Audio

| Clave | Estado | Origen | Ruta final | Uso | Dimensiones | Animaciones | Notas de reemplazo |
|---|---|---|---|---|---|---|---|
| `music.*` | placeholder | synth | — | Tema de título, música de radio (3 temas: incluye 'Sensación térmica'), feria del Capítulo 2, interior (espera), cierre 'Continuará' | loops de 4 compases | — | Secuenciador WebAudio: content/music.ts. La música de manejo suena 'por la radio' (filtrada). |
| `sfx.*` | placeholder | synth | — | door_open, door_close, car_door, brake, horn, blinker, phone_ring, phone_pickup, notify, paper, stamp, step, ui_click, ui_confirm, ui_back, radio_on, car_alarm, ticket, error_beep, murmur, dog_bark, gust, whoosh, register, thud | one-shots | — | Para reemplazar: entrada con key 'sfx.<nombre>', kind 'audio', status 'final', path 'audio/<nombre>.ogg'. |
| `amb.*` | placeholder | synth | — | Viento con ráfagas (identidad sonora), motor según velocidad, zumbido de tubo fluorescente, locutor de radio murmurado, voces de diálogo | continuos | — | engine/audio/AudioEngine.ts |

## Documentos

| Clave | Estado | Origen | Ruta final | Uso | Dimensiones | Animaciones | Notas de reemplazo |
|---|---|---|---|---|---|---|---|
| `doc.*` | placeholder | css | — | Boleta municipal, comunicado de PARO, número de turno, afiche de ordenanza, carpeta del kiosco (8 documentos), pantalla CRT del sistema | responsive | — | engine/ui/Overlays.ts; textos en content/chapter01/config.ts y flow.ts. |

## Licencias y terceros

- **Pixelify Sans** (tipografía de UI): SIL Open Font License 1.1, vía `@fontsource/pixelify-sans`.
- **Phaser 3** (motor de render): licencia MIT.
- Todo el arte, audio y marcas del juego son **originales y generados por código**. No se usan fotos, mapas,
  logotipos ni materiales de terceros. Las marcas (Patagonia Puede, Acá Nomás, Radio 89, "Ciudad en Movimiento")
  son ficticias y no copian identidades gráficas reales.
