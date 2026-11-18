export class OceanSound {
  constructor() {
    this.enabled = false;
    this.paused = false;
    this.context = null;
    this.master = null;
    this.voices = new Set();
    this.site = 'palace'; this.intensity = 0; this.phrase = 0; this.score = []; this.narration = false;
  }

  async toggle() {
    if (!this.context) this.create();
    if (this.paused) await this.context.suspend(); else await this.context.resume();
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopChant();
    this.master.gain.setTargetAtTime(this.enabled ? 0.38 : 0, this.context.currentTime, 0.5);
    return this.enabled;
  }

  create() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('当前浏览器不支持环境声音');
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
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
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.waterFilter = filter; this.waterGain = gain;
    const drone = this.context.createOscillator();
    const droneGain = this.context.createGain();
    drone.frequency.value = 52;
    droneGain.gain.value = 0.09;
    drone.connect(droneGain).connect(this.master);
    drone.start();
    const convolver = this.context.createConvolver();
    const impulse = this.context.createBuffer(2, this.context.sampleRate * 4, this.context.sampleRate);
    for (let channel = 0; channel < 2; channel++) { const samples = impulse.getChannelData(channel); for (let index = 0; index < samples.length; index++) samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / samples.length, 3) * 0.23; }
    convolver.buffer = impulse; const wet = this.context.createGain(); wet.gain.value = 0.34; convolver.connect(wet).connect(this.master); this.reverb = convolver;
    for (let index = 0; index < 4; index++) {
      const oscillator = this.context.createOscillator(); const gain = this.context.createGain(); const lowpass = this.context.createBiquadFilter();
      oscillator.type = index === 0 ? 'sine' : 'triangle'; oscillator.detune.value = index % 2 ? -4 : 3;
      lowpass.type = 'lowpass'; lowpass.frequency.value = 530; gain.gain.value = index === 0 ? 0.08 : 0.023;
      oscillator.connect(lowpass).connect(gain); gain.connect(this.master); gain.connect(convolver); oscillator.start(); this.score.push({ oscillator, gain });
    }
    this.setScene(this.site);
    this.scoreTimer = setInterval(() => {
      if (!this.enabled || this.paused || document.hidden) return;
      const theme = this.theme(); const interval = theme.notes[this.phrase++ % theme.notes.length];
      this.note(theme.root + 24 + interval, 7, 'bell', 0.035 + this.intensity * 0.035);
      if (this.phrase % 3 === 0) this.note(theme.root + 12, 9, 'pad', 0.05);
    }, 4800);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.stopChant(); this.context.suspend(); } else if (this.enabled && !this.paused) this.context.resume(); });
  }

  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!this.context) return;
    if (paused) { this.stopChant(); this.context.suspend().catch(() => {}); }
    else if (this.enabled && !document.hidden) this.context.resume().catch(() => {});
  }

  theme() {
    return {
      palace: { root: 38, notes: [0, 7, 3, 10, 7], water: 260 }, gate: { root: 33, notes: [0, 7, 1, 5, 7], water: 175 },
      garden: { root: 36, notes: [0, 3, 7, 10, 5], water: 360 }, choir: { root: 41, notes: [0, 7, 10, 3, 14], water: 210 },
      vortex: { root: 38, notes: [0, 7, 14, 10, 3], water: 230 }, prism: { root: 43, notes: [0, 4, 7, 11, 14], water: 430 },
      vents: { root: 31, notes: [0, 7, 3, 12, 10], water: 140 },
    }[this.site] || { root: 36, notes: [0, 7, 3, 10], water: 280 };
  }

  setScene(id) {
    this.site = id || 'open-sea'; if (!this.context) return;
    const theme = this.theme(); const now = this.context.currentTime;
    this.score.forEach(({ oscillator }, index) => { oscillator.frequency.cancelScheduledValues(now); oscillator.frequency.setTargetAtTime(440 * 2 ** ((theme.root + [0, 12, 19, 27][index] - 69) / 12), now, 2.4); });
    this.waterFilter.frequency.setTargetAtTime(theme.water, now, 3);
    this.waterGain.gain.setTargetAtTime(id === 'vents' ? 0.23 : 0.13, now, 3);
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value)); if (!this.context) return;
    this.score.forEach(({ gain }, index) => gain.gain.setTargetAtTime((index ? 0.023 : 0.08) * (1 + this.intensity * 0.65), this.context.currentTime, 1.6));
  }

  note(midi, duration = 4, type = 'bell', volume = 0.05) {
    if (!this.enabled || !this.context || this.voices.size > 48) return;
    const now = this.context.currentTime;
    for (const [index, harmonic] of (type === 'bell' ? [1, 2.01, 3.98] : [1, 2]).entries()) {
      const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12) * harmonic;
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume / (index + 1) ** 2, now + (type === 'pad' ? 1.4 : 0.12)); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain); gain.connect(this.master); gain.connect(this.reverb); this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }; oscillator.start(now); oscillator.stop(now + duration + 0.1);
    }
  }

  ritual(id, text = '') {
    if (!this.enabled || !this.context || this.voices.size > 42) return false;
    this.note(this.theme().root, 10, 'pad', 0.12);
    const now = this.context.currentTime;
    for (const [index, frequency] of [210, 590, 980].entries()) {
      const oscillator = this.context.createOscillator(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain();
      oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(id === 'gate' ? 61 : 73, now); oscillator.frequency.exponentialRampToValueAtTime(id === 'gate' ? 49 : 65, now + 4);
      filter.type = 'bandpass'; filter.frequency.setValueAtTime(frequency, now); filter.frequency.exponentialRampToValueAtTime(frequency * 0.68, now + 3); filter.Q.value = 7;
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.035 / (index + 1), now + 1); gain.gain.exponentialRampToValueAtTime(0.0001, now + 5);
      oscillator.connect(filter).connect(gain); gain.connect(this.master); gain.connect(this.reverb); this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); filter.disconnect(); gain.disconnect(); }; oscillator.start(); oscillator.stop(now + 5.1);
    }
    return text ? this.chant(text) : true;
  }

  chant(text) {
    if (!this.enabled || !this.narration || !globalThis.speechSynthesis) return false;
    const voice = speechSynthesis.getVoices().find(voice => voice.localService && /^zh/i.test(voice.lang));
    if (!voice) return false;
    this.stopChant(); const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 100)); utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.7; utterance.pitch = 0.45; utterance.volume = 0.55; speechSynthesis.speak(utterance); return true;
  }

  stopChant() { globalThis.speechSynthesis?.cancel(); }

  voice(creature, singing = false) {
    if (!this.enabled || !this.context) return;
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
      oscillator.connect(gain).connect(pan).connect(this.master);
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
      oscillator.connect(gain).connect(this.master);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + 4.6);
    }
  }
}
