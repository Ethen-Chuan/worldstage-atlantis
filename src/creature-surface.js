import * as THREE from 'three';

const textures = new Map();

export async function prepareCreatureSurfaces() {
  const loader = new THREE.TextureLoader();
  await Promise.all(['ancient', 'whale'].map(async kind => {
    const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}textures/${kind}-skin.png`);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    texture.colorSpace = THREE.NoColorSpace;
    textures.set(kind, texture);
  }));
}

export function organicSurface(material, kind, { relief = 0.065, length = 34 } = {}) {
  material.onBeforeCompile = shader => {
    shader.uniforms.skinAtlas = { value: textures.get(kind === 'whale' ? 'whale' : 'ancient') || null };
    shader.vertexShader = 'varying vec3 organicPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\norganicPosition = position;');
    shader.fragmentShader = `uniform sampler2D skinAtlas; varying vec3 organicPosition;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float skinAngle = atan(organicPosition.y, organicPosition.x) / 6.2831853 + 0.5;
      vec2 skinUV = vec2(skinAngle, (organicPosition.z + 16.0) / ${length.toFixed(4)});
      vec4 skinDetail = texture2D(skinAtlas, skinUV);
      float skinFlecks = smoothstep(0.58, 0.78, skinDetail.r);
      float skinBack = smoothstep(-0.8, 2.4, organicPosition.y);
      diffuseColor.rgb *= 0.52 + skinDetail.r * 0.77;
      ${kind === 'whale' ? 'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.26, 1.19, 1.06), skinFlecks * 0.32);' : `
        diffuseColor.rgb *= mix(vec3(1.14, 1.16, 1.07), vec3(0.21, 0.38, 0.40), skinBack);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.35, 0.25, 0.12), skinFlecks * skinBack * 0.28);
        float lateral = exp(-pow((abs(organicPosition.x) - 3.7) * 3.0, 2.0)) * exp(-pow((organicPosition.y - 0.7) * 3.2, 2.0));
        diffuseColor.rgb *= 1.0 - lateral * 0.32;
      `}
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.64 + skinDetail.b * 0.62), 0.26, 0.95);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 skinDx = dFdx(-vViewPosition);
      vec3 skinDy = dFdy(-vViewPosition);
      vec3 skinCrossX = cross(skinDy, normal);
      vec3 skinCrossY = cross(normal, skinDx);
      float skinDet = dot(skinDx, skinCrossX);
      vec3 skinGradient = sign(skinDet) * (dFdx(skinDetail.g) * skinCrossX + dFdy(skinDetail.g) * skinCrossY);
      normal = normalize(abs(skinDet) * normal - skinGradient * ${relief.toFixed(5)});
    `);
  };
  material.customProgramCacheKey = () => `organic-${kind}-${relief}-${length}-v6`;
  return material;
}
