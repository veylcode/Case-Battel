import http from 'node:http';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GET, POST } from '../../app/api/[...path]/route.ts';
import { sqlite, env } from './database.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.m4a': 'audio/mp4', '.ico': 'image/x-icon' };
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const trustedProxy = process.env.TRUST_PROXY === 'true' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(incoming.socket.remoteAddress);
    const protocol = trustedProxy && incoming.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const url = new URL(incoming.url, `${protocol}://${incoming.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const frontend = incoming.headers.origin === env.FRONTEND_ORIGIN;
      const cors = frontend ? {
        'Access-Control-Allow-Origin': env.FRONTEND_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type, X-CB-Player, X-CB-Admin',
        'Access-Control-Expose-Headers': 'X-CB-Player-Session, X-CB-Admin-Session',
        'Vary': 'Origin',
      } : {};
      if (incoming.method === 'OPTIONS') { outgoing.writeHead(frontend ? 204 : 403, cors).end(); return; }
      if (!['GET', 'POST'].includes(incoming.method)) {
        outgoing.writeHead(405, { Allow: 'GET, POST' }).end();
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 1024 * 1024) {
          outgoing.writeHead(413).end('Request too large');
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      if (!trustedProxy) headers.set('cf-connecting-ip', incoming.socket.remoteAddress ?? '');
      else headers.set('cf-connecting-ip', String(incoming.headers['x-real-ip'] ?? incoming.socket.remoteAddress));
      const request = new Request(url, { method: incoming.method, headers, ...(incoming.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) });
      const response = await (incoming.method === 'POST' ? POST : GET)(request);
      const responseHeaders = { ...Object.fromEntries(response.headers), ...cors };
      if (frontend) {
        for (const value of response.headers.getSetCookie()) {
          const match = /^(cb_session|cb_admin)=([^;]*)/.exec(value);
          if (match) responseHeaders[match[1] === 'cb_admin' ? 'X-CB-Admin-Session' : 'X-CB-Player-Session'] = match[2];
        }
      }
      if (response.headers.getSetCookie().length) responseHeaders['set-cookie'] = response.headers.getSetCookie();
      outgoing.writeHead(response.status, responseHeaders);
      if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
      else outgoing.end();
      return;
    }
    if (url.pathname === '/healthz') {
      sqlite.prepare('SELECT 1').get();
      outgoing.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok"}');
      return;
    }
    if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405).end(); return; }
    const decoded = decodeURIComponent(url.pathname);
    let filename = path.resolve(root, '.' + decoded);
    if (filename !== root && !filename.startsWith(root + path.sep)) { outgoing.writeHead(404).end(); return; }
    let info;
    try { info = await stat(filename); } catch { /* SPA routes use the entry below. */ }
    if (!info?.isFile()) {
      if (path.extname(decoded)) { outgoing.writeHead(404).end(); return; }
      filename = path.join(root, 'index.html');
      info = await stat(filename);
    }
    outgoing.writeHead(200, {
      'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': filename.endsWith('index.html') ? 'no-cache' : 'public, max-age=86400',
    });
    if (incoming.method === 'HEAD') outgoing.end();
    else createReadStream(filename).pipe(outgoing);
  } catch (error) {
    console.error('Request failed:', error.message);
    if (!outgoing.headersSent) outgoing.writeHead(500).end('Internal server error');
    else outgoing.destroy();
  }
});
server.listen(Number(process.env.PORT ?? 5175), process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Case-Battel listening on ${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 5175}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => { sqlite.close(); process.exit(0); });
});
