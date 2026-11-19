import * as THREE from 'three';
import { StoneWorkshop, sculptArch, sculptCoral } from './sculptures.js';
import { CHUNK_SIZE, activeChunks, biomeAt, seaHeight, worldHash, chunkLandmarks } from './terrain.js';
import { withinLandmark } from './landmarks.js';
import { createJellyBloom, animateJellyDrift } from './jellyfish.js';

function smallPalace(materials) {
  const shop = new StoneWorkshop(materials);
  shop.terrace(0, 0, 0, 21, 5);
  shop.colonnade(0, 4, 0, 15, 26, 14);
  shop.colonnade(0, 33, 0, 9, 16, 10);
  shop.dome(0, 51, 0, 11, 12);
  return shop.finish('unremembered-palace');
}


export class EndlessOcean {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.chunks = new Map();
    this.cache = new Map();
    this.cacheHits = 0;
    this.offset = new THREE.Vector3();
    this.centerKey = '';
    this.pending = [];
    this.tilesBuilt = 0;
    this.jellyBloom = createJellyBloom({ count: 7, span: [42, 24, 42], sizes: [1.8, 1.2] });
    for (const jelly of this.jellyBloom.jellies) { jelly.userData.base[1] += 24; jelly.position.fromArray(jelly.userData.base); }
    this.templates = { temple: smallPalace(materials), arch: sculptArch(materials), coral: sculptCoral(materials), jelly: this.jellyBloom.root };
    this.rock = new THREE.IcosahedronGeometry(1, 2);
    this.column = new THREE.CylinderGeometry(0.8, 1, 1, 12);
    this.transform = new THREE.Object3D();
    this.horizon = new THREE.Mesh(new THREE.BufferGeometry(), materials.sand);
    this.horizon.name = 'low-detail-distant-seafloor';
    this.horizon.userData.noAO = true;
    this.horizonCenter = new THREE.Vector3();
    scene.add(this.horizon);
  }

  rebuildHorizon(centerX, centerZ) {
    const vertices = [];
    const indices = [];
    const subdivisions = 34;
    const step = CHUNK_SIZE / 2;
    const startX = (centerX - 8) * CHUNK_SIZE;
    const startZ = (centerZ - 8) * CHUNK_SIZE;
    for (let row = 0; row <= subdivisions; row++) for (let column = 0; column <= subdivisions; column++) vertices.push(column * step, seaHeight(startX + column * step, startZ + row * step), row * step);
    for (let row = 0; row < subdivisions; row++) for (let column = 0; column < subdivisions; column++) {
      if (column >= 12 && column < 22 && row >= 12 && row < 22) continue;
      const corner = row * (subdivisions + 1) + column;
      indices.push(corner, corner + subdivisions + 1, corner + 1, corner + 1, corner + subdivisions + 1, corner + subdivisions + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.horizon.geometry.dispose(); this.horizon.geometry = geometry;
    this.horizonCenter.set(startX, 0, startZ);
  }

  build(specification) {
    const { horizontal, depth, key } = specification;
    if (this.cache.has(key)) {
      const cached = this.cache.get(key); this.cache.delete(key); this.chunks.set(key, cached); this.scene.add(cached.root); this.cacheHits++;
      return;
    }
    const root = new THREE.Group(); root.name = `ocean-tile-${key}`;
    const startX = horizontal * CHUNK_SIZE;
    const startZ = depth * CHUNK_SIZE;
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 32, 32);
    geometry.rotateX(-Math.PI / 2); geometry.translate(CHUNK_SIZE / 2, 0, CHUNK_SIZE / 2);
    const position = geometry.attributes.position;
    for (let index = 0; index < position.count; index++) position.setY(index, seaHeight(startX + position.getX(index), startZ + position.getZ(index)));
    geometry.computeVertexNormals();
    const ground = new THREE.Mesh(geometry, this.materials.sand); ground.receiveShadow = true; root.add(ground);
    const decorations = new THREE.Group();
    const rocks = new THREE.InstancedMesh(this.rock, this.materials.rock, 20);
    rocks.userData.collisionBoxes = [];
    this.rock.computeBoundingBox();
    let rockCount = 0;
    for (let index = 0; index < 20; index++) {
      const localX = worldHash(horizontal, depth, index * 5 + 51) * CHUNK_SIZE;
      const localZ = worldHash(horizontal, depth, index * 5 + 52) * CHUNK_SIZE;
      if (Math.hypot(startX + localX, startZ + localZ + 80) < 270 || withinLandmark(startX + localX, startZ + localZ)) continue;
      const biome = biomeAt(startX + localX, startZ + localZ);
      const size = 1 + worldHash(horizontal, depth, index * 5 + 53) * (biome.id === 'trench' ? 18 : 7);
      this.transform.position.set(localX, seaHeight(startX + localX, startZ + localZ) + size * 0.3, localZ);
      this.transform.scale.set(size, size * (biome.id === 'trench' ? 2.6 : 0.8), size * 1.1);
      this.transform.rotation.set(0.2, worldHash(horizontal, depth, index * 5 + 54) * 6, 0.2);
      this.transform.updateMatrix(); rocks.setMatrixAt(rockCount++, this.transform.matrix);
      const bounds = this.rock.boundingBox.clone().applyMatrix4(this.transform.matrix);
      rocks.userData.collisionBoxes.push({ min: bounds.min.toArray(), max: bounds.max.toArray() });
    }
    rocks.count = rockCount; rocks.computeBoundingSphere(); rocks.castShadow = rocks.receiveShadow = true; decorations.add(rocks);
    const landmarks = chunkLandmarks(horizontal, depth);
    for (const landmark of landmarks) {
      if (landmark.kind === 'rock' || withinLandmark(landmark.position[0], landmark.position[2], 35)) continue;
      const object = this.templates[landmark.kind].clone(true);
      object.position.fromArray(landmark.position).sub(new THREE.Vector3(startX, 0, startZ));
      object.rotation.y = landmark.rotation; object.scale.setScalar(landmark.scale);
      object.userData.baseY = object.position.y; object.userData.jelly = landmark.kind === 'jelly';
      decorations.add(object);
      if (landmark.kind === 'coral') {
        for (let index = 0; index < 6; index++) {
          const patch = this.templates.coral.clone(true); patch.position.copy(object.position).add(new THREE.Vector3(Math.cos(index) * 22, 0, Math.sin(index) * 22)); patch.scale.setScalar(0.4 + worldHash(horizontal, depth, 220 + index) * 0.6); decorations.add(patch);
        }
      }
    }
    root.add(decorations);
    root.position.set(startX - this.offset.x, -this.offset.y, startZ - this.offset.z);
    this.scene.add(root); this.chunks.set(key, { root, ground, decorations, rocks, horizontal, depth, landmarks }); this.tilesBuilt++;
  }

  update(globalPosition, offset, time = 0, eager = false) {
    this.jellyBloom.animate(time);
    this.offset.copy(offset);
    const desired = activeChunks(globalPosition.x, globalPosition.z);
    const key = desired[0].key;
    if (key !== this.centerKey) {
      this.centerKey = key;
      this.rebuildHorizon(desired[0].horizontal, desired[0].depth);
      const keys = new Set(desired.map(item => item.key));
      for (const [oldKey, tile] of this.chunks) {
        if (keys.has(oldKey)) continue;
        this.scene.remove(tile.root); this.cache.set(oldKey, tile); this.chunks.delete(oldKey);
      }
      while (this.cache.size > 32) {
        const oldest = this.cache.keys().next().value; const tile = this.cache.get(oldest);
        tile.ground.geometry.dispose(); tile.rocks.dispose(); this.cache.delete(oldest);
      }
      this.pending = desired.filter(item => !this.chunks.has(item.key));
    }
    const budget = eager === 'arrival' ? 9 : eager ? this.pending.length : 1;
    this.horizon.position.copy(this.horizonCenter).sub(offset);
    for (let index = 0; index < budget && this.pending.length; index++) this.build(this.pending.shift());
    for (const tile of this.chunks.values()) {
      tile.root.position.set(tile.horizontal * CHUNK_SIZE - offset.x, -offset.y, tile.depth * CHUNK_SIZE - offset.z);
      const distance = Math.hypot((tile.horizontal + 0.5) * CHUNK_SIZE - globalPosition.x, (tile.depth + 0.5) * CHUNK_SIZE - globalPosition.z);
      tile.decorations.visible = distance < 540;
      for (const object of tile.decorations.children) if (object.userData.jelly) for (const jelly of object.children) animateJellyDrift(jelly, time);
    }
    return biomeAt(globalPosition.x, globalPosition.z);
  }

  inspect() { return { active: this.chunks.size, pending: this.pending.length, cached: this.cache.size, cacheHits: this.cacheHits, totalBuilt: this.tilesBuilt, center: this.centerKey, keys: [...this.chunks.keys()].sort() }; }
}
