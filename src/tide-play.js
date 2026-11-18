import * as THREE from 'three';
import { LANDMARKS } from './landmarks.js';
import { createManta, createWhale } from './creatures.js';
import { createShark } from './shark.js';
import { createTurtle } from './mythic-creatures.js';
import { seaHeight } from './terrain.js';
import { seededRandom } from './core.js';
import { planWorld } from './world-planner.js';

export const SITE_PLAY = Object.freeze({
  palace: { name: '圣城巡礼', instruction: '依次穿过五道金环，让沉睡的城重新回应。', mode: 'route', colors: ['#e5b766', '#8cbaa4', '#ebce9e'] },
  gate: { name: '回声寻径', instruction: '循着逐次亮起的光环，驾驭生物把回声带过天门。', mode: 'route', colors: ['#a6bfd4', '#e3bd83', '#a695bc'] },
  garden: { name: '鲸落授光', instruction: '自由寻找五枚光种，将它们送回沉眠的花园。', mode: 'collect', colors: ['#bba56f', '#91b8a4', '#dab0a3'] },
  choir: { name: '星潮合奏', instruction: '依次点亮音符，每一道环都会加入一层回声。', mode: 'route', colors: ['#a7badc', '#c3afd6', '#dbcd9f'] },
  vortex: { name: '穿越星瞳', instruction: '驾驭生物沿着星轨穿环，完成后展开星海盛典。', mode: 'route', colors: ['#edbc70', '#83c8c1', '#c4a2c1'] },
  prism: { name: '珊瑚播光', instruction: '按任意顺序收集五枚光种，让光回到珊瑚枝脉。', mode: 'collect', colors: ['#daa7b6', '#9bcac0', '#e4c58b'] },
  vents: { name: '潮汐共振', instruction: '观察光环的呼吸，在金色明亮的时刻穿过。', mode: 'rhythm', colors: ['#efb56d', '#d49bad', '#9baed0'] },
});

export function segmentDistance(point, start, end) {
  const movement = end.map((value, index) => value - start[index]);
  const length = movement.reduce((sum, value) => sum + value * value, 0);
  const fraction = length ? Math.max(0, Math.min(1, point.reduce((sum, value, index) => sum + (value - start[index]) * movement[index], 0) / length)) : 0;
  return Math.hypot(...point.map((value, index) => value - start[index] - movement[index] * fraction));
}

export function trialCourse(site, round = 0) {
  const origin = new THREE.Vector3(...site.camera);
  const direction = new THREE.Vector3(...site.target).sub(origin).setY(0).normalize();
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  origin.addScaledVector(direction, 18); origin.y = Math.max(origin.y, seaHeight(origin.x, origin.z) + 45);
  const mirror = round % 2 ? -1 : 1;
  const points = [[-30, 30], [0, 58], [35, 44], [44, 0], [12, -20]].map(([lateral, forward], index) => {
    const point = origin.clone().addScaledVector(side, lateral * mirror).addScaledVector(direction, forward);
    point.y = Math.max(origin.y + Math.sin((index + 1) * 1.15) * 6, seaHeight(point.x, point.z) + 38);
    return point.toArray();
  });
  return { origin: origin.toArray(), heading: Math.atan2(-direction.x, -direction.z), points };
}

export function ritualRequest(text) {
  const plan = planWorld(text);
  return plan?.kind === 'ritual' && plan.args.site ? { id: plan.args.site, summon: plan.args.summon || null } : null;
}

export function festivalStage(elapsed) {
  if (!(elapsed >= 0) || elapsed >= 36) return { name: '平静', strength: 0 };
  if (elapsed < 5) return { name: '海流蓄光', strength: elapsed / 5 * 0.5 };
  if (elapsed < 23) return { name: '万象绽放', strength: 0.65 + Math.sin((elapsed - 5) / 18 * Math.PI) * 0.25 };
  if (elapsed < 30) return { name: '星海齐鸣', strength: 1 };
  return { name: '余辉归海', strength: (36 - elapsed) / 6 };
}

export function playMarkup() {
  return `<section id="site-play" class="site-play" aria-label="此地的互动"><span class="eyebrow">LET THE WORLD ANSWER</span><h3 id="site-play-name">圣城巡礼</h3><p id="site-play-hint">成为生物，把光带回海底。</p><div class="site-play-actions"><button id="trial-start">化身 · 开始探索 ↗</button><button id="festival-start">奏响盛典</button></div><label class="trial-species-label">以谁的视角 <select id="trial-species"><option value="manta">蝠鲼</option><option value="shark">灰礁鲨</option><option value="turtle">海龟</option><option value="whale">巨鲸</option></select></label><button id="ritual-example" class="ritual-example">试试与回声天门对话 →</button></section><section id="trial-hud" class="trial-hud" aria-label="海域试炼进度" hidden><span class="eyebrow" id="trial-category"></span><h3 id="trial-name"></h3><p id="trial-instruction"></p><div><strong id="trial-score">0 / 5</strong><span id="trial-time"></span><button id="trial-exit">结束试炼</button></div><p id="trial-feedback" role="status"></p></section><div id="trial-bearing" class="trial-bearing" hidden><span>◇</span><b></b></div><div id="festival-caption" class="festival-caption" hidden><span class="eyebrow">A CEREMONY OF LIGHT</span><h3 id="festival-title"></h3><p id="festival-stage"></p><button id="festival-stop">让海流平静</button></div>`;
}

function lightFestival() {
  const count = 48000; const positions = new Float32Array(count * 3); const seeds = new Float32Array(count * 4); const trails = new Float32Array(count); const random = seededRandom(7701);
  for (let spark = 0; spark < count / 5; spark++) {
    const seed = [random(), random(), random(), Math.floor(spark / 320)];
    for (let tail = 0; tail < 5; tail++) { const index = spark * 5 + tail; seeds.set(seed, index * 4); trails[index] = tail / 4; }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4)); geometry.setAttribute('trail', new THREE.BufferAttribute(trails, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { age: { value: -1 }, strength: { value: 1 }, tintA: { value: new THREE.Color() }, tintB: { value: new THREE.Color() }, tintC: { value: new THREE.Color() }, ratio: { value: 1 } },
    vertexShader: `attribute vec4 seed; attribute float trail; uniform float age; uniform float ratio; varying float brightness; varying float shade;
    void main(){
      float burst = seed.w;
      float launch = burst < 21.0 ? 1.0 + burst * 0.85 : 22.0 + (burst - 21.0) * 0.36;
      float local = age - launch - trail * 0.38;
      float phase = burst * 2.39996;
      vec3 center = vec3(sin(phase) * (32.0 + mod(burst,3.0) * 38.0), 24.0 + mod(burst,4.0) * 16.0, cos(phase) * 24.0 + 18.0);
      float rise = clamp(local / 2.2, 0.0, 1.0);
      vec3 point = center + vec3(sin(seed.x * 6.283) * 0.6, rise * rise * 56.0, cos(seed.x * 6.283) * 0.6);
      float bloomAge = max(0.0, local - 2.2);
      float longitude = seed.x * 6.283185;
      float latitude = acos(2.0 * seed.y - 1.0);
      vec3 direction = vec3(sin(latitude)*cos(longitude),cos(latitude),sin(latitude)*sin(longitude));
      float spread = (1.0 - exp(-bloomAge * 0.58)) * (36.0 + mod(burst,4.0) * 11.0);
      float crown = 0.78 + 0.22 * cos(longitude * (5.0 + mod(burst,3.0)));
      point += direction * spread * crown * (0.68 + seed.z * 0.32);
      point.y += bloomAge * 1.4 + sin(longitude*3.0+bloomAge) * bloomAge * 0.3;
      point.x += sin(bloomAge*0.5 + seed.y*4.0) * bloomAge * 0.8;
      brightness = step(0.0,local) * (1.0-smoothstep(4.0,8.0,bloomAge)) * (local < 2.2 ? 0.18 : 0.92);
      brightness *= (0.7 + seed.z * 0.3) * (1.0 - trail * 0.77);
      shade = mod(burst,3.0);
      vec4 view = modelViewMatrix * vec4(point,1.0); gl_Position = projectionMatrix*view;
      gl_PointSize = clamp((2.6+seed.z*1.8)*260.0/max(3.0,-view.z),0.8,7.0)*ratio;
      brightness *= smoothstep(0.0,12.0,-view.z);
    }`,
    fragmentShader: `uniform vec3 tintA; uniform vec3 tintB; uniform vec3 tintC; uniform float strength; varying float brightness; varying float shade;
    void main(){float radius=length(gl_PointCoord-0.5); float light=exp(-radius*radius*15.0)*(1.0-smoothstep(0.35,0.5,radius)); vec3 tint=shade<0.5?tintA:shade<1.5?tintB:tintC; gl_FragColor=vec4(tint*1.65,light*brightness*strength);}`,
  });
  const points = new THREE.Points(geometry, material); points.frustumCulled = false; points.userData.noAO = true; points.userData.noPick = true;
  return points;
}

export class TidePlay {
  constructor(ocean, sound) {
    this.ocean = ocean; this.sound = sound; this.festival = lightFestival(); this.ocean.scene.add(this.festival); this.festival.visible = false;
    this.show = null; this.trial = null; this.rounds = new Map(); this.best = new Map(); this.lastSite = null;
  }

  celebrate(id) {
    const landmark = LANDMARKS.find(site => site.id === id); if (!landmark) return false;
    const position = this.ocean.worldPosition();
    if (Math.hypot(position.x - landmark.center[0], position.z - landmark.center[2]) > landmark.radius + 50) return false;
    this.show = { id, start: this.ocean.time, ending: null };
    SITE_PLAY[id].colors.forEach((color, index) => this.festival.material.uniforms[['tintA', 'tintB', 'tintC'][index]].value.set(color));
    this.festival.visible = true; this.sound.ritual(id); this.ocean.wonders.activate(id, position); this.ocean.landmarks.respond(id, this.ocean.time);
    this.ocean.callbacks.onCeremony?.();
    return true;
  }

  calm() { if (this.show && this.show.ending === null) this.show.ending = this.ocean.time; this.ocean.landmarks.calm(this.ocean.time); this.ocean.wonders.resetPulses(); this.sound.stopChant(); }

  start(id, species = 'manta') {
    this.stop();
    const site = LANDMARKS.find(landmark => landmark.id === id); if (!site) return;
    const factories = { manta: createManta, shark: createShark, turtle: createTurtle, whale: createWhale };
    const round = this.rounds.get(id) || 0; this.rounds.set(id, round + 1);
    const course = trialCourse(site, round); const { heading } = course;
    const actor = (factories[species] || createManta)();
    actor.root.position.fromArray(course.origin);
    actor.root.position.sub(this.ocean.worldOffset); actor.root.rotation.set(0, heading, 0); this.ocean.scene.add(actor.root);
    const origin = actor.root.position.clone().add(this.ocean.worldOffset);
    const group = new THREE.Group(); this.ocean.scene.add(group);
    const radius = species === 'whale' ? 24 : 12;
    const targets = Array.from({ length: 5 }, (_, index) => {
      const point = new THREE.Vector3(...course.points[index]);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.16, 8, 80), new THREE.MeshStandardMaterial({ color: '#c6bc8c', emissive: '#b49350', emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.45, transparent: true, opacity: 0.9 }));
      ring.userData.noPick = true; ring.userData.noAO = true; ring.position.copy(point); ring.lookAt(index ? new THREE.Vector3(...course.points[index - 1]) : origin); group.add(ring);
      return { point, ring, collected: false };
    });
    this.ocean.embodiment.enter({ root: actor.root, shape: actor.root, living: true, species, name: `${site.name} · 巡游使者`, animate: actor.animate, temporary: true }, { firstPerson: false });
    this.sound.setTrial?.(true);
    this.trial = { id, actor, group, targets, radius, start: this.ocean.time, progress: 0, previous: origin.clone(), elapsed: 0, finished: false, misses: 0, feedback: '', next: 0 };
  }

  stop() {
    if (!this.trial) return;
    this.sound.setTrial?.(false);
    if (this.ocean.embodiment.active?.root === this.trial.actor.root) this.ocean.embodiment.exit();
    const geometries = new Set(); const materials = new Set();
    for (const root of [this.trial.actor.root, this.trial.group]) { root.removeFromParent(); root.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); }); }
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); this.trial = null;
  }

  update(delta) {
    const ocean = this.ocean;
    if (this.show) {
      const landmark = LANDMARKS.find(site => site.id === this.show.id);
      const age = ocean.time - this.show.start; const fade = this.show.ending === null ? 1 : Math.max(0, 1 - (ocean.time - this.show.ending) / 2.5);
      this.festival.material.uniforms.age.value = age; this.festival.material.uniforms.strength.value = (ocean.reduced ? 0.45 : 1) * fade;
      this.festival.material.uniforms.ratio.value = ocean.renderer.getPixelRatio();
      this.festival.position.set(landmark.center[0], seaHeight(landmark.center[0], landmark.center[2]), landmark.center[2]).sub(ocean.worldOffset);
      this.sound.setIntensity(festivalStage(age).strength * fade);
      if (age >= 36 || fade <= 0) { this.show = null; this.festival.visible = false; this.sound.setIntensity(0); }
    }
    const trial = this.trial; if (!trial) return;
    trial.group.position.copy(ocean.worldOffset).multiplyScalar(-1);
    if (!ocean.embodiment.active || ocean.embodiment.active.root !== trial.actor.root) { this.stop(); return; }
    const position = ocean.embodiment.position;
    if (ocean.embodiment.blend) { trial.start += delta; trial.previous.copy(position); return; }
    const play = SITE_PLAY[trial.id];
    if (!trial.finished && delta > 0) {
      trial.elapsed = ocean.time - trial.start;
      for (const [index, target] of trial.targets.entries()) {
        const eligible = play.mode === 'collect' || index === trial.progress;
        const breathing = 0.5 + 0.5 * Math.sin(trial.elapsed * 1.5 - index);
        target.ring.material.emissiveIntensity = target.collected ? 0.1 : eligible ? 0.7 + breathing * 0.8 : 0.15;
        if (target.collected || !eligible || segmentDistance(target.point.toArray(), trial.previous.toArray(), position.toArray()) > trial.radius * 0.7) continue;
        if (play.mode === 'rhythm' && breathing < 0.5) { trial.feedback = '等光环再次明亮，海流会接住你。'; continue; }
        target.collected = true; trial.progress++; target.ring.material.color.set('#8ebfa8'); trial.feedback = `收集 ${trial.progress} / 5 · 海域正在回应`; this.sound.note(48 + trial.progress * 3, 3, 'bell', 0.09);
        if (trial.progress === 5) {
          trial.finished = true; this.best.set(trial.id, Math.min(this.best.get(trial.id) || Infinity, trial.elapsed));
          trial.feedback = `完成 · ${trial.elapsed.toFixed(1)} 秒 · 本次会话最佳 ${this.best.get(trial.id).toFixed(1)} 秒`;
          const site = LANDMARKS.find(site => site.id === trial.id);
          this.celebrate(site.id); ocean.embodiment.faceToward(site.center);
        }
      }
      trial.previous.copy(position);
    }
    trial.targets.forEach(target => { if (target.collected) { target.ring.material.opacity = THREE.MathUtils.damp(target.ring.material.opacity, 0, 1.3, delta); target.ring.scale.lerp(new THREE.Vector3(1.25, 1.25, 1.25), 1 - Math.exp(-delta)); target.ring.visible = target.ring.material.opacity > 0.005; } });
  }

  inspect() { return { show: this.show ? { id: this.show.id, elapsed: this.ocean.time - this.show.start, ...festivalStage(this.ocean.time - this.show.start) } : null, trial: this.trial ? { id: this.trial.id, progress: this.trial.progress, elapsed: this.trial.elapsed, finished: this.trial.finished, feedback: this.trial.feedback, next: this.trial.targets.find(target => !target.collected)?.point.toArray() || null } : null }; }
}
