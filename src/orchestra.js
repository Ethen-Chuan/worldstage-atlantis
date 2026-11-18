import { composeScore, orchestralMix, scoreFor, SCORES } from './orchestra-score.js';

export async function loadOrchestra(context) {
  const base = `${import.meta.env?.BASE_URL || '/'}audio/orchestra/`;
  const response = await fetch(`${base}manifest.json`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('配乐音色清单加载失败');
  const manifest = await response.json();
  return Promise.all(manifest.samples.map(async sample => {
    const response = await fetch(`${base}${sample.file}`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('管弦音色加载失败');
    return { ...sample, buffer: await context.decodeAudioData(await response.arrayBuffer()) };
  }));
}

export function playInstrument(context, samples, event, when, secondsPerBeat, destination, reverb) {
  const choices = samples.filter(sample => sample.instrument === event.instrument);
  const sample = choices.sort((first, second) => Math.abs(first.midi - event.midi) - Math.abs(second.midi - event.midi))[0];
  if (!sample) return null;
  const source = context.createBufferSource(); const envelope = context.createGain(); const pan = context.createStereoPanner();
  source.buffer = sample.buffer;
  source.playbackRate.value = event.instrument === 'cymbal' ? 1 : 2 ** ((event.midi - sample.midi) / 12);
  const sustained = ['violin', 'cello', 'horn', 'flute'].includes(event.instrument);
  const duration = Math.min(event.duration * secondsPerBeat, sample.buffer.duration / source.playbackRate.value - 0.03);
  const attack = sustained ? Math.min(0.22, duration * 0.15) : 0.008;
  const release = Math.min(sustained ? 0.6 : 0.3, duration * 0.3);
  const start = Math.max(when, context.currentTime);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(event.gain, start + attack);
  envelope.gain.setValueAtTime(event.gain, start + Math.max(attack, duration - release));
  envelope.gain.linearRampToValueAtTime(0, start + duration);
  pan.pan.value = event.pan;
  source.connect(envelope).connect(pan).connect(destination);
  if (reverb) pan.connect(reverb);
  source.onended = () => { source.disconnect(); envelope.disconnect(); pan.disconnect(); };
  source.start(start); source.stop(start + duration + 0.01);
  return source;
}

export function hallReverb(context, destination) {
  const convolver = context.createConvolver(); const wet = context.createGain(); wet.gain.value = 0.3;
  const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 3.4), context.sampleRate);
  let seed = 2049;
  for (let channel = 0; channel < 2; channel++) {
    const samples = impulse.getChannelData(channel); let smooth = 0;
    for (let index = 0; index < samples.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      smooth = smooth * 0.6 + (seed / 4294967296 * 2 - 1) * 0.4;
      samples[index] = smooth * Math.pow(1 - index / samples.length, 2.7);
    }
  }
  convolver.buffer = impulse; convolver.connect(wet).connect(destination); return convolver;
}

export class Orchestra {
  constructor(context, destination, onChange = () => {}) {
    this.context = context; this.destination = destination; this.onChange = onChange; this.samples = [];
    this.current = null; this.retired = []; this.status = 'idle'; this.intensity = 0; this.trial = false; this.paused = false;
    this.timer = setInterval(() => this.tick(), 80);
  }

  async load() {
    if (this.samples.length) return;
    if (this.loading) return this.loading;
    this.status = 'loading'; this.onChange();
    this.loading = loadOrchestra(this.context).then(samples => { this.samples = samples; this.status = 'ready'; }).catch(error => { this.status = 'error'; throw error; }).finally(() => { this.loading = null; this.onChange(); });
    return this.loading;
  }

  setScene(site) {
    const id = SCORES[site] ? site : 'palace';
    if (!this.samples.length || this.current?.id === id) return;
    const now = this.context.currentTime;
    if (this.current) {
      this.current.bus.gain.cancelAndHoldAtTime(now); this.current.bus.gain.linearRampToValueAtTime(0, now + 4);
      this.current.expires = now + 4.1; this.retired.push(this.current);
    }
    const bus = this.context.createGain(); bus.gain.setValueAtTime(0, now); bus.gain.linearRampToValueAtTime(1, now + (this.current ? 4 : 1.2)); bus.connect(this.destination);
    const layers = Object.fromEntries(Object.keys(orchestralMix(0)).map(name => { const gain = this.context.createGain(); gain.connect(bus); return [name, gain]; }));
    const reverb = hallReverb(this.context, bus);
    const sends = Object.fromEntries(Object.entries(layers).map(([name, gain]) => { const send = this.context.createGain(); send.gain.value = 0.55; gain.connect(send).connect(reverb); return [name, send]; }));
    this.current = { id, score: composeScore(id), bus, layers, sends, reverb, start: now + 0.06, index: 0, loop: 0, voices: new Set() };
    this.setIntensity(this.intensity, this.trial, this.paused); this.tick(); this.onChange();
  }

  setIntensity(intensity, trial = this.trial, paused = this.paused) {
    this.intensity = intensity; this.trial = trial; this.paused = paused;
    const mix = orchestralMix(paused ? 0 : intensity, !paused && trial);
    if (paused) mix.percussion = 0;
    const mixKey = JSON.stringify(Object.values(mix).map(value => Number(value.toFixed(2))));
    if (this.current?.mixKey === mixKey) return;
    if (this.current) this.current.mixKey = mixKey;
    for (const [name, gain] of Object.entries(this.current?.layers || {})) gain.gain.setTargetAtTime(mix[name], this.context.currentTime, 1.4);
  }

  tick() {
    const now = this.context.currentTime;
    this.retired = this.retired.filter(track => {
      if (now < track.expires) return true;
      for (const source of track.voices) { try { source.stop(); } catch {} }
      Object.values(track.layers).forEach(node => node.disconnect()); Object.values(track.sends).forEach(node => node.disconnect()); track.reverb.disconnect(); track.bus.disconnect(); return false;
    });
    const track = this.current;
    if (!track || this.context.state !== 'running') return;
    const beatDuration = 60 / track.score.tempo;
    const elapsedBeats = (now - track.start) / beatDuration;
    if (elapsedBeats > track.loop * track.score.beats + track.score.events[track.index].beat + 1) {
      track.loop = Math.floor(Math.max(0, elapsedBeats) / track.score.beats);
      track.index = track.score.events.findIndex(event => event.beat >= elapsedBeats % track.score.beats);
      if (track.index < 0) { track.index = 0; track.loop++; }
    }
    for (let count = 0; count < 80; count++) {
      const event = track.score.events[track.index]; const when = track.start + (track.loop * track.score.beats + event.beat) * beatDuration;
      if (when > now + 0.3) break;
      const voice = playInstrument(this.context, this.samples, event, when, beatDuration, track.layers[event.layer]);
      if (voice) { track.voices.add(voice); voice.addEventListener('ended', () => track.voices.delete(voice)); }
      track.index++; if (track.index === track.score.events.length) { track.index = 0; track.loop++; }
    }
  }

  accent(kind = 'arrival') {
    const track = this.current; if (!track || this.context.state !== 'running') return;
    const now = this.context.currentTime; const root = scoreFor(track.id).root;
    const events = kind === 'ritual' ? [['timpani', root - 24, 0, 0.3], ['cymbal', root, 0.4, 0.14], ['horn', root - 12, 0.1, 0.25], ['horn', root - 5, 0.14, 0.17]] : [['harp', root + 12, 0, 0.15], ['glock', root + 19, 0.3, 0.08]];
    for (const [instrument, midi, delay, gain] of events) {
      const voice = playInstrument(this.context, this.samples, { instrument, midi, gain, pan: 0, duration: 4 }, now + delay, 1, track.layers.melody);
      if (voice) { track.voices.add(voice); voice.addEventListener('ended', () => track.voices.delete(voice)); }
    }
  }

  inspect() {
    const track = this.current;
    const layers = orchestralMix(this.paused ? 0 : this.intensity, !this.paused && this.trial); if (this.paused) layers.percussion = 0;
    return { status: this.status, theme: track?.score.title || null, instruments: this.samples.length, activeVoices: (track?.voices.size || 0) + this.retired.reduce((count, track) => count + track.voices.size, 0), crossfading: this.retired.length > 0, bar: track ? Math.floor(Math.max(0, this.context.currentTime - track.start) / (60 / track.score.tempo) / 4) % 16 + 1 : 0, layers };
  }
}
