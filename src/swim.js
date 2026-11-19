import * as THREE from 'three';

export function swimWave(depth, time, settings) {
  const progress = THREE.MathUtils.clamp((depth - settings.start) / (settings.end - settings.start), 0, 1);
  const weight = progress * progress * (3 - 2 * progress);
  const phase = time * settings.frequency - (depth - settings.start) * settings.wavelength;
  const gradient = progress > 0 && progress < 1 ? 6 * progress * (1 - progress) / (settings.end - settings.start) : 0;
  return {
    offset: Math.sin(phase) * weight * settings.amplitude,
    slope: (Math.cos(phase) * -settings.wavelength * weight + Math.sin(phase) * gradient) * settings.amplitude,
  };
}

export function attachSwimming(root, settings) {
  const time = { value: 0 };
  const strength = { value: 1 };
  const axis = settings.axis === 'y' ? 'y' : 'x';
  const declarations = `uniform float swimTime; ${settings.dynamicAmplitude ? 'uniform float swimStrength;' : ''}
    vec2 swimCurve(float depth) {
      float progress = clamp((depth - ${settings.start.toFixed(4)}) / ${(settings.end - settings.start).toFixed(4)}, 0.0, 1.0);
      float weight = progress * progress * (3.0 - 2.0 * progress);
      float gradient = 6.0 * progress * (1.0 - progress) / ${(settings.end - settings.start).toFixed(4)};
      float phase = swimTime * ${settings.frequency.toFixed(4)} - (depth - ${settings.start.toFixed(4)}) * ${settings.wavelength.toFixed(4)};
      return vec2(sin(phase) * weight, cos(phase) * -${settings.wavelength.toFixed(4)} * weight + sin(phase) * gradient) * ${settings.amplitude.toFixed(4)} ${settings.dynamicAmplitude ? '* swimStrength' : ''};
    }\n`;
  const materials = new Map();
  for (const object of root.children) {
    if (!object.isMesh || Array.isArray(object.material)) continue;
    const original = object.material;
    if (!materials.has(original)) {
      const material = original.clone(); const compile = original.onBeforeCompile.bind(original); const cache = original.customProgramCacheKey();
      material.onBeforeCompile = shader => {
        compile(shader);
        shader.uniforms.swimTime = time;
        if (settings.dynamicAmplitude) shader.uniforms.swimStrength = strength;
        shader.vertexShader = declarations + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\nobjectNormal.z -= objectNormal.${axis} * swimCurve(position.z).y;`);
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed.${axis} += swimCurve(position.z).x;`);
      };
      material.customProgramCacheKey = () => `${cache}-swim-${JSON.stringify(settings)}`;
      materials.set(original, material);
    }
    object.material = materials.get(original);
    if (settings.shadow) {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      depth.onBeforeCompile = shader => { shader.uniforms.swimTime = time; shader.uniforms.swimStrength = strength; shader.vertexShader = declarations + shader.vertexShader; shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed.${axis} += swimCurve(position.z).x;`); };
      depth.customProgramCacheKey = () => `swim-depth-${JSON.stringify(settings)}`;
      object.customDepthMaterial = depth; object.castShadow = true;
    }
  }
  root.traverse(object => { if (object.isMesh) object.userData.noAO = true; });
  return { update(clock, amplitude = 1) { time.value = clock; strength.value = amplitude; }, sample(depth, clock, amplitude = 1) { const wave = swimWave(depth, clock, settings); return { offset: wave.offset * amplitude, slope: wave.slope * amplitude }; } };
}

export function springPosition(position, velocity, target, frequency, delta) {
  if (!(delta > 0)) return;
  const decay = Math.exp(-frequency * delta);
  for (const component of ['x', 'y', 'z']) {
    const displacement = position[component] - target[component];
    const momentum = velocity[component] + frequency * displacement;
    position[component] = target[component] + (displacement + momentum * delta) * decay;
    velocity[component] = (velocity[component] - frequency * momentum * delta) * decay;
  }
}

export function dampAngle(current, target, frequency, delta) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-frequency * delta));
}

export function smoothBody(profile, longitudinal = 96, radial = 48, verticalScale = 1) {
  const curve = new THREE.CatmullRomCurve3(profile.map(([depth, radius]) => new THREE.Vector3(radius, 0, depth)), false, 'centripetal');
  const positions = []; const coordinates = []; const indices = [];
  for (let section = 0; section <= longitudinal; section++) {
    const point = curve.getPoint(section / longitudinal);
    for (let segment = 0; segment <= radial; segment++) {
      const angle = segment / radial * Math.PI * 2;
      positions.push(Math.cos(angle) * point.x, Math.sin(angle) * point.x * verticalScale, point.z);
      coordinates.push(segment / radial, section / longitudinal);
      if (section < longitudinal && segment < radial) {
        const start = section * (radial + 1) + segment;
        indices.push(start, start + 1, start + radial + 1, start + 1, start + radial + 2, start + radial + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normal = new THREE.Vector3();
  for (let section = 0; section <= longitudinal; section++) {
    const first = section * (radial + 1); const last = first + radial;
    normal.fromBufferAttribute(geometry.attributes.normal, first).add(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, last)).normalize();
    geometry.attributes.normal.setXYZ(first, normal.x, normal.y, normal.z); geometry.attributes.normal.setXYZ(last, normal.x, normal.y, normal.z);
  }
  return geometry;
}
