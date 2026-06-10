import { createReadStream } from 'fs';
import { readFile, stat } from 'fs/promises';
import { type Server, createServer } from 'http';
import { extname, join, normalize, resolve } from 'path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

export type StaticServer = {
  port: number;
  origin: string;
  close: () => Promise<void>;
};

/**
 * Start a tiny static file server for the given directory on an ephemeral port.
 * Unknown paths fall back to `index.html` so the fixture can behave as an SPA
 * that owns client-side routing — matching how real products get served.
 */
export async function startStaticServer(rootDir: string): Promise<StaticServer> {
  const root = resolve(rootDir);
  const indexPath = join(root, 'index.html');
  const indexBody = await readFile(indexPath);

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const requested = decodeURIComponent(url.pathname);
      const candidate = normalize(join(root, requested));

      if (!candidate.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }

      if (requested.endsWith('/')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexBody);
        return;
      }

      try {
        const info = await stat(candidate);
        if (info.isDirectory()) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexBody);
          return;
        }
        const mime = MIME_TYPES[extname(candidate).toLowerCase()] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        createReadStream(candidate).pipe(res);
        return;
      } catch {
        // File not found — SPA fallback
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexBody);
      }
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });

  await new Promise<void>(resolvePromise => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`unexpected server address: ${String(address)}`);
  }

  return {
    port: address.port,
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolvePromise, reject) => {
        server.close(err => (err ? reject(err) : resolvePromise()));
      }),
  };
}
