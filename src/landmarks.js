export const LANDMARKS = Object.freeze([
  { id: 'palace', name: '潮生圣城', english: 'THE PALACE OF TIDES', number: '01', center: [20, 45, -167], camera: [73, 26, 174], target: [-11, 48, -117], radius: 390, color: '#244c4e', caption: '石阶之上，时间被潮汐留住。', invitation: '在神殿上方创造一头发光的鲸鱼', gesture: '用语言添上第一个生命。', kind: 'city' },
  { id: 'gate', name: '回声天门', english: 'THE GATE OF ECHOES', number: '02', center: [495, 38, -245], camera: [545, 31, -88], target: [495, 55, -245], radius: 190, color: '#285359', caption: '无人记得门的另一端。海水记得。', invitation: '在前方创造一群发光的水母', gesture: '靠近石环，观察沉睡的刻纹。', kind: 'gate' },
  { id: 'garden', name: '鲸落花园', english: 'WHERE GIANTS BECOME GARDENS', number: '03', center: [-530, 12, -325], camera: [-477, 33, -217], target: [-530, 7, -325], radius: 190, color: '#225357', caption: '巨兽沉眠之处，另一片森林诞生。', invitation: '在前方创造三丛金色珊瑚', gesture: '点击海床，让新的生命从这里生长。', kind: 'garden' },
  { id: 'choir', name: '星潮圣坛', english: 'THE LANTERN CHOIR', number: '04', center: [70, 32, -1020], camera: [108, 25, -902], target: [70, 24, -1020], radius: 200, color: '#103448', caption: '没有语言，仍然能够彼此回应。', invitation: '在前方创造一只发光的蝠鲼', gesture: '让蝠鲼跟随你，再继续向远处游。', kind: 'choir' },
  { id: 'vortex', name: '星海之眼', english: 'THE EYE OF A THOUSAND TIDES', number: '05', center: [980, 78, -620], camera: [1010, 52, -398], target: [980, 76, -620], radius: 265, color: '#0b3445', caption: '千万道微光，汇成深海的瞳孔。', invitation: '唤醒星海之眼', gesture: '输入“唤醒星海之眼”，看鱼群展开，再重新汇聚。', kind: 'vortex', wonder: true, nocturne: 0.8 },
  { id: 'prism', name: '虹珊瑚海', english: 'THE GARDEN OF REFRACTED LIGHT', number: '06', center: [-880, 20, -1030], camera: [-812, 36, -866], target: [-880, 27, -1030], radius: 245, color: '#153a48', caption: '一束光经过，整片花园开始呼吸。', invitation: '唤醒虹珊瑚海', gesture: '输入“唤醒虹珊瑚海”，让光沿着珊瑚层层传开。', kind: 'prism', wonder: true, nocturne: 0.65 },
  { id: 'vents', name: '深渊光泉', english: 'THE FOUNTAINS BENEATH THE WORLD', number: '07', center: [760, 45, -1530], camera: [818, 40, -1330], target: [760, 55, -1530], radius: 255, color: '#122d40', caption: '海底的星火，向失落的天空升起。', invitation: '唤醒深渊光泉', gesture: '输入“唤醒深渊光泉”，让沉睡的光泉再次喷涌。', kind: 'vents', wonder: true, nocturne: 0.95 },
]);

export const ECOLOGY_VIEWS = Object.freeze([
  { id: 'reef-closeup', name: '珊瑚近岸', camera: [-98, 3, 201], target: [-105, 3, 161], caption: '从海扇的细枝之间，看见另一座活着的城。', gesture: '试试“创造三只鹦鹉螺”，再让它们慢慢游。' },
  { id: 'ancient-closeup', name: '古鱼巡游', camera: [8, 32, 105], target: [18, 30, 34], caption: '鳞甲记录潮汐，巨兽经过千年。', gesture: '装甲古鱼是幻想生物，并非科学复原；可创造属于你的同类。' },
]);

export function ecologyViewRequest(text) {
  return ECOLOGY_VIEWS.find(view => new RegExp(`^(?:请)?(?:带我去|去|前往|观察)${view.name}[。！!\\s]*$`).test(String(text).trim())) || null;
}

export function wonderRequest(text, nearby) {
  const match = String(text).trim().match(/^(?:请)?(唤醒|点亮)(星海之眼|虹珊瑚海|深渊光泉|这里的奇观|眼前的奇观)[。！!]*$/);
  if (match) return { id: LANDMARKS.find(landmark => landmark.wonder && landmark.name === match[2])?.id || (nearby?.wonder ? nearby.id : null), kind: 'awaken' };
  if (/^(?:请)?让(?:这里的|眼前的)?奇观平静下来[。！!]*$/.test(String(text).trim())) return { id: nearby?.wonder ? nearby.id : null, kind: 'calm' };
  return null;
}

export function nearestLandmark(position) {
  return LANDMARKS.map(landmark => ({ ...landmark, distance: Math.hypot(position[0] - landmark.center[0], position[2] - landmark.center[2]) })).sort((first, second) => first.distance - second.distance)[0];
}

export function localLandmark(position) {
  const nearest = nearestLandmark(position);
  return nearest.distance <= nearest.radius ? nearest : null;
}

export function landmarkRequest(text) {
  if (!/^(?:请)?(?:带我去|去|前往|探索|航向|回到|返回)/.test(text)) return null;
  return LANDMARKS.find(landmark => new RegExp(`^(?:请)?(?:带我去|去|前往|探索|航向|回到|返回)${landmark.name}[。！!\\s]*$`).test(text)) || null;
}

export function withinLandmark(horizontal, depth, margin = 0) {
  return LANDMARKS.some(landmark => landmark.kind !== 'city' && Math.hypot(horizontal - landmark.center[0], depth - landmark.center[2]) < landmark.radius * 0.68 + margin);
}
