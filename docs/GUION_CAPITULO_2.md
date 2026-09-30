# Capítulo 2 · "Horario de atención" — guion y biblia de contenido

**Jueves, segundo día de paro, alerta naranja por viento.** Mismos protagonistas que el Capítulo 1, pero cada uno vive
un día distinto: Diego sale de operativo (con Tomi en la camioneta de Habilitaciones) y Nahuel sale a conseguir un
certificado para el cartel del kiosco. Sus rutas se cruzan en la feria y terminan juntas en el kiosco, a las once.

> La sátira apunta a **mecanismos**: tasas que sirven para pagar tasas, trámites circulares, ceremonias de anuncio,
> jurisdicciones que se pasan la pelota, ordenanzas que cambian de un día para el otro, cadenas con vía rápida.
> No nombra personas, partidos ni candidatos. Todo nombre e institución es ficticio (ver `docs/DECISIONES.md`).

## 1. Estructura

| | Diego Barría (Habilitaciones) | Nahuel Cárcamo (kiosquero) |
|---|---|---|
| Reloj | "Asamblea 10:00" → "Kiosco 11:00" | "Obras cierra 10:00" → "Inspector 11:00" |
| Meta | Cinco actas antes del mediodía (y la feria es "zona libre de actas") | Certificado del cartel antes de que cierre Obras |
| Compañía | Tomi (en la camioneta) | Solo; Elba y Benja quedan en el kiosco |
| Vehículo | Camioneta blanca de Habilitaciones | Su utilitario |
| Duración | 12–18 min | 12–18 min |

Estados (`?state=`): `ARRANQUE` (tarjetas "Capítulo 2" y "Ayer", bifurca por personaje) ·
Diego: `D_BRIEFING`, `D_A_LA_FERIA`, `D_FERIA`, `D_A_LA_OBRA`, `D_OBRA`, `D_A_ACA_NOMAS`, `D_ACA_NOMAS`, `D_AL_KIOSCO` ·
Nahuel: `N_AMANECER`, `N_A_LA_FERIA`, `N_ENSAYO`, `N_A_LA_MUNI`, `N_TESORERIA`, `N_OBRAS`, `N_AL_KIOSCO` ·
los dos: `FINAL_KIOSCO`.

## 2. Ruta de Diego · "El operativo"

1. **Briefing (Habilitaciones, 08:12).** Ponce reparte la meta ("no es trabajo, es una tarea"), entrega la tablet
   (*Patagonia Puede Digital, módulo de actas: funciona el 3 %*) y la planilla en papel. Caro dejó a Tomi por la guardia
   doble. Diego llama a Nahuel para notificar la inspección de las 11:00 ("anticipación razonable: hoy, tres horas").
   *Decisión:* tono de la meta (`tono_meta`) y del aviso (`d_aviso`: formal / humano / irónico). Si en el Capítulo 1
   fue sincero con Nahuel, Ponce lo acusa de "aviso previo indebido" (`prev_tono_final`).
2. **Feria de Emprendedores (costanera, ~09:36).** El Subsecretario de Anuncios corta la cinta dos veces y una ráfaga se
   lleva el telón oficial ("los carteles oficiales no llevan certificado"). *Instrucción de arriba:* zona libre de
   actas. *Meta:* cinco actas. Diego recorre cinco puestos (Nelly, Vero, Tito obligatorios; Lucas y Marta opcionales) y
   en cada uno elige **labrar el acta o dejar pasar** (`acta_*`; cuenta en `actas`).
3. **Obra del Centro de Distribución 2 (~10:12).** El sereno no deja pasar: "el predio es provincial, la ciudad es
   municipal, la vereda no sé". Ponce: "llame a la Línea de Jurisdicciones". **Contestador con menú** que devuelve a
   cada llamante a otra jurisdicción hasta que alguien prueba la opción 4 ("no sé de quién es"): *"derivado al viento"*.
4. **Acá Nomás Sucursal 15 (~10:40).** Inauguración con cinta y promotora. Habilitación Exprés en cuatro minutos
   (el kiosco espera ocho meses); certificado "emitido a las 23:50" para una ordenanza que rige a las 00:00.
   *Decisión* (`d_an15`): pedir original y expediente / ironizar / labrar el acta (la tablet la rechaza: "exención de
   exención").
5. **Al kiosco (10:56).** Tomi y Diego llegan juntos; el paro juntó a Tomi con Benja.

## 3. Ruta de Nahuel · "El certificado"

1. **Amanecer (08:05).** Elba con tres camperas sin gas; Benja vio volar el cartel. Diego llama con la notificación
   (`n_llamada`). Nahuel saca el cartel de madera del kiosco y **camina con él en las manos: el viento pesa el doble**.
2. **Feria y ensayo eólico (~09:26).** Vero (peluquería en el living, también "en trámite") avisa que anda un
   inspector con un pibe. Beto, técnico de la Estación Móvil, explica que el túnel de viento se voló ("diseñado para
   110, ráfagas de 118"). **Minijuego "aguantar el cartel":** mantener apretado cuando pega la ráfaga y soltar cuando
   pasa (apretar de más cansa). El resultado (`n_ensayo`: ok / obs / canso) cambia el comentario de Beto y el
   acta de ensayo ("aprobado", "con observaciones: se voló", "por cansancio, del técnico").
3. **Tesorería (~09:52).** Norma pide la boleta; la boleta se saca en Obras; Obras pide el pago primero. *Espiral* que se
   rompe con la **Tasa de Emisión de Boleta** (nueva desde hoy: "sirve para pagar las demás tasas"; $ 800, efectivo,
   el posnet está en asamblea). Ascensor "pronto", pegado con la misma cinta del cartel.
4. **Obras Particulares (09:59).** Tres ventanillas, una sola Graciela (las otras dos preparan el sándwich de la
   asamblea): Consultas → Boletas (Tasa de Evaluación Eólica $ 12.400) → Sellado y Firma. Falta la firma del Director:
   **certificado "provisorio", vigencia desde las 00:00 de mañana**. Sello a las 9:59, último minuto.
5. **Al kiosco (10:38).** Elba avisa por mensaje que el inspector viene con un nene. Nahuel llega con un certificado
   que todavía no vale.

## 4. Escena final compartida · el kiosco, 11:00

Los dos la viven, cada uno desde su lado (`final_municipal_1..3` / `final_emprendedor_1..3`). Tomi y Benja son
compañeros de la misma escuela. La tablet marca **97 %** ("llevo tres horas en el noventa y siete" / "yo llevo ocho
meses"). El certificado dice *vigencia: a partir de las cero horas de mañana*.

| Diego decide (`d_final`) | Nahuel decide (`n_final`) |
|---|---|
| `acta`: reglamento, "firmo y me voy" | `ley`: "la ordenanza dice: vigente desde su publicación" |
| `constancia`: el certificado existe, sólo llegó temprano | `tiempo`: "dame hasta mañana, es sólo un día" |
| `esperar`: volver a las cero horas de mañana | `mate`: ofrecer un mate (frío, "es hospitalidad") |

Radio: *el Concejo derogó la Ordenanza 26 (Resistencia Eólica) y aprobó la 31 (Resistencia Sísmica de Cartelería);
aclararon que la ciudad no es zona sísmica*. Llamado de Ponce a Diego: se derogó la 26, las actas del día quedan
sin efecto y **se anulan con un acta de anulación, con el formulario nuevo "que todavía no existe"**; la meta de
cinco se mantiene ("cambió la ordenanza; la meta no"). Cierre: Tomi pregunta qué es "sísmica"; Elba: *"Con abrigo."*

Frase final de cada personaje (`CONFIG2.ending`):
- Diego: *Mañana: anular las actas de hoy con un acta de anulación. Si el sistema llega al 100 %.*
- Nahuel: *Mañana: Certificado de Resistencia Sísmica. Río Gallegos no es zona sísmica. Rige desde hoy.*

## 5. Decisiones y consecuencias

Las decisiones cambian **líneas y detalles**, nunca la misión. Los flags que pasan al Capítulo 3 (`carry`) se guardan por
personaje y llegan como `prev_<flag>`.

| Flag | Quién | Qué cambia hoy | Pasa al 3 |
|---|---|---|---|
| `prev_tono_final`, `prev_gorro`, … | los dos | Ponce y Elba recuerdan lo del Capítulo 1 (aviso previo, qué le dijo a mamá) | — |
| `tono_meta`, `d_telon` | Diego | Respuesta de Ponce / de Facundo | — |
| `acta_nelly`, `acta_lucas`, `acta_vero`, `acta_tito`, `acta_marta` | Diego | Reacción del puesto y de Tomi; suman a `actas` | vía `actas` |
| `actas` (0–5) | Diego | Contador visible ("Actas: N de 5") | sí |
| `d_aviso` | Diego | Tono de la llamada a Nahuel | sí |
| `d_an15` | Diego | Respuesta de Julián (y si la tablet rechaza el acta) | — |
| `d_final` | Diego | Cierre en el kiosco (acta / constancia / esperar) | sí |
| `n_ini`, `n_norma`, `n_graciela` | Nahuel | Tono con Elba, Norma y Graciela | — |
| `n_llamada` | Nahuel | Cómo tomó la notificación | sí |
| `n_ensayo` | Nahuel | Resultado del minijuego y texto del acta de ensayo | sí |
| `n_final` | Nahuel | Cierre en el kiosco (ley / tiempo / mate) | sí |

## 6. Mecánicas nuevas del capítulo

- **Aguantar el cartel** (`ctx.brace`): barra de agarre y barra de resbalón; mantener apretado (botón, espacio, E, enter o ↑) cuando
  llega la ráfaga y soltar cuando pasa. El resultado sólo cambia los textos (Beto y el acta de ensayo): no hay pantalla de "perdiste".
- **Cargar un cartel contra el viento** (`ctx.carry`, `ctx.reskinPlayer`): caminar cuesta el doble y el personaje se ve con el
  cartel en las manos, también al bajar del auto.
- **Ráfagas guionadas** (`ctx.gust`): la ceremonia de la feria se interrumpe con sonido, sacudón de cámara y viento fuerte.
- **Llamada con menú propio** (`ctx.phoneSession`): la Línea de Jurisdicciones (contestador automático).
- **Reloj con significado propio por capítulo** y viento base propio (`windBase: 0.58`).
- **Pausa con Esc**, pausa automática al cambiar de pestaña y respaldo Canvas 2D si WebGL falla.

## 7. Mapa de la sátira (mecanismo → escena)

| Mecanismo | Dónde aparece |
|---|---|
| Metas de recaudación con nombre de "ordenamiento" | Briefing de Ponce; "cinco actas" contra "zona libre de actas" |
| Sistema digital que "funciona el 3 %" | Tablet de actas; 97 % en el kiosco |
| Ceremonia y anuncio antes que hechos | Feria: corte de cinta, telón que vuela, "el tercer anuncio" |
| Excepciones que se tramitan en más tiempo que su duración | Radio: "excepción por tres horas, se tramita en treinta días" |
| Jurisdicciones que se pasan la pelota | Obra provincial en ciudad municipal; Línea de Jurisdicciones ("derivado al viento") |
| Vía rápida según el logo | Habilitación Exprés (4 min) contra "Escala Menor" (8 meses) |
| Requisito que rige antes de existir | Certificado "emitido a las 23:50" para una ordenanza de las 00:00 |
| Tasa para pagar la tasa | Tasa de Emisión de Boleta |
| Ventanillas circulares | Tesorería ↔ Obras: boleta → pago → boleta |
| Asambleas que paran el trámite, no la meta | Obras cierra 10:00; "no es trabajo, es una tarea" |
| Vigencia diferida | "Provisorio hoy, vigente mañana"; "vale desde mañana" |
| Ordenanza reemplazada por otra sin sentido | Resistencia Eólica → Resistencia Sísmica en una ciudad sin sismos |
| Anular con un formulario que no existe | Acta de anulación, "próximamente" |

## 8. Puente al Capítulo 3

Quedan abiertos: el **certificado sísmico** (Nahuel, "rige desde hoy"), el **acta de anulación** que no tiene formulario (Diego), la
meta de cinco que se mantiene, la obra "jurisdicción: viento", y la sucursal 16 de Acá Nomás. La plantilla
`src/content/chapter03_plantilla/` arranca el viernes con esos ganchos.
