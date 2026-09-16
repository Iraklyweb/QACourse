import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(projectRoot, process.argv[2] || 'docs');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target)) target = path.join(root, '404.html');
  response.writeHead(target.endsWith('404.html') ? 404 : 200, { 'content-type': types[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
