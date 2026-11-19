import * as THREE from 'three';
import { StoneWorkshop } from './sculptures.js';

export const WHALE_REST = Object.freeze({ position: [0, 6.5, 0], rotation: [0.015, -0.4, -0.06], scale: 1.85 });

export function createWhaleRemains(materials) {
  const shop = new StoneWorkshop(materials, 987);
  for (let index = 0; index < 35; index++) {
    const depth = -9.5 + index * 0.73; const taper = 1 - Math.max(0, depth - 2) / 24;
    shop.add('rock', 'pale', [0, 1.15 * taper, depth], [0.5 * taper, 0.46 * taper, 0.34], [0, 0, 0]);
    if (index > 17) continue;
    const radius = 2.15 + Math.sin(index / 17 * Math.PI) * 0.75;
    for (const side of [-1, 1]) {
      shop.tube([[0, 1.1, depth], [side * radius * 0.65, 1.6, depth + 0.15], [side * radius, 0.4, depth + 0.3], [side * radius * 0.84, -1.8, depth + 0.3], [side * radius * 0.3, -2.5, depth + 0.12]], 0.14, 'pale', 18);
    }
  }
  for (const side of [-1, 1]) {
    shop.tube([[side * 0.45, 0.5, -9.8], [side * 1.9, -0.4, -11.5], [side * 1.2, -0.7, -14.2], [0, -0.5, -15.1]], 0.24, 'pale', 20);
    shop.tube([[side * 1.2, 0.6, -9.8], [side * 0.8, 0.9, -12.8], [0, 0.1, -14.5]], 0.23, 'pale', 18);
    shop.add('rock', 'pale', [side * 0.85, 0.6, -10.3], [1.05, 0.8, 1.1]);
    shop.tube([[side * 2.1, -0.8, -3], [side * 5.4, -1.7, -2.8], [side * 8.4, -2.15, -0.9]], 0.22, 'pale', 18);
    for (let digit = 0; digit < 4; digit++) shop.tube([[side * 7.7, -2.1, -1.5 + digit * 0.35], [side * 10, -2.45, 0.1 + digit * 0.3], [side * (11.2 - digit * 0.18), -2.5, 1.2 + digit * 0.22]], 0.075, 'pale', 12);
  }
  const root = shop.finish('whale-remains'); root.position.fromArray(WHALE_REST.position); root.rotation.set(...WHALE_REST.rotation); root.scale.setScalar(WHALE_REST.scale);
  return root;
}

export function installReveal(mesh, amount) {
  const originals = { material: mesh.material, depth: mesh.customDepthMaterial, shadow: mesh.castShadow };
  const fragment = 'float revealNoise=fract(sin(dot(floor(revealPoint*21.0),vec3(12.9898,78.233,39.425)))*43758.5453);if(revealNoise>=revealAmount)discard;';
  const attach = material => {
    const compile = material.onBeforeCompile; const cache = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer); shader.uniforms.revealAmount = amount;
      shader.vertexShader = 'varying vec3 revealPoint;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nrevealPoint=position;');
      shader.fragmentShader = 'varying vec3 revealPoint;uniform float revealAmount;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n' + fragment);
    };
    material.customProgramCacheKey = () => cache + '-coherent-reveal';
  };
  const material = originals.material.clone(); material.onBeforeCompile = originals.material.onBeforeCompile; material.customProgramCacheKey = originals.material.customProgramCacheKey; material.transparent = false; material.depthWrite = true; attach(material); mesh.material = material;
  const depth = originals.depth ? originals.depth.clone() : new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  if (originals.depth) { depth.onBeforeCompile = originals.depth.onBeforeCompile; depth.customProgramCacheKey = originals.depth.customProgramCacheKey; }
  attach(depth); mesh.customDepthMaterial = depth; mesh.castShadow = true;
  return () => { mesh.material = originals.material; mesh.customDepthMaterial = originals.depth; mesh.castShadow = originals.shadow; material.dispose(); depth.dispose(); };
}
