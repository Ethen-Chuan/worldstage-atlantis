import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './core.js';

export const JELLY_VARIANTS = Object.freeze([
  { id: 'moon', name: '珍珠海月', bell: [1, 0.36, 1], color: '#bed0d0', light: '#b6d3da', glow: 0.012 },
  { id: 'crystal', name: '碧缘晶水母', bell: [0.94, 0.46, 0.94], color: '#bbd4c9', light: '#9ecabb', glow: 0.045 },
  { id: 'spotted', name: '琥珀斑点水母', bell: [0.8, 0.65, 0.8], color: '#ccb99a', light: '#dbcbb0', glow: 0.008 },
  { id: 'comb', name: '虹带栉水母', bell: [0.57, 0.68, 0.52], color: '#c1cfd5', light: '#b6c2da', glow: 0.018 },
]);

const shapes = new Map();
const palette = { pearl: null, rose: '#e3a3cf', blue: '#7ebde8', gold: '#e7cb91', teal: '#7acabb' };
const vertexShader = `uniform float clock;uniform float reduced;uniform float frequency;
  varying vec3 jellyPoint;varying float jellyPhase;
  ${THREE.ShaderLib.phong.vertexShader}`
  .replace('#include <beginnormal_vertex>', `
    jellyPoint=position;jellyPhase=length(modelMatrix[0].xyz)*2.17;
    float motion=1.0-reduced*0.75;
    float cycle=clock*frequency+jellyPhase;
    float pulse=(sin(cycle)+0.18*sin(cycle*2.0))*motion;
    float radial=1.0-pulse*0.035;float vertical=1.0+pulse*0.055;
    float trailing=max(0.0,-position.y);
    float bendPhase=clock*0.56-trailing*1.6+jellyPhase;
    float swayPhase=clock*0.43-trailing*1.3+jellyPhase;
    float bendDerivative=position.y<0.0?-0.038*motion*(sin(bendPhase)-trailing*1.6*cos(bendPhase)):0.0;
    float swayDerivative=position.y<0.0?-0.025*motion*(cos(swayPhase)+trailing*1.3*sin(swayPhase)):0.0;
    vec3 objectNormal=normalize(vec3(normal.x/radial,
      (normal.y-bendDerivative*normal.x/radial-swayDerivative*normal.z/radial)/vertical,normal.z/radial));
  `)
  .replace('#include <begin_vertex>', `
    vec3 transformed=position*vec3(radial,vertical,radial);
    transformed.x+=sin(bendPhase)*trailing*0.038*motion;
    transformed.z+=cos(swayPhase)*trailing*0.025*motion;
  `);
const fragmentShader = `uniform float clock;uniform float reduced;uniform float part;uniform float kind;uniform float glow;uniform float response;
  uniform vec3 lightTint;varying vec3 jellyPoint;varying float jellyPhase;
  ${THREE.ShaderLib.phong.fragmentShader}`
  .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    float edge=pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.4);
    float rim=exp(-pow((jellyPoint.y+0.035)*15.0,2.0));
    float rhythm=0.5+0.5*sin(clock*(1.0-reduced*0.75)*0.8+jellyPhase);
    float energy=glow+response*0.12*(0.75+rhythm*0.25);
    float tissue=0.5+0.5*sin(jellyPoint.x*6.0+sin(jellyPoint.z*7.0))*sin(jellyPoint.y*8.0);
    diffuseColor.rgb*=0.94+tissue*0.06;
    diffuseColor.a=0.32+edge*0.24+rim*0.04;
    if(part>0.5){diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.7,0.72,0.65),0.16);diffuseColor.a=0.5+edge*0.08;}
    if(part>1.5){diffuseColor.a=0.38+edge*0.08;}
    if(kind>1.5&&kind<2.5){
      if(part<0.5){
        vec2 cell=floor(jellyPoint.xz*6.5);
        vec2 seed=fract(sin(vec2(dot(cell,vec2(127.1,311.7)),dot(cell,vec2(269.5,183.3))))*43758.5453);
        float distanceToSpot=length(fract(jellyPoint.xz*6.5)-0.3-seed*0.4);
        float spot=1.0-smoothstep(0.12,0.2+fwidth(distanceToSpot),distanceToSpot);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.86,0.83,0.69),spot*0.65);
        diffuseColor.a+=0.1+spot*0.14;
      }else{diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.79,0.78,0.68),0.4);diffuseColor.a=0.64;}
    }
    if(kind>2.5){
      rim=0.0;diffuseColor.a=0.22+edge*0.16;
      if(part>1.5){
        vec3 spectrum=0.65+0.18*cos(6.2831*(jellyPoint.y*0.48-clock*(1.0-reduced*0.8)*0.055+edge*0.24+vec3(0.0,0.33,0.67)));
        diffuseColor.rgb=mix(diffuseColor.rgb,spectrum,0.24+response*0.12);diffuseColor.a=0.1+edge*0.06;
      }
    }
    totalEmissiveRadiance=diffuseColor.rgb*0.05+lightTint*energy*(part<0.5?rim*0.38:0.06);
  `);

function strand(points, radius = 0.012, segments = 24, folded = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const sides = folded ? 12 : 5;
  const geometry = new THREE.TubeGeometry(curve, segments, radius, sides, false);
  const vertices = geometry.attributes.position;
  for (let step = 0; step <= segments; step++) {
    const amount = step / segments; const center = curve.getPointAt(amount);
    for (let side = 0; side <= sides; side++) {
      const index = step * (sides + 1) + side;
      const taper = folded ? Math.pow(Math.sin(Math.PI * (0.06 + amount * 0.92)), 0.6) * (1 + Math.sin(amount * 32 + side / sides * Math.PI * 6) * 0.11) : 1 - amount * 0.94;
      vertices.setXYZ(index, center.x + (vertices.getX(index) - center.x) * taper, center.y + (vertices.getY(index) - center.y) * taper, center.z + (vertices.getZ(index) - center.z) * taper * (folded ? 0.55 : 1));
    }
  }
  geometry.computeVertexNormals(); return geometry;
}

function merged(parts) {
  const result = mergeGeometries(parts); parts.forEach(part => part.dispose()); return result;
}

function geometryFor(variant) {
  if (shapes.has(variant.id)) return shapes.get(variant.id);
  const comb = variant.id === 'comb'; const spotted = variant.id === 'spotted'; const moon = variant.id === 'moon';
  let bell;
  if (comb) {
    bell = new THREE.SphereGeometry(1, 40, 24); bell.scale(...variant.bell);
    const vertices = bell.attributes.position;
    for (let index = 0; index < vertices.count; index++) {
      const angle = Math.atan2(vertices.getZ(index), vertices.getX(index));
      const ridge = 1 + Math.cos(angle * 8) * 0.025;
      vertices.setXYZ(index, vertices.getX(index) * ridge, vertices.getY(index), vertices.getZ(index) * ridge);
    }
    bell.computeVertexNormals();
  } else {
    const rimAngle = Math.PI * 0.53;
    const profile = [new THREE.Vector2(Math.sin(rimAngle) * variant.bell[0] * 0.975, Math.cos(rimAngle) * variant.bell[1] - 0.025)];
    for (let step = 24; step >= 0; step--) {
      const angle = step / 24 * rimAngle;
      profile.push(new THREE.Vector2(Math.sin(angle) * variant.bell[0], Math.cos(angle) * variant.bell[1]));
    }
    bell = new THREE.LatheGeometry(profile, 48);
    const vertices = bell.attributes.position;
    for (let index = 0; index < vertices.count; index++) {
      const angle = Math.atan2(vertices.getZ(index), vertices.getX(index));
      const edge = Math.pow(Math.hypot(vertices.getX(index), vertices.getZ(index)) / variant.bell[0], 6);
      const scallop = Math.sin(angle * (spotted ? 12 : 16)) * edge;
      vertices.setXYZ(index, vertices.getX(index) * (1 + scallop * 0.012), vertices.getY(index) + scallop * 0.012, vertices.getZ(index) * (1 + scallop * 0.012));
    }
    bell.computeVertexNormals();
  }
  const filaments = []; const organs = [];
  const count = comb || spotted ? 0 : moon ? 40 : 28;
  for (let index = 0; index < count; index++) {
    const angle = index / count * Math.PI * 2; const radius = variant.bell[0] * 0.986;
    const length = moon ? 0.16 + index % 4 * 0.035 : 0.42 + (Math.sin(index * 2.3) * 0.5 + 0.5) * 0.54;
    const points = Array.from({ length: 10 }, (_, step) => {
      const amount = step / 9;
      return [Math.cos(angle) * (radius + amount * 0.035) + Math.sin(amount * 3 + angle) * amount * 0.07, -0.04 - length * amount, Math.sin(angle) * (radius + amount * 0.035) + Math.cos(amount * 3 + angle) * amount * 0.05];
    });
    filaments.push(strand(points, moon ? 0.008 : 0.011, moon ? 10 : 18));
  }
  if (comb) {
    for (const side of [-1, 1]) {
      filaments.push(strand([[side * 0.26, -0.48, 0], [side * 0.3, -0.63, 0.04], [side * 0.39, -0.81, 0.08], [side * 0.48, -0.84, 0.08]], 0.012, 18));
    }
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2;
      organs.push(strand(Array.from({ length: 18 }, (_, step) => { const latitude = 0.32 + step / 17 * 2.25; return [Math.sin(latitude) * 0.586 * Math.cos(angle), Math.cos(latitude) * 0.685, Math.sin(latitude) * 0.535 * Math.sin(angle)]; }), 0.009, 24));
    }
  } else {
    const armCount = spotted ? 8 : 4;
    for (let index = 0; index < armCount; index++) {
      const angle = index / armCount * Math.PI * 2; const spread = spotted ? 0.23 : 0.18;
      const length = spotted ? 0.96 + index % 3 * 0.075 : moon ? 0.88 : 0.63;
      filaments.push(strand(Array.from({ length: 12 }, (_, step) => {
        const amount = step / 11; const radius = spread + amount * 0.2;
        return [Math.cos(angle + amount * 0.45) * radius, 0.04 - length * amount, Math.sin(angle + amount * 0.45) * radius];
      }), spotted ? 0.15 : 0.115, 28, true));
      if (moon) {
        const horseshoe = Array.from({ length: 18 }, (_, step) => {
          const curl = -Math.PI * 0.78 + step / 17 * Math.PI * 1.56;
          return [0.27 + Math.cos(curl) * 0.11, 0.14 + Math.sin(curl) * 0.008, Math.sin(curl) * 0.13];
        });
        const lobe = strand(horseshoe, 0.025, 24); lobe.rotateY(angle); organs.push(lobe);
      } else {
        const lobe = new THREE.SphereGeometry(1, 16, 10); lobe.scale(0.13, 0.035, 0.08); lobe.rotateY(-angle); lobe.translate(Math.cos(angle) * 0.27, 0.14, Math.sin(angle) * 0.27); organs.push(lobe);
      }
    }
  }
  const result = [bell, merged(filaments), merged(organs)]; shapes.set(variant.id, result); return result;
}

export function createJellyBloom({ count = 16, seed = 81, span = [22, 11, 20], sizes = [0.7, 1.2] } = {}) {
  const root = new THREE.Group(); const random = seededRandom(seed); const jellies = []; const materials = [];
  const families = JELLY_VARIANTS.map((variant, kind) => {
    const uniforms = { clock: { value: 0 }, reduced: { value: 0 }, frequency: { value: [1.1, 0.92, 1.25, 0.48][kind] }, kind: { value: kind }, glow: { value: variant.glow }, response: { value: 0 }, lightTint: { value: new THREE.Color(variant.light) } };
    const parts = [0, 1, 2].map(part => {
      const lighting = THREE.UniformsUtils.clone(THREE.ShaderLib.phong.uniforms);
      lighting.diffuse.value.set(variant.color); lighting.specular.value.setScalar(part === 2 ? 0.045 : 0.16); lighting.shininess.value = 38;
      return new THREE.ShaderMaterial({ uniforms: { ...lighting, ...uniforms, part: { value: part } }, vertexShader, fragmentShader, lights: true, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: part !== 0 });
    });
    materials.push(...parts); return { variant, parts, uniforms };
  });
  for (let index = 0; index < count; index++) {
    const family = families[index % families.length]; const jelly = new THREE.Group();
    const size = sizes[0] + random() * sizes[1];
    jelly.name = family.variant.name; jelly.scale.setScalar(size);
    const angle = index * 2.399963; const ring = Math.sqrt((index + 0.7) / count) * 0.5;
    jelly.position.set(Math.cos(angle) * span[0] * ring, (random() - 0.5) * span[1], Math.sin(angle) * span[2] * ring);
    jelly.userData = { creature: 'jelly', individual: true, speciesVariant: family.variant.id, displayName: family.variant.name, base: jelly.position.toArray(), phase: index * 1.71, size, collisionProfile: [[0, family.variant.id === 'comb' ? 0 : 0.15, 0, family.variant.id === 'comb' ? 0.85 : 1.05]] };
    for (const [part, geometry] of geometryFor(family.variant).entries()) { const mesh = new THREE.Mesh(geometry, family.parts[part]); mesh.userData.noAO = true; jelly.add(mesh); }
    root.add(jelly); jellies.push(jelly);
  }
  let targetGlow = 0; let glow = 0;
  return {
    root, jellies,
    setGlow(value) { targetGlow = value ? 1 : 0; },
    setColor(value) { for (const family of families) family.uniforms.lightTint.value.set(palette[value] || family.variant.light); },
    animate(time, delta = 0, reduced = false) {
      glow = THREE.MathUtils.damp(glow, targetGlow, 1.4, delta);
      for (const family of families) { family.uniforms.clock.value = time; family.uniforms.response.value = glow; family.uniforms.reduced.value = Number(reduced); }
      for (const jelly of jellies) animateJellyDrift(jelly, time, reduced);
    },
    dispose() { materials.forEach(material => material.dispose()); },
  };
}

export function animateJellyDrift(jelly, time, reduced = false) {
  const data = jelly.userData; const motion = reduced ? 0.3 : 1;
  jelly.position.fromArray(data.base);
  jelly.position.y += Math.sin(time * 0.26 + data.phase) * Math.min(1.2, data.size * 0.45) * motion;
  jelly.position.x += Math.sin(time * 0.13 + data.phase) * 0.35 * motion;
  jelly.rotation.y = Math.sin(time * 0.09 + data.phase) * 0.28;
  jelly.rotation.z = Math.sin(time * 0.19 + data.phase) * 0.045 * motion;
}

export function jellyActors(root) {
  const actors = [];
  root?.traverseVisible(object => { if (object.userData.individual && object.userData.creature === 'jelly') actors.push({ root: object, shape: object, species: 'jelly' }); });
  return actors;
}
