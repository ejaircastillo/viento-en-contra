import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Decisiones:
// - base './' → el build funciona servido desde cualquier subcarpeta (hosting estático, itch.io, GitHub Pages).
// - publicDir 'assets' → los assets finales (PNG/OGG) y assets/manifest.json se sirven tal cual,
//   así un artista puede reemplazar un placeholder sin recompilar (ver assets/ASSET_MANIFEST.md).
export default defineConfig({
  base: './',
  publicDir: 'assets',
  server: {
    host: true,
    port: 5178,
    // Sin recarga automática: editar código no reinicia la partida en curso.
    // Para ver cambios, recargar la página a mano (la partida se retoma con "Continuar").
    hmr: false,
  },
  preview: {
    host: true,
    port: 5179,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    // dos páginas: el juego 2D (index.html) y el prototipo 3D con three.js (haunted.html)
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        haunted: fileURLToPath(new URL('./haunted.html', import.meta.url)),
      },
    },
  },
  worker: {
    format: 'es',
  },
});
