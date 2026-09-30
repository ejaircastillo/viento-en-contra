import type { RadioLibrary } from '../../engine/radio/RadioStation';

/**
 * Radio 89 del jueves. Regla: la radio informa y el personaje reacciona. Titulares breves;
 * todo es ficticio (instituciones genéricas, sin nombres reales) y apunta a mecanismos, no a personas.
 */
export const radio: RadioLibrary = {
  station: 'Radio 89 · FM 89.0',
  items: {
    c2_id: { id: 'c2_id', kind: 'jingle', text: 'Radio 89, FM 89.0. Hoy, con alerta naranja y mate caliente.' },
    c2_alerta: {
      id: 'c2_alerta',
      kind: 'weather',
      text: 'Alerta naranja por viento: ráfagas de hasta 120. La Municipalidad recuerda que los trámites se mantienen abiertos durante el alerta.',
      react: { municipal: 'Los trámites se mantienen. Los empleados, en asamblea.', emprendedor: 'Se mantienen los trámites. Los carteles, no.' },
    },
    c2_feria: {
      id: 'c2_feria',
      kind: 'news',
      text: 'Hoy a las nueve se inaugura la Feria de Emprendedores en la costanera. Habrá palabras, corte de cinta y, si el viento lo permite, cinta.',
      react: { municipal: 'Si el viento lo permite.', emprendedor: 'Corte de cinta. Yo con cinta pego el cartel.' },
    },
    c2_feria_req: {
      id: 'c2_feria_req',
      kind: 'news',
      text: 'Para participar de la feria se exige habilitación. Los puestos quedan exceptuados por tres horas; la excepción por tres horas se tramita en treinta días.',
      react: { municipal: 'Esa excepción la redacté yo. Era un borrador.', emprendedor: 'Treinta días para tres horas.' },
    },
    c2_asamblea: {
      id: 'c2_asamblea',
      kind: 'news',
      text: 'Trabajadores municipales harán asamblea a las diez. La comuna informó que la atención al público se mantiene hasta que empiece.',
      react: { municipal: 'Hasta que empiece. Yo llego cuando termine.', emprendedor: 'A las diez. Falta poco. Muy poco.' },
    },
    c2_ordenanza: {
      id: 'c2_ordenanza',
      kind: 'news',
      text: 'La Ordenanza 26, de Resistencia Eólica de Cartelería, cumple su segundo día. El Concejo evalúa reglamentarla.',
      react: { municipal: '¿Reglamentarla? Si ya la aplicamos.', emprendedor: 'Reglamentada o no, yo la sufro.' },
    },
    c2_ascensor: {
      id: 'c2_ascensor',
      kind: 'news',
      text: 'Obras en la Municipalidad: el ascensor seguirá fuera de servicio hasta la inauguración del ascensor.',
      react: { all: 'Hasta la inauguración del ascensor.' },
    },
    c2_tasa_tasas: {
      id: 'c2_tasa_tasas',
      kind: 'news',
      text: 'Desde hoy rige la Tasa de Emisión de Boleta, necesaria para poder pagar las demás tasas.',
      react: { municipal: 'No la vi en el sistema. Todavía.', emprendedor: 'Una tasa para pagar las tasas. Genial.' },
    },
    c2_cd2: {
      id: 'c2_cd2',
      kind: 'news',
      text: 'Patagonia Puede informó un avance del tres por ciento en el Centro de Distribución 2, "en línea con el cronograma del cronograma".',
      react: { all: 'El cronograma del cronograma.' },
    },
    c2_audiencia: {
      id: 'c2_audiencia',
      kind: 'news',
      text: 'Audiencia pública por el Código de Edificación: el martes, 7:15, en la Sala a Definir. Se ruega llevar silla.',
      react: { municipal: 'Sala a definir. Como todo.', emprendedor: 'A esa hora yo abro el kiosco.' },
    },
    c2_bache: {
      id: 'c2_bache',
      kind: 'traffic',
      text: 'Tránsito: el bache de Errázuriz fue tapado con un cartel que dice "bache tapado". Se recomienda no comprobarlo.',
      react: { all: 'El cartel tapa el bache. Técnicamente.' },
    },
    c2_garrafa: {
      id: 'c2_garrafa',
      kind: 'news',
      text: 'Garrafa social: el programa "Calor en Movimiento" abrió inscripciones. Entrega estimada: el invierno que viene.',
      react: { municipal: 'El invierno que viene. Con suerte, este también.', emprendedor: 'Elba se congela hoy. El invierno que viene, ya veremos.' },
    },
    c2_paro: {
      id: 'c2_paro',
      kind: 'news',
      text: 'Segundo día de paro docente. La Provincia dice que es un tema de Nación; Nación, que es del Municipio; el Municipio, que es del viento.',
      react: { all: 'Es del viento. Como todo.' },
    },
    c2_an_ad: {
      id: 'c2_an_ad',
      kind: 'ad',
      text: 'Acá Nomás, sucursal 15: ¡hoy inauguración! Sorteo de una garrafa social. No incluye gas.',
      react: { municipal: 'Sin gas. Al menos son honestos.', emprendedor: 'Una garrafa sin gas. Justo para el kiosco.' },
    },
    c2_pp_digital: {
      id: 'c2_pp_digital',
      kind: 'news',
      text: 'Patagonia Puede Digital informa que el sistema de turnos online estará disponible próximamente, y que el turno para pedir turno se habilitará en treinta días.',
      react: { all: 'El turno para el turno.' },
    },
    c2_comision: {
      id: 'c2_comision',
      kind: 'news',
      text: 'Se creó la Comisión de Seguimiento de la Comisión de Seguimiento de Obras. Se reunirá cuando se defina dónde.',
      react: { municipal: 'Yo formo parte. Nadie me avisó.', emprendedor: 'Sala a definir, otra vez.' },
    },
    c2_sismica: {
      id: 'c2_sismica',
      kind: 'flash',
      text: 'Último momento: el Concejo derogó la Ordenanza 26 de Resistencia Eólica y aprobó la 31, de Resistencia Sísmica de Cartelería. Aclararon que la ciudad no es zona sísmica, pero que "es preventivo".',
    },
    m_drive1: { id: 'm_drive1', kind: 'music', track: 'drive1', seconds: 22 },
    m_drive2: { id: 'm_drive2', kind: 'music', track: 'drive2', seconds: 20 },
    m_drive3: { id: 'm_drive3', kind: 'music', track: 'drive3', seconds: 24 },
  },
  programs: {
    // Diego
    d1: ['c2_id', 'c2_alerta', 'c2_asamblea', 'm_drive3', 'c2_feria'],
    d2: ['c2_feria_req', 'c2_cd2', 'm_drive1', 'c2_comision', 'c2_paro'],
    d3: ['c2_bache', 'c2_an_ad', 'm_drive2', 'c2_audiencia'],
    d4: ['c2_garrafa', 'm_drive3', 'c2_tasa_tasas', 'c2_ordenanza'],
    // Nahuel
    n1: ['c2_id', 'c2_alerta', 'c2_feria', 'm_drive3', 'c2_feria_req'],
    n2: ['c2_asamblea', 'c2_ascensor', 'm_drive1', 'c2_tasa_tasas', 'c2_pp_digital'],
    n3: ['c2_garrafa', 'm_drive3', 'c2_paro', 'c2_ordenanza'],
  },
  filler: ['m_drive3', 'c2_id', 'm_drive1', 'm_drive2'],
};
