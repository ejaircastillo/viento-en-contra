import { defineConfig } from 'vite';

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
  },
  worker: {
    format: 'es',
  },
});
