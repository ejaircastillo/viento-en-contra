# Decisiones, propuestas y temas sensibles — Demo 0.2

Este documento registra lo que se decidió al construir la demo, lo que quedó como **propuesta a
revisar** (spec §30) y los puntos que conviene **verificar antes de publicar**.

## 1. Decisiones técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| Motor | Phaser 3.90 + TypeScript + Vite | Pedido por la spec; maduro, liviano, WebGL con respaldo Canvas. |
| Arte | 100 % generado por código (placeholders originales) con manifiesto de reemplazo | Cero dependencia de terceros; cada sprite se reemplaza por PNG final sin tocar lógica. |
| Resolución | Render ~270–300 px de lado corto + escalado entero | Pixel-perfect y barato en teléfonos. |
| Texto | UI en HTML; carteles del mundo en fuente bitmap propia | Legibilidad en pantallas chicas. |
| Mapa | Formato declarativo propio (`CityPlan`) en lugar de Tiled | Equivalente a Tiled, versionable como código, relleno determinista de manzanas. |
| Guion | Máquina de estados explícita + checkpoint por estado | "Continuar" retoma en cualquier punto; estados testeables con `?state=`. |
| Audio | Síntesis en tiempo real (WebAudio) | Sin archivos; identidad sonora del viento. |
| Guardado | `localStorage` versionado, tolerante a fallos | Local, sin cuentas ni servidores. |

## 2. Cambios de la versión 0.1.1 (devolución de la primera prueba)

**Carteles más legibles.**
- Sobre fachadas, las letras se dibujan **derechas** y el renglón escalona con la pared (antes se cizallaban 2:1).
- Vallas grandes (Patagonia Puede, Radio 89, Acá Nomás) **de frente a la cámara**, con renglones que se parten
  solos y tableros que crecen lo necesario. La valla obligatoria dice completa:
  *PATAGONIA PUEDE · PRÓXIMAMENTE · CENTRO DE DISTRIBUCIÓN 2*.
- Las sucursales de Acá Nomás (y los locales "próximamente") tienen además un **cartel de techo** frontal.
- Se corrigieron carteles tapados o cortados (placa de la obra, banner "Ciudad en Movimiento", placa del semáforo).
- **Lectura ampliada**: al pasar cerca de un cartel importante aparece su texto nítido en HTML. En AUTO se activa
  sólo en pantallas chicas; Pausa → *Carteles ampliados* (AUTO / SÍ / NO).

**Diálogos por personaje y con coherencia familiar.**
- Cada protagonista tiene su propia versión de las escenas compartidas (paro, llamada, casa de la hermana,
  gorro): **Caro** (hermana de Diego) es enfermera y sale de la guardia nocturna; **Vero** (hermana de Nahuel)
  tiene una peluquería en el living, también "en trámite". Ninguna le dice "amor" al hermano: saludan al
  sobrino por su nombre y al hermano con su propio tono.
- **Elba** es la mamá de Nahuel (atiende el kiosco y le escribe como "Mamá").
- Tomi y Benja tienen voces distintas (uno se preocupa por la prueba de fracciones; el otro quiere atender el kiosco).
- Se unificó el gag de la **cinta** (el cartel del kiosco pegado con cinta) desde la casa hasta la ventanilla.
- Detalle de coherencia: el viento sopla del oeste, así que lo que se vuela termina "en el mar", no en Chile.

**Manejo.** Antes el giro dependía de empujar hacia una calle en diagonal y de hacerlo en el momento justo.
Ahora:
- Se **elige la calle antes de la esquina** con ◀ ▶ / ← → (lado de la pantalla) o tocando su flecha.
  El auto marca el guiño y dobla solo al llegar; apretar de nuevo cancela.
- Flechas con el nombre de cada calle en la esquina que viene: amarilla = por dónde vas, celeste = GPS,
  roja = cortada. El GPS dice qué botón tocar.
- Giro tardío: si se pide apenas entrado al cruce, todavía dobla.
- Botones grandes en pantalla (▲ acelerar, ▼ frenar / vuelta en U, ◀ ▶ elegir calle); la cámara mira hacia el cruce.
- Si el jugador se pasa dos giros del GPS, se le ofrece una vez la conducción asistida.

**Final.** El fundido negro quedaba por encima de la pantalla "CONTINUARÁ — CAPÍTULO 2" y la tapaba.
Ahora el fundido nunca cubre los paneles (menús, avisos y el final siempre se ven).

## 2 bis. Cambios de la versión 0.2 (Capítulo 2)

**Contenido.** Capítulo 2 "Horario de atención" (jueves), con los mismos protagonistas en situaciones distintas
(guion completo en `docs/GUION_CAPITULO_2.md`). Sátira de **mecanismos**: metas de recaudación, sistema que "funciona el
3 %", ceremonias de anuncio, jurisdicciones que se pasan la pelota, vías rápidas según el logo, tasas para pagar tasas,
vigencias diferidas y una ordenanza reemplazada por otra sin sentido. No se nombra a personas, partidos ni candidatos;
`tests/chapter02.test.ts` vigila que el texto no incluya nombres reales conocidos.

**Motor y flujo.** El título lista los capítulos; al terminar uno se ofrece "Seguir: Capítulo N+1", la otra versión del
mismo capítulo o el título. Las decisiones del capítulo anterior llegan como flags `prev_*` (`carry`). Nuevas piezas de
guion: minijuego de aguantar el cartel, ráfagas guionadas, llamadas con menú propio (contestador), reloj y viento propios por
capítulo. Utilidades compartidas en `src/content/shared/flowKit.ts`.

**Robustez.** Pausa con Esc y automática al cambiar de pestaña; respaldo de render Canvas 2D si WebGL falla (una recarga,
`?renderer=canvas` lo fuerza); pedales y botones de manejo tolerantes a punteros sintéticos; el fundido nunca tapa los paneles.

**Mejoras sobre lo ya hecho.** Recuadro "Ayer" que resume el Capítulo 1 sin contradecirlo; carteles de la protesta del bache
retirados del mapa del jueves (tapaban la inauguración); el auto arranca cada tramo estacionado del lado que ya mira hacia el
destino (`toward`; antes 3 de los 7 tramos del jueves y el tramo escuela → casa de la hermana del Capítulo 1 empezaban con una
vuelta en U); el reloj de Obras se frena en 09:59 en vez de retroceder al sellar; tableros dibujados a mano ajustados a su
lienzo (el de la estación de ensayos se cortaba); carteles de pared de los interiores que se cortaban ("AUDIEN…", "ASAM…") o
se salían de su marco ("MESA DE ENTRADAS", "KIOSCO EL REFUGIO") ahora se leen enteros, con pruebas que lo vigilan; barras del
minijuego más opacas para leerse sobre cualquier fondo.

**Verificación.** Recorridos automáticos completos de las dos rutas del Capítulo 2 (y de los dos del Capítulo 1 encadenados
al 2, con las consecuencias guardadas), pruebas automáticas del motor y de los capítulos (`npm test`), `tsc` y `npm run build`
sin errores, build de producción probado con `vite preview`, guardado y "Continuar" probados en un origen aparte
(`127.0.0.1`, para no tocar la partida del usuario), respaldo Canvas 2D probado, y revisión visual de las escenas nuevas en
escritorio y de la pantalla de título, la selección, el manejo, el minijuego y el final en celular (375×812).

## 2 ter. Prototipo 3D «Fantasma en trámite» (rama `feature/three-haunted-style`)

Pedido: emular con three.js los efectos, la jugabilidad, la apariencia y el estilo de una referencia (diorama de cementerio y
cripta con contorno naranja en lo interactuable). Detalle técnico en `docs/HAUNTED_THREEJS.md`. Decisiones:

- **Página aparte, no reemplazo**: vive en `haunted.html` + `src/haunted/` y no toca el juego 2D (Phaser). Sólo reutiliza el motor
  de diálogos de datos. Así la demo 0.2 ya desplegada queda intacta y se puede comparar ambos estilos.
- **Sin assets externos**: geometría, texturas y sonido son procedurales; la referencia se tomó como guía de estilo, no se copió nada.
- **Contenido propio**: un cuento corto de fantasmas burocráticos (Don Huesos, Pelusa, Lutin, el Certificado de Descanso Eterno que
  «rige desde mañana»). La sátira apunta a mecanismos, como en el resto del juego. Nombres provisorios y ficticios: revisar que no
  coincidan con personas locales antes de publicar.
- **La rama no se fusionó ni se desplegó**: producción (`main`) sigue siendo la demo 0.2. Desplegar la rama (vista previa o producción)
  queda a decisión del equipo.
- **Sin guardado** (demo de 5 minutos); los ajustes del panel «Herramientas» se recuerdan en el navegador (salvo `?nosave`).
- **Calidad adaptable**: tres niveles y resolución dinámica para no castigar teléfonos ni GPU integradas.
- **Pendiente de validar**: rendimiento en teléfonos reales y GPU dedicada, y afinar el sonido escuchándolo (no se pudo en desarrollo).

## 3. Propuestas a revisar (spec §30)

Están centralizadas para cambiarlas sin tocar el motor:

| Qué | Dónde | Valor propuesto |
|---|---|---|
| Protagonistas | `src/content/characters.ts` | Diego Barría (Habilitaciones) · Nahuel Cárcamo (kiosquero) |
| Familia | `characters.ts` / `chapter01/npcs.ts` | Tomi, Caro (enfermera) · Benja, Vero (peluquera), Elba (mamá) |
| Otros NPCs | `chapter01/npcs.ts` | Don Tito, Ramón (portero), Mirta (Mesa de Entradas), Lic. Ponce, Yésica (caja) |
| Certificado | `chapter01/config.ts` | Certificado de Resistencia Eólica de Cartelería (C.R.E.C.) |
| Ordenanza | `config.ts` | Ordenanza 26/2026 |
| Tasas | `config.ts` | Tasa de Mantenimiento Semafórico · Tasa de Evaluación Eólica |
| Horarios | `config.ts` / `characters.ts` | Salida 07:28 · entrada 08:00 · inspección 08:30 · comunicado 23:47 |
| Boleta | `config.ts` | $ 29.800 → $ 38.470 |
| Kiosco | `config.ts` | Kiosco El Refugio, Fagnano 1180 |
| Frases finales | `config.ts` → `ending` | Una por personaje |
| **Cap. 2** · Operativo | `chapter02/config.ts` | Operativo "Comercio en Regla"; meta: cinco actas |
| **Cap. 2** · Tasas y trámites | `chapter02/config.ts`, `dialogues.ts` | Tasa de Emisión de Boleta ($ 800) · Tasa de Evaluación Eólica ($ 12.400) · Formulario 26-B · Habilitación Exprés · Línea de Jurisdicciones |
| **Cap. 2** · Ordenanzas | `chapter02/config.ts`, `radio.ts` | 26 (Resistencia Eólica, derogada) · 31/2026 (Resistencia Sísmica de Cartelería) |
| **Cap. 2** · Personajes nuevos | `chapter02/npcs.ts` | Facundo (Sub. de Anuncios) · Cacho (sereno) · Julián (Gerente de Expansión) · Beto (Ensayos Eólicos) · Norma (Tesorería) · Graciela (Obras Particulares) · Nelly, Lucas, Marta (feria) |
| **Cap. 2** · Lugares | `chapter02/city.ts`, `interiors.ts` | Feria de Emprendedores (costanera) · Estación Móvil de Ensayos Eólicos · Acá Nomás Suc. 15 · Municipalidad (planta baja y Obras Particulares) · Kiosco El Refugio (interior) |
| **Cap. 2** · Horarios | `chapter02/config.ts` | Arranque 08:00 · asamblea 10:00 · inspección 11:00 |

## 4. Temas sensibles — verificar antes de publicar

La sátira apunta a **mecanismos** (tasas nuevas, trámites que cambian de un día para el otro, obras
"próximamente", paros avisados de noche, cadenas que reemplazan comercios), nunca a partidos,
candidatos ni personas reales. Todas las marcas e instituciones del juego son ficticias.

Aun así, antes de publicar conviene **verificar** (no se pudo hacer desde este entorno):

- **Nombres de marcas**: que no existan en Santa Cruz empresas, programas o comercios reales llamados
  "Patagonia Puede", "Acá Nomás" o "Radio 89" (o una FM 89.x con esa identidad). Si existieran, renombrar
  en `src/content/brands.ts` y `radio.ts`.
- **Lema municipal** "Ciudad en Movimiento": confirmar que no sea el lema real de ninguna gestión.
- **Escuela N° 38**: puede existir una escuela real con ese número en Río Gallegos; conviene un número
  inexistente o un nombre genérico si se quiere evitar la asociación.
- **Calles**: se usan nombres comunes en ciudades argentinas (Av. Roca, Av. San Martín, Zapiola, Alcorta,
  Fagnano, Sarmiento, Rawson, Errázuriz, Maipú…). El trazado es inventado; los hechos del juego (el semáforo
  roto, el bache, la obra) no refieren a esquinas reales.
- **Personajes**: nombres y apellidos comunes, sin referencia a personas reales. Revisar que ninguno
  coincida con funcionarios o figuras públicas locales conocidas.
- **Gremio docente**: no se nombra ningún gremio real; el paro es genérico.
- **Hospital**: Caro "sale de la guardia" sin nombrar un hospital real.
- **Montos y fechas** (boleta, "INICIO 2024 · PLAZO 180 DÍAS", Ordenanza 26/2026): ficticios.

Sumado en el Capítulo 2 (todo inventado; conviene el mismo control):

- **Nombres de pila y cargos** (Facundo "Subsecretario de Anuncios", Cacho, Julián "Gerente de Expansión", Beto, Norma,
  Graciela, Nelly, Lucas, Marta, Lic. Ponce): revisar que no coincidan con funcionarios o comerciantes locales conocidos.
  Los cargos ("Subsecretaría de Anuncios", "Obras Particulares", "Tesorería", "Concejo") son genéricos.
- **"Patagonia Puede"**: marca de la gestión ficticia que viene de la spec original; suena a lemas reales de campañas
  regionales. Si hay riesgo de asociación, renombrarla en `src/content/brands.ts` (una sola definición) y en los textos que la citan.
- **Programas y trámites**: "Comercio en Regla", "Habilitación Exprés", "Programa de Radicación de Inversiones de Escala Mayor/Menor",
  "C.R.E.C.", "Línea de Jurisdicciones", "Feria de Emprendedores · Ciudad en Movimiento": confirmar que no sean nombres oficiales vigentes.
- **Jurisdicciones** (municipal / provincial / nacional): el chiste es del mecanismo (nadie es responsable), no de un nivel de gobierno ni
  de un partido concreto; la obra "provincial" es ficticia y no refiere a ninguna obra real.
- **Alerta por viento y sismos**: la ordenanza "sísmica" es un absurdo deliberado (la región no es sísmica); no alude a hechos reales.
- **Contestador automático**: la "Línea de Jurisdicciones" y su número de llamante son inventados; no se usa ningún teléfono real.

## 5. Pendiente para próximas versiones

- Arte final (reemplazar placeholders según `assets/ASSET_MANIFEST.md`) y música/voces definitivas.
- Tests de extremo a extremo automatizados en CI (hoy: Vitest para motor/contenido + `?autoplay` manual).
- Capítulo 3 (ganchos abiertos en `docs/GUION_CAPITULO_2.md` §8; plantilla en `src/content/chapter03_plantilla/`).
- Voces o efectos definitivos para la feria y el ensayo eólico; arte final del puesto de feria, el escenario y la estación de ensayos.
- PWA (ícono, manifest, instalación en el teléfono) y partición del bundle de Phaser si se quiere reducir la primera carga.
