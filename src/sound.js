import { Orchestra } from './orchestra.js';
import { scoreFor } from './orchestra-score.js';
import { CreatureAudio } from './creature-audio.js';

export class OceanSound {
  constructor() {
    this.enabled = false;
    this.paused = false;
    this.context = null;
    this.master = null;
    this.voices = new Set();
    this.creatureAudio = new CreatureAudio(this);
    this.site = 'palace'; this.intensity = 0; this.narration = false; this.userMuted = false; this.unlocked = false; this.trial = false;
    this.levels = { music: 0.8, ambience: 0.22, effects: 0.65 }; this.onChange = () => {};
    try { this.userMuted = localStorage.getItem('worldstage-muted') === 'true'; } catch {}
  }

  async toggle() {
    if (this.enabled && this.context?.state === 'running' && this.orchestra?.status !== 'error') {
      this.enabled = false; this.userMuted = true; this.stopChant(); this.creatureAudio.stop();
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.15);
      try { localStorage.setItem('worldstage-muted', 'true'); } catch {}
      this.onChange(); return false;
    }
    this.userMuted = false;
    try { localStorage.setItem('worldstage-muted', 'false'); } catch {}
    await this.activateFromGesture(); return this.enabled;
  }

  async activateFromGesture() {
    if (this.userMuted || document.hidden) return false;
    if (!this.context) this.create();
    if (this.context.state !== 'running') await this.context.resume();
    if (this.userMuted || document.hidden) return false;
    this.enabled = true; this.unlocked = true;
    this.master.gain.setTargetAtTime(0.85, this.context.currentTime, 0.3); this.onChange();
    void this.creatureAudio.prepare();
    try { await this.orchestra.load(); if (this.enabled) { this.orchestra.setScene(this.site); this.orchestra.setIntensity(this.intensity, this.trial, this.paused); } }
    catch { this.onChange(); }
    return true;
  }

  create() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('当前浏览器不支持配乐');
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    const limiter = this.context.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.25;
    this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 512; this.meter = new Float32Array(512);
    this.master.connect(limiter).connect(this.analyser).connect(this.context.destination);
    this.musicGain = this.context.createGain(); this.musicGain.gain.value = this.levels.music * (this.paused ? 0.65 : 1); this.musicGain.connect(this.master);
    this.ambienceGain = this.context.createGain(); this.ambienceGain.gain.value = this.levels.ambience; this.ambienceGain.connect(this.master);
    this.effectsGain = this.context.createGain(); this.effectsGain.gain.value = this.levels.effects; this.effectsGain.connect(this.master);
    this.orchestra = new Orchestra(this.context, this.musicGain, () => this.onChange());
    const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 6, this.context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < samples.length; index++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.018) / 1.018;
      samples[index] = previous * 3;
    }
    const source = this.context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 310;
    const gain = this.context.createGain();
    gain.gain.value = 0.16;
    source.connect(filter).connect(gain).connect(this.ambienceGain);
    source.start();
    this.waterFilter = filter; this.waterGain = gain;
    const convolver = this.context.createConvolver();
    const impulse = this.context.createBuffer(2, this.context.sampleRate * 4, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel++) { const samples = impulse.getChannelData(channel); for (let index = 0; index < samples.length; index++) samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / samples.length, 3) * 0.23; }
    convolver.buffer = impulse; const wet = this.context.createGain(); wet.gain.value = 0.34; convolver.connect(wet).connect(this.effectsGain); this.reverb = convolver;
    this.setScene(this.site);
    this.context.addEventListener('statechange', () => this.onChange());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.stopChant(); this.creatureAudio.stop(); this.context.suspend().catch(() => {}); }
      else if (this.enabled) this.context.resume().catch(() => this.onChange());
    });
  }

  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!this.context) return;
    if (paused) { this.stopChant(); this.stopWhaleCall(); this.creatureAudio.stop(); }
    this.orchestra.setIntensity(this.intensity, this.trial, paused);
    this.musicGain.gain.setTargetAtTime(this.levels.music * (paused ? 0.65 : 1), this.context.currentTime, 1);
    this.onChange();
  }

  theme() {
    const score = scoreFor(this.site); return { root: score.root - 24, water: score.water };
  }

  setScene(id) {
    this.site = id || 'open-sea'; if (!this.context) return;
    const theme = this.theme(); const now = this.context.currentTime;
    if (this.enabled) this.orchestra.setScene(this.site);
    this.waterFilter.frequency.setTargetAtTime(theme.water, now, 3);
    this.waterGain.gain.setTargetAtTime(id === 'vents' ? 0.18 : 0.12, now, 3); this.onChange();
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value)); if (!this.context) return;
    this.orchestra.setIntensity(this.intensity, this.trial, this.paused);
  }

  setTrial(active) { this.trial = active; this.orchestra?.setIntensity(this.intensity, active, this.paused); this.onChange(); }

  whaleCall(options = {}) { return this.creatureAudio.whale(options); }
  stopWhaleCall() { this.creatureAudio.stopWhale(); }

  setLevel(channel, value) {
    if (!(channel in this.levels) || !Number.isFinite(value)) return;
    this.levels[channel] = Math.max(0, Math.min(1, value));
    this[`${channel}Gain`]?.gain.setTargetAtTime(this.levels[channel] * (channel === 'music' && this.paused ? 0.65 : 1), this.context.currentTime, 0.2); this.onChange();
    if (channel === 'music') this.creatureAudio.restoreMusic();
  }

  inspect() {
    let peak = 0; if (this.analyser) { this.analyser.getFloatTimeDomainData(this.meter); for (const value of this.meter) peak = Math.max(peak, Math.abs(value)); }
    return { enabled: this.enabled, unlocked: this.unlocked, userMuted: this.userMuted, context: this.context?.state || 'locked', site: this.site, intensity: this.intensity, narration: this.narration, paused: this.paused, levels: { ...this.levels }, peak: Number(peak.toFixed(5)), orchestra: this.orchestra?.inspect() || { status: 'idle' }, creatureAudio: this.creatureAudio.inspect() };
  }

  note(midi, duration = 4, type = 'bell', volume = 0.05) {
    if (!this.enabled || !this.context || this.voices.size > 48) return;
    const now = this.context.currentTime;
    for (const [index, harmonic] of (type === 'bell' ? [1, 2.01, 3.98] : [1, 2]).entries()) {
      const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12) * harmonic;
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume / (index + 1) ** 2, now + (type === 'pad' ? 1.4 : 0.12)); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain); gain.connect(this.effectsGain); gain.connect(this.reverb); this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }; oscillator.start(now); oscillator.stop(now + duration + 0.1);
    }
  }

  ritual(id, text = '') {
    if (!this.enabled || !this.context || this.voices.size > 42) return false;
    this.orchestra?.accent('ritual');
    const now = this.context.currentTime;
    for (const [index, frequency] of [210, 590, 980].entries()) {
      const oscillator = this.context.createOscillator(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain();
      oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(id === 'gate' ? 61 : 73, now); oscillator.frequency.exponentialRampToValueAtTime(id === 'gate' ? 49 : 65, now + 4);
      filter.type = 'bandpass'; filter.frequency.setValueAtTime(frequency, now); filter.frequency.exponentialRampToValueAtTime(frequency * 0.68, now + 3); filter.Q.value = 7;
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.035 / (index + 1), now + 1); gain.gain.exponentialRampToValueAtTime(0.0001, now + 5);
      oscillator.connect(filter).connect(gain); gain.connect(this.effectsGain); gain.connect(this.reverb); this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); filter.disconnect(); gain.disconnect(); }; oscillator.start(); oscillator.stop(now + 5.1);
    }
    return text ? this.chant(text) : true;
  }

  chant(text) {
    if (!this.enabled || !this.narration || !globalThis.speechSynthesis) return false;
    const voice = speechSynthesis.getVoices().find(voice => voice.localService && /^zh/i.test(voice.lang));
    if (!voice) return false;
    this.stopChant(); const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 120)); utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.7; utterance.pitch = 0.45; utterance.volume = this.levels.effects;
    utterance.onstart = () => this.musicGain.gain.setTargetAtTime(this.levels.music * 0.4, this.context.currentTime, 0.2);
    const restore = () => this.musicGain.gain.setTargetAtTime(this.levels.music * (this.paused ? 0.65 : 1), this.context.currentTime, 0.7);
    utterance.onend = restore; utterance.onerror = restore; speechSynthesis.speak(utterance); return true;
  }

  stopChant() { globalThis.speechSynthesis?.cancel(); if (this.musicGain && this.context) this.musicGain.gain.setTargetAtTime(this.levels.music * (this.paused ? 0.65 : 1), this.context.currentTime, 0.7); }

  voice(creature, singing = false) {
    if (!this.enabled || !this.context) return;
    if (creature === 'whale') return this.whaleCall({ distance: 65 });
    if (creature === 'mermaid') return;
    const start = this.context.currentTime;
    const notes = singing ? [0, 1.5, 3.6] : [0];
    notes.forEach((offset, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const pan = this.context.createStereoPanner();
      const frequency = creature === 'whale' ? 145 + index * 35 : creature === 'jelly' ? 620 : 360;
      const duration = creature === 'whale' ? 3.2 : 0.7;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.3, start + offset + duration * 0.4);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.68, start + offset + duration);
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(creature === 'whale' ? 0.21 : 0.065, start + offset + duration * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
      pan.pan.value = index % 2 ? 0.3 : -0.3;
      oscillator.connect(gain).connect(pan).connect(this.effectsGain);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); pan.disconnect(); };
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration + 0.1);
    });
  }

  stopVoices() {
    for (const oscillator of this.voices) {
      try { oscillator.stop(); } catch {}
    }
    this.voices.clear();
  }

  bell() {
    if (!this.enabled || !this.context) return;
    const start = this.context.currentTime;
    for (const [index, frequency] of [174, 349, 492, 718].entries()) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.16 / (index + 1), start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 4.5);
      oscillator.connect(gain).connect(this.effectsGain);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + 4.6);
    }
  }
}
