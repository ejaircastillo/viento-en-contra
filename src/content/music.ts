import type { Track } from '../engine/audio/AudioEngine';

/**
 * Música placeholder (chiptune/synthwave discreto). Notación: un token por paso,
 * nota ("A4"), "-" = sostener, "." = silencio. Percusión: "x" = golpe.
 * Nombres de canciones y bandas: ficticios (para la radio).
 */

const hold = (note: string, steps: number) => [note, ...Array(steps - 1).fill('-')].join(' ');
const rest = (n: number) => Array(n).fill('.').join(' ');
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
const cat = (...p: string[]) => p.join(' ');
const arp = (notes: string[], steps: number) => Array.from({ length: steps }, (_, i) => notes[i % notes.length]).join(' ');

export const tracks: Track[] = [
  {
    id: 'title',
    title: 'Viento en contra (tema)',
    bpm: 80,
    channels: [
      { inst: 'pad', notes: cat(hold('A3', 16), hold('F3', 16), hold('C4', 16), hold('E3', 16)), vol: 0.9 },
      { inst: 'pad', notes: cat(hold('E4', 16), hold('C4', 16), hold('G4', 16), hold('B3', 16)), vol: 0.6 },
      {
        inst: 'arp',
        notes: cat(arp(['A4', 'C5', 'E5', 'C5'], 16), arp(['F4', 'A4', 'C5', 'A4'], 16), arp(['C5', 'E5', 'G5', 'E5'], 16), arp(['E4', 'G#4', 'B4', 'G#4'], 16)),
        vol: 0.8,
      },
      { inst: 'bass', notes: cat(hold('A2', 8), hold('A2', 8), hold('F2', 8), hold('F2', 8), hold('C3', 8), hold('C3', 8), hold('E2', 8), hold('E2', 8)), vol: 0.8 },
      {
        inst: 'bell',
        notes: cat(rest(8), 'E5 . . . D5 . C5 .', rest(8), 'A4 . . . C5 . . .', rest(8), 'G5 . . . E5 . D5 .', rest(8), 'B4 - - - - - - -'),
        vol: 0.7,
      },
    ],
  },
  {
    id: 'drive1',
    title: '"Ráfaga de amor" — Los Coironcitos',
    bpm: 112,
    channels: [
      { inst: 'bass', notes: cat(rep('A2 . A3 . A2 . A3 .', 2), rep('F2 . F3 . F2 . F3 .', 2), rep('C3 . C4 . C3 . C4 .', 2), rep('G2 . G3 . G2 . G3 .', 2)), vol: 0.9 },
      { inst: 'kick', notes: rep('x . . . x . . . x . . . x . . .', 4) },
      { inst: 'snare', notes: rep('. . . . x . . . . . . . x . . .', 4), vol: 0.8 },
      { inst: 'hat', notes: rep('x . x . x . x . x . x . x . x .', 4), vol: 0.7 },
      {
        inst: 'lead',
        notes: cat(
          'E5 - - . C5 . D5 . E5 - . . G5 . E5 .',
          'F5 - - . E5 . D5 . C5 - - - . . . .',
          'E5 - - . G5 . A5 . G5 - . . E5 . C5 .',
          'D5 - - - - - . . B4 - - - . . . .',
        ),
        vol: 0.9,
      },
    ],
  },
  {
    id: 'drive2',
    title: '"Cumbia del bache" — Grupo Estepa',
    bpm: 96,
    spb: 4,
    channels: [
      { inst: 'bass', notes: rep(cat('D3 . . D3 . . A2 .', 'D3 . . D3 . . A2 .', 'G2 . . G2 . . D3 .', 'A2 . . A2 . . E3 .'), 1), vol: 0.9 },
      { inst: 'hat', notes: rep('. . x . . . x . . . x . . . x .', 2), vol: 0.9 },
      { inst: 'snare', notes: rep('. . . . x . . . . . . . x . x .', 2), vol: 0.6 },
      { inst: 'kick', notes: rep('x . . . . . . . x . . . . . . .', 2) },
      {
        inst: 'pluck',
        notes: cat('F5 . A5 . F5 . D5 .', 'E5 . F5 . E5 . D5 .', 'B4 . D5 . G5 . F5 .', 'E5 . C#5 . A4 . . .'),
        vol: 0.9,
      },
    ],
  },
  {
    id: 'drive3',
    title: '"Sensación térmica" — Dúo Alambrado',
    bpm: 104,
    channels: [
      { inst: 'bass', notes: cat('A2 . . A2 . . E3 .', 'A2 . . A2 . . E3 .', 'F2 . . F2 . . C3 .', 'G2 . . G2 . . D3 .'), vol: 0.9 },
      { inst: 'kick', notes: rep('x . . . . . x . x . . . . . . .', 2) },
      { inst: 'snare', notes: rep('. . . . x . . . . . . . x . . x', 2), vol: 0.7 },
      { inst: 'hat', notes: rep('. x . x', 8), vol: 0.6 },
      { inst: 'pad', notes: cat(hold('A3', 8), hold('A3', 8), hold('F3', 8), hold('G3', 8)), vol: 0.5 },
      { inst: 'pluck', notes: cat('C5 . E5 . A4 . . .', 'B4 . D5 . G4 . . .', 'A4 . C5 . F4 . . .', 'G4 . B4 . D5 . E5 .'), vol: 0.85 },
    ],
  },
  {
    id: 'feria',
    title: 'Marchita de la feria (con banda de gestión)',
    bpm: 118,
    channels: [
      { inst: 'bass', notes: cat('C2 . G2 . C2 . G2 .', 'F2 . C3 . F2 . C3 .', 'G2 . D3 . G2 . D3 .', 'C2 . G2 . C2 . G2 .'), vol: 0.9 },
      { inst: 'kick', notes: rep('x . . . x . . . x . . . x . . .', 2) },
      { inst: 'snare', notes: rep('. . x . . . x . . . x . . . x .', 2), vol: 0.6 },
      { inst: 'lead', notes: cat('E5 . E5 . G5 . E5 .', 'F5 . F5 . A5 . F5 .', 'G5 . E5 . D5 . C5 .', 'E5 . D5 . C5 - - .'), vol: 0.8 },
      { inst: 'bell', notes: cat(rest(6), 'C6 .', rest(6), 'A5 .', rest(6), 'G5 .', rest(6), 'E5 .'), vol: 0.45 },
    ],
  },
  {
    id: 'interior',
    title: 'Espera (música funcional)',
    bpm: 90,
    channels: [
      { inst: 'pluck', notes: cat('C4 . E4 . G4 . . .', 'A3 . C4 . E4 . . .', 'D4 . F4 . A4 . . .', 'G3 . B3 . D4 . . .'), vol: 0.55 },
      { inst: 'bass', notes: cat(hold('C3', 8), hold('A2', 8), hold('D3', 8), hold('G2', 8)), vol: 0.45 },
      { inst: 'hat', notes: rep('. . x . . . x .', 4), vol: 0.35 },
      { inst: 'bell', notes: cat(rest(6), 'E5 .', rest(6), 'C5 .', rest(6), 'F5 .', rest(6), 'D5 .'), vol: 0.35 },
    ],
  },
  {
    id: 'ending',
    title: 'Continuará',
    bpm: 70,
    channels: [
      { inst: 'pad', notes: cat(hold('D4', 16), hold('A3', 16), hold('B3', 16), hold('G3', 16)), vol: 0.9 },
      { inst: 'bell', notes: cat('F5 . . . E5 . . . D5 . . . A4 . . .', 'C5 . . . E5 . . . A5 - - - . . . .', 'B4 . . . D5 . . . F#5 . . . E5 . . .', 'D5 - - - - - - - . . . . . . . .'), vol: 0.8 },
      { inst: 'bass', notes: cat(hold('D2', 16), hold('A2', 16), hold('B2', 16), hold('G2', 16)), vol: 0.6 },
    ],
  },
];
