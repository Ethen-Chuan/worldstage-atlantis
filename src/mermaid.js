import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function mergeStillMeshes(group, excluded = []) {
  const materials = new Map();
  for (const object of [...group.children]) {
    if (!object.isMesh || excluded.includes(object)) continue;
    object.updateMatrix(); const transformed = object.geometry.clone().applyMatrix4(object.matrix);
    const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
    if (geometry !== transformed) transformed.dispose();
    if (!materials.has(object.material)) materials.set(object.material, []);
    materials.get(object.material).push(geometry); object.removeFromParent(); object.geometry.dispose();
  }
  for (const [material, parts] of materials) { group.add(new THREE.Mesh(mergeGeometries(parts), material)); parts.forEach(part => part.dispose()); }
}

function limb(parent, material, profile) {
  const geometry = new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 32);
  parent.add(new THREE.Mesh(geometry, material));
}

function ellipsoid(parent, material, center, scale, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, 24), material);
  mesh.position.set(...center); mesh.scale.set(...scale); parent.add(mesh); return mesh;
}

function filament(parent, points, radius, material) {
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), 24, radius, 5, false);
  const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh;
}

function ribbon(parent, material, points, width, seed, animated) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const vertices = []; const normals = []; const indices = []; const uv = [];
  for (let row = 0; row <= 28; row++) {
    const progress = row / 28; const center = curve.getPoint(progress);
    const spread = Math.pow(Math.sin(Math.PI * progress), 0.7) * width;
    for (let column = 0; column <= 6; column++) {
      const across = column / 6 * 2 - 1;
      vertices.push(center.x + across * spread, center.y + Math.sin(across * 2 + seed) * spread * 0.08, center.z + Math.sin(across * 5 + progress * 9) * spread * 0.1);
      normals.push(0, 0, -1); uv.push(column / 6, progress);
      if (row < 28 && column < 6) { const start = row * 7 + column; indices.push(start, start + 7, start + 1, start + 1, start + 7, start + 8); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; parent.add(mesh);
  animated.push({ mesh, base: new Float32Array(vertices), seed }); return mesh;
}

export function createMermaid() {
  const root = new THREE.Group(); root.name = 'tide-silk-mermaid'; root.userData.creature = 'mermaid';
  const body = new THREE.Group(); root.add(body);
  const skin = new THREE.MeshPhysicalMaterial({ color: '#eed4cb', roughness: 0.47, metalness: 0, clearcoat: 0.12, sheen: 0.3, sheenColor: '#efbbcb' });
  const silk = new THREE.MeshPhysicalMaterial({ color: '#7ecdd1', roughness: 0.29, metalness: 0.16, iridescence: 0.8, iridescenceIOR: 1.32, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 420, side: THREE.DoubleSide, transparent: true, opacity: 0.63, depthWrite: false });
  const tailMaterial = new THREE.MeshPhysicalMaterial({ color: '#3d97ab', roughness: 0.34, metalness: 0.22, iridescence: 0.78, sheen: 0.5, sheenColor: '#b7ace4', clearcoat: 0.45 });
  const hairMaterial = new THREE.MeshPhysicalMaterial({ color: '#8b9ac8', roughness: 0.39, metalness: 0.16, sheen: 0.9, sheenColor: '#c2bedf', side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: '#c6ba9b', roughness: 0.31, metalness: 0.8 });
  const pearl = new THREE.MeshPhysicalMaterial({ color: '#e2e5dc', roughness: 0.24, metalness: 0.12, iridescence: 0.9 });
  const iris = new THREE.MeshPhysicalMaterial({ color: '#518b99', roughness: 0.17, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b263c', roughness: 0.62 });
  const lips = new THREE.MeshStandardMaterial({ color: '#c78592', roughness: 0.44 });
  for (const material of [skin, pearl, iris, dark, lips, hairMaterial, gold]) material.userData.keepColor = true;
  const timeUniform = { value: 0 };
  tailMaterial.onBeforeCompile = shader => {
    shader.uniforms.mermaidTime = timeUniform;
    shader.fragmentShader = 'uniform float mermaidTime;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 cells = vUv * vec2(24.0, 48.0);
      cells.x += mod(floor(cells.y), 2.0) * 0.5;
      vec2 localCell = fract(cells) - 0.5;
      float rim = smoothstep(0.34, 0.47, length(localCell * vec2(1.0, 0.8)));
      diffuseColor.rgb *= 0.76 + rim * 0.34;
    `);
  };
  tailMaterial.defines = { USE_UV: '' }; tailMaterial.customProgramCacheKey = () => 'mermaid-scales-v9';
  const profile = [[0.38,0],[0.48,0.3],[0.38,0.7],[0.32,1.02],[0.4,1.35],[0.5,1.66],[0.55,1.9],[0.46,2.1],[0.19,2.22],[0.16,2.48]].map(([radius,height])=>new THREE.Vector2(radius,height));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), skin); torso.scale.z = 0.68; body.add(torso);
  const bodiceProfile = [[0.43,0.15],[0.5,0.35],[0.4,0.72],[0.34,1.02],[0.42,1.35],[0.525,1.68],[0.51,1.89]].map(([radius,height])=>new THREE.Vector2(radius,height));
  const bodice = new THREE.Mesh(new THREE.LatheGeometry(bodiceProfile, 48), tailMaterial); bodice.scale.z = 0.71; body.add(bodice);
  const head = new THREE.Group(); head.position.set(0,2.72,-0.03); head.rotation.set(-0.04,0.1,-0.08); body.add(head);
  const face = new THREE.SphereGeometry(1,64,48); const positions = face.attributes.position;
  for(let index=0;index<positions.count;index++) {
    const horizontal=positions.getX(index);const vertical=positions.getY(index);const depth=positions.getZ(index);const front=Math.max(0,-depth);
    const jaw=vertical < -0.15 ? 1-(-vertical-0.15)*0.36 : 1;
    const nose=Math.exp(-((horizontal/0.2)**2)-(((vertical+0.05)/0.32)**2))*0.065;
    positions.setXYZ(index,horizontal*0.295*jaw,vertical*0.415,depth*0.258-front*nose);
  }
  face.computeVertexNormals();head.add(new THREE.Mesh(face,skin));
  const eyelids=[];
  for(const side of [-1,1]) {
    ellipsoid(head,pearl,[side*0.112,0.062,-0.238],[0.074,0.033,0.026]);
    ellipsoid(head,iris,[side*0.106,0.061,-0.263],[0.024,0.026,0.009]);
    ellipsoid(head,dark,[side*0.106,0.061,-0.271],[0.01,0.019,0.004],16);
    ellipsoid(head,pearl,[side*0.1,0.072,-0.277],[0.006,0.006,0.002],12);
    filament(head,[[side*0.041,0.065,-0.252],[side*0.113,0.095,-0.257],[side*0.181,0.057,-0.218]],0.007,dark);
    filament(head,[[side*0.05,0.16,-0.236],[side*0.11,0.176,-0.238],[side*0.185,0.142,-0.208]],0.008,hairMaterial);
    const lid=ellipsoid(head,skin,[side*0.112,0.063,-0.267],[0.075,0.034,0.012]);eyelids.push(lid);
    ellipsoid(head,skin,[side*0.285,-0.005,0],[0.045,0.095,0.045]);
    filament(head,[[side*0.28,-0.03,-0.01],[side*0.33,-0.17,0],[side*0.31,-0.27,-0.02]],0.009,gold);
    ellipsoid(head,pearl,[side*0.31,-0.27,-0.02],[0.025,0.042,0.02],16);
  }
  ellipsoid(head,skin,[0,-0.052,-0.293],[0.034,0.047,0.039]);
  filament(head,[[-0.063,-0.169,-0.231],[-0.025,-0.16,-0.263],[0,-0.168,-0.268],[0.025,-0.16,-0.263],[0.063,-0.169,-0.231]],0.009,lips);
  const lowerLip=ellipsoid(head,lips,[0,-0.185,-0.251],[0.049,0.013,0.013]);
  const animated=[];const hair=new THREE.Group();head.add(hair);
  ellipsoid(hair,hairMaterial,[0,0.11,0.078],[0.311,0.343,0.252]);
  for(let strand=0;strand<24;strand++) {
    const side=strand%2?-1:1;const phase=strand*2.399;const width=0.065+strand%4*0.022;
    ribbon(hair,hairMaterial,[[Math.sin(phase)*0.26,0.31,0.12+Math.cos(phase)*0.1],[side*(0.3+strand%3*0.025),-0.1,0.16],[side*(0.45+strand%5*0.08),-0.8,0.34],[side*(0.75+strand%4*0.17),-1.8-strand%3*0.2,0.5],[side*(0.92+strand%4*0.18),-2.6-strand%3*0.2,0.9]],width,phase,animated);
  }
  for(let jewel=0;jewel<13;jewel++) {
    const angle=(jewel/12-0.5)*2.5;const horizontal=Math.sin(angle)*0.29;
    filament(head,[[horizontal,0.26,-Math.cos(angle)*0.22],[horizontal*1.35,0.43+Math.cos(angle)*0.04,-0.14],[horizontal*1.5,0.56-Math.abs(horizontal)*0.25,-0.09]],0.009,gold);
    ellipsoid(head,jewel%2?pearl:iris,[horizontal*1.35,0.45,-0.15],[0.018,0.038,0.019],12);
  }
  const arms=[];
  for(const side of [-1,1]) {
    const shoulder=new THREE.Group();shoulder.position.set(side*0.46,1.98,0);body.add(shoulder);
    limb(shoulder,skin,[[0.07,-0.76],[0.12,-0.64],[0.125,-0.45],[0.145,-0.18],[0.155,-0.06],[0.11,0.07],[0,0.1]]);
    const forearm=new THREE.Group();forearm.position.y=-0.69;shoulder.add(forearm);
    ellipsoid(forearm,skin,[0,0,0],[0.12,0.14,0.115]);
    limb(forearm,skin,[[0.06,-0.67],[0.065,-0.56],[0.09,-0.34],[0.115,-0.1],[0.1,0.05]]);
    ellipsoid(forearm,skin,[0,-0.67,-0.015],[0.082,0.145,0.043]);
    for(let finger=0;finger<4;finger++){const horizontal=(finger-1.5)*0.033;const length=0.16+Math.sin((finger+1)/5*Math.PI)*0.075;filament(forearm,[[horizontal,-0.75,-0.015],[horizontal*1.16,-0.82-length*0.4,-0.042],[horizontal*1.28,-0.8-length,-0.06]],0.012,skin);}
    filament(forearm,[[side*0.068,-0.63,-0.02],[side*0.13,-0.76,-0.03],[side*0.12,-0.82,-0.05]],0.019,skin);
    const cuff=new THREE.Mesh(new THREE.TorusGeometry(0.11,0.018,8,28),gold);cuff.rotation.x=Math.PI/2;cuff.position.y=-0.52;forearm.add(cuff);
    ribbon(forearm,silk,[[0,-0.5,0.03],[side*0.3,-0.85,0.4],[side*0.48,-1.4,0.8],[side*0.86,-2,1.15]],0.21,side*1.5,animated);
    arms.push({shoulder,forearm,side});
    filament(body,[[side*0.14,2.2,-0.13],[side*0.34,1.9,-0.28],[side*0.49,1.57,-0.22],[side*0.29,1,-0.25],[side*0.48,0.4,-0.21]],0.015,gold);
    for(let jewel=0;jewel<18;jewel++)ellipsoid(body,jewel%3?pearl:iris,[side*(0.13+Math.sin(jewel*0.35)*0.23),1.85-jewel*0.07,-0.34],[0.018,0.025,0.018],12);
    ribbon(body,silk,[[side*0.36,0.4,0],[side*1,0,0.2],[side*1.55,-1.2,0.5],[side*2,-2.1,1]],0.64,side*2,animated);
  }
  const tail=new THREE.Group();body.add(tail);
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0.3,0),new THREE.Vector3(0,-0.8,0.12),new THREE.Vector3(0.1,-2,0.45),new THREE.Vector3(0.28,-3.2,0.94),new THREE.Vector3(0.35,-4.1,1.65)]);
  const tailGeometry=new THREE.TubeGeometry(curve,64,1,32,false);const tailVertices=tailGeometry.attributes.position;
  for(let index=0;index<tailVertices.count;index++){const progress=Math.floor(index/33)/64;const center=curve.getPointAt(progress);const radius=0.51*Math.pow(1-progress,0.9)+0.04;tailVertices.setXYZ(index,center.x+(tailVertices.getX(index)-center.x)*radius,center.y+(tailVertices.getY(index)-center.y)*radius,center.z+(tailVertices.getZ(index)-center.z)*radius);}
  tailGeometry.computeVertexNormals();const tailMesh=new THREE.Mesh(tailGeometry,tailMaterial);tailMesh.name='mermaid-tail-body';tail.add(tailMesh);animated.push({mesh:tailMesh,base:new Float32Array(tailVertices.array),seed:0,tail:true});
  const attachment=curve.getPoint(1);const fins=new THREE.Group();fins.name='mermaid-tail-fins';fins.position.copy(attachment);tail.add(fins);
  for(const side of [-1,1])for(let layer=0;layer<4;layer++) {
    ribbon(fins,silk,[[0,0,0],[side*(0.7+layer*0.13),-0.45,0.12],[side*(1.55+layer*0.14),-1.1-layer*0.15,0.45],[side*(1.9+layer*0.22),-2-layer*0.26,0.7],[side*(1.2+layer*0.26),-2.8-layer*0.15,1.1]],0.43-layer*0.06,layer+side,animated);
  }
  for(let bead=0;bead<18;bead++){const angle=bead/18*Math.PI*2;ellipsoid(body,pearl,[Math.cos(angle)*0.5,0.32+Math.sin(angle*3)*0.06,Math.sin(angle)*0.35],[0.024,0.025,0.024],12);}
  root.scale.setScalar(1.4);root.userData.singing=false;
  const movingMeshes = [...animated.map(entry => entry.mesh), lowerLip, ...eyelids];
  for (const group of [body, head, ...arms.flatMap(arm => [arm.shoulder, arm.forearm])]) mergeStillMeshes(group, movingMeshes);
  return {root,animate(time){
    timeUniform.value=time;body.rotation.x=-0.15+Math.sin(time*0.38)*0.13;body.rotation.z=Math.sin(time*0.32)*0.06;
    head.rotation.y=0.1+Math.sin(time*0.3)*0.14;head.rotation.z=-0.08+Math.sin(time*0.43)*0.035;
    const blink=time%5.8;eyelids.forEach(lid=>lid.visible=blink>5.56&&blink<5.76);
    lowerLip.position.y=-0.185-(root.userData.singing?(0.5+Math.sin(time*7)*0.5)*0.023:0);
    arms.forEach(({shoulder,forearm,side})=>{shoulder.rotation.z=side*(0.38+Math.sin(time*0.53+side)*0.18);shoulder.rotation.x=-0.13+Math.sin(time*0.44+side)*0.18;forearm.rotation.x=-0.3+Math.sin(time*0.57+side)*0.2;forearm.rotation.z=side*0.16;});
    for(const entry of animated){const vertices=entry.mesh.geometry.attributes.position;for(let index=0;index<vertices.count;index++){const horizontal=entry.base[index*3];const vertical=entry.base[index*3+1];const depth=entry.base[index*3+2];const weight=entry.tail?Math.max(0,-vertical)/4.2:entry.mesh.geometry.attributes.uv.getY(index);vertices.setXYZ(index,horizontal+Math.sin(time*0.9+weight*4+entry.seed)*weight*weight*(entry.tail?0.34:0.18),vertical,depth+Math.sin(time*0.65-weight*4+entry.seed)*weight*weight*(entry.tail?0.18:0.24));}vertices.needsUpdate=true;entry.mesh.geometry.computeVertexNormals();}
    const attachmentWeight=Math.max(0,-attachment.y)/4.2;
    fins.position.set(attachment.x+Math.sin(time*0.9+attachmentWeight*4)*attachmentWeight*attachmentWeight*0.34,attachment.y,attachment.z+Math.sin(time*0.65-attachmentWeight*4)*attachmentWeight*attachmentWeight*0.18);
    fins.rotation.z=Math.sin(time*0.9+4)*0.13;fins.rotation.x=Math.sin(time*0.65)*0.08;
  }};
}
