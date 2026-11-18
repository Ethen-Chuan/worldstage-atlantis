export const REGIONS = Object.freeze({
  city: { name: '潮生圣城', english: 'THE PALACE OF TIDES', number: '01', destination: 'threshold', origin: [0, 0, 0], depth: 148, description: '让语言成为潮汐，让想象生长为世界。', fog: '#21484c', density: 0.0024 },
  reef: { name: '珊瑚浅海', english: 'THE LIVING REEF', number: '02', destination: 'reef', origin: [-650, 0, 100], depth: 52, description: '阳光流过珊瑚台地，银色鱼群在花丛中聚散。', fog: '#368c91', density: 0.0032 },
  garden: { name: '星潮花园', english: 'THE LANTERN GARDEN', number: '03', destination: 'garden', origin: [640, 0, 0], depth: 260, description: '巨大的水母垂下光帘，每一次脉动都彼此呼应。', fog: '#20465c', density: 0.0042 },
  trench: { name: '幽暗海沟', english: 'THE SILENT ABYSS', number: '04', destination: 'trench', origin: [180, 0, -890], depth: 1260, description: '越过玄武岩裂谷，热泉与沉船在深处等待回应。', fog: '#183848', density: 0.0044 },
});

export const PLACES = Object.freeze({
  threshold: { name: '潮生圣城', region: 'city', position: [73, 26, 174], target: [-11, 48, -117] },
  avenue: { name: '沉没长阶', region: 'city', position: [-14, 22, 54], target: [18, 65, -158] },
  sanctuary: { name: '回声神殿', region: 'city', position: [19, 40, -72], target: [18, 82, -158] },
  reef: { name: '珊瑚浅海', region: 'reef', position: [-594, 25, 239], target: [-650, 17, 84] },
  garden: { name: '星潮花园', region: 'garden', position: [675, 24, 142], target: [637, 37, -18] },
  trench: { name: '幽暗海沟', region: 'trench', position: [186, 38, -716], target: [175, 25, -923] },
});

export const EVENTS = Object.freeze({
  crown: { region: 'city', name: '潮汐之环', command: '用鲸歌唤醒潮汐之环', hint: '让沉寂的环纹逐层亮起', line: '鲸歌穿过石缝。失落的潮汐之环，一层一层回应了你。', position: [18, 116, -196] },
  bells: { region: 'city', name: '回声钟', command: '敲响回声钟', hint: '让声波穿过长阶与断柱', line: '一声钟响，回声越过长阶与断柱，向整座城扩散。', position: [-27, 46, 26] },
  coral: { region: 'reef', name: '珊瑚花圃', command: '让珊瑚绽放', hint: '珊瑚虫舒展，也可以让它们收拢', line: '珊瑚虫缓缓舒展。花圃从岩台边缘一直盛开到远处。', position: [-650, 16, 119] },
  shoal: { region: 'reef', name: '银鱼旋流', command: '让鱼群围着我游', hint: '聚成旋流，也可以让鱼群散开', line: '鱼群改变了队形，银色的旋流在你面前围成一个圆。', position: [-663, 28, 90] },
  choir: { region: 'garden', name: '水母共鸣', command: '让水母同步发光，变成粉色', hint: '同步脉动；光色支持粉、蓝、金、珍珠', line: '一只水母先亮起。随后，整个花园开始同频呼吸。', position: [640, 51, -22] },
  path: { region: 'garden', name: '星光小径', command: '点亮星光小径', hint: '让海床上的光点接连亮起', line: '足下的光点接连亮起，一条蜿蜒的小径通向光帘深处。', position: [631, 4, 62] },
  wreck: { region: 'trench', name: '迷失的沉船', command: '用声呐寻找沉船', hint: '声呐显露裂谷里的古船轮廓', line: '声呐扫过裂谷。失落的船肋与桅杆，从黑暗里浮现。', position: [175, 20, -906] },
  vents: { region: 'trench', name: '深海热泉', command: '让热泉喷涌', hint: '唤起上升的矿物羽流', line: '热泉开始喷涌，细密的矿物羽流向上升起。', position: [127, 17, -855] },
});

export const EXAMPLES = Object.freeze({
  manta: [{ label: '一起慢游', text: '澜，慢慢带我去珊瑚浅海，到达后让珊瑚绽放' }, { label: '边游边调整', text: '澜，再近一点，陪我一起游' }, { label: '探访星潮', text: '带我去星潮花园，到达后点亮星光小径' }],
  whale: [{ label: '带着条件探索', text: '让鲸鱼远一点，慢慢带我去海沟，但保持明亮' }, { label: '让遗迹回应', text: '用鲸歌唤醒潮汐之环' }, { label: '寻找沉船', text: '溯，带我去海沟，到达后用声呐寻找沉船' }],
  jelly: [{ label: '改变光的颜色', text: '让水母靠近一点，发光，变成粉色' }, { label: '同游花园', text: '星簇，慢慢带我去花园，到达后点亮小径' }, { label: '接着调整', text: '再近一点，换成蓝色' }],
});
