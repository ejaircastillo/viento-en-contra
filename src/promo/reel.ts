import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './reel.css';
import { drawEscena, ESCENA_H, ESCENA_W } from './scene';

// Página de anuncio (promo.html): pinta la escena con los generadores del juego.
// Si el lienzo no existe (página cambiada), no hace nada: el resto del reel es HTML.
const lienzo = document.getElementById('escena') as HTMLCanvasElement | null;
const ctx = lienzo?.getContext('2d') ?? null;
if (lienzo && ctx) {
  lienzo.width = ESCENA_W;
  lienzo.height = ESCENA_H;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(drawEscena().toCanvas(1), 0, 0);
}
