import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './core.js';
import { REGIONS, EVENTS } from './world.js';

const LIGHT_COLORS = { pearl: '#c9e5df', rose: '#ec9eaf', blue: '#7bbfe9', gold: '#eac785' };

export function buildBiomes(scene, materials, uniforms) {
  const groups = {};
  const animated = [];
  const eventState = {};
  const eventMeshes = {};
  const transform = new THREE.Object3D();
  const rockGeometry = new THREE.IcosahedronGeometry(1, 2);
  const rockPositions = rockGeometry.attributes.position;
  for (let index = 0; index < rockPositions.count; index++) {
    const horizontal = rockPositions.getX(index);
    const elevation = rockPositions.getY(index);
    const depth = rockPositions.getZ(index);
    const distort = 1 + Math.sin(horizontal * 7 + elevation * 3) * 0.12 + Math.sin(depth * 8 - elevation * 6) * 0.09;
    rockPositions.setXYZ(index, horizontal * distort, elevation * distort, depth * distort);
  }
  rockGeometry.computeVertexNormals();
  const coralColors = ['#bf7355', '#cba16a', '#a26081', '#639487', '#a1b47c'];
  const coralBloom = { value: 0 };
  const coralMaterials = coralColors.map(color => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03, side: THREE.DoubleSide });
    material.onBeforeCompile = shader => {
      shader.uniforms.coralBloom = coralBloom;
      shader.vertexShader = 'uniform float coralBloom; varying vec3 coralPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncoralPosition=position; transformed *= 1.0 + coralBloom * 0.08;');
      shader.fragmentShader = 'uniform float coralBloom; varying vec3 coralPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float angle = atan(coralPosition.x, coralPosition.z);
        float ridge = sin(angle * 120.0 + length(coralPosition.xz) * 13.0);
        float polyps = sin(coralPosition.x * 170.0) * sin(coralPosition.z * 170.0);
        diffuseColor.rgb *= 0.66 + ridge * 0.12 + polyps * 0.12;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74,0.61,0.41), smoothstep(0.9,1.0,length(coralPosition.xz)) * 0.2);
        diffuseColor.rgb *= 1.0 + coralBloom * 0.6;
      `);
    };
    return material;
  });
  const basalt = new THREE.MeshStandardMaterial({ color: '#253e43', roughness: 0.9, map: materials.rock.map, normalMap: materials.rock.normalMap, normalScale: new THREE.Vector2(1.6, 1.6) });
  const timber = new THREE.MeshStandardMaterial({ color: '#6c6d57', roughness: 0.9, map: materials.stone.map, normalMap: materials.stone.normalMap });
  const glowMaterial = new THREE.MeshStandardMaterial({ color: '#bdd3bc', emissive: '#88c4b9', emissiveIntensity: 1.6, roughness: 0.6 });
  const crownMaterial = new THREE.MeshBasicMaterial({ color: '#e0d2aa', transparent: true, opacity: 0.06, depthWrite: false });

  function mesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.scale.set(...scale);
    object.rotation.set(...rotation);
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function instances(parent, geometry, material, rows) {
    const object = new THREE.InstancedMesh(geometry, material, rows.length);
    rows.forEach((row, index) => {
      transform.position.set(...row.position);
      transform.scale.set(...(row.scale || [1, 1, 1]));
      transform.rotation.set(...(row.rotation || [0, 0, 0]));
      transform.updateMatrix();
      object.setMatrixAt(index, transform.matrix);
    });
    object.computeBoundingSphere();
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function tube(parent, points, radius, material, segments = 32) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), segments, radius, 6, false), material);
  }
  function land(parent, random, floor = -9, ruggedness = 5) {
    const geometry = new THREE.PlaneGeometry(700, 660, 70, 66);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const horizontal = positions.getX(index);
      const depth = positions.getZ(index);
      positions.setY(index, floor + Math.sin(horizontal * 0.026) * Math.cos(depth * 0.035) * ruggedness + Math.sin(horizontal * 0.11 + depth * 0.075) * 0.9);
    }
    geometry.computeVertexNormals();
    mesh(parent, geometry, materials.sand);
    const rows = [];
    for (let index = 0; index < 90; index++) {
      const size = 3 + random() * 13;
      rows.push({ position: [(random() - 0.5) * 410, floor + random() * 3, (random() - 0.5) * 340], scale: [size * 1.8, size * 0.7, size], rotation: [random(), random() * 6, random()] });
    }
    instances(parent, rockGeometry, materials.rock, rows);
  }
  for (const [key, region] of Object.entries(REGIONS)) {
    const group = new THREE.Group();
    group.name = region.name;
    group.position.set(...region.origin);
    group.visible = key === 'city';
    scene.add(group);
    groups[key] = group;
  }

  const city = groups.city;
  const crown = new THREE.Group();
  crown.position.set(18, 78, -196);
  city.add(crown);
  for (let layer = 0; layer < 3; layer++) {
    const ring = mesh(crown, new THREE.TorusGeometry(67 - layer * 1.3, 0.075, 4, 180, Math.PI * 1.8), crownMaterial);
    ring.rotation.z = layer * 0.6;
  }
  const glyphs = [];
  for (let index = 0; index < 48; index++) {
    const angle = index / 48 * Math.PI * 2;
    glyphs.push({ position: [Math.cos(angle) * 64, Math.sin(angle) * 64, 0], scale: [0.65, 1.6, 0.15], rotation: [0, 0, angle] });
  }
  instances(crown, new THREE.BoxGeometry(1, 1, 1), crownMaterial, glyphs);
  eventMeshes.crown = crown;
  const bell = new THREE.Group();
  bell.position.set(-27, 46, 26);
  mesh(bell, new THREE.CylinderGeometry(0.65, 2.2, 3.8, 24, 1, true), materials.gold);
  mesh(bell, new THREE.SphereGeometry(0.35, 12, 8), materials.gold, [0, -1.9, 0]);
  city.add(bell);
  eventMeshes.bells = bell;

  const reef = groups.reef;
  const reefRandom = seededRandom(791);
  land(reef, reefRandom, -8, 5);
  const terraces = [];
  for (let index = 0; index < 38; index++) {
    const horizontal = (index % 2 ? -1 : 1) * (30 + reefRandom() * 90);
    const depth = 90 - reefRandom() * 220;
    const height = 5 + reefRandom() * 16;
    terraces.push({ position: [horizontal, height * 0.15 - 6, depth], scale: [12 + reefRandom() * 20, height, 13 + reefRandom() * 20], rotation: [0, reefRandom() * 6, 0] });
  }
  instances(reef, rockGeometry, materials.pale, terraces);
  const plate = new THREE.SphereGeometry(1, 28, 8, 0, Math.PI * 2, 0, Math.PI * 0.46);
  for (let index = 0; index < plate.attributes.position.count; index++) {
    const positions = plate.attributes.position;
    const horizontal = positions.getX(index);
    const depth = positions.getZ(index);
    const angle = Math.atan2(horizontal, depth);
    const fringe = 1 + Math.sin(angle * 9) * 0.055 + Math.cos(angle * 17) * 0.04;
    positions.setX(index, horizontal * fringe);
    positions.setZ(index, depth * fringe);
    positions.setY(index, positions.getY(index) + Math.sin(angle * 11) * 0.1);
  }
  plate.computeVertexNormals();
  for (let palette = 0; palette < coralMaterials.length; palette++) {
    const rows = [];
    for (let index = 0; index < 100; index++) {
      const terrace = terraces[(index * 5 + palette) % terraces.length];
      const offsetX = (reefRandom() - 0.5) * terrace.scale[0];
      const offsetZ = (reefRandom() - 0.5) * terrace.scale[2];
      const horizontal = terrace.position[0] + offsetX;
      const depth = terrace.position[2] + offsetZ;
      const elevation = terrace.position[1] + terrace.scale[1] * Math.sqrt(Math.max(0.1, 1 - (offsetX / terrace.scale[0]) ** 2 - (offsetZ / terrace.scale[2]) ** 2)) * 0.9;
      const size = 1.5 + reefRandom() * 5.2;
      rows.push({ position: [horizontal, elevation, depth], scale: [size, 0.3 + size * 0.09, size * 0.9], rotation: [reefRandom() * 0.2, reefRandom() * 6, (reefRandom() - 0.5) * 0.3] });
    }
    instances(reef, plate, coralMaterials[palette], rows);
  }
  const branchParts = [];
  function branch(origin, direction, length, radius, level) {
    const tip = origin.clone().addScaledVector(direction, length);
    const geometry = new THREE.CylinderGeometry(radius * 0.5, radius, length, 6);
    transform.position.copy(origin).add(tip).multiplyScalar(0.5);
    transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    branchParts.push(geometry.applyMatrix4(transform.matrix));
    if (level > 0) for (const side of [-1, 1]) branch(tip, direction.clone().add(new THREE.Vector3(side * 0.75, 0.2, (reefRandom() - 0.5) * 0.25)).normalize(), length * 0.71, radius * 0.65, level - 1);
  }
  branch(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 3.5, 0.26, 4);
  const branchGeometry = mergeGeometries(branchParts);
  branchParts.forEach(part => part.dispose());
  const branches = [];
  for (let index = 0; index < 105; index++) {
    const terrace = terraces[index % terraces.length];
    branches.push({ position: [terrace.position[0] + (reefRandom() - 0.5) * 7, terrace.position[1] + terrace.scale[1] * 0.9, terrace.position[2] + (reefRandom() - 0.5) * 7], scale: [0.65 + reefRandom(), 0.8 + reefRandom() * 1.4, 0.8], rotation: [0, reefRandom() * 6, 0] });
  }
  instances(reef, branchGeometry, coralMaterials[0], branches);
  const polyps = [];
  for (let index = 0; index < 350; index++) {
    const horizontal = (reefRandom() - 0.5) * 50;
    const depth = 25 + (reefRandom() - 0.5) * 50;
    polyps.push({ position: [horizontal, 1 + reefRandom() * 3, depth], scale: [0.13, 1 + reefRandom() * 2.2, 0.13], rotation: [(reefRandom() - 0.5) * 0.5, 0, (reefRandom() - 0.5) * 0.7] });
  }
  const polypMaterial = new THREE.MeshStandardMaterial({ color: '#e6bc92', emissive: '#ba7b4e', emissiveIntensity: 0.08, roughness: 0.65 });
  eventMeshes.coral = instances(reef, new THREE.CapsuleGeometry(1, 2, 3, 6), polypMaterial, polyps);
  animated.push((time, delta) => {
    const expansion = eventState.coral ? 1 : 0;
    coralBloom.value = THREE.MathUtils.damp(coralBloom.value, expansion, 1.2, delta);
    eventMeshes.coral.scale.y = THREE.MathUtils.lerp(eventMeshes.coral.scale.y, expansion ? 1.65 : 0.22, 0.035);
    eventMeshes.coral.rotation.y = Math.sin(time * 0.16) * 0.015;
    polypMaterial.emissiveIntensity = expansion ? 0.24 : 0.02;
  });
  const reefArch = new THREE.Group();
  reefArch.position.set(-16, 28, -106);
  reef.add(reefArch);
  for (let index = 0; index < 26; index++) {
    const angle = index / 25 * Math.PI;
    mesh(reefArch, rockGeometry, materials.rock, [Math.cos(angle) * 48, Math.sin(angle) * 38, Math.sin(angle * 3) * 3], [8, 8, 10], [index * 0.4, angle, 0]);
  }
  const fishRows = Array.from({ length: 600 }, () => ({ position: [0, 0, 0] }));
  const silver = new THREE.MeshStandardMaterial({ color: '#c2d4bb', roughness: 0.35, metalness: 0.46 });
  const shoal = instances(reef, new THREE.SphereGeometry(1, 6, 4), silver, fishRows);
  animated.push(time => {
    if (!reef.visible) return;
    for (let index = 0; index < fishRows.length; index++) {
      const angle = index * 2.399 + time * 0.22;
      const radius = eventState.shoal ? 17 + Math.sin(index * 0.73) * 2.5 : 48 + Math.sin(index * 0.7) * 22;
      const elevation = 18 + Math.sin(index * 0.23 + time * 0.25) * (eventState.shoal ? 10 : 6);
      transform.position.set(Math.sin(angle) * radius, elevation, Math.cos(angle) * radius + (eventState.shoal ? 40 : -30));
      transform.rotation.set(0, angle + Math.PI / 2, Math.sin(index) * 0.15);
      transform.scale.set(0.28, 0.34, 0.8 + Math.sin(index) * 0.2);
      transform.updateMatrix();
      shoal.setMatrixAt(index, transform.matrix);
    }
    shoal.instanceMatrix.needsUpdate = true;
  });
  shoal.frustumCulled = false;

  const garden = groups.garden;
  const gardenRandom = seededRandom(2387);
  land(garden, gardenRandom, -14, 5);
  const pillars = [];
  for (let index = 0; index < 55; index++) {
    const horizontal = (index % 2 ? -1 : 1) * (50 + gardenRandom() * 85);
    pillars.push({ position: [horizontal, 18, -130 + gardenRandom() * 220], scale: [6 + gardenRandom() * 8, 25 + gardenRandom() * 45, 7 + gardenRandom() * 9], rotation: [0.1, gardenRandom() * 6, 0.1] });
  }
  instances(garden, rockGeometry, materials.rock, pillars);
  const bellMaterial = new THREE.MeshPhysicalMaterial({ color: '#aac5ce', emissive: '#60919f', emissiveIntensity: 0.3, transparent: true, opacity: 0.25, side: THREE.DoubleSide, roughness: 0.34, depthWrite: false });
  const threadMaterial = new THREE.MeshBasicMaterial({ color: '#b7c8df', transparent: true, opacity: 0.24, depthWrite: false });
  const giantJellies = [];
  const bellGeometry = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.54);
  const threadParts = [];
  for (let index = 0; index < 18; index++) {
    const angle = index / 18 * Math.PI * 2;
    const points = [];
    for (let section = 0; section < 16; section++) {
      const progress = section / 15;
      points.push(new THREE.Vector3(Math.cos(angle) * 0.87 + Math.sin(progress * 9 + angle) * progress * 0.28, -progress * (2.8 + index % 3 * 0.5), Math.sin(angle) * 0.87 + Math.cos(progress * 8) * progress * 0.25));
    }
    threadParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.009, 3, false));
  }
  const threads = mergeGeometries(threadParts);
  threadParts.forEach(part => part.dispose());
  for (let index = 0; index < 23; index++) {
    const jelly = new THREE.Group();
    const size = index < 3 ? [18, 12, 9][index] : 2.5 + gardenRandom() * 5;
    jelly.position.set(index === 0 ? -5 : (gardenRandom() - 0.5) * 180, index === 0 ? 64 : 29 + gardenRandom() * 54, index === 0 ? -37 : 30 - gardenRandom() * 170);
    const bellMesh = mesh(jelly, bellGeometry, bellMaterial, [0, 0, 0], [1, 0.55, 1]);
    mesh(jelly, new THREE.TorusGeometry(0.98, 0.013, 5, 64), threadMaterial, [0, -0.05, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    mesh(jelly, threads, threadMaterial);
    jelly.scale.setScalar(size);
    jelly.userData = { size, baseY: jelly.position.y, phase: index * 1.7, bellMesh };
    garden.add(jelly);
    giantJellies.push(jelly);
  }
  const pathRows = [];
  for (let index = 0; index < 90; index++) {
    const progress = index / 90;
    pathRows.push({ position: [Math.sin(progress * 10) * 11 - 9, -3 + Math.sin(progress * 9) * 2, 100 - progress * 230], scale: [0.22 + progress * 0.3, 0.15, 0.3] });
  }
  const pathMaterial = new THREE.MeshBasicMaterial({ color: '#e0d7b4', transparent: true, opacity: 0.08 });
  eventMeshes.path = instances(garden, new THREE.SphereGeometry(1, 8, 6), pathMaterial, pathRows);
  let pathProgress = 0;
  animated.push((time, delta) => {
    if (!garden.visible) return;
    giantJellies.forEach(jelly => {
      const data = jelly.userData;
      const phase = eventState.choir ? 0 : data.phase;
      jelly.position.y = data.baseY + Math.sin(time * 0.25 + phase) * 2.3;
      data.bellMesh.scale.set(1 + Math.sin(time * 1.1 + phase) * 0.055, 0.55 + Math.cos(time * 1.1 + phase) * 0.06, 1 + Math.sin(time * 1.1 + phase) * 0.055);
      jelly.rotation.y = Math.sin(time * 0.06 + data.phase) * 0.2;
    });
    bellMaterial.emissiveIntensity = eventState.choir ? 0.75 + Math.sin(time * 1.1) * 0.4 : 0.3;
    threadMaterial.opacity = eventState.choir ? 0.45 + Math.sin(time * 1.1) * 0.2 : 0.24;
    pathProgress = THREE.MathUtils.damp(pathProgress, eventState.path ? 1 : 0, 1.1, delta);
    pathMaterial.opacity = 0.1 + pathProgress * 0.9;
    eventMeshes.path.count = eventState.path ? Math.max(1, Math.round(pathProgress * 90)) : 90;
  });

  const trench = groups.trench;
  const trenchRandom = seededRandom(281);
  land(trench, trenchRandom, -28, 7);
  const cliffRows = [];
  for (let index = 0; index < 100; index++) {
    const depth = 155 - trenchRandom() * 380;
    const horizontal = (index % 2 ? -1 : 1) * (46 + trenchRandom() * 55);
    cliffRows.push({ position: [horizontal, 4 + trenchRandom() * 35, depth], scale: [9 + trenchRandom() * 19, 28 + trenchRandom() * 48, 12 + trenchRandom() * 18], rotation: [0.07, trenchRandom() * 5, (trenchRandom() - 0.5) * 0.15] });
  }
  instances(trench, new THREE.CylinderGeometry(0.75, 1, 1, 6), basalt, cliffRows);
  const wreck = new THREE.Group();
  wreck.position.set(-5, -4, -36);
  wreck.rotation.set(0, -0.22, -0.16);
  trench.add(wreck);
  const wreckMaterial = timber.clone();
  wreckMaterial.emissive.set('#7a9c91');
  wreckMaterial.emissiveIntensity = 0.02;
  for (let rib = 0; rib < 17; rib++) {
    const depth = -42 + rib * 5;
    const width = 16 * Math.pow(Math.sin(rib / 17 * Math.PI), 0.6) + 1;
    const points = [];
    for (let step = 0; step <= 16; step++) {
      const angle = step / 16 * Math.PI;
      points.push([Math.cos(angle) * width, 12 - Math.sin(angle) * 13, depth]);
    }
    tube(wreck, points, 0.48, wreckMaterial, 20);
  }
  for (const side of [-1, 1]) for (let plank = 0; plank < 3; plank++) tube(wreck, [[side * 2, 8 + plank * 1.2, -44], [side * 14, 8 + plank * 1.2, -10], [side * 12, 8 + plank * 1.2, 25], [side * 3, 8 + plank * 1.2, 43]], 0.42, wreckMaterial);
  mesh(wreck, new THREE.CylinderGeometry(0.4, 0.85, 43, 12), wreckMaterial, [-1, 23, -7], [1, 1, 1], [0.15, 0, -0.24]);
  mesh(wreck, new THREE.CylinderGeometry(0.32, 0.32, 27, 10), wreckMaterial, [3, 37, -4], [1, 1, 1], [0, 0, Math.PI / 2 - 0.15]);
  const sail = new THREE.PlaneGeometry(19, 19, 12, 12);
  const sailPosition = sail.attributes.position;
  for (let index = 0; index < sailPosition.count; index++) {
    const horizontal = sailPosition.getX(index);
    const elevation = sailPosition.getY(index);
    sailPosition.setZ(index, Math.sin(horizontal * 0.16) * 3 + Math.cos(elevation * 0.15) * 2);
  }
  sail.computeVertexNormals();
  mesh(wreck, sail, new THREE.MeshStandardMaterial({ color: '#879187', side: THREE.DoubleSide, transparent: true, opacity: 0.4, roughness: 1 }), [2, 25, -6]);
  eventMeshes.wreck = wreck;
  const sonarLight = new THREE.PointLight('#aed9cf', 0, 150, 1.3);
  sonarLight.position.set(0, 27, -5);
  trench.add(sonarLight);
  const vents = [];
  for (let index = 0; index < 9; index++) {
    const horizontal = -46 + trenchRandom() * 16;
    const depth = 25 + trenchRandom() * 48;
    const height = 8 + trenchRandom() * 16;
    mesh(trench, new THREE.CylinderGeometry(1.1, 3.2, height, 9), basalt, [horizontal, height / 2 - 8, depth]);
    mesh(trench, new THREE.TorusGeometry(1.1, 0.13, 6, 16), glowMaterial, [horizontal, height - 8, depth], [1, 1, 1], [Math.PI / 2, 0, 0]);
    vents.push(new THREE.Vector3(horizontal, height - 8, depth));
  }
  const plumeGeometry = new THREE.BufferGeometry();
  const plumePositions = new Float32Array(1200 * 3);
  plumeGeometry.setAttribute('position', new THREE.BufferAttribute(plumePositions, 3));
  const plumeCanvas = document.createElement('canvas');
  plumeCanvas.width = plumeCanvas.height = 64;
  const plumeContext = plumeCanvas.getContext('2d');
  const plumeGradient = plumeContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  plumeGradient.addColorStop(0, 'rgba(225, 237, 232, 0.7)');
  plumeGradient.addColorStop(0.35, 'rgba(203, 220, 215, 0.35)');
  plumeGradient.addColorStop(1, 'rgba(180, 210, 203, 0)');
  plumeContext.fillStyle = plumeGradient;
  plumeContext.fillRect(0, 0, 64, 64);
  const plumeMaterial = new THREE.PointsMaterial({ color: '#93b0ab', map: new THREE.CanvasTexture(plumeCanvas), size: 3.5, transparent: true, opacity: 0.08, depthWrite: false });
  const plume = new THREE.Points(plumeGeometry, plumeMaterial);
  plume.frustumCulled = false;
  trench.add(plume);
  animated.push(time => {
    if (!trench.visible) return;
    const active = eventState.vents;
    for (let index = 0; index < 1200; index++) {
      const origin = vents[index % vents.length];
      const progress = (index * 0.031 + time * (active ? 0.15 : 0.035)) % 1;
      const spread = progress * (active ? 7 : 2.2);
      plumePositions[index * 3] = origin.x + Math.sin(index * 2.39 + time * 0.24) * spread;
      plumePositions[index * 3 + 1] = origin.y + progress * (active ? 46 : 13);
      plumePositions[index * 3 + 2] = origin.z + Math.cos(index * 1.73) * spread;
    }
    plumeGeometry.attributes.position.needsUpdate = true;
    plumeMaterial.opacity = active ? 0.3 : 0.06;
    wreckMaterial.emissiveIntensity = eventState.wreck ? 0.58 : 0.02;
    sonarLight.intensity = eventState.wreck ? 55 : 0;
  });

  let activeRegion = 'city';
  return {
    groups,
    setRegion(region) { activeRegion = region; for (const [key, group] of Object.entries(groups)) group.visible = key === region; },
    setEvent(key, value) { eventState[key] = value; },
    setColor(color) { const value = LIGHT_COLORS[color] || LIGHT_COLORS.pearl; bellMaterial.color.set(value); bellMaterial.emissive.set(value); threadMaterial.color.set(value); },
    update(time, delta) {
      for (const animate of animated) animate(time, delta);
      crownMaterial.opacity = THREE.MathUtils.damp(crownMaterial.opacity, eventState.crown ? 0.75 + Math.sin(time * 0.8) * 0.15 : 0.035, 1, delta);
      if (eventState.bells) bell.rotation.z = Math.sin(time * 2.4) * 0.12;
    },
    inspect: () => ({ region: activeRegion, events: { ...eventState } }),
    eventPosition: key => new THREE.Vector3(...EVENTS[key].position),
  };
}
