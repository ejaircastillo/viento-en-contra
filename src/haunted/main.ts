import './ui/haunted.css';
import { App } from './core/app';
import { Input } from './core/input';
import { Game } from './game/game';

/**
 * Arranque de "Fantasma en trámite": renderer three.js + postproceso, el mundo (cementerio y cripta), la
 * historia y la interfaz. Parámetros útiles: ?q=low|medium|high (calidad), ?pr=1 (densidad de píxeles),
 * ?timer (bucle por setTimeout para QA), ?skipintro (sin tarjeta inicial).
 */
const loading = document.getElementById('loading')!;
const msg = loading.querySelector('.msg') as HTMLElement;
const bar = loading.querySelector('.bar i') as HTMLElement;
const step = (p: number, text: string) =>
  new Promise<void>((r) => {
    bar.style.width = `${p}%`;
    msg.textContent = text;
    setTimeout(r, 24); // un setTimeout alcanza para ceder el hilo (requestAnimationFrame se frena con la pestaña oculta)
  });

async function boot(): Promise<void> {
  await step(8, 'Encendiendo las velas…');
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const app = new App(canvas);
  const input = new Input(document.getElementById('haunted')!);
  await step(30, 'Pintando el cementerio…');
  const game = new Game(app, input);
  await step(80, 'Despertando a los vecinos…');
  // compila los shaders de las dos áreas antes del primer cuadro para evitar tirones al cruzar la puerta
  app.scene.add(game.crypt.group);
  app.renderer.compile(app.scene, app.rig.camera);
  app.scene.remove(game.crypt.group);
  await step(96, 'Casi listo…');
  app.start();
  (window as unknown as { __game: Game; __app: App }).__game = game;
  (window as unknown as { __app: App }).__app = app;
  if (new URLSearchParams(location.search).has('skipintro')) {
    loading.classList.add('done');
    game.story.start();
    return;
  }
  // pantalla de inicio: espera un toque o una tecla (eso desbloquea el sonido y la voz, así la tarjeta inicial ya se lee)
  loading.classList.add('ready');
  await new Promise<void>((resolve) => {
    const go = () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
      game.sound.unlock();
      game.speech.unlock();
      resolve();
    };
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  });
  loading.classList.add('done');
  setTimeout(() => game.begin(), 400);
}

boot().catch((e) => {
  console.error(e);
  msg.textContent = 'No se pudo iniciar el 3D en este navegador (¿WebGL desactivado?).';
});
