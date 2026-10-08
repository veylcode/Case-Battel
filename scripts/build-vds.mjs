import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { build as bundle } from 'esbuild';
import { cpSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/postcss';

const root = process.cwd();
const output = path.join(root, 'dist-vds');
await viteBuild({
  configFile: false,
  root: path.join(root, 'deploy/vds/client'),
  publicDir: path.join(root, 'public'),
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: path.join(output, 'client'), emptyOutDir: true },
});
await bundle({
  entryPoints: ['deploy/vds/server.mjs'], outfile: path.join(output, 'server.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node24', minify: true,
  alias: { 'cloudflare:workers': path.join(root, 'deploy/vds/database.mjs') },
});
mkdirSync(path.join(output, 'migrations'), { recursive: true });
for (const name of readdirSync('drizzle').filter(name => name.endsWith('.sql'))) copyFileSync(path.join('drizzle', name), path.join(output, 'migrations', name));
cpSync('deploy/vds/backup.mjs', path.join(output, 'backup.mjs'));
console.log('VDS application built:', output);
