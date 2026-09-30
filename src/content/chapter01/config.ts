/**
 * Decisiones abiertas del Capítulo 1, centralizadas (spec §30): nombres, certificado, tasa,
 * horarios y remates. Son PROPUESTAS de la demo 0.1 para revisión — ver docs/DECISIONES.md.
 * Cambiar un valor acá cambia todos los textos que lo usan ({clave} en diálogos y radio).
 */
export const CONFIG = {
  vocab: {
    school: 'Escuela N° 38',
    kiosk: 'Kiosco El Refugio',
    kioskAddress: 'Fagnano 1180',
    certificate: 'Certificado de Resistencia Eólica de Cartelería',
    certificateShort: 'C.R.E.C.',
    ordinance: 'Ordenanza 26/2026',
    tasa: 'Tasa de Mantenimiento Semafórico',
    tasaEolica: 'Tasa de Evaluación Eólica',
    office: 'Obras Particulares',
    boss: 'Lic. Ponce',
    strikeTime: '23:47',
    inspectionTime: '08:30',
    chain: 'Acá Nomás',
    pp: 'Patagonia Puede',
    radio: 'Radio 89',
  },

  /** Ventanas del reloj tolerante por estado [mínimo, máximo] (ver GameClock). */
  clock: {
    rate: 0.1,
    start: '07:28',
  },

  /** Boleta de servicios municipales que intenta pagar Diego. */
  bill: {
    rows: [
      { label: 'Alumbrado, barrido y limpieza', value: '$ 14.900' },
      { label: 'Servicios sanitarios', value: '$ 9.320' },
      { label: 'Fondo de obras (cuota 7/12)', value: '$ 4.950' },
      { label: '**Tasa de Mantenimiento Semafórico** (nueva)', value: '$ 6.200', isNew: true },
      { label: 'Actualización por índice', value: '$ 3.100', isNew: true },
    ],
    total: 'TOTAL $ 38.470',
    lastMonth: 'Mes anterior: $ 29.800',
  },

  /** Documentos de la carpeta del kiosco. */
  documents: [
    { id: 'form', title: 'Formulario de solicitud', detail: 'Firmado en las 4 hojas' },
    { id: 'dni', title: 'DNI', detail: 'Fotocopia certificada' },
    { id: 'monotributo', title: 'Constancia de monotributo', detail: 'Categoría A, al día' },
    { id: 'contrato', title: 'Título de la vivienda', detail: 'A nombre de la madre + autorización' },
    { id: 'libredeuda', title: 'Libre deuda municipal', detail: 'Emitido el mes pasado' },
    { id: 'bromatologia', title: 'Certificado de bromatología', detail: 'Vence en diciembre' },
    { id: 'manipulador', title: 'Carnet de manipulador', detail: 'De alimentos, vigente' },
    { id: 'plano', title: 'Croquis del local', detail: '"Local": el frente de la casa' },
  ],

  ending: {
    municipal: 'Mañana: inspección en Fagnano 1180. Si no hay paro. Si no hay viento. Si llego.',
    emprendedor: 'Mañana: Obras Particulares, 2° piso. Previo pago. Si abre. Si llego.',
  } as Record<string, string>,

  credits:
    'Río Gallegos: Viento en Contra — Demo 0.1. Ciudad, personas, marcas e instituciones del juego son ficticias o satíricas; ' +
    'cualquier parecido con la mañana de cualquiera es pura coincidencia. Arte y sonido: placeholders generados por código.',
};
