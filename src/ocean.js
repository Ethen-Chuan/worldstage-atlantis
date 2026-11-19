import * as THREE from 'three';
import { SceneTap } from './scene-tap.js';
import { WhaleFall } from './whale-fall.js';
import { CollisionWorld } from './collision-world.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { buildAtmosphere, waterScatteringPass } from './atmosphere.js';
import { makeMaterials } from './surfaces.js';
import { buildReferenceAtlantis } from './sculptures.js';
import { CreationScene } from './creation-scene.js';
import { EndlessOcean } from './endless-ocean.js';
import { LandmarkScene } from './landmark-scene.js';
import { WonderScene } from './wonder-scene.js';
import { OceanEcology } from './ecology.js';
import { localLandmark } from './landmarks.js';
import { seaHeight } from './terrain.js';
import { createManta, createWhale, createJellies, createSchools } from './creatures.js';
import { buildBiomes } from './biomes.js';
import { PLACES, REGIONS, EVENTS } from './world.js';
import { clamp } from './core.js';
import { Embodiment } from './embodiment.js';
import { TidePlay } from './tide-play.js';
import { LIVING_ASSETS } from './creation.js';

class OceanOcclusionPass extends GTAOPass {
  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    this.depthFrames = (this.depthFrames || 0) + 1;
    const changed = !this.lastView || !this.lastView.equals(this.camera.matrixWorldInverse) || !this.lastProjection.equals(this.camera.projectionMatrix);
    this._renderGBuffer = changed || this.depthFrames % 6 === 0;
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    if (!this.lastView) {
      this.lastView = new THREE.Matrix4();
      this.lastProjection = new THREE.Matrix4();
    }
    this.lastView.copy(this.camera.matrixWorldInverse);
    this.lastProjection.copy(this.camera.projectionMatrix);
    this._renderGBuffer = true;
  }

  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse(object => {
      if (object.visible && (object.userData.noAO || object.material?.transparent)) {
        object.visible = false;
        this._visibilityCache.push(object);
      }
    });
  }
}

export class Ocean {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.time = 0;
    this.lifeTime = 0;
    this.paused = false;
    this.hidden = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.selected = 'manta';
    this.night = 0;
    this.flight = null;
    this.location = 'threshold';
    this.region = 'city';
    this.speed = 1;
    this.distances = { manta: 1, whale: 1, jelly: 1 };
    this.quality = 'balanced';
    this.pulses = [];
    this.worldOffset = new THREE.Vector3();
    this.movement = new Set();
    this.navigationVelocity = new THREE.Vector3();
    this.collisions = new CollisionWorld();
    this.cruising = false;
    this.travelTarget = null;
    this.uniforms = { time: { value: 0 }, offset: { value: this.worldOffset }, night: { value: 0 }, skyTop: { value: new THREE.Color().setRGB(0.075, 0.29, 0.32) }, skyBottom: { value: new THREE.Color().setRGB(0.012, 0.04, 0.055) }, skySun: { value: 1 } };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#092c3a');
    this.scene.fog = new THREE.FogExp2('#244e50', 0.0024);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.4, 1500);
    this.camera.position.fromArray(PLACES.threshold.position);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(this.quality === 'balanced' ? 1 : Math.min(Math.max(devicePixelRatio, 1.25), 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '可交互的亚特兰蒂斯三维场景，拖动环顾、滚轮靠近，也可用对话栏探索');
    this.renderer.domElement.setAttribute('tabindex', '0');
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.fromArray(PLACES.threshold.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.38;
    this.controls.zoomSpeed = 0.65;
    this.controls.panSpeed = 0.45;
    this.controls.minDistance = 2;
    this.controls.maxDistance = Infinity;
    this.controls.minPolarAngle = Math.PI * 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.maxTargetRadius = Infinity;
    this.controls.addEventListener('start', () => {
      this.travelTarget = null;
      if (this.flight) {
        this.flight = null;
        Object.values(this.creatures).forEach(creature => { if (creature.root.userData.mode === 'guide') creature.root.userData.mode = 'follow'; });
        this.callbacks.onFlightInterrupted?.();
      }
      this.callbacks.onExplore?.();
    });
    this.controls.update();
    this.hemisphere = new THREE.HemisphereLight('#82b9bd', '#101c22', 0.92);
    this.sun = new THREE.DirectionalLight('#fff0c8', 4.8);
    this.sun.position.set(-35, 230, 40);
    this.sun.target.position.set(0, 0, -115);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -220, right: 220, top: 250, bottom: -240, near: 2, far: 800 });
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.2;
    this.rim = new THREE.DirectionalLight('#3b8a9f', 1.65);
    this.rim.position.set(15, 100, -260);
    this.front = new THREE.DirectionalLight('#aec3b8', 0.9);
    this.front.position.set(70, 50, 200);
    this.scene.add(this.hemisphere, this.sun, this.sun.target, this.rim, this.front);
    this.materials = makeMaterials(this.uniforms);
    this.city = buildReferenceAtlantis(this.scene, this.materials);
    this.landmarks = new LandmarkScene(this.scene, this.materials);
    this.wonders = new WonderScene(this.scene, this.materials);
    this.ecology = new OceanEcology(this.scene);
    this.endless = new EndlessOcean(this.scene, this.materials);
    this.endless.update(this.camera.position, this.worldOffset, 0, 'arrival');
    this.creationScene = new CreationScene(this.scene, this.materials);
    this.sky = buildAtmosphere(this.scene, this.uniforms);
    this.biomes = null;
    this.creatures = { manta: createManta(), whale: createWhale(), jelly: createJellies() };
    Object.values(this.creatures).forEach(creature => this.scene.add(creature.root));
    Object.values(this.creatures).forEach(creature => { creature.root.visible = false; });
    this.updateFish = createSchools(this.city, this.collisions);
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.occlusion = new OceanOcclusionPass(this.scene, this.camera, 1, 1);
    this.occlusion.updateGtaoMaterial({ radius: 5.5, distanceExponent: 1.2, thickness: 1.7, distanceFallOff: 0.7, samples: 16, screenSpaceRadius: false });
    this.occlusion.blendIntensity = 0.48;
    this.composer.addPass(this.occlusion);
    this.scattering = waterScatteringPass(this.camera, this.uniforms, this.occlusion.depthTexture);
    this.composer.addPass(this.scattering);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.65, 1.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null }, grainTime: this.uniforms.time },
      vertexShader: 'varying vec2 screenUV; void main() { screenUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float grainTime; varying vec2 screenUV;
        void main() {
          vec3 color = texture2D(tDiffuse, screenUV).rgb;
          vec2 centered = screenUV - 0.5;
          float vignette = 1.0 - dot(centered * vec2(0.9, 0.75), centered) * 0.62;
          float grain = fract(sin(dot(screenUV + mod(grainTime, 13.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
          color *= vignette;
          color += grain * 0.002;
          gl_FragColor = vec4(color, 1.0);
        }`,
    }));
    this.composer.addPass(new OutputPass());
    this.antialias = new ShaderPass(FXAAShader);
    this.composer.addPass(this.antialias);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    const tap = new SceneTap();
    this.renderer.domElement.addEventListener('pointerdown', event => tap.down(event));
    this.renderer.domElement.addEventListener('pointermove', event => tap.move(event));
    this.renderer.domElement.addEventListener('pointercancel', event => tap.cancel(event));
    this.renderer.domElement.addEventListener('lostpointercapture', event => tap.cancel(event));
    this.renderer.domElement.addEventListener('pointerup', event => {
      if (!tap.up(event)) return;
      const bounds = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const candidate = this.embodiment.pick(this.raycaster);
      if (candidate) {
        if (candidate.id) this.callbacks.onCreationSelect?.(candidate.id);
        else if (!candidate.living) this.callbacks.onAnchor?.(candidate.point.toArray());
        this.callbacks.onObjectInspect?.(candidate);
        return;
      }
      if (this.region === 'city') {
        const hits = this.raycaster.intersectObjects([...this.creationScene.objects.values()].map(entry => entry.root), true);
        if (hits.length) {
          let object = hits[0].object;
          while (object && !object.userData.creationId) object = object.parent;
          if (object) this.callbacks.onCreationSelect?.(object.userData.creationId);
        } else {
          const groundHits = this.raycaster.intersectObjects([...this.endless.chunks.values()].map(tile => tile.ground), false);
          if (groundHits.length && groundHits[0].distance < 250) this.callbacks.onAnchor?.(groundHits[0].point.clone().add(this.worldOffset).toArray());
        }
        return;
      }
      const hits = this.raycaster.intersectObjects(Object.values(this.creatures).map(creature => creature.root), true);
      if (hits.length) {
        let object = hits[0].object;
        while (object && !object.userData.creature) object = object.parent;
        if (object) this.callbacks.onSelect?.(object.userData.creature);
      }
    });
    this.renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); this.paused = true; this.callbacks.onError?.('图形上下文已中断，请刷新页面恢复。'); });
    this.lastFrame = performance.now();
    this.embodiment = new Embodiment(this);
    this.play = new TidePlay(this, callbacks.sound || { ritual() {}, note() {}, setIntensity() {}, stopChant() {} });
    this.whaleFall = new WhaleFall(this, callbacks.sound);
    this.lastUI = 0;
    this.frames = 0;
    this.frameStart = performance.now();
    this.loop = this.loop.bind(this);
    this.renderer.setAnimationLoop(this.loop);
  }


  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.fov = width < 700 ? 62 : 46;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.occlusion.setSize(Math.round(width * 0.55), Math.round(height * 0.55));
    this.occlusion.lastView = null;
    this.antialias.uniforms.resolution.value.set(1 / (width * this.renderer.getPixelRatio()), 1 / (height * this.renderer.getPixelRatio()));
  }

  setQuality(quality) {
    if (!['high', 'balanced', 'performance'].includes(quality)) return;
    this.quality = quality;
    const ratio = quality === 'high' ? Math.min(Math.max(devicePixelRatio, 1.25), 1.75) : quality === 'balanced' ? 1 : 0.85;
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.occlusion.blendIntensity = quality === 'performance' ? 0.25 : 0.48;
    this.occlusion.updateGtaoMaterial({ samples: quality === 'high' ? 24 : quality === 'balanced' ? 12 : 6 });
    this.resize();
  }

  syncCreation(state, instant = false) {
    this.creationScene.sync(state, instant);
    this.creationLighting = state.lighting;
    this.night = state.lighting === 'moonlit' ? 1 : 0;
    this.renderer.shadowMap.needsUpdate = true;
    this.occlusion.lastView = null;
  }

  focusCreation(id) {
    const entry = this.creationScene.objects.get(id);
    if (!entry) return;
    this.flight = null;
    this.travelTarget = null;
    this.cruising = false;
    const radius = Math.max(entry.size.x, entry.size.y) * entry.currentScale;
    const center = entry.root.position.clone().add(new THREE.Vector3(0, entry.size.y * entry.currentScale * 0.42, 0));
    const position = center.clone().add(new THREE.Vector3(radius * 0.55 + 14, radius * 0.16 + 5, radius * 1.6 + 18)).add(this.worldOffset);
    this.travelTo(position.toArray(), center.add(this.worldOffset).toArray());
  }

  worldPosition() { return this.camera.position.clone().add(this.worldOffset); }

  travelTo(point, target = null) {
    this.cruising = false;
    this.movement.clear();
    this.navigationVelocity.set(0, 0, 0);
    this.travelTarget = new THREE.Vector3(...point);
    this.travelOrigin = this.worldPosition();
    this.travelOriginLook = this.controls.target.clone().add(this.worldOffset);
    this.travelLook = target ? new THREE.Vector3(...target) : this.travelOriginLook.clone().add(this.travelTarget.clone().sub(this.travelOrigin));
    this.travelElapsed = 0;
    this.travelDuration = Math.max(1.8, Math.min(24, this.travelOrigin.distanceTo(this.travelTarget) / 64));
  }

  restoreView(view) {
    this.travelTarget = null;
    this.flight = null;
    this.cruising = false;
    this.movement.clear();
    this.navigationVelocity.set(0, 0, 0);
    this.controls.enableDamping = false; this.controls.update();
    this.worldOffset.set(0, 0, 0);
    this.camera.position.fromArray(view.position);
    this.controls.target.fromArray(view.target);
    this.controls.cursor.set(0, 0, 0);
    this.controls.update();
    this.controls.enableDamping = true;
    this.updateTravel(0);
    this.renderer.shadowMap.needsUpdate = true;
    this.occlusion.lastView = null;
  }

  captureView() { return { position: this.worldPosition().toArray(), target: this.controls.target.clone().add(this.worldOffset).toArray() }; }

  prepareDestination(landmark) {
    this.landmarks.prepare(landmark.id);
    if (landmark.wonder && !this.wonders.entries.has(landmark.id)) this.wonders.build(landmark);
  }

  jumpTo(landmark) {
    const displacement = new THREE.Vector3(...landmark.camera).sub(this.worldPosition());
    this.creationScene.displaceFollowing(displacement);
    this.restoreView({ position: landmark.camera, target: landmark.target });
    this.endless.update(this.worldPosition(), this.worldOffset, this.time, 'arrival');
    this.creationScene.update(0, this.reduced, { position: this.worldPosition(), forward: this.camera.getWorldDirection(new THREE.Vector3()) });
    this.instantLighting = true;
  }

  updateTravel(delta) {
    const global = this.worldPosition();
    const forward = this.camera.getWorldDirection(new THREE.Vector3()); forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const velocity = new THREE.Vector3();
    if (this.travelTarget) {
      this.travelElapsed += delta;
      const progress = Math.min(1, this.travelElapsed / this.travelDuration);
      const eased = progress * progress * (3 - 2 * progress);
      this.camera.position.lerpVectors(this.travelOrigin, this.travelTarget, eased).sub(this.worldOffset);
      this.camera.position.y += Math.sin(progress * Math.PI) * Math.min(22, this.travelDuration);
      this.controls.target.lerpVectors(this.travelOriginLook, this.travelLook, eased).sub(this.worldOffset);
      if (progress === 1) { this.travelTarget = null; this.callbacks.onTravelArrive?.(); }
    } else if (!this.embodiment?.active) {
      if (this.cruising || this.movement.has('forward')) velocity.addScaledVector(forward, 30);
      if (this.movement.has('back')) velocity.addScaledVector(forward, -30);
      if (this.movement.has('left')) velocity.addScaledVector(right, -25);
      if (this.movement.has('right')) velocity.addScaledVector(right, 25);
      if (this.movement.has('up')) velocity.y += 18;
      if (this.movement.has('down')) velocity.y -= 18;
      if (this.movement.has('fast')) velocity.multiplyScalar(2.5);
    }
    this.navigationVelocity.lerp(velocity, 1 - Math.exp(-delta * 8));
    velocity.copy(this.navigationVelocity).multiplyScalar(delta); this.camera.position.add(velocity); this.controls.target.add(velocity);
    if (!this.embodiment?.active && global.distanceToSquared(this.worldPosition()) > 0) {
      const desired = this.worldPosition(); const safe = this.collisions.move(global, desired, { radius: 2 });
      const correction = safe.sub(desired); this.camera.position.add(correction); this.controls.target.add(correction);
      if (this.travelTarget && correction.lengthSq() > 0.25) { this.travelTarget = null; this.callbacks.onError?.('前方有实体阻挡，已停下航行；可以上浮绕行，或在海图选择快速抵达。'); }
    }
    const arrived = this.worldPosition();
    const floor = seaHeight(arrived.x, arrived.z) + 5 - this.worldOffset.y;
    if (this.camera.position.y < floor) { const correction = floor - this.camera.position.y; this.camera.position.y += correction; this.controls.target.y += correction; }
    if (Math.hypot(this.camera.position.x, this.camera.position.z) > 960) {
      const shift = new THREE.Vector3(Math.round(this.camera.position.x / 240) * 240, 0, Math.round(this.camera.position.z / 240) * 240);
      this.worldOffset.add(shift); this.camera.position.sub(shift); this.controls.target.sub(shift); this.controls.cursor.sub(shift);
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.city.position.copy(this.worldOffset).multiplyScalar(-1);
    this.city.visible = Math.hypot(arrived.x, arrived.z + 100) < 820;
    this.creationScene.offset.copy(this.worldOffset);
    for (const entry of this.creationScene.objects.values()) entry.root.visible = entry.item.following || entry.followPosition.distanceTo(arrived) < 900;
    this.currentBiome = this.endless.update(this.worldPosition(), this.worldOffset, this.time);
    this.currentLandmark = localLandmark(arrived.toArray());
    this.landmarks.update(arrived, this.worldOffset, this.time, delta);
    this.wonders.collisions = this.collisions;
    this.wonders.update(arrived, this.worldOffset, this.time, delta);
    this.ecology.protectedActor = this.embodiment?.active;
    this.ecology.collisions = this.collisions;
    this.ecology.update(arrived, this.worldOffset, this.time, delta);
    const lightCenter = this.camera.position.clone();
    this.sun.position.copy(lightCenter).add(new THREE.Vector3(-35, 230, -70)); this.sun.target.position.copy(lightCenter).add(new THREE.Vector3(0, -20, -120));
    this.rim.position.copy(lightCenter).add(new THREE.Vector3(20, 80, -260)); this.front.position.copy(lightCenter).add(new THREE.Vector3(70, 50, 120));
    this.scattering.uniforms.regionOrigin.value.copy(lightCenter).add(new THREE.Vector3(0, -26, -174));
    if ((velocity.lengthSq() > 0.001 || this.travelTarget) && this.frames % 15 === 0) this.renderer.shadowMap.needsUpdate = true;
  }

  select(creature) {
    if (this.creatures[creature]) this.selected = creature;
  }

  nearCamera(creature, distanceMultiplier = 1) {
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const distance = (creature === 'whale' ? 88 : creature === 'jelly' ? 25 : 24) * distanceMultiplier * this.distances[creature];
    return this.camera.position.clone().addScaledVector(forward, distance).addScaledVector(right, creature === 'whale' ? 7 : -3).add(new THREE.Vector3(0, creature === 'whale' ? 11 : creature === 'manta' ? -4.5 : 0, 0));
  }

  flyTo(destination, creature = 'manta', duration = 12) {
    const place = PLACES[destination];
    if (!place) return;
    const crossRegion = place.region !== this.region;
    if (crossRegion) {
      this.setRegion(place.region, destination);
      this.camera.position.fromArray(place.position).add(new THREE.Vector3(place.region === 'trench' ? 10 : 30, 13, 50));
      this.controls.target.fromArray(place.target);
      this.controls.update();
      Object.keys(this.creatures).forEach(name => {
        const root = this.creatures[name].root;
        const ambient = { manta: [-32, 24, 56], whale: [-36, 86, -60], jelly: [32, 19, 40] };
        if (name === creature) root.position.copy(this.nearCamera(name, 1.35));
        else root.position.fromArray(REGIONS[place.region].origin).add(new THREE.Vector3(...ambient[name]));
        root.userData.moveTarget.copy(root.position);
        root.userData.basePosition.copy(root.position);
        root.userData.mode = name === creature ? 'follow' : 'idle';
      });
      this.callbacks.onRegionChange?.(place.region, destination);
    }
    this.flight = { elapsed: 0, duration: this.reduced ? 2 : duration, origin: this.camera.position.clone(), originTarget: this.controls.target.clone(), destination: new THREE.Vector3(...place.position), target: new THREE.Vector3(...place.target), name: destination, creature };
    if (!crossRegion && destination === 'sanctuary' && this.camera.position.z > 20) {
      this.flight.path = new THREE.CatmullRomCurve3([this.camera.position.clone(), new THREE.Vector3(-10, 28, 98), new THREE.Vector3(-19, 28, 27), new THREE.Vector3(4, 32, -33), new THREE.Vector3(...place.position)], false, 'centripetal');
    }
    if (!crossRegion && destination === 'threshold' && this.camera.position.z < 10) {
      this.flight.path = new THREE.CatmullRomCurve3([this.camera.position.clone(), new THREE.Vector3(4, 32, -33), new THREE.Vector3(-19, 28, 27), new THREE.Vector3(-10, 28, 98), new THREE.Vector3(...place.position)], false, 'centripetal');
    }
    this.creatures[creature].root.userData.mode = 'guide';
  }

  setRegion(region, destination) {
    this.region = region;
    this.location = destination;
    this.city.visible = region === 'city';
    this.creationScene.root.visible = region === 'city';
    Object.values(this.creatures).forEach(creature => { creature.root.visible = region !== 'city'; });
    this.biomes ||= buildBiomes(this.scene, this.materials, this.uniforms);
    this.biomes.setRegion(region);
    const origin = new THREE.Vector3(...REGIONS[region].origin);
    this.controls.cursor.copy(origin);
    this.sun.position.copy(origin).add(new THREE.Vector3(-35, 230, 40));
    this.sun.target.position.copy(origin).add(new THREE.Vector3(0, 0, -115));
    this.rim.position.copy(origin).add(new THREE.Vector3(15, 100, -260));
    this.front.position.copy(origin).add(new THREE.Vector3(70, 50, 200));
    this.scattering.uniforms.regionOrigin.value.copy(origin);
    const skyColors = { city: [[0.075, 0.29, 0.32], [0.012, 0.04, 0.055], 1, 3.8], reef: [[0.09, 0.36, 0.35], [0.02, 0.07, 0.065], 1.15, 3.1], garden: [[0.025, 0.085, 0.145], [0.006, 0.014, 0.033], 0.22, 0.9], trench: [[0.018, 0.065, 0.09], [0.004, 0.012, 0.018], 0.2, 1.15] };
    const sky = skyColors[region];
    this.uniforms.skyTop.value.setRGB(...sky[0]);
    this.uniforms.skyBottom.value.setRGB(...sky[1]);
    this.uniforms.skySun.value = sky[2];
    this.scattering.uniforms.strength.value = sky[3];
    this.scene.fog.density = REGIONS[region].density;
    this.occlusion.lastView = null;
    this.renderer.shadowMap.needsUpdate = true;
  }

  apply(actions, state) {
    this.biomes ||= buildBiomes(this.scene, this.materials, this.uniforms);
    this.distances = { ...state.distances };
    this.speed = state.speed;
    this.night = state.mood === 'night' ? 1 : 0;
    this.creatures.jelly.setGlow(state.glow);
    this.creatures.jelly.setColor(state.jellyColor);
    this.biomes.setColor(state.jellyColor);
    for (const action of actions) {
      const root = this.creatures[action.creature].root;
      if (['distance', 'circle', 'follow'].includes(action.kind)) {
        if (action.kind !== 'distance' || !['guide', 'follow', 'circle'].includes(root.userData.mode)) root.userData.mode = action.kind === 'distance' ? 'approach' : action.kind;
        root.userData.moveTarget.copy(this.nearCamera(action.creature));
        root.userData.actionStart = this.time;
      }
      if (action.kind === 'guide') this.flyTo(action.destination, action.creature, PLACES[action.destination].region === this.region ? 12 : 7);
      if (action.kind === 'stop') {
        this.flight = null;
        Object.values(this.creatures).forEach(entity => {
          entity.root.userData.mode = 'stop';
          entity.root.userData.moveTarget.copy(entity.root.position);
        });
      }
      if (action.kind === 'glow' || action.kind === 'color') {
        if (this.creatures.jelly.root.userData.mode === 'idle') this.creatures.jelly.root.userData.mode = 'approach';
        this.creatures.jelly.root.userData.moveTarget.copy(this.nearCamera('jelly'));
      }
      if (action.kind === 'event') {
        this.biomes.setEvent(action.event, action.value);
        if (['crown', 'bells', 'wreck'].includes(action.event)) this.pulse(this.biomes.eventPosition(action.event), 3);
      }
      if (action.kind === 'sing' || ['identity', 'memory', 'story'].includes(action.kind)) this.pulse(root.position, action.kind === 'sing' ? 3 : 1);
    }
    this.select(state.selected);
  }

  pulse(position, count) {
    for (let index = 0; index < count; index++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.016, 4, 96), new THREE.MeshBasicMaterial({ color: '#c4d7c6', transparent: true, opacity: 0.3, depthWrite: false }));
      ring.position.copy(position);
      ring.lookAt(this.camera.position);
      this.scene.add(ring);
      this.pulses.push({ mesh: ring, start: this.time + index * 0.9 });
    }
  }

  updateCreatures(delta) {
    for (const [name, creature] of Object.entries(this.creatures)) {
      const root = creature.root;
      const data = root.userData;
      let destination = data.moveTarget.clone();
      if (data.mode === 'idle') {
        destination.copy(data.basePosition);
        if (name === 'manta') destination.add(new THREE.Vector3(Math.sin(this.time * 0.14) * 5, Math.sin(this.time * 0.45), Math.sin(this.time * 0.1) * 3));
        if (name === 'whale') destination.add(new THREE.Vector3(Math.sin(this.time * 0.038) * 22, Math.sin(this.time * 0.15) * 2, Math.sin(this.time * 0.045) * 13));
      }
      if (data.mode === 'follow' || data.mode === 'guide') destination.copy(this.nearCamera(name, data.mode === 'guide' ? 1.35 : 1));
      if (data.mode === 'circle') {
        const angle = (this.time - data.actionStart) * 0.32;
        const center = this.nearCamera(name, 1.2);
        destination.copy(center).add(new THREE.Vector3(Math.sin(angle) * 12, Math.sin(angle * 0.7) * 2, Math.cos(angle) * 8));
      }
      const previous = root.position.clone();
      root.position.lerp(destination, 1 - Math.exp(-delta * this.speed * (name === 'whale' ? 0.37 : 0.65)));
      const velocity = root.position.clone().sub(previous);
      if (name !== 'jelly' && data.mode !== 'stop') {
        let targetYaw;
        if (['approach', 'follow'].includes(data.mode) && velocity.length() < 0.04) {
          const toward = this.camera.position.clone().sub(root.position);
          targetYaw = Math.atan2(-toward.x, -toward.z);
        } else if (data.mode === 'idle') targetYaw = name === 'whale' ? -1.15 + Math.sin(this.time * 0.06) * 0.2 : -0.5 + Math.sin(this.time * 0.12) * 0.55;
        else targetYaw = Math.atan2(-velocity.x, -velocity.z);
        const difference = Math.atan2(Math.sin(targetYaw - root.rotation.y), Math.cos(targetYaw - root.rotation.y));
        root.rotation.y += difference * Math.min(1, delta * 1.2);
        root.rotation.z = THREE.MathUtils.damp(root.rotation.z, clamp(difference * -0.13, -0.22, 0.22), 1, delta);
        if (name === 'manta') root.rotation.x = Math.sin(this.time * 0.45) * 0.085 + (data.mode === 'approach' ? 0.1 : 0);
      }
      creature.animate(name === 'jelly' ? this.time : this.lifeTime, delta);
    }
  }

  loop(now) {
    const realDelta = Math.max(0, Math.min((now - this.lastFrame) / 1000, 0.25));
    this.lastFrame = now;
    if (document.hidden) return;
    const delta = this.paused ? 0 : realDelta * (this.reduced ? 0.5 : 1);
    this.time += delta;
    this.lifeTime += delta * this.speed;
    this.uniforms.time.value = this.time;
    this.uniforms.night.value = THREE.MathUtils.damp(this.uniforms.night.value, this.night, 0.9, delta);
    const night = this.uniforms.night.value;
    this.embodiment.beforeSimulation();
    this.updateTravel(delta);
    const ambientNocturne = this.currentLandmark?.nocturne ?? (this.currentLandmark?.id === 'choir' ? 1 : this.currentBiome?.id === 'garden' ? 0.55 : 0);
    const ceremonyAge = this.play?.show ? this.time - this.play.show.start : -1;
    const ceremonyFade = this.play?.show?.ending != null ? 1 - THREE.MathUtils.smoothstep(this.time - this.play.show.ending, 0, 2.5) : 1;
    const ceremonyShade = ceremonyAge >= 0 ? THREE.MathUtils.smoothstep(ceremonyAge, 0, 5) * (1 - THREE.MathUtils.smoothstep(ceremonyAge, 28, 36)) * 0.16 * ceremonyFade : 0;
    const nocturne = Math.max(ambientNocturne, ceremonyShade);
    const transition = this.instantLighting ? 1 : 1 - Math.exp(-realDelta * 0.7);
    this.instantLighting = false;
    this.sun.intensity = THREE.MathUtils.lerp(this.sun.intensity, (5.2 - nocturne * 3.4) * (1 - night * 0.84), transition);
    this.sun.color.lerp(new THREE.Color(this.creationLighting === 'golden' ? '#ffd18e' : nocturne ? '#90b9d4' : '#fff0cf'), transition);
    this.hemisphere.intensity = THREE.MathUtils.lerp(this.hemisphere.intensity, 1.05 - nocturne * 0.4 - night * 0.4, transition);
    this.uniforms.skyTop.value.lerp(new THREE.Color().setRGB(0.075 - nocturne * 0.06, 0.29 - nocturne * 0.23, 0.32 - nocturne * 0.21), transition);
    this.uniforms.skyBottom.value.lerp(new THREE.Color().setRGB(0.012 - nocturne * 0.007, 0.04 - nocturne * 0.025, 0.055 - nocturne * 0.025), transition);
    this.uniforms.skySun.value = THREE.MathUtils.lerp(this.uniforms.skySun.value, 1 - nocturne * 0.83, transition);
    this.scattering.uniforms.strength.value = THREE.MathUtils.lerp(this.scattering.uniforms.strength.value, 1.85 - nocturne * 1.4, transition);
    this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, 0.003 + nocturne * 0.001, transition);
    this.scene.fog.color.lerp(new THREE.Color(this.currentLandmark?.color || this.currentBiome?.color || '#21484c').lerp(new THREE.Color('#071d32'), night), transition);
    this.sky.position.copy(this.camera.position);
    this.sky.userData.snow?.position.copy(this.camera.position);
    if (this.flight && delta > 0) {
      const flight = this.flight;
      flight.elapsed += delta * this.speed;
      const progress = Math.min(flight.elapsed / flight.duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      if (flight.path) this.camera.position.copy(flight.path.getPointAt(eased));
      else this.camera.position.lerpVectors(flight.origin, flight.destination, eased);
      this.camera.position.y += Math.sin(progress * Math.PI) * 3;
      this.controls.target.lerpVectors(flight.originTarget, flight.target, eased);
      if (progress === 1) {
        this.location = flight.name;
        this.creatures[flight.creature].root.userData.mode = 'follow';
        this.flight = null;
        this.callbacks.onArrive?.(this.location);
      }
    }
    this.creationScene.update(delta, this.reduced, { position: this.worldPosition(), forward: this.camera.getWorldDirection(new THREE.Vector3()) });
    if (delta > 0) {
      if (this.city.visible) this.updateFish(this.time);
      for (let index = this.pulses.length - 1; index >= 0; index--) {
        const pulse = this.pulses[index];
        const age = this.time - pulse.start;
        pulse.mesh.visible = age >= 0;
        pulse.mesh.scale.setScalar(Math.max(0.1, 2 + age * 9));
        pulse.mesh.material.opacity = Math.max(0, 0.27 * (1 - age / 4));
        if (age > 4) {
          this.scene.remove(pulse.mesh);
          pulse.mesh.geometry.dispose();
          pulse.mesh.material.dispose();
          this.pulses.splice(index, 1);
        }
      }
    }
    const active = this.embodiment.active;
    const actors = [...this.creationScene.objects.values()].filter(entry => LIVING_ASSETS.includes(entry.item.asset) && !['shoal', 'jelly'].includes(entry.item.asset)).map(entry => ({ root: entry.root, shape: entry.shape, species: entry.item.asset, entry }));
    for (const animal of this.ecology.animals) actors.push({ root: animal.root, shape: animal.root, species: animal.kind });
    actors.push({ root: this.ecology.ancient.root, shape: this.ecology.ancient.root, species: 'ancient' });
    for (const [species, animal] of Object.entries(this.creatures)) actors.push({ root: animal.root, shape: animal.root, species });
    for (const entry of [...this.landmarks.entries, ...this.wonders.entries.values()]) entry.root.traverseVisible(root => {
      if (root.userData.creature && !root.isInstancedMesh) actors.push({ root, shape: root, species: root.userData.creature });
    });
    if (active?.living && !actors.some(actor => actor.root === active.root)) actors.push(active);
    if (this.whaleFall.active && this.whaleFall.whale.root.visible) actors.push({ root: this.whaleFall.whale.root, species: 'whale', kinematic: true });
    this.collisions.rebuild([this.city, this.creationScene.root, this.ecology.root, ...this.landmarks.entries.map(entry => entry.root), ...[...this.wonders.entries.values()].map(entry => entry.root), ...[...this.endless.chunks.values()].map(entry => entry.root)], this.worldOffset);
    this.collisions.beginBodies(actors, this.worldOffset, active ? { ...active, position: this.embodiment.position, hull: this.embodiment.collisionHull } : null);
    for (const actor of actors) {
      if (actor.kinematic || active?.root === actor.root || active?.root === actor.shape) continue;
      const safe = this.collisions.natural(actor, this.worldOffset, delta);
      if (safe && actor.entry) { actor.entry.followPosition.copy(safe); actor.entry.followPosition.y -= actor.entry.currentHeight; }
      const predator = this.ecology.foodWeb.predators.get(actor.root);
      if (safe && predator) predator.position.copy(actor.root.position);
    }
    this.embodiment.update(delta);
    this.play.update(delta);
    this.whaleFall.update(delta);
    const beforeOrbit = this.worldPosition();
    if (!this.paused) this.controls.update(delta);
    if (!this.embodiment.blend && (!active?.living || !this.embodiment.firstPerson)) {
      const desired = this.worldPosition();
      const safe = this.collisions.move(beforeOrbit, desired, { radius: 1.2, ignore: active?.root });
      this.camera.position.copy(safe).sub(this.worldOffset);
    }
    this.renderer.info.reset();
    this.composer.render();
    this.frames++;
    if (now - this.lastUI > 120) {
      const position = this.creatures[this.selected].root.position.clone().add(new THREE.Vector3(0, this.selected === 'whale' ? 7 : 2.4, 0));
      const projected = position.project(this.camera);
      const forward = this.camera.getWorldDirection(new THREE.Vector3());
      const visible = this.creatures[this.selected].root.position.clone().sub(this.camera.position).dot(forward) > 0 && Math.abs(projected.x) < 0.85 && Math.abs(projected.y) < 0.68 && projected.z < 1;
      const hotspots = Object.entries(EVENTS).filter(([, event]) => event.region === this.region).map(([id, event]) => {
        const point = new THREE.Vector3(...event.position).project(this.camera);
        return { id, x: (point.x * 0.5 + 0.5) * this.container.clientWidth, y: (-point.y * 0.5 + 0.5) * this.container.clientHeight, visible: point.z > -1 && point.z < 1 && Math.abs(point.x) < 0.76 && Math.abs(point.y) < 0.7 };
      });
      this.callbacks.onFrame?.({ marker: { x: (projected.x * 0.5 + 0.5) * this.container.clientWidth, y: (-projected.y * 0.5 + 0.5) * this.container.clientHeight, visible }, hotspots, depth: Math.max(1, Math.round(REGIONS[this.region].depth - this.camera.position.y)), flight: this.flight ? Math.round(this.flight.elapsed / this.flight.duration * 100) : null });
      this.lastUI = now;
    }
    if (now - this.frameStart > 2500) {
      const fps = this.frames / ((now - this.frameStart) / 1000);
      this.lastFPS = Math.round(fps);
      this.callbacks.onPerformance?.(Math.round(fps));
      this.frames = 0;
      this.frameStart = now;
    }
  }

  snapshot() {
    this.composer.render();
    return new Promise(resolve => this.renderer.domElement.toBlob(resolve, 'image/png'));
  }

  inspect() {
    return { collisions: this.collisions.inspect(), whaleFall: this.whaleFall.inspect(), time: this.time, paused: this.paused, selected: this.selected, night: this.uniforms.night.value, flight: this.flight?.name || null, location: this.location, region: this.region, speed: this.speed, distances: { ...this.distances }, world: this.biomes?.inspect() || { region: 'city', events: {} }, ecology: this.ecology.inspect(), wonders: this.wonders.inspect(), creation: this.creationScene.inspect(), quality: this.quality, pixelRatio: this.renderer.getPixelRatio(), camera: this.camera.position.toArray(), creatures: Object.fromEntries(Object.entries(this.creatures).map(([key, value]) => [key, { position: value.root.position.toArray(), mode: value.root.userData.mode }])), drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, memory: { ...this.renderer.info.memory }, fps: this.lastFPS || null };
  }
}
