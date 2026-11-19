import * as THREE from 'three';
import { beam, shellCrest } from './palace-craft.js';

export function sanctuaryMaterials(materials) {
  const clock = { value: 0 };
  const palette = {
    limestone: ['#d0c3a4', 0.79, 0.02],
    carvedStone: ['#e0cfac', 0.65, 0.02],
    agedStone: ['#65766c', 0.89, 0.02],
    bronze: ['#a18853', 0.4, 0.63],
    patina: ['#2e524c', 0.66, 0.39],
    reef: ['#56665b', 0.98, 0],
    reefCoral: ['#907b6e', 0.93, 0],
  };
  for (const [name, [color, roughness, metalness]] of Object.entries(palette)) {
    const surface = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: materials.pale.envMap, envMapIntensity: 0.46 });
    surface.name = `海神圣域 · ${name}`;
    surface.userData.tideClock = clock;
    surface.onBeforeCompile = shader => {
      shader.uniforms.sanctuaryTime = clock;
      shader.uniforms.sanctuaryMasonry = { value: ['limestone', 'agedStone'].includes(name) ? 0.11 : 0 };
      shader.vertexShader = 'varying vec3 sanctuaryPoint;\nvarying vec3 sanctuaryNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 sanctuaryLocal=vec4(transformed,1.0);
        vec3 sanctuaryFace=normal;
        #ifdef USE_INSTANCING
          sanctuaryLocal=instanceMatrix*sanctuaryLocal;
          sanctuaryFace=normalize(mat3(instanceMatrix)*sanctuaryFace);
        #endif
        sanctuaryPoint=sanctuaryLocal.xyz;
        sanctuaryNormal=sanctuaryFace;`);
      shader.fragmentShader = 'varying vec3 sanctuaryPoint;\nvarying vec3 sanctuaryNormal;\nuniform float sanctuaryTime;\nuniform float sanctuaryMasonry;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float sediment=sin(sanctuaryPoint.x*0.19+sin(sanctuaryPoint.z*0.21))*sin(sanctuaryPoint.y*0.31+sanctuaryPoint.z*0.14);
        float grain=sin(sanctuaryPoint.x*13.7+sanctuaryPoint.z*11.9)*sin(sanctuaryPoint.y*17.3+sanctuaryPoint.x*3.1);
        float porous=0.93+sediment*0.055+grain*0.014;
        float deposit=(1.0-smoothstep(-5.0,26.0,sanctuaryPoint.y))*(0.5+0.5*sediment);
        float course=abs(fract(sanctuaryPoint.y/2.4+0.02)-0.5);
        float stagger=mod(floor(sanctuaryPoint.y/2.4+0.02),2.0)*0.5;
        float joint=abs(fract((sanctuaryPoint.x+sanctuaryPoint.z)/7.0+stagger)-0.5);
        float mortar=max(smoothstep(0.487,0.5,course),smoothstep(0.49,0.5,joint));
        porous*=1.0-mortar*sanctuaryMasonry*(1.0-abs(sanctuaryNormal.y));
        diffuseColor.rgb*=porous;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(0.65,0.78,0.67),deposit*0.26);
        float tideA=sin(sanctuaryPoint.x*0.27+sanctuaryPoint.z*0.23+sin(sanctuaryPoint.y*0.19)+sanctuaryTime*0.22);
        float tideB=sin(sanctuaryPoint.z*0.32-sanctuaryPoint.x*0.16+sanctuaryTime*0.17);
        float tide=pow(max(0.0,1.0-abs(tideA+tideB)*0.74),16.0);
        diffuseColor.rgb*=1.0+tide*0.13*(0.25+max(0.0,sanctuaryNormal.y));`);
    };
    surface.customProgramCacheKey = () => 'sanctuary-stone-and-tide-4';
    materials[name] = surface;
  }
  return clock;
}

function prepareGeometry(shop) {
  if (shop.geometries.reefRock) return;
  const reef = new THREE.SphereGeometry(1, 16, 10);
  const vertices = reef.attributes.position;
  for (let index = 0; index < vertices.count; index++) {
    const horizontal = vertices.getX(index); const vertical = vertices.getY(index); const depth = vertices.getZ(index);
    const erosion = 1 + Math.sin(horizontal * 4.7 + depth * 2.4) * 0.16 + Math.cos(vertical * 6.1 - horizontal * 1.8) * 0.09;
    vertices.setXYZ(index, horizontal * erosion, vertical * erosion, depth * erosion);
  }
  reef.computeVertexNormals();
  const pediment = new THREE.Shape(); pediment.moveTo(-0.5, 0); pediment.lineTo(0.5, 0); pediment.lineTo(0, 1); pediment.closePath();
  const gable = new THREE.ExtrudeGeometry(pediment, { depth: 1, bevelEnabled: false, steps: 1 }).translate(0, 0, -0.5);
  const arc = new THREE.Shape(); const angle = Math.PI / 24;
  arc.absarc(0, 0, 1, -angle / 2, angle / 2, false);
  arc.absarc(0, 0, 0.86, angle / 2, -angle / 2, true); arc.closePath();
  const arcBlock = new THREE.ExtrudeGeometry(arc, { depth: 1, bevelEnabled: false, steps: 1, curveSegments: 4 }).rotateX(-Math.PI / 2);
  const shapes = { reefRock: reef, pediment: gable, terraceArc: arcBlock };
  for (const [name, geometry] of Object.entries(shapes)) { geometry.computeBoundingBox(); shop.geometries[name] = geometry; }
}

function block(shop, material, position, scale, name = '圣域石作', solid = true, yaw = 0) {
  shop.add('box', material, position, scale, [0, yaw, 0], solid, name);
}

function pier(shop, horizontal, depth, bottom, height, radius = 1.6) {
  shop.add('shaft', 'limestone', [horizontal, bottom + height / 2, depth], [radius, height - 2.8, radius], [0, 0, 0], true, '海神殿巨型凹槽石柱');
  for (const elevation of [0.3, height - 0.4]) {
    block(shop, 'carvedStone', [horizontal, bottom + elevation, depth], [radius * 3.1, 0.65, radius * 3.1], '承重石柱的柱础与柱头');
    shop.add('cylinder', 'carvedStone', [horizontal, bottom + elevation + (elevation < 1 ? 0.7 : -0.7), depth], [radius * 1.18, 0.72, radius * 1.18], [0, 0, 0], true, '叠涩石柱线脚');
    shop.add('cylinder', 'bronze', [horizontal, bottom + elevation + (elevation < 1 ? 1.18 : -1.18), depth], [radius * 1.02, 0.13, radius * 1.02]);
  }
  for (let leaf = 0; leaf < 8; leaf++) {
    const angle = leaf / 8 * Math.PI * 2;
    shop.add('leaf', 'carvedStone', [horizontal + Math.sin(angle) * radius, bottom + height - 1.7, depth + Math.cos(angle) * radius], [radius * 0.43, 1.25, radius * 0.27], [Math.cos(angle) * 0.25, angle, Math.sin(angle) * 0.25], false, '海叶雕刻柱头');
  }
}

function lintel(shop, start, end, elevation, thickness = 3, width = 5.2) {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const yaw = Math.atan2(end[0] - start[0], end[1] - start[1]);
  const center = [(start[0] + end[0]) / 2, elevation, (start[1] + end[1]) / 2];
  block(shop, 'limestone', center, [width, thickness, length + width * 0.4], '巨石檐梁', true, yaw);
  block(shop, 'carvedStone', [center[0], elevation + thickness / 2 + 0.45, center[2]], [width + 1, 0.9, length + width * 0.55], '悬挑石檐', true, yaw);
  block(shop, 'bronze', [center[0], elevation - thickness / 2 + 0.32, center[2]], [width + 0.08, 0.18, length + width * 0.43], '嵌铜檐线', false, yaw);
}

function stoneArch(shop, horizontal, depth, bottom, radius, rise, thickness = 1.5, yaw = 0) {
  const count = 20;
  for (let segment = 0; segment < count; segment++) {
    const angle = (segment + 0.5) / count * Math.PI;
    const across = Math.cos(angle) * (radius + thickness / 2);
    const elevation = bottom + rise + Math.sin(angle) * (radius + thickness / 2);
    shop.add('box', segment === 9 || segment === 10 ? 'carvedStone' : 'limestone', [horizontal + Math.cos(yaw) * across, elevation, depth - Math.sin(yaw) * across], [(radius + thickness) * Math.PI / count * 1.02, thickness, 3.4], [0, yaw, angle - Math.PI / 2], true, '楔形拱券石');
  }
  for (const side of [-1, 1]) block(shop, 'limestone', [horizontal + Math.cos(yaw) * side * (radius + thickness / 2), bottom + rise / 2, depth - Math.sin(yaw) * side * (radius + thickness / 2)], [thickness, rise, 3.4], '门拱承重石墩', true, yaw);
}

function trident(shop, center, height, yaw = 0) {
  const local = (across, up, inset = 0) => [center[0] + across * Math.cos(yaw) + inset * Math.sin(yaw), center[1] + up, center[2] - across * Math.sin(yaw) + inset * Math.cos(yaw)];
  beam(shop, local(0, 0), local(0, height), height * 0.035, 'bronze', '海神三叉戟');
  for (const side of [-1, 1]) {
    const path = [[0, height * 0.42], [side * height * 0.23, height * 0.5], [side * height * 0.27, height * 0.67], [side * height * 0.23, height * 0.88]];
    for (let index = 1; index < path.length; index++) beam(shop, local(...path[index - 1]), local(...path[index]), height * 0.027, 'bronze', '海神三叉戟');
    shop.add('jewel', 'bronze', local(side * height * 0.23, height * 0.91), [height * 0.067, height * 0.13, height * 0.035], [0, yaw, 0]);
  }
  shop.add('jewel', 'gold', local(0, height * 1.03), [height * 0.065, height * 0.15, height * 0.045], [0, yaw, 0], false, '三叉戟中央锋刃');
}

function frieze(shop, start, end, elevation, side = false) {
  const length = end - start; const count = Math.floor(length / 3.5);
  for (let index = 0; index < count; index++) {
    const across = start + (index + 0.5) * length / count;
    const position = side ? [46, elevation, across] : [across, elevation, 8];
    block(shop, 'carvedStone', position, [0.8, 0.85, 0.8], '石檐齿饰', false);
    if (!side) {
      block(shop, 'bronze', [across, elevation - 2.5, 6.48], [1.4, 0.16, 0.1], '回纹青铜嵌饰', false);
      block(shop, 'bronze', [across + 0.65, elevation - 2.8, 6.48], [0.16, 0.7, 0.1], '回纹青铜嵌饰', false);
      block(shop, 'bronze', [across + 0.23, elevation - 3.1, 6.48], [0.9, 0.16, 0.1], '回纹青铜嵌饰', false);
    }
  }
}

function temple(shop) {
  block(shop, 'limestone', [0, 24.12, 29], [123, 0.24, 47], '主殿迎潮露台');
  shop.add('disc', 'agedStone', [0, 24.27, 30], [17, 17, 1], [-Math.PI / 2, 0, 0], false, '迎潮露台石拼花');
  for (const radius of [5.2, 12.4, 16.3]) shop.add('inlay', 'bronze', [0, 24.29, 30], [radius, radius, 1], [-Math.PI / 2, 0, 0]);
  for (let ray = 0; ray < 12; ray++) {
    const angle = ray / 12 * Math.PI * 2;
    block(shop, ray % 2 ? 'carvedStone' : 'bronze', [Math.sin(angle) * 8.7, 24.29, 30 + Math.cos(angle) * 8.7], [0.5, 0.04, 6.8], '十二潮向露台镶嵌', false, angle);
  }
  for (let tier = 0; tier < 4; tier++) {
    block(shop, tier % 2 ? 'carvedStone' : 'limestone', [0, 25 + tier * 2.1, -48], [106 - tier * 4.8, 2.1, 112 - tier * 4.5], '主神殿层叠石台');
  }
  const floor = 32.4; const height = 34;
  for (const depth of [3, -99]) for (const horizontal of [-38, -27, -16, 16, 27, 38]) pier(shop, horizontal, depth, floor, height, 2.05);
  for (const side of [-1, 1]) for (const depth of [-13, -30, -47, -64, -81]) pier(shop, side * 38, depth, floor, height, 2.05);
  for (const depth of [3, -99]) lintel(shop, [-40, depth], [40, depth], 68.2, 3.3, 6.8);
  for (const horizontal of [-38, 38]) lintel(shop, [horizontal, 3], [horizontal, -99], 68.2, 3.3, 6.8);
  for (const depth of [5, -101]) {
    shop.add('pediment', 'carvedStone', [0, 71, depth], [89, 18, 3], [0, 0, 0], false, '海神殿三角山墙');
    shop.add('pediment', 'patina', [0, 73, depth + (depth > 0 ? 1.6 : -1.6)], [74, 13, 0.35], [0, 0, 0], false, '青铜海潮山墙浮雕底板');
    for (const side of [-1, 1]) {
      beam(shop, [side * 45, 70.7, depth], [0, 89.6, depth], 0.7, 'carvedStone', '山墙叠涩斜檐');
      beam(shop, [side * 41, 71.8, depth + 1.9], [0, 88.2, depth + 1.9], 0.14, 'bronze', '山墙嵌铜边饰');
      for (let wave = 0; wave < 5; wave++) shellCrest(shop, [side * (10 + wave * 5.2), 73.4, depth + 2], 3.2 - wave * 0.35, 'carvedStone', depth > 0 ? 0 : Math.PI);
    }
    trident(shop, [0, 74, depth + 2.2], 8, depth > 0 ? 0 : Math.PI);
    for (let section = 0; section < 18; section++) {
      const horizontal = -44.5 + (section + 0.5) * 89 / 18;
      const rise = 18 * (1 - Math.abs(horizontal) / 44.5);
      shop.colliders.push({ min: [horizontal - 89 / 36, 71, depth - 1.5], max: [horizontal + 89 / 36, 71 + rise, depth + 1.5] });
    }
  }
  for (const side of [-1, 1]) for (let strip = 0; strip < 18; strip++) {
    const horizontal = side * (strip + 0.5) * 46 / 18;
    const elevation = 89.6 - Math.abs(horizontal) * 18.8 / 46;
    const slope = -side * Math.atan(18.8 / 46);
    shop.add('box', 'patina', [horizontal, elevation, -48], [2.83, 0.55, 110], [0, 0, slope], true, '氧化青铜折板殿顶');
    block(shop, strip % 4 ? 'patina' : 'bronze', [horizontal - side * 1.27, elevation + 0.7, -48], [0.16, 0.2, 110], '青铜屋面立边接缝', false);
    for (const depth of [-95, -76, -57, -38, -19, 0]) shop.add('box', 'bronze', [horizontal, elevation + 0.33, depth], [2.77, 0.08, 0.13], [0, 0, slope], false, '青铜屋面分片接缝');
  }
  frieze(shop, -43, 43, 70.3);
  trident(shop, [0, 90, -6], 13);
  for (const side of [-1, 1]) {
    block(shop, 'agedStone', [side * 26, 47.3, -56], [3, 28, 70], '神殿内殿厚壁');
    for (const depth of [-72, -49, -26]) {
      pier(shop, side * 23.4, depth, floor, 27, 1.05);
      stoneArch(shop, side * 26, depth, 36, 6, 8, 1, Math.PI / 2);
    }
  }
  block(shop, 'agedStone', [0, 47, -90], [53, 29, 3], '内殿祭坛背墙');
  stoneArch(shop, 0, -18, floor, 10, 13, 1.7);
  for (const side of [-1, 1]) pier(shop, side * 13.4, -18, floor, 29, 1.2);
  lintel(shop, [-15, -18], [15, -18], 62.9, 1.6, 4.3);
  block(shop, 'limestone', [0, 34.2, -78], [24, 3.5, 15], '海神内殿祭坛');
  stoneArch(shop, 0, -88, 34, 9, 11, 1.7);
  trident(shop, [0, 38, -86], 17);
  shop.add('disc', 'lapis', [0, 49, -88.2], [10, 10, 1], [0, 0, 0], false, '深蓝祭坛壁龛');
  for (const side of [-1, 1]) {
    for (let step = 0; step < 16; step++) {
      block(shop, step % 4 ? 'limestone' : 'carvedStone', [side * 33, 23.4 + step * 0.56, 39 - step * 1.85], [19, 0.6, 2], '登殿宽阶');
    }
    block(shop, 'carvedStone', [side * 50.5, 28, 22], [2.1, 7, 39], '台阶石侧墙');
    for (const depth of [-105, 9]) {
      block(shop, 'carvedStone', [side * 43, 72, depth], [3, 2.4, 4], '山墙角石');
      shellCrest(shop, [side * 43, 73, depth], 3.1, 'bronze', depth > 0 ? 0 : Math.PI);
    }
  }
}

function arcGallery(shop, side) {
  const radius = 138; const centerDepth = -36;
  for (let index = 0; index <= 17; index++) {
    const angle = (-66 + index * 7.5) * Math.PI / 180;
    const horizontal = side * Math.cos(angle) * radius; const depth = centerDepth + Math.sin(angle) * radius;
    for (const inset of [-5.8, 5.8]) pier(shop, side * Math.cos(angle) * (radius + inset), centerDepth + Math.sin(angle) * (radius + inset), -0.1, 22, 1.05);
    if (index === 17) continue;
    const midpoint = angle + Math.PI / 48;
    for (const [elevation, reach, thickness, material] of [[-0.75, 150, 5.25, 'agedStone'], [0, 147, 0.75, 'limestone'], [25.4, 147, 3.2, 'limestone'], [26, 148, 0.6, 'carvedStone']]) {
      shop.add('terraceArc', material, [0, elevation - thickness, centerDepth], [reach, thickness, reach], [0, side > 0 ? -midpoint : Math.PI + midpoint, 0], true, '环礁弧形柱廊');
    }
    const next = angle + Math.PI / 24;
    for (const inset of [-5.8, 5.8]) lintel(shop, [side * Math.cos(angle) * (radius + inset), centerDepth + Math.sin(angle) * (radius + inset)], [side * Math.cos(next) * (radius + inset), centerDepth + Math.sin(next) * (radius + inset)], 22.5, 1.5, 3.5);
    if (index % 3 === 0) shellCrest(shop, [horizontal, 23, depth], 3, 'bronze', side > 0 ? Math.PI / 2 - angle : -Math.PI / 2 + angle);
  }
}

function sideSanctum(shop, side) {
  const center = side * 93; const depth = -64;
  block(shop, 'agedStone', [center, -5.1, depth], [34, 10.2, 67], '侧殿连续承重基座');
  block(shop, 'limestone', [side * 80, -1.2, depth], [20, 2.4, 66], '主宫与侧殿连台');
  for (const along of [-25, 0, 25]) shop.add('reefRock', 'reef', [side * 106, -9, depth + along], [13, 10, 16], [0, along * 0.02, 0], true, '侧神殿岩礁承台');
  for (let tier = 0; tier < 3; tier++) block(shop, tier % 2 ? 'carvedStone' : 'limestone', [center, tier * 1.2, depth], [37 - tier * 1.4, 1.2, 69 - tier * 1.4], '侧殿台基');
  for (const along of [-28, -14, 0, 14, 28]) for (const edge of [-1, 1]) pier(shop, center + edge * 13, depth + along, 3.1, 24, 1.25);
  for (const edge of [-1, 1]) {
    lintel(shop, [center + edge * 13, depth - 29], [center + edge * 13, depth + 29], 28.5, 2.5, 4.5);
    lintel(shop, [center - 13, depth + edge * 28], [center + 13, depth + edge * 28], 28.5, 2.5, 4.5);
  }
  for (const across of [-1, 1]) for (let strip = 0; strip < 7; strip++) shop.add('box', 'patina', [center + across * (strip + 0.5) * 2.5, 36 - (strip + 0.5) * 0.86, depth], [2.69, 0.55, 65], [0, 0, -across * Math.atan(0.86 / 2.5)], true, '侧殿青铜折板顶');
  for (const edge of [-1, 1]) {
    shop.add('pediment', 'carvedStone', [center, 30.2, depth + edge * 32], [35, 6.3, 2], [0, 0, 0], false, '侧神殿山墙');
    shellCrest(shop, [center, 30.8, depth + edge * 33.1], 4, 'bronze', edge > 0 ? 0 : Math.PI);
  }
}

function foundation(shop) {
  block(shop, 'agedStone', [0, -5.5, -25], [170, 10, 206], '海神宫城基础岩台');
  for (let tier = 0; tier < 3; tier++) block(shop, tier % 2 ? 'carvedStone' : 'limestone', [0, -8.8 + tier * 3.1, -25], [179 - tier * 4, 0.9, 217 - tier * 4], '宫城退台基座');
  for (let segment = -10; segment <= 10; segment++) {
    const angle = segment * Math.PI / 24;
    for (const [elevation, radius, thick] of [[-6.7, 117, 3], [-3.7, 111, 3], [-0.7, 104, 0.7]]) {
      shop.add('terraceArc', 'limestone', [0, elevation, 30], [radius, thick, radius], [0, angle - Math.PI / 2, 0], true, '新月迎宾前庭');
    }
  }
  block(shop, 'limestone', [0, -0.95, 96], [25, 1.8, 85], '新月前庭与入宫中央通道');
  for (const side of [-1, 1]) {
    for (const horizontal of [26, 48, 70]) for (const depth of [59, 64]) block(shop, 'bronze', [side * horizontal, -0.62, depth], [17, 0.06, 0.16], '前庭嵌铜石拼花', false);
    block(shop, 'carvedStone', [side * 12.2, 0.6, 96], [1, 1.2, 80], '入宫通道石侧缘');
    for (const depth of [76, 99, 123]) {
      shop.add('urn', 'bronze', [side * 13.2, 0, depth], [1.7, 3.4, 1.7], [0, 0, 0], true, '青铜引路灯盏');
      shop.add('sphere', 'light', [side * 13.2, 3.5, depth], [0.48, 0.55, 0.48], [0, 0, 0], false, '迎宾珍珠灯');
    }
    for (let segment = 0; segment < 22; segment++) {
      const angle = (-83 + segment * 8.2) * Math.PI / 180;
      const reach = 153 + Math.sin(segment * 3.7) * 7;
      const horizontal = side * Math.cos(angle) * reach; const depth = -35 + Math.sin(angle) * reach;
      if (depth > 50 && Math.abs(horizontal) < 38) continue;
      shop.add('reefRock', segment % 3 ? 'reef' : 'agedStone', [horizontal, -18 - Math.sin(segment * 2.1) * 2.3, depth], [11 + segment % 4 * 2, 10 + segment % 3, 13 + segment % 5], [0.1, angle, 0.12], true, '侵蚀礁岩基座');
      if (segment % 3 !== 0) continue;
      const rockMatrix = shop.transform.matrix.clone(); const vertices = shop.geometries.reefRock.attributes.position;
      const summit = new THREE.Vector3(0, -Infinity, 0); const vertex = new THREE.Vector3();
      for (let index = 0; index < vertices.count; index++) { vertex.fromBufferAttribute(vertices, index).applyMatrix4(rockMatrix); if (vertex.y > summit.y) summit.copy(vertex); }
      const base = summit.clone(); base.y -= 0.12;
      for (let branch = 0; branch < 5; branch++) {
        const end = [base.x + Math.sin(branch * 2.4) * 2.2, base.y + 2.4 + branch * 0.45, base.z + Math.cos(branch * 2.4) * 1.5];
        beam(shop, base.toArray(), end, 0.16, 'reefCoral', '礁缝附生珊瑚');
        shop.add('bead', 'reefCoral', end, [0.17, 0.17, 0.17]);
        beam(shop, end, [end[0] + Math.sin(branch) * 1.2, end[1] + 0.9, end[2] + 0.5], 0.09, 'reefCoral', '礁缝珊瑚末梢');
      }
    }
  }
}

function entrance(shop) {
  for (const side of [-1, 1]) {
    for (const across of [10.9, 17.6]) pier(shop, side * across, 58, 0, 23, 1.1);
    for (const across of [31, 49]) {
      stoneArch(shop, side * across, 56.5, 4, 5.5, 6, 0.9);
      block(shop, 'patina', [side * across, 10.2, 54.9], [9, 10.5, 0.35], '迎宾殿青铜浮雕壁龛', false);
      trident(shop, [side * across, 6.2, 55.3], 6.5);
    }
    for (const depth of [-92, -62, -32, 7, 38]) {
      pier(shop, side * 65.8, depth, 0, 24, 1.05);
      stoneArch(shop, side * 64.5, depth, 4, 6.2, 5.5, 0.9, Math.PI / 2);
    }
    for (let step = 0; step < 8; step++) block(shop, 'limestone', [side * 40, -0.6 - step * 0.85, 66 + step * 2], [43 + step * 1.6, 0.85, 2.1], '迎宾礼仪宽阶');
    for (const depth of [46, -115]) block(shop, 'carvedStone', [side * 70, 25.6, depth], [17, 2.8, 19], '转角露台');
  }
  stoneArch(shop, 0, 58.5, 0, 8.7, 8.2, 1.35);
  lintel(shop, [-20, 58], [20, 58], 24.5, 2.3, 6.2);
  shellCrest(shop, [0, 24.8, 62], 8, 'carvedStone');
  for (const side of [-1, 1]) {
    lintel(shop, [side * 20, 55.5], [side * 63, 55.5], 23.7, 2.2, 3);
    lintel(shop, [side * 65.8, 49], [side * 65.8, -113], 25.1, 2.2, 4.1);
  }
}

export function buildSanctuary(shop) {
  prepareGeometry(shop);
  foundation(shop);
  temple(shop);
  entrance(shop);
  for (const side of [-1, 1]) { arcGallery(shop, side); sideSanctum(shop, side); }
  return { style: '海神圣域 · 巨柱与环礁宫城', height: 105, upperSanctuary: [0, 40, -23] };
}
