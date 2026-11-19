import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './core.js';
import { seaHeight, worldHash, biomeAt } from './terrain.js';
import { localLandmark } from './landmarks.js';
import { createAncientFish, createTurtle, createNautilus, createMermaid } from './mythic-creatures.js';
import { dampAngle } from './swim.js';
import { createShark } from './shark.js';
import { FoodWeb } from './food-web.js';
import { habitatRoute, schoolTarget } from './habitat-motion.js';
import { SchoolMotion } from './school-motion.js';

const REEF_COLORS = ['#be795b', '#d3a777', '#9c7891', '#7a9c91', '#c299a3'];
const CELL = 180;
const CITY_PATCHES = [[-37, 125], [95, 112], [-47, -16], [70, -83], [-34, -113], [-105, 161]];

export function habitatAnchors(position) {
  const anchors = [];
  for (const [index, center] of CITY_PATCHES.entries()) {
    if (Math.hypot(center[0] - position[0], center[1] - position[2]) < 330) anchors.push({ key: `city-${index}`, center: [center[0], seaHeight(...center), center[1]], variant: index % 3 });
  }
  const cellX = Math.floor(position[0] / CELL); const cellZ = Math.floor(position[2] / CELL);
  for (let depth = -1; depth <= 1; depth++) for (let horizontal = -1; horizontal <= 1; horizontal++) {
    const gridX = cellX + horizontal; const gridZ = cellZ + depth;
    const centerX = (gridX + 0.2 + worldHash(gridX, gridZ, 771) * 0.6) * CELL;
    const centerZ = (gridZ + 0.2 + worldHash(gridX, gridZ, 924) * 0.6) * CELL;
    if (Math.hypot(centerX, centerZ + 80) < 255) continue;
    const landmark = localLandmark([centerX, 0, centerZ]);
    if (landmark && landmark.id !== 'palace' && Math.hypot(centerX - landmark.center[0], centerZ - landmark.center[2]) < 62) continue;
    if (Math.hypot(centerX - position[0], centerZ - position[2]) > 320) continue;
    anchors.push({ key: `${gridX}:${gridZ}`, center: [centerX, seaHeight(centerX, centerZ), centerZ], variant: Math.floor(worldHash(gridX, gridZ, 618) * 3) });
  }
  return anchors.sort((first, second) => Math.hypot(first.center[0] - position[0], first.center[2] - position[2]) - Math.hypot(second.center[0] - position[0], second.center[2] - position[2])).slice(0, 10);
}

export function avoidPosition(position, obstacle, radius, seed = 0) {
  const horizontal = position[0] - obstacle[0]; const vertical = position[1] - obstacle[1]; const depth = position[2] - obstacle[2];
  const distance = Math.hypot(horizontal, vertical, depth);
  if (distance >= radius) return [...position];
  const push = (radius - distance) * 0.84;
  const fallback = [Math.cos(seed), 0.25, Math.sin(seed)];
  const direction = distance > 0.001 ? [horizontal / distance, vertical / distance, depth / distance] : fallback;
  return position.map((value, index) => value + direction[index] * push);
}

function colored(geometry, color) {
  const tint = new THREE.Color(color); const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) colors.set(tint.toArray(), index * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function reefTemplate(seed, time) {
  const random = seededRandom(seed); const root = new THREE.Group();
  root.userData.collisionBoxes = [];
  const segments = []; const transform = new THREE.Object3D();
  const add = (geometry, color, position, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    transform.position.set(...position); transform.scale.set(...scale); transform.rotation.set(...rotation); transform.updateMatrix();
    colored(geometry, color).applyMatrix4(transform.matrix); segments.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  };
  const tube = (points, radius, color, steps = 9) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), steps, radius, 4, false), color, [0, 0, 0]);
  for (let mound = 0; mound < 13; mound++) {
    const angle = mound * 2.399; const radius = 2 + Math.sqrt(mound) * 4.1;
    const horizontal = Math.cos(angle) * radius; const depth = Math.sin(angle) * radius;
    const height = 2.1 + random() * 2.8;
    add(new THREE.IcosahedronGeometry(1, 1), '#697e70', [horizontal, 0, depth], [3.3, height, 3.1]);
    root.userData.collisionBoxes.push({ min: [horizontal - 3.3, -height, depth - 3.1], max: [horizontal + 3.3, height + 0.5, depth + 3.1] });
    const hue = REEF_COLORS[(mound + seed) % REEF_COLORS.length];
    for (let tier = 0; tier < 4; tier++) {
      const width = 2.3 + random() * 2.8 - tier * 0.36;
      const cap = new THREE.SphereGeometry(1, 24, 7, 0, Math.PI * 2, 0, Math.PI * 0.56);
      const vertices = cap.attributes.position;
      for (let vertex = 0; vertex < vertices.count; vertex++) {
        const angle = Math.atan2(vertices.getZ(vertex), vertices.getX(vertex)); const ripple = Math.sin(angle * 11) * 0.04 + Math.cos(angle * 7) * 0.04;
        vertices.setXYZ(vertex, vertices.getX(vertex) * (1 + ripple), vertices.getY(vertex) + ripple * 0.5, vertices.getZ(vertex) * (1 + ripple));
      }
      cap.computeVertexNormals();
      add(cap, tier === 3 ? '#d1b897' : hue, [horizontal + tier * 0.6, height + tier * 1.1, depth], [width, 0.42, width * 0.72], [0.05, mound * 1.6, 0.12]);
    }
    if (mound % 2 === 0) {
      const brain = new THREE.SphereGeometry(1, 22, 14); const vertices = brain.attributes.position;
      for (let vertex = 0; vertex < vertices.count; vertex++) {
        const horizontal = vertices.getX(vertex); const depth = vertices.getZ(vertex); const vertical = vertices.getY(vertex);
        const ridge = 1 + Math.sin(horizontal * 23 + Math.sin(depth * 11) * 2.2) * Math.sin(vertical * 19 + depth * 9) * 0.055;
        vertices.setXYZ(vertex, horizontal * ridge, vertical * ridge, depth * ridge);
      }
      brain.computeVertexNormals(); add(brain, mound % 4 ? '#aeb68a' : '#c6916f', [horizontal + 3.5, 1.1, depth + 2], [2.3, 1.8, 2.4]);
    }
  }
  for (let sponge = 0; sponge < 24; sponge++) {
    const angle = random() * Math.PI * 2; const radius = 8 + random() * 13;
    const horizontal = Math.cos(angle) * radius; const depth = Math.sin(angle) * radius; const height = 1.7 + random() * 4.3;
    add(new THREE.CylinderGeometry(0.4, 0.8, height, 12, 3, true), sponge % 3 ? '#97758d' : '#c69463', [horizontal, height * 0.5, depth], [1, 1, 1], [0.1, 0, -0.1]);
    add(new THREE.TorusGeometry(0.4, 0.12, 6, 12), '#ccb39d', [horizontal - height * 0.05, height, depth], [1, 1, 1], [Math.PI / 2 + 0.1, 0, 0]);
  }
  for (let fan = 0; fan < 4; fan++) {
    const horizontal = (fan % 2 ? 1 : -1) * (7 + random() * 5); const depth = fan * 5 - 7;
    const height = 12 + random() * 10; const color = ['#cb8c75', '#b5a882', '#967c9e', '#b1806b'][fan];
    for (let ray = 0; ray < 27; ray++) {
      const angle = (ray / 26 - 0.5) * 2.35;
      const points = Array.from({ length: 10 }, (_, step) => {
        const progress = step / 9; return [horizontal + Math.sin(angle) * height * progress + Math.sin(progress * 9 + ray) * progress * 0.35, 0.4 + Math.cos(angle) * height * progress, depth + Math.sin(angle * 4) * progress * 1.2];
      });
      tube(points, 0.13 - Math.abs(ray - 13) * 0.004, color);
    }
    for (let ring = 2; ring < 11; ring++) {
      const points = Array.from({ length: 27 }, (_, step) => {
        const angle = (step / 26 - 0.5) * 2.35; const progress = ring / 11;
        return [horizontal + Math.sin(angle) * height * progress, 0.4 + Math.cos(angle) * height * progress + Math.sin(angle * 9 + ring) * 0.22, depth + Math.sin(angle * 4) * progress * 1.2];
      });
      tube(points, 0.055, color, 26);
    }
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.reefTime = time;
    shader.vertexShader = 'uniform float reefTime; varying vec3 reefPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nreefPosition = position; transformed.x += sin(reefTime * 0.42 + position.x * 0.2) * pow(max(position.y - 3.0, 0.0), 1.2) * 0.02;');
    shader.fragmentShader = 'varying vec3 reefPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float pores = sin(reefPosition.x * 24.0 + sin(reefPosition.z * 20.0)) * sin(reefPosition.y * 27.0 + reefPosition.z * 22.0);
      diffuseColor.rgb *= 0.89 + pores * 0.11;
    `);
  };
  material.customProgramCacheKey = () => 'living-reef-v5';
  root.add(new THREE.Mesh(mergeGeometries(segments), material)); segments.forEach(geometry => geometry.dispose());
  const leaf = new THREE.PlaneGeometry(1, 1, 2, 14); leaf.translate(0, 0.5, 0);
  const vertices = leaf.attributes.position;
  for (let vertex = 0; vertex < vertices.count; vertex++) {
    const vertical = vertices.getY(vertex);
    vertices.setXYZ(vertex, vertices.getX(vertex) * Math.pow(Math.sin(vertical * Math.PI), 0.7) + Math.sin(vertical * 5) * 0.06, vertical, Math.sin(vertical * 7) * vertical * 0.08);
  }
  leaf.computeVertexNormals();
  const kelpMaterial = new THREE.MeshStandardMaterial({ color: '#81955f', side: THREE.DoubleSide, roughness: 0.82 });
  kelpMaterial.onBeforeCompile = shader => {
    shader.uniforms.kelpTime = time;
    shader.vertexShader = 'uniform float kelpTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(kelpTime * 0.65 + instanceMatrix[3].x * 0.31 + position.y * 3.0) * position.y * position.y * 0.23;');
  };
  kelpMaterial.customProgramCacheKey = () => 'kelp-canopy-v5';
  const kelp = new THREE.InstancedMesh(leaf, kelpMaterial, 160);
  for (let index = 0; index < 160; index++) {
    const angle = random() * Math.PI * 2; const radius = 13 + random() * 9;
    transform.position.set(Math.cos(angle) * radius, -0.1, Math.sin(angle) * radius); transform.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.55);
    transform.scale.set(0.7 + random() * 1.1, index < 34 ? 9 + random() * 9 : 1.3 + random() * 3.5, 1); transform.updateMatrix(); kelp.setMatrixAt(index, transform.matrix);
    kelp.setColorAt(index, new THREE.Color(index % 3 ? '#82966d' : '#c1a16c'));
  }
  root.add(kelp); return root;
}

function schoolGeometry(kind) {
  const body = new THREE.SphereGeometry(1, 10, 7); body.scale(kind === 1 ? 0.15 : 0.19, kind === 1 ? 0.66 : 0.3, kind === 1 ? 0.75 : 1.15);
  const tail = new THREE.ConeGeometry(kind === 1 ? 0.55 : 0.46, 0.6, 3); tail.rotateX(Math.PI / 2); tail.scale(0.16, 1, 1); tail.translate(0, 0, kind === 1 ? 0.88 : 1.18);
  const geometry = mergeGeometries([body, tail]); body.dispose(); tail.dispose(); return geometry;
}

function schools(time) {
  const root = new THREE.Group(); const meshes = [];
  const random = seededRandom(4537); const paths = [];
  for (let kind = 0; kind < 3; kind++) {
    const material = new THREE.MeshStandardMaterial({ color: ['#d8b476', '#e8d49d', '#b69eac'][kind], roughness: 0.45, metalness: kind === 0 ? 0.42 : 0.15 });
    material.onBeforeCompile = shader => {
      shader.uniforms.fishTime = time;
      shader.vertexShader = 'attribute float schoolPhase; uniform float fishTime; varying vec3 fishPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfishPosition = position; transformed.x += sin(fishTime * 7.0 + schoolPhase + position.z * 2.1) * smoothstep(0.0, 1.5, position.z) * 0.22;');
      shader.fragmentShader = 'varying vec3 fishPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        ${kind === 1 ? 'float stripe = smoothstep(0.15,0.32,abs(sin(fishPosition.z * 8.0))); diffuseColor.rgb *= mix(0.21,1.0,stripe);' : 'diffuseColor.rgb *= 0.85 + smoothstep(-0.3,0.2,fishPosition.y) * 0.18;'}
        float eye = length(vec2(fishPosition.z + ${kind === 1 ? '0.53' : '0.89'}, fishPosition.y - 0.09));
        diffuseColor.rgb *= smoothstep(0.045, 0.075, eye) * 0.9 + 0.1;
      `);
    };
    material.customProgramCacheKey = () => `reef-fish-${kind}-v5`;
    const count = kind === 0 ? 300 : kind === 1 ? 65 : 200;
    const mesh = new THREE.InstancedMesh(schoolGeometry(kind), material, count); mesh.frustumCulled = false; mesh.userData.noAO = true; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.creature = 'shoal';
    const members = Array.from({ length: count }, (_, index) => ({ phase: random() * Math.PI * 2, radius: 6 + random() * 15, height: (random() - 0.5) * 12, group: index % 6, size: kind === 1 ? 0.65 + random() * 0.7 : 0.32 + random() * 0.58 }));
    members.forEach((fish, index) => { fish.mesh = mesh; fish.index = index; fish.alive = true; });
    mesh.geometry.setAttribute('schoolPhase', new THREE.InstancedBufferAttribute(new Float32Array(members.map(fish => fish.phase)), 1));
    meshes.push(mesh); paths.push(members); root.add(mesh);
  }
  const transform = new THREE.Object3D(); const position = new THREE.Vector3(); const motion = new SchoolMotion(); const members = paths.flat();
  return { root, count: 565, members, animate(clock, anchor, camera, predators, delta, collisions) {
    motion.begin(members, delta);
    meshes.forEach((mesh, kind) => {
      paths[kind].forEach((fish, index) => {
        schoolTarget(fish, clock, 'reef', anchor, position);
        const fleeing = predators.reduce((point, predator) => avoidPosition(point, predator, 16, fish.phase), avoidPosition(position.toArray(), camera, 18, fish.phase));
        position.fromArray(fleeing);
        transform.position.copy(motion.advance(fish, position, delta, collisions)); transform.rotation.set(0, fish.renderHeading ?? fish.heading, Math.sin(clock * 2 + fish.phase) * 0.05); transform.scale.setScalar(fish.alive ? fish.size : 0); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  } };
}

function starfishGeometry() {
  const shape = new THREE.Shape();
  for (let vertex = 0; vertex < 10; vertex++) {
    const angle = vertex / 10 * Math.PI * 2; const radius = vertex % 2 ? 0.25 : 1;
    if (vertex === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius); else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath(); const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, steps: 1 }); geometry.rotateX(-Math.PI / 2); return geometry;
}

export class OceanEcology {
  constructor(scene) {
    this.root = new THREE.Group(); this.root.name = 'layered-living-ecosystem'; scene.add(this.root);
    this.time = { value: 0 }; this.templates = [379, 571, 887].map(seed => reefTemplate(seed, this.time));
    this.patches = new Map(); this.pool = []; this.anchor = [0, 0, 0]; this.anchorTarget = null; this.cell = null; this.lastTime = 0;
    this.schools = schools(this.time); this.root.add(this.schools.root);
    this.foodWeb = new FoodWeb(); this.protectedActor = null;
    this.ancient = createAncientFish(); this.ancient.root.scale.setScalar(1.85); this.ancient.root.rotation.y = -Math.PI / 2; this.root.add(this.ancient.root);
    this.animals = [];
    for (let index = 0; index < 3; index++) this.animals.push({ ...createShark({ hammerhead: index === 2 }), kind: 'shark', index });
    for (let index = 0; index < 4; index++) this.animals.push({ ...createTurtle(), kind: 'turtle', index });
    for (let index = 0; index < 6; index++) this.animals.push({ ...createNautilus(), kind: 'nautilus', index });
    this.animals.push({ ...createMermaid(), kind: 'mermaid', index: 0 });
    this.animals.forEach(animal => { animal.root.userData.noAO = true; this.root.add(animal.root); });
    this.stars = new THREE.InstancedMesh(starfishGeometry(), new THREE.MeshStandardMaterial({ color: '#c2856d', roughness: 0.8 }), 60); this.root.add(this.stars);
    this.lastKey = ''; this.activeHabitat = 'city';
  }

  update(position, offset, time, delta) {
    this.root.position.copy(offset).multiplyScalar(-1);
    if (this.initialized && delta === 0 && time === this.lastTime) return;
    this.initialized = true;
    this.time.value = time; this.lastTime = time; this.root.position.copy(offset).multiplyScalar(-1);
    const landmark = localLandmark(position.toArray());
    const cell = landmark?.id || `${Math.floor(position.x / CELL)}:${Math.floor(position.z / CELL)}`;
    if (cell !== this.cell) {
      this.cell = cell;
      const anchor = landmark?.id === 'palace' ? [0, 0, 0] : landmark ? [landmark.center[0], seaHeight(landmark.center[0], landmark.center[2]), landmark.center[2] - 45] : [(Math.floor(position.x / CELL) + 0.5) * CELL, seaHeight(position.x, position.z), (Math.floor(position.z / CELL) + 0.5) * CELL - 65];
      if (landmark?.kind === 'castle') anchor[0] += 340;
      if (!this.anchorTarget || Math.hypot(...anchor.map((value, index) => value - this.anchor[index])) > 800) this.anchor = [...anchor];
      this.anchorTarget = anchor;
    }
    this.anchor = this.anchor.map((value, index) => THREE.MathUtils.damp(value, this.anchorTarget[index], 0.35, delta));
    this.activeHabitat = landmark?.id || biomeAt(position.x, position.z).id;
    const anchors = habitatAnchors(position.toArray()); const key = anchors.map(anchor => anchor.key).sort().join('|');
    if (key !== this.lastKey) {
      this.lastKey = key; const needed = new Set(anchors.map(anchor => anchor.key));
      for (const [id, patch] of this.patches) if (!needed.has(id)) { patch.visible = false; this.patches.delete(id); this.pool.push(patch); }
      for (const anchor of anchors) {
        if (this.patches.has(anchor.key)) continue;
        let patch = this.pool.pop();
        if (!patch) { patch = new THREE.Group(); this.root.add(patch); }
        patch.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
        patch.clear(); patch.add(this.templates[anchor.variant].clone(true)); patch.position.fromArray(anchor.center); patch.visible = true; this.patches.set(anchor.key, patch);
      }
      const transform = new THREE.Object3D();
      this.stars.count = anchors.length * 6;
      for (let index = 0; index < this.stars.count; index++) {
        const anchor = anchors[Math.floor(index / 6)]; const angle = index * 2.399;
        const horizontal = anchor.center[0] + Math.cos(angle) * (10 + index % 3 * 4); const depth = anchor.center[2] + Math.sin(angle) * (10 + index % 3 * 4);
        transform.position.set(horizontal, seaHeight(horizontal, depth) + 0.15, depth); transform.rotation.set(0.05, angle, 0); transform.scale.setScalar(0.4 + index % 4 * 0.16); transform.updateMatrix(); this.stars.setMatrixAt(index, transform.matrix);
      }
      this.stars.instanceMatrix.needsUpdate = true; this.stars.computeBoundingSphere();
    }
    const nocturnal = ['choir', 'vortex', 'vents'].includes(this.activeHabitat);
    this.ancient.root.visible = ['palace', 'garden', 'ruins', 'trench'].includes(this.activeHabitat);
    const ancientRoute = habitatRoute('ancient', 0, time, this.anchor);
    this.ancient.root.position.fromArray(ancientRoute.position);
    this.ancient.root.rotation.set(0.018, dampAngle(this.ancient.root.rotation.y, ancientRoute.heading, 0.8, delta), Math.sin(time * 0.08) * 0.022);
    const predators = this.animals.filter(animal => animal.kind === 'shark');
    this.schools.animate(time, this.anchor, position.toArray(), predators.filter(animal => animal.root.visible).map(animal => animal.root.position.toArray()), delta, this.collisions);
    if (delta > 0) this.ancient.animate(time);
    for (const animal of this.animals) {
      const { root, kind, index } = animal;
      root.visible = kind === 'mermaid' ? this.activeHabitat === 'palace' : ['turtle', 'shark'].includes(kind) ? !nocturnal : true;
      const route = habitatRoute(kind, index, time, this.anchor);
      root.position.fromArray(route.position);
      root.rotation.set(kind === 'mermaid' ? -0.06 : 0.02, route.heading, Math.sin(time * 0.23 + index) * 0.025);
      if (kind === 'turtle') root.scale.setScalar(1.2 + index * 0.12);
      else if (kind === 'nautilus') root.scale.setScalar(1.15);
      if (delta > 0) animal.animate(time * 0.8);
    }
    this.foodWeb.update(delta, predators, this.schools.members, this.protectedActor, position, this.collisions);
  }

  inspect() {
    return { habitat: this.activeHabitat, patches: this.patches.size, pooled: this.pool.length, schoolingFish: this.foodWeb.inspect(this.schools.members).living, foodWeb: this.foodWeb.inspect(this.schools.members), species: ['装甲古鱼（幻想）', '灰礁鲨', '海龟', '鹦鹉螺', '礁鱼', '蝶鱼', '拟花鲈', '海星', '神话人鱼'], time: this.lastTime, ancient: { visible: this.ancient.root.visible, position: this.ancient.root.position.toArray() }, animals: this.animals.filter(animal => animal.root.visible).map(animal => ({ kind: animal.kind, position: animal.root.position.toArray() })), reactions: ['camera-avoidance', 'shark-pursuit', 'school-evasion', 'satiation', 'limited-immigration'] };
  }
}
