import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './core.js';
import { organicSurface } from './creature-surface.js';
import { smoothBody, attachSwimming } from './swim.js';

function mesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.scale.set(...scale);
  return object;
}

function organicFin(points, material, thickness = 0.08) {
  const outline = new THREE.Shape();
  outline.moveTo(...points[0]);
  for (let index = 1; index < points.length; index += 3) outline.bezierCurveTo(...points[index], ...points[index + 1], ...points[index + 2]);
  const geometry = new THREE.ExtrudeGeometry(outline, { steps: 1, depth: thickness, bevelEnabled: true, bevelThickness: thickness, bevelSize: thickness * 1.5, bevelSegments: 2, curveSegments: 12 });
  geometry.rotateX(-Math.PI / 2);
  return mesh(geometry, material);
}

function mergeStaticParts(group, excluded = []) {
  const byMaterial = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh || excluded.includes(child) || Array.isArray(child.material)) continue;
    child.updateMatrix();
    const transformed = child.geometry.clone().applyMatrix4(child.matrix);
    const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
    if (geometry !== transformed) transformed.dispose();
    if (!byMaterial.has(child.material)) byMaterial.set(child.material, []);
    byMaterial.get(child.material).push(geometry);
    group.remove(child);
    child.geometry.dispose();
  }
  for (const [material, geometries] of byMaterial) {
    const geometry = mergeGeometries(geometries);
    group.add(mesh(geometry, material));
    geometries.forEach(part => part.dispose());
  }
}

export function createManta() {
  const root = new THREE.Group();
  const top = new THREE.MeshStandardMaterial({ color: '#294e60', roughness: 0.54, metalness: 0.28, side: THREE.DoubleSide });
  const belly = new THREE.MeshStandardMaterial({ color: '#bbc5b2', roughness: 0.78, side: THREE.DoubleSide });
  const edge = new THREE.MeshStandardMaterial({ color: '#738d8b', roughness: 0.48, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: '#10272d', roughness: 0.2 });
  const eye = new THREE.MeshStandardMaterial({ color: '#d4bc75', emissive: '#b2c195', emissiveIntensity: 0.25, roughness: 0.2 });
  root.add(mesh(new THREE.SphereGeometry(1, 32, 24), top, [0, 0, 0], [1.42, 0.55, 2.6]));
  root.add(mesh(new THREE.SphereGeometry(1, 24, 16), belly, [0, -0.25, -0.1], [1.25, 0.32, 2.27]));
  const wingGeometry = new THREE.PlaneGeometry(2, 1, 48, 12);
  const wingPosition = wingGeometry.attributes.position;
  const base = [];
  for (let index = 0; index < wingPosition.count; index++) {
    const span = wingPosition.getX(index);
    const chord = wingPosition.getY(index) + 0.5;
    const outer = Math.abs(span);
    const horizontal = span * 7.7;
    const front = -2.3 + outer * 3.3;
    const back = 2.6 - outer * 1.65;
    const depth = front + chord * (back - front);
    const elevation = Math.sin(outer * Math.PI) * 0.1;
    wingPosition.setXYZ(index, horizontal, elevation, depth);
    base.push(horizontal, elevation, depth);
  }
  wingGeometry.computeVertexNormals();
  const upperWing = mesh(wingGeometry, top);
  const lowerWing = mesh(wingGeometry.clone(), belly, [0, -0.065, 0]);
  root.add(upperWing, lowerWing);
  for (let side = -1; side <= 1; side += 2) {
    const hornCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * 0.85, 0.1, -1.9), new THREE.Vector3(side * 1.15, 0.05, -2.7), new THREE.Vector3(side * 0.9, -0.1, -3.25)]);
    root.add(mesh(new THREE.TubeGeometry(hornCurve, 16, 0.23, 8, false), edge));
    root.add(mesh(new THREE.SphereGeometry(0.15, 12, 8), eye, [side * 1.3, 0.19, -1.65]));
    root.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), dark, [side * 1.39, 0.2, -1.69]));
    for (let index = 0; index < 5; index++) {
      const gill = mesh(new THREE.TorusGeometry(0.45, 0.018, 4, 12, Math.PI * 0.6), dark, [side * 0.4, -0.53, -1 + index * 0.32]);
      gill.rotation.x = Math.PI / 2;
      root.add(gill);
    }
  }
  const tailPath = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 1.7), new THREE.Vector3(0, -0.05, 4), new THREE.Vector3(0.4, -0.3, 6.5), new THREE.Vector3(0.8, -0.2, 9)]);
  const tail = mesh(new THREE.TubeGeometry(tailPath, 32, 0.055, 6, false), top);
  root.add(tail);
  const markings = new THREE.Group();
  const random = seededRandom(17);
  for (let index = 0; index < 55; index++) {
    const horizontal = (random() - 0.5) * 2.3;
    const depth = (random() - 0.5) * 3.8;
    const elevation = Math.sqrt(Math.max(0.1, 1 - horizontal * horizontal / 2.1 - depth * depth / 7)) * 0.57;
    markings.add(mesh(new THREE.SphereGeometry(0.035 + random() * 0.065, 6, 4), edge, [horizontal, elevation, depth], [1, 0.2, 1.5]));
  }
  root.add(markings);
  mergeStaticParts(markings);
  mergeStaticParts(root, [upperWing, lowerWing, tail]);
  root.userData = { creature: 'manta', mode: 'idle', basePosition: new THREE.Vector3(0, 29, 102), moveTarget: new THREE.Vector3(0, 29, 102) };
  root.position.copy(root.userData.basePosition);
  return {
    root,
    animate(time) {
      for (const geometry of [upperWing.geometry, lowerWing.geometry]) {
        const positions = geometry.attributes.position;
        for (let index = 0; index < positions.count; index++) {
          const horizontal = base[index * 3];
          const span = Math.abs(horizontal) / 7.7;
          const bend = Math.sin(time * 1.55 - span * 2.6) * span * span * 1.7;
          positions.setY(index, base[index * 3 + 1] + bend);
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
      }
      tail.rotation.y = Math.sin(time * 1.4) * 0.09;
    },
  };
}

export function createWhale() {
  const root = new THREE.Group();
  const material = organicSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.09 }), 'whale', { relief: 0.085 });
  const finMaterial = organicSurface(new THREE.MeshStandardMaterial({ color: '#64858d', roughness: 0.5, metalness: 0.08, side: THREE.DoubleSide }), 'whale', { relief: 0.035, length: 16 });
  const throatMaterial = new THREE.MeshStandardMaterial({ color: '#79958f', roughness: 0.75 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#152b30', roughness: 0.1 });
  eyeMaterial.userData.keepColor = true;
  const colors = [];
  const upperColor = new THREE.Color('#365862');
  const lowerColor = new THREE.Color('#c4c8ae');
  const body = smoothBody([[-15, 0.06], [-14.15, 1.65], [-12, 2.95], [-8, 3.7], [-3, 3.8], [2, 3.2], [7, 2.18], [11, 1.35], [15, 0.66], [18, 0.14]], 104, 48, 0.85);
  for (let index = 0; index < body.attributes.position.count; index++) {
    const vertical = body.attributes.position.getY(index);
    const shade = upperColor.clone().lerp(lowerColor, THREE.MathUtils.smoothstep(-vertical, -0.1, 2.7));
    colors.push(shade.r, shade.g, shade.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  root.add(mesh(body, material));
  const tubercleMaterial = new THREE.MeshStandardMaterial({ color: '#718e89', roughness: 0.8 });
  for (let index = 0; index < 17; index++) {
    const depth = -13.2 + index % 6 * 1.05;
    const angle = (index % 3 - 1) * 0.72;
    root.add(mesh(new THREE.SphereGeometry(0.13 + index % 3 * 0.035, 8, 6), tubercleMaterial, [Math.sin(angle) * 2.9, Math.cos(angle) * 2.8, depth], [1, 0.5, 1.35]));
  }
  const fins = [];
  for (let side = -1; side <= 1; side += 2) {
    const flipper = organicFin([[0, 0], [3, 2], [9, -2], [10, -6], [7, -7], [2, -3], [0, -1]], finMaterial, 0.14);
    flipper.position.set(side * 3, -1, -3);
    flipper.scale.x = side;
    flipper.rotation.z = side * -0.6;
    root.add(flipper);
    fins.push(flipper);
    root.add(mesh(new THREE.SphereGeometry(0.24, 20, 14), eyeMaterial, [side * 3.47, 0.33, -10.0]));
    root.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), throatMaterial, [side * 3.67, 0.39, -10.06]));
    const lipPoints = [new THREE.Vector3(side * 0.55, -0.3, -14.6), new THREE.Vector3(side * 2.78, -0.85, -12), new THREE.Vector3(side * 3.57, -1.0, -8.5)];
    root.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPoints), 24, 0.055, 6, false), eyeMaterial));
  }
  for (let index = -4; index <= 4; index++) {
    const horizontal = index * 0.42;
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(horizontal * 0.5, -1.9, -12), new THREE.Vector3(horizontal, -3.2 + Math.abs(index) * 0.08, -6), new THREE.Vector3(horizontal * 0.7, -2.9, 0)]);
    root.add(mesh(new THREE.TubeGeometry(path, 24, 0.035, 4, false), throatMaterial));
  }
  const fluke = organicFin([[0, 0], [2, 0.7], [6.5, -1], [7, -3], [4, -2], [2, -2], [0, -1], [-2, -2], [-4, -2], [-7, -3], [-6.5, -1], [-2, 0.7], [0, 0]], finMaterial, 0.12);
  fluke.position.z = 17;
  root.add(fluke);
  const dorsal = organicFin([[0, 0], [0.7, 1.5], [2.8, 3.1], [3.5, 1.8], [2.5, 1], [1, 0.2], [0, 0]], finMaterial, 0.09);
  dorsal.rotation.z = Math.PI / 2;
  dorsal.rotation.y = -Math.PI / 2;
  dorsal.position.set(0, 2.3, 5.5);
  root.add(dorsal);
  root.scale.setScalar(1.35);
  const swim = attachSwimming(root, { axis: 'y', start: -2, end: 18, amplitude: 1.12, frequency: 0.78, wavelength: 0.095 });
  root.userData = { creature: 'whale', mode: 'idle', basePosition: new THREE.Vector3(3, 85, -4), moveTarget: new THREE.Vector3(3, 85, -4) };
  root.position.copy(root.userData.basePosition);
  root.rotation.y = -1.15;
  return {
    root,
    animate(time) {
      swim.update(time); const joint = swim.sample(17, time);
      fluke.rotation.x = -Math.atan(joint.slope); fluke.position.y = joint.offset;
      dorsal.position.y = 2.3 + swim.sample(5.5, time).offset;
      fins.forEach((fin, index) => { fin.rotation.z = (index ? 1 : -1) * (-0.5 + Math.sin(time * 0.78 - 0.4 + index * 0.12) * 0.095); fin.rotation.y = Math.sin(time * 0.78 - 0.9) * 0.04; });
    },
  };
}

export function createJellies() {
  const root = new THREE.Group();
  const random = seededRandom(81);
  const bellMaterial = new THREE.MeshPhysicalMaterial({ color: '#b4b4d1', emissive: '#a192ca', emissiveIntensity: 0.55, transparent: true, opacity: 0.5, roughness: 0.25, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false });
  bellMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 bellPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nbellPosition = position;');
    shader.fragmentShader = 'varying vec3 bellPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float bellAngle = atan(bellPosition.x, bellPosition.z);
      float vein = pow(0.5 + 0.5 * sin(bellAngle * 16.0), 14.0);
      float edge = pow(1.0 - abs(normalize(bellPosition).y), 4.0);
      diffuseColor.a *= 0.3 + vein * 0.5 + edge * 0.5;
    `);
  };
  const rimMaterial = new THREE.MeshBasicMaterial({ color: '#c9c6db', transparent: true, opacity: 0.7 });
  const threadMaterial = new THREE.MeshBasicMaterial({ color: '#b5b6ce', transparent: true, opacity: 0.3, depthWrite: false });
  const jellies = [];
  for (let index = 0; index < 16; index++) {
    const jelly = new THREE.Group();
    const size = 0.6 + random() * 1.1;
    jelly.add(mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.23), bellMaterial, [0, 0, 0], [1, 0.7, 1]));
    const rim = mesh(new THREE.TorusGeometry(0.975, 0.025, 6, 40), rimMaterial, [0, -0.13, 0]);
    rim.rotation.x = Math.PI / 2;
    jelly.add(rim);
    for (let tentacle = 0; tentacle < 8; tentacle++) {
      const angle = tentacle / 8 * Math.PI * 2;
      const length = 2.2 + random() * 2.6;
      const points = [];
      for (let step = 0; step <= 14; step++) {
        const progress = step / 14;
        points.push(new THREE.Vector3(Math.cos(angle) * 0.8 + Math.sin(progress * 7 + angle) * progress * 0.5, -progress * length - 0.15, Math.sin(angle) * 0.8 + Math.cos(progress * 6 + angle) * progress * 0.45));
      }
      jelly.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, tentacle % 2 ? 0.012 : 0.027, 4, false), tentacle % 2 ? threadMaterial : rimMaterial));
    }
    for (let petal = 0; petal < 4; petal++) {
      const angle = petal / 4 * Math.PI * 2;
      const inner = mesh(new THREE.TorusGeometry(0.21, 0.04, 6, 16), rimMaterial, [Math.cos(angle) * 0.23, 0.2, Math.sin(angle) * 0.23]);
      inner.rotation.x = Math.PI / 2;
      jelly.add(inner);
    }
    jelly.scale.setScalar(size);
    jelly.position.set((random() - 0.5) * 15, (random() - 0.5) * 9, (random() - 0.5) * 13);
    jelly.userData.base = jelly.position.clone();
    jelly.userData.size = size;
    mergeStaticParts(jelly);
    root.add(jelly);
    jellies.push(jelly);
  }
  root.userData = { creature: 'jelly', mode: 'idle', basePosition: new THREE.Vector3(-45, 4, 95), moveTarget: new THREE.Vector3(-45, 4, 95) };
  root.position.copy(root.userData.basePosition);
  let glow = 0;
  let targetGlow = 0;
  const baseColor = new THREE.Color('#c9e5df');
  return {
    root,
    setGlow(value) { targetGlow = value ? 1 : 0; },
    setColor(value) {
      baseColor.set({ pearl: '#c9e5df', rose: '#ec9eaf', blue: '#7bbfe9', gold: '#eac785', teal: '#68a897' }[value] || '#c9e5df');
      bellMaterial.color.copy(baseColor);
      bellMaterial.emissive.copy(baseColor);
      threadMaterial.color.copy(baseColor);
    },
    animate(time, delta) {
      glow = THREE.MathUtils.damp(glow, targetGlow, 1.1, delta);
      bellMaterial.emissiveIntensity = 0.32 + glow * 1.4;
      bellMaterial.opacity = 0.29 + glow * 0.12;
      rimMaterial.color.copy(baseColor).multiplyScalar(0.8 + glow * 0.45);
      jellies.forEach((jelly, index) => {
        jelly.position.y = jelly.userData.base.y + Math.sin(time * 0.5 + index * 1.2) * 1.1;
        jelly.position.x = jelly.userData.base.x + Math.sin(time * 0.22 + index) * 0.8;
        jelly.scale.y = jelly.userData.size * (1 + Math.sin(time * 2.1 + index) * 0.085);
        jelly.rotation.y = time * 0.055 + index;
      });
    },
  };
}

export function createSchools(scene) {
  const body = new THREE.SphereGeometry(1, 8, 5);
  body.scale(0.2, 0.36, 0.85);
  const tail = new THREE.ConeGeometry(0.5, 0.6, 3);
  tail.rotateX(Math.PI / 2);
  tail.scale(0.12, 1, 1);
  tail.translate(0, 0, 0.87);
  const geometry = mergeGeometries([body, tail]);
  const material = new THREE.MeshStandardMaterial({ color: '#b7c0a1', metalness: 0.55, roughness: 0.43 });
  const count = 560;
  const school = new THREE.InstancedMesh(geometry, material, count);
  school.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  school.frustumCulled = false;
  const transform = new THREE.Object3D();
  const random = seededRandom(399);
  const fish = Array.from({ length: count }, (_, index) => ({ phase: random() * Math.PI * 2, radius: 5 + random() * 9, height: (random() - 0.5) * 7, group: index % 4, size: 0.3 + random() * 0.55 }));
  scene.add(school);
  return time => {
    fish.forEach((item, index) => {
      const angle = item.phase + time * (0.07 + item.group * 0.014);
      const centers = [[-36, 37, 42], [48, 32, -68], [-20, 65, -115], [20, 18, 118]];
      const center = centers[item.group];
      transform.position.set(center[0] + Math.cos(angle) * item.radius * 1.8, center[1] + item.height + Math.sin(time * 0.5 + item.phase) * 0.45, center[2] + Math.sin(angle) * item.radius);
      transform.rotation.set(0, -angle, Math.sin(time * 5 + item.phase) * 0.07);
      transform.scale.setScalar(item.size);
      transform.updateMatrix();
      school.setMatrixAt(index, transform.matrix);
    });
    school.instanceMatrix.needsUpdate = true;
  };
}
