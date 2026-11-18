import { CREATURES, clamp, initialState as baseState } from './core.js';
import { EVENTS, PLACES, REGIONS } from './world.js';

export function initialState() {
  return { ...baseState(), destination: null, lastDestination: null, interrupted: false, history: [], speed: 1, distances: { manta: 1, whale: 1, jelly: 1 }, jellyColor: 'pearl', events: {}, pending: [] };
}

export const ACTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    operations: { type: 'array', maxItems: 12, items: {
      type: 'object', additionalProperties: false,
      properties: {
        kind: { type: 'string', enum: ['guide', 'back', 'resume', 'stop', 'distance', 'speed', 'follow', 'circle', 'day', 'night', 'glow', 'glow-off', 'color', 'sing', 'event', 'identity', 'memory', 'story'] },
        creature: { type: 'string', enum: Object.keys(CREATURES) },
        destination: { type: ['string', 'null'], enum: [...Object.keys(PLACES), null] },
        event: { type: ['string', 'null'], enum: [...Object.keys(EVENTS), null] },
        value: { type: ['number', 'string', 'boolean', 'null'] },
        afterArrival: { type: 'boolean' },
      }, required: ['kind', 'creature', 'destination', 'event', 'value', 'afterArrival'],
    } },
    issues: { type: 'array', maxItems: 6, items: { type: 'string' } },
  }, required: ['operations', 'issues'],
};

const allowedKinds = ACTION_SCHEMA.properties.operations.items.properties.kind.enum;
export function validatePlan(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.operations) || value.operations.length > 12 || !Array.isArray(value.issues) || value.issues.length > 6) throw new Error('模型返回的指令格式不正确，未执行。');
  const operations = value.operations.map(action => {
    if (!action || !allowedKinds.includes(action.kind) || !Object.hasOwn(CREATURES, action.creature) || typeof action.afterArrival !== 'boolean') throw new Error('模型返回了不支持的动作，未执行。');
    if (Object.keys(action).some(key => !['kind', 'creature', 'destination', 'event', 'value', 'afterArrival'].includes(key))) throw new Error('模型返回了额外指令，未执行。');
    if (action.kind === 'guide' && !Object.hasOwn(PLACES, action.destination)) throw new Error('目的地不在这片海中，未执行。');
    if (action.kind === 'event' && (!Object.hasOwn(EVENTS, action.event) || typeof action.value !== 'boolean')) throw new Error('交互事件不受支持，未执行。');
    if (action.kind === 'distance' && (!Number.isFinite(action.value) || Math.abs(action.value) > 0.6 || action.value === 0)) throw new Error('距离调整超出安全范围，未执行。');
    if (action.kind === 'speed' && (!Number.isFinite(action.value) || action.value < 0.35 || action.value > 1.8)) throw new Error('游动速度超出范围，未执行。');
    if (action.kind === 'color' && !['rose', 'blue', 'gold', 'pearl'].includes(action.value)) throw new Error('暂不支持这种光色，未执行。');
    return { kind: action.kind, creature: action.creature, destination: action.destination || null, event: action.event || null, value: action.value ?? null, afterArrival: action.afterArrival };
  });
  if (value.issues.some(item => typeof item !== 'string' || item.length > 180)) throw new Error('模型返回的说明格式不正确，未执行。');
  return { operations, issues: [...value.issues] };
}

const entityPattern = /水母(?!花园)|星簇|jell(?:y|ies)?|鲸鱼?|巨鲸|溯|whale|蝠鲼|澜|manta/gi;
function entityIn(text, fallback) {
  const cleaned = text.replace(/水母花园/g, '花园');
  if (/水母|星簇|jell/i.test(cleaned)) return 'jelly';
  if (/鲸|溯|whale/i.test(cleaned)) return 'whale';
  if (/蝠鲼|澜|manta/i.test(cleaned)) return 'manta';
  return fallback;
}

export function interpretUtterance(rawText, state = initialState()) {
  const text = String(rawText || '').trim().slice(0, 240);
  const operations = [];
  const issues = [];
  if (!text) return { text, operations, issues };
  let creature = state.selected;
  let afterArrival = false;
  const push = operation => operations.push({ creature, destination: null, event: null, value: null, afterArrival, ...operation });
  if (/^(?:请|先)?(?:等等|等一下|停一下|停下来|停下|暂停|停止|别动|stop|wait)[\s，,。.!！]*$/i.test(text) || /等等[，,]|停一下[，,]/.test(text)) {
    push({ kind: 'stop', afterArrival: false });
    return { text, operations, issues };
  }
  const clauses = text.replace(/(?:到达后|到了之后|到了以后|抵达后)/g, '，@').split(/[，,。;；！!？?]|然后|接着|并且|同时|但是|不过|而且|但|并/).filter(Boolean);
  for (const original of clauses) {
    let clause = original.trim();
    if (clause.includes('@')) { afterArrival = true; clause = clause.replace('@', ''); }
    creature = entityIn(clause, creature);
    const take = (pattern, operation) => {
      const match = clause.match(pattern);
      if (!match) return false;
      clause = clause.replace(pattern, '');
      if (operation) push(typeof operation === 'function' ? operation(match) : operation);
      return true;
    };
    if (/不要|别|不许|不想|不用/.test(clause)) {
      if (/发光|亮起|微光/.test(clause)) push({ kind: 'glow-off', creature: 'jelly', afterArrival: false });
      else if (/变暗|暗下来|黑|夜/.test(clause)) push({ kind: 'day', afterArrival: false });
      else if (/靠近|唱|跟|带|游|去/.test(clause)) push({ kind: 'stop', afterArrival: false });
      else issues.push(`未执行否定要求「${original.trim().slice(0, 60)}」`);
      continue;
    }
    if (take(/(?:回到?|返回)(?:刚才|之前|上一个)(?:那里|的地方|海域|地方)?/, { kind: 'back', afterArrival: false })) continue;
    take(/回到?(?:入口|起点|城门|潮汐之门)|返回起点|重新出发|^回去$|^返回$|\bback\b|\breset\b/i, { kind: 'guide', destination: 'threshold', afterArrival: false });
    take(/(?:慢慢|缓缓|慢一点|再慢一点|放慢|慢些|慢速)/, { kind: 'speed', value: 0.55, afterArrival: false });
    take(/(?:快一点|再快一点|加快|快速|快些)/, { kind: 'speed', value: 1.65, afterArrival: false });
    take(/(?:正常速度|恢复速度)/, { kind: 'speed', value: 1, afterArrival: false });
    take(/(?:保持明亮|保持亮度|明亮一点|更明亮|亮一点|天亮|阳光|白天|日光|bright|day)/i, { kind: 'day', afterArrival: false });
    take(/(?:暗一点|更暗|夜晚|夜色|黑夜|天黑|night|dark)/i, { kind: 'night', afterArrival: false });
    take(/(?:变成|换成|改成|变为)?(粉色|蓝色|金色|珍珠色|白色)/, match => ({ kind: 'color', creature: 'jelly', value: { 粉色: 'rose', 蓝色: 'blue', 金色: 'gold', 珍珠色: 'pearl', 白色: 'pearl' }[match[1]] }));
    take(/(?:再)?(?:靠近(?:一点|一些)?|近一点|过来|游到我身边|到我身边|closer|come)/i, { kind: 'distance', value: -0.22, afterArrival: false });
    take(/(?:再)?(?:远一点|远一些|离远一点|退后|走远|离开|away)/i, { kind: 'distance', value: 0.38, afterArrival: false });
    take(/绕(?:着我)?(?:游)?一圈|绕圈|盘旋|circle/i, { kind: 'circle' });
    take(/跟着我|跟我|陪着我|陪我(?:一起游)?|一起游|follow/i, { kind: 'follow' });
    take(/停一下|停下|停止|等等|等我|stop|wait/i, { kind: 'stop', afterArrival: false });
    take(/(?:恢复|继续)(?:带路|前进|游动|刚才的旅程|走)?/, { kind: 'resume', afterArrival: false });
    take(/(?:用)?(?:鲸歌|唱(?:一首)?(?:鲸)?歌|唱一段|唱歌|sing|song)/i, { kind: 'sing', creature: 'whale' });
    take(/(?:唤醒|激活|点亮)(?:潮汐之环|潮汐环|潮环|环纹)/, { kind: 'event', event: 'crown', value: true });
    take(/(?:敲响|敲|唤醒)(?:回声钟|古钟|钟)/, { kind: 'event', event: 'bells', value: true });
    take(/(?:让)?珊瑚(?:虫)?(?:绽放|开放|盛开|展开)|(?:绽放|开放)(?:珊瑚|花圃)/, { kind: 'event', event: 'coral', value: true });
    take(/(?:让)?珊瑚(?:虫)?(?:收起|收拢|闭合)/, { kind: 'event', event: 'coral', value: false });
    take(/(?:让)?鱼群(?:围着我(?:游)?|聚拢|聚集|围成圈)|(?:聚拢|聚集)鱼群/, { kind: 'event', event: 'shoal', value: true });
    take(/(?:让)?鱼群(?:散开|散去|游开)|(?:散开|驱散)鱼群/, { kind: 'event', event: 'shoal', value: false });
    take(/(?:让)?(?:水母)?(?:一起|同步|同频)(?:发光|闪烁|脉动)/, { kind: 'event', event: 'choir', value: true, creature: 'jelly' });
    take(/(?:点亮|照亮|唤醒)(?:星光|发光)?小径/, { kind: 'event', event: 'path', value: true });
    take(/(?:用)?(?:声呐)?(?:寻找|找到|扫描|照亮|显露)(?:迷失的)?(?:沉船|古船|遗骸)|(?:用)?声呐(?:扫描|探测)?/, { kind: 'event', event: 'wreck', value: true });
    take(/(?:让|唤醒|激活)?(?:深海)?热泉(?:喷涌|喷发|苏醒)?/, { kind: 'event', event: 'vents', value: true });
    const placeMatch = clause.match(/(?:带我|带着我)?(?:游向|前往|去往|去|到|探索|看看)(?:沉没王城|王城|亚特兰蒂斯|神殿|长阶|珊瑚浅海|珊瑚海|浅海|星潮花园|水母花园|花园|幽暗海沟|海沟|深渊)/);
    if (placeMatch) {
      const name = placeMatch[0];
      const destination = /神殿/.test(name) ? 'sanctuary' : /长阶/.test(name) ? 'avenue' : /珊瑚|浅海/.test(name) ? 'reef' : /花园/.test(name) ? 'garden' : /海沟|深渊/.test(name) ? 'trench' : 'threshold';
      clause = clause.replace(name, '');
      push({ kind: 'guide', destination, afterArrival: false });
    }
    take(/(?:亮起来|发光|点亮|照亮|微光|glow)/i, { kind: 'glow', creature: 'jelly' });
    take(/(?:熄灭|关掉灯光|收起光芒)/, { kind: 'glow-off', creature: 'jelly' });
    take(/(?:你是谁|叫什么|名字|name|who)/i, { kind: 'identity' });
    take(/(?:你)?(?:还)?记得(?:刚才|之前|什么|吗)?|回忆|remember/i, { kind: 'memory' });
    take(/(?:这里|这座城)?(?:发生过什么|发生了什么|有什么故事)|讲(?:个|一个)?故事|story/i, { kind: 'story' });
    take(/(?:你好|嗨|hello)/i, { kind: 'distance', value: -0.22 });
    const leftover = clause.replace(entityPattern, '').replace(/请|让|把|帮我|为我|给我|一下|一些|一点|再|继续|保持|缓慢地|缓慢|慢慢地|的|吧|了|它们|它|你|我|和|与|一起|也|着|地|\s/g, '');
    if (leftover) issues.push(`暂不支持「${leftover.slice(0, 50)}」`);
  }
  if (!operations.length && text.replace(entityPattern, '').replace(/[，,\s]/g, '') === '') push({ kind: 'distance', value: -0.22 });
  const guide = operations.findLast(action => action.kind === 'guide');
  if (guide) for (const operation of operations) if (operation.kind === 'event' && EVENTS[operation.event].region === PLACES[guide.destination].region) operation.afterArrival = true;
  return { text, operations: operations.slice(0, 12), issues: issues.slice(0, 6) };
}

export function describeAction(action) {
  const name = CREATURES[action.creature]?.name || '';
  const descriptions = {
    guide: `前往${PLACES[action.destination]?.name || ''}`, back: '回到上一处海域', stop: '停止带路与动作', resume: '继续刚才的旅程',
    speed: action.value < 1 ? '慢速同行' : action.value > 1 ? '加快游动' : '恢复正常速度', distance: `${name} · ${action.value < 0 ? '再近一些' : '留远一些'}`,
    day: '保持明亮', night: '切换夜色', glow: '水母发光', 'glow-off': '收起微光', color: `光色 · ${{ rose: '粉色', blue: '蓝色', gold: '金色', pearl: '珍珠色' }[action.value] || ''}`,
    circle: `${name}绕圈`, follow: `${name}与你同游`, sing: '唱出鲸歌', identity: '认识伙伴', memory: '回望本次探索', story: '倾听幻想故事',
    event: `${action.value === false ? '收起' : '唤起'}${EVENTS[action.event]?.name || ''}`,
  };
  return `${action.afterArrival ? '抵达后 · ' : ''}${descriptions[action.kind] || action.kind}`;
}

function applyOperation(state, action) {
  const next = { ...state, distances: { ...state.distances }, events: { ...state.events }, met: [...state.met], memories: [...state.memories], pending: [...state.pending], history: [...state.history] };
  const creature = CREATURES[action.creature];
  let line = '';
  next.selected = action.creature;
  if (['distance', 'follow', 'circle', 'guide', 'sing', 'identity', 'color', 'glow', 'glow-off'].includes(action.kind)) {
    if (!next.met.includes(action.creature)) next.met.push(action.creature);
  }
  switch (action.kind) {
    case 'distance': next.distances[action.creature] = clamp(next.distances[action.creature] + action.value, 0.55, 2.2); line = `${creature.name}${action.value < 0 ? '向你靠近了一些' : '退向稍远的水域'}。可以接着说“再近一点”或“慢一点”。`; break;
    case 'guide': next.destination = action.destination; next.lastDestination = action.destination; next.interrupted = false; next.pending = []; line = `${creature.name}带你游向${PLACES[action.destination].name}。`; break;
    case 'stop': next.interrupted = Boolean(state.destination || state.interrupted); next.destination = null; next.pending = []; line = '带路停了下来，未完成的抵达后事件已取消。已经改变的世界仍然保留。'; break;
    case 'speed': next.speed = action.value; line = action.value < 1 ? '你们放慢了速度，正在进行的旅程也会随之调整。' : '游动速度已调整，距离和天光仍沿用刚才的约定。'; break;
    case 'day': next.mood = 'day'; line = '保留明亮的天光，不因前往更深的海域而自动切换夜色。'; break;
    case 'night': next.mood = 'night'; line = '天光缓缓隐去，海洋生命的微光浮现。'; break;
    case 'glow': next.glow = true; line = '星簇亮起微光。还可以说“换成粉色”或“再近一点”。'; break;
    case 'glow-off': next.glow = false; line = '星簇收起了明亮的光芒。'; break;
    case 'color': next.jellyColor = action.value; line = `星簇回应了你的颜色，光芒变成${{ rose: '粉色', blue: '蓝色', gold: '金色', pearl: '珍珠色' }[action.value]}。`; break;
    case 'event': next.events[action.event] = action.value; line = action.value === false ? `${EVENTS[action.event].name}恢复原来的姿态。` : EVENTS[action.event].line; next.memories.push(`${action.value === false ? '收起' : '唤起'}${EVENTS[action.event].name}的时刻`); if (action.event === 'choir') next.glow = action.value; break;
    case 'sing': line = '鲸歌在水中化作一道道涟漪。开启声音，可以听到程序合成的低频回响。'; next.memories.push('鲸歌穿过水层的时刻'); break;
    case 'follow': line = `${creature.name}会跟着你的视角移动，保持刚才约定的距离和速度。`; break;
    case 'circle': line = `${creature.name}在你面前缓缓绕圈。可以调整距离，或随时让它停下。`; break;
    case 'identity': line = `${creature.name}，${creature.species}。${creature.subtitle}。`; break;
    case 'memory': line = next.memories.length ? `这片海记得${next.memories.at(-1)}。还可以说“回刚才那里”。` : '探索才刚刚开始。世界的变化，会留在这次旅程里。'; break;
    case 'story': line = '你想象着：人类离开以后，珊瑚攀上了古城，鲸歌成了这里新的钟声。海没有把它遗忘。'; break;
  }
  next.intent = action.kind;
  next.memories = next.memories.slice(-12);
  return { state: next, line };
}

export function executeUtterance(state, plan) {
  let next = { ...state, sequence: state.sequence + 1 };
  const effects = [];
  const accepted = [];
  const issues = [...plan.issues];
  let line = '';
  const finalGuide = plan.operations.findLast(action => action.kind === 'guide');
  if (plan.operations.filter(action => action.kind === 'guide').length > 1) issues.push('一次旅程只前往一个目的地，已采用最后一个目的地。');
  const operations = plan.operations.filter(action => action.kind !== 'guide' || action === finalGuide).map(action => action.kind === 'event' && finalGuide && EVENTS[action.event].region === PLACES[finalGuide.destination].region ? { ...action, afterArrival: true } : action);
  operations.sort((first, second) => Number(first.afterArrival) - Number(second.afterArrival));
  for (const original of operations) {
    let action = { ...original };
    if (action.kind === 'back') {
      if (!next.history.length) { issues.push('还没有上一处海域；可以先邀请伙伴带路。'); continue; }
      action = { ...action, kind: 'guide', destination: next.history.at(-1) };
    }
    if (action.kind === 'resume') {
      if (!next.lastDestination || !next.interrupted) { issues.push('没有待继续的旅程。'); continue; }
      action = { ...action, kind: 'guide', destination: next.lastDestination };
    }
    if (action.kind === 'event') {
      const region = EVENTS[action.event].region;
      if (next.destination && PLACES[next.destination].region === region) action.afterArrival = true;
      else if (PLACES[next.location].region !== region) { issues.push(`${EVENTS[action.event].name}在${REGIONS[region].name}，请先前往那里。`); continue; }
    }
    if (action.afterArrival && action.kind !== 'guide') {
      if (!next.destination) { issues.push('没有正在前往的目的地，“抵达后”的要求暂未执行。'); continue; }
      next = { ...next, pending: [...next.pending, action] };
      accepted.push(action);
      continue;
    }
    const result = applyOperation(next, action);
    next = result.state;
    line = result.line || line;
    accepted.push(action);
    effects.push(action);
  }
  const guide = effects.findLast(action => action.kind === 'guide');
  if (guide && next.destination) line = `${CREATURES[guide.creature].name}带你游向${PLACES[guide.destination].name}。${next.pending.length ? `抵达后回应${next.pending.length}个约定，途中可以随时叫停。` : '速度、距离与天光，都可以接着调整。'}`;
  if (!accepted.length) line = '这次没有改变世界。当前未能识别可执行的探索或互动要求。';
  return { state: next, effects, accepted, issues, line };
}

export function arriveAt(state, destination) {
  const history = state.location === destination ? [...state.history] : [...state.history, state.location].slice(-12);
  let next = { ...state, location: destination, destination: null, interrupted: false, history, pending: [], memories: [...state.memories, `抵达${PLACES[destination].name}的时刻`].slice(-12) };
  const effects = [];
  let line = `已抵达${PLACES[destination].name}。${REGIONS[PLACES[destination].region].description}`;
  for (const pending of state.pending) {
    const action = { ...pending, afterArrival: false };
    if (action.kind === 'event' && EVENTS[action.event].region !== PLACES[destination].region) continue;
    const result = applyOperation(next, action);
    next = result.state;
    line = result.line || line;
    effects.push(action);
  }
  return { state: next, effects, line };
}

export function interruptJourney(state) { return { ...state, destination: null, interrupted: Boolean(state.destination || state.interrupted), pending: [], intent: 'stop' }; }
