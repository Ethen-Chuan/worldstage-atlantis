import * as THREE from 'three';
import { createWhale } from './creatures.js';
import { seaHeight } from './terrain.js';
import { seededRandom } from './core.js';
import { actorHull } from './collision-world.js';

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
    const sculpture = entry.root.getObjectByName('garden-of-giants');
    if (!this.group) {
      this.group = new THREE.Group(); this.group.userData.noPick = true; this.ocean.scene.add(this.group);
      this.whale = createWhale(); this.whale.root.scale.setScalar(1.85); this.group.add(this.whale.root);
      this.materials = new Map();
      this.whale.root.traverse(object => { if (object.material) { object.material.transparent = true; this.materials.set(object.material, object.material.opacity); } });
      const random = seededRandom(6179); const particles = new Float32Array(1800 * 3);
      for (let index = 0; index < 1800; index++) { const angle = random() * Math.PI * 2; const radius = Math.sqrt(random()); particles.set([Math.cos(angle) * radius, random() * (1 - radius), Math.sin(angle) * radius], index * 3); }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
      this.silt = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#8f9b8b', size: 1.8, transparent: true, opacity: 0, depthWrite: false })); this.group.add(this.silt);
    }
    const sculptureMaterials = [];
    sculpture?.traverse(object => {
      if (!object.material || Array.isArray(object.material)) return;
      const original = object.material; const material = original.clone(); material.transparent = true;
      object.material = material; sculptureMaterials.push({ object, original, material });
    });
    this.active = { start: this.ocean.time, sculpture, sculptureMaterials, originalVisible: sculpture?.visible, stoppedVoice: false };
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
    this.group.position.set(-530, seaHeight(-530, -325), -325).sub(this.ocean.worldOffset);
    const descent = THREE.MathUtils.smoothstep(age, 10, 38);
    this.whale.root.position.set(Math.sin(age * 0.08) * (1 - descent) * 4, 68 * (1 - descent) + 7, (1 - descent) * 7);
    if (age < 10 && delta > 0) this.whale.animate(age * 0.4);
    this.whale.root.rotation.set(descent * 0.08, -0.4, -descent * 0.32);
    const clearance = Math.max(...actorHull({ root: this.whale.root, species: 'whale' }).map(probe => probe.radius - probe.offset.y));
    this.whale.root.position.y = 68 * (1 - descent) + clearance;
    const dissolve = THREE.MathUtils.smoothstep(age, 48, 63);
    for (const [material, opacity] of this.materials) material.opacity = opacity * (1 - dissolve) * THREE.MathUtils.smoothstep(age, 0, 7);
    this.whale.root.visible = dissolve < 1;
    this.silt.scale.set(12 + THREE.MathUtils.smoothstep(age, 38, 66) * 62, 8 + THREE.MathUtils.smoothstep(age, 38, 52) * 18, 18 + THREE.MathUtils.smoothstep(age, 38, 66) * 66);
    this.silt.material.opacity = THREE.MathUtils.smoothstep(age, 38, 43) * (1 - THREE.MathUtils.smoothstep(age, 56, 74)) * 0.42;
    const gardenVisibility = age < 10 ? 1 - THREE.MathUtils.smoothstep(age, 0, 8) : THREE.MathUtils.smoothstep(age, 50, 64);
    if (this.active.sculpture) this.active.sculpture.visible = gardenVisibility > 0;
    for (const entry of this.active.sculptureMaterials) { entry.material.opacity = entry.original.opacity * gardenVisibility; entry.material.depthWrite = gardenVisibility > 0.95; }
    if (age >= 63 && !this.active.returnedLife) { this.active.returnedLife = true; this.ocean.play.awaken('garden', { quiet: true }); }
  }

  stop() {
    if (this.active?.sculpture) this.active.sculpture.visible = this.active.originalVisible;
    for (const entry of this.active?.sculptureMaterials || []) { entry.object.material = entry.original; entry.material.dispose(); }
    if (this.group) this.group.visible = false;
    if (this.active) this.sound.stopWhaleCall();
    this.active = null;
  }

  inspect() { return this.active ? { ...whaleFallStage(this.ocean.time - this.active.start), elapsed: this.ocean.time - this.active.start, artisticTimeCompression: true } : null; }
}
