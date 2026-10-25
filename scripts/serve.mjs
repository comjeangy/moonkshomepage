import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 8790);
const prefix = '/' + (process.env.BASE_PATH || '').split('/').filter(Boolean).join('/');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };

http.createServer((request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (prefix !== '/') {
      if (pathname === prefix) { response.writeHead(302, { Location: prefix + '/' }).end(); return; }
      if (!pathname.startsWith(prefix + '/')) { response.writeHead(404).end(); return; }
      pathname = pathname.slice(prefix.length);
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const segments = relative.split(/[\\/]/);
    const publicPath = relative === 'index.html' || ['assets', 'src', 'data'].includes(segments[0]);
    if (!publicPath || segments.some((segment) => segment.startsWith('.'))) {
      response.writeHead(403).end('Forbidden'); return;
    }
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => {
  console.log(`Local: http://127.0.0.1:${port}${prefix === '/' ? '/' : prefix + '/'}`);
});
