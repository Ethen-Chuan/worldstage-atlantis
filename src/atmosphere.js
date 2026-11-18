import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { seededRandom } from './core.js';

class ScatteringPass extends Pass {
  constructor(sourcePass) {
    super();
    this.uniforms = sourcePass.uniforms;
    this.sourceMaterial = sourcePass.material;
    this.scatteringTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.sourceQuad = new FullScreenQuad(this.sourceMaterial);
    this.composite = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, light: { value: this.scatteringTarget.texture } },
      vertexShader: 'varying vec2 screenUV;void main(){screenUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform sampler2D tDiffuse;uniform sampler2D light;varying vec2 screenUV;void main(){vec3 color=texture2D(tDiffuse,screenUV).rgb+texture2D(light,screenUV).rgb;gl_FragColor=vec4(color,1.0);}',
      depthTest: false,
      depthWrite: false,
    });
    this.compositeQuad = new FullScreenQuad(this.composite);
  }

  setSize(width, height) {
    this.scatteringTarget.setSize(Math.max(1, Math.round(width * 0.45)), Math.max(1, Math.round(height * 0.45)));
  }

  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.scatteringTarget);
    this.sourceQuad.render(renderer);
    this.composite.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.compositeQuad.render(renderer);
  }

  dispose() {
    this.scatteringTarget.dispose();
    this.sourceMaterial.dispose();
    this.composite.dispose();
    this.sourceQuad.dispose();
    this.compositeQuad.dispose();
  }
}

export function buildAtmosphere(scene, uniforms) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { night: uniforms.night, time: uniforms.time, skyTop: uniforms.skyTop, skyBottom: uniforms.skyBottom, skySun: uniforms.skySun },
    vertexShader: 'varying vec3 direction; void main(){ direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 direction; uniform float night; uniform float time; uniform vec3 skyTop; uniform vec3 skyBottom; uniform float skySun;
      void main(){
        vec3 dir = normalize(direction);
        float upper = smoothstep(-0.18, 0.8, dir.y);
        vec3 color = mix(skyBottom, skyTop, upper);
        vec3 sunDirection = normalize(vec3(-0.12, 0.8, -0.30));
        float sun = pow(max(0.0, dot(dir, sunDirection)), 14.0);
        float center = pow(max(0.0, dot(dir, sunDirection)), 150.0);
        float water = sin(dir.x * 85.0 + sin(dir.z * 79.0 + time * 0.18) * 3.0);
        water *= sin(dir.z * 64.0 + sin(dir.x * 41.0 - time * 0.11) * 2.0);
        color += (sun * vec3(0.34,0.37,0.24) + center * vec3(0.72,0.68,0.40)) * skySun;
        color += water * 0.018 * pow(max(dir.y, 0.0), 1.5);
        color *= mix(vec3(1.0), vec3(0.17,0.25,0.42), night);
        gl_FragColor = vec4(color, 1.0);
      }`,
  }));
  sky.userData.noAO = true;
  scene.add(sky);
  const random = seededRandom(8812);
  const points = [];
  const sizes = [];
  for (let index = 0; index < 2800; index++) {
    points.push((random() - 0.5) * 510, -16 + random() * 195, 240 - random() * 640);
    sizes.push(0.4 + random() * 1.7);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: uniforms.time },
    vertexShader: `attribute float size; uniform float time; varying float opacity;
      void main(){
        vec3 moved = position;
        moved.x += sin(time * 0.04 + position.y) * 2.5;
        moved.y += sin(time * 0.12 + position.x) * 2.3;
        vec4 projected = modelViewMatrix * vec4(moved, 1.0);
        gl_PointSize = clamp(size * 190.0 / -projected.z, 0.5, 4.5);
        opacity = min(0.24, 12.0 / -projected.z);
        gl_Position = projectionMatrix * projected;
      }`,
    fragmentShader: 'varying float opacity; void main(){ float circle = smoothstep(0.5,0.1,length(gl_PointCoord-0.5)); gl_FragColor=vec4(0.7,0.83,0.76,circle*opacity); }',
  });
  const snow = new THREE.Points(geometry, material);
  snow.name = 'drifting-marine-snow'; snow.userData.noAO = true;
  scene.add(snow); sky.userData.snow = snow;
  return sky;
}

export function waterScatteringPass(camera, uniforms, depthTexture) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      sceneDepth: { value: depthTexture },
      inverseProjection: { value: camera.projectionMatrixInverse },
      cameraWorld: { value: camera.matrixWorld },
      night: uniforms.night,
      time: uniforms.time,
      strength: { value: 2.55 },
      regionOrigin: { value: new THREE.Vector3() },
    },
    vertexShader: 'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D sceneDepth;
      uniform mat4 inverseProjection; uniform mat4 cameraWorld; uniform float time; uniform float night; uniform float strength; uniform vec3 regionOrigin; varying vec2 screenUV;
      float shafts(vec3 point){
        point -= regionOrigin;
        vec2 projected = point.xz + vec2(point.y * 0.48, point.y * -0.13);
        float spread = exp(-dot(projected - vec2(-2.0,-72.0), projected - vec2(-2.0,-72.0)) / 31000.0);
        float wave = sin(projected.x * 0.12 + sin(projected.y * 0.05 + time * 0.045) * 1.7);
        float secondary = sin(projected.x * 0.045 - projected.y * 0.035 + 1.8);
        float curtain = pow(max(0.0,wave),10.0) * 0.5 + pow(max(0.0,secondary),22.0) * 0.25;
        float fade = smoothstep(-32.0,22.0,point.y) * (1.0-smoothstep(210.0,280.0,point.y));
        return curtain * spread * fade;
      }
      void main(){
        vec3 color=vec3(0.0);
        float depth=texture2D(sceneDepth,screenUV).x;
        vec4 clip=vec4(screenUV*2.0-1.0,depth*2.0-1.0,1.0);
        vec4 cameraPoint=inverseProjection*clip;
        cameraPoint/=cameraPoint.w;
        vec3 eye=cameraWorld[3].xyz;
        vec3 world=(cameraWorld*cameraPoint).xyz;
        vec3 ray=normalize(world-eye);
        float distanceToSurface=min(length(world-eye),600.0);
        float stepLength=distanceToSurface/12.0;
        float scatter=0.0;
        for(int step=0;step<12;step++){
          float traveled=(float(step)+0.35)*stepLength;
          vec3 samplePoint=eye+ray*traveled;
          scatter+=shafts(samplePoint)*exp(-traveled*0.0035)*stepLength*0.0013;
        }
        float phase=0.55+pow(max(0.0,dot(ray,normalize(vec3(-0.45,1.0,-0.25)))),8.0)*0.8;
        color+=vec3(0.48,0.53,0.34)*scatter*phase*(1.0-night*0.91)*strength;
        vec2 center=screenUV-0.5;
        color*=1.0-dot(center*vec2(0.85,0.8),center)*0.44;
        color=pow(max(color,vec3(0.0)),vec3(1.025));
        gl_FragColor=vec4(color,1.0);
      }`,
  });
  pass.uniforms.inverseProjection.value = camera.projectionMatrixInverse;
  pass.uniforms.sceneDepth.value = depthTexture;
  pass.uniforms.cameraWorld.value = camera.matrixWorld;
  pass.uniforms.night = uniforms.night;
  pass.uniforms.time = uniforms.time;
  return new ScatteringPass(pass);
}
