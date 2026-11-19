import * as THREE from 'three';
import { createWhale } from './creatures.js';
import { seededRandom } from './core.js';
import { WHALE_REST, installReveal } from './whale-remains.js';

const ease = (age, start, end) => { const amount = THREE.MathUtils.clamp((age - start) / (end - start), 0, 1); return amount ** 3 * (amount * (amount * 6 - 15) + 10); };

export function whaleFallPose(age) {
  const descent = ease(age, 10, 38); const dissolve = ease(age, 48, 64);
  return {
    position: [Math.sin(age * 0.08) * (1 - descent) * 4, WHALE_REST.position[1] + 68 * (1 - descent), 7 * (1 - descent)],
    rotation: [WHALE_REST.rotation[0] * descent, WHALE_REST.rotation[1], WHALE_REST.rotation[2] * descent],
    effort: 1 - descent, flesh: (1 - dissolve) * ease(age, 0, 7), bones: age < 10 ? 1 - ease(age, 0, 5) : dissolve,
  };
}

export function whaleFallStage(age) {
  if (!Number.isFinite(age) || age < 0 || age >= 76) return { phase: 'idle', label: '', progress: 0 };
  if (age < 10) return { phase: 'memory', label: '生前的回声 · 鲸鸣从远方缓缓退去', progress: age / 10 };
  if (age < 38) return { phase: 'descent', label: '巨鲸沉入深海 · 此后只剩海流', progress: (age - 10) / 28 };
  if (age < 48) return { phase: 'settle', label: '触及海床 · 沉积物沿海底缓缓铺开', progress: (age - 38) / 10 };
  return { phase: 'succession', label: '时间流逝 · 遗骸供养食腐者与微生物，生命接续', progress: (age - 48) / 28 };
}

export class WhaleFall {
  constructor(ocean, sound) { this.ocean = ocean; this.sound = sound; this.active = null; this.group = null; }

  start() {
    if (this.ocean.currentLandmark?.id !== 'garden') return false;
    this.stop(); this.ocean.play.stop(); this.ocean.embodiment.exit(false);
    this.ocean.landmarks.prepare('garden');
    const entry = this.ocean.landmarks.entries.find(item => item.landmark.id === 'garden');
    const sculpture = entry.root.getObjectByName('whale-remains');
    if (!this.group) {
      this.group = new THREE.Group(); this.group.userData.noPick = true; this.ocean.scene.add(this.group);
      this.whale = createWhale({ falling: true }); this.whale.root.scale.setScalar(WHALE_REST.scale); this.group.add(this.whale.root);
      const random = seededRandom(6179); const particles = new Float32Array(1800 * 3);
      for (let index = 0; index < 1800; index++) { const angle = random() * Math.PI * 2; const radius = Math.sqrt(random()); particles.set([Math.cos(angle) * radius, random() * (1 - radius), Math.sin(angle) * radius], index * 3); }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
      this.silt = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#8f9b8b', size: 1.8, transparent: true, opacity: 0, depthWrite: false })); this.group.add(this.silt);
    }
    const flesh = { value: 0 }; const bones = { value: 1 }; const cleanup = [];
    for (const [root, uniform] of [[this.whale.root, flesh], [sculpture, bones]]) root?.traverse(object => { if (object.isMesh && !Array.isArray(object.material)) cleanup.push(installReveal(object, uniform)); });
    this.active = { start: this.ocean.time, entry, sculpture, flesh, bones, cleanup, originalVisible: sculpture?.visible, stoppedVoice: false };
    this.group.visible = true;
    this.sound.creatureAudio?.stop();
    this.sound.whaleCall({ distance: 90, pan: -0.2, force: true });
    return true;
  }

  update(delta) {
    if (!this.active) return;
    if (this.ocean.currentLandmark?.id !== 'garden') { this.stop(); return; }
    const age = this.ocean.time - this.active.start;
    const stage = whaleFallStage(age);
    if (stage.phase === 'idle') { this.stop(); return; }
    if (age >= 10 && !this.active.stoppedVoice) { this.sound.stopWhaleCall(); this.active.stoppedVoice = true; }
    this.group.position.copy(this.active.entry.root.position);
    const pose = whaleFallPose(age);
    this.whale.root.position.fromArray(pose.position); this.whale.root.rotation.set(...pose.rotation);
    this.whale.animate(age * 0.4, pose.effort);
    this.active.flesh.value = pose.flesh; this.active.bones.value = pose.bones;
    this.whale.root.visible = pose.flesh > 0;
    this.silt.scale.set(12 + THREE.MathUtils.smoothstep(age, 38, 66) * 62, 8 + THREE.MathUtils.smoothstep(age, 38, 52) * 18, 18 + THREE.MathUtils.smoothstep(age, 38, 66) * 66);
    this.silt.material.opacity = THREE.MathUtils.smoothstep(age, 38, 43) * (1 - THREE.MathUtils.smoothstep(age, 56, 74)) * 0.42;
    if (this.active.sculpture) this.active.sculpture.visible = pose.bones > 0;
    if (age >= 64 && !this.active.returnedLife) { this.active.returnedLife = true; this.ocean.play.awaken('garden', { quiet: true }); }
  }

  stop() {
    if (this.active?.sculpture) this.active.sculpture.visible = this.active.originalVisible;
    for (const cleanup of this.active?.cleanup || []) cleanup();
    if (this.group) this.group.visible = false;
    if (this.active) this.sound.stopWhaleCall();
    if (this.active && this.ocean.renderer) { this.ocean.renderer.shadowMap.needsUpdate = true; this.ocean.occlusion.lastView = null; }
    this.active = null;
  }

  inspect() { return this.active ? { ...whaleFallStage(this.ocean.time - this.active.start), elapsed: this.ocean.time - this.active.start, artisticTimeCompression: true } : null; }
}
