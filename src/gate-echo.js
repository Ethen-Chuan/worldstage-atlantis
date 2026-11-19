import { gateInvocation } from './gate-language.js';

export function voiceEnvelope(buffer, rate = 60) {
  if (!buffer.getChannelData || !buffer.sampleRate) return new Float32Array(1);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const envelope = new Float32Array(Math.ceil(buffer.duration * rate));
  for (let frame = 0; frame < envelope.length; frame++) {
    let energy = 0; let samples = 0;
    for (const channel of channels) for (let index = Math.floor(frame * buffer.sampleRate / rate); index < Math.min(channel.length, Math.floor((frame + 1) * buffer.sampleRate / rate)); index++) { energy += channel[index] ** 2; samples++; }
    envelope[frame] = Math.sqrt(energy / Math.max(1, samples));
  }
  const sorted = [...envelope].sort((first, second) => first - second); const reference = Math.max(0.035, sorted[Math.floor(sorted.length * 0.93)] || 0.035);
  let filtered = 0;
  for (let index = 0; index < envelope.length; index++) {
    const target = Math.min(1, Math.max(0, (envelope[index] - 0.004) / reference));
    filtered += (target - filtered) * (1 - Math.exp(-1 / (rate * (target > filtered ? 0.045 : 0.13))));
    envelope[index] = filtered;
  }
  return envelope;
}

export class GateEcho {
  constructor(sound) { this.sound = sound; this.revision = 0; this.status = 'idle'; this.nodes = []; this.buffers = new Map(); }
  async speak(text) {
    this.stop(); globalThis.speechSynthesis?.cancel(); const revision = this.revision; const sound = this.sound;
    this.invocation = gateInvocation(text);
    if (!sound.enabled || sound.userMuted || sound.paused || sound.context?.state !== 'running') { this.status = 'muted'; return false; }
    this.status = 'loading'; const controller = new AbortController(); this.controller = controller;
    const loadTimer = setTimeout(() => controller.abort(), 20000); this.loadTimer = loadTimer;
    try {
      const invocation = this.invocation;
      let buffer = this.buffers.get(invocation.id);
      if (!buffer) {
        const response = await fetch(`./${invocation.file}`, { signal: controller.signal });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error('Local voice unavailable');
        const audio = await response.arrayBuffer();
        if (audio.byteLength > 2000000) throw new Error('Voice asset too large');
        buffer = await sound.context.decodeAudioData(audio);
        if (!(buffer.duration > 0.2 && buffer.duration < 35)) throw new Error('Empty voice');
        this.buffers.set(invocation.id, buffer);
      }
      if (revision !== this.revision || !sound.enabled || sound.userMuted || sound.paused || sound.context.state !== 'running') return false;
      const context = sound.context; const source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = 1;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 3400;
      const chest = context.createBiquadFilter(); chest.type = 'lowshelf'; chest.frequency.value = 180; chest.gain.value = 2;
      const gain = context.createGain(); gain.gain.value = 0.92;
      const delay = context.createDelay(2); delay.delayTime.value = 0.54;
      const echo = context.createGain(); echo.gain.value = 0.18;
      const feedback = context.createGain(); feedback.gain.value = 0.22;
      source.connect(filter).connect(chest).connect(gain).connect(sound.effectsGain); gain.connect(sound.reverb);
      filter.connect(delay).connect(echo).connect(sound.effectsGain); delay.connect(feedback).connect(delay);
      this.nodes = [source, filter, chest, gain, delay, echo, feedback]; this.source = source; this.status = 'speaking';
      this.envelope = voiceEnvelope(buffer); this.startedAt = context.currentTime + 0.02;
      sound.musicGain.gain.setTargetAtTime(sound.levels.music * 0.22, context.currentTime, 0.3);
      source.onended = () => { this.cleanupTimer = setTimeout(() => { if (revision === this.revision) this.stop(); }, 2200); };
      source.start(this.startedAt); return true;
    } catch {
      if (revision !== this.revision) return false;
      this.status = 'unavailable'; sound.creatureAudio?.restoreMusic(); sound.onChange?.(); return false;
    } finally { clearTimeout(loadTimer); }
  }
  amplitude() {
    if (this.status !== 'speaking' || !this.envelope || this.sound.userMuted || !this.sound.enabled || this.sound.paused || this.sound.context?.state !== 'running' || this.sound.levels.effects === 0) return 0;
    const elapsed = this.sound.context.currentTime - this.startedAt;
    const sample = time => { const cursor = time * 60; if (cursor < 0 || cursor >= this.envelope.length) return 0; const index = Math.floor(cursor); return this.envelope[index] + ((this.envelope[index + 1] || 0) - this.envelope[index]) * (cursor - index); };
    return Math.min(1, sample(elapsed) + sample(elapsed - 0.54) * 0.18) * Math.min(1, (this.sound.levels.effects ?? 0.65) / 0.65);
  }
  stop() {
    this.revision++; this.controller?.abort(); clearTimeout(this.cleanupTimer); clearTimeout(this.loadTimer);
    if (this.source) { this.source.onended = null; try { this.source.stop(); } catch {} }
    this.nodes.forEach(node => node.disconnect()); this.nodes = []; this.source = null; this.status = 'idle'; this.envelope = null;
    this.sound.creatureAudio?.restoreMusic();
    this.sound.onChange?.();
  }
}
