import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelConfig, publicConfig, requestModelPlan } from './model-bridge.js';
import { mediaConfig, publicMediaConfig, VideoBridge } from './video-bridge.js';
import { synthesizeGate, gateText } from './gate-voice.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(directory, 'dist');
const port = Number(process.env.WORLDSTAGE_PORT || 5196);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const config = modelConfig();
const media = mediaConfig();
const video = new VideoBridge(media);
const mediaRates = new Map();
let modelBusy = false;
let gateBusy = false;
let lastModelRequest = 0;
function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host)) return json(response, 403, { error: '仅允许本机访问。' });
    if (pathname === '/api/gate-voice' && request.method === 'POST') {
      if (request.headers.origin !== `http://${request.headers.host}` || !request.headers['content-type']?.startsWith('application/json')) return json(response, 403, { error: '仅允许当前页面调用本机语音。' });
      if (gateBusy) return json(response, 429, { error: '请等待上一段回声。' });
      gateBusy = true;
      try {
        const chunks = []; let bytes = 0;
        for await (const chunk of request) { bytes += chunk.length; if (bytes > 1500) return json(response, 413, { error: '回声文字过长。' }); chunks.push(chunk); }
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); gateText(payload.text);
        const audio = await synthesizeGate(payload.text);
        response.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(audio);
      } catch { return json(response, 503, { error: '本地古希腊语男声音色未就绪。请运行 npm run audio:gate；不会改用中文朗读。' }); }
      finally { gateBusy = false; }
      return;
    }
    if (pathname === '/api/config' && request.method === 'GET') return json(response, 200, publicConfig(config));
    if (pathname === '/api/media/config' && request.method === 'GET') return json(response, 200, publicMediaConfig(media));
    if (pathname.startsWith('/api/media/')) {
      if (request.headers.origin !== `http://${request.headers.host}` && request.headers['sec-fetch-site'] !== 'same-origin') return json(response, 403, { error: '仅允许当前页面访问媒体服务。' });
      const route = pathname.slice('/api/media/'.length);
      const now = Date.now();
      const rateKey = `${request.method}:${route}`;
      if (!route.startsWith('realtime/candidates/') && now - (mediaRates.get(rateKey) || 0) < 250) return json(response, 429, { error: '请求过于频繁，请稍候。' });
      mediaRates.set(rateKey, now);
      if (mediaRates.size > 100) mediaRates.delete(mediaRates.keys().next().value);
      let payload = null;
      if (['POST', 'PATCH'].includes(request.method)) {
        if (!request.headers['content-type']?.startsWith('application/json')) return json(response, 415, { error: '仅支持 JSON。' });
        let bytes = 0; const chunks = [];
        for await (const chunk of request) { bytes += chunk.length; if (bytes > (route === 'video' ? 3700000 : 130000)) return json(response, 413, { error: '请求过大。' }); chunks.push(chunk); }
        try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(response, 400, { error: '请求格式错误。' }); }
      }
      try {
        if (route === 'video' && request.method === 'POST') return json(response, 202, await video.create(payload));
        const task = route.match(/^video\/([\w-]{1,100})$/);
        if (task && request.method === 'GET') return json(response, 200, await video.status(task[1]));
        if (task && request.method === 'DELETE') return json(response, 200, await video.cancel(task[1]));
        if (route === 'realtime/status' && request.method === 'GET') return json(response, 200, await video.realtimeStatus());
        if (route === 'realtime/ice' && request.method === 'GET') return json(response, 200, await video.scope('webrtc/ice-servers'));
        if (route === 'realtime/offer' && request.method === 'POST') return json(response, 200, await video.offer(payload));
        const candidate = route.match(/^realtime\/candidates\/([\w-]{1,100})$/);
        if (candidate && request.method === 'PATCH') return json(response, 200, await video.candidates(candidate[1], payload));
        return json(response, 404, { error: '没有这个媒体接口。' });
      } catch (error) {
        const known = /^(Runway|Scope|请|不支持|视频|首帧|单次|未找到|任务|尚未|实时|ICE)/.test(error.message || '');
        return json(response, 502, { error: known ? error.message : '媒体服务未完成请求。没有自动重试，请先检查服务商任务，避免重复计费。' });
      }
    }
    if (pathname === '/api/interpret' && request.method === 'POST') {
      if (request.headers.origin !== `http://${request.headers.host}` || !request.headers['content-type']?.startsWith('application/json')) return json(response, 403, { error: '仅允许当前体验页面提交。' });
      if (!config.available) return json(response, 503, { error: '尚未配置大模型服务；未向外部发送文字。' });
      if (modelBusy || Date.now() - lastModelRequest < 1200) return json(response, 429, { error: '请等待上一条邀请完成。' });
      modelBusy = true;
      const abort = new AbortController();
      response.on('close', () => { if (!response.writableEnded) abort.abort(); });
      try {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 20000) return json(response, 413, { error: '请求过长。' });
          chunks.push(chunk);
        }
        lastModelRequest = Date.now();
        const plan = await requestModelPlan(JSON.parse(Buffer.concat(chunks).toString('utf8')), config, fetch, abort.signal);
        return json(response, 200, { ...plan, source: 'model' });
      } catch (error) {
        const safeMessage = error.message?.startsWith('模型') || error.message?.startsWith('请输入') ? error.message : '模型服务未完成请求（超时、连接或配置问题），未执行动作。';
        if (!response.destroyed) return json(response, 502, { error: safeMessage });
      } finally { modelBusy = false; }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    if (pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ product: 'worldstage-atlantis', mode: 'mythic-ocean-creation', version: 8 }));
      return;
    }
    const candidate = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!candidate.startsWith(root + path.sep)) throw new Error('Invalid path');
    const resolved = await realpath(candidate);
    if (!resolved.startsWith(root + path.sep)) throw new Error('Invalid path');
    const info = await stat(resolved);
    if (!info.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mime[path.extname(resolved)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(resolved).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('未找到文件。请先构建作品，再启动本地体验。');
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? '本地体验端口已被占用。请打开已有体验，或关闭先前窗口。' : '无法启动本地体验。');
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`即境 · 亚特兰蒂斯已就绪：http://127.0.0.1:${port}（仅本机可访问）`));
