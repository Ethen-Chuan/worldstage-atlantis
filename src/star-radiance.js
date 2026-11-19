import * as THREE from 'three';

export function createStarRadiance(paths) {
  const root = new THREE.Group(); root.name = 'fish-linked-starlight';
  const positions = new Float32Array(paths.length * 3); const seeds = new Float32Array(paths.length * 3);
  paths.forEach((fish, index) => seeds.set([fish.angle, fish.lane, index % 29 === 0 ? 1 : 0], index * 3));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
  const uniforms = { time: { value: 0 }, radiance: { value: 0 }, ratio: { value: 1 }, reduced: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms,
    vertexShader: `attribute vec3 seed; uniform float time; uniform float radiance; uniform float ratio; uniform float reduced; varying vec3 tint; varying float flare; varying float opacity;
      void main() {
        float wave=mix(pow(0.5+0.5*cos(seed.x-time*1.25+seed.y*1.9),12.0),0.45,reduced);
        flare=seed.z*radiance*wave;
        tint=mix(vec3(0.3,0.69,1.0),vec3(1.0,0.69,0.28),step(1.5,seed.y));
        vec4 view=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*view;
        gl_PointSize=clamp((1.5+radiance*2.5+flare*19.0)*250.0/max(8.0,-view.z),1.0,32.0)*ratio;
        opacity=(0.12+radiance*(0.55+wave*0.7))*smoothstep(1.0,12.0,-view.z);
      }`,
    fragmentShader: `varying vec3 tint; varying float flare; varying float opacity;
      void main() {
        vec2 point=gl_PointCoord-0.5; float radius=length(point);
        float core=exp(-radius*radius*70.0); float halo=exp(-radius*radius*17.0)*0.28;
        float rays=(exp(-abs(point.x)*110.0)*exp(-abs(point.y)*7.0)+exp(-abs(point.y)*110.0)*exp(-abs(point.x)*7.0))*flare;
        float edge=1.0-smoothstep(0.36,0.5,radius);
        gl_FragColor=vec4(mix(tint,vec3(0.85,0.95,1.0),core*0.65)*(1.1+flare), (core+halo+rays)*opacity*edge);
      }`,
  });
  const stars = new THREE.Points(geometry, material); stars.frustumCulled = false; root.add(stars);
  const stride = 5; const count = Math.floor(paths.length / stride); const samples = 48;
  const history = new Float32Array(count * samples * 3);
  const linePositions = new Float32Array(count * (samples - 1) * 6); const shades = new Float32Array(linePositions.length); const fades = new Float32Array(linePositions.length / 3);
  for (let index = 0; index < count; index++) {
    const tint = new THREE.Color(paths[index * stride].lane === 2 ? '#ffcb77' : paths[index * stride].lane === 1 ? '#8cdfff' : '#449bff');
    for (let sample = 0; sample < samples - 1; sample++) for (let endpoint = 0; endpoint < 2; endpoint++) {
      const vertex = (index * (samples - 1) + sample) * 2 + endpoint;
      shades.set(tint.toArray(), vertex * 3); fades[vertex] = Math.pow(1 - (sample + endpoint) / (samples - 1), 1.3);
    }
  }
  const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage)); lineGeometry.setAttribute('shade', new THREE.BufferAttribute(shades, 3)); lineGeometry.setAttribute('fade', new THREE.BufferAttribute(fades, 1));
  const lineMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms,
    vertexShader: `attribute vec3 shade; attribute float fade; varying vec3 tint; varying float opacity; uniform float radiance; uniform float reduced;
      void main(){vec4 view=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*view;tint=shade;opacity=fade*radiance*mix(0.5,0.16,reduced)*smoothstep(1.0,12.0,-view.z);}`,
    fragmentShader: `varying vec3 tint; varying float opacity; void main(){gl_FragColor=vec4(tint*1.8,opacity);}`,
  });
  const trails = new THREE.LineSegments(lineGeometry, lineMaterial); trails.frustumCulled = false; root.add(trails);
  root.traverse(object => { object.userData.noPick = true; object.userData.noAO = true; });
  let head = 0; let initialized = false; let sampleTime = 0; let previousTime = 0;
  return {
    root, positions,
    update(time, delta, wake, reduced, ratio) {
      uniforms.time.value = time; uniforms.radiance.value = wake.radiance; uniforms.ratio.value = ratio; uniforms.reduced.value = reduced ? 1 : 0;
      geometry.attributes.position.needsUpdate = true;
      trails.visible = wake.radiance > 0.015;
      if (!trails.visible) { initialized = false; sampleTime = 0; previousTime = time; return; }
      if (time - previousTime > 0.3) initialized = false;
      previousTime = time;
      if (initialized && !(delta > 0)) return;
      if (!initialized) {
        for (let index = 0; index < count; index++) for (let sample = 0; sample < samples; sample++) history.set(positions.subarray(index * stride * 3, index * stride * 3 + 3), (index * samples + sample) * 3);
        initialized = true;
      }
      sampleTime += Math.max(0, delta);
      if (sampleTime >= 1 / 30) { head = (head + 1) % samples; sampleTime %= 1 / 30; }
      for (let index = 0; index < count; index++) {
        history.set(positions.subarray(index * stride * 3, index * stride * 3 + 3), (index * samples + head) * 3);
        for (let sample = 0; sample < samples - 1; sample++) {
          const start = (index * samples + (head - sample + samples) % samples) * 3;
          const end = (index * samples + (head - sample - 1 + samples) % samples) * 3;
          const vertex = (index * (samples - 1) + sample) * 6;
          for (let component = 0; component < 3; component++) { linePositions[vertex + component] = history[start + component]; linePositions[vertex + component + 3] = history[end + component]; }
        }
      }
      lineGeometry.attributes.position.needsUpdate = true;
    },
  };
}
