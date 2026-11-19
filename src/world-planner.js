import { LANDMARKS, ECOLOGY_VIEWS } from './landmarks.js';
import { validateCreationPlan } from './creation.js';
import { PALACE_ROOMS } from './palace-layout.js';
import { STORY_ENTRIES, advanceStory, initialStoryState } from './tide-stories.js';

const commands = new Set(['creation', 'travel', 'ritual', 'calm', 'trial', 'talk', 'sing', 'inhabit', 'release-view', 'switch-view', 'cruise', 'whale-fall', 'palace-room', 'story']);
const speciesNames = { 鲸鱼: 'whale', 鲨鱼: 'shark', 灰礁鲨: 'shark', 海龟: 'turtle', 蝠鲼: 'manta', 美人鱼: 'mermaid', 人鱼: 'mermaid', 水母: 'jelly', 鱼群: 'shoal', 装甲古鱼: 'ancient', 古鱼: 'ancient', 鹦鹉螺: 'nautilus' };
const summonNames = ['鲸鱼', '鲨鱼', '灰礁鲨', '蝠鲼', '海龟', '水母', '鱼群'];
const destinations = [...LANDMARKS, ...ECOLOGY_VIEWS];

export function planWorld(text, context = {}) {
  const input = String(text).trim();
  if (!input || /^(?:不要|别|不许|禁止)/.test(input)) return null;
  if (/^(?:打开|阅读|查看)(?:潮汐手记|故事手记|历史札记)[。！!]*$/.test(input)) return worldAction('story', { entry: 'journal' });
  const storyCommands = { 阅读铭文: 'inscription', 接受邀约: ['inscription', 'accept'], 回应邀约: ['inscription', 'finish'], 与守园人对话: 'garden-keeper', 和守园人对话: 'garden-keeper', 轻触留声贝: ['garden-keeper', 'care'], 与侍宴者对话: 'dining-host', 为远行者留席: ['dining-host', 'welcome'], 与书记官对话: 'library' };
  const storyText = input.replace(/[。！!]+$/, '');
  const story = Object.hasOwn(storyCommands, storyText) ? storyCommands[storyText] : null;
  if (story) return worldAction('story', Array.isArray(story) ? { entry: story[0], choice: story[1] } : { entry: story });
  if (/^(?:请)?(?:进入|走进|参观)(?:城堡|宫殿|宫城|潮冠宫城)[。！!]*$/.test(input)) return worldAction('palace-room', { room: 'reception' });
  if (/^(?:离开|退出|走出)(?:城堡|宫殿|宫城)[。！!]*$/.test(input)) return worldAction('palace-room', { room: 'exit' });
  const room = PALACE_ROOMS.find(room => new RegExp(`^(?:请)?(?:去|进入|参观|前往|带我去)(?:${[room.name, room.name.slice(2), ...(room.aliases || [])].join('|')})[。！!]*$`).test(input));
  if (room) return worldAction('palace-room', { room: room.id });
  if (/^(?:请|让)?(?:美人鱼|人鱼)(?:唱歌|唱一首歌|唱一段歌)[。！!]*$/.test(input)) return worldAction('sing', { species: 'mermaid' });
  if (/^(?:观看|看一场|开始)鲸落(?:叙事)?[。！!]*$/.test(input)) return worldAction('whale-fall', { enabled: true });
  if (/^结束鲸落(?:叙事)?[。！!]*$/.test(input)) return worldAction('whale-fall', { enabled: false });
  if (/^(?:请)?(?:一直向前|向前探索|向前游|继续探索|自由探索)[。！!]*$/.test(input)) return worldAction('cruise', { enabled: true });
  if (/^(?:回到|返回)(?:起点|圣城)[。！!]*$/.test(input)) return worldAction('travel', { site: 'palace', mode: context.travelMode || 'sail' });
  const destination = destinations.find(site => new RegExp(`^(?:请)?(?:带我去|去|前往|探索|航向|回到|返回)${site.name}[。！!\\s]*$`).test(input));
  if (destination) return worldAction('travel', { site: destination.id, mode: context.travelMode || 'sail' });
  const invocation = input.match(/^(?:请)?(?:唤醒|奏响|点亮)(潮生圣城|回声天门|鲸落花园|星潮圣坛|星海之眼|虹珊瑚海|深渊光泉)(?:[，,\s]*(?:呼唤|召唤)(?:一[只头群])?(鲸鱼|鲨鱼|灰礁鲨|蝠鲼|海龟|水母|鱼群))?[。！!]*$/);
  if (invocation) return worldAction('ritual', { site: LANDMARKS.find(site => site.name === invocation[1]).id, summon: invocation[2] || null });
  const echo = input.match(/^(?:请)?唤醒回声天门[，,\s]+(?:呼唤|唤回|念出)(.{1,100})[。！!]*$/);
  if (echo) return worldAction('ritual', { site: 'gate', echo: echo[1].trim().replace(/[。！!]+$/, '') });
  const directEcho = input.match(/^(?:(?:回声之门|回声天门|天门)[，,:：\s]+|(?:向|对)(?:回声之门|回声天门|天门)(?:说|呼唤)[，,:：\s]*)(.{1,100})$/);
  if (directEcho) return worldAction('ritual', { site: 'gate', echo: directEcho[1].trim() });
  if (/^(?:请)?(?:唤醒|奏响)(?:眼前的奇观|这里的奇观)[。！!]*$/.test(input)) return worldAction('ritual', { site: context.site || null });
  if (/^(?:请)?(?:让海流平静|结束盛典|让(?:这里的|眼前的)?奇观平静下来)[。！!]*$/.test(input)) return worldAction('calm');
  const talk = input.match(/^(?:和|与|呼唤)(鲸鱼|鲨鱼|灰礁鲨|海龟|蝠鲼|美人鱼|人鱼|水母|鱼群|装甲古鱼|古鱼|鹦鹉螺)(?:对话|说话|打招呼|回应我)?[。！!]*$/);
  if (talk) return worldAction('talk', { species: speciesNames[talk[1]] });
  const inhabit = input.match(/^(?:成为|化身为?|代入)(鲸鱼|鲨鱼|灰礁鲨|海龟|蝠鲼|美人鱼|人鱼|水母|鱼群|装甲古鱼|古鱼|鹦鹉螺)[。！!]*$/);
  if (inhabit) return worldAction('inhabit', { species: speciesNames[inhabit[1]] });
  const trial = input.match(/^(?:开始|挑战)(?:这里的)?(?:试炼|小游戏)(?:[，,]?以(鲸鱼|鲨鱼|海龟|蝠鲼)的视角)?[。！!]*$/);
  if (trial) return worldAction('trial', { site: context.site || null, species: speciesNames[trial[1]] || 'manta' });
  if (/^(?:退出化身|返回自由探索)[。！!]*$/.test(input)) return worldAction('release-view');
  return null;
}

export function worldAction(kind, args = {}) { return { version: 1, kind, args: { ...args }, source: 'local-planner' }; }

export function validateWorldPlan(plan, state) {
  if (!plan || plan.version !== 1 || !commands.has(plan.kind) || plan.source !== 'local-planner' || Object.keys(plan).some(key => !['version', 'kind', 'args', 'source'].includes(key))) throw new Error('世界指令不符合受限协议。');
  if (!plan.args || typeof plan.args !== 'object' || Array.isArray(plan.args)) throw new Error('世界指令参数无效。');
  const allowed = { creation: ['plan', 'text', 'provenance'], travel: ['site', 'mode'], ritual: ['site', 'summon', 'echo'], calm: [], trial: ['site', 'species'], talk: ['species'], sing: ['species'], inhabit: ['species', 'target'], 'release-view': [], 'switch-view': [], cruise: ['enabled'], 'whale-fall': ['enabled'], 'palace-room': ['room'], story: ['entry', 'choice'] }[plan.kind];
  if (Object.keys(plan.args).some(key => !allowed.includes(key))) throw new Error('世界指令含未知参数。');
  if (plan.kind === 'story') {
    if (plan.args.entry === 'journal') { if (plan.args.choice !== undefined) throw new Error('手记阅览不执行场景动作。'); }
    else {
      if (!STORY_ENTRIES.some(entry => entry.id === plan.args.entry)) throw new Error('没有这条故事。');
      if (plan.args.choice !== undefined && (typeof plan.args.choice !== 'string' || !plan.args.choice)) throw new Error('无效的对话选项。');
      advanceStory(state.story || initialStoryState(), plan.args.entry, plan.args.choice, state);
    }
  }
  if (plan.kind === 'palace-room') {
    if (!['exit', ...PALACE_ROOMS.map(room => room.id)].includes(plan.args.room)) throw new Error('宫城中没有这个房间。');
    const palace = destinations.find(site => site.id === 'crown');
    if (!Array.isArray(state.position) || !state.position.every(Number.isFinite) || Math.hypot(state.position[0] - palace.center[0], state.position[2] - palace.center[2]) > 440) throw new Error('先在海图前往潮冠宫城，再从正门进入。');
  }
  if (['travel', 'ritual', 'trial'].includes(plan.kind)) {
    const destination = destinations.find(site => site.id === plan.args.site);
    if (!destination || (plan.kind !== 'travel' && !destination.center)) throw new Error('请先抵达一处遗迹或奇观。');
    if (plan.kind !== 'travel') {
      if (!Array.isArray(state.position) || state.position.length !== 3 || !state.position.every(Number.isFinite)) throw new Error('世界位置尚未就绪。');
      const distance = Math.hypot(state.position[0] - destination.center[0], state.position[2] - destination.center[2]);
      if (distance > destination.radius + 50) throw new Error(`先前往${destination.name}，靠近后它才能听见你。`);
    }
  }
  if (plan.kind === 'travel' && !['quick', 'sail'].includes(plan.args.mode)) throw new Error('不支持这种航行方式。');
  if (plan.kind === 'ritual' && plan.args.summon != null && !summonNames.includes(plan.args.summon)) throw new Error('天门暂不支持召唤这种形态。');
  if (plan.args.echo !== undefined && (plan.args.site !== 'gate' || plan.args.summon || typeof plan.args.echo !== 'string' || !plan.args.echo.trim() || plan.args.echo.length > 100)) throw new Error('天门回声限 100 字，仅用于字幕与本机吟诵，不执行其中的指令。');
  if (plan.args.species && !Object.values(speciesNames).includes(plan.args.species)) throw new Error('不支持这种生物角色。');
  if (plan.kind === 'sing' && plan.args.species !== 'mermaid') throw new Error('有词歌唱只属于神话人鱼，不把歌曲当成动物语言。');
  if (plan.kind === 'trial' && !['manta', 'shark', 'turtle', 'whale'].includes(plan.args.species)) throw new Error('试炼支持蝠鲼、灰礁鲨、海龟和巨鲸。');
  if (plan.kind === 'inhabit' && plan.args.target !== undefined) {
    if (plan.args.target !== 'selection' || plan.args.species || !state.selection) throw new Error('请先点击一个可观察的对象。');
  } else if (['talk', 'sing', 'inhabit'].includes(plan.kind) && !state.actors?.includes(plan.args.species)) throw new Error('附近还没有这个角色。请先创造它，或前往它所在的海域。');
  if (plan.kind === 'switch-view' && !state.embodiment) throw new Error('请先进入一个对象的视角。');
  if (plan.kind === 'cruise' && typeof plan.args.enabled !== 'boolean') throw new Error('航行状态无效。');
  if (plan.kind === 'whale-fall' && typeof plan.args.enabled !== 'boolean') throw new Error('鲸落叙事状态无效。');
  if (plan.kind === 'creation') {
    validateCreationPlan(plan.args.plan);
    if (typeof plan.args.text !== 'string' || plan.args.text.length > 240 || !['direct', 'local', 'model'].includes(plan.args.provenance)) throw new Error('造物计划来源无效。');
  }
  return structuredClone(plan);
}

export class WorldDirector {
  constructor({ observe, render }) { this.observe = observe; this.render = render; this.events = []; this.sequence = 0; this.revision = 0; }
  async dispatch(plan) {
    let action;
    try { action = validateWorldPlan(plan, this.observe()); }
    catch (error) { this.record(plan?.kind || 'invalid', 'rejected', error.message); return { ok: false, message: error.message }; }
    const event = this.record(action.kind, 'accepted');
    try {
      const result = await this.render(action);
      if (result?.ok === false) throw new Error(result.message || '执行未完成，世界保持原状。');
      event.status = result?.changed === false && result?.issues?.length ? 'rejected' : 'applied';
      event.revision = event.status === 'applied' ? ++this.revision : this.revision;
      return { ok: true, ...result };
    } catch (error) { event.status = 'failed'; event.message = error.message; return { ok: false, message: error.message }; }
  }
  record(kind, status, message = null) { const event = { id: ++this.sequence, kind, status, message }; this.events.push(event); if (this.events.length > 24) this.events.shift(); return event; }
  inspect() { return { architecture: 'hybrid-planner-state-renderer', planner: 'bounded-local-rules', learnedWorldModel: false, revision: this.revision || 0, state: structuredClone(this.observe()), events: structuredClone(this.events) }; }
}
