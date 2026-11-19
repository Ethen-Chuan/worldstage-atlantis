const defaultPrompt = 'An ancient underwater Atlantis, weathered limestone palaces and bronze domes, warm sunlight through emerald water, layered coral habitats and graceful marine life. Preserve the input layout, creature silhouettes, armoured fantasy fish, turtles, nautiluses and any mythic mermaids already present. Do not add unrelated characters, text or interface. Slow continuous underwater motion.';

async function api(route, method = 'GET', body, signal) {
  const endpoint = import.meta.env.MODE === 'public' && route === 'config' ? './media-capabilities.json' : `/api/media/${route}`;
  const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `媒体请求失败 (${response.status})`);
  return payload;
}

export function setupMedia({ getOcean, toast, onPanel }) {
  const container = document.createElement('div');
  container.innerHTML = `<button id="ai-view-button" class="ai-view-button">影像工坊 <span>留住此刻</span></button>
    <video id="realtime-video" class="realtime-video" muted playsinline hidden></video><div id="realtime-badge" class="realtime-badge" hidden><span>AI 实时视频 · 并非精确三维状态</span><button id="compare-view">查看三维底稿</button><button id="disconnect-live">断开</button></div>
    <aside id="media-panel" class="drawer media-drawer" aria-label="录像与模型实验室" hidden><div class="drawer-header"><div><span class="eyebrow">A MOMENT FROM YOUR WORLD</span><h2>把这一刻带走</h2></div><button id="close-media" class="icon-button" aria-label="关闭影像工坊">×</button></div>
      <p class="drawer-intro">巨兽掠过，潮光落下。<br/>记录正在你眼前发生的世界。</p>
      <section class="about-section"><h3>录下真实的三维画面</h3><p>直接录制 10 秒，无需模型账号。只录当前三维视角，不采集摄像头、桌面或麦克风；文件保留“实时三维录像”标识。</p><button id="record-world" class="primary-button">录制 10 秒三维画面</button><p id="record-status" role="status"></p></section>
      <details class="model-lab"><summary>外部模型实验室 <span>可选配置</span></summary><p class="drawer-note">以下为可选接口，不是本网页默认开启的能力。未经单独确认，不会发送画面或产生生成任务。</p>
      <label class="media-prompt-label" for="media-prompt">画面描述 / 实时风格提示</label><textarea id="media-prompt" rows="4" maxlength="900"></textarea>
      <section class="about-section"><h3>01 / 持续生成 · Daydream Scope</h3><p id="scope-availability">正在检查推理服务配置……</p><p>通过 WebRTC 发送纯三维画面、接收模型视频。提示词可连续更新，不是轮播预录片段。需要预先加载视频转视频管线；质量、延迟与物体一致性须实测。</p><div class="media-actions"><button id="start-realtime" class="primary-button" disabled>连接实时推理</button><button id="update-realtime" class="text-button" disabled>更新画面描述</button></div><p id="realtime-status" role="status">未连接 · 当前仍是原生三维</p><p id="stream-metrics"></p><label class="setting-row">把后续造物描述同步给实时模型<input id="sync-neural-prompt" type="checkbox" checked/></label></section>
      <section class="about-section"><h3>02 / 当前视角 → AI 短片</h3><p id="video-availability">正在检查 Runway 配置……</p><label class="setting-row">模型<select id="video-model"><option value="gen4.5">Runway Gen-4.5</option><option value="gen4_turbo">Runway Gen-4 Turbo</option></select></label><p>发送当前画面作为首帧，生成 5 秒、1280 × 720 短片。这是异步任务，不是实时交互；生成的视频不会反写三维世界。</p><button id="prepare-video" class="primary-button" disabled>预览首帧并确认生成</button><p id="video-status" role="status">未提交任务 · 不会自动产生费用</p><button id="cancel-video" class="text-button" hidden>请求取消当前任务</button><button id="check-video" class="text-button" hidden>继续查询任务</button><video id="generated-video" class="generated-video" controls playsinline preload="metadata" hidden referrerpolicy="no-referrer"></video></section>
      </details>
      <p class="drawer-note">未配置 ≠ 已接入成功。项目目录《前沿视频接入说明》记录接口来源、部署条件与未验证项。不会自动下载模型、启动云 GPU 或反复重试付费生成。</p>
    </aside>
    <dialog id="media-consent" aria-labelledby="media-consent-title"><form method="dialog"><span class="eyebrow">BEFORE WE CONNECT</span><h2 id="media-consent-title">先确认，再让画面离开本机。</h2><img id="frame-preview" alt="将提交给视频模型的当前三维首帧" hidden/><p id="media-consent-copy"></p><p>不发送参考图原件、聊天界面、个人文件、麦克风或摄像头。请人工检查首帧；确认其中没有不希望外发的内容。服务端凭证不会出现在浏览器。</p><div class="dialog-actions"><button value="cancel">留在本地</button><button value="allow" class="primary-button">同意本次传输</button></div></form></dialog>`;
  document.querySelector('.experience').append(container);
  const elements = Object.fromEntries([...container.querySelectorAll('[id]')].map(element => [element.id, element]));
  elements['media-prompt'].value = defaultPrompt;
  const stopRealtime = document.createElement('button'); stopRealtime.className = 'text-button'; stopRealtime.textContent = '停止连接 / 传输'; stopRealtime.hidden = true;
  elements['start-realtime'].parentElement.append(stopRealtime);
  stopRealtime.addEventListener('click', () => stopLive());
  let config = { video: { available: false }, realtime: { available: false } };
  let peer = null;
  let channel = null;
  let inputStream = null;
  let sampling = null;
  let metrics = null;
  let firstFrame = null;
  let disconnectedTimer = null;
  let liveController = null;
  let liveRevision = 0;
  let outputVisible = true;
  let job = null;
  let pollTimer = null;
  let pollingSince = 0;
  let preparedImage = null;
  let consentMode = null;
  let recorder = null;
  const panel = open => { if (onPanel) return onPanel(open); if (open) document.querySelectorAll('.drawer').forEach(drawer => { drawer.hidden = true; }); elements['media-panel'].hidden = !open; (open ? elements['close-media'] : elements['ai-view-button']).focus(); };
  const prompt = () => elements['media-prompt'].value.trim().slice(0, 900) || defaultPrompt;
  const worldLabel = mode => { document.querySelector('#boundary-button').textContent = mode === 'ai' ? 'AI 实时视频实验 · 三维状态独立运行' : mode === 'compare' ? '原生三维底稿 · AI 推理仍在运行' : '实时 3D 造物原型 · 非 AI 视频模型生成'; };

  function stopLive(message = '已断开实时推理，返回三维。') {
    liveRevision++; liveController?.abort(); liveController = null;
    clearInterval(sampling); clearInterval(metrics); clearTimeout(firstFrame); clearTimeout(disconnectedTimer);
    sampling = metrics = firstFrame = null;
    channel?.close(); peer?.close(); channel = peer = null;
    inputStream?.getTracks().forEach(track => track.stop()); inputStream = null;
    const output = elements['realtime-video']; output.pause(); output.srcObject = null; output.hidden = true;
    elements['realtime-badge'].hidden = true; elements['update-realtime'].disabled = true;
    stopRealtime.hidden = true;
    elements['start-realtime'].disabled = !config.realtime.available;
    elements['realtime-status'].textContent = message; elements['stream-metrics'].textContent = '';
    document.body.classList.remove('neural-view');
    worldLabel('native');
  }
  async function connect() {
    stopLive('正在检查推理管线……');
    const revision = liveRevision;
    liveController = new AbortController(); const signal = liveController.signal;
    elements['start-realtime'].disabled = true;
    stopRealtime.hidden = false; outputVisible = true; elements['compare-view'].textContent = '查看三维底稿';
    try {
      const status = await api('realtime/status', 'GET', null, signal);
      if (status.status !== 'loaded') throw new Error(`推理管线${status.status === 'loading' ? '仍在加载' : '尚未就绪'}。请先在 Scope 加载视频转视频模型。`);
      const ice = await api('realtime/ice', 'GET', null, signal);
      if (revision !== liveRevision) return;
      const canvas = document.createElement('canvas'); canvas.width = Math.max(128, Math.min(1280, status.width)); canvas.height = Math.max(128, Math.min(720, status.height));
      const context = canvas.getContext('2d');
      const copyFrame = () => { const source = getOcean()?.renderer.domElement; if (source) context.drawImage(source, 0, 0, canvas.width, canvas.height); };
      copyFrame(); sampling = setInterval(copyFrame, 1000 / 15); inputStream = canvas.captureStream(15);
      const connection = new RTCPeerConnection({ iceServers: Array.isArray(ice.iceServers) ? ice.iceServers : [] }); peer = connection;
      const parameters = connection.createDataChannel('parameters', { ordered: true }); channel = parameters;
      let sessionId = null; const candidates = [];
      const sendCandidate = candidate => api(`realtime/candidates/${sessionId}`, 'PATCH', { candidates: [{ candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex }] }, signal);
      parameters.onopen = () => { if (revision === liveRevision) { elements['update-realtime'].disabled = false; elements['realtime-status'].textContent = `已连接 ${status.pipeline || 'Scope'} · 等待模型首帧`; } };
      parameters.onmessage = event => { try { const data = JSON.parse(event.data); if (data.type === 'stream_stopped') stopLive('推理服务停止了视频流，请检查服务端。'); } catch {} };
      connection.onicecandidate = event => {
        if (!event.candidate || revision !== liveRevision) return;
        if (sessionId) sendCandidate(event.candidate).catch(() => { if (revision === liveRevision) stopLive('ICE 协商失败，请检查推理服务网络。'); });
        else candidates.push(event.candidate);
      };
      connection.onconnectionstatechange = () => {
        if (revision !== liveRevision) return;
        clearTimeout(disconnectedTimer);
        if (connection.connectionState === 'failed') stopLive('实时连接失败。已返回三维，不会自动重连计费。');
        else if (connection.connectionState === 'disconnected') {
          elements['realtime-status'].textContent = '网络连接中断，等待恢复；持续中断将自动断开。';
          disconnectedTimer = setTimeout(() => { if (revision === liveRevision) stopLive('实时网络中断，已返回三维。云实例需你自行关闭。'); }, 8000);
        }
      };
      connection.ontrack = event => {
        if (revision !== liveRevision || event.track.kind !== 'video') return;
        const output = elements['realtime-video']; output.srcObject = event.streams[0] || new MediaStream([event.track]);
        output.onloadeddata = () => {
          if (revision !== liveRevision) return; clearTimeout(firstFrame); output.hidden = !outputVisible; elements['realtime-badge'].hidden = false;
          document.body.classList.add('neural-view'); worldLabel(outputVisible ? 'ai' : 'compare'); elements['realtime-status'].textContent = '收到模型视频帧 · 可更新提示词，或随时对比三维底稿'; output.play().catch(() => toast('点击页面以允许视频播放。'));
        };
        output.play().catch(() => {});
      };
      inputStream.getVideoTracks().forEach(track => connection.addTrack(track, inputStream));
      const offer = await connection.createOffer(); await connection.setLocalDescription(offer);
      const answer = await api('realtime/offer', 'POST', { consent: true, sdp: offer.sdp, type: 'offer', prompt: prompt() }, signal);
      if (revision !== liveRevision) return;
      sessionId = answer.sessionId; await connection.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
      for (const candidate of candidates) await sendCandidate(candidate);
      firstFrame = setTimeout(() => { if (revision === liveRevision && elements['realtime-video'].readyState < 2) stopLive('45 秒内未收到模型画面，已断开。请检查 GPU 和管线。'); }, 45000);
      metrics = setInterval(async () => {
        if (revision !== liveRevision || connection.connectionState === 'closed') return;
        try {
          const statistics = await connection.getStats();
          statistics.forEach(stat => { if (stat.type === 'inbound-rtp' && stat.kind === 'video') elements['stream-metrics'].textContent = `接收 ${Number.isFinite(stat.framesPerSecond) ? Math.round(stat.framesPerSecond) : '—'} fps · 已解码 ${stat.framesDecoded || 0} 帧 · 非端到端延迟测量`; });
        } catch {}
      }, 2000);
    } catch (error) { if (revision === liveRevision) stopLive(error.message || '实时推理未连接成功。'); }
  }
  function updatePrompt(text) {
    if (channel?.readyState !== 'open') return false;
    const value = String(text).trim().slice(0, 900);
    channel.send(JSON.stringify({ transition: { target_prompts: [{ text: value, weight: 1 }], num_steps: 4 } }));
    elements['realtime-status'].textContent = '已发送新提示词 · 等待下一段模型视频响应，不代表三维状态已改变';
    return true;
  }
  async function prepareVideo() {
    const ocean = getOcean(); if (!ocean) return;
    const source = ocean.renderer.domElement;
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext('2d'); const width = source.width; const height = source.height;
    const cropWidth = Math.min(width, height * 16 / 9); const cropHeight = Math.min(height, width * 9 / 16);
    context.drawImage(source, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, 1280, 720);
    preparedImage = canvas.toDataURL('image/jpeg', 0.88);
    elements['frame-preview'].src = preparedImage; elements['frame-preview'].hidden = false;
    consentMode = 'video';
    elements['media-consent-copy'].textContent = '这张纯三维首帧和上方画面描述将发送给 Runway，生成一段 5 秒短片。会使用你的 API 额度，金额以服务商为准；取消不保证退款。任务不会自动重试。';
    elements['media-consent'].showModal();
  }
  async function poll() {
    if (!job) return;
    try {
      const result = await api(`video/${job}`);
      const labels = { PENDING: '排队中', THROTTLED: '等待服务商额度', RUNNING: '模型正在生成', SUCCEEDED: '生成完成', FAILED: '生成失败', CANCELLED: '任务已取消' };
      elements['video-status'].textContent = `${labels[result.status]}${result.progress !== null ? ` · ${Math.round(result.progress * 100)}%` : ''}${result.error ? ` · ${result.error}` : ''}`;
      if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(result.status)) {
        elements['cancel-video'].hidden = true; elements['check-video'].hidden = true; elements['prepare-video'].disabled = !config.video.available;
        if (result.output) { elements['generated-video'].src = result.output; elements['generated-video'].hidden = false; elements['video-status'].textContent += ' · AI 短片，非实时画面；链接可能过期'; }
        job = null; return;
      }
      if (Date.now() - pollingSince > 15 * 60 * 1000) { elements['video-status'].textContent += ' · 暂停自动查询，任务可能仍在计费运行'; elements['check-video'].hidden = false; return; }
      pollTimer = setTimeout(poll, 5000);
    } catch (error) { elements['video-status'].textContent = `${error.message} · 未重新提交生成任务`; elements['check-video'].hidden = false; }
  }
  async function generate() {
    elements['prepare-video'].disabled = true; elements['video-status'].textContent = '正在提交一次生成请求……';
    try {
      const result = await api('video', 'POST', { consent: true, model: elements['video-model'].value, prompt: prompt(), image: preparedImage });
      job = result.id; pollingSince = Date.now(); elements['cancel-video'].hidden = false;
      elements['video-status'].textContent = `任务已提交${result.estimatedCredits !== null ? ` · 服务商预估 ${result.estimatedCredits} credits` : ''}`; pollTimer = setTimeout(poll, 5000);
    } catch (error) { elements['video-status'].textContent = `${error.message} · 请检查服务商任务后再决定是否重试`; elements['prepare-video'].disabled = !config.video.available; }
    finally { preparedImage = null; elements['frame-preview'].removeAttribute('src'); }
  }
  async function record() {
    if (!window.MediaRecorder || !getOcean()) return toast('当前浏览器不支持录制。');
    if (recorder) { recorder.stop(); return; }
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext('2d');
    const paint = () => { const source = getOcean().renderer.domElement; const width = Math.min(source.width, source.height * 16 / 9); const height = width * 9 / 16; context.drawImage(source, (source.width - width) / 2, (source.height - height) / 2, width, height, 0, 0, 1280, 720); context.fillStyle = 'rgba(5,23,29,.8)'; context.fillRect(0, 680, 1280, 40); context.fillStyle = '#e4dbc3'; context.font = '13px sans-serif'; context.fillText('即境 · 实时三维交互录像 / 非 AI 视频生成', 22, 705); };
    paint(); const interval = setInterval(paint, 1000 / 24); const stream = canvas.captureStream(24); const chunks = [];
    const format = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    try { recorder = new MediaRecorder(stream, format ? { mimeType: format, videoBitsPerSecond: 5000000 } : {}); }
    catch { clearInterval(interval); stream.getTracks().forEach(track => track.stop()); return toast('录制初始化失败。'); }
    const active = recorder;
    let recordingFailed = false;
    active.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const timeout = setTimeout(() => { if (active.state === 'recording') active.stop(); }, 10000);
    active.onstop = () => {
      clearInterval(interval); clearTimeout(timeout); stream.getTracks().forEach(track => track.stop());
      recorder = null; elements['record-world'].textContent = '录制 10 秒三维画面';
      if (recordingFailed || !chunks.length) { elements['record-status'].textContent = '录制未完成，没有导出空白文件。请换用支持录像的浏览器。'; return; }
      const blob = new Blob(chunks, { type: active.mimeType }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `即境-实时三维录像-${Date.now()}.${active.mimeType.includes('mp4') ? 'mp4' : 'webm'}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      elements['record-status'].textContent = '已发起录像下载，含实时三维标识。请查看浏览器下载记录。';
    };
    active.onerror = () => { recordingFailed = true; clearInterval(interval); clearTimeout(timeout); stream.getTracks().forEach(track => track.stop()); recorder = null; elements['record-world'].textContent = '录制 10 秒三维画面'; elements['record-status'].textContent = '录制遇到错误，已停止采集。'; };
    try { active.start(); elements['record-world'].textContent = '提前结束录制'; elements['record-status'].textContent = '录制中 · 你可以关闭面板，继续移动和造物'; }
    catch { active.onerror(); }
  }

  elements['ai-view-button'].addEventListener('click', () => panel(elements['media-panel'].hidden)); elements['close-media'].addEventListener('click', () => panel(false));
  elements['prepare-video'].addEventListener('click', prepareVideo); elements['record-world'].addEventListener('click', record);
  elements['cancel-video'].addEventListener('click', async () => {
    if (!job) return; clearTimeout(pollTimer);
    try { const result = await api(`video/${job}`, 'DELETE'); elements['video-status'].textContent = result.note; job = null; elements['cancel-video'].hidden = true; elements['check-video'].hidden = true; elements['prepare-video'].disabled = !config.video.available; }
    catch (error) { elements['video-status'].textContent = error.message; elements['check-video'].hidden = false; }
  });
  elements['check-video'].addEventListener('click', () => { elements['check-video'].hidden = true; pollingSince = Date.now(); poll(); });
  elements['start-realtime'].addEventListener('click', () => {
    consentMode = 'realtime'; elements['frame-preview'].hidden = true;
    elements['media-consent-copy'].textContent = `连接后会持续将三维画面和你输入的画面描述发送到 ${config.realtime.host || '配置的 Scope 服务'}，直到你断开或关闭页面。WebRTC 会协商网络地址，可能经中继转发。若使用云 GPU 或付费管线，会持续占用算力并可能收费；本应用不能关闭你的云实例。`;
    elements['media-consent'].showModal();
  });
  elements['media-consent'].addEventListener('close', () => {
    if (elements['media-consent'].returnValue === 'allow') { if (consentMode === 'video') generate(); else connect(); }
    else { preparedImage = null; elements['frame-preview'].removeAttribute('src'); }
  });
  elements['update-realtime'].addEventListener('click', () => updatePrompt(prompt())); elements['disconnect-live'].addEventListener('click', () => stopLive());
  elements['compare-view'].addEventListener('click', () => { outputVisible = !outputVisible; elements['realtime-video'].hidden = !outputVisible; elements['compare-view'].textContent = outputVisible ? '查看三维底稿' : '返回 AI 画面'; worldLabel(outputVisible ? 'ai' : 'compare'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !elements['media-panel'].hidden && !elements['media-consent'].open) panel(false); });
  window.addEventListener('pagehide', () => { stopLive(); clearTimeout(pollTimer); if (recorder?.state === 'recording') recorder.stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && peer) stopLive('页面进入后台，已停止传输画面。云实例需你自行关闭。'); });
  api('config').then(value => {
    config = value; elements['prepare-video'].disabled = !config.video.available; elements['start-realtime'].disabled = !config.realtime.available;
    elements['video-availability'].textContent = config.video.available ? '发现服务端凭证 · 尚未生成，须逐次确认费用' : '未配置 Runway 凭证 · 未调用视频模型';
    elements['scope-availability'].textContent = config.realtime.available ? `已配置 ${config.realtime.host} · 尚未验证管线与 GPU` : '未配置 Scope 推理服务 · 未运行神经视频生成';
  }).catch(() => { elements['scope-availability'].textContent = elements['video-availability'].textContent = '媒体服务不可用，请使用新版启动器重启。'; });
  return {
    updateFromCreation(text, applied) {
      if (!elements['sync-neural-prompt'].checked || !peer) return false;
      const changed = updatePrompt(`${defaultPrompt} Requested change: ${String(text).slice(0, 240)}`);
      if (changed && !applied) toast('描述已发给实时视频模型；三维世界没有对应改变，结果由模型决定。');
      return changed;
    },
    setPaused(paused) { if (channel?.readyState === 'open') channel.send(JSON.stringify({ paused })); },
    inspect: () => ({ configured: { video: config.video.available, realtime: config.realtime.available }, peer: peer?.connectionState || 'closed', dataChannel: channel?.readyState || 'closed', job, recording: Boolean(recorder) }),
  };
}
