import { seaHeight } from './terrain.js';
export const ASSETS = Object.freeze({ temple: '环形神殿', arch: '潮汐拱门', gate: '潮汐星门', coral: '珊瑚花园', whale: '远古巨鲸', manta: '远洋蝠鲼', jelly: '水母群', shoal: '银色鱼群', trident: '海神三叉戟', ancient: '装甲古鱼', turtle: '海龟', nautilus: '鹦鹉螺', mermaid: '珍珠人鱼' });
export const LIVING_ASSETS = ['whale', 'manta', 'jelly', 'shoal', 'ancient', 'turtle', 'nautilus', 'mermaid'];
export const COLORS = Object.freeze({ gold: '#d7af62', teal: '#68a897', pearl: '#d7d6b8', rose: '#ca8c95', blue: '#779fc2' });
export const CREATION_EXAMPLES = [
  { label: '与海龟一起探索', text: '创造一只海龟，然后让它跟随我' },
  { label: '召唤远古巨鱼', text: '在前方创造一头巨大的远古巨鱼' },
  { label: '遇见珍珠人鱼', text: '在前方创造一位人鱼' },
];
const properties = ['scale', 'height', 'speed', 'color', 'glow', 'weathering', 'spread'];
const kinds = ['create', 'modify', 'orbit', 'resonate', 'follow', 'release', 'delete', 'undo', 'redo', 'pause', 'resume', 'light'];
export const CREATION_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['operations', 'issues'],
  properties: {
    operations: { type: 'array', maxItems: 12, items: {
      type: 'object', additionalProperties: false,
      required: ['kind', 'target', 'asset', 'placement', 'count', 'property', 'value', 'reference'],
      properties: {
        kind: { type: 'string', enum: kinds }, target: { type: ['string', 'null'] },
        asset: { type: ['string', 'null'], enum: [...Object.keys(ASSETS), null] },
        placement: { type: ['string', 'null'], enum: ['front', 'left', 'right', 'far', 'above', 'here', null] },
        count: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
        property: { type: ['string', 'null'], enum: [...properties, null] },
        value: { type: ['number', 'string', 'boolean', 'null'] }, reference: { type: ['string', 'null'] },
      },
    } },
    issues: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 180 } },
  },
};
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const clone = value => structuredClone(value);
const defaults = asset => ({ scale: 1, height: 0, speed: 1, color: asset === 'coral' ? 'gold' : asset === 'jelly' ? 'pearl' : 'teal', glow: false, weathering: 0.35, spread: 1 });
const entity = (id, asset, position, params = {}, preset = false) => ({ id, asset, name: `${ASSETS[asset]} · ${id.replace('form-', '')}`, position, params: { ...defaults(asset), ...params }, orbit: null, resonance: null, following: false, preset });

export function initialCreation() {
  return {
    entities: [
      entity('form-01', 'temple', [20, -7, -167], { scale: 2.1, color: 'gold', weathering: 0.42 }, true),
      entity('form-02', 'trident', [-8, -5, 21], { scale: 1.1, color: 'gold' }, true),
      entity('form-03', 'coral', [-37, -6, 59], { scale: 1.2, color: 'gold' }, true),
      entity('form-04', 'whale', [-5, 58, -36], { scale: 0.75, color: 'teal', speed: 0.6 }, true),
    ], selected: null, lastCreated: [], focused: {}, nextId: 5, lighting: 'sunlit', paused: false, past: [], future: [], revision: 0, anchor: null, viewpoint: null,
  };
}

export function operation(kind, extra = {}) {
  return { kind, target: null, asset: null, placement: null, count: null, property: null, value: null, reference: null, ...extra };
}

export function validateCreationPlan(value) {
  if (!value || Object.keys(value).some(key => !['operations', 'issues'].includes(key)) || !Array.isArray(value.operations) || value.operations.length > 12 || !Array.isArray(value.issues) || value.issues.length > 6 || value.issues.some(issue => typeof issue !== 'string' || issue.length > 180)) throw new Error('造物指令格式不正确，世界保持不变。');
  const allowed = CREATION_SCHEMA.properties.operations.items.properties;
  const operations = value.operations.map(item => {
    if (!item || Object.keys(item).some(key => !Object.hasOwn(allowed, key)) || !kinds.includes(item.kind)) throw new Error('不支持这种造物操作，世界保持不变。');
    const action = operation(item.kind, item);
    for (const key of ['asset', 'placement', 'property']) if (action[key] !== null && !allowed[key].enum.includes(action[key])) throw new Error('造物字段不在支持范围内。');
    if (action.count !== null && (!Number.isInteger(action.count) || action.count < 1 || action.count > 5)) throw new Error('单次只支持 1–5 个已支持的物体。');
    if (action.value !== null && !['string', 'boolean', 'number'].includes(typeof action.value) || typeof action.value === 'number' && !Number.isFinite(action.value)) throw new Error('造物属性值无效。');
    for (const key of ['target', 'reference']) if (action[key] !== null && (typeof action[key] !== 'string' || !/^(form-\d{2,5}|\$new|\$selection|\$batch)$/.test(action[key]))) throw new Error('物体引用无效，世界保持不变。');
    if (action.kind === 'create' && (!Object.hasOwn(ASSETS, action.asset) || !Number.isInteger(action.count) || action.count < 1 || action.count > 5 || !['front', 'left', 'right', 'far', 'above', 'here'].includes(action.placement))) throw new Error('单次只支持 1–5 个已支持的物体。');
    if (action.kind === 'modify') {
      if (!properties.includes(action.property)) throw new Error('不能修改这个属性。');
      if (['scale', 'speed', 'spread'].includes(action.property) && (!Number.isFinite(action.value) || action.value < 0.25 || action.value > 3)) throw new Error('调整幅度超出范围。');
      if (action.property === 'height' && (!Number.isFinite(action.value) || Math.abs(action.value) > 50)) throw new Error('高度调整超出范围。');
      if (action.property === 'weathering' && (!Number.isFinite(action.value) || action.value < 0 || action.value > 1)) throw new Error('侵蚀程度超出范围。');
      if (action.property === 'color' && !Object.hasOwn(COLORS, action.value)) throw new Error('不支持这种材质色。');
      if (action.property === 'glow' && typeof action.value !== 'boolean') throw new Error('发光指令无效。');
    }
    if (action.kind === 'light' && !['sunlit', 'moonlit', 'golden'].includes(action.value)) throw new Error('不支持这种天光。');
    return action;
  });
  if (operations.length > 1 && operations.some(action => ['undo', 'redo'].includes(action.kind))) throw new Error('撤销和重做请单独执行，避免改变对象时同时回退历史。');
  return { operations, issues: [...value.issues] };
}

const assetPattern = /(?:环形)?神殿|宫殿|殿堂|星门|天门|拱门|城门|珊瑚(?:花园)?|鲸鱼|巨鲸|鲸|蝠鲼|魔鬼鱼|水母(?:群)?|鱼群|三叉戟|装甲古鱼|远古巨鱼|远古海兽|古鱼|海龟|鹦鹉螺|(?:美|珍珠)?人鱼/;
const assetOf = text => /神殿|宫殿|殿堂/.test(text) ? 'temple' : /星门|天门/.test(text) ? 'gate' : /拱门|城门/.test(text) ? 'arch' : /珊瑚/.test(text) ? 'coral' : /装甲古鱼|远古巨鱼|远古海兽|古鱼/.test(text) ? 'ancient' : /海龟/.test(text) ? 'turtle' : /鹦鹉螺/.test(text) ? 'nautilus' : /人鱼/.test(text) ? 'mermaid' : /鲸/.test(text) ? 'whale' : /蝠鲼|魔鬼鱼/.test(text) ? 'manta' : /水母/.test(text) ? 'jelly' : /鱼群/.test(text) ? 'shoal' : /三叉戟/.test(text) ? 'trident' : null;
function resolveMention(text, state, fallback = '$selection') {
  const explicit = text.match(/form-\d{2,5}/)?.[0];
  if (explicit) return explicit;
  if (/它们|这些|这一群/.test(text)) return '$batch';
  const asset = assetOf(text);
  if (!asset) return fallback;
  const candidates = state.entities.filter(item => item.asset === asset);
  if (/左/.test(text)) return candidates.sort((first, second) => first.position[0] - second.position[0])[0]?.id || null;
  if (/右/.test(text)) return candidates.sort((first, second) => second.position[0] - first.position[0])[0]?.id || null;
  if (/最初|原来|原本/.test(text)) return candidates[0]?.id || null;
  if (/刚才|新|最近/.test(text)) return candidates.at(-1)?.id || null;
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.some(item => item.id === state.selected)) return state.selected;
  if (candidates.some(item => item.id === state.focused?.[asset])) return state.focused[asset];
  return null;
}

export function interpretCreation(raw, state) {
  const text = String(raw || '').trim().slice(0, 240).replace(/(在[^，,。；;]{1,25})[，,]\s*(?=创造|生成|建造|种下|放置)/g, '$1');
  const operations = [];
  const issues = [];
  if (!text) return { operations, issues };
  if (/^(?:请|先)?(?:等等|等一下|停一下|暂停|停止|停下)[！!。\s]*$/.test(text)) return { operations: [operation('pause')], issues };
  if (/^(?:继续|恢复)(?:运行|画面|游动|生长)?[！!。\s]*$/.test(text)) return { operations: [operation('resume')], issues };
  if (/^(?:重做|恢复上一步)[！!。\s]*$/.test(text)) return { operations: [operation('redo')], issues };
  if (/撤销|回到上一步|退回上一步/.test(text)) {
    const targeted = assetPattern.test(text) || /它|选中/.test(text);
    const target = targeted ? resolveMention(text, state) : null;
    if (targeted && !target) issues.push('请先点选要撤销修改的物体，或说明左边 / 右边 / 刚才哪一个。');
    else operations.push(operation('undo', { target }));
    return { operations, issues };
  }
  let current = '$selection';
  let workingState = state;
  let processed = 0;
  const clauses = text.split(/[，,。；;]|然后|接着|并且|同时|而且|并/).map(part => part.trim()).filter(Boolean);
  for (const clause of clauses) {
    if (operations.length > processed) {
      workingState = executeCreation(workingState, { operations: operations.slice(processed), issues: [] }).state;
      processed = operations.length;
    }
    if (/^(?:其他|其余).*(?:不变|别变|保持)|^只(?:修改|改变)/.test(clause)) continue;
    if (/不要|不许|别/.test(clause) && !/不要发光|别发光|别跟着/.test(clause)) { issues.push(`保留现状，未执行否定要求“${clause.slice(0, 60)}”。`); continue; }
    if (/裂缝.*(?:长出|生长|珊瑚)/.test(clause)) {
      operations.push(operation('modify', { target: current, property: 'weathering', value: 0.85 }));
      if (/金色/.test(clause)) operations.push(operation('modify', { target: current, property: 'color', value: 'gold' }));
      continue;
    }
    const creation = clause.match(/(?:创造|生成|建造|造出|种下|种植|添加|增加|升起|放置)(.*)/);
    if (creation) {
      if (/和|以及|与|还有/.test(creation[1])) { issues.push('本地规则每个分句只创造一种事物，请用“然后创造……”分开描述，避免漏掉要求。'); continue; }
      const asset = assetOf(creation[1]);
      if (!asset) { issues.push('当前支持神殿、拱门、星门、珊瑚、鲸鱼、蝠鲼、水母、鱼群、三叉戟、装甲古鱼、海龟、鹦鹉螺和人鱼；其他形态尚不支持。'); continue; }
      if (/不要|别|不许/.test(clause.slice(0, creation.index))) { issues.push('已保留世界，没有执行这条否定造物要求。'); continue; }
      const number = creation[1].match(/(\d+|一|二|两|三|四|五|六|七|八|九|十)(?:座|头|只|丛|群|个|把|位|条)/)?.[1];
      const count = number ? Number(number) || { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }[number] : 1;
      if (count > 5) { issues.push('为保证实时画面，单次最多创造 5 个物体。'); continue; }
      const prefix = clause.slice(0, creation.index);
      const placement = /上方|上面/.test(prefix) ? 'above' : /这里|此处/.test(prefix) ? 'here' : /左/.test(prefix) ? 'left' : /右/.test(prefix) ? 'right' : /远/.test(prefix) ? 'far' : 'front';
      const reference = assetPattern.test(prefix) ? resolveMention(prefix, workingState, null) : null;
      if (assetPattern.test(prefix) && !reference) { issues.push('参照物不明确，请先点选或说“左边的神殿”等。'); continue; }
      operations.push(operation('create', { asset, count, placement, reference }));
      current = '$new';
      if (/巨大|宏伟|庞大/.test(clause)) operations.push(operation('modify', { target: current, property: 'scale', value: 1.45 }));
      if (/小小|小型/.test(clause)) operations.push(operation('modify', { target: current, property: 'scale', value: 0.65 }));
    } else {
      if (/停止跟随|自由游动|不用跟着|别跟着/.test(clause)) {
        const target = resolveMention(clause, workingState, current);
        if (target) operations.push(operation('release', { target }));
        else issues.push('请先选中正在跟随的生物。');
        continue;
      }
      if (/跟随我|跟着我|陪我游|陪着我/.test(clause)) {
        const target = resolveMention(clause, workingState, current);
        if (target) operations.push(operation('follow', { target }));
        else issues.push('请先选中你希望同行的生物。');
        continue;
      }
      const orbit = clause.match(/(.+?)(?:围绕|环绕|绕着|围着)(.+?)(?:游|盘旋|旋转|转|$)/);
      const resonance = /经过|靠近/.test(clause) && /亮|唤醒|发光/.test(clause) && /鲸/.test(clause) && /珊瑚/.test(clause);
      if (resonance) {
        const whale = resolveMention('鲸鱼', workingState);
        const coral = resolveMention('珊瑚', workingState);
        if (whale && coral) operations.push(operation('resonate', { target: whale, reference: coral }));
        else issues.push('鲸鱼或珊瑚不明确；请先保留单个目标，再建立经过时发光的关系。');
        continue;
      }
      if (orbit) {
        const target = resolveMention(orbit[1], workingState, current);
        const reference = resolveMention(orbit[2], workingState, null);
        if (!target || !reference) issues.push('环绕的双方不明确，请用物体列表点选，再说“让它环绕原来的神殿游”。');
        else operations.push(operation('orbit', { target, reference }));
        continue;
      }
      if (assetPattern.test(clause)) current = resolveMention(clause, workingState, current);
      if (/它们/.test(clause)) current = '$batch';
      if (/删除|移除|去掉/.test(clause)) {
        if (current) operations.push(operation('delete', { target: current }));
        else issues.push('要移除哪一个？请先点选物体。');
        continue;
      }
    }
    const push = (property, value) => {
      if (!current) { issues.push('有多个同类物体，请先点选一个，或说明左边 / 右边 / 刚才哪一个。'); return; }
      operations.push(operation('modify', { target: current, property, value }));
    };
    const start = operations.length;
    const color = clause.match(/金色|蓝色|青色|绿色|粉色|珍珠色|白色/);
    if (color) push('color', { 金色: 'gold', 蓝色: 'blue', 青色: 'teal', 绿色: 'teal', 粉色: 'rose', 珍珠色: 'pearl', 白色: 'pearl' }[color[0]]);
    if (/不发光|不要发光|别发光|熄灭|收起光/.test(clause)) push('glow', false);
    else if (/发光|亮起来|点亮/.test(clause) && !/阳光|天光/.test(clause)) push('glow', true);
    if (/大一点|放大|更大/.test(clause)) push('scale', 1.25);
    if (/小一点|缩小|更小/.test(clause)) push('scale', 0.8);
    if (/慢一点|游慢|慢慢|缓慢/.test(clause)) push('speed', 0.6);
    if (/快一点|更快|加快/.test(clause)) push('speed', 1.5);
    if (/高一点|抬高|悬浮|浮起/.test(clause)) push('height', 12);
    if (/低一点|降低|沉下/.test(clause)) push('height', -12);
    if (/破损|残破|古老|侵蚀/.test(clause)) push('weathering', 0.85);
    if (/修复|完整|崭新/.test(clause)) push('weathering', 0.05);
    if (/散开|疏一点/.test(clause)) push('spread', 1.4);
    if (/聚拢|密一点/.test(clause)) push('spread', 0.7);
    if (/夜色|月光|夜晚|暗一点/.test(clause)) operations.push(operation('light', { value: 'moonlit' }));
    else if (/暖光|金色天光|暖一点|夕照/.test(clause)) operations.push(operation('light', { value: 'golden' }));
    else if (/阳光|天光|白天|明亮|亮一点/.test(clause)) operations.push(operation('light', { value: 'sunlit' }));
    if (!creation && operations.length === start) issues.push(`暂不能执行“${clause.slice(0, 60)}”。可以创造物体，调整大小、颜色、发光、速度、高度或残破程度。`);
  }
  if (operations.length > 12) return { operations: [], issues: ['这句话包含太多操作，请拆成两次描述。'] };
  return { operations, issues: [...new Set(issues)].slice(0, 6) };
}

const snapshot = state => clone({ entities: state.entities, selected: state.selected, lastCreated: state.lastCreated, focused: state.focused, lighting: state.lighting, paused: state.paused });
function resolveIds(target, state) {
  if (target === '$new' || target === '$batch') return state.lastCreated.filter(id => state.entities.some(item => item.id === id));
  if (!target || target === '$selection') return state.selected ? [state.selected] : [];
  return state.entities.some(item => item.id === target) ? [target] : [];
}
function clearRelations(state) {
  const valid = new Set(state.entities.map(item => item.id));
  for (const item of state.entities) {
    if (!valid.has(item.orbit)) item.orbit = null;
    if (!valid.has(item.resonance)) item.resonance = null;
  }
  if (!valid.has(state.selected)) state.selected = null;
  state.lastCreated = state.lastCreated.filter(id => valid.has(id));
}
function placementPosition(action, state, index) {
  const reference = action.reference ? state.entities.find(item => item.id === resolveIds(action.reference, state)[0]) : null;
  const positions = { front: [-12, -7, 55], left: [-65, -7, -10], right: [63, -7, 9], far: [-48, -7, -121], above: [10, 70, -100], here: state.anchor || [-12, -7, 55] };
  const position = [...positions[action.placement]];
  if (state.viewpoint && !reference && action.placement !== 'here') {
    const forward = state.viewpoint.forward;
    const distance = action.placement === 'far' ? 180 : ['temple', 'gate'].includes(action.asset) ? 115 : 57;
    const sideways = action.placement === 'left' ? -42 : action.placement === 'right' ? 42 : 0;
    position[0] = state.viewpoint.position[0] + forward[0] * distance - forward[2] * sideways;
    position[2] = state.viewpoint.position[2] + forward[2] * distance + forward[0] * sideways;
    position[1] = seaHeight(position[0], position[2]);
  }
  if (reference) {
    position.splice(0, 3, ...reference.position);
    if (action.placement === 'above') position[1] += (reference.asset === 'temple' ? 56 * reference.params.scale : 18) + reference.params.height;
    else position[0] += action.placement === 'left' ? -38 : 38;
  } else if (LIVING_ASSETS.includes(action.asset)) position[1] = Math.max(position[1] + 18, state.viewpoint?.position[1] || 28) + (action.placement === 'above' ? 35 : 0);
  const existing = state.entities.filter(item => !item.preset).length;
  const spacing = action.asset === 'coral' ? 12 : action.asset === 'temple' ? 42 : 18;
  position[0] += (index - (action.count - 1) / 2) * spacing + (existing % 3) * 5;
  position[2] -= Math.floor(existing / 3) * 6;
  return position;
}

export function executeCreation(previous, rawPlan, label = '语言造物') {
  let plan;
  try { plan = validateCreationPlan(rawPlan); } catch (error) { return { state: previous, changed: false, descriptions: [], issues: [error.message] }; }
  if (!plan.operations.length) return { state: previous, changed: false, descriptions: [], issues: plan.issues };
  const next = clone(previous);
  const before = snapshot(previous);
  const descriptions = [];
  try {
    for (const action of plan.operations) {
      const ids = resolveIds(action.target, next);
      const targets = next.entities.filter(item => ids.includes(item.id));
      if (action.kind === 'undo' && !action.target) {
        if (!next.past.length) throw new Error('还没有可以撤销的创作。');
        const entry = next.past.pop();
        next.future.push(entry);
        Object.assign(next, clone(entry.before));
        next.revision++;
        return { state: next, changed: true, descriptions: ['已撤销上一步，其他创作保留'], issues: plan.issues };
      }
      if (action.kind === 'redo') {
        if (!next.future.length) throw new Error('没有可以重做的创作。');
        const entry = next.future.pop();
        next.past.push(entry);
        Object.assign(next, clone(entry.after));
        next.revision++;
        return { state: next, changed: true, descriptions: ['已重做上一步'], issues: plan.issues };
      }
      if (['modify', 'orbit', 'resonate', 'follow', 'release', 'delete', 'undo'].includes(action.kind) && !targets.length) throw new Error('没有找到目标；请先点选画面中的物体或右侧造物列表。');
      if (action.kind === 'create') {
        if (action.reference && !resolveIds(action.reference, next).length) throw new Error('指定的参照物已经不存在。');
        if (action.placement === 'here' && !next.anchor) throw new Error('请先点击海床，指认“这里”的位置。');
        if (next.entities.length + action.count > 20) throw new Error('这片海最多同时容纳 20 个可编辑造物，请先移除一些。');
        const added = [];
        for (let index = 0; index < action.count; index++) {
          const item = entity(`form-${String(next.nextId++).padStart(2, '0')}`, action.asset, placementPosition(action, next, index));
          added.push(item);
        }
        next.entities.push(...added);
        next.lastCreated = added.map(item => item.id);
        next.selected = added.at(-1).id;
        next.focused[action.asset] = next.selected;
        descriptions.push(`创造 ${action.count} × ${ASSETS[action.asset]}`);
      }
      if (action.kind === 'modify') {
        for (const item of targets) {
          if (action.property === 'speed' && !LIVING_ASSETS.includes(item.asset)) throw new Error('运动速度只适用于海洋生物。');
          if (action.property === 'spread' && !['coral', 'jelly', 'shoal'].includes(item.asset)) throw new Error('分布范围只适用于珊瑚、水母和鱼群。');
          if (action.property === 'weathering' && !['temple', 'arch', 'trident', 'gate'].includes(item.asset)) throw new Error('侵蚀程度只适用于遗迹。');
          const limits = { scale: [0.3, item.preset ? 3 : 2], speed: [0.15, 2.5], spread: [0.45, 2.2] };
          if (limits[action.property]) item.params[action.property] = clamp(item.params[action.property] * action.value, ...limits[action.property]);
          else if (action.property === 'height') item.params.height = clamp(item.params.height + action.value, -10, 90);
          else item.params[action.property] = action.value;
        }
        next.selected = targets.at(-1).id;
        next.focused[targets.at(-1).asset] = next.selected;
        descriptions.push(`${targets.length > 1 ? `${targets.length} 个物体` : ASSETS[targets[0].asset]} · ${ { scale: '尺度', height: '高度', speed: '运动速度', color: '材质色', glow: '发光', weathering: '侵蚀程度', spread: '分布范围' }[action.property]}已调整`);
      }
      if (action.kind === 'orbit' || action.kind === 'resonate') {
        const reference = next.entities.find(item => item.id === resolveIds(action.reference, next)[0]);
        if (!reference || targets.some(item => item.id === reference.id)) throw new Error('需要两个不同且存在的物体来建立关系。');
        if (action.kind === 'orbit') {
          if (targets.some(item => !LIVING_ASSETS.includes(item.asset)) || !['temple', 'arch', 'trident', 'coral', 'gate'].includes(reference.asset)) throw new Error('目前支持海洋生物环绕建筑或珊瑚。');
          targets.forEach(item => { item.orbit = reference.id; item.following = false; });
          descriptions.push(`建立环绕关系 → ${ASSETS[reference.asset]}`);
        } else {
          if (targets.some(item => item.asset !== 'whale') || reference.asset !== 'coral') throw new Error('共鸣支持鲸鱼靠近珊瑚时，珊瑚自动发光。');
          targets.forEach(item => { item.resonance = reference.id; });
          descriptions.push('建立距离感应：鲸鱼靠近时，珊瑚发光');
        }
        next.selected = targets.at(-1).id;
      }
      if (action.kind === 'follow' || action.kind === 'release') {
        if (targets.some(item => !LIVING_ASSETS.includes(item.asset))) throw new Error('只有海洋生物能够跟随你游动。');
        targets.forEach(item => { item.following = action.kind === 'follow'; item.orbit = null; });
        next.selected = targets.at(-1).id;
        descriptions.push(action.kind === 'follow' ? '它将和你同行 · 移动镜头即可带它探索' : '已结束同行 · 留在此处自由游动');
      }
      if (action.kind === 'delete') { next.entities = next.entities.filter(item => !ids.includes(item.id)); descriptions.push(`移除 ${targets.length} 个造物`); }
      if (action.kind === 'undo' && action.target) {
        for (const target of targets) {
          const entry = [...next.past].reverse().find(item => !item.targetUndo && JSON.stringify(item.after.entities.find(part => part.id === target.id)) === JSON.stringify(target) && JSON.stringify(item.before.entities.find(part => part.id === target.id)) !== JSON.stringify(target));
          if (!entry) throw new Error('这个物体还没有可撤销的修改。');
          const former = entry.before.entities.find(item => item.id === target.id);
          next.entities = next.entities.filter(item => item.id !== target.id);
          if (former) next.entities.push(clone(former));
        }
        descriptions.push('只撤销目标物体的上次修改');
      }
      if (action.kind === 'light') { next.lighting = action.value; descriptions.push(`天光 · ${{ sunlit: '海面日光', moonlit: '深海月色', golden: '暖金夕照' }[action.value]}`); }
      if (action.kind === 'pause' || action.kind === 'resume') { next.paused = action.kind === 'pause'; descriptions.push(next.paused ? '造物生长与世界运动已暂停' : '世界继续运行'); }
    }
    clearRelations(next);
    next.past.push({ before, after: snapshot(next), label: String(label).slice(0, 240), targetUndo: plan.operations.some(action => action.kind === 'undo' && action.target) });
    next.past = next.past.slice(-30);
    next.future = [];
    next.revision++;
    return { state: next, changed: true, descriptions, issues: plan.issues };
  } catch (error) {
    return { state: previous, changed: false, descriptions: [], issues: [...plan.issues, `${error.message}本次操作未应用。`] };
  }
}

export function creationContext(state) {
  const clean = initialCreation();
  const valid = Array.isArray(state?.entities) ? state.entities.slice(0, 20).filter(item => /^form-\d{2,5}$/.test(item?.id) && Object.hasOwn(ASSETS, item?.asset)) : [];
  clean.entities = valid.map(item => ({ id: item.id, asset: item.asset, position: Array.isArray(item.position) && item.position.length === 3 ? item.position.map(value => Number.isFinite(value) ? value : 0) : [0, 0, 0], params: Object.fromEntries(properties.map(key => [key, key === 'color' ? Object.hasOwn(COLORS, item.params?.color) ? item.params.color : 'teal' : key === 'glow' ? item.params?.glow === true : Number.isFinite(item.params?.[key]) ? clamp(item.params[key], key === 'height' ? -10 : 0, key === 'height' ? 90 : 3) : defaults(item.asset)[key]])), orbit: valid.some(candidate => candidate.id === item.orbit) ? item.orbit : null, resonance: valid.some(candidate => candidate.id === item.resonance) ? item.resonance : null }));
  clean.entities.forEach((item, index) => { item.following = LIVING_ASSETS.includes(item.asset) && valid[index].following === true; });
  return { entities: clean.entities, selected: valid.some(item => item.id === state.selected) ? state.selected : null, lastCreated: Array.isArray(state?.lastCreated) ? state.lastCreated.filter(id => valid.some(item => item.id === id)) : [], lighting: ['sunlit', 'golden', 'moonlit'].includes(state?.lighting) ? state.lighting : 'sunlit' };
}
