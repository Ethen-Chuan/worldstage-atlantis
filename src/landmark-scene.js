import * as THREE from 'three';
import { StoneWorkshop, sculptGate, sculptCoral } from './sculptures.js';
import { createJellies, createManta } from './creatures.js';
import { LANDMARKS } from './landmarks.js';
import { seaHeight } from './terrain.js';
import { createWhaleRemains } from './whale-remains.js';

function whaleGarden(materials) {
  const shop = new StoneWorkshop(materials, 987);
  const tableCoral = new THREE.SphereGeometry(1, 40, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const vertices = tableCoral.attributes.position;
  for (let index = 0; index < vertices.count; index++) {
    const horizontal = vertices.getX(index);
    const depth = vertices.getZ(index);
    const angle = Math.atan2(depth, horizontal);
    const radius = Math.hypot(horizontal, depth);
    const edge = 1 + (Math.sin(angle * 7) * 0.08 + Math.sin(angle * 13) * 0.05) * radius;
    vertices.setXYZ(index, horizontal * edge, vertices.getY(index) + Math.sin(angle * 9) * radius * 0.12, depth * edge);
  }
  tableCoral.computeVertexNormals();
  const random = shop.random;
  for (let index = 0; index < 70; index++) {
    const angle = random() * Math.PI * 2;
    const radius = 19 + random() * 32;
    const horizontal = Math.cos(angle) * radius;
    const depth = Math.sin(angle) * radius;
    shop.coral(horizontal, 0, depth, 1 + random() * 2.1, index % 3 ? 'coral' : 'coralRose');
    if (index % 3 === 0) shop.add('rock', 'rock', [horizontal, -1, depth], [4, 2, 4]);
    if (index % 2 === 0) {
      for (let tier = 0; tier < 4; tier++) {
        const width = 2.4 + random() * 3.2;
        shop.add(tableCoral, tier % 2 ? 'coralRose' : 'coralLight', [horizontal + tier * 0.6, 0.4 + tier * 0.9, depth], [width, 0.55, width * 0.75], [0, index, 0.12]);
      }
    }
  }
  const root = shop.finish('garden-of-giants');
  tableCoral.dispose();
  root.add(createWhaleRemains(materials));
  return root;
}

function lanternSanctum(materials) {
  const shop = new StoneWorkshop(materials, 213);
  shop.terrace(0, 0, 0, 37, 7);
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2;
    const horizontal = Math.cos(angle) * 31;
    const depth = Math.sin(angle) * 31;
    shop.column(horizontal, 3, depth, 40 + Math.sin(angle * 3) * 9, 1.8, index % 3 === 0);
    if (index % 3) shop.coral(horizontal, 32, depth, 1.2, 'coralLight');
    shop.add('sphere', 'glow', [horizontal, 6, depth], [0.4, 0.6, 0.4]);
  }
  for (let ring = 0; ring < 4; ring++) shop.ring(0, 5 + ring * 0.02, 0, 13 + ring * 4, ring % 2 ? 'gold' : 'pale', 0.18);
  for (let index = 0; index < 36; index++) {
    const depth = 20 + index * 3;
    const horizontal = Math.sin(index * 0.16) * 8;
    shop.add('sphere', 'glow', [horizontal, 0.35, depth], [0.28, 0.25, 0.28]);
  }
  return shop.finish('lantern-sanctum');
}

export class LandmarkScene {
  constructor(scene, materials) {
    this.entries = [];
    this.scene = scene;
    this.materials = materials;
    this.voiceLevel = 0; this.voiceActive = false;
  }

  prepare(id) {
    if (this.entries.some(entry => entry.landmark.id === id)) return;
    const landmark = LANDMARKS.find(item => item.id === id && ['gate', 'garden', 'choir'].includes(item.kind));
    if (!landmark) return;
    const materials = this.materials;
      const root = new THREE.Group();
      const floor = seaHeight(landmark.center[0], landmark.center[2]);
      let sculpture;
      if (landmark.kind === 'gate') { sculpture = sculptGate(materials); sculpture.scale.setScalar(2); }
      else sculpture = landmark.kind === 'garden' ? whaleGarden(materials) : lanternSanctum(materials);
      root.add(sculpture);
      const glyphs = [];
      sculpture.traverse(object => { if (object.name === 'glow' && object.material) { object.material = object.material.clone(); glyphs.push(object.material); } });
      const framing = new StoneWorkshop(materials, 589 + Number(landmark.number));
      for (let index = 0; index < 14; index++) {
        const angle = index / 14 * Math.PI * 2;
        const radius = 68 + index % 3 * 9;
        const horizontal = Math.cos(angle) * radius;
        const depth = Math.sin(angle) * radius;
        if (depth > 0 && horizontal > -40 && horizontal < 90) continue;
        framing.add('rock', 'rock', [horizontal, -7, depth], [13, (landmark.kind === 'garden' ? 12 : 20) + index % 4 * 7, 12], [0.05, angle, 0.07]);
        if (index % 2 === 0) framing.coral(horizontal, 8 + index % 3 * 3, depth, 1.8);
      }
      root.add(framing.finish('landmark-reef-wall'));
      const backdrop = new StoneWorkshop(materials, Number(landmark.number) * 137);
      for (let index = 0; index < 16; index++) {
        const horizontal = -180 + index * 24;
        const height = 30 + backdrop.random() * 85;
        backdrop.add('rock', 'dark', [horizontal, height * 0.35 - 17, -175 - backdrop.random() * 70], [16 + backdrop.random() * 15, height, 25], [0.1, index, 0.05]);
      }
      root.add(backdrop.finish('distant-basalt-amphitheatre'));
      const life = landmark.kind === 'garden' ? createManta() : createJellies(landmark.kind === 'choir' ? { span: [34, 15, 32], sizes: [0.8, 0.8] } : undefined);
      life.root.position.set(0, landmark.kind === 'choir' ? 49 : 51, 3);
      life.root.scale.setScalar(landmark.kind === 'garden' ? 1.5 : landmark.kind === 'choir' ? 2.5 : 1.8);
      if (life.setColor) life.setColor(landmark.kind === 'choir' ? 'pearl' : 'gold');
      root.add(life.root);
      let portal = null;
      if (landmark.id === 'gate') {
        const material = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
          uniforms: { clock: { value: 0 }, energy: { value: 0 } },
          vertexShader: 'varying vec2 gateUV; void main(){gateUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
          fragmentShader: `uniform float clock; uniform float energy; varying vec2 gateUV;
          void main(){vec2 point=gateUV-0.5;float radius=length(point)*2.0;float angle=atan(point.y,point.x);float rim=exp(-pow((radius-0.89)*24.0,2.0));float wave=pow(0.5+0.5*sin(radius*62.0-clock*2.1+sin(angle*5.0)*0.6),14.0);float veil=(1.0-smoothstep(0.7,1.0,radius));vec3 color=mix(vec3(0.28,0.53,0.52),vec3(0.91,0.73,0.39),rim);gl_FragColor=vec4(color,(rim*0.7+wave*0.18+0.025)*veil*energy);}`,
        });
        portal = new THREE.Mesh(new THREE.PlaneGeometry(72, 72), material); portal.position.set(0, 39, 1); portal.userData.noPick = true; portal.userData.noAO = true; root.add(portal);
      }
      const coral = sculptCoral(materials); coral.position.set(-25, 0, 27); coral.scale.setScalar(1.6); root.add(coral);
      root.position.set(landmark.center[0], floor, landmark.center[2]);
      this.scene.add(root);
      this.entries.push({ landmark, root, life, floor, glyphs, activation: 0, portal, ritualStart: -Infinity, ending: null });
  }

  respond(id, time) { this.prepare(id); const entry = this.entries.find(entry => entry.landmark.id === id); if (entry) { entry.ritualStart = time; entry.ending = null; } }

  calm(time) { for (const entry of this.entries) if (entry.ending === null) entry.ending = time; }

  update(position, offset, time, delta) {
    for (const landmark of LANDMARKS.filter(item => ['gate', 'garden', 'choir'].includes(item.kind))) {
      if (Math.hypot(position.x - landmark.center[0], position.z - landmark.center[2]) < 550) this.prepare(landmark.id);
    }
    for (const entry of this.entries) {
      const { landmark, root, life } = entry;
      const distance = Math.hypot(position.x - landmark.center[0], position.z - landmark.center[2]);
      root.position.set(landmark.center[0] - offset.x, entry.floor - offset.y, landmark.center[2] - offset.z);
      root.visible = distance < 880;
      if (!root.visible) continue;
      entry.activation = THREE.MathUtils.damp(entry.activation, distance < 125 ? 1 : 0, 1, delta);
      const age = time - entry.ritualStart;
      const fade = entry.ending === null ? 1 : 1 - THREE.MathUtils.smoothstep(time - entry.ending, 0, 2.5);
      const ritual = age >= 0 && age < 36 ? THREE.MathUtils.smoothstep(age, 0, 4) * (1 - THREE.MathUtils.smoothstep(age, 28, 36)) * fade : 0;
      const voice = landmark.id === 'gate' ? this.voiceLevel : 0;
      const base = landmark.id === 'gate' && this.voiceActive ? 0.28 : 0.2 + entry.activation * 1.8 + ritual * 2.2;
      for (const material of entry.glyphs) material.emissiveIntensity = base + voice * 4.6;
      if (entry.portal) { entry.portal.material.uniforms.clock.value = time; entry.portal.material.uniforms.energy.value = Math.max(ritual * 0.55, voice * 0.8); entry.portal.visible = ritual > 0.001 || voice > 0.001; }
      life.setGlow?.(entry.activation > 0.3);
      if (delta > 0) life.animate(time * 0.7, delta);
      if (landmark.kind === 'garden') {
        life.root.position.set(Math.cos(time * 0.09) * 24, 21 + Math.sin(time * 0.22) * 3, Math.sin(time * 0.09) * 22);
        life.root.rotation.y = -time * 0.09;
      }
    }
  }
}
