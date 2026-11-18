export const CREATURES = Object.freeze({
  manta: { name: '澜', species: '遗迹蝠鲼', subtitle: '跟随它，去往城市深处', tone: '柔和的回声' },
  whale: { name: '溯', species: '远古巨鲸', subtitle: '听见一座海的记忆', tone: '低沉的鲸鸣' },
  jelly: { name: '星簇', species: '发光水母', subtitle: '微光，是它们的语言', tone: '闪烁的回声' },
});

export const PLACES = Object.freeze({
  threshold: { name: '潮汐之门', position: [62, 28, 178], target: [-9, 40, -79] },
  avenue: { name: '沉没长阶', position: [-14, 22, 54], target: [18, 58, -158] },
  sanctuary: { name: '回声神殿', position: [19, 40, -72], target: [18, 58, -158] },
  garden: { name: '星潮花园', position: [-67, 12, 89], target: [-43, 12, 28] },
});

export const SUGGESTIONS = Object.freeze({
  manta: ['澜，靠近一点', '带我去神殿', '绕着我游一圈'],
  whale: ['溯，游到我身边', '唱一首鲸歌', '这座城发生过什么？'],
  jelly: ['让水母亮起来', '带我去水母花园', '跟着我一起游'],
});

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function seededRandom(seed) {
  let current = seed >>> 0;
  return () => {
    current = (current * 1664525 + 1013904223) >>> 0;
    return current / 4294967296;
  };
}

export function initialState() {
  return { selected: 'manta', location: 'threshold', mood: 'day', intent: 'idle', glow: false, paused: false, met: [], memories: [], sequence: 0 };
}

export function resolveIntent(rawText, selected = 'manta') {
  const text = String(rawText || '').trim().slice(0, 160);
  if (!text) return { kind: 'empty', creature: selected, text };
  const creature = /水母|星簇|jell/i.test(text) ? 'jelly' : /鲸|溯|whale/i.test(text) ? 'whale' : /蝠鲼|澜|manta/i.test(text) ? 'manta' : selected;
  const result = { creature, text };
  if (/不要|别|不许|do not|don't/i.test(text) && /靠近|过来|带.*去|唱|跟着|follow|come|sing/i.test(text)) return { ...result, kind: 'stop' };
  if (/停|等等|等我|别动|暂停|stop|wait/i.test(text)) return { ...result, kind: 'stop' };
  if (/不要发光|关.*光|暗下来|熄灭/.test(text)) return { ...result, kind: 'glow-off', creature: 'jelly' };
  if (/回去|回到.*(起点|城门|入口)|重新出发|返回|back|reset/i.test(text)) return { ...result, kind: 'return' };
  if (/带.*(神殿|深处|城门后)|去.*(神殿|深处|城门后)|探索|lead|temple/i.test(text)) return { ...result, kind: 'guide', destination: 'sanctuary' };
  if (/去.*(花园|水母)|带.*(花园|水母)|garden/i.test(text)) return { ...result, kind: 'guide', creature: 'jelly', destination: 'garden' };
  if (/发光|亮起来|点亮|照亮|微光|light|glow/i.test(text)) return { ...result, kind: 'glow', creature: 'jelly' };
  if (/夜|暗一点|幽暗|更暗|night|dark/i.test(text)) return { ...result, kind: 'night' };
  if (/明亮|亮一点|阳光|白天|日光|day|bright/i.test(text)) return { ...result, kind: 'day' };
  if (/唱|歌|叫声|声音|sing|song/i.test(text)) return { ...result, kind: 'sing', creature: 'whale' };
  if (/绕|转.*圈|盘旋|circle/i.test(text)) return { ...result, kind: 'circle' };
  if (/跟着我|跟我|陪着我|陪我|一起游|follow/i.test(text)) return { ...result, kind: 'follow' };
  if (/离远|远一点|离开|退后|走开|away/i.test(text)) return { ...result, kind: 'away' };
  if (/靠近|近一点|过来|身边|你好|嗨|hello|come|closer/i.test(text)) return { ...result, kind: 'approach' };
  if (/你是谁|叫什么|名字|name|who/i.test(text)) return { ...result, kind: 'identity' };
  if (/记得|记忆|刚才|之前|remember/i.test(text)) return { ...result, kind: 'memory' };
  if (/发生|为什么|故事|这座城|亚特兰蒂斯|story|city/i.test(text)) return { ...result, kind: 'story' };
  return { ...result, kind: 'unknown' };
}

export function respond(state, action) {
  const next = { ...state, selected: action.creature, sequence: state.sequence + 1, met: [...state.met], memories: [...state.memories] };
  const creature = CREATURES[action.creature];
  let line = '';
  let effect = '';
  let label = '';
  if (!['empty', 'unknown'].includes(action.kind) && !next.met.includes(action.creature)) next.met.push(action.creature);
  const alreadyMet = state.met.includes(action.creature);
  switch (action.kind) {
    case 'approach':
      line = action.creature === 'whale' ? '一声悠长的鲸鸣穿过水层。巨大的身影转向你，在你身旁缓缓停留。' : action.creature === 'jelly' ? '星簇向你聚拢，伞缘的微光随着脉动一明一暗。' : alreadyMet ? '澜认出了你的呼唤。它收拢双翼，再次游到你眼前。' : '澜轻轻摆动双翼，试探着靠近。它似乎并不害怕你。';
      effect = 'approach'; label = '正在靠近你'; break;
    case 'guide':
      next.location = action.destination;
      line = action.destination === 'garden' ? '水母的微光汇成一条小径。放慢脚步，跟着它们去往星潮花园。' : `${creature.name}回头看了你一眼，转身游向长阶尽头。穿过那扇门，你会看见沉睡的神殿。`;
      effect = 'guide'; label = `带你前往${PLACES[action.destination].name}`; break;
    case 'circle':
      line = `${creature.name}绕着你画出一个缓慢的圆。视线相遇时，它又靠近了一点。`;
      effect = 'circle'; label = '围绕你游动'; break;
    case 'follow':
      line = `${creature.name}留在了你身边。现在拖动画面、继续探索，它会与你一同移动。`;
      effect = 'follow'; label = '正在与你同游'; break;
    case 'away':
      line = `${creature.name}缓缓退向远处，为你留下一片安静的水域。`;
      effect = 'away'; label = '游向远处'; break;
    case 'stop':
      line = '它感受到了你的迟疑，停下了带路。海水仍在流动，这一刻由你决定。';
      effect = 'stop'; label = '已停下，等待你'; break;
    case 'glow':
      next.glow = true;
      line = '一只水母先亮了起来，随后是整个星簇。古城的轮廓，在微光里重新浮现。';
      effect = 'glow'; label = '微光正在扩散'; break;
    case 'glow-off':
      next.glow = false;
      line = '星簇收起了明亮的光芒，只留下安静的轮廓。';
      effect = 'glow-off'; label = '恢复柔和微光'; break;
    case 'sing':
      line = '溯扬起头，唱出一段低沉的旋律。声波掠过断柱，像在呼唤一段久远的记忆。';
      effect = 'sing'; label = '鲸歌回荡 · 开启声音可听见'; break;
    case 'night':
      next.mood = 'night';
      line = '上方的天光缓缓隐去。远处的城市沉入深蓝，生命的微光变得清晰。';
      effect = 'night'; label = '切换至幽蓝深海'; break;
    case 'day':
      next.mood = 'day';
      line = '天光重新穿过海面，在古老的石阶上留下流动的纹路。';
      effect = 'day'; label = '天光重新洒落'; break;
    case 'return':
      next.location = 'threshold';
      line = '你们沿着原路游回潮汐之门。那座城仍在原处，澜也还记得你。';
      effect = 'return'; label = '返回潮汐之门'; break;
    case 'identity':
      line = action.creature === 'manta' ? '它用翼尖划过水流，像在写一个名字：澜。这片遗迹，是它熟悉的家。' : action.creature === 'whale' ? '低频的回声里，你想起了一个字：溯。它从很远的海域而来。' : '它们没有单独的名字。每次光芒汇聚时，你便叫它们：星簇。';
      effect = 'acknowledge'; label = '回应了你的询问'; break;
    case 'story':
      line = action.creature === 'whale' ? '鲸鸣在穹顶间回荡。你想象着：潮水带走了人们，海洋却让这座城以另一种方式活了下来。' : '它望向覆满珊瑚的高塔。你想象着：这里不再有人，生命却从未离开。';
      effect = 'acknowledge'; label = '一段想象性的海洋回声'; break;
    case 'memory':
      line = state.memories.length ? `你还记得${state.memories.at(-1)}。${creature.name}轻轻回应，探索的痕迹仍留在这片海里。` : '你们的故事才刚刚开始。试着邀请它靠近，再一起去看看那座城。';
      effect = 'acknowledge'; label = '回望本次探索'; break;
    default:
      line = '这道回声还没有被理解。试着说“靠近一点”“带我去神殿”或“等等”。本原型使用本地意图规则，不支持任意对话。';
      label = '未识别 · 试试下方邀请';
  }
  if (effect && !['acknowledge', 'night', 'day'].includes(effect)) next.intent = effect;
  if (action.kind === 'guide') next.memories.push(`一起游向${PLACES[action.destination].name}的时刻`);
  if (action.kind === 'glow') next.memories.push('星簇为你亮起的时刻');
  if (action.kind === 'sing') next.memories.push('鲸歌在古城回荡的时刻');
  next.memories = next.memories.slice(-12);
  return { state: next, line, effect, label };
}

export function readMemory(raw) {
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.met) || !Array.isArray(value.memories)) return null;
    return {
      met: [...new Set(value.met.filter(item => Object.hasOwn(CREATURES, item)))],
      memories: value.memories.filter(item => typeof item === 'string').map(item => item.slice(0, 100)).slice(-12),
    };
  } catch {
    return null;
  }
}
