import * as THREE from 'three';
import anatomy from './assets/human-geometry.json' with { type: 'json' };

const prototypes = new Map();
export function sculptMermaidPoint(horizontal, vertical, depth) {
  const front = THREE.MathUtils.smoothstep(-depth, 0.10, 0.19);
  const jaw = Math.exp(-(((vertical + 0.18) / 0.12) ** 2));
  const nose = Math.exp(-((horizontal / 0.073) ** 4) - ((vertical + 0.073) / 0.085) ** 4) * front;
  const brow = Math.exp(-(((Math.abs(horizontal) - 0.105) / 0.082) ** 4) - ((vertical - 0.092) / 0.043) ** 2) * front;
  const eye = Math.exp(-(((Math.abs(horizontal) - 0.104) / 0.068) ** 6) - ((vertical - 0.043) / 0.052) ** 6) * front;
  const mouth = Math.exp(-((horizontal / 0.13) ** 4) - ((vertical + 0.19) / 0.045) ** 4) * front;
  const cheek = Math.exp(-(((Math.abs(horizontal) - 0.17) / 0.07) ** 2) - ((vertical + 0.025) / 0.07) ** 2) * front;
  return [
    horizontal * (0.94 - jaw * 0.10 - nose * 0.23 - mouth * 0.025) + Math.sign(horizontal) * eye * 0.009,
    vertical + eye * ((vertical - 0.043) * 0.27 + (Math.abs(horizontal) - 0.104) * 0.10) + mouth * 0.008,
    depth + brow * 0.023 + nose * 0.018 + mouth * 0.008 - cheek * 0.006,
  ];
}

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
    if (name !== 'hand') {
      const vertices = geometry.attributes.position;
      for (let index = 0; index < vertices.count; index++) vertices.setXYZ(index, ...sculptMermaidPoint(vertices.getX(index), vertices.getY(index), vertices.getZ(index)));
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
  const complexion = new THREE.Color('#fff5ef'); const rose = new THREE.Color('#d88f91');
  for (let index = 0; index < position.count; index++) {
    const horizontal = position.getX(index); const vertical = position.getY(index); const depth = position.getZ(index);
    const lip = Math.exp(-Math.pow(horizontal / 0.12, 4) - Math.pow((vertical + 0.185) / 0.027, 4)) * THREE.MathUtils.smoothstep(-depth, 0.2, 0.245);
    const blush = Math.exp(-Math.pow((Math.abs(horizontal) - 0.16) / 0.08, 2) - Math.pow((vertical + 0.005) / 0.09, 2)) * THREE.MathUtils.smoothstep(-depth, 0.13, 0.22) * 0.13;
    colors.push(...complexion.clone().lerp(rose, Math.max(lip * 0.5, blush)).toArray());
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = skin.clone(); material.vertexColors = true; material.color.set('#f7dfd3'); material.roughness = 0.5; material.clearcoat = 0.025;
  const face = new THREE.Mesh(geometry, material); face.name = '人鱼面部 · Blender 拓扑'; head.add(face);
  const eyes = [];
  const scleraMaterial = new THREE.MeshPhysicalMaterial({ color: '#e9e5da', roughness: 0.27, clearcoat: 0.35 }); scleraMaterial.userData.keepColor = true;
  for (const side of ['L', 'R']) {
    const sclera = new THREE.Mesh(humanGeometry(`sclera${side}`), scleraMaterial); sclera.name = '人鱼眼白'; head.add(sclera);
    const irisGeometry = humanGeometry(`iris${side}`); irisGeometry.translate(0, 0, -0.009); const irisMesh = new THREE.Mesh(irisGeometry, iris); head.add(irisMesh);
    irisGeometry.computeBoundingBox(); const center = irisGeometry.boundingBox.getCenter(new THREE.Vector3());
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), dark); pupil.position.copy(center); pupil.position.z -= 0.008; pupil.scale.set(0.01, 0.012, 0.002); head.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), pearl); glint.position.copy(center).add(new THREE.Vector3(-0.003, 0.008, -0.006)); glint.scale.setScalar(0.003); head.add(glint);
    eyes.push({ sclera, irisMesh, pupil });
  }
  const browMaterial = new THREE.MeshStandardMaterial({ color: '#392b31', roughness: 0.92 }); browMaterial.userData.keepColor = true;
  face.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  for (const side of [-1, 1]) {
    const strokes = [];
    for (let index = 0; index <= 14; index++) {
      const progress = index / 14;
      const horizontal = side * (0.045 + progress * 0.13);
      const vertical = 0.107 + Math.sin(progress * Math.PI * 0.9) * 0.018 - progress * 0.008;
      ray.set(new THREE.Vector3(horizontal, vertical, -1), new THREE.Vector3(0, 0, 1));
      const hit = ray.intersectObject(new THREE.Mesh(geometry, skin), false)[0];
      strokes.push(new THREE.Vector3(horizontal, vertical, (hit?.point.z ?? -0.21) - 0.0018));
    }
    const browGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strokes), 28, 0.0035, 5, false);
    const eyebrow = new THREE.Mesh(browGeometry, browMaterial); eyebrow.name = '人鱼细眉'; head.add(eyebrow);
  }
  return { face, eyes };
}

export function scalpGeometry() {
  const geometry = humanGeometry('head'); const vertices = geometry.attributes.position; const normals = geometry.attributes.normal; const indices = geometry.index.array; const positions = []; const directions = [];
  const boundary = point => Math.min(point.y + 0.055, Math.max(point.z + 0.015, point.y - 0.255 + Math.abs(point.x) * 0.45));
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
