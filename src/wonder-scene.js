import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { StoneWorkshop } from './sculptures.js';
import { createWhale, createManta } from './creatures.js';
import { LANDMARKS } from './landmarks.js';
import { seaHeight } from './terrain.js';
import { seededRandom } from './core.js';
import { starOrbit } from './star-shoal.js';
import { coralBloomEnvelope, createCoralBloom } from './coral-bloom.js';

export function wonderEnvelope(elapsed) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 14) return 0;
  return Math.sin(Math.PI * Math.min(elapsed / 3, 0.5)) * (1 - THREE.MathUtils.smoothstep(elapsed, 7, 14));
}

function sparkCloud(count, palette, mode, seed) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    for (let component = 0; component < 4; component++) seeds[index * 4 + component] = random();
    const color = new THREE.Color(palette[index % palette.length]);
    colors.set(color.toArray(), index * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, energy: { value: 0 }, mode: { value: mode }, pixelRatio: { value: 1 } },
    vertexShader: `attribute vec4 seed; attribute vec3 color; uniform float time; uniform float energy; uniform float mode; uniform float pixelRatio; varying vec3 tint; varying float alpha;
      void main() {
        vec3 point;
        float life = fract(seed.x + time * (0.018 + seed.w * 0.011));
        if (mode < 0.5) {
          float angle = seed.x * 6.28318 + time * (0.045 + seed.w * 0.035);
          float radius = 28.0 + seed.y * 37.0 + energy * sin(seed.z * 3.14159) * 13.0;
          point = vec3(cos(angle) * radius, 75.0 + sin(angle) * radius * 0.87, (seed.z - 0.5) * 25.0 + sin(angle * 3.0) * 3.0);
          alpha = 0.25 + seed.w * 0.65;
        } else if (mode < 1.5) {
          float angle = seed.y * 6.28318;
          point = vec3(cos(angle) * seed.z * 110.0, 4.0 + life * 66.0, sin(angle) * seed.z * 80.0);
          point.x += sin(life * 7.0 + seed.y * 20.0) * 7.0;
          alpha = sin(life * 3.14159) * (0.25 + energy * 0.65);
        } else {
          float emitter = floor(seed.y * 7.0);
          float angle = emitter * 2.39996;
          float radius = emitter * 8.0;
          float height = 11.0 + mod(emitter, 3.0) * 7.0;
          life = fract(seed.x + time * (0.028 + seed.w * 0.012));
          float plume = life * (67.0 + energy * 40.0);
          float spiral = seed.z * 6.28318 + life * 8.0;
          point = vec3(cos(angle) * radius + cos(spiral) * (0.3 + life * life * 19.0), height + plume, sin(angle) * radius + sin(spiral) * (0.3 + life * life * 16.0));
          alpha = pow(1.0 - life, 1.4) * (0.5 + energy * 0.8);
        }
        vec4 view = modelViewMatrix * vec4(point, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((1.2 + seed.w * 2.5) * 250.0 / max(2.0, -view.z), 0.6, 7.0) * pixelRatio;
        tint = color * (1.15 + energy * 0.6);
        alpha *= smoothstep(0.0, 8.0, -view.z);
      }`,
    fragmentShader: `varying vec3 tint; varying float alpha;
      void main() {
        float radius = length(gl_PointCoord - 0.5);
        float falloff = exp(-radius * radius * 19.0) * (1.0 - smoothstep(0.4, 0.5, radius));
        gl_FragColor = vec4(tint, falloff * alpha);
      }`,
  });
  const root = new THREE.Points(geometry, material); root.frustumCulled = false; root.userData.noAO = true;
  return { root, animate(time, energy) { material.uniforms.time.value = time; material.uniforms.energy.value = energy; } };
}

function fishVortex(materials) {
  const root = new THREE.Group();
  const body = new THREE.SphereGeometry(1, 6, 4); body.scale(0.19, 0.32, 0.95);
  const tail = new THREE.ConeGeometry(0.5, 0.7, 3); tail.rotateX(Math.PI / 2); tail.scale(0.15, 1, 1); tail.translate(0, 0, 0.98);
  const geometry = mergeGeometries([body, tail]); body.dispose(); tail.dispose();
  const material = new THREE.MeshStandardMaterial({ color: '#c8d1bc', emissive: '#447c78', emissiveIntensity: 0.3, roughness: 0.32, metalness: 0.5 });
  const count = 1500;
  const fish = new THREE.InstancedMesh(geometry, material, count); fish.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fish.frustumCulled = false;
  fish.userData.creature = 'shoal';
  const random = seededRandom(957);
  const paths = Array.from({ length: count }, (_, index) => ({ angle: random() * Math.PI * 2, lane: index % 3, layer: random(), depth: random() - 0.5, speed: 0.038 + index % 3 * 0.008 + random() * 0.007, scale: 0.42 + random() * 0.56 }));
  const gold = new THREE.Color('#edc36e'); const blue = new THREE.Color('#53b7c9');
  paths.forEach((item, index) => fish.setColorAt(index, gold.clone().lerp(blue, item.layer > 0.58 ? 0.85 : item.layer * 0.45)));
  root.add(fish);
  const sparks = sparkCloud(1300, ['#b1c9b9', '#85b4b2', '#a0bac5'], 0, 861); root.add(sparks.root);
  const whale = createWhale(); whale.root.scale.setScalar(1.8); root.add(whale.root);
  const armillary = new THREE.Group(); armillary.position.y = 75; root.add(armillary);
  const bronze = new THREE.MeshStandardMaterial({ color: '#a78e5c', metalness: 0.72, roughness: 0.42 });
  const inlay = new THREE.MeshStandardMaterial({ color: '#decba0', emissive: '#b78740', emissiveIntensity: 0.3, metalness: 0.38, roughness: 0.46 });
  const bands = [];
  for (let index = 0; index < 3; index++) {
    const band = new THREE.Group(); const radius = 70 + index * 9;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, index === 0 ? 0.75 : 0.42, 8, 144, Math.PI * (index === 1 ? 1.63 : 1.84)), bronze);
    band.add(arc); band.rotation.set(index === 1 ? 0.64 : -0.24, index === 2 ? -0.55 : 0.16, index * 1.4);
    const beads = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.92, 1), inlay, 48);
    const pose = new THREE.Object3D();
    for (let mark = 0; mark < 48; mark++) {
      const angle = mark / 48 * Math.PI * 1.62;
      pose.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      pose.rotation.z = angle; pose.scale.set(1, mark % 4 === 0 ? 2.3 : 0.8, 0.6); pose.updateMatrix(); beads.setMatrixAt(mark, pose.matrix);
    }
    band.add(beads); armillary.add(band); bands.push(band);
  }
  const ruin = new StoneWorkshop(materials, 361);
  ruin.terrace(0, -1, 0, 47, 6);
  for (let index = 0; index < 9; index++) {
    const angle = index / 9 * Math.PI * 2;
    ruin.column(Math.cos(angle) * 45, 0, Math.sin(angle) * 25 - 15, 17 + index % 3 * 7, 1.7, true);
    ruin.coral(Math.cos(angle) * 42, 1, Math.sin(angle) * 29, 1.7, index % 2 ? 'coralRose' : 'coralLight');
  }
  root.add(ruin.finish('drowned-observatory'));
  const transform = new THREE.Object3D(); const direction = new THREE.Vector3(); const axis = new THREE.Vector3(0, 0, -1);
  return { root, animate(time, delta, energy, collisions, offset) {
    root.updateWorldMatrix(true, false);
    const worldMatrix = root.matrixWorld.clone();
    if (offset) { worldMatrix.elements[12] += offset.x; worldMatrix.elements[13] += offset.y; worldMatrix.elements[14] += offset.z; }
    const localMatrix = worldMatrix.clone().invert();
    paths.forEach((item, index) => {
      transform.position.fromArray(starOrbit(time, item, energy));
      direction.fromArray(starOrbit(time + 0.03, item, energy)).sub(transform.position).normalize();
      if (collisions) transform.position.copy(collisions.avoidSmall(transform.position.clone().applyMatrix4(worldMatrix), item.scale)).applyMatrix4(localMatrix);
      transform.quaternion.setFromUnitVectors(axis, direction);
      transform.scale.setScalar(item.scale * (1 + energy * 0.1)); transform.updateMatrix(); fish.setMatrixAt(index, transform.matrix);
    });
    fish.instanceMatrix.needsUpdate = true;
    material.emissiveIntensity = 0.3 + energy * 0.7;
    sparks.animate(time, energy);
    bands.forEach((band, index) => { band.rotation.z = index * 1.4 + Math.sin(time * 0.035 + index) * 0.08; band.rotation.y = (index === 2 ? -0.55 : 0.16) + Math.sin(time * 0.045 + index) * 0.045 + energy * 0.045; });
    inlay.emissiveIntensity = 0.3 + energy * 0.85;
    whale.root.position.set(Math.sin(time * 0.035) * 19, 72 + Math.sin(time * 0.12) * 2.5, -10);
    whale.root.rotation.set(-0.08, -Math.PI / 2 + Math.sin(time * 0.035) * 0.1, -0.12);
    if (delta > 0) whale.animate(time * 0.8, delta);
  } };
}

export function fanGeometry(radius, hue) {
  const vertices = []; const colors = []; const uv = []; const indices = [];
  const angularSteps = 36; const radialSteps = 16;
  const base = new THREE.Color(hue); const tip = new THREE.Color('#f1c578');
  for (let radial = 0; radial <= radialSteps; radial++) {
    const progress = radial / radialSteps;
    for (let angular = 0; angular <= angularSteps; angular++) {
      const fraction = angular / angularSteps;
      const angle = (fraction - 0.5) * 2.62;
      const edge = 1 + Math.sin(angle * 13) * 0.025 * progress + Math.sin(angle * 7) * 0.035;
      vertices.push(Math.sin(angle) * radius * progress * edge, Math.cos(angle) * radius * progress * edge, Math.sin(angle * 4) * progress * progress * radius * 0.11);
      colors.push(...base.clone().lerp(tip, Math.pow(progress, 4) * 0.32).toArray()); uv.push(fraction, progress);
      if (radial < radialSteps && angular < angularSteps) {
        const start = radial * (angularSteps + 1) + angular;
        indices.push(start, start + 1, start + angularSteps + 1, start + 1, start + angularSteps + 2, start + angularSteps + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function prismGarden(materials) {
  const root = new THREE.Group(); const shop = new StoneWorkshop(materials, 953); const random = shop.random;
  const segments = []; const branches = []; const transform = new THREE.Object3D();
  const timeUniform = { value: 0 }; const energyUniform = { value: 0 }; const burstAge = { value: -1 }; const emitters = [];
  const fanMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), gardenTime: timeUniform, gardenEnergy: energyUniform, burstAge },
    vertexShader: `attribute vec3 color; uniform float gardenTime; varying vec2 fanUV; varying vec3 fanPosition; varying vec3 fanColor;
      #include <fog_pars_vertex>
      void main() {
        fanUV = uv; fanColor = color; fanPosition = position;
        vec3 point = position; point.z += sin(gardenTime * 0.45 + position.x * 0.04) * uv.y * uv.y * 0.85;
        vec4 mvPosition = modelViewMatrix * vec4(point, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float gardenTime; uniform float gardenEnergy; uniform float burstAge; varying vec2 fanUV; varying vec3 fanPosition; varying vec3 fanColor;
      #include <fog_pars_fragment>
      void main() {
        float veins = pow(0.5 + 0.5 * sin(fanUV.x * 226.0 + sin(fanUV.y * 18.0) * 2.5), 15.0);
        float crossVeins = pow(0.5 + 0.5 * sin(fanUV.y * 145.0 + sin(fanUV.x * 40.0) * 1.6), 20.0);
        float lattice = max(veins, crossVeins * 0.55);
        float edge = pow(fanUV.y, 11.0);
        float pulse = pow(0.5 + 0.5 * sin(length(fanPosition.xz) * 0.08 - gardenTime * 1.4), 6.0);
        vec3 radiance = fanColor * (0.36 + lattice * 0.45 + edge * 0.12 + gardenEnergy * pulse * (0.5 + lattice * 1.1));
        float wave=exp(-pow((length(fanPosition.xz)-max(0.0,burstAge-2.4)*66.0)/12.0,2.0));
        radiance+=fanColor*wave*gardenEnergy*2.2*(0.3+lattice+edge)*step(2.4,burstAge);
        gl_FragColor = vec4(radiance, 0.48 + lattice * 0.36 + edge * 0.12);
        #include <fog_fragment>
      }`,
  });
  const branchMaterial = new THREE.MeshStandardMaterial({ color: '#e6a890', emissive: '#c57865', emissiveIntensity: 0.55, roughness: 0.6 });
  for (let index = 0; index < 31; index++) {
    const row = Math.floor(index / 8); const horizontal = (index % 8 - 3.5) * 24 + random() * 9;
    const depth = 38 - row * 35 + random() * 12;
    const radius = 12 + random() * 14 + row * 2;
    const base = row * 2.7;
    emitters.push([horizontal, base + radius * 0.75, depth]);
    transform.position.set(horizontal, base + 1, depth); transform.rotation.set(-0.08, -0.3 + random() * 0.85, (random() - 0.5) * 0.4); transform.updateMatrix();
    const fan = fanGeometry(radius, ['#cb6b92', '#648bc5', '#d8975d', '#54c3b8'][index % 4]); fan.applyMatrix4(transform.matrix); segments.push(fan);
    for (let spoke = 0; spoke < 9; spoke++) {
      const angle = (spoke / 8 - 0.5) * 2.6;
      const points = Array.from({ length: 9 }, (_, step) => {
        const progress = step / 8;
        return new THREE.Vector3(Math.sin(angle) * radius * progress, Math.cos(angle) * radius * progress, Math.sin(angle * 4) * progress * progress * radius * 0.11).applyMatrix4(transform.matrix);
      });
      branches.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, 0.065, 3, false));
    }
    shop.add('rock', 'rock', [horizontal, base - 3, depth], [12, 5 + row * 2, 10], [0, index, 0]);
    if (index % 2 === 0) shop.coral(horizontal + 7, base, depth + 7, 1.7, 'coralRose');
    for (let terrace = 0; terrace < 3; terrace++) shop.add('dome', terrace % 2 ? 'coralPurple' : 'coralRose', [horizontal - 5, base + terrace, depth + 9], [4 - terrace * 0.5, 0.45, 3.4], [0, 0, 0.1]);
  }
  root.add(new THREE.Mesh(mergeGeometries(segments), fanMaterial)); segments.forEach(part => part.dispose());
  root.add(new THREE.Mesh(mergeGeometries(branches), branchMaterial)); branches.forEach(part => part.dispose());
  root.add(shop.finish('terraces-of-luminous-coral'));
  const sparks = sparkCloud(2200, ['#e89bab', '#66c8c0', '#e4c17c'], 1, 632); root.add(sparks.root);
  const manta = createManta(); manta.root.scale.setScalar(1.8); root.add(manta.root);
  const bloom = createCoralBloom(emitters); root.add(bloom.root);
  return { root, animate(time, delta, energy, collisions, offset, age, reduced, ratio) {
    burstAge.value = Number.isFinite(age) ? age : -1; bloom.update(age, reduced, ratio);
    timeUniform.value = time; energyUniform.value = energy; sparks.animate(time, energy);
    manta.root.position.set(Math.sin(time * 0.045) * 62, 48 + Math.sin(time * 0.16) * 4, -20);
    manta.root.rotation.set(0.08, -Math.PI / 2, Math.sin(time * 0.045) * 0.12);
    if (delta > 0) manta.animate(time * 0.7, delta);
  } };
}

function abyssFountains(materials) {
  const root = new THREE.Group(); const shop = new StoneWorkshop(materials, 168);
  const cores = []; const coreMaterial = new THREE.MeshStandardMaterial({ color: '#e6a26a', emissive: '#ea8f49', emissiveIntensity: 2, roughness: 0.5 });
  for (let index = 0; index < 7; index++) {
    const angle = index * 2.39996; const radius = index * 8;
    const horizontal = Math.cos(angle) * radius; const depth = Math.sin(angle) * radius; const height = 11 + index % 3 * 7;
    shop.add('rock', 'dark', [horizontal, height * 0.35 - 2, depth], [5 + index % 3, height * 0.7, 5], [0, angle, 0.05]);
    shop.add('taper', 'dark', [horizontal, height * 0.5, depth], [3, height, 3.6]);
    const core = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.17, 6, 32), coreMaterial); core.rotation.x = -Math.PI / 2; core.position.set(horizontal, height, depth); root.add(core); cores.push(core);
    for (let seam = 0; seam < 4; seam++) {
      shop.tube([[horizontal + 2, height, depth], [horizontal + 2.4, height * 0.65, depth + seam * 0.8], [horizontal + 3.4, 2, depth + 1]], 0.035, 'glow', 8);
    }
    for (let crystal = 0; crystal < 5; crystal++) shop.add('cone', crystal % 2 ? 'coralPurple' : 'copper', [horizontal + Math.sin(crystal * 2) * 6, 1.4, depth + Math.cos(crystal * 2) * 6], [0.5, 3 + crystal, 0.6], [0.2, crystal, 0.15]);
  }
  root.add(shop.finish('black-smoker-cathedrals'));
  const sparks = sparkCloud(7000, ['#f3b466', '#eaa08a', '#69b1ce'], 2, 361); root.add(sparks.root);
  const veils = [];
  const veilMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, energy: { value: 0 } },
    vertexShader: 'varying vec2 veilUV; void main(){ veilUV=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform float time; uniform float energy; varying vec2 veilUV;
      void main(){
        float strand=pow(0.5+0.5*sin(veilUV.x*56.0+sin(veilUV.y*19.0-time*0.7)*1.8),5.0);
        float alpha=pow(1.0-veilUV.y,2.0)*(0.015+strand*0.075)*(0.7+energy);
        gl_FragColor=vec4(mix(vec3(0.23,0.53,0.67),vec3(0.92,0.46,0.15),pow(1.0-veilUV.y,3.0)),alpha);
      }`,
  });
  for (let index = 0; index < 7; index++) {
    const geometry = new THREE.CylinderGeometry(15, 1.4, 75, 24, 1, true);
    const veil = new THREE.Mesh(geometry, veilMaterial); veil.position.copy(cores[index].position).add(new THREE.Vector3(0, 37.5, 0)); veil.userData.noAO = true; root.add(veil); veils.push(veil);
  }
  return { root, animate(time, delta, energy) {
    sparks.animate(time, energy); veilMaterial.uniforms.time.value = time; veilMaterial.uniforms.energy.value = energy;
    coreMaterial.emissiveIntensity = 1.1 + energy * 2.4;
    veils.forEach((veil, index) => { veil.scale.y = 1 + energy * 0.45; veil.position.y = cores[index].position.y + 37.5 * veil.scale.y; });
  } };
}

export class WonderScene {
  constructor(scene, materials) { this.scene = scene; this.materials = materials; this.entries = new Map(); this.time = 0; }

  build(landmark) {
    const factory = { vortex: fishVortex, prism: prismGarden, vents: abyssFountains }[landmark.kind];
    const wonder = factory(this.materials);
    const backdrop = new StoneWorkshop(this.materials, Number(landmark.number) * 278);
    for (let index = 0; index < 13; index++) {
      const horizontal = -170 + index * 29; const height = 35 + backdrop.random() * 80;
      backdrop.add('rock', 'dark', [horizontal, height * 0.25 - 10, -150 - backdrop.random() * 60], [15 + backdrop.random() * 12, height, 23], [0, index, 0.15]);
    }
    wonder.root.add(backdrop.finish('wonder-amphitheatre'));
    wonder.root.name = `wonder-${landmark.id}`; this.scene.add(wonder.root);
    const entry = { ...wonder, landmark, floor: seaHeight(landmark.center[0], landmark.center[2]), pulseStart: -Infinity, proximity: 0, energy: 0 };
    this.entries.set(landmark.id, entry); return entry;
  }

  activate(id, position, kind = 'awaken') {
    const landmark = LANDMARKS.find(item => item.id === id && item.wonder);
    if (!landmark) return { ok: false, message: '请先前往一处奇观，再说“唤醒眼前的奇观”。' };
    const distance = Math.hypot(position.x - landmark.center[0], position.z - landmark.center[2]);
    if (distance > landmark.radius + 35) return { ok: false, message: `还没有靠近${landmark.name}。先说“前往${landmark.name}”，到达后再唤醒。` };
    const entry = this.entries.get(id) || this.build(landmark);
    entry.pulseStart = kind === 'calm' ? -Infinity : this.time;
    return { ok: true, message: kind === 'calm' ? '奇观回到平缓的自然律动。' : `${landmark.name}正在回应你。`, detail: kind === 'calm' ? '只结束这次唤醒 · 环境生命仍在运动' : '本地三维奇观编排 · 约 14 秒后自然回落 · 可暂停或说“让奇观平静下来”' };
  }

  resetPulses() { for (const entry of this.entries.values()) entry.pulseStart = -Infinity; }

  update(position, offset, time, delta) {
    this.time = time;
    for (const landmark of LANDMARKS.filter(item => item.wonder)) {
      const distance = Math.hypot(position.x - landmark.center[0], position.z - landmark.center[2]);
      let entry = this.entries.get(landmark.id);
      if (!entry && distance < 620) entry = this.build(landmark);
      if (!entry) continue;
      entry.root.position.set(landmark.center[0] - offset.x, entry.floor - offset.y, landmark.center[2] - offset.z);
      entry.root.visible = distance < 850;
      if (!entry.root.visible) continue;
      entry.proximity = THREE.MathUtils.damp(entry.proximity, 1 - THREE.MathUtils.smoothstep(distance, 85, 250), 0.65, delta);
      const age = time - entry.pulseStart;
      const envelope = landmark.id === 'prism' ? coralBloomEnvelope(age) : wonderEnvelope(age);
      entry.energy = THREE.MathUtils.damp(entry.energy, Math.min(1, entry.proximity * 0.28 + envelope), landmark.id === 'prism' ? 24 : 2, delta);
      entry.animate(time, delta, entry.energy, this.collisions, offset, age, this.reduced, this.pixelRatio || 1);
    }
  }

  inspect() { return [...this.entries].map(([id, entry]) => ({ id, visible: entry.root.visible, energy: Number(entry.energy.toFixed(3)), awakened: wonderEnvelope(this.time - entry.pulseStart) > 0, position: entry.root.position.toArray() })); }
}
