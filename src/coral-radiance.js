import * as THREE from 'three';

export function coralGlowLevel(energy, reduced = false) {
  const amount = Number.isFinite(energy) ? Math.max(0, Math.min(1, energy)) : 0;
  return (0.46 + amount * 0.54) * (reduced ? 0.65 : 1);
}

export function createCoralRadiance(anchors) {
  const root = new THREE.Group(); root.name = 'coral-polyp-radiance';
  const positions = new Float32Array(anchors.length * 3); const seeds = new Float32Array(anchors.length * 4); const colors = new Float32Array(anchors.length * 3);
  anchors.forEach((anchor, index) => {
    positions.set(anchor.position, index * 3);
    seeds.set([anchor.progress, anchor.phase, anchor.halo ? 1 : 0, anchor.size], index * 4);
    colors.set(new THREE.Color(anchor.color).toArray(), index * 3);
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const uniforms = { time: { value: 0 }, glow: { value: 0.46 }, energy: { value: 0 }, age: { value: -1 }, ratio: { value: 1 }, reduced: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms,
    vertexShader: `attribute vec4 seed; attribute vec3 color; uniform float time; uniform float glow; uniform float energy; uniform float age; uniform float ratio; uniform float reduced;
      varying vec3 tint; varying float brightness; varying float halo; varying float sparkle;
      void main() {
        vec3 point=position; point.z+=sin(time*0.45+position.x*0.04)*seed.x*seed.x*0.85;
        float gleam=pow(0.5+0.5*sin(time*0.9+seed.y),8.0);
        gleam=mix(gleam,0.3,reduced);
        float local=age-2.4-length(position.xz)*0.004;
        float wave=step(0.0,local)*exp(-local*1.6)*smoothstep(0.0,0.16,local);
        halo=seed.z; sparkle=gleam*(0.45+energy*0.55);
        brightness=glow*(0.65+gleam*1.6+wave*2.8)*mix(1.0,0.24,halo);
        tint=mix(color,vec3(0.7,0.95,1.0),gleam*0.22)*mix(1.6,1.0,halo);
        vec4 view=modelViewMatrix*vec4(point,1.0); gl_Position=projectionMatrix*view;
        float diameter=mix(1.6+gleam*4.6+wave*5.0,seed.w*(1.0+energy*0.35),halo);
        gl_PointSize=clamp(diameter*300.0/max(4.0,-view.z),1.0,mix(26.0,100.0,halo))*ratio;
        brightness*=smoothstep(3.0,14.0,-view.z);
      }`,
    fragmentShader: `varying vec3 tint; varying float brightness; varying float halo; varying float sparkle;
      void main() {
        vec2 point=gl_PointCoord-0.5; float radius=length(point); float edge=1.0-smoothstep(0.35,0.5,radius);
        float core=exp(-radius*radius*65.0);
        float rays=(exp(-abs(point.x)*85.0)*exp(-abs(point.y)*8.0)+exp(-abs(point.y)*85.0)*exp(-abs(point.x)*8.0))*sparkle*0.38;
        float light=mix(core+exp(-radius*radius*16.0)*0.28+rays,exp(-radius*radius*12.0),halo);
        gl_FragColor=vec4(mix(tint,vec3(1.3,1.4,1.3),core*(1.0-halo)*0.6),light*edge*brightness);
      }`,
  });
  const lights = new THREE.Points(geometry, material); lights.frustumCulled = false; lights.userData.noAO = true; lights.userData.noPick = true; root.add(lights);
  return { root, update(time, energy, age, reduced = false, ratio = 1) {
    uniforms.time.value = time; uniforms.energy.value = Number.isFinite(energy) ? Math.max(0, Math.min(1, energy)) : 0;
    uniforms.glow.value = coralGlowLevel(energy, reduced); uniforms.age.value = Number.isFinite(age) && age >= 0 && age < 14 ? age : -1;
    uniforms.reduced.value = reduced ? 1 : 0; uniforms.ratio.value = Number.isFinite(ratio) ? Math.max(0.5, Math.min(2, ratio)) : 1;
  } };
}
