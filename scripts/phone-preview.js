import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };

export function createPhonePreview(root, hosts) {
  return http.createServer(async (request, response) => {
    const fail = status => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); response.end('纯静态手机预览：此请求不可用。'); };
    try {
      if (!hosts.includes(request.headers.host)) return fail(403);
      if (!['GET', 'HEAD'].includes(request.method)) return fail(405);
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname.startsWith('/api/') || pathname.split('/').some(part => part.startsWith('.'))) return fail(404);
      const requested = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const resolved = await realpath(requested); const resolvedRoot = await realpath(root);
      if (!resolved.startsWith(resolvedRoot + path.sep)) return fail(404);
      const info = await stat(resolved); if (!info.isFile()) return fail(404);
      response.writeHead(200, { 'Content-Type': mime[path.extname(resolved)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      if (request.method === 'HEAD') response.end(); else createReadStream(resolved).on('error', () => response.destroy()).pipe(response);
    } catch { fail(404); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.WORLDSTAGE_PHONE_PORT || 5216);
  const addresses = Object.values(networkInterfaces()).flat().filter(entry => entry.family === 'IPv4' && !entry.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)).map(entry => entry.address);
  const root = fileURLToPath(new URL('../dist', import.meta.url));
  const hosts = ['127.0.0.1', 'localhost', ...addresses].map(host => `${host}:${port}`);
  const server = createPhonePreview(root, hosts);
  server.on('error', () => { console.error('手机预览无法启动，请检查端口与构建结果。'); process.exitCode = 1; });
  server.listen(port, '0.0.0.0', () => { console.log('仅供可信同一 Wi-Fi 的静态预览；不开放模型或媒体代理。Ctrl-C 关闭。'); addresses.forEach(address => console.log(`手机访问：http://${address}:${port}/`)); });
}
