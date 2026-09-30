import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './styles/game.css';
import Phaser from 'phaser';
import { engine } from './engine/core/Engine';
import { BootScene } from './engine/core/BootScene';
import { WorldScene } from './engine/world/WorldScene';
import { InteriorScene } from './engine/interior/InteriorScene';
import { content } from './content';
import { installDebugTools } from './engine/core/debug';

const params = new URLSearchParams(location.search);

// ?timer (QA): bucle por setTimeout en lugar de requestAnimationFrame (útil en ventanas sin foco).
const forceTimer = params.has('timer');

// Respaldo de render: si WebGL falla al arrancar (GPU o driver flojos), se recarga una vez con Canvas 2D.
// ?renderer=canvas lo fuerza (QA).
const STORE = 'vec-renderer';
const store = {
  get: (): string | null => {
    try {
      return sessionStorage.getItem(STORE);
    } catch {
      return null;
    }
  },
  set: (v: string): void => {
    try {
      sessionStorage.setItem(STORE, v);
    } catch {
      /* sin almacenamiento: el respaldo no se recuerda */
    }
  },
};
const useCanvas = params.get('renderer') === 'canvas' || store.get() === 'canvas';
let booted = false;
window.addEventListener('vec:booted', () => (booted = true));
window.addEventListener('error', (ev) => {
  if (booted || useCanvas) return;
  if (!/framebuffer|webgl|shader|gl_|texture/i.test(`${ev.message} ${(ev.error as Error | undefined)?.stack ?? ''}`)) return;
  console.warn('[Render] WebGL falló al arrancar; paso a Canvas 2D', ev.message);
  store.set('canvas');
  location.reload();
});

// Canvas en resolución de arte (baja) escalado sin suavizado por CSS: pixel-perfect y liviano en móvil.
const game = new Phaser.Game({
  type: useCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: 300,
  height: 600,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  backgroundColor: '#6f7466',
  scale: { mode: Phaser.Scale.NONE },
  render: { powerPreference: 'high-performance', antialiasGL: false, pixelArt: true, roundPixels: true },
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  audio: { noAudio: true },
  banner: false,
  fps: { target: 60, forceSetTimeOut: forceTimer },
  scene: [BootScene, WorldScene, InteriorScene],
});

engine.init(game, content);
installDebugTools();

// Si se pierde el contexto WebGL en pleno juego y no vuelve, se recarga con Canvas (el guardado por escena permite continuar).
game.events.once('ready', () => {
  const cv = game.canvas;
  let timer = 0;
  cv.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      store.set('canvas');
      location.reload();
    }, 2500);
  });
  cv.addEventListener('webglcontextrestored', () => window.clearTimeout(timer));
});
