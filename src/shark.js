import * as THREE from 'three';
import { smoothBody, attachSwimming } from './swim.js';
import { consolidate } from './mythic-creatures.js';

function finGeometry(outline, thickness = 0.045) {
  const shape = new THREE.Shape(); shape.moveTo(...outline[0]);
  for (let index = 1; index < outline.length; index += 3) shape.bezierCurveTo(...outline[index], ...outline[index + 1], ...outline[index + 2]);
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, steps: 1, bevelEnabled: true, bevelSize: thickness, bevelThickness: thickness, bevelSegments: 2, curveSegments: 18 });
}

export function createShark({ hammerhead = false } = {}) {
  const root = new THREE.Group(); root.name = 'grey-reef-shark'; root.userData.creature = 'shark';
  if (hammerhead) { root.name = 'scalloped-hammerhead'; root.userData.speciesVariant = 'hammerhead'; root.userData.displayName = '锤头鲨'; }
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0 });
  const finMaterial = new THREE.MeshStandardMaterial({ color: '#647c7c', roughness: 0.6, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a2729', roughness: 0.5 }); dark.userData.keepColor = true;
  const eye = new THREE.MeshPhysicalMaterial({ color: '#142323', roughness: 0.14, clearcoat: 0.5 }); eye.userData.keepColor = true;
  const body = smoothBody([[-5.8, 0.05], [-5.15, 0.45], [-4.1, 0.86], [-2.6, 1.05], [0, 0.98], [2.4, 0.69], [4.4, 0.28], [5.6, 0.12]], 80, 40, 0.86);
  const colors = []; const dorsal = new THREE.Color('#536968'); const ventral = new THREE.Color('#cecbb8');
  for (let index = 0; index < body.attributes.position.count; index++) {
    const height = body.attributes.position.getY(index); const depth = body.attributes.position.getZ(index);
    if (hammerhead && depth < -4.5) body.attributes.position.setZ(index, -4.5 + (depth + 4.5) * 0.62);
    const color = dorsal.clone().lerp(ventral, 1 - THREE.MathUtils.smoothstep(height + Math.sin(depth * 1.9) * 0.035, -0.45, 0.02)); colors.push(...color.toArray());
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); root.add(new THREE.Mesh(body, skin));
  if (hammerhead) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 20), finMaterial);
    head.position.set(0, -0.03, -4.9); head.scale.set(2.65, 0.33, 0.72); root.add(head);
  }
  const dorsalFin = new THREE.Mesh(finGeometry([[0, 0], [0.1, 0.8], [0.7, 2.6], [1, 2.7], [0.95, 1.3], [1.1, 0.4], [2.5, 0], [1.5, -0.2], [0.5, -0.1], [0, 0]]), finMaterial);
  dorsalFin.rotation.y = -Math.PI / 2; dorsalFin.position.set(0, 0.76, -0.4); root.add(dorsalFin);
  dorsalFin.scale.y = hammerhead ? 0.9 : 0.7;
  const rearDorsal = dorsalFin.clone(); rearDorsal.geometry = dorsalFin.geometry.clone(); rearDorsal.scale.setScalar(0.36); rearDorsal.position.set(0, 0.33, 3.4); root.add(rearDorsal);
  const fins = [];
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(finGeometry([[0, 0], [0.5, 0.2], [2.4, -1.2], [3.1, -2.9], [1.5, -2.5], [0.4, -1.7], [0, -0.65], [0, -0.4], [0, -0.2], [0, 0]]), finMaterial);
    fin.rotation.x = -Math.PI / 2; fin.rotation.z = side * -0.15; fin.scale.x = side; fin.position.set(side * 0.7, -0.48, -1.65); root.add(fin); fins.push(fin);
    const pelvic = fin.clone(); pelvic.geometry = fin.geometry.clone(); pelvic.scale.multiplyScalar(0.36); pelvic.position.set(side * 0.48, -0.4, 2.35); root.add(pelvic);
    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), eye); eyeball.position.set(side * (hammerhead ? 2.57 : 0.81), hammerhead ? 0.035 : 0.16, hammerhead ? -4.98 : -4.38); root.add(eyeball);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dark); nostril.position.set(side * (hammerhead ? 1.9 : 0.24), -0.26, hammerhead ? -5.36 : -5.17); nostril.scale.set(0.08, 0.018, 0.035); root.add(nostril);
    for (let index = 0; index < 5; index++) {
      const depth = -2.95 + index * 0.22;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * 0.72, 0.47, depth), new THREE.Vector3(side * 1.025, 0.02, depth + 0.06), new THREE.Vector3(side * 0.82, -0.43, depth + 0.16)]);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.018, 4, false), dark));
    }
  }
  const mouth = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.49, -0.44, -4.6), new THREE.Vector3(0, -0.54, -4.35), new THREE.Vector3(0.49, -0.44, -4.6)]);
  root.add(new THREE.Mesh(new THREE.TubeGeometry(mouth, 20, 0.022, 5, false), dark));
  const tail = new THREE.Mesh(finGeometry([[0, 0], [0.2, 1.5], [1.65, 3.45], [2.5, 3.8], [1.85, 2.1], [1.4, 0.65], [0.85, 0.1], [1.05, -0.6], [1.65, -1.55], [1.6, -1.9], [0.55, -1.4], [0.12, -0.45], [0, 0]]), finMaterial);
  tail.rotation.y = -Math.PI / 2; tail.position.z = 5.2; root.add(tail);
  consolidate(root, [tail, ...fins]);
  const swim = attachSwimming(root, { axis: 'x', start: -2, end: 7, amplitude: 0.48, frequency: 1.8, wavelength: 0.36 });
  return { root, animate(time) { swim.update(time); const joint = swim.sample(5.2, time); tail.position.x = joint.offset; tail.rotation.y = -Math.PI / 2 + Math.atan(joint.slope); fins.forEach((fin, index) => { fin.rotation.z = (index ? 1 : -1) * (-0.15 + Math.sin(time * 0.9) * 0.025); }); } };
}
