import * as THREE from 'three';
import { smoothBody, attachSwimming } from './swim.js';

export const SEA_LEVEL = 190;
export function dolphinPath(time, index) {
  const cycle = 24; const phase = ((time - index * 1.05) % cycle + cycle) % cycle;
  const leap = THREE.MathUtils.clamp((phase - 5) / 3.5, 0, 1);
  const arc = phase >= 5 && phase <= 8.5 ? Math.sin(leap * Math.PI) ** 2 : 0;
  const verticalSpeed = phase > 5 && phase < 8.5 ? Math.sin(leap * Math.PI * 2) * Math.PI / 3.5 * 7 : 0;
  const angle = phase / cycle * Math.PI * 2;
  const lateralSpeed = Math.cos(angle) * 30 * Math.PI * 2 / cycle; const forwardSpeed = -Math.sin(angle) * 75 * Math.PI * 2 / cycle;
  const landing = 5 + (1 - Math.asin(Math.sqrt(0.4)) / Math.PI) * 3.5;
  return { position: [-66 + index * 17 + Math.sin(angle) * 30, SEA_LEVEL - 2.8 + arc * 7, -10 + Math.cos(angle) * 75 - index % 3 * 12], heading: Math.atan2(-lateralSpeed, -forwardSpeed), pitch: Math.atan2(verticalSpeed, Math.hypot(lateralSpeed, forwardSpeed)), splash: phase >= landing && phase < landing + 1.3 ? (phase - landing) / 1.3 : -1, phase };
}

function createDolphin() {
  const root = new THREE.Group(); root.userData.creature = 'dolphin'; root.userData.displayName = '追光海豚'; root.name = 'bottlenose-dolphin';
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38 });
  const finMaterial = new THREE.MeshStandardMaterial({ color: '#6d8a91', roughness: 0.46, side: THREE.DoubleSide });
  const body = smoothBody([[-3.35, 0.03], [-3.05, 0.32], [-2.4, 0.71], [-1, 0.87], [0.6, 0.66], [2, 0.27], [3.1, 0.06]], 64, 28, 0.91);
  const colors = []; const back = new THREE.Color('#496b78'); const belly = new THREE.Color('#d0d3c3');
  for (let index = 0; index < body.attributes.position.count; index++) colors.push(...back.clone().lerp(belly, 1 - THREE.MathUtils.smoothstep(body.attributes.position.getY(index), -0.48, 0.1)).toArray());
  body.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); root.add(new THREE.Mesh(body, material));
  const beak = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), finMaterial); beak.position.set(0, -0.22, -3.3); beak.scale.set(0.22, 0.16, 0.65); root.add(beak);
  const dark = new THREE.MeshStandardMaterial({ color: '#12232c', roughness: 0.2 });
  for (const side of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8), dark); eye.position.set(side * 0.58, 0.08, -2.57); root.add(eye); }
  const fin = (points, position, rotation, scale = [1, 1, 1]) => {
    const outline = new THREE.Shape(); outline.moveTo(...points[0]); for (let index = 1; index < points.length; index++) outline.lineTo(...points[index]); outline.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.045, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.04, bevelSegments: 2 }), finMaterial);
    mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.scale.set(...scale); root.add(mesh); return mesh;
  };
  fin([[0, 0], [0.5, 1.45], [0.7, 1.6], [0.6, 0.5], [1.5, 0]], [0, 0.68, -0.4], [0, -Math.PI / 2, 0]);
  for (const side of [-1, 1]) fin([[0, 0], [1.6, -1.4], [1.5, -1.6], [0.2, -0.65]], [side * 0.5, -0.38, -1.5], [-Math.PI / 2, 0, 0], [side, 1, 1]);
  const tail = fin([[0, 0], [1.7, -0.8], [1.4, -1.2], [0, -0.7], [-1.4, -1.2], [-1.7, -0.8]], [0, 0, 2.9], [-Math.PI / 2, 0, 0]);
  const swim = attachSwimming(root, { axis: 'y', start: -0.3, end: 3.2, amplitude: 0.2, frequency: 3, wavelength: 0.5 });
  return { root, animate(time) { swim.update(time); tail.position.y = swim.sample(2.9, time).offset; } };
}

export class SunsetSea {
  constructor(scene) {
    this.scene = scene; this.root = new THREE.Group(); this.root.name = '逐日海豚 · 连续海面'; scene.add(this.root); this.animals = []; this.blend = 0;
    const geometry = new THREE.PlaneGeometry(2800, 2800, 96, 96); geometry.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, seaLevel: { value: SEA_LEVEL }, visibility: { value: 0 }, worldOffset: { value: new THREE.Vector3() } },
      vertexShader: `uniform float time; uniform vec3 worldOffset; varying vec3 seaPoint; varying vec3 seaNormal;
      void main(){vec3 point=position;vec4 world=modelMatrix*vec4(point,1.0);
        vec2 absolutePoint=world.xz+worldOffset.xz;
        float first=absolutePoint.x*0.075+absolutePoint.y*0.051-time*0.65;float second=absolutePoint.x*0.15-absolutePoint.y*0.11+time*0.9;
        world.y+=sin(first)*0.65+sin(second)*0.24;
        seaNormal=normalize(vec3(-cos(first)*0.049-cos(second)*0.036,1.0,-cos(first)*0.033+cos(second)*0.026));
        seaPoint=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;
      }`,
      fragmentShader: `uniform float time; uniform float seaLevel; uniform float visibility; uniform vec3 worldOffset; varying vec3 seaPoint; varying vec3 seaNormal;
      void main(){
        vec3 view=normalize(cameraPosition-seaPoint);vec3 normal=normalize(seaNormal);
        vec2 detail=(seaPoint.xz+worldOffset.xz)*0.7;
        normal.xz+=vec2(sin(detail.x+sin(detail.y-time)),cos(detail.y+sin(detail.x+time)))*0.045;normal=normalize(normal);
        bool above=cameraPosition.y+worldOffset.y>seaLevel;
        if(!above)normal=-normal;
        float fresnel=pow(1.0-max(0.0,dot(normal,view)),4.0);
        vec3 reflected=reflect(-view,normal);vec3 sun=normalize(vec3(-0.12,0.065,-1.0));
        float glint=pow(max(0.0,dot(reflected,sun)),150.0);float band=pow(max(0.0,dot(reflected,sun)),10.0);
        vec3 color=mix(vec3(0.035,0.11,0.14),vec3(0.22,0.28,0.29),fresnel);
        color+=vec3(1.0,0.53,0.12)*(glint*2.8+band*0.24);
        if(!above)color=mix(vec3(0.025,0.15,0.19),color,0.45)+vec3(0.18,0.22,0.12)*pow(max(0.0,-view.y),4.0);
        float opacity=above?1.0:visibility*(1.0-smoothstep(450.0,1150.0,distance(cameraPosition,seaPoint)));
        gl_FragColor=vec4(color,opacity);
      }`,
    });
    this.water = new THREE.Mesh(geometry, material); this.water.userData.noPick = true; this.water.userData.noAO = true; this.water.frustumCulled = false; this.root.add(this.water);
  }
  prepare() {
    if (this.animals.length) return;
    for (let index = 0; index < 9; index++) {
      const animal = createDolphin(); animal.root.scale.setScalar(1.9); this.root.add(animal.root);
      const splash = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffe2a2', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      splash.rotation.x = -Math.PI / 2; splash.userData.noPick = true; splash.userData.noAO = true; this.root.add(splash);
      this.animals.push({ ...animal, index, splash, kind: 'dolphin' });
    }
  }
  update(position, offset, time, reduced) {
    this.blend = THREE.MathUtils.smoothstep(position.y, SEA_LEVEL - 12, SEA_LEVEL + 7);
    this.root.position.copy(offset).multiplyScalar(-1);
    this.water.position.set(position.x, SEA_LEVEL, position.z); this.water.material.uniforms.time.value = time;
    this.water.visible = position.y > SEA_LEVEL - 90; this.water.material.uniforms.visibility.value = THREE.MathUtils.smoothstep(position.y, SEA_LEVEL - 90, SEA_LEVEL - 50);
    this.water.material.uniforms.worldOffset.value.copy(offset);
    if (position.y > SEA_LEVEL - 65) this.prepare();
    for (const animal of this.animals) {
      const path = dolphinPath(time * (reduced ? 0.7 : 1), animal.index);
      animal.root.position.fromArray(path.position); animal.root.rotation.set(path.pitch, path.heading, 0, 'YXZ'); animal.root.visible = position.distanceTo(animal.root.position) < 600;
      animal.animate(time);
      animal.splash.visible = path.splash >= 0 && path.splash < 1;
      if (animal.splash.visible) { animal.splash.position.set(path.position[0], SEA_LEVEL + 0.5, path.position[2]); animal.splash.scale.setScalar(1 + path.splash * 6); animal.splash.material.opacity = (1 - path.splash) * 0.48; }
    }
  }
  inspect() { return { level: SEA_LEVEL, blend: this.blend, dolphins: this.animals.length }; }
}
