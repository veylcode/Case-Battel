import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const base = '/Case-Battel/';
const output = path.resolve('dist-pages');
await build({
  configFile: false, base,
  root: path.resolve('deploy/vds/client'), publicDir: path.resolve('public'),
  plugins: [{
    name: 'github-pages-paths', enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').includes('/app/ui/') || !/\.tsx$/.test(id)) return;
      return code.replace(/(["'`])(\/(?:reference\/|case-battle-logo\.|favicon\.svg))/g, (_, quote, asset) => quote + base + asset.slice(1))
        .replace(/href=(["'])(\/[^"']*)\1/g, (_, quote, route) => 'href=' + quote + base + route.slice(1) + quote);
    },
    transformIndexHtml() {
      return [{ tag: 'script', children: 'window.CASE_BATTLE_HOSTING=' + JSON.stringify({ apiOrigin: 'https://case-battel-5-83-140-108.sslip.io', basePath: base }) + ';', injectTo: 'head-prepend' }];
    },
  }, react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: output, emptyOutDir: true },
});
mkdirSync(path.join(output, 'admin'), { recursive: true });
copyFileSync(path.join(output, 'index.html'), path.join(output, 'admin/index.html'));
copyFileSync(path.join(output, 'index.html'), path.join(output, '404.html'));
writeFileSync(path.join(output, '.nojekyll'), '');
