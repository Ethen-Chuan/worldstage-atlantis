import * as THREE from 'three';
import anatomy from './assets/human-geometry.json' with { type: 'json' };

const prototypes = new Map();
export function humanGeometry(name, mirrored = false) {
  if (!prototypes.has(name)) {
    const data = anatomy[name]; const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3)); geometry.setIndex(data.index);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(data.position.length / 3 * 2), 2));
    if (name !== 'hand') geometry.scale(1.38, 0.87, 1);
    if (name === 'head') {
      const vertices = geometry.attributes.position;
      for (let index = 0; index < vertices.count; index++) {
        const horizontal = vertices.getX(index); const vertical = vertices.getY(index); const depth = vertices.getZ(index);
        const blend = THREE.MathUtils.smoothstep(-vertical, 0.25, 0.34); const angle = Math.atan2(horizontal, depth - 0.025);
        vertices.setXYZ(index, THREE.MathUtils.lerp(horizontal, Math.sin(angle) * 0.145, blend), vertical, THREE.MathUtils.lerp(depth, 0.025 + Math.cos(angle) * 0.098, blend));
      }
    }
    geometry.computeVertexNormals(); prototypes.set(name, geometry);
  }
  const geometry = prototypes.get(name).clone();
  if (mirrored) {
    geometry.scale(-1, 1, 1); const indices = geometry.index.array;
    for (let index = 0; index < indices.length; index += 3) { const first = indices[index]; indices[index] = indices[index + 2]; indices[index + 2] = first; }
  }
  return geometry;
}

export function detailedFace(head, skin, pearl, iris, dark) {
  const geometry = humanGeometry('head'); const position = geometry.attributes.position; const colors = [];
  const complexion = new THREE.Color('#f4e4db'); const rose = new THREE.Color('#c58189'); const brow = new THREE.Color('#776374');
  for (let index = 0; index < position.count; index++) {
    const horizontal = position.getX(index); const vertical = position.getY(index); const depth = position.getZ(index);
    const lip = Math.exp(-Math.pow(horizontal / 0.12, 4) - Math.pow((vertical + 0.185) / 0.027, 4)) * THREE.MathUtils.smoothstep(-depth, 0.2, 0.245);
    const blush = Math.exp(-Math.pow((Math.abs(horizontal) - 0.16) / 0.08, 2) - Math.pow((vertical + 0.005) / 0.09, 2)) * THREE.MathUtils.smoothstep(-depth, 0.13, 0.22) * 0.13;
    const eyebrow = Math.exp(-Math.pow((Math.abs(horizontal) - 0.13) / 0.071, 6) - Math.pow((vertical - 0.11 + Math.abs(horizontal) * 0.05) / 0.009, 4)) * THREE.MathUtils.smoothstep(-depth, 0.18, 0.22);
    colors.push(...complexion.clone().lerp(rose, Math.max(lip * 0.65, blush)).lerp(brow, eyebrow * 0.7).toArray());
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = skin.clone(); material.vertexColors = true; material.color.set('#f5e0d4'); material.roughness = 0.64; material.clearcoat = 0.03;
  const face = new THREE.Mesh(geometry, material); face.name = '人鱼面部 · Blender 拓扑'; head.add(face);
  const eyes = [];
  for (const side of ['L', 'R']) {
    const sclera = new THREE.Mesh(humanGeometry(`sclera${side}`), pearl); sclera.name = '真实眼球'; head.add(sclera);
    const irisGeometry = humanGeometry(`iris${side}`); irisGeometry.translate(0, 0, -0.009); const irisMesh = new THREE.Mesh(irisGeometry, iris); head.add(irisMesh);
    irisGeometry.computeBoundingBox(); const center = irisGeometry.boundingBox.getCenter(new THREE.Vector3());
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), dark); pupil.position.copy(center); pupil.position.z -= 0.008; pupil.scale.set(0.009, 0.011, 0.003); head.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), pearl); glint.position.copy(center).add(new THREE.Vector3(-0.003, 0.008, -0.006)); glint.scale.setScalar(0.003); head.add(glint);
    eyes.push({ sclera, irisMesh, pupil });
  }
  return { face, eyes };
}

export function scalpGeometry() {
  const geometry = humanGeometry('head'); const vertices = geometry.attributes.position; const normals = geometry.attributes.normal; const indices = geometry.index.array; const positions = []; const directions = [];
  const boundary = point => Math.min(point.y + 0.05, Math.max(point.z + 0.015, point.y - 0.22 + Math.abs(point.x) * 0.15));
  for (let index = 0; index < indices.length; index += 3) {
    const triangle = [indices[index], indices[index + 1], indices[index + 2]].map(vertex => ({ position: new THREE.Vector3().fromBufferAttribute(vertices, vertex), normal: new THREE.Vector3().fromBufferAttribute(normals, vertex) }));
    const clipped = [];
    for (let corner = 0; corner < 3; corner++) {
      const current = triangle[corner]; const next = triangle[(corner + 1) % 3]; const start = boundary(current.position); const end = boundary(next.position);
      if (start >= 0) clipped.push(current);
      if ((start >= 0) !== (end >= 0)) {
        const progress = start / (start - end);
        clipped.push({ position: current.position.clone().lerp(next.position, progress), normal: current.normal.clone().lerp(next.normal, progress).normalize() });
      }
    }
    for (let corner = 1; corner + 1 < clipped.length; corner++) for (const vertex of [clipped[0], clipped[corner], clipped[corner + 1]]) {
      positions.push(...vertex.position.toArray()); directions.push(...vertex.normal.toArray());
    }
  }
  geometry.dispose(); const scalp = new THREE.BufferGeometry(); scalp.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); scalp.setAttribute('normal', new THREE.Float32BufferAttribute(directions, 3)); scalp.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  scalp.scale(1.025, 1.015, 1.025); return scalp;
}
