import type { DialogueLibrary } from '../../engine/dialogue/Dialogue';

/**
 * Textos de "Fantasma en trámite": inscripciones de lápidas, diálogos y tarjetas. Castellano rioplatense; la
 * sátira apunta a mecanismos (turnos, sellos, ordenanzas que cambian, trámites que valen "desde mañana") y no a
 * personas ni partidos. Los nombres (Lutin, Don Huesos, Pelusa) son provisorios.
 */
export const SPEAKERS: Record<string, string> = {
  huesos: 'Don Huesos',
  pelusa: 'Pelusa',
  lutin: 'Lutin',
  player: 'Vos',
};

export interface Epitaph {
  kicker: string;
  name: string;
  lines: string[];
}

/** Inscripciones: id del interactuable → texto ("AQUÍ YACE …"). */
export const EPITAPHS: Record<string, Epitaph> = {
  grave_1: { kicker: 'Aquí yace', name: 'Inocencio', lines: ['Esperó el colectivo cuarenta años.', 'Llegó justo cuando se iba.'] },
  grave_2: { kicker: 'Aquí yace', name: 'Tomás', lines: ['Murió de una corriente de aire.', 'Como casi todos por acá.'] },
  grave_3: { kicker: 'Aquí yace', name: 'El bache de Errázuriz', lines: ['Tapado con un cartel que dice "bache tapado".', 'Se recomienda no comprobarlo.'] },
  grave_4: { kicker: 'Aquí yace', name: 'Don Ángel', lines: ['"Vuelvo en cinco minutos."', 'Sigue sin volver.'] },
  grave_5: { kicker: 'Aquí yace', name: 'La Ordenanza 26', lines: ['Rigió un día entero.', 'Derogada por la 31, que rige desde mañana.'] },
  grave_6: { kicker: 'Aquí yace', name: 'El semáforo', lines: ['En reparación desde 1998.', 'Descansa en verde. O en rojo. Nadie sabe.'] },
  grave_7: { kicker: 'Aquí yace', name: 'Ramón, portero', lines: ['Cuidó la puerta cuarenta años.', 'Nadie entró. Nadie salió.'] },
  grave_8: { kicker: 'Aquí yace', name: 'El turno 047', lines: ['Esperó su llamado con paciencia.', 'Lo llamaron. Ya había cerrado la ventanilla.'] },
  grave_9: { kicker: 'Aquí yace', name: 'Una habilitación', lines: ['En trámite desde hace ocho meses.', 'Resucitará mañana.'] },
  grave_10: { kicker: 'Aquí yace', name: 'El viento del oeste', lines: ['No murió: sopla.', '(La placa se puso por las dudas.)'] },
  monument: { kicker: 'En memoria', name: 'De los que esperan', lines: ['A los vecinos que esperan su turno.', 'Placa en restauración desde 2019.'] },
  grave_dog: { kicker: 'Aquí yace', name: 'Pelusa', lines: ['Fue una perra extraordinaria.', 'Un poco ventosa.', 'En esta ciudad, un mérito.'] },
  desk: { kicker: 'Sobre el escritorio', name: 'Expedientes', lines: ['Tres carpetas, un mate frío y un cartel:', '"Vuelvo en cinco minutos."', 'La tinta del cartel ya es fósil.'] },
  chest: { kicker: 'Un cofre', name: 'Con calavera', lines: ['Adentro no hay tesoro.', 'Hay formularios. Todos en blanco.', 'El más valioso dice "Original".'] },
  coffin: { kicker: 'Descanso', name: 'Ocupado', lines: ['Un esqueleto duerme como si nada.', 'Tiene pegada una nota:', '"Falta un sello."'] },
};

/** Conversaciones (formato del motor de diálogos del juego 2D). Las líneas `do` las resuelve la historia. */
export const DIALOGUES: DialogueLibrary = {
  huesos_intro: [
    { who: 'huesos', text: '¡Un fantasma nuevo! Sentate, sentate. El fuego no calienta, pero queda lindo.' },
    { who: 'huesos', text: 'Yo soy Huesos. Antes era ingeniero civil. Ahora soy esqueleto civil: nadie me pide planos.' },
    {
      choice: [
        { text: '¿Dónde saco el Certificado de Descanso Eterno?', set: { pregunta: 'cert' } },
        { text: 'Vengo por mi habilitación de fantasma.', set: { pregunta: 'hab' } },
        { text: '¿Esto es la fila?', set: { pregunta: 'fila' } },
      ],
    },
    { who: 'huesos', text: 'Directo al grano. Me gusta. Eso se firma en la cripta, con Lutin.', if: 'pregunta=cert' },
    { who: 'huesos', text: '¿Habilitación? Acá todo está "en trámite". Hasta la muerte.', if: 'pregunta=hab' },
    { who: 'huesos', text: 'Es la fila, el fuego y la sala de espera. Todo en uno. Eficiencia.', if: 'pregunta=fila' },
    { who: 'huesos', text: 'Lutin es el escribano de la cripta. Sella todo. Pero hace treinta años que perdió el sello oficial.' },
    { who: 'huesos', text: 'La perra Pelusa lo enterró. Dice que lo escondió "para que no se pierda".' },
    { who: 'huesos', text: 'Hablale. Con Pelusa no se negocia: se le rasca la oreja.' },
    { who: 'huesos', text: 'Tomá una vela. Con esta luz, hasta el papeleo se ve claro.' },
    { do: 'give_candle' },
    { set: { huesos_met: true } },
  ],
  huesos_again: [
    { who: 'huesos', text: '¿Ya hablaste con Pelusa? Anda por el cerco de su tumba. No la mires fijo: se emociona.' },
    { who: 'huesos', text: 'Y cuando tengas el sello, la cripta es esa casita con techo de pizarra. Puerta de madera, sin timbre.' },
  ],
  huesos_seal: [
    { who: 'huesos', text: '¡Ése es el sello! Oxidado, pero sello al fin. Como yo: oxidado, pero esqueleto al fin.' },
    { who: 'huesos', text: 'Llevaselo a Lutin. Y si te pide un formulario, decile que lo perdiste. Es lo que se hace.' },
  ],
  huesos_done: [
    { who: 'huesos', text: 'Te vi salir de la cripta con el certificado. Felicitaciones.' },
    { who: 'huesos', text: 'Rige desde mañana, ¿no? Eso es buena señal: lo que rige desde mañana, algún día rige.' },
  ],
  pelusa_before: [
    { who: null, text: 'Pelusa da vueltas alrededor tuyo. Huele un poco a tormenta.' },
    { who: null, text: 'Te mira con la cabeza torcida. Parece que espera que alguien le pregunte algo importante.' },
  ],
  pelusa_ask: [
    { who: null, text: 'Pelusa te mira. Te huele. Decide que sos de confianza.' },
    {
      choice: [
        { text: '¿Dónde enterraste el sello, Pelusa?', set: { trato: 'sello' } },
        { text: 'Buena perra. ¿Querés que te rasque la oreja?', set: { trato: 'oreja' } },
      ],
    },
    { who: null, text: 'Pelusa ladra tres veces. Quiere decir: "Seguime, que yo sé."', if: 'trato=sello' },
    { who: null, text: 'Pelusa cierra los ojos, suelta un suspiro y, de pura felicidad, larga un "pff". Nadie dice nada.', if: 'trato=oreja' },
    { who: null, text: 'Después sale corriendo hacia el árbol seco del costado oeste.' },
    { do: 'dog_lead' },
  ],
  pelusa_after: [
    { who: null, text: 'Pelusa se sienta a tu lado y mira el fuego como si hubiera resuelto todo ella sola.' },
    { who: null, text: 'Se le escapa otro "pff". Hoy no se habla del tema.' },
  ],
  lutin_noseal: [
    { who: 'lutin', text: 'Turno 47… ¿o 48? Da lo mismo: no tengo sello.' },
    { who: 'lutin', text: 'Sin sello no hay trámite. Sin trámite no hay descanso. Sin descanso… bueno, ya ves: sos un fantasma.' },
    { choice: [{ text: '¿Y dónde consigo el sello?' }, { text: 'Puedo esperar. Tengo toda la eternidad.' }] },
    { who: 'lutin', text: 'Preguntale a Huesos, el de la fogata. Él sabe. Él siempre sabe. Nadie le pregunta.' },
    { who: 'lutin', text: 'Volvé cuando lo tengas. Si cierro, dejame un formulario.' },
  ],
  lutin_stamp: [
    { who: 'lutin', text: '¡El sello! ¡Mi sello! Lo busqué en cuatro expedientes y dos siglos.' },
    { who: 'lutin', text: 'Veamos: Formulario 26-B… no lo tengo. Tasa de Emisión de Boleta… tampoco. Pero el sello, sí.' },
    {
      choice: [
        { text: 'Selle, por favor.', set: { resp: 'a' } },
        { text: '¿Con el sello solo alcanza?', set: { resp: 'b' } },
        { text: '¿Y la tasa para pagar la tasa?', set: { resp: 'c' } },
      ],
    },
    { who: 'lutin', text: 'Con gusto. Hoy es día de excepciones.', if: 'resp=a' },
    { who: 'lutin', text: 'Alcanza. Pero rige desde mañana. Las cosas buenas se hacen esperar.', if: 'resp=b' },
    { who: 'lutin', text: 'Esa se cobra en la otra vida. Ya la pagaste: por eso estás acá.', if: 'resp=c' },
    { do: 'stamp' },
    { who: 'lutin', text: 'Certificado de Descanso Eterno, número cero cero cero uno. Vigencia: a partir de las cero horas de mañana.' },
    { who: 'player', text: '¿Mañana?' },
    { who: 'lutin', text: 'Como todo en esta ciudad: vale desde mañana.' },
    { who: 'lutin', text: 'Descansá. O seguí flotando. Nadie te va a controlar.' },
    { do: 'finish' },
  ],
  lutin_done: [
    { who: 'lutin', text: 'Seguí flotando tranquilo. Tu certificado vale desde mañana.' },
    { who: 'lutin', text: 'Yo vuelvo en cinco minutos.' },
  ],
};
