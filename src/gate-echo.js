export class GateEcho {
  constructor(sound) { this.sound = sound; this.revision = 0; this.status = 'idle'; this.nodes = []; }
  async speak(text) {
    this.stop(); const revision = this.revision; const sound = this.sound;
    if (!sound.enabled || sound.userMuted || sound.paused || sound.context?.state !== 'running') { this.status = 'muted'; return false; }
    this.status = 'loading'; const controller = new AbortController(); this.controller = controller;
    const loadTimer = setTimeout(() => controller.abort(), 20000); this.loadTimer = loadTimer;
    try {
      const response = await fetch('./api/gate-voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: String(text).slice(0, 160) }), signal: controller.signal });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error('Local voice unavailable');
      const buffer = await sound.context.decodeAudioData(await response.arrayBuffer());
      if (!(buffer.duration > 0.2)) throw new Error('Empty voice');
      if (revision !== this.revision || !sound.enabled || sound.userMuted || sound.paused || sound.context.state !== 'running') return false;
      const context = sound.context; const source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = 0.86;
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2600;
      const gain = context.createGain(); gain.gain.value = 0.7;
      const delay = context.createDelay(2); delay.delayTime.value = 0.62;
      const echo = context.createGain(); echo.gain.value = 0.26;
      const feedback = context.createGain(); feedback.gain.value = 0.32;
      source.connect(filter).connect(gain).connect(sound.effectsGain); gain.connect(sound.reverb);
      filter.connect(delay).connect(echo).connect(sound.effectsGain); delay.connect(feedback).connect(delay);
      this.nodes = [source, filter, gain, delay, echo, feedback]; this.source = source; this.status = 'speaking';
      sound.musicGain.gain.setTargetAtTime(sound.levels.music * 0.3, context.currentTime, 0.3);
      source.onended = () => { this.cleanupTimer = setTimeout(() => { if (revision === this.revision) this.stop(); }, 2200); };
      source.start(); return true;
    } catch {
      if (revision !== this.revision) return false;
      await this.waitForVoices();
      if (revision !== this.revision || !sound.enabled || sound.userMuted || sound.paused) return false;
      this.device = true;
      const played = sound.chant(text, { explicit: true, cancelGate: false, onend: () => { if (revision === this.revision) this.stop(); } });
      this.status = played ? 'device-voice' : 'unavailable'; this.device = played; sound.onChange?.(); return played;
    } finally { clearTimeout(loadTimer); }
  }
  waitForVoices() {
    const engine = globalThis.speechSynthesis;
    if (!engine || engine.getVoices().length) return Promise.resolve();
    return new Promise(resolve => {
      const finish = () => { clearTimeout(timer); engine.removeEventListener?.('voiceschanged', finish); this.cancelVoiceWait = null; resolve(); };
      const timer = setTimeout(finish, 1500); this.cancelVoiceWait = finish; engine.addEventListener?.('voiceschanged', finish, { once: true });
    });
  }
  stop() {
    this.revision++; this.controller?.abort(); clearTimeout(this.cleanupTimer); clearTimeout(this.loadTimer); this.cancelVoiceWait?.();
    if (this.device) { this.device = false; globalThis.speechSynthesis?.cancel(); }
    if (this.source) { this.source.onended = null; try { this.source.stop(); } catch {} }
    this.nodes.forEach(node => node.disconnect()); this.nodes = []; this.source = null; this.status = 'idle';
    this.sound.creatureAudio?.restoreMusic();
    this.sound.onChange?.();
  }
}
