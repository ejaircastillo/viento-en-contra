import type { DialogueLibrary } from '../../engine/dialogue/Dialogue';

/**
 * Diálogos del Capítulo 1 (textos de trabajo, rioplatense, breves).
 * "player" = protagonista elegido. Las opciones cambian líneas posteriores, nunca la misión.
 */
export const dialogues: DialogueLibrary = {
  // ================================================================ ESCENA 1 · salida de casa
  home_intro_municipal: [
    { who: 'player', text: 'Dale, {kid}, apurate que vamos a llegar tarde.' },
    { who: 'kid', text: '¡Ya voy! No encuentro el otro guante.' },
    { who: 'player', text: 'Ponete el que tenés. Y agarrá bien el gorro, que hoy sopla.' },
    { who: 'tito', text: '¡Buen día, Diego! ¿Hoy a quién clausurás?' },
    {
      choice: [
        { tone: 'resignado', text: 'A nadie, Tito. Hoy me clausuro yo.', set: { tono_tito: 'resignado' } },
        { tone: 'irónico', text: 'Depende de a qué hora llegue.', set: { tono_tito: 'ironico' } },
        { tone: 'molesto', text: 'Tito, son las siete y media.', set: { tono_tito: 'molesto' } },
      ],
    },
    { who: 'tito', text: 'Yo barro por deporte, eh. El viento me devuelve todas las hojas.', if: 'tono_tito=resignado' },
    { who: 'tito', text: 'Si llegás, contame. Yo desde que me jubilé no llego a ningún lado.', if: 'tono_tito=ironico' },
    { who: 'tito', text: 'Siete y media es tarde, Diego. Para barrer, digo.', if: 'tono_tito=molesto' },
  ],
  home_intro_emprendedor: [
    { who: 'player', text: 'Dale, {kid}, que llegamos tarde.' },
    { who: 'kid', text: '¡Ya voy! Abuela, ¿me guardás un alfajor para la vuelta?' },
    { who: 'elba', text: 'Uno. Que después no me cierra la caja.' },
    { who: 'player', text: 'Má, si viene alguien de la Muni, decile que estoy haciendo los papeles.' },
    { who: 'elba', text: '¿Y si pide ver la habilitación?' },
    {
      choice: [
        { tone: 'resignado', text: 'Decile que está en trámite. Que es verdad.', set: { tono_elba: 'resignado' } },
        { tone: 'irónico', text: 'Mostrale el cartel. Dice "en trámite" en letra grande.', set: { tono_elba: 'ironico' } },
        { tone: 'nervioso', text: 'Ofrecele un café. Y rezá.', set: { tono_elba: 'nervioso' } },
      ],
    },
    { who: 'elba', text: 'Hace ocho meses que es verdad, Nahuel.', if: 'tono_elba=resignado' },
    { who: 'elba', text: 'El cartel se voló anoche. Lo pegué con cinta de embalar.', if: 'tono_elba=ironico' },
    { who: 'elba', text: 'Café tengo. Rezar, rezo desde que abriste.', if: 'tono_elba=nervioso' },
    { think: true, text: 'Dicen que hoy salen a inspeccionar. Tengo que llegar a la Muni antes de que el inspector llegue al kiosco.' },
  ],
  hat_pickup_municipal: [
    { who: 'player', text: 'Acá está. Con las dos manos, te dije.' },
    { who: 'kid', text: 'Gracias, pa. El viento es un ladrón.' },
    { who: 'player', text: 'Acá el viento es el que manda, {kid}.' },
    { set: { gorro: true } },
  ],
  hat_pickup_emprendedor: [
    { who: 'player', text: 'Tomá. Si se vuela otra vez, lo pegamos con cinta.' },
    { who: 'kid', text: '¿Como el cartel del kiosco?' },
    { who: 'player', text: 'Como el cartel del kiosco.' },
    { set: { gorro: true } },
  ],

  // ================================================================ ESCENA 4 · escuela y paro
  // Mismo portero y misma noticia; cada protagonista la vive a su manera.
  school_strike_municipal: [
    { who: 'portero', text: 'Buen día. Hoy no hay clases, eh.' },
    { who: 'player', text: '¿Cómo que no hay clases? Hoy es día hábil.' },
    { who: 'portero', text: 'Paro. Salió el comunicado anoche.' },
    { who: 'player', text: '¿Anoche a qué hora?' },
    { who: 'portero', text: 'Once y cuarenta y siete.' },
    { who: 'player', text: 'Eso no es un aviso, Ramón. Es una emboscada.' },
    { who: 'portero', text: 'Yo lo leí a las seis y vine igual. Alguien tiene que abrir para avisar que está cerrado.' },
    { do: 'bark', args: { who: 'mama_a', text: '¡Yo entro a trabajar a las ocho!' } },
    {
      choice: [
        { tone: 'resignado', text: 'Bueno. ¿Qué le vamos a hacer?', set: { tono_escuela: 'resignado' } },
        { tone: 'irónico', text: 'Menos mal que avisaron con tanta anticipación.', set: { tono_escuela: 'ironico' } },
        { tone: 'molesto', text: '¿Y dónde presento el reclamo? ¿Hay formulario?', set: { tono_escuela: 'molesto' } },
      ],
    },
    { who: 'portero', text: 'Nada. Eso es lo que vamos a hacer todos hoy.', if: 'tono_escuela=resignado' },
    { who: 'portero', text: 'Lo mandaron al grupo de padres. ¿No está en el grupo?', if: 'tono_escuela=ironico' },
    { who: 'player', text: 'Me sacaron por mandar stickers.', if: 'tono_escuela=ironico' },
    { who: 'portero', text: 'Formulario seguro que hay. Pero la que lo recibe también está de paro.', if: 'tono_escuela=molesto' },
    { do: 'bark', args: { who: 'papa_a', text: 'Es la tercera vez en el mes.' } },
    { who: 'kid', text: '¿Y la prueba de fracciones? ¿También está de paro?' },
    { who: 'player', text: 'Todo está de paro, {kid}. Menos yo.' },
    { think: true, text: '¿Y ahora qué hago con {kid}? Yo entro a las ocho.' },
    { wait: 500 },
    { think: true, text: '…{sister}.' },
  ],
  school_strike_emprendedor: [
    { who: 'portero', text: 'Buen día. Hoy no hay clases, eh.' },
    { who: 'player', text: '¿Paro? ¿Otra vez?' },
    { who: 'portero', text: 'Salió el comunicado anoche. A las once y cuarenta y siete.' },
    { who: 'player', text: 'A esa hora yo estaba contando monedas en el kiosco.' },
    { who: 'portero', text: 'Lo mandaron al grupo de padres.' },
    { who: 'player', text: 'El grupo lo tengo silenciado. Ciento veinte mensajes por día y ninguno dice nada.' },
    { do: 'bark', args: { who: 'mama_a', text: '¡Yo entro a trabajar a las ocho!' } },
    {
      choice: [
        { tone: 'resignado', text: 'Bueno. Habrá que acomodarse.', set: { tono_escuela: 'resignado' } },
        { tone: 'irónico', text: '¿Y el comunicado para los kiosqueros cuándo sale?', set: { tono_escuela: 'ironico' } },
        { tone: 'molesto', text: 'Yo no puedo parar. Si paro, no como.', set: { tono_escuela: 'molesto' } },
      ],
    },
    { who: 'portero', text: 'Como siempre. Acá vivimos acomodándonos.', if: 'tono_escuela=resignado' },
    { who: 'portero', text: 'Ese no sale nunca. Ustedes no tienen gremio.', if: 'tono_escuela=ironico' },
    { who: 'portero', text: 'Yo tampoco paro, mire. Acá estoy, cuidando una escuela vacía.', if: 'tono_escuela=molesto' },
    { do: 'bark', args: { who: 'papa_a', text: 'Es la tercera vez en el mes.' } },
    { who: 'kid', text: '¡¡Siii!! ¡No hay clases! ¿Entonces hoy atiendo el kiosco con la abuela?' },
    { who: 'player', text: 'Hoy no, {kid}. Hoy el kiosco tiene que parecer… habilitado.' },
    { think: true, text: 'Si cae el inspector y lo encuentra atendiendo, me clausuran dos veces. ¿Con quién lo dejo?' },
    { wait: 500 },
    { think: true, text: '…{sister}.' },
  ],

  // ================================================================ llamada a la hermana
  // Caro (hermana de Diego): enfermera, sale de la guardia nocturna. Seca, cariñosa a su manera.
  call_sister_municipal: [
    { who: 'sister', text: '¿Diego? Salí de la guardia hace una hora. Más vale que sea grave.' },
    { who: 'player', text: 'Paro docente. Sorpresa.' },
    { who: 'sister', text: 'Sorpresa sería que no hubiera paro.' },
    { who: 'player', text: '¿Te puedo dejar a {kid} hasta que salga del trabajo?' },
    { who: 'sister', text: '…Traelo. Yo duermo en el sillón y él mira dibujitos. Pacto de no agresión.' },
    {
      choice: [
        { tone: 'agradecido', text: 'Sos la mejor enfermera de Río Gallegos.', set: { tono_hermana: 'genia' } },
        { tone: 'irónico', text: 'Te lo pago con una tasa municipal.', set: { tono_hermana: 'tasa' } },
        { tone: 'sincero', text: 'Perdoná. No tenía a quién más llamar.', set: { tono_hermana: 'sincero' } },
      ],
    },
    { who: 'sister', text: 'De la provincia. Pero seguí, que me gusta.', if: 'tono_hermana=genia' },
    { who: 'sister', text: 'Ni se te ocurra. Ya me cobran bastantes.', if: 'tono_hermana=tasa' },
    { who: 'sister', text: 'Ya sé. Por eso atendí.', if: 'tono_hermana=sincero' },
    { who: 'sister', text: 'A las doce lo buscás, que a la noche vuelvo a la guardia. A las doce, Diego. No a las doce "hora municipal".' },
    { set: { hermana_12hs: true } },
  ],
  // Vero (hermana de Nahuel): peluquería en el living, también "en trámite". Rápida, práctica.
  call_sister_emprendedor: [
    { who: 'sister', text: '¿Nahue? Tengo los ruleros puestos. Si es para pedirme plata, no hay.' },
    { who: 'player', text: 'No es plata. Es peor: paro docente.' },
    { who: 'sister', text: '¿Otra vez? Ese nene va a terminar la primaria por correspondencia.' },
    { who: 'player', text: '¿Me lo cuidás hasta que termine con los papeles del kiosco? Tengo que llegar a la Muni antes que el inspector.' },
    { who: 'sister', text: 'Traelo. Pero si toca el timbre alguien con carpeta, no abro: mi peluquería también está "en trámite".' },
    {
      choice: [
        { tone: 'agradecido', text: 'Sos una genia, Vero.', set: { tono_hermana: 'genia' } },
        { tone: 'irónico', text: 'Te lo pago en alfajores.', set: { tono_hermana: 'alfajores' } },
        { tone: 'sincero', text: 'Gracias. En serio. No sé qué haría sin vos.', set: { tono_hermana: 'sincero' } },
      ],
    },
    { who: 'sister', text: 'Ya sé. Decilo más seguido, que es gratis.', if: 'tono_hermana=genia' },
    { who: 'sister', text: 'De maicena. Y que no estén vencidos como la otra vez.', if: 'tono_hermana=alfajores' },
    { who: 'sister', text: 'Cerrarías el kiosco y te vendrías a vivir acá. Traelo, dale.', if: 'tono_hermana=sincero' },
    { who: 'sister', text: 'A las doce lo buscás, eh. Viene la señora del brushing y no quiero a {kid} jugando con el secador.' },
    { set: { hermana_12hs: true } },
  ],

  // ================================================================ ESCENA 5 · casa de la hermana
  // La tía recibe al sobrino por su nombre y al hermano, con lo suyo.
  drop_child_municipal: [
    { who: 'sister', text: '¡{kid}! Pasá, que se te congelan las orejas.' },
    { who: 'sister', text: '¿Y el gorro?', if: '!gorro' },
    { who: 'kid', text: 'Se lo llevó el viento. Iba para el mar.', if: '!gorro' },
    { who: 'sister', text: 'Clásico. Te presto uno mío, rosa.', if: '!gorro' },
    { who: 'kid', text: '¡Nooo!', if: '!gorro' },
    { who: 'sister', text: 'Mirá vos, con gorro y todo. Tu papá aprendió algo.', if: 'gorro' },
    { who: 'kid', text: '¡Chau, pa! ¡Llegá temprano!' },
    { who: 'sister', text: 'Y vos, andá. Tenés cara de que ya vas tarde.' },
    { who: 'player', text: 'Voy tarde desde las siete y media.' },
    { who: 'sister', text: 'A las doce, acá. Si no venís, te lo llevo a la oficina y que te ayude a clausurar.' },
  ],
  drop_child_emprendedor: [
    { who: 'sister', text: '¡{kid}! Pasá, que quedaron facturas de ayer.' },
    { who: 'kid', text: '¿De dulce de leche?' },
    { who: 'sister', text: 'De las que sobrevivieron. Andá eligiendo.' },
    { who: 'sister', text: '¿Y el gorro?', if: '!gorro' },
    { who: 'kid', text: 'Se voló. Ahora lo tiene el viento.', if: '!gorro' },
    { who: 'sister', text: 'Tu papá sin habilitación y vos sin gorro. Qué familia.', if: '!gorro' },
    { who: 'sister', text: 'Ese gorro está bien agarrado, eh.', if: 'gorro' },
    { who: 'kid', text: '¡Casi lo pegamos con cinta, como el cartel!', if: 'gorro' },
    { who: 'kid', text: '¡Chau, papi! ¡Vendé mucho!' },
    { who: 'player', text: 'Hoy me conformo con que no me clausuren.' },
    { who: 'sister', text: 'Nahue: respirá. ¿Llevás la carpeta?' },
    { who: 'player', text: 'La revisé tres veces.' },
    { who: 'sister', text: 'Revisala cuatro. Y a las doce lo buscás, que viene la del brushing.' },
  ],

  // ================================================================ ESCENA 7A · punto de pago
  payment_1: [
    { who: 'cajera', text: '¿Qué va a pagar?' },
    { who: 'player', text: 'La boleta de servicios municipales. Vence hoy.' },
    { do: 'sfx:register' },
    { who: 'cajera', text: 'Son treinta y ocho mil cuatrocientos setenta.' },
    { who: 'player', text: '¿Treinta y ocho? El mes pasado eran veintinueve.' },
    { who: 'cajera', text: 'Mire la boleta, señor. Hay cosas nuevas.' },
  ],
  payment_2: [
    { who: 'player', text: '¿Tasa de Mantenimiento Semafórico? Si el semáforo de Roca está roto desde marzo.' },
    { who: 'cajera', text: 'El semáforo no sé. La tasa funciona perfecto.' },
    { who: 'cajera', text: 'Igual esa tasa nueva no la toma el sistema. La tiene que pagar en la Municipalidad.' },
    { who: 'player', text: 'Trabajo en la Municipalidad.' },
    { who: 'cajera', text: 'Ah, bueno. Entonces ya sabe dónde queda.' },
    {
      choice: [
        { tone: 'resignado', text: 'Bueno. La pago allá.', set: { tono_caja: 'resignado' } },
        { tone: 'irónico', text: 'Qué suerte: me queda de paso.', set: { tono_caja: 'ironico' } },
        { tone: 'molesto', text: '¿Y para qué está el punto de pago?', set: { tono_caja: 'molesto' } },
      ],
    },
    { who: 'cajera', text: 'Ahí sí se la toman. Creo.', if: 'tono_caja=resignado' },
    { who: 'cajera', text: 'Viste. Todo cerca. Acá nomás.', if: 'tono_caja=ironico' },
    { who: 'cajera', text: 'Para pagar lo que el sistema toma, señor. ¡Siguiente!', if: 'tono_caja=molesto' },
    { think: true, text: 'Hace un rato era un vecino más. En diez minutos vuelvo a ser la Municipalidad.' },
  ],

  // ================================================================ ESCENA 7A · en el trabajo (Diego)
  muni_boss_m: [
    { who: 'ponce', text: 'Barría. Son las {time}.' },
    {
      choice: [
        { tone: 'resignado', text: 'Ya sé, jefe. Paro docente.', set: { tono_jefe: 'resignado' } },
        { tone: 'irónico', text: 'Puntual para mi horario de llegar tarde.', set: { tono_jefe: 'ironico' } },
        { tone: 'molesto', text: 'Un choque, un paro y encima una tasa nueva por el semáforo.', set: { tono_jefe: 'molesto' } },
      ],
    },
    { who: 'ponce', text: 'Todos tenemos hijos, Barría. Yo tengo tres y acá estoy.', if: 'tono_jefe=resignado' },
    { who: 'ponce', text: 'Muy gracioso. Hay gente esperando desde las siete.', if: 'tono_jefe=ironico' },
    { who: 'ponce', text: 'La tasa del semáforo la sacamos nosotros, Barría. Somos la Municipalidad.', if: 'tono_jefe=molesto' },
    { who: 'ponce', text: 'Andá a la ventanilla. Y acordate que hoy tenés inspecciones.' },
  ],
  muni_attend_m_1: [
    { who: 'nahuel', text: 'Buen día. Traigo todo. Todo, todo. Revisé tres veces.' },
    { who: 'player', text: 'Veamos la carpeta.' },
  ],
  muni_attend_m_2: [
    { who: 'nahuel', text: '¿Viste? Todo.' },
    { who: 'player', text: 'Todo… Déjeme cargarlo en el sistema.' },
  ],
  muni_inform_m: [
    { think: true, text: 'Hace una hora yo estaba del otro lado de un mostrador escuchando lo mismo.' },
    {
      choice: [
        { tone: 'resignado', text: 'Le falta un certificado. Salió hoy.', set: { tono_informar: 'resignado' } },
        { tone: 'irónico', text: 'Buenas noticias: tiene todo. Malas: "todo" cambió a la medianoche.', set: { tono_informar: 'ironico' } },
        { tone: 'empático', text: 'Mire, a mí también me parece un disparate, pero…', set: { tono_informar: 'empatico' } },
      ],
    },
    { who: 'nahuel', text: '¿Qué certificado?' },
    { who: 'player', text: 'El {certificate}. Por la ordenanza nueva.' },
    { who: 'nahuel', text: '¿Resistencia eólica? Mi cartel es una hoja A4 pegada con cinta.' },
    { who: 'player', text: 'Entonces va a tener que certificar la cinta.', if: 'tono_informar=ironico' },
    { who: 'player', text: 'Ya sé. Lo emite {office}, segundo piso. Previo pago de la {tasaEolica}.', if: '!tono_informar=ironico' },
    { who: 'nahuel', text: '¿Y eso se paga en el punto de pago?' },
    { who: 'player', text: 'No se lo recomiendo.' },
  ],

  // ================================================================ ESCENA 7B · en la Municipalidad (Nahuel)
  muni_mirta_e: [
    { who: 'mirta', text: '¿Habilitaciones? Saque número. El que atiende todavía no llegó.' },
    { who: 'player', text: '¿No llegó? ¿Y quién atiende?' },
    { who: 'mirta', text: 'Él. Cuando llega.' },
    { think: true, text: 'Si no llegó… ¿estará en mi kiosco?' },
  ],
  muni_waiting_poster: [
    { think: true, text: '"Nueva ordenanza: Resistencia Eólica de Cartelería. Vigente desde hoy."' },
    { think: true, text: 'Mientras no sea para los kioscos…' },
  ],
  muni_diego_arrives_e: [
    { who: 'diego', text: 'Perdón, perdón. Paro docente. Tuve que dejar al nene con mi hermana.' },
    { who: 'diego', text: 'Y el semáforo de Roca, un choque. Y encima me quisieron cobrar una tasa nueva por el semáforo.' },
    { think: true, text: 'Es mi mañana. Es exactamente mi mañana.' },
    { who: 'ponce', text: 'Barría. Son las {time}.' },
    { who: 'diego', text: 'Ya sé, jefe. Ya sé.' },
  ],
  muni_attend_e_1: [
    { who: 'diego', text: 'Buen día. Perdone la demora.' },
    { who: 'player', text: 'Traigo todo. Todo, todo. Revisé tres veces.' },
    { who: 'diego', text: 'Veamos. Vaya pasándome los papeles.' },
  ],
  muni_attend_e_2: [
    { who: 'player', text: '¿Viste? Todo.' },
    { who: 'diego', text: 'Todo… Lo cargo en el sistema.' },
  ],
  muni_inform_e: [
    { who: 'diego', text: 'Uh.' },
    { who: 'diego', text: 'Le falta el {certificate}. Salió hoy.' },
    {
      choice: [
        { tone: 'resignado', text: '¿Y dónde lo saco?', set: { tono_informar: 'resignado' } },
        { tone: 'irónico', text: 'Mi cartel es una hoja A4 pegada con cinta.', set: { tono_informar: 'ironico' } },
        { tone: 'molesto', text: '¡Revisé tres veces! ¡Salió HOY!', set: { tono_informar: 'molesto' } },
      ],
    },
    { who: 'diego', text: 'En {office}, segundo piso.', if: 'tono_informar=resignado' },
    { who: 'diego', text: 'Entonces va a tener que certificar la cinta.', if: 'tono_informar=ironico' },
    { who: 'diego', text: 'Ya sé. A mí también me agarró de sorpresa. Como el paro.', if: 'tono_informar=molesto' },
    { who: 'diego', text: 'Lo emite {office}, previo pago de la {tasaEolica}.' },
    { who: 'player', text: '¿Y eso se paga en el punto de pago?' },
    { who: 'diego', text: 'No se lo recomiendo.' },
  ],

  // ================================================================ REMATE · el cruce de historias
  reveal_municipal: [
    { think: true, text: 'Kiosco El Refugio… {kioskAddress}.' },
    { think: true, text: '{kioskAddress}. Lo tengo en la planilla de inspecciones. Hoy. A las {inspectionTime}.' },
    {
      choice: [
        { tone: 'sincero', text: '¿Sabe que hoy le tocaba inspección?', set: { tono_final: 'sincero' } },
        { tone: 'irónico', text: '¿Usted es el del kiosco de Fagnano?', set: { tono_final: 'ironico' } },
        { tone: 'callado', text: '(No decir nada)', set: { tono_final: 'callado' } },
      ],
    },
    { who: 'nahuel', text: 'Sí… ¿por?', if: 'tono_final=ironico' },
    { who: 'player', text: 'Hoy le tocaba inspección.', if: 'tono_final=ironico' },
    { who: 'nahuel', text: '¿Qué me mira así? ¿Me falta otro papel?', if: 'tono_final=callado' },
    { who: 'player', text: 'No… Hoy le tocaba inspección. A las ocho y media.', if: 'tono_final=callado' },
    { who: 'nahuel', text: '¿Hoy? ¡Estuve toda la mañana corriendo para llegar antes que el inspector!' },
    { who: 'player', text: 'El inspector soy yo.' },
    { wait: 700 },
    { who: 'nahuel', text: '¿Y dónde estaba?' },
    { who: 'player', text: 'En el mismo choque que usted, seguramente.' },
    { who: 'nahuel', text: '¿Roca y San Martín?' },
    { who: 'player', text: 'Roca y San Martín.' },
    { wait: 900 },
    { who: 'ponce', text: '¡Barría! ¿Y la inspección de las ocho y media?' },
    { who: 'player', text: 'Voy mañana.' },
    { who: 'nahuel', text: 'Mañana hay paro.' },
    { who: 'player', text: 'Entonces pasado.' },
    { do: 'radio_flash' },
    { who: 'radio', text: 'Último momento: el gremio docente informó que el paro se extiende hasta el viernes.' },
    { wait: 800 },
  ],
  reveal_emprendedor: [
    { who: 'diego', text: 'Kiosco El Refugio… {kioskAddress}.' },
    { who: 'diego', text: 'Ah, mire. Usted estaba en mi planilla de hoy. Inspección a las ocho y media.' },
    { who: 'player', text: '¿Usted es el inspector?' },
    { who: 'diego', text: 'Cuando llego.' },
    { think: true, text: 'Toda la mañana corriendo contra el inspector. Y el inspector estaba en el mismo choque que yo.' },
    { who: 'ponce', text: '¡Barría! ¿Y la inspección de las ocho y media?' },
    { who: 'diego', text: 'Voy mañana.' },
    { who: 'player', text: 'Mañana hay paro.' },
    { who: 'diego', text: 'Entonces pasado.' },
    { do: 'notify', args: { from: 'Mamá', text: '¿Y? ¿Cerramos o seguimos?' } },
    {
      choice: [
        { tone: 'responder', text: '"Seguí atendiendo. El inspector está acá conmigo."', set: { respuesta_mama: 'inspector' } },
        { tone: 'responder', text: '"Seguí. Hoy no viene nadie."', set: { respuesta_mama: 'nadie' } },
        { tone: 'responder', text: '"Cerrá. No, abrí. No sé. Seguí."', set: { respuesta_mama: 'nose' } },
      ],
    },
    { do: 'sfx:notify' },
    { do: 'radio_flash' },
    { who: 'radio', text: 'Último momento: el gremio docente informó que el paro se extiende hasta el viernes.' },
    { wait: 800 },
  ],
};
