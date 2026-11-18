export class OceanSound {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.master = null;
    this.voices = new Set();
  }

  async toggle() {
    if (!this.context) this.create();
    await this.context.resume();
    this.enabled = !this.enabled;
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
    gain.gain.value = 0.5;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    const drone = this.context.createOscillator();
    const droneGain = this.context.createGain();
    drone.frequency.value = 52;
    droneGain.gain.value = 0.09;
    drone.connect(droneGain).connect(this.master);
    drone.start();
  }

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
