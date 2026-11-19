import * as THREE from 'three';
import { seededRandom } from './core.js';

export function coralBloomEnvelope(age) {
  if (!Number.isFinite(age) || age < 0 || age >= 14) return 0;
  if (age < 2.4) return age / 2.4 * 0.24;
  if (age < 2.58) return 0.24 + (age - 2.4) / 0.18 * 0.76;
  return Math.exp(-(age - 2.58) * 0.36) * (1 - THREE.MathUtils.smoothstep(age, 11, 14));
}

export function createCoralBloom(emitters) {
  const random = seededRandom(6172); const origins = []; const seeds = []; const positions = []; const count = emitters.length * 128;
  for (let index = 0; index < count; index++) { origins.push(...emitters[index % emitters.length]); seeds.push(random(), random(), random(), random()); positions.push(0, 0, 0); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('origin', new THREE.Float32BufferAttribute(origins, 3)); geometry.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 4));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { age: { value: -1 }, reduced: { value: 0 }, ratio: { value: 1 } },
    vertexShader: `attribute vec3 origin; attribute vec4 seed; uniform float age; uniform float reduced; uniform float ratio; varying float light; varying vec3 tint;
    void main(){
      float local=age-2.4-length(origin.xz)*0.004-seed.w*0.16;
      float charge=smoothstep(0.0,2.4,age);
      float speed=mix(27.0,7.0,reduced);
      float distance=speed*(1.0-exp(-max(local,0.0)*0.9));
      float theta=seed.x*6.283185; float vertical=seed.y*1.5-0.5;
      vec3 direction=normalize(vec3(cos(theta),vertical,sin(theta)));
      vec3 point=origin+direction*(local<0.0?(1.0-charge)*2.0:distance)*(0.5+seed.z*0.8);
      point.y+=max(local,0.0)*0.6;
      light=local<0.0?charge*0.13:exp(-local*0.58)*smoothstep(0.0,0.09,local);
      light*=1.0-smoothstep(9.0,14.0,age);
      tint=mix(vec3(0.18,0.72,0.91),vec3(1.0,0.55,0.31),seed.w)*mix(2.0,0.8,reduced);
      vec4 view=modelViewMatrix*vec4(point,1.0); gl_Position=projectionMatrix*view;
      gl_PointSize=clamp((1.0+seed.z*1.4)*300.0/max(4.0,-view.z),1.0,7.0)*ratio;
      light*=smoothstep(2.0,10.0,-view.z);
    }`,
    fragmentShader: 'varying float light; varying vec3 tint; void main(){float distance=length(gl_PointCoord-0.5);gl_FragColor=vec4(tint,light*exp(-distance*distance*22.0)*(1.0-smoothstep(0.4,0.5,distance)));}',
  });
  const root = new THREE.Points(geometry, material); root.userData.noAO = true; root.userData.noPick = true; root.frustumCulled = false;
  return { root, update(age, reduced, ratio) { root.visible = Number.isFinite(age) && age >= 0 && age < 14; material.uniforms.age.value = root.visible ? age : -1; material.uniforms.reduced.value = reduced ? 1 : 0; material.uniforms.ratio.value = ratio; } };
}
