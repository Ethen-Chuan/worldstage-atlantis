import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './core.js';

export const JELLY_VARIANTS = Object.freeze([
  { id: 'moon', name: '月光海月', bell: [1, 0.36, 1], color: '#b8d8ef', light: '#9bc4de', channels: 16, glow: 0.08 },
  { id: 'crystal', name: '碧缘晶水母', bell: [1, 0.58, 1], color: '#93cabf', light: '#64eeb7', channels: 48, glow: 0.58 },
  { id: 'crown', name: '深红冠水母', bell: [0.78, 0.94, 0.78], color: '#9f294f', light: '#68aaff', channels: 24, glow: 0.38 },
  { id: 'comb', name: '虹带栉水母', bell: [0.62, 1.12, 0.62], color: '#bdcce3', light: '#8abddd', channels: 8, glow: 0.18 },
]);

const shapes = new Map();
const palette = { pearl: null, rose: '#e3a3cf', blue: '#7ebde8', gold: '#e7cb91', teal: '#7acabb' };
const vertexShader = `uniform float clock;uniform float reduced;uniform float part;uniform float frequency;
  varying vec3 jellyPoint;varying vec3 jellyNormal;varying vec3 jellyView;varying float jellyPhase;
  void main(){
    jellyPoint=position;float phase=length(modelMatrix[0].xyz)*2.17;jellyPhase=phase;
    float pulse=sin(clock*frequency+phase);vec3 point=position;
    float trailing=max(0.0,-point.y);float motion=1.0-reduced*0.75;
    point.xz*=1.0+pulse*0.047*motion;point.y*=1.0-pulse*0.09*motion;
    point.x+=sin(clock*0.85-trailing*1.7+phase)*trailing*0.065*motion;
    point.z+=cos(clock*0.64-trailing*1.3+phase)*trailing*0.045*motion;
    vec4 eye=modelViewMatrix*vec4(point,1.0);jellyNormal=normalize(normalMatrix*normal);jellyView=-eye.xyz;
    gl_Position=projectionMatrix*eye;
  }`;
const fragmentShader = `uniform float clock;uniform float reduced;uniform float part;uniform float kind;uniform float channels;uniform float glow;uniform float response;
  uniform vec3 tint;uniform vec3 lightTint;varying vec3 jellyPoint;varying vec3 jellyNormal;varying vec3 jellyView;varying float jellyPhase;
  void main(){
    float angle=atan(jellyPoint.z,jellyPoint.x);float radius=length(jellyPoint.xz);
    float fresnel=pow(1.0-abs(dot(normalize(jellyNormal),normalize(jellyView))),2.2);
    float veins=pow(0.5+0.5*cos(angle*channels),32.0);
    float rim=exp(-abs(jellyPoint.y+0.05)*24.0);
    float rhythm=0.5+0.5*sin(clock*(1.0-reduced*0.7)*1.35+jellyPhase);
    float chase=pow(0.5+0.5*cos(angle*3.0-clock*(1.0-reduced*0.75)*1.7+jellyPhase),8.0);
    vec3 radiance=lightTint;
    if(kind>2.5){
      float ribbon=pow(0.5+0.5*cos(angle*8.0),55.0);
      float combs=pow(0.5+0.5*sin(jellyPoint.y*74.0),4.0);
      vec3 spectrum=0.52+0.48*cos(6.2831*(jellyPoint.y*0.56-clock*(1.0-reduced*0.8)*0.14+dot(normalize(jellyView),normalize(jellyNormal))*0.18+vec3(0.0,0.33,0.67)));
      radiance=mix(lightTint,spectrum,0.88);veins=ribbon*(0.35+combs*0.65);rim=0.0;
    }
    float energy=glow*(0.7+rhythm*0.3)+response*(0.4+chase*0.6);
    vec3 color=tint*(0.26+fresnel*0.46)+radiance*(veins*0.38+rim*0.24)*(0.6+energy*1.8);
    float alpha=0.11+fresnel*0.26+veins*0.17+rim*0.12;
    if(part>0.5){color=tint*0.3+radiance*(0.35+energy*0.7);alpha=0.28+fresnel*0.21;}
    if(part>1.5){color=radiance*(0.8+energy*(0.6+chase));alpha=0.56+chase*0.18;}
    if(kind>1.5&&kind<2.5&&part<0.5){color+=tint*0.35;alpha+=0.1;}
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function strand(points, radius = 0.012, segments = 28) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), segments, radius, 4, false);
}

function merged(parts) {
  const result = mergeGeometries(parts); parts.forEach(part => part.dispose()); return result;
}

function geometryFor(variant) {
  if (shapes.has(variant.id)) return shapes.get(variant.id);
  const comb = variant.id === 'comb'; const crown = variant.id === 'crown';
  const bell = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, comb ? Math.PI : Math.PI * 0.54);
  bell.scale(...variant.bell);
  const filaments = []; const organs = [];
  const count = comb ? 2 : crown ? 24 : variant.id === 'moon' ? 32 : 48;
  for (let index = 0; index < count; index++) {
    const angle = index / count * Math.PI * 2; const radius = variant.bell[0] * (comb ? 0.72 : 0.97);
    const length = comb ? 3.2 : crown ? index === 0 ? 5.8 : 2.5 : variant.id === 'moon' ? 0.48 : 1.7 + index % 3 * 0.21;
    const points = Array.from({ length: 14 }, (_, step) => {
      const amount = step / 13;
      return [Math.cos(angle) * radius + Math.sin(amount * 5 + angle) * amount * 0.22, -0.05 - length * amount, Math.sin(angle) * radius + Math.cos(amount * 4 + angle) * amount * 0.16];
    });
    filaments.push(strand(points, comb ? 0.018 : 0.009, 20));
  }
  if (variant.id === 'moon') {
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI / 2;
      const ring = new THREE.TorusGeometry(0.18, 0.024, 6, 20, Math.PI * 1.75); ring.rotateX(Math.PI / 2); ring.translate(Math.cos(angle) * 0.28, 0.16, Math.sin(angle) * 0.28); organs.push(ring);
      filaments.push(strand([[Math.cos(angle) * 0.15, 0, Math.sin(angle) * 0.15], [Math.cos(angle) * 0.28, -0.6, Math.sin(angle) * 0.28], [Math.cos(angle) * 0.34, -1.3, Math.sin(angle) * 0.38]], 0.055, 20));
    }
  } else if (comb) {
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2;
      organs.push(strand(Array.from({ length: 22 }, (_, step) => { const latitude = 0.18 + step / 21 * 2.78; return [Math.sin(latitude) * 0.624 * Math.cos(angle), Math.cos(latitude) * 1.125, Math.sin(latitude) * 0.624 * Math.sin(angle)]; }), 0.009, 30));
    }
  } else {
    const ring = new THREE.TorusGeometry(variant.bell[0] * 0.987, crown ? 0.024 : 0.015, 6, 72); ring.rotateX(Math.PI / 2); ring.translate(0, -variant.bell[1] * 0.12, 0); organs.push(ring);
    const core = new THREE.SphereGeometry(1, 20, 12); core.scale(crown ? 0.32 : 0.13, crown ? 0.32 : 0.08, crown ? 0.32 : 0.13); core.translate(0, 0.16, 0); organs.push(core);
  }
  const result = [bell, merged(filaments), merged(organs)]; shapes.set(variant.id, result); return result;
}

export function createJellyBloom({ count = 16, seed = 81, span = [22, 11, 20], sizes = [0.7, 1.2] } = {}) {
  const root = new THREE.Group(); const random = seededRandom(seed); const jellies = []; const materials = [];
  const families = JELLY_VARIANTS.map((variant, kind) => {
    const uniforms = { clock: { value: 0 }, reduced: { value: 0 }, frequency: { value: [1.35, 1.1, 0.86, 0.5][kind] }, kind: { value: kind }, channels: { value: variant.channels }, glow: { value: variant.glow }, response: { value: 0 }, tint: { value: new THREE.Color(variant.color) }, lightTint: { value: new THREE.Color(variant.light) } };
    const parts = [0, 1, 2].map(part => new THREE.ShaderMaterial({ uniforms: { ...uniforms, part: { value: part } }, vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
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
