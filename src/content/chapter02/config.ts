import type { ClockMeaning } from '../../engine/timer/GameClock';
import { CONFIG as CH1 } from '../chapter01/config';

/**
 * Datos del Capítulo 2 centralizados (nombres, horarios, textos finales). PROPUESTAS de la demo:
 * se cambian acá sin tocar el motor ni los guiones. Ver docs/DECISIONES.md.
 */
export const CONFIG2 = {
  vocab: {
    ...CH1.vocab,
    ordinance2: 'Ordenanza 31/2026',
    certificate2: 'Certificado de Resistencia Sísmica de Cartelería',
    tasaBoleta: 'Tasa de Emisión de Boleta',
  },

  /** Reloj tolerante: ambos arrancan a las 8:00 del jueves. */
  clock: { start: '08:00', assembly: '10:00', inspection: '11:00' },

  /** Significado del reloj por personaje (cambia a mitad del capítulo con ctx.clockMeaning). */
  meaning: {
    municipal: { label: 'Asamblea 10:00', deadline: '10:00', lateLabel: 'Asamblea en curso', warnMinutes: 15 } as ClockMeaning,
    municipal_late: { label: 'Kiosco 11:00', deadline: '11:00', lateLabel: 'Tarde · +{m} min', warnMinutes: 15 } as ClockMeaning,
    emprendedor: { label: 'Obras cierra 10:00', deadline: '10:00', lateLabel: 'Cerró Obras', warnMinutes: 15 } as ClockMeaning,
    emprendedor_late: { label: 'Inspector 11:00', deadline: '11:00', lateLabel: '¿Ya llegó el inspector?', warnMinutes: 15 } as ClockMeaning,
  },

  /** Tarjetas del selector de personaje para este capítulo. */
  cards: {
    municipal: {
      role: 'Inspector de turno · Operativo "Comercio en Regla"',
      blurb: 'Meta de la Dirección: cinco actas antes del mediodía. Instrucción de arriba: la feria es "zona libre de actas". Hoy trabaja con Tomi en la camioneta.',
      timer: 'Asamblea 10:00',
    },
    emprendedor: {
      role: 'Kiosquero · en busca del certificado del cartel',
      blurb: 'Para el certificado necesita un ensayo, dos tasas, tres ventanillas y una firma. La asamblea cierra Obras a las diez. El inspector llega a las once.',
      timer: 'Obras cierra 10:00',
    },
  },

  ending: {
    municipal: 'Mañana: anular las actas de hoy con un acta de anulación. Si el sistema llega al 100 %.',
    emprendedor: 'Mañana: Certificado de Resistencia Sísmica. Río Gallegos no es zona sísmica. Rige desde hoy.',
  } as Record<string, string>,

  credits:
    'Río Gallegos: Viento en Contra — Demo 0.2. Ciudad, personas, marcas e instituciones del juego son ficticias o satíricas; ' +
    'la sátira apunta a mecanismos (tasas, trámites, ceremonias, jurisdicciones), no a personas ni partidos. Arte y sonido: placeholders generados por código.',
};
