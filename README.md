# Río Gallegos: Viento en Contra — Demo 0.2

Aventura satírica en pixel art isométrico, mobile-first, jugable en el navegador.
Dos días de paro en Río Gallegos, con dos protagonistas a elegir en cada capítulo:

- **Diego Barría**, empleado municipal de Habilitaciones Comerciales: el reloj marca que llega tarde al trabajo.
- **Nahuel Cárcamo**, kiosquero con la habilitación "en trámite": el reloj marca que el inspector puede llegar al kiosco.

**Capítulo 1 · "Viento en contra"** (miércoles, 10–15 minutos): salida de casa, semáforo roto con accidente y desvío,
radio, paro docente sorpresa, llamada a la hermana, trayecto con presión, pago con tasa nueva / trámite en la
Municipalidad y el cruce de ambas historias en la ventanilla.

**Capítulo 2 · "Horario de atención"** (jueves, 12–18 minutos): mismos personajes, situaciones distintas.
Diego sale de operativo con Tomi en la camioneta (feria "zona libre de actas", una obra que nadie sabe de quién
es, una inauguración con cinta y una línea de "jurisdicciones" que se pasan la pelota). Nahuel lleva su cartel a
ensayar contra el viento (**minijuego: aguantar el cartel**), hace fila en Tesorería y recorre tres ventanillas de
Obras Particulares antes de que cierren por asamblea. Los dos terminan en el kiosco, a las once, con un certificado
que rige "desde mañana" y una ordenanza que se deroga por radio. Las decisiones del Capítulo 1 se recuerdan en el 2.
Termina en **CONTINUARÁ — CAPÍTULO 3**.

La sátira apunta a **mecanismos** (tasas, trámites circulares, ceremonias, jurisdicciones, ordenanzas cambiantes),
no a personas ni a partidos. Todo nombre, marca e institución del juego es ficticio (ver `docs/DECISIONES.md`).

## Requisitos

- Node.js **20.19+** o **22.12+** (probado con Node 24) y npm.
- Un navegador moderno con WebGL (Chrome, Edge, Firefox, Safari). Si WebGL falla, el juego se recarga solo una vez
  con el render Canvas 2D (`?renderer=canvas` lo fuerza).

## Ejecutar

```bash
npm install
```

```bash
npm run dev
```

Abrir `http://localhost:5178`. El servidor escucha en toda la red local, así que desde el **teléfono**
(misma Wi-Fi) se puede abrir `http://<IP-de-la-PC>:5178` — Vite muestra esa dirección al arrancar.

> La recarga automática (HMR) está **desactivada** a propósito: editar código no reinicia la partida en curso.
> Para ver cambios, recargar la página; el juego guarda en cada escena y se retoma con **Continuar**.

Compilar y servir la versión final:

```bash
npm run build
```

```bash
npm run preview
```

`npm run build` verifica tipos y genera `dist/` (estático: se puede subir a cualquier hosting; usa rutas relativas).

Otros scripts:

| Script | Qué hace |
|---|---|
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm test` | Tests del motor y validación de los capítulos: marcadores, diálogos, reloj, radio (Vitest) |
| `npm run manifest` | Regenera `assets/ASSET_MANIFEST.md` desde `assets/manifest.json` |

## Controles

| | Táctil (móvil) | Teclado |
|---|---|---|
| Caminar | Arrastrar el dedo en cualquier parte (joystick flotante) o tocar un lugar | WASD / flechas |
| Interactuar | Botón redondo contextual (✋, 🚗, 🎟️…) o tocar el objeto | E / espacio / enter |
| Acelerar / frenar | Botones ▲ / ▼ (o arrastrar el dedo hacia adelante / atrás) | ↑ / ↓ (W / S) |
| Doblar | **Antes de la esquina**, ◀ o ▶ (o tocar la flecha de la calle): el auto dobla solo al llegar | ← / → (A / D) |
| Giro en U | Con el auto detenido, sostener ▼ | Sostener ↓ |
| Bocina | Botón BOCINA | H |
| Diálogos | Tocar en cualquier parte · opciones con botones | Espacio / enter · teclas 1-3 |
| Aguantar el cartel (minijuego) | Mantener apretado el botón grande | Mantener espacio / E / enter / ↑ |
| Pausa | Botón II (arriba a la derecha) | Esc |

**Cómo se dobla:** en la esquina que viene aparecen flechas con el nombre de cada calle. La **amarilla** es
por donde va a ir el auto; la **celeste**, la que sugiere el GPS (el panel de arriba dice qué botón tocar).
◀ y ▶ eligen la calle que sale hacia la izquierda o la derecha *de la pantalla*; el auto pone el guiño y
dobla solo. Apretar de nuevo el mismo lado cancela. Si se aprieta apenas entrado al cruce, todavía dobla.

Pausa → opciones: música, sonido, radio, **conducción asistida** (el auto dobla solo siguiendo al GPS;
el jugador sólo acelera y frena), **carteles ampliados** (AUTO: texto nítido de los carteles al pasar cerca
en pantallas chicas), reiniciar capítulo, salir al título.

## Parámetros de prueba (QA)

Se agregan a la URL, por ejemplo `http://localhost:5178/?debug&chapter=ch02&char=emprendedor&state=N_OBRAS`.

| Parámetro | Efecto |
|---|---|
| `?debug` | Muestra FPS, resolución y atlas; logs de estados en consola; herramientas `__vec` |
| `?autoplay` | Juega solo de principio a fin (camina a los objetivos, maneja por GPS, elige la 1ª opción) |
| `?speed=3` | Acelera el tiempo de juego (0.25–8) |
| `?char=municipal` / `?char=emprendedor` | Saltea la selección de personaje |
| `?chapter=ch01` / `?chapter=ch02` | Capítulo al que apuntan `?state=` y `?autoplay` (solo, el título se muestra igual) |
| `?state=NOMBRE` | Arranca en un estado del capítulo (ver `docs/ARQUITECTURA.md`) |
| `?chapter=ch03_plantilla` | Carga la plantilla mínima del Capítulo 3 (no figura en el título) |
| `?renderer=canvas` | Fuerza el render Canvas 2D (respaldo si WebGL falla) |
| `?nosave` | No escribe el guardado (para no pisar la partida real) |
| `?tier=low` | Fuerza el perfil liviano (menos tránsito y partículas) |
| `?timer` | Bucle por `setTimeout` (útil si el navegador frena `requestAnimationFrame`) |

Ejemplo de prueba completa automática: `/?debug&autoplay&nosave&chapter=ch02&char=municipal&speed=3&timer`
(al terminar un capítulo, el autoplay sigue solo con el siguiente).

Herramientas en consola con `?debug`: `__vec.keys()` (claves de sprites), `__vec.png('clave')` (exporta el
placeholder como PNG), `__vec.autopilot(true)`, `__vec.clock('08:25')`, `__vec.speed(2)`.

## Estructura

```text
src/
  engine/        motor (no conoce el contenido)
    core/        Engine, eventos, reloj de juego pausable, perfil del dispositivo, arranque
    assets/      lienzo de píxeles, paleta, fuente bitmap, atlas dinámico, registro/manifest
      gen/       generadores de arte placeholder (personajes, vehículos, edificios, props, fx)
    world/       plano de ciudad → grilla iso, suelo por chunks (Web Worker), red vial, escena de ciudad
    vehicles/    auto del jugador, tránsito, estacionamiento, giros
    interior/    habitaciones en corte
    entities/    personajes
    dialogue/    diálogos como datos
    mission/     máquina de estados del capítulo, API de guiones, flujo título→capítulo→continuará
    radio/       Radio 89
    timer/       reloj narrativo tolerante
    audio/       audio procedural (viento, motor, radio, SFX, música chiptune)
    ui/          HUD y paneles HTML (mobile-first)
    input/       joystick táctil, toques y teclado
    save/        guardado local
  content/       contenido (capítulos, personajes, marcas, música)
    chapter01/   Capítulo 1: mapa, interiores, NPCs, diálogos, radio, estados, configuración
    chapter02/   Capítulo 2: ciudad variada, props propios, interiores, diálogos, radio, estados
    chapter03_plantilla/  plantilla mínima de un capítulo nuevo
    shared/      utilidades de guion compartidas entre capítulos (flowKit)
assets/          assets finales (reemplazo de placeholders) + manifest.json + ASSET_MANIFEST.md
docs/            arquitectura, guía de capítulo nuevo, guion del Capítulo 2, decisiones
tests/           tests (Vitest)
```

## Documentación

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) — cómo está armado el motor y cómo se separa del contenido.
- [docs/GUIA_NUEVO_CAPITULO.md](docs/GUIA_NUEVO_CAPITULO.md) — **cómo crear un capítulo nuevo sin modificar el motor**.
- [docs/GUION_CAPITULO_2.md](docs/GUION_CAPITULO_2.md) — guion del Capítulo 2: beats, chistes, decisiones y consecuencias.
- [docs/DECISIONES.md](docs/DECISIONES.md) — decisiones tomadas, propuestas a revisar y temas sensibles.
- [assets/ASSET_MANIFEST.md](assets/ASSET_MANIFEST.md) — inventario de assets (placeholder/final) y cómo reemplazarlos.

## Rendimiento

- El canvas se dibuja en **resolución de arte** (~270–300 px en el lado corto) y se escala por CSS sin suavizado:
  pixel-perfect y muy barato de renderizar en teléfonos.
- La ciudad se carga **por zonas** (chunks de 16×16 baldosas); el suelo se pinta en un Web Worker.
- Sprites empaquetados en pocas páginas de atlas; objetos fuera de cámara no se dibujan.
- Audio 100 % generado en tiempo real (no hay archivos que descargar).
- Si el promedio baja de ~42 fps, el juego pasa solo a un perfil liviano (menos tránsito, peatones y partículas).
