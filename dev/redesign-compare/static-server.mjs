import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

export function isWithin(parent, candidate) {
  return candidate === parent || candidate.startsWith(`${parent}${sep}`);
}

const mimeTypes = {
  '.avif': 'image/avif', '.css': 'text/css; charset=utf-8', '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.pdf': 'application/pdf', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8',
};

export async function startStaticServer(dist) {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\0')) {
        response.writeHead(400).end('Bad request');
        return;
      }
      let filename = resolve(dist, `.${pathname}`);
      if (!isWithin(dist, filename)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      let info = await stat(filename).catch(() => null);
      if (info?.isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(308, { Location: `${pathname}/${url.search}` }).end();
          return;
        }
        filename = join(filename, 'index.html');
        info = await stat(filename).catch(() => null);
      } else if (!info && pathname.endsWith('/')) {
        filename = join(filename, 'index.html');
        info = await stat(filename).catch(() => null);
      }
      if (!info?.isFile()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(filename).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-store',
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(filename).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(error));
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine local server port');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}
