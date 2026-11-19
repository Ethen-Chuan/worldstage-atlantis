import * as THREE from 'three';
import { waveHeight } from './dolphin-motion.js';

export class BreachEffects {
  constructor(root) {
    this.events = []; this.cursor = 0; this.count = 0;
    const geometry = new THREE.PlaneGeometry(2, 2); geometry.rotateX(-Math.PI / 2);
    for (let index = 0; index < 12; index++) {
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { age: { value: 3 }, strength: { value: 1 } },
        vertexShader: 'varying vec2 foamUV; void main(){foamUV=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `varying vec2 foamUV; uniform float age; uniform float strength;
          void main(){float radius=length(foamUV);float angle=atan(foamUV.y,foamUV.x);
          float edge=0.7+sin(angle*13.0+age)*0.045+sin(angle*23.0)*0.025;
          float foam=(1.0-smoothstep(0.07,0.2,abs(radius-edge)))*(0.55+0.45*sin(angle*31.0+radius*28.0));
          float fade=(1.0-smoothstep(0.3,2.4,age))*smoothstep(0.0,0.09,age);
          gl_FragColor=vec4(0.82,0.9,0.87,foam*fade*strength*0.72);}`,
      });
      const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.userData.noPick = true; mesh.userData.noAO = true; root.add(mesh);
      this.events.push({ mesh, birth: -100, position: new THREE.Vector3(), entering: false });
    }
    this.positions = new Float32Array(12 * 28 * 3); this.velocities = new Float32Array(12 * 28 * 3); this.births = new Float32Array(12 * 28).fill(-100);
    const particles = new THREE.BufferGeometry(); particles.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    particles.setAttribute('launchVelocity', new THREE.BufferAttribute(this.velocities, 3).setUsage(THREE.DynamicDrawUsage));
    particles.setAttribute('birth', new THREE.BufferAttribute(this.births, 1).setUsage(THREE.DynamicDrawUsage));
    const spray = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { clock: { value: 0 }, reduced: { value: 0 } },
      vertexShader: `attribute vec3 launchVelocity; attribute float birth; uniform float clock; varying float life;
        void main(){float age=clock-birth;life=age>=0.0?clamp(1.0-age/1.5,0.0,1.0):0.0;
        vec3 point=position+launchVelocity*max(age,0.0);point.y-=4.905*age*age;
        float water=190.0+sin(point.x*0.075+point.z*0.051-clock*0.65)*0.65+sin(point.x*0.15-point.z*0.11+clock*0.9)*0.24;
        life*=smoothstep(water-0.1,water+0.15,point.y);
        vec4 eye=modelViewMatrix*vec4(point,1.0);gl_Position=projectionMatrix*eye;
        gl_PointSize=clamp(95.0/max(1.0,-eye.z),1.1,4.5)*step(0.001,life);}`,
      fragmentShader: `varying float life;uniform float reduced;void main(){float radius=length(gl_PointCoord-0.5);float alpha=(1.0-smoothstep(0.15,0.5,radius))*life*(1.0-reduced*0.65);gl_FragColor=vec4(0.93,0.96,0.89,alpha*0.85);}`,
    });
    this.spray = new THREE.Points(particles, spray); this.spray.frustumCulled = false; this.spray.userData.noPick = true; this.spray.userData.noAO = true; root.add(this.spray);
  }
  emit(crossing) {
    const index = this.cursor++ % this.events.length; const event = this.events[index]; this.count++;
    event.birth = crossing.time; event.position.copy(crossing.position); event.entering = crossing.entering;
    event.mesh.rotation.y = Math.atan2(crossing.velocity.x, crossing.velocity.z);
    event.mesh.material.uniforms.strength.value = crossing.entering ? 1 : 0.6;
    for (let particle = 0; particle < 28; particle++) {
      const slot = index * 28 + particle; const angle = particle * 2.399963;
      const force = (crossing.entering ? 1 : 0.7) * (2 + particle % 5 * 0.55);
      this.positions.set(crossing.position.toArray(), slot * 3);
      this.velocities.set([Math.cos(angle) * force + crossing.velocity.x * 0.1, 2.5 + particle % 7 * 0.48, Math.sin(angle) * force + crossing.velocity.z * 0.1], slot * 3);
      this.births[slot] = crossing.time;
    }
    for (const attribute of Object.values(this.spray.geometry.attributes)) attribute.needsUpdate = true;
  }
  update(time, reduced) {
    this.spray.material.uniforms.clock.value = time; this.spray.material.uniforms.reduced.value = Number(reduced);
    for (const event of this.events) {
      const age = time - event.birth; event.mesh.visible = age >= 0 && age < 2.4;
      if (!event.mesh.visible) continue;
      event.mesh.position.copy(event.position); event.mesh.position.y = waveHeight(event.position.x, event.position.z, time) + 0.13;
      const spread = 1.5 + age * 3.4; event.mesh.scale.set(spread, 1, spread * (event.entering ? 1.25 : 1.55));
      event.mesh.material.uniforms.age.value = age;
    }
  }
}
