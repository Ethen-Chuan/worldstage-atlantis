import { randomUUID } from 'node:crypto';

export const VIDEO_MODELS = Object.freeze({ 'gen4.5': 'Runway Gen-4.5', gen4_turbo: 'Runway Gen-4 Turbo' });
export function mediaConfig(environment = process.env) {
  let scope = '';
  try {
    const url = new URL(environment.WORLDSTAGE_SCOPE_URL || '');
    if (!url.username && !url.password && !url.search && !url.hash && (url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) scope = url.href.replace(/\/$/, '');
  } catch {}
  return { runway: environment.RUNWAYML_API_SECRET === '[REDACTED_SECRET]' ? '' : environment.RUNWAYML_API_SECRET || '', scope, scopeAuthorization: environment.WORLDSTAGE_SCOPE_KEY === '[REDACTED_SECRET]' ? '' : environment.WORLDSTAGE_SCOPE_KEY || '' };
}
export function publicMediaConfig(config) {
  return { video: { available: Boolean(config.runway), provider: 'Runway', models: VIDEO_MODELS, duration: 5 }, realtime: { available: Boolean(config.scope), provider: 'Daydream Scope', host: config.scope ? new URL(config.scope).hostname : null }, mode: 'configured-not-verified' };
}
export function validateVideoInput(value) {
  if (!value || value.consent !== true) throw new Error('请先确认外发画面与文字，并同意可能产生的费用。');
  if (!Object.hasOwn(VIDEO_MODELS, value.model)) throw new Error('不支持这个视频模型。');
  if (typeof value.prompt !== 'string' || !value.prompt.trim() || value.prompt.length > 900) throw new Error('视频描述须为 1–900 字。');
  if (typeof value.image !== 'string' || value.image.length > 3500000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.image)) throw new Error('首帧须为有效的 JPEG 画面，不能使用外部图片地址。');
  const bytes = Buffer.from(value.image.split(',')[1], 'base64');
  if (bytes.length < 128 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error('首帧不是有效 JPEG 文件。');
  return { model: value.model, promptImage: value.image, promptText: value.prompt, duration: 5, ratio: '1280:720' };
}

export class VideoBridge {
  constructor(config, fetcher = fetch) { this.config = config; this.fetcher = fetcher; this.jobs = new Map(); this.sessions = new Set(); this.creating = false; }

  async runway(path, method = 'GET', body) {
    if (!this.config.runway) throw new Error('Runway 尚未配置，没有发起付费请求。');
    const response = await this.fetcher(`https://api.dev.runwayml.com/v1/${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${this.config.runway}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Runway 返回 ${response.status}。请求不会自动重试；请检查服务商任务与额度。`);
    if (response.status === 204) return {};
    return response.json();
  }

  async create(payload) {
    const body = validateVideoInput(payload);
    for (const [id, job] of this.jobs) if (Date.now() - job.created > 3600000) this.jobs.delete(id);
    if (this.creating || [...this.jobs.values()].some(job => !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(job.status))) throw new Error('请先等待或取消当前视频任务，不会重复计费提交。');
    this.creating = true;
    try {
      const result = await this.runway('image_to_video', 'POST', body);
      if (typeof result.id !== 'string' || !/^[\w-]{1,100}$/.test(result.id)) throw new Error('Runway 未返回有效任务编号。请检查服务商后台，勿重复提交。');
      const id = randomUUID();
      this.jobs.set(id, { remote: result.id, created: Date.now(), status: 'PENDING', model: body.model });
      return { id, status: 'PENDING', model: body.model, estimatedCredits: Number.isFinite(result.estimatedCost?.credits) ? result.estimatedCost.credits : null };
    } finally { this.creating = false; }
  }

  async status(id) {
    const job = this.jobs.get(id); if (!job) throw new Error('未找到本次会话创建的视频任务。');
    if (job.status === 'CANCELLED') return { id, status: 'CANCELLED', progress: null, output: null };
    const result = await this.runway(`tasks/${job.remote}`);
    const status = ['PENDING', 'THROTTLED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(result.status) ? result.status : 'PENDING';
    job.status = status;
    let output = null;
    if (status === 'SUCCEEDED' && Array.isArray(result.output)) {
      try { const url = new URL(result.output[0]); if (url.protocol === 'https:' && !url.username && !url.password) output = url.href; } catch {}
    }
    return { id, status, progress: Number.isFinite(result.progress) ? Math.min(1, Math.max(0, result.progress)) : null, output, error: status === 'FAILED' ? '生成失败，请在服务商后台查看原因与计费结果。' : null };
  }

  async cancel(id) {
    const job = this.jobs.get(id); if (!job) throw new Error('任务不存在。');
    await this.runway(`tasks/${job.remote}`, 'DELETE'); job.status = 'CANCELLED';
    return { id, status: 'CANCELLED', note: '已请求取消；不能保证退款或撤销已发生的费用。' };
  }

  async scope(path, method = 'GET', payload) {
    if (!this.config.scope) throw new Error('尚未配置 Scope 推理服务。');
    const headers = { 'Content-Type': 'application/json' };
    if (this.config.scopeAuthorization) headers.Authorization = `Bearer ${this.config.scopeAuthorization}`;
    const response = await this.fetcher(`${this.config.scope}/api/v1/${path}`, { method, headers, redirect: 'error', signal: AbortSignal.timeout(25000), ...(payload ? { body: JSON.stringify(payload) } : {}) });
    if (!response.ok) throw new Error(`Scope 返回 ${response.status}，请检查推理服务是否启动、模型是否已加载。`);
    return response.status === 204 ? {} : response.json();
  }

  async realtimeStatus() {
    const value = await this.scope('pipeline/status');
    return { status: ['loaded', 'loading', 'not_loaded', 'error'].includes(value.status) ? value.status : 'error', pipeline: typeof value.pipeline_id === 'string' ? value.pipeline_id.slice(0, 100) : null, width: Number.isInteger(value.load_params?.width) ? value.load_params.width : 576, height: Number.isInteger(value.load_params?.height) ? value.load_params.height : 320 };
  }

  async offer(payload) {
    if (payload?.consent !== true || payload.type !== 'offer' || typeof payload.sdp !== 'string' || payload.sdp.length > 100000 || typeof payload.prompt !== 'string' || payload.prompt.length > 900) throw new Error('实时视频协商请求无效或尚未同意传输。');
    const result = await this.scope('webrtc/offer', 'POST', { sdp: payload.sdp, type: 'offer', initialParameters: { input_mode: 'video', prompts: [{ text: payload.prompt, weight: 1 }], denoising_step_list: [700, 500] } });
    if (typeof result.sessionId !== 'string' || !/^[\w-]{1,100}$/.test(result.sessionId) || result.type !== 'answer' || typeof result.sdp !== 'string') throw new Error('Scope 没有返回有效的 WebRTC 应答。');
    this.sessions.add(result.sessionId); if (this.sessions.size > 20) this.sessions.delete(this.sessions.values().next().value);
    return { sessionId: result.sessionId, type: result.type, sdp: result.sdp };
  }

  async candidates(id, payload) {
    if (!this.sessions.has(id) || !Array.isArray(payload?.candidates) || payload.candidates.length > 20) throw new Error('ICE 会话不存在或格式无效。');
    const candidates = payload.candidates.map(value => {
      if (typeof value.candidate !== 'string' || value.candidate.length > 3000 || !(value.sdpMid === null || typeof value.sdpMid === 'string') || !(value.sdpMLineIndex === null || Number.isInteger(value.sdpMLineIndex))) throw new Error('ICE 候选信息无效。');
      return { candidate: value.candidate, sdpMid: value.sdpMid, sdpMLineIndex: value.sdpMLineIndex };
    });
    return this.scope(`webrtc/offer/${id}`, 'PATCH', { candidates });
  }
}
