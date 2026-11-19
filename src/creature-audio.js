export class CreatureAudio {
  constructor(sound) {
    this.sound = sound; this.buffers = new Map(); this.loading = null; this.activeSong = null; this.activeWhale = null;
    this.status = 'idle'; this.nextSong = 0; this.nextWhale = 8; this.lastSpatial = -1; this.missing = [];
  }

  async prepare() {
    if (this.status === 'ready') return;
    if (this.loading) return this.loading;
    this.status = 'loading'; this.sound.onChange();
    this.loading = Promise.all(['mermaid-song', 'distant-whale'].map(async name => {
      if (this.buffers.has(name)) return;
      const response = await fetch(`./audio/voices/${name}.mp3`);
      if (!response.ok || !response.headers.get('content-type')?.includes('audio')) throw new Error(name);
      const buffer = await this.sound.context.decodeAudioData(await response.arrayBuffer());
      if (buffer.duration < 20) throw new Error(name);
      this.buffers.set(name, buffer);
    }).map(promise => promise.catch(() => {}))).then(() => {
      this.missing = ['mermaid-song', 'distant-whale'].filter(name => !this.buffers.has(name));
      this.status = this.missing.length ? 'error' : 'ready'; this.loading = null; this.sound.onChange();
    });
    return this.loading;
  }

  play(name, distance, pan, duration, offset = 0) {
    const sound = this.sound; const context = sound.context; const buffer = this.buffers.get(name);
    if (!buffer || !sound.enabled || context?.state !== 'running' || sound.paused) return null;
    const source = context.createBufferSource(); source.buffer = buffer;
    const envelope = context.createGain(); const gain = context.createGain(); const spatial = context.createStereoPanner(); const filter = context.createBiquadFilter();
    const now = context.currentTime; const length = Math.min(duration, buffer.duration - offset);
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(1, now + 2);
    envelope.gain.setValueAtTime(1, now + Math.max(2, length - 4)); envelope.gain.linearRampToValueAtTime(0, now + length);
    gain.gain.value = 0.82 / (1 + distance / 100);
    spatial.pan.value = Math.max(-0.85, Math.min(0.85, pan)); filter.type = 'lowpass'; filter.frequency.value = Math.max(900, 6500 - distance * 12);
    source.connect(filter).connect(envelope).connect(gain).connect(spatial).connect(sound.effectsGain); gain.connect(sound.reverb);
    sound.voices.add(source);
    const voice = { source, gain, spatial, end: now + length, actor: null };
    source.onended = () => {
      sound.voices.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect(); gain.disconnect(); spatial.disconnect();
      if (this.activeSong === voice) { this.setSinging(voice.actor, false); this.activeSong = null; this.restoreMusic(); }
      if (this.activeWhale === voice) this.activeWhale = null;
      sound.onChange();
    };
    source.start(now, offset, length); return voice;
  }

  setSinging(actor, value) { if (actor) (actor.shape || actor.root).userData.singing = value; }
  restoreMusic() {
    const sound = this.sound;
    if (sound.musicGain && sound.context) sound.musicGain.gain.setTargetAtTime(sound.levels.music * (this.activeSong ? 0.28 : sound.paused ? 0.65 : 1), sound.context.currentTime, 1.5);
  }

  sing(actor, { force = false } = {}) {
    const now = this.sound.context?.currentTime || 0;
    if (this.activeSong) return true;
    if (this.activeWhale || (!force && now < this.nextSong)) return false;
    const voice = this.play('mermaid-song', actor?.distance || 25, actor?.pan || 0, 55, 12);
    if (!voice) return false;
    voice.actor = actor; voice.maxDistance = force ? 320 : 160; this.activeSong = voice; this.setSinging(actor, true);
    this.nextSong = now + 108; this.nextWhale = Math.max(this.nextWhale, now + 62);
    this.restoreMusic(); this.sound.onChange(); return true;
  }

  whale({ distance = 180, pan = -0.5, force = false } = {}) {
    const now = this.sound.context?.currentTime || 0;
    if (this.activeSong || this.activeWhale || (!force && now < this.nextWhale)) return false;
    const voice = this.play('distant-whale', distance, pan, 22, 4);
    if (!voice) return false;
    this.activeWhale = voice; this.nextWhale = now + 48; this.sound.onChange(); return true;
  }

  update(actors, { falling = false } = {}) {
    const sound = this.sound;
    if (!sound.unlocked || !sound.context) return;
    if (this.status === 'idle') void this.prepare();
    if (!sound.enabled || sound.paused || sound.context.state !== 'running') { if (this.activeSong || this.activeWhale) this.stop(); return; }
    if (falling) return;
    const now = sound.context.currentTime;
    if (this.activeSong) {
      const actor = actors.find(actor => actor.root === this.activeSong.actor?.root);
      if (!actor || actor.distance > this.activeSong.maxDistance) { this.stopSong(); return; }
      if (now - this.lastSpatial >= 0.25) {
        this.activeSong.gain.gain.setTargetAtTime(0.82 / (1 + actor.distance / 100), now, 1.5);
        this.activeSong.spatial.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, actor.pan || 0)), now, 0.8); this.lastSpatial = now;
      }
    } else {
      const mermaid = actors.find(actor => actor.species === 'mermaid' && actor.distance < 100);
      if (mermaid && now >= this.nextSong && !this.activeWhale) this.sing(mermaid);
      else if (now >= this.nextWhale) {
        const whale = actors.find(actor => actor.species === 'whale');
        if (whale) this.whale({ distance: Math.max(100, whale.distance), pan: whale.pan });
      }
    }
  }

  stopSong() {
    const voice = this.activeSong;
    if (!voice) return;
    this.setSinging(voice.actor, false); this.activeSong = null;
    const now = this.sound.context.currentTime; voice.gain.gain.setTargetAtTime(0, now, 0.3);
    try { voice.source.stop(now + 1.2); } catch {}
    this.restoreMusic(); this.sound.onChange();
  }
  stopWhale() { if (this.activeWhale) { try { this.activeWhale.source.stop(); } catch {} this.activeWhale = null; } }
  stop() { this.stopSong(); this.stopWhale(); }
  inspect() { return { status: this.status, missing: [...this.missing], singing: Boolean(this.activeSong), whaleCalling: Boolean(this.activeWhale), song: '德彪西《Spleen》· 法语歌词 · Xiaobo Su / Giorgi Latsabidze', whale: 'NOAA PMEL 阿拉斯加座头鲸 · 校正源文件加速，空间化混音' }; }
}
