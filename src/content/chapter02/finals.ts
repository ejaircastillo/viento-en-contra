import type { DialogueLibrary } from '../../engine/dialogue/Dialogue';

/**
 * Escena final del Capítulo 2: el kiosco, a las once. La viven los dos protagonistas, cada uno desde su lado.
 * Cada punto de vista va en 3 tramos; entre ellos el guion pone la radio (ordenanza derogada) y el llamado de Ponce.
 */
export const finalDialogues: DialogueLibrary = {
  // ---------------------------------------------------------------- Diego (llega con Tomi)
  final_municipal_1: [
    { who: 'elba', text: 'Pase, pase. ¿Usted es el de las once?' },
    { who: 'player', text: 'Diego Barría, Habilitaciones. Vengo a inspeccionar el kiosco.' },
    { who: 'nahuel', text: '¡Diego! ¡Llegué! Llegué con todo. Todo, todo.' },
    { who: 'benja', text: '¡Tomi! ¡Viniste!' },
    { who: 'tomi', text: '¡Benja! ¡Vine con el inspector!' },
    { who: 'benja', text: '¡Yo estoy con la dueña!' },
    { who: 'elba', text: 'Son de la misma escuela. Los juntó el paro.' },
    { who: 'player', text: 'Veamos: sistema de actas.' },
    { do: 'tablet' },
    { who: 'player', text: 'Noventa y siete por ciento. Llevo tres horas en el noventa y siete.' },
    { who: 'nahuel', text: 'Yo llevo ocho meses en el noventa y siete. Somos parecidos.' },
    { who: 'player', text: 'Muéstreme el certificado.' },
    { do: 'certificate' },
    { who: 'player', text: '"Vigencia: a partir de las cero horas de mañana."' },
    { who: 'nahuel', text: '¿Mañana? ¡Salió hoy!' },
    { who: 'player', text: 'Sí. Pero vale desde mañana.' },
    { who: 'elba', text: 'Como todo en esta ciudad: vale desde mañana.' },
    {
      choice: [
        { tone: 'estricto', text: 'Labrar el acta: hoy no tiene certificado vigente.', set: { d_final: 'acta' } },
        { tone: 'humano', text: 'Dejar constancia: el certificado existe. Sólo llegó temprano.', set: { d_final: 'constancia' } },
        { tone: 'irónico', text: 'Volver a las cero horas de mañana. Con la meta cumplida por ausencia.', set: { d_final: 'esperar' } },
      ],
    },
    { who: 'nahuel', text: '¿Un acta? ¡Con el certificado en la mano!', if: 'd_final=acta' },
    { who: 'player', text: 'Reglamento. Firmo y me voy.', if: 'd_final=acta' },
    { do: 'acta_paper', if: 'd_final=acta' },
    { who: 'elba', text: 'Firme, joven. Acá todos firmamos. Después vemos qué era.', if: 'd_final=acta' },
    { who: 'elba', text: 'Un hombre justo. Tome un mate. Está frío, pero es de corazón.', if: 'd_final=constancia' },
    { who: 'nahuel', text: 'Gracias, Diego. De verdad.', if: 'd_final=constancia' },
    { who: 'nahuel', text: '¿Vuelve a las doce de la noche?', if: 'd_final=esperar' },
    { who: 'player', text: 'Puntual. Aunque lo único que no llega es la puntualidad.', if: 'd_final=esperar' },
    { who: 'elba', text: 'Shh. Escuchen la radio.' },
  ],
  final_municipal_2: [
    { who: 'nahuel', text: '¿Sísmica? ¿Acá?' },
    { who: 'elba', text: 'Acá tiembla cuando llega la boleta.' },
  ],
  final_municipal_3: [
    { who: 'tomi', text: 'Papá, ¿qué es sísmica?' },
    { who: 'player', text: 'Cuando tiembla la tierra.' },
    { who: 'tomi', text: '¿Y acá tiembla?' },
    { who: 'nahuel', text: 'Sólo cuando llega el inspector.' },
    { who: 'player', text: 'Mañana, entonces.' },
    { who: 'nahuel', text: 'Mañana. Con turno.' },
    { who: 'elba', text: 'Con abrigo.' },
  ],

  // ---------------------------------------------------------------- Nahuel (Diego llega con Tomi)
  final_emprendedor_1: [
    { who: 'elba', text: 'Nahuel, llegaste. ¿Y el certificado?' },
    { who: 'player', text: 'Acá está. Sellado a las nueve cincuenta y nueve.' },
    { who: 'benja', text: '¡Papi! ¡Viene el inspector! ¡Viene con un nene!' },
    { do: 'diego_arrives' },
    { who: 'diego', text: 'Buenas. Diego Barría, Habilitaciones. Es la hora.' },
    { who: 'tomi', text: '¡Benja! ¡Vine con el inspector!' },
    { who: 'benja', text: '¡Yo estoy con la dueña!' },
    { who: 'elba', text: 'Son de la misma escuela. Los juntó el paro.' },
    { who: 'diego', text: 'Veamos. Sistema de actas.' },
    { do: 'tablet' },
    { who: 'diego', text: 'Noventa y siete por ciento. Llevo tres horas en el noventa y siete.' },
    { who: 'player', text: 'Yo llevo ocho meses en el noventa y siete. Somos parecidos.' },
    { who: 'diego', text: 'Muéstreme el certificado.' },
    { do: 'certificate' },
    { who: 'diego', text: '"Vigencia: a partir de las cero horas de mañana."' },
    { who: 'player', text: '¿Mañana? ¡Salió hoy!' },
    { who: 'diego', text: 'Sí. Pero vale desde mañana.' },
    { who: 'elba', text: 'Como todo en esta ciudad: vale desde mañana.' },
    {
      choice: [
        { tone: 'firme', text: '"La ordenanza dice: vigente desde su publicación. La publicaron ayer."', set: { n_final: 'ley' } },
        { tone: 'humano', text: '"Diego, dame hasta mañana. Es sólo un día."', set: { n_final: 'tiempo' } },
        { tone: 'amable', text: 'Ofrecerle un mate. Bien caliente. Con la estufa sin gas.', set: { n_final: 'mate' } },
      ],
    },
    { who: 'diego', text: 'Cierto. Pero el certificado dice otra cosa. Y manda el certificado.', if: 'n_final=ley' },
    { who: 'player', text: '¿O sea que la ley dice una cosa y el papel otra?', if: 'n_final=ley' },
    { who: 'diego', text: 'O sea que estamos en la Municipalidad.', if: 'n_final=ley' },
    { who: 'diego', text: 'Un día. Sí, se puede. Anoto: "en observación".', if: 'n_final=tiempo' },
    { who: 'elba', text: 'El que anota, perdona. Es la ley de Dios y de la Muni.', if: 'n_final=tiempo' },
    { who: 'diego', text: 'Gracias. Está frío, pero es de corazón. Acepto.', if: 'n_final=mate' },
    { who: 'elba', text: 'Eso no cuenta como soborno: es hospitalidad.', if: 'n_final=mate' },
    { who: 'diego', text: 'Cuenta como hospitalidad. Anotado.', if: 'n_final=mate' },
    { who: 'elba', text: 'Shh. Escuchen la radio.' },
  ],
  final_emprendedor_2: [
    { who: 'player', text: '¿Sísmica? ¿Acá?' },
    { who: 'elba', text: 'Acá tiembla cuando llega la boleta.' },
  ],
  final_emprendedor_3: [
    { who: 'tomi', text: 'Papá, ¿qué es sísmica?' },
    { who: 'diego', text: 'Cuando tiembla la tierra.' },
    { who: 'benja', text: '¿Y acá tiembla?' },
    { who: 'player', text: 'Sólo cuando llega el inspector.' },
    { who: 'diego', text: 'Mañana, entonces.' },
    { who: 'player', text: 'Mañana. Con turno.' },
    { who: 'elba', text: 'Con abrigo.' },
  ],

  // ---------------------------------------------------------------- el llamado de Ponce
  // Con el teléfono en la mano de Diego (su ruta) o desde el mostrador (la de Nahuel).
  final_ponce_call_municipal: [
    { who: 'ponce', text: 'Barría. Se derogó la 26. Todas las actas de hoy quedan sin efecto.' },
    { who: 'player', text: '¿Y las que están en el sistema?' },
    { who: 'ponce', text: 'Se anulan con un acta de anulación. Una por acta.' },
    { who: 'player', text: '¿Con qué formulario?' },
    { who: 'ponce', text: 'Con el nuevo. Que todavía no existe. Próximamente.' },
    { who: 'player', text: 'Licenciado, ¿y la meta de cinco?' },
    { who: 'ponce', text: 'La meta se mantiene. Cambió la ordenanza; la meta no.' },
  ],
  final_ponce_call_emprendedor: [
    { who: 'ponce', text: '(por teléfono) Barría. Se derogó la 26. Todas las actas de hoy quedan sin efecto.' },
    { who: 'diego', text: '¿Y las que están en el sistema?' },
    { who: 'ponce', text: '(por teléfono) Se anulan con un acta de anulación. Una por acta.' },
    { who: 'diego', text: '¿Con qué formulario?' },
    { who: 'ponce', text: '(por teléfono) Con el nuevo. Que todavía no existe. Próximamente.' },
    { who: 'diego', text: 'Licenciado, ¿y la meta de cinco?' },
    { who: 'ponce', text: '(por teléfono) La meta se mantiene. Cambió la ordenanza; la meta no.' },
  ],
};
