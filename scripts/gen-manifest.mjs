// Genera assets/ASSET_MANIFEST.md a partir de assets/manifest.json (fuente de verdad).
// Uso: npm run manifest
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'assets', 'manifest.json'), 'utf8'));

const CATS = {
  characters: 'Personajes',
  vehicles: 'Vehículos',
  environments: 'Entornos y props',
  brands: 'Marcas ficticias',
  ui: 'Interfaz',
  audio: 'Audio',
  documents: 'Documentos',
};

const esc = (s) => String(s ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');

let md = `# ASSET MANIFEST — Río Gallegos: Viento en Contra (Demo 0.2)

> Generado desde \`assets/manifest.json\` con \`npm run manifest\`. No editar a mano: editar el JSON.

## Cómo reemplazar un placeholder (sin tocar lógica)

1. Exportar la plantilla del placeholder: en el juego con \`?debug\`, abrir la consola y ejecutar
   \`__vec.keys()\` (lista de claves) y \`__vec.png('char.municipal')\` (PNG con el layout exacto).
2. Dibujar el arte final respetando **tamaño de cuadro, orden de cuadros y ancla** indicados abajo.
3. Guardar el archivo en \`assets/<ruta>\` (por ejemplo \`assets/characters/municipal.png\`).
4. En \`assets/manifest.json\`: poner \`"status": "final"\`, \`"source": "file"\` y el \`"path"\`.
   Para una clave de familia (\`veh:*\`, \`bld:*\`, \`prop:*\`), agregar una entrada nueva con la **clave exacta**
   (la muestra \`__vec.keys()\`).
5. Recargar. El registro de assets carga el archivo en lugar de generarlo; el código de juego no cambia.

Estados: **placeholder** = generado por código (arte o sonido temporal original) · **final** = archivo definitivo.

`;

const byCat = {};
for (const a of manifest.assets) (byCat[a.category] ??= []).push(a);

for (const [cat, title] of Object.entries(CATS)) {
  const list = byCat[cat];
  if (!list) continue;
  md += `## ${title}\n\n| Clave | Estado | Origen | Ruta final | Uso | Dimensiones | Animaciones | Notas de reemplazo |\n|---|---|---|---|---|---|---|---|\n`;
  for (const a of list) {
    md += `| \`${esc(a.key)}\` | ${esc(a.status)} | ${esc(a.source)} | ${a.path ? '`' + esc(a.path) + '`' : '—'} | ${esc(a.usage)} | ${esc(a.dimensions)} | ${esc((a.animations ?? []).join('; ') || '—')} | ${esc(a.notes)} |\n`;
  }
  md += '\n';
}

md += `## Licencias y terceros

- **Pixelify Sans** (tipografía de UI): SIL Open Font License 1.1, vía \`@fontsource/pixelify-sans\`.
- **Phaser 3** (motor de render): licencia MIT.
- Todo el arte, audio y marcas del juego son **originales y generados por código**. No se usan fotos, mapas,
  logotipos ni materiales de terceros. Las marcas (Patagonia Puede, Acá Nomás, Radio 89, "Ciudad en Movimiento")
  son ficticias y no copian identidades gráficas reales.
`;

writeFileSync(join(root, 'assets', 'ASSET_MANIFEST.md'), md, 'utf8');
console.log('assets/ASSET_MANIFEST.md generado (' + manifest.assets.length + ' entradas).');
