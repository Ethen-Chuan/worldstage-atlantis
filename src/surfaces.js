import * as THREE from 'three';

const textureSets = {};

export async function prepareSurfaces() {
  const loader = new THREE.TextureLoader();
  await Promise.all(['stone', 'rock'].map(async family => {
    textureSets[family] = {};
    await Promise.all(['color', 'normal', 'roughness'].map(async type => {
      const texture = await loader.loadAsync(`./textures/${family}-${type}.webp`);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      if (type === 'color') texture.colorSpace = THREE.SRGBColorSpace;
      textureSets[family][type] = texture;
    }));
  }));
}


export function makeMaterials(uniforms) {
  const material = (color, family = 'stone', scale = 0.065, extra = {}) => {
    const maps = textureSets[family];
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.025, map: maps.color, normalMap: maps.normal, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: maps.roughness, ...extra });
    result.onBeforeCompile = shader => {
      shader.uniforms.oceanTime = uniforms.time;
      shader.uniforms.oceanNight = uniforms.night;
      shader.uniforms.worldOffset = uniforms.offset;
      shader.vertexShader = 'uniform vec3 worldOffset; varying vec3 oceanPosition; varying vec3 oceanNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
        #include <project_vertex>
        vec4 absolutePosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          absolutePosition = instanceMatrix * absolutePosition;
        #endif
        oceanPosition = (modelMatrix * absolutePosition).xyz + worldOffset;
        oceanNormal = inverseTransformDirection(transformedNormal, viewMatrix);
      `);
      shader.fragmentShader = 'uniform float oceanTime; uniform float oceanNight; varying vec3 oceanPosition; varying vec3 oceanNormal; vec2 surfaceUV;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec3 orientation = abs(normalize(oceanNormal));
        surfaceUV = oceanPosition.xz * ${scale.toFixed(4)};
        if (orientation.z > orientation.x && orientation.z > orientation.y) surfaceUV = oceanPosition.xy * ${scale.toFixed(4)};
        else if (orientation.x > orientation.y) surfaceUV = oceanPosition.zy * ${scale.toFixed(4)};
        vec4 texel = texture2D(map, surfaceUV);
        diffuseColor *= texel;
        float weathering = texture2D(roughnessMap, surfaceUV * 0.23 + vec2(0.31,0.52)).r;
        float growth = smoothstep(0.42, 0.74, weathering + max(oceanNormal.y, 0.0) * 0.13);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.48, 0.64, 0.42), growth * 0.3);
        diffuseColor.rgb *= 0.84 + weathering * 0.42;
        vec2 waterUV = oceanPosition.xz * 0.28 + oceanPosition.y * 0.035;
        float waveA = sin(waterUV.x + sin(waterUV.y + oceanTime * 0.21) * 1.7);
        float waveB = sin(waterUV.y * 1.34 + cos(waterUV.x + oceanTime * 0.14) * 1.5);
        float caustic = pow(max(0.0, 1.0 - abs(waveA + waveB) * 0.5), 22.0);
        diffuseColor.rgb *= 1.0 + caustic * 0.65 * max(0.18, oceanNormal.y) * (1.0 - oceanNight);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replaceAll('vNormalMapUv', 'surfaceUV'));
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replaceAll('vNormalMapUv', 'surfaceUV'));
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replaceAll('vRoughnessMapUv', 'surfaceUV'));
    };
    result.customProgramCacheKey = () => `eroded-surface-v4-${scale}`;
    return result;
  };
  const plant = color => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.93, side: THREE.DoubleSide });
    result.onBeforeCompile = shader => {
      shader.uniforms.oceanTime = uniforms.time;
      shader.vertexShader = 'uniform float oceanTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float sway = sin(oceanTime * 0.52 + position.y * 0.6);
        transformed.x += sway * pow(max(position.y, 0.0), 1.25) * 0.035;
        transformed.z += cos(oceanTime * 0.35 + position.y * 0.4) * position.y * 0.018;
      `);
    };
    return result;
  };
  const coral = color => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.86, side: THREE.DoubleSide });
    result.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 coralSurface;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncoralSurface = position;');
      shader.fragmentShader = 'varying vec3 coralSurface;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float grain = fract(sin(dot(floor(coralSurface * 28.0), vec3(12.9, 47.7, 73.2))) * 43758.5);
        float ridges = sin(coralSurface.x * 19.0 + sin(coralSurface.z * 13.0) * 2.0) * sin(coralSurface.z * 23.0);
        diffuseColor.rgb *= 0.76 + grain * 0.23 + ridges * 0.11;
      `);
    };
    result.customProgramCacheKey = () => 'porous-coral-v4';
    return result;
  };
  return {
    stone: material('#c5beaa'),
    pale: material('#e1d8bf', 'stone', 0.09, { normalScale: new THREE.Vector2(0.4, 0.4) }),
    dark: material('#747e73', 'rock', 0.08),
    rock: material('#80968f', 'rock', 0.065, { normalScale: new THREE.Vector2(0.85, 0.85) }),
    sand: material('#bccfc2', 'rock', 0.13, { normalScale: new THREE.Vector2(0.22, 0.22) }),
    copper: material('#53877c', 'rock', 0.13, { metalness: 0.4, roughness: 0.72, normalScale: new THREE.Vector2(0.5, 0.5) }),
    gold: material('#ddbd78', 'rock', 0.23, { metalness: 0.48, roughness: 0.48, normalScale: new THREE.Vector2(0.3, 0.3) }),
    coral: coral('#c98156'),
    coralLight: coral('#d4b597'),
    coralPurple: coral('#796f9b'),
    coralRose: coral('#b76c62'),
    kelp: plant('#426945'),
    kelpDark: plant('#2b4940'),
    glow: new THREE.MeshStandardMaterial({ color: '#c1d9bd', emissive: '#97cbb0', emissiveIntensity: 2.2, roughness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: '#112d31', roughness: 1 }),
  };
}
