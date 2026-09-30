import type { ContentPack } from '../engine/mission/types';
import { characters } from './characters';

/**
 * Registro de contenido. Para agregar un capítulo: crear src/content/chapterNN/, sumarlo a `chapters`
 * y a `chapterInfo` (ver docs/GUIA_NUEVO_CAPITULO.md). El motor no necesita cambios.
 * Los capítulos se cargan bajo demanda (import dinámico → chunk separado en el build).
 */
export const content: ContentPack = {
  characters,
  chapters: {
    ch01: () => import('./chapter01').then((m) => m.default),
    ch02: () => import('./chapter02').then((m) => m.default),
    // plantilla mínima para el Capítulo 3 (no está en la lista del título; se abre con ?chapter=ch03_plantilla)
    ch03_plantilla: () => import('./chapter03_plantilla').then((m) => m.default),
  },
  firstChapter: 'ch01',
  chapterInfo: [
    { id: 'ch01', number: 1, title: 'Viento en contra', subtitle: 'Miércoles: paro sorpresa, choque y tasa nueva' },
    { id: 'ch02', number: 2, title: 'Horario de atención', subtitle: 'Jueves: feria, ensayo, asamblea y ordenanza' },
  ],
  demoLabel: 'Demo 0.2 · Capítulos 1 y 2',
};
