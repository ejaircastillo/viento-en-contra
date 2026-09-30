import type { RadioLibrary } from '../../engine/radio/RadioStation';

/**
 * Radio 89 — textos de trabajo (spec §11, §30). Regla: la radio informa, el personaje reacciona.
 * Titulares breves; todo es ficticio (instituciones genéricas, sin nombres reales).
 */
export const radio: RadioLibrary = {
  station: 'Radio 89 · FM 89.0',
  items: {
    r_id: { id: 'r_id', kind: 'jingle', text: 'Radio 89, FM 89.0. La que se escucha aunque sople.' },
    r_tiempo: {
      id: 'r_tiempo',
      kind: 'weather',
      text: 'Son las siete y cuarenta. Hace dos grados, sensación térmica de seis bajo cero. Viento del oeste a 60, con ráfagas de 90.',
      react: { municipal: 'Un día tranquilo, entonces.', emprendedor: 'Viento del oeste: si el cartel del kiosco se suelta, termina en el Atlántico.' },
    },
    r_transito_sm: {
      id: 'r_transito_sm',
      kind: 'traffic',
      text: 'Tránsito: choque en Roca y San Martín. El semáforo de esa esquina funciona de manera intermitente desde marzo.',
      react: { municipal: 'Desde marzo. Estamos en septiembre.', emprendedor: 'Desde marzo, dice. Como mi trámite.' },
    },
    r_an_ad: {
      id: 'r_an_ad',
      kind: 'ad',
      text: '¿Te falta algo? Acá Nomás: todo lo que necesitás, a una cuadra. ¡Nueva sucursal 15, en la ex farmacia de Errázuriz!',
      react: { municipal: 'Otra más. Ya no me acuerdo dónde había una farmacia.', emprendedor: 'Si abren uno por cuadra, ¿quién me compra un alfajor?' },
    },
    r_deportes: {
      id: 'r_deportes',
      kind: 'sports',
      text: 'Deportes: se suspendió el partido de Viento Norte. Motivo: viento.',
      react: { all: 'Tiene lógica.' },
    },
    r_paro: {
      id: 'r_paro',
      kind: 'news',
      text: 'El gremio docente confirmó un paro de 48 horas. El comunicado se difundió anoche, a las 23:47.',
      react: { municipal: '¿Cuarenta y ocho horas? Mañana también.', emprendedor: 'Mañana también. Y el kiosco no se atiende solo.' },
    },
    r_pp_cd2: {
      id: 'r_pp_cd2',
      kind: 'news',
      text: 'Patagonia Puede informó que el Centro de Distribución 2 estará operativo antes que el Centro de Distribución 1, que sigue en etapa de proyecto.',
      react: { all: 'Lógico. Primero el dos.' },
    },
    r_alerta: {
      id: 'r_alerta',
      kind: 'weather',
      text: 'Alerta amarilla por viento: ráfagas de hasta 110 kilómetros por hora. Se recomienda asegurar carteles y objetos sueltos.',
      react: { municipal: 'Asegurar carteles. Mirá vos.', emprendedor: 'Mi cartel está pegado con cinta. Cinta buena.' },
    },
    r_ordenanza: {
      id: 'r_ordenanza',
      kind: 'news',
      text: 'El Concejo Deliberante aprobó anoche, por unanimidad, la ordenanza de Resistencia Eólica de Cartelería. Rige desde hoy.',
      react: { municipal: '¿Desde hoy? A nosotros nadie nos avisó nada.', emprendedor: 'Mientras no sea para los kioscos…' },
    },
    r_pp_digital: {
      id: 'r_pp_digital',
      kind: 'news',
      text: 'Nace Patagonia Puede Digital, que digitalizará los trámites. El sistema de turnos online estará disponible próximamente.',
      react: { municipal: 'Si digitalizan todo, ¿yo qué hago?', emprendedor: 'Próximamente. Como mi habilitación.' },
    },
    r_tasa: {
      id: 'r_tasa',
      kind: 'news',
      text: 'El municipio recordó que este mes comienza a regir la Tasa de Mantenimiento Semafórico.',
      react: { municipal: '…¿Qué tasa?', emprendedor: 'Una tasa para el semáforo. Justo el que no anda.' },
    },
    r_bache: {
      id: 'r_bache',
      kind: 'traffic',
      text: 'Tránsito: vecinos autoconvocados cortan Errázuriz entre Roca y Alcorta. Reclaman que tapen el bache.',
      react: { municipal: 'Cortan la calle del bache para que arreglen el bache.', emprendedor: 'Al menos ahí nadie se cae en el bache.' },
    },
    r_futuro1: {
      id: 'r_futuro1',
      kind: 'news',
      text: 'Agenda: el sábado habrá feria de emprendedores en la costanera. Inscripciones en la Municipalidad.',
      react: { municipal: 'Feria de emprendedores. Me van a mandar a controlar.', emprendedor: 'Inscripción en la Muni. Seguro piden habilitación.' },
    },
    r_futuro2: {
      id: 'r_futuro2',
      kind: 'news',
      text: 'Patagonia Puede Hogar anunció un plan de viviendas que comenzará cuando se inaugure el Centro de Distribución 3.',
      react: { all: 'Ahora hay un tres.' },
    },
    r_ultimo: {
      id: 'r_ultimo',
      kind: 'flash',
      text: 'Último momento: el gremio docente informó que el paro se extiende hasta el viernes.',
    },
    m_drive1: { id: 'm_drive1', kind: 'music', track: 'drive1', seconds: 24 },
    m_drive2: { id: 'm_drive2', kind: 'music', track: 'drive2', seconds: 22 },
  },
  programs: {
    drive1: ['r_id', 'r_tiempo', 'm_drive1', 'r_an_ad', 'r_deportes'],
    drive2: ['r_paro', 'm_drive2', 'r_pp_cd2', 'r_alerta'],
    drive3: ['r_ordenanza', 'r_pp_digital', 'm_drive1', 'r_tasa', 'r_futuro1', 'r_futuro2'],
    drive4: ['r_futuro2', 'm_drive2', 'r_futuro1'],
  },
  filler: ['m_drive1', 'r_id', 'm_drive2'],
};
