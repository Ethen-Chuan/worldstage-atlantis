import * as THREE from 'three';
import { sculptTemple, sculptArch, sculptGate, sculptCoral, sculptTrident } from './sculptures.js';
import { createWhale, createManta, createJellies } from './creatures.js';
import { createAncientFish, createTurtle, createNautilus, createMermaid } from './mythic-creatures.js';
import { COLORS, ASSETS, LIVING_ASSETS } from './creation.js';
import { seededRandom } from './core.js';
import { dampAngle, springPosition } from './swim.js';

function makeShoal() {
  const root = new THREE.Group();
  const geometry = new THREE.SphereGeometry(1, 10, 6);
  geometry.scale(0.25, 0.45, 1.2);
  const material = new THREE.MeshStandardMaterial({ color: '#d7c994', metalness: 0.35, roughness: 0.45 });
  const body = new THREE.InstancedMesh(geometry, material, 100);
  const tailGeometry = new THREE.ConeGeometry(0.65, 0.9, 3);
  tailGeometry.rotateX(Math.PI / 2);
  tailGeometry.scale(0.15, 1, 1);
  const tails = new THREE.InstancedMesh(tailGeometry, material, 100);
  root.add(body, tails);
  const random = seededRandom(628);
  const fish = Array.from({ length: 100 }, () => ({ phase: random() * Math.PI * 2, radius: 4 + random() * 11, height: (random() - 0.5) * 8, size: 0.3 + random() * 0.45 }));
  const transform = new THREE.Object3D();
  const direction = new THREE.Vector3();
  body.frustumCulled = tails.frustumCulled = false;
  return {
    root, animate(time) {
      fish.forEach((fish, index) => {
        const angle = fish.phase + time * 0.22;
        transform.position.set(Math.cos(angle) * fish.radius, fish.height + Math.sin(time + fish.phase), Math.sin(angle) * fish.radius * 0.65);
        transform.rotation.set(0, Math.atan2(Math.sin(angle), -Math.cos(angle) * 0.65), Math.sin(time * 4 + fish.phase) * 0.06);
        transform.scale.setScalar(fish.size);
        transform.updateMatrix();
        body.setMatrixAt(index, transform.matrix);
        direction.set(0, 0, fish.size * 1.6).applyEuler(transform.rotation);
        transform.position.add(direction);
        transform.updateMatrix();
        tails.setMatrixAt(index, transform.matrix);
      });
      body.instanceMatrix.needsUpdate = tails.instanceMatrix.needsUpdate = true;
    },
  };
}

export class CreationScene {
  constructor(scene, materials) {
    this.root = new THREE.Group();
    this.root.name = 'persistent-creation-graph';
    scene.add(this.root);
    this.materials = materials;
    this.objects = new Map();
    this.templates = new Map();
    this.time = 0;
    this.paused = false;
    this.selected = null;
    this.offset = new THREE.Vector3();
    this.selection = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 96), new THREE.MeshBasicMaterial({ color: '#d2bc86', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.visible = false;
    this.selection.userData.noAO = true;
    this.root.add(this.selection);
    const random = seededRandom(158);
    const dustPosition = [];
    for (let index = 0; index < 450; index++) dustPosition.push((random() - 0.5) * 2, random(), (random() - 0.5) * 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPosition, 3));
    this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#d5c996', size: 0.18, transparent: true, opacity: 0, depthWrite: false }));
    this.dust.visible = false;
    this.root.add(this.dust);
  }

  build(item) {
    let result;
    const factories = { temple: sculptTemple, arch: sculptArch, gate: sculptGate, coral: sculptCoral, trident: sculptTrident };
    if (factories[item.asset]) {
      if (!this.templates.has(item.asset)) this.templates.set(item.asset, factories[item.asset](this.materials));
      result = { root: this.templates.get(item.asset).clone(true), animate: () => {} };
    } else {
      const creatures = { whale: createWhale, manta: createManta, jelly: createJellies, shoal: makeShoal, ancient: createAncientFish, turtle: createTurtle, nautilus: createNautilus, mermaid: createMermaid };
      result = creatures[item.asset]();
    }
    const shape = result.root;
    shape.position.set(0, 0, 0);
    shape.rotation.set(0, item.asset === 'whale' ? -1.12 : 0, 0);
    const authoredScale = shape.scale.clone();
    const root = new THREE.Group();
    root.name = item.name;
    root.userData.creationId = item.id;
    root.add(shape);
    const materialCopies = new Map();
    shape.traverse(object => {
      if (!object.material || Array.isArray(object.material)) return;
      const source = object.material;
      if (!materialCopies.has(source)) {
        const material = factories[item.asset] ? source.clone() : source;
        material.onBeforeCompile = source.onBeforeCompile;
        material.customProgramCacheKey = source.customProgramCacheKey;
        material.userData.baseColor = source.color?.clone();
        material.userData.baseEmissive = source.emissive?.clone();
        material.userData.baseIntensity = source.emissiveIntensity || 0;
        material.userData.baseRoughness = source.roughness;
        material.userData.surface = object.name;
        materialCopies.set(source, material);
      }
      object.material = materialCopies.get(source);
    });
    const bound = new THREE.Box3().setFromObject(shape);
    const size = bound.getSize(new THREE.Vector3());
    const entry = { root, shape, animate: result.animate, setGlow: result.setGlow, setColor: result.setColor, materials: [...materialCopies.values()], authoredScale, age: item.preset ? 10 : 0, duration: item.asset === 'temple' ? 4 : 2.8, size, item, currentScale: item.params.scale, currentHeight: item.params.height, currentSpeed: item.params.speed, currentSpread: item.params.spread, currentGlow: 0, clock: 0, roamStart: 0, followPosition: new THREE.Vector3(...item.position), velocity: new THREE.Vector3(), ownsGeometry: !factories[item.asset] };
    if (LIVING_ASSETS.includes(item.asset)) shape.traverse(object => { if (object.isMesh) object.userData.noAO = true; });
    this.root.add(root);
    return entry;
  }

  sync(state, instant = false) {
    const ids = new Set(state.entities.map(item => item.id));
    for (const [id, entry] of this.objects) {
      if (ids.has(id) && state.entities.find(item => item.id === id)?.asset === entry.item.asset) continue;
      this.root.remove(entry.root);
      entry.materials.forEach(material => material.dispose());
      if (entry.ownsGeometry) entry.root.traverse(object => object.geometry?.dispose());
      this.objects.delete(id);
    }
    for (const item of state.entities) {
      let entry = this.objects.get(item.id);
      const isNew = !entry;
      if (isNew) {
        entry = this.build(item);
        if (instant) entry.age = 10;
        this.objects.set(item.id, entry);
      }
      if (item.following !== entry.item.following || item.orbit !== entry.item.orbit) entry.roamStart = entry.clock;
      if (instant) {
        entry.followPosition.fromArray(item.position); entry.velocity.set(0, 0, 0); entry.roamStart = entry.clock;
        entry.currentScale = item.params.scale; entry.currentHeight = item.params.height; entry.currentSpeed = item.params.speed; entry.currentSpread = item.params.spread;
      }
      entry.item = item;
      entry.setColor?.(item.params.color);
      entry.setGlow?.(item.params.glow);
      for (const material of entry.materials) {
        const base = material.userData.baseColor;
        if (!base || !material.color) continue;
        const tint = new THREE.Color(COLORS[item.params.color]);
        const surface = material.userData.surface;
        const factor = item.asset === 'jelly' ? 0.82 : LIVING_ASSETS.includes(item.asset) ? 0.4 : ['gold', 'copper', 'coral', 'coralLight'].includes(surface) ? 0.74 : 0.08;
        material.userData.targetColor = base.clone().lerp(tint, material.userData.keepColor ? 0 : factor).multiplyScalar(1 - item.params.weathering * 0.16);
        if (isNew || instant) material.color.copy(material.userData.targetColor);
        if (Number.isFinite(material.userData.baseRoughness)) material.userData.targetRoughness = Math.min(1, material.userData.baseRoughness + item.params.weathering * 0.03);
      }
      entry.shape.traverse(object => { if (object.userData.erosion) object.visible = item.params.weathering > 0.3; });
    }
    this.paused = state.paused;
    this.selected = state.selected;
  }

  update(delta, reduced = false, viewpoint = null) {
    if (this.paused) delta = 0;
    this.time += delta;
    const resonances = new Map();
    let newest = null;
    for (const entry of this.objects.values()) {
      const { item, root, shape } = entry;
      entry.age += delta * (reduced ? 3 : 1);
      const speedBefore = entry.currentSpeed;
      entry.currentSpeed = THREE.MathUtils.damp(entry.currentSpeed, item.params.speed, 2, delta);
      entry.clock += item.params.speed * delta + (speedBefore - item.params.speed) * (1 - Math.exp(-2 * delta)) / 2;
      entry.currentScale = THREE.MathUtils.damp(entry.currentScale, item.params.scale, 2.5, delta);
      entry.currentHeight = THREE.MathUtils.damp(entry.currentHeight, item.params.height, 2, delta);
      entry.currentSpread = THREE.MathUtils.damp(entry.currentSpread, item.params.spread, 2.5, delta);
      const progress = Math.min(entry.age / entry.duration, 1);
      const growth = 1 - Math.pow(1 - progress, 3);
      const living = LIVING_ASSETS.includes(item.asset);
      root.scale.set(entry.currentScale * (living ? growth : 1), entry.currentScale * growth, entry.currentScale * (living ? growth : 1));
      const destination = new THREE.Vector3(...item.position);
      let heading = shape.rotation.y;
      if (living) {
        const phase = Number(item.id.slice(5));
        destination.y += (Math.sin(entry.clock * 0.37 + phase) - Math.sin(entry.roamStart * 0.37 + phase)) * (item.asset === 'whale' ? 1.8 : 0.6);
        const roam = item.preset && item.asset === 'whale' ? 27 : item.asset === 'manta' ? 9 : 5;
        destination.x += (Math.sin(entry.clock * 0.11) - Math.sin(entry.roamStart * 0.11)) * roam;
        destination.z += (Math.cos(entry.clock * 0.11) - Math.cos(entry.roamStart * 0.11)) * roam * 0.4;
        heading = item.asset === 'mermaid' ? Math.PI : Math.atan2(-Math.cos(entry.clock * 0.11), Math.sin(entry.clock * 0.11) * 0.4);
      }
      if (item.following && viewpoint) {
        const distance = ['whale', 'ancient'].includes(item.asset) ? 48 : 27;
        destination.copy(viewpoint.position).addScaledVector(viewpoint.forward, distance);
        destination.y += item.asset === 'whale' ? 9 : -3;
        destination.x += Math.cos(Number(item.id.slice(5)) * 2.4) * 9;
        destination.y += Math.sin(entry.clock * 0.6) * 0.4;
      }
      if (item.orbit && this.objects.has(item.orbit)) {
        const reference = this.objects.get(item.orbit);
        const radius = Math.max(reference.size.x * reference.currentScale * 0.65, 20) + 12;
        const angle = entry.clock * 0.1;
        destination.copy(reference.root.position).add(this.offset).add(new THREE.Vector3(Math.cos(angle) * radius, Math.max(18, reference.size.y * reference.currentScale * 0.52), Math.sin(angle) * radius));
        heading = -angle;
      }
      if (living) {
        springPosition(entry.followPosition, entry.velocity, destination, (item.following ? 1.65 : 2.7) * Math.sqrt(Math.max(0.2, entry.currentSpeed)), delta);
        root.position.copy(entry.followPosition).sub(this.offset);
        if ((item.following || item.orbit) && entry.velocity.lengthSq() > 0.03) heading = Math.atan2(-entry.velocity.x, -entry.velocity.z);
        if (item.asset !== 'jelly') {
          const difference = Math.atan2(Math.sin(heading - shape.rotation.y), Math.cos(heading - shape.rotation.y));
          shape.rotation.y = dampAngle(shape.rotation.y, heading, ['whale', 'ancient'].includes(item.asset) ? 1.15 : 1.8, delta);
          const banking = THREE.MathUtils.clamp(-difference * 0.12, -0.14, 0.14);
          shape.rotation.z = THREE.MathUtils.damp(shape.rotation.z, banking, 1.5, delta);
          const pitch = item.asset === 'mermaid' ? 0 : THREE.MathUtils.clamp(Math.atan2(entry.velocity.y, Math.hypot(entry.velocity.x, entry.velocity.z) + 0.2), -0.16, 0.16);
          shape.rotation.x = THREE.MathUtils.damp(shape.rotation.x, pitch, 1.25, delta);
        }
      } else root.position.copy(destination).sub(this.offset);
      root.position.y += entry.currentHeight - (1 - growth) * 6;
      shape.scale.copy(entry.authoredScale).multiplyScalar(item.asset === 'coral' || item.asset === 'jelly' || item.asset === 'shoal' ? entry.currentSpread : 1);
      for (const material of entry.materials) {
        if (material.userData.targetColor) material.color.lerp(material.userData.targetColor, 1 - Math.exp(-2.7 * delta));
        if (Number.isFinite(material.userData.targetRoughness)) material.roughness = THREE.MathUtils.damp(material.roughness, material.userData.targetRoughness, 2.7, delta);
      }
      if (delta > 0) entry.animate(entry.clock, delta);
      if (item.resonance && this.objects.has(item.resonance)) {
        const coral = this.objects.get(item.resonance);
        const distance = root.position.distanceTo(coral.root.position);
        resonances.set(item.resonance, Math.max(resonances.get(item.resonance) || 0, 1 - THREE.MathUtils.smoothstep(distance, 22, 70)));
      }
      if (progress < 1) newest = entry;
    }
    for (const [id, entry] of this.objects) {
      const targetIntensity = entry.item.params.glow ? 0.7 + Math.sin(entry.clock * 1.1) * 0.12 : (resonances.get(id) || 0) * 1.35;
      entry.currentGlow = THREE.MathUtils.damp(entry.currentGlow, targetIntensity, 2.4, delta);
      const intensity = entry.currentGlow;
      entry.resonanceLevel = resonances.get(id) || 0;
      for (const material of entry.materials) {
        if (!material.emissive) continue;
        material.emissive.copy(material.userData.baseEmissive || new THREE.Color(0)).lerp(material.color, Math.min(0.85, intensity));
        material.emissiveIntensity = material.userData.baseIntensity + intensity;
      }
    }
    this.selection.visible = Boolean(this.selected && this.objects.get(this.selected)?.root.visible);
    if (this.selection.visible) {
      const entry = this.objects.get(this.selected);
      this.selection.position.copy(entry.root.position);
      this.selection.position.y += 0.3;
      const radius = Math.max(entry.size.x, entry.size.z) * entry.currentScale * 0.53;
      this.selection.scale.setScalar(Math.max(radius, 3));
    }
    this.dust.visible = Boolean(newest);
    if (newest) {
      const progress = Math.min(newest.age / newest.duration, 1);
      this.dust.position.copy(newest.root.position);
      this.dust.position.y += 1;
      const width = Math.min(newest.size.x * newest.currentScale * 0.55, 28);
      this.dust.scale.set(width * (1 + progress), 2 + progress * 9, width * (1 + progress));
      this.dust.material.opacity = Math.sin(progress * Math.PI) * 0.38;
    }
  }

  inspect() {
    return [...this.objects.values()].map(entry => ({ id: entry.item.id, name: ASSETS[entry.item.asset], position: entry.root.position.toArray(), rotation: entry.shape.rotation.toArray().slice(0, 3), velocity: entry.velocity.toArray(), speed: entry.currentSpeed, scale: entry.currentScale, age: entry.age, growing: entry.age < entry.duration, orbit: entry.item.orbit, following: Boolean(entry.item.following), resonance: entry.resonanceLevel || 0 }));
  }

  captureFollowing(state) {
    const captured = structuredClone(state);
    for (const item of captured.entities) {
      const entry = this.objects.get(item.id);
      if (item.following && entry?.followPosition) item.position = entry.followPosition.toArray();
      else if (item.orbit && entry) item.position = entry.root.position.clone().add(this.offset).add(new THREE.Vector3(0, -entry.currentHeight, 0)).toArray();
    }
    return captured;
  }
}
