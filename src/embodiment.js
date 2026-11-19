import * as THREE from 'three';
import { ASSETS, LIVING_ASSETS } from './creation.js';
import { seaHeight } from './terrain.js';
import { dampAngle } from './swim.js';
import { actorHull } from './collision-world.js';

export function embodimentMarkup() {
  return `<section id="inhabit-controls" class="inhabit-controls" aria-label="代入视角控制" hidden><div><span class="eyebrow" id="inhabit-mode"></span><strong id="inhabit-title"></strong><p id="inhabit-help"></p></div><div class="inhabit-actions"><button id="inhabit-view">切换第三人称</button><button id="inhabit-speak" aria-expanded="false">对世界说话</button><button id="inhabit-trial">以当前生物探索</button><button id="inhabit-exit">返回自由探索 <small>Esc</small></button></div></section><div id="swim-pad" class="swim-pad" aria-label="触屏移动" hidden><button data-swim="up" aria-label="上浮">升</button><button data-swim="forward" aria-label="向前游">↑</button><button data-swim="down" aria-label="下潜">降</button><button data-swim="left" aria-label="向左游">←</button><button data-swim="back" aria-label="向后游">↓</button><button data-swim="right" aria-label="向右游">→</button></div>`;
}

function visible(object) {
  for (let current = object; current; current = current.parent) if (!current.visible || current.userData.noPick) return false;
  return true;
}

export class Embodiment {
  constructor(ocean) {
    this.ocean = ocean; this.active = null; this.candidate = null; this.velocity = new THREE.Vector3(); this.firstPerson = false;
    this.heading = 0; this.pitch = 0; this.drag = null; this.releases = [];
    const canvas = ocean.renderer.domElement;
    canvas.addEventListener('pointerdown', event => { if (this.active?.living && this.firstPerson && event.button === 0 && event.isPrimary) { this.drag = [event.clientX, event.clientY, event.pointerId]; canvas.setPointerCapture(event.pointerId); } });
    canvas.addEventListener('pointermove', event => {
      if (!this.drag || this.drag[2] !== event.pointerId || !this.firstPerson || !this.active) return;
      this.desiredHeading = (this.desiredHeading ?? this.heading) - (event.clientX - this.drag[0]) * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (event.clientY - this.drag[1]) * 0.003, -0.85, 0.85);
      this.drag = [event.clientX, event.clientY, event.pointerId];
    });
    const release = () => { this.drag = null; };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  }

  pick(raycaster) {
    this.candidate = null;
    const roots = [this.ocean.city, this.ocean.creationScene.root, this.ocean.ecology.root, ...Object.values(this.ocean.creatures || {}).map(creature => creature.root), ...this.ocean.landmarks.entries.map(entry => entry.root), ...[...this.ocean.wonders.entries.values()].map(entry => entry.root), ...[...this.ocean.endless.chunks.values()].map(tile => tile.ground)].filter(Boolean);
    const hit = raycaster.intersectObjects(roots, true).find(hit => {
      if (hit.distance >= 850 || !hit.object.isMesh || !visible(hit.object)) return false;
      for (let ancestor = hit.object; ancestor; ancestor = ancestor.parent) if (ancestor === this.active?.root) return false;
      return true;
    });
    if (!hit) return null;
    let ancestor = hit.object; let creature = null; let authored = null;
    while (ancestor && ancestor !== this.ocean.scene) {
      if (ancestor === this.active?.root) return null;
      if (ancestor.userData.creature) creature = ancestor;
      if (ancestor.userData.creationId) authored = this.ocean.creationScene.objects.get(ancestor.userData.creationId);
      ancestor = ancestor.parent;
    }
    const point = hit.point.clone().add(this.ocean.worldOffset);
    let candidate;
    if (authored) candidate = { root: authored.root, shape: authored.shape, living: LIVING_ASSETS.includes(authored.item.asset), species: authored.item.asset, name: authored.item.name, id: authored.item.id, point };
    else if (creature) candidate = { root: creature, shape: creature, living: true, species: creature.userData.creature, name: ASSETS[creature.userData.creature] || '海洋生物', point };
    else if (hit.object.isInstancedMesh && hit.object.userData.creature) candidate = { root: hit.object, species: hit.object.userData.creature, living: true, name: '一尾游鱼', instance: hit.instanceId, point };
    else candidate = { root: hit.object, living: false, name: hit.object.name === 'ground' ? '这片海床' : '眼前的遗迹与珊瑚', point };
    if (hit.object.isInstancedMesh && creature === hit.object) { candidate.instance = hit.instanceId; candidate.point = point; }
    this.candidate = candidate;
    return candidate;
  }

  enter(candidate = this.candidate, { firstPerson = true } = {}) {
    if (!candidate) return false;
    const savedView = this.active ? this.savedView : this.ocean.captureView();
    this.exit(false);
    this.savedView = savedView;
    this.active = { ...candidate }; this.firstPerson = Boolean(candidate.living && firstPerson); this.velocity.set(0, 0, 0);
    const release = this.releases.find(entry => entry.root === candidate.root);
    if (release) { this.active.naturalLocalPosition = release.basePosition; this.active.naturalRotation = release.baseRotation; this.releases = this.releases.filter(entry => entry !== release); }
    if (Number.isInteger(candidate.instance)) {
      const matrix = new THREE.Matrix4(); candidate.root.getMatrixAt(candidate.instance, matrix);
      const color = new THREE.Color('#bac4b0'); if (candidate.root.instanceColor) candidate.root.getColorAt(candidate.instance, color);
      const clone = new THREE.Mesh(candidate.root.geometry.clone(), new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.02 }));
      this.active.sourceMatrix = matrix.clone();
      matrix.premultiply(candidate.root.matrixWorld); matrix.decompose(clone.position, clone.quaternion, clone.scale); this.ocean.scene.add(clone);
      this.active.source = candidate.root; this.active.root = clone; this.active.shape = clone; this.active.disposable = true;
    }
    const target = this.active;
    target.originalVisible = target.root.visible;
    target.root.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(target.root); const size = bounds.getSize(new THREE.Vector3());
    this.radius = target.living ? THREE.MathUtils.clamp(size.length() * 0.52, 4, 65) : THREE.MathUtils.clamp(size.length() * 0.1, 14, 70);
    this.position = target.living ? target.root.getWorldPosition(new THREE.Vector3()).add(this.ocean.worldOffset) : target.point.clone();
    this.heading = target.shape?.rotation.y || 0;
    this.desiredHeading = null;
    this.collisionHull = target.living ? actorHull(target) : null;
    if (target.living && this.ocean.collisions) this.position.copy(this.ocean.collisions.move(this.position, this.position, { hull: this.collisionHull, ignore: target.root }));
    this.pitch = 0;
    this.ocean.travelTarget = null; this.ocean.cruising = false; this.ocean.movement.clear(); this.ocean.navigationVelocity.set(0, 0, 0);
    const behind = new THREE.Vector3(0, this.radius * 0.38 + 3, this.radius * 1.85).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    const destination = this.position.clone().add(behind); const lookTarget = this.position.clone();
    if (this.firstPerson) {
      const direction = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
      destination.copy(this.position).addScaledVector(direction, this.radius * 0.55); destination.y += this.radius * 0.08; lookTarget.copy(destination).add(direction);
    }
    this.clearOrbitMomentum();
    this.blend = { elapsed: 0, origin: this.ocean.camera.position.clone().add(this.ocean.worldOffset), look: this.ocean.controls.target.clone().add(this.ocean.worldOffset), destination, target: lookTarget, duration: this.ocean.reduced ? 0.4 : 1.8 };
    this.ocean.controls.enabled = false;
    this.ocean.controls.autoRotate = false; this.ocean.controls.autoRotateSpeed = 0.4;
    return true;
  }

  clearOrbitMomentum() {
    const controls = this.ocean.controls; const position = this.ocean.camera.position.clone(); const target = controls.target.clone();
    const damping = controls.enableDamping; controls.autoRotate = false; controls.enableDamping = false; controls.update?.();
    controls.enableDamping = damping; this.ocean.camera.position.copy(position); controls.target.copy(target); this.ocean.camera.lookAt(target);
  }

  setView() {
    if (this.blend) return;
    if (!this.active?.living) { this.ocean.controls.autoRotate = !this.ocean.controls.autoRotate; return; }
    this.firstPerson = !this.firstPerson; this.ocean.controls.enabled = false;
    const target = this.position.clone();
    let destination;
    if (!this.firstPerson) {
      this.active.root.visible = true;
      destination = target.clone().add(new THREE.Vector3(0, this.radius * 0.38 + 3, this.radius * 1.85).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading));
    } else {
      const direction = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
      destination = target.clone().addScaledVector(direction, this.radius * 0.55); destination.y += this.radius * 0.08; target.copy(destination).add(direction);
    }
    this.blend = { elapsed: 0, origin: this.ocean.camera.position.clone().add(this.ocean.worldOffset), look: this.ocean.controls.target.clone().add(this.ocean.worldOffset), destination, target, duration: this.ocean.reduced ? 0.3 : 1.25 };
  }

  update(delta) {
    for (let index = this.releases.length - 1; index >= 0; index--) {
      const release = this.releases[index]; release.elapsed += delta;
      if (!release.root.parent) { this.releases.splice(index, 1); continue; }
      const fraction = Math.min(1, release.elapsed / release.duration); const weight = 1 - fraction * fraction * (3 - 2 * fraction);
      if (release.source) {
        release.source.updateWorldMatrix(true, false);
        const matrix = new THREE.Matrix4(); release.source.getMatrixAt(release.instance, matrix); release.sourceMatrix = matrix.clone();
        matrix.premultiply(release.source.matrixWorld);
        const natural = new THREE.Vector3().setFromMatrixPosition(matrix);
        release.root.position.lerpVectors(natural, release.origin.clone().sub(this.ocean.worldOffset), weight);
        if (fraction === 1) { release.root.removeFromParent(); release.root.geometry.dispose(); release.root.material.dispose(); this.releases.splice(index, 1); }
        else { release.source.setMatrixAt(release.instance, new THREE.Matrix4().makeScale(0, 0, 0)); release.source.instanceMatrix.needsUpdate = true; }
        continue;
      }
      release.basePosition = release.root.position.clone(); release.baseRotation = release.shape.quaternion.clone();
      release.root.updateWorldMatrix(true, false);
      const position = release.root.getWorldPosition(new THREE.Vector3()).addScaledVector(release.offset, weight);
      release.root.position.copy(release.root.parent.worldToLocal(position));
      const rotation = new THREE.Quaternion().slerp(release.rotation, weight);
      release.shape.quaternion.premultiply(rotation);
      if (this.ocean.collisions) {
        const desired = release.root.getWorldPosition(new THREE.Vector3()).add(this.ocean.worldOffset);
        const safe = this.ocean.collisions.move(release.safePosition || desired, desired, { hull: actorHull(release), ignore: release.root });
        release.root.position.copy(release.root.parent.worldToLocal(safe.clone().sub(this.ocean.worldOffset))); release.safePosition = safe;
        this.ocean.collisions.remember(release, safe);
      }
      if (fraction === 1) this.releases.splice(index, 1);
    }
    const target = this.active; if (!target) return;
    if (target.living && !target.id && !target.disposable && !target.temporary) {
      target.naturalPosition = target.root.getWorldPosition(new THREE.Vector3()).add(this.ocean.worldOffset);
      target.naturalRotation = target.shape.quaternion.clone(); target.naturalLocalPosition = target.root.position.clone();
    }
    if (target.source) { target.sourceMatrix = new THREE.Matrix4(); target.source.getMatrixAt(target.instance, target.sourceMatrix); target.source.setMatrixAt(target.instance, new THREE.Matrix4().makeScale(0, 0, 0)); target.source.instanceMatrix.needsUpdate = true; }
    if (this.blend) {
      const blend = this.blend; blend.elapsed += delta;
      const progress = Math.min(1, blend.elapsed / blend.duration); const eased = progress * progress * (3 - 2 * progress);
      this.ocean.camera.position.lerpVectors(blend.origin, blend.destination, eased).sub(this.ocean.worldOffset);
      this.ocean.controls.target.lerpVectors(blend.look, blend.target, eased).sub(this.ocean.worldOffset);
      if (target.living) {
        target.root.parent.updateWorldMatrix(true, false); target.root.position.copy(target.root.parent.worldToLocal(this.position.clone().sub(this.ocean.worldOffset))); target.root.visible = !this.firstPerson || progress < 0.78;
        target.shape.rotation.y = this.heading;
        target.animate?.(this.ocean.time, delta);
      }
      if (progress === 1) { this.blend = null; this.ocean.controls.enabled = !this.firstPerson; this.ocean.controls.autoRotate = !target.living; }
      return;
    }
    if (!target.living) { this.ocean.controls.target.copy(this.position).sub(this.ocean.worldOffset); return; }
    const previous = this.position.clone();
    if (this.desiredHeading != null) {
      const difference = Math.atan2(Math.sin(this.desiredHeading - this.heading), Math.cos(this.desiredHeading - this.heading));
      const turnRate = target.species === 'whale' ? 0.65 : 1.8;
      this.heading += THREE.MathUtils.clamp(difference, -turnRate * delta, turnRate * delta);
      if (Math.abs(difference) < 0.001) this.desiredHeading = null;
    }
    const forward = this.firstPerson ? new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading)) : this.ocean.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const desired = new THREE.Vector3(); const keys = this.ocean.movement;
    if (keys.has('forward')) desired.add(forward); if (keys.has('back')) desired.sub(forward);
    if (keys.has('left')) desired.sub(right); if (keys.has('right')) desired.add(right);
    if (keys.has('up')) desired.y += 0.65; if (keys.has('down')) desired.y -= 0.65;
    const speed = target.species === 'whale' ? 25 : target.species === 'turtle' ? 17 : 32;
    if (desired.lengthSq() > 1) desired.normalize(); desired.multiplyScalar(speed * (keys.has('fast') ? 1.8 : 1));
    this.velocity.lerp(desired, 1 - Math.exp(-delta * 3.5)); this.position.addScaledVector(this.velocity, delta);
    if (this.ocean.collisions) {
      target.shape.rotation.y = this.heading;
      const hull = actorHull(target);
      const safe = this.ocean.collisions.move(previous, this.position, { hull, previousHull: this.collisionHull || hull, ignore: target.root });
      if (safe.distanceTo(this.position) > 0.05) this.velocity.multiplyScalar(0.35);
      this.position.copy(safe);
      this.collisionHull = hull;
      this.ocean.collisions.remember(target, safe);
    }
    this.position.y = Math.max(seaHeight(this.position.x, this.position.z) + Math.min(this.radius * 0.25, 12) + 3, this.position.y);
    if (!this.firstPerson && Math.hypot(this.velocity.x, this.velocity.z) > 0.2) this.heading = dampAngle(this.heading, Math.atan2(-this.velocity.x, -this.velocity.z), 2, delta);
    const local = this.position.clone().sub(this.ocean.worldOffset); target.root.parent.updateWorldMatrix(true, false);
    target.root.position.copy(target.root.parent.worldToLocal(local.clone())); target.shape.rotation.y = this.heading;
    target.root.visible = !this.firstPerson;
    if (target.id) {
      const entry = this.ocean.creationScene.objects.get(target.id);
      if (!entry) { this.exit(); return; }
      entry.followPosition.copy(this.position); entry.velocity.copy(this.velocity);
    }
    target.animate?.(this.ocean.time, delta);
    if (this.firstPerson) {
      const direction = new THREE.Vector3(-Math.sin(this.heading) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.heading) * Math.cos(this.pitch));
      this.ocean.camera.position.copy(local).addScaledVector(direction, this.radius * 0.55); this.ocean.camera.position.y += this.radius * 0.08;
      this.ocean.controls.target.copy(this.ocean.camera.position).add(direction); this.ocean.camera.lookAt(this.ocean.controls.target);
    } else { this.ocean.camera.position.add(this.position.clone().sub(previous)); this.ocean.controls.target.copy(local); }
  }

  exit(restore = true) {
    const target = this.active; if (!target) return;
    target.root.visible = target.originalVisible;
    if (target.id) {
      const entry = this.ocean.creationScene.objects.get(target.id);
      if (entry) { entry.followPosition.copy(this.position); entry.followPosition.y -= entry.currentHeight; entry.item.position = entry.followPosition.toArray(); entry.item.following = false; entry.item.orbit = null; entry.item.leader = null; entry.roamStart = entry.clock; }
    }
    if (target.living && target.naturalPosition && !target.temporary) {
      const offset = this.position.clone().sub(target.naturalPosition);
      this.releases.push({ root: target.root, shape: target.shape, species: target.species, safePosition: this.position.clone(), basePosition: target.naturalLocalPosition, baseRotation: target.naturalRotation, offset, rotation: target.shape.quaternion.clone().multiply(target.naturalRotation.clone().invert()), elapsed: 0, duration: Math.max(6, Math.min(28, offset.length() / 14)) });
    }
    if (target.disposable) this.releases.push({ root: target.root, source: target.source, instance: target.instance, sourceMatrix: target.sourceMatrix, origin: this.position.clone(), elapsed: 0, duration: 8 });
    this.active = null; this.blend = null; this.drag = null; this.ocean.controls.enabled = true; this.ocean.controls.autoRotate = false; this.ocean.movement.clear(); this.clearOrbitMomentum();
    if (restore && this.savedView) this.ocean.travelTo(this.savedView.position, this.savedView.target);
  }

  beforeSimulation() {
    for (const target of [...this.releases, ...(this.active ? [this.active] : [])]) {
      if (target.source && target.sourceMatrix) { target.source.setMatrixAt(target.instance, target.sourceMatrix); target.source.instanceMatrix.needsUpdate = true; }
      const position = target.basePosition || target.naturalLocalPosition; const rotation = target.baseRotation || target.naturalRotation;
      if (position && rotation) { target.root.position.copy(position); target.shape.quaternion.copy(rotation); }
    }
  }

  faceToward(point) {
    if (!this.active?.living) return;
    const direction = new THREE.Vector3(...point).sub(this.position).setY(0).normalize();
    this.heading = Math.atan2(-direction.x, -direction.z); this.firstPerson = false; this.velocity.set(0, 0, 0); this.ocean.movement.clear(); this.active.root.visible = true; this.ocean.controls.enabled = false;
    const destination = this.position.clone().addScaledVector(direction, -this.radius * 1.85); destination.y += this.radius * 0.38 + 3;
    this.blend = { elapsed: 0, origin: this.ocean.camera.position.clone().add(this.ocean.worldOffset), look: this.ocean.controls.target.clone().add(this.ocean.worldOffset), destination, target: this.position.clone(), duration: this.ocean.reduced ? 0.4 : 2.4 };
  }

  inspect() { return this.active ? { name: this.active.name, living: this.active.living, species: this.active.species, firstPerson: this.firstPerson, heading: this.heading, pitch: this.pitch, transitioning: Boolean(this.blend), position: this.position.toArray() } : null; }
}
