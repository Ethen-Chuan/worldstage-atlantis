import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import './style.css';
import { Ocean } from './ocean.js';
import { prepareSurfaces } from './surfaces.js';
import { prepareCreatureSurfaces } from './creature-surface.js';
import { OceanSound } from './sound.js';
import { ASSETS, LIVING_ASSETS, CREATION_EXAMPLES, initialCreation, interpretCreation, executeCreation, operation, creationContext, validateCreationPlan } from './creation.js';
import { initialState, interpretUtterance, executeUtterance, arriveAt, interruptJourney } from './dialogue.js';
import { REGIONS, PLACES } from './world.js';
import { setupMedia } from './media-experience.js';
import { LANDMARKS, ECOLOGY_VIEWS, nearestLandmark } from './landmarks.js';
import { MEMORY_KEY, readMemory, writeMemory } from './world-memory.js';
import { SeaChart, seaChartMarkup } from './sea-chart.js';
import { embodimentMarkup } from './embodiment.js';
import { playMarkup, SITE_PLAY } from './tide-play.js';
import './interaction.css';
import { planWorld, worldAction, WorldDirector, validateWorldPlan } from './world-planner.js';

const paths = {
  sound: '<path d="m11 5-5 4H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>', muted: '<path d="m11 5-5 4H3v6h3l5 4V5ZM16 9l5 6m0-6-5 6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>', play: '<path d="m8 5 11 7-11 7V5Z"/>', expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>', arrow: '<path d="M12 19V5m-6 6 6-6 6 6"/>', mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3m-3 0h6"/>',
  camera: '<path d="m8 5 1-2h6l1 2h5v15H3V5h5Z"/><circle cx="12" cy="12" r="4"/>', undo: '<path d="M4 9a8 8 0 1 1 0 6M4 3v6h6"/>', redo: '<path d="M20 9a8 8 0 1 0 0 6m0-12v6h-6"/>',
  wave: '<path d="M3 10c3-7 6 7 9 0s6 7 9 0M3 16c3-7 6 7 9 0s6 7 9 0"/>', layers: '<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>', focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>', compass: '<circle cx="12" cy="12" r="9"/><path d="m15 8-2 6-5 2 2-6 5-2Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.wave}</svg>`;
const control = (id, name, label) => `<button id="${id}" type="button" class="icon-button" aria-label="${label}" title="${label}">${icon(name)}</button>`;
const panelHead = (name, english, title) => `<div class="drawer-header"><div><span class="eyebrow">${english}</span><h2>${title}</h2></div>${control(`close-${name}`, 'close', `关闭${title}`)}</div>`;
document.querySelector('#app').innerHTML = `
  <main class="experience" aria-label="即境 · 语言造物">
    <div id="ocean" class="ocean"></div><div class="cinema-shade" aria-hidden="true"></div><div id="water-transition" class="water-transition" aria-live="polite"><span id="transition-label"></span></div>
    <div id="loading" class="loading"><img src="./mark.svg" alt=""/><span>一座沉睡的城，正在醒来。</span><small>构筑石阶与穹顶 · 等待第一束光</small><div class="loading-line"></div></div>
    <header class="topbar"><button id="home-button" class="brand" aria-label="回到圣城初始视角"><img src="./mark.svg" alt=""/><span>即境<small>WORLDSTAGE</small></span></button><div class="edition"><span>A WORLD, IN YOUR WORDS</span><b>亚特兰蒂斯 <i>/</i> 造物篇</b></div><nav class="top-actions" aria-label="画面控制"><button id="settings-button" class="text-button">体验设置</button>${control('sound-button', 'muted', '开启环境声音')}${control('pause-button', 'pause', '暂停画面')}${control('immersive-button', 'expand', '纯净观景')}</nav></header>
    <section class="world-title" aria-label="作品介绍"><div class="eyebrow">THE PALACE OF TIDES</div><h1>一念生城。<br/><em>万物有回声。</em></h1><p>这里的巨兽，记得潮汐以前的事。<br/>而这个世界，等待你的下一句话。</p><button id="first-wonder" class="wonder-invitation">先去看一场奇观 <span aria-hidden="true">↗</span></button><small>实时三维 · 语言造物 · 每一步都能反悔</small></section>
    <div class="world-tools"><button id="objects-button" class="objects-button">${icon('layers')}<span>此刻的造物</span><b id="object-count">04</b></button><button id="journey-button" class="text-button">${icon('compass')} 海域与奇观</button></div>
    <div id="selection-label" class="selection-label" hidden><span class="selection-dot"></span><span id="selected-name"></span>${control('focus-button', 'focus', '靠近选中的造物')}${control('clear-selection', 'close', '取消选择')}</div>
    <section id="discovery" class="discovery" aria-live="polite" hidden><small id="discovery-number"></small><h2 id="discovery-name"></h2><p id="discovery-caption"></p><button id="discovery-invite" class="text-button"></button></section>
    <section class="conversation" aria-label="用文字或语音创造世界"><div id="response" class="response" role="status" aria-live="polite"><p id="response-line">让想象，在海底有形。</p><span id="action-label">先创造，再靠近、改色，或让它与你同行。</span></div><div id="suggestions" class="suggestions" aria-label="可编辑的造物示例"></div><div class="composer-topline"><span id="engine-label">本地造物规则</span><div class="composer-aux"><button id="save-world">保存世界</button><button id="history-button">创作记录 <span id="history-count">00</span></button></div></div>
      <form id="conversation-form" class="composer" autocomplete="off"><span class="composer-mark">${icon('wave')}</span><label class="sr-only" for="message">描述你想创造或改变的事物</label><textarea id="message" maxlength="240" rows="1" placeholder="创造一只海龟，然后让它跟随我……" enterkeyhint="send"></textarea>${control('mic-button', 'mic', '语音输入（使用前说明隐私）')}<button id="send-button" type="submit" class="send-button" aria-label="创造或修改世界">${icon('arrow')}</button></form>
      <div id="intent-preview" class="intent-preview" role="status" aria-live="polite" hidden></div><div class="composer-footer"><span id="input-hint">点击物体指认“它” · 点击海床指认“这里”</span><div class="undo-tools">${control('undo-button', 'undo', '撤销上一步')}${control('redo-button', 'redo', '重做上一步')}<button id="stop-button">暂停造物</button></div></div></section>
    <div class="scene-caption"><span id="place-name">潮生圣城</span><small id="place-caption">148 M BELOW THE SURFACE</small></div><div class="capture-tools">${control('snapshot-button', 'camera', '保存当前画面')}<span>留住这一刻</span></div>
    <footer class="bottomline"><button id="boundary-button"><i></i> 实时 3D 造物原型 <span>· 非 AI 视频模型生成</span></button><span>拖动环顾 <i> / </i> 滚轮靠近</span></footer>
    <aside id="objects-panel" class="drawer" aria-label="此刻的造物" hidden>${panelHead('objects', 'THE THINGS YOU SHAPED', '此刻的造物')}<p class="drawer-intro">点选一个，再说“让它……”<br/>身份保持不变，修改只发生在选中的事物上。</p><div id="object-list"></div><section class="about-section"><h3>让世界留在这里</h3><p id="memory-summary">尚无本机存档。</p><div class="memory-actions"><button id="load-world" class="primary-button" disabled>继续上次的世界</button><button id="forget-world" class="text-button" disabled>删除存档</button></div><p>仅手动保存到此浏览器。保留造物、关系、视角与足迹；不保存输入原文、录音或密钥。清理浏览器数据会清除存档。</p></section><p class="drawer-note">最多 20 个可编辑造物，远处的自然遗迹不计入。<br/>离开前点击“保存世界”。未保存的改变会在刷新后消失。</p></aside>
    <aside id="history-panel" class="drawer" aria-label="创作记录" hidden>${panelHead('history', 'WORDS BECOME WORLDS', '世界如何生长')}<p class="drawer-intro">你的描述、理解来源与应用结果。<br/>不是预录视频，每次改变都有据可查。</p><div id="history-list"></div></aside>
    <aside id="journey-panel" class="drawer" aria-label="海域与奇观" hidden>${panelHead('journey', 'AN ATLAS WITHOUT AN EDGE', '奇观在远方')}<p class="drawer-intro">四处遗迹，三种不断变化的奇观。<br/>先去看见，再用一句话唤醒。</p><div class="travel-mode" role="group" aria-label="地点切换方式"><button id="mode-quick" aria-pressed="true">快速抵达</button><button id="mode-sail" aria-pressed="false">沿途漫游</button></div><p id="travel-mode-note" class="travel-mode-note">默认快速切换，世界和你的造物不会重置。</p><div class="atlas-count"><span id="visited-count">01 / 07 已抵达</span><span>遗迹与动态奇观</span></div><div class="region-list">${[...LANDMARKS.filter(item => item.wonder), ...LANDMARKS.filter(item => !item.wonder)].map(landmark => `<button data-region="${landmark.id}" aria-label="前往${landmark.name}"><small>${landmark.number}</small><span>${landmark.name}${landmark.wonder ? '<strong class="wonder-type">动态奇观</strong>' : ''}<em>${landmark.caption}</em><i data-distance="${landmark.id}"></i></span><b data-visited="${landmark.id}">↗</b></button>`).join('')}</div><p class="drawer-note">拖动环顾，WASD 前后左右，Q / E 升降。<br/>触屏可拖动转向，点击“持续前游”。地标之外仍可探索，没有固定地图墙。</p></aside>
    <aside id="settings-panel" class="drawer" aria-label="设置与能力说明" hidden>${panelHead('settings', 'THE CRAFT BEHIND THE WORLD', '让想象有所回应')}
      <section class="about-section"><h3>这一版可以创造什么</h3><p>14 类资产：神殿、拱门、星门、珊瑚、鲸鱼、鲨鱼、蝠鲼、水母、鱼群、三叉戟、装甲古鱼、海龟、鹦鹉螺、人鱼。文字可以指定位置、数量、尺度、材质色、光芒、速度与高度；遗迹可调整侵蚀与附生珊瑚。</p><p>例如：“创造一只海龟” → “让海龟跟随鲸鱼”。可让生物同行、环绕建筑，或让鲸鱼接近珊瑚时触发发光。说“停止跟随”，它会留在旅途中的当前位置。</p><p>形状来自程序化三维资产的参数组合，不支持任意新物种、逐帧视频生成、真实物理或自动避障。命名地标和环境生态不属于可修改造物；可以进入其视角，或另行创造同类。装甲古鱼、人鱼是幻想设计，不是科学复原；本版没有使用 Blender 雕刻或扫描资产。</p></section>
      <section class="about-section"><h3>理解引擎</h3><p id="model-status">正在检查服务配置……</p><button id="model-toggle" class="primary-button" disabled>大模型尚未配置</button><p>默认是有边界的本地规则，不假装任意自然语言都能理解。模型接入后也只能操作支持的资产和属性；失败不会偷偷降级。</p></section>
      <section class="about-section"><h3>让世界持续回应</h3><p>七处海域有不同主题的 36 秒盛典：蓄光、绽放、齐鸣与余辉。天门支持召唤已有生物形态。三类小游戏规则分布于七处地点：依序穿环、自由采光、呼吸节拍；可选择蝠鲼、灰礁鲨、海龟或巨鲸，重复挑战。</p><p>点选生物可以代入，点选静物可以环绕。暂停会冻结世界与配乐；“让海流平静”让盛典缓缓结束。试炼成绩和盛典仅保留在本次会话，不写入造物存档。</p></section>
      <section class="about-section"><h3>混合世界架构</h3><p>规划器理解意图，白名单校验可执行范围；持久造物状态与即时世界反馈记录位置、关系、视角和试炼进度；三维、镜头和音频负责连续呈现。文字与主要互动按钮共用执行入口。</p><p>当前是“规则规划器 + 显式世界状态 + 实时渲染器”，不是经过训练的神经世界模型。可选语言模型只输出受限造物计划，不能直接执行代码；公开版不调用付费模型，也未集成高斯泼溅。</p></section>
      <section class="about-section"><h3>画面与动态</h3><label class="setting-row">画质<select id="quality-select"><option value="high">精细</option><option value="balanced" selected>均衡</option><option value="performance">流畅</option></select></label><label class="setting-row">降低动态效果<input id="reduced-toggle" type="checkbox"/></label><p id="performance-note">根据设备选择画质，优先保持交互流畅。</p><button id="fullscreen-button" class="text-button">进入全屏</button></section>
      <section class="about-section"><h3>隐私与素材</h3><p>本地模式不外发文字。语音可能使用浏览器提供商服务，先告知再使用；识别后仅填入输入框，确认才执行。不保存录音。模型模式另行征求同意。</p><p>参考图仅用于本地美术分析，没有作为背景贴图，也未上传外部模型。石材纹理由 Poly Haven CC0 资源提供；建筑和生态为程序化建模，声音为程序合成。</p></section></aside>
    <dialog id="voice-consent" aria-labelledby="voice-title"><form method="dialog"><span class="eyebrow">VOICE INPUT</span><h2 id="voice-title">先说清楚，再听你说。</h2><p>语音由浏览器识别，音频可能发送给浏览器提供商。本作品不保存录音。</p><p>识别结果只填入输入框。请检查文字，再点击创造。</p><div class="dialog-actions"><button value="cancel">继续用文字</button><button value="allow" class="primary-button">同意并开启麦克风</button></div></form></dialog>
    <dialog id="model-consent" aria-labelledby="model-title"><form method="dialog"><span class="eyebrow">LANGUAGE MODEL</span><h2 id="model-title">让模型理解，让世界执行。</h2><p>你的文字、最近 4 条描述和必要的造物状态将发送给 <strong id="model-provider"></strong>。服务可能收费，并受其数据政策约束。</p><p>不发送参考图、文件或录音；密钥仅在服务端。模型结果经过白名单校验，不能执行任意代码。</p><div class="dialog-actions"><button value="cancel">保留本地模式</button><button value="allow" class="primary-button">同意并启用</button></div></form></dialog>
    <dialog id="memory-confirm" aria-labelledby="memory-title"><form method="dialog"><span class="eyebrow">A WORLD REMEMBERED</span><h2 id="memory-title"></h2><p id="memory-detail"></p><div class="dialog-actions"><button value="cancel">取消</button><button value="allow" class="primary-button">确认</button></div></form></dialog>
    ${seaChartMarkup()}${embodimentMarkup()}${playMarkup()}
    <div id="toast" class="toast" role="status" hidden></div><button id="exit-immersive" class="exit-immersive" hidden>返回造物 ↗</button>
  </main>`;

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
let state = initialCreation();
let journeyState = initialState();
let ocean;
let engine = 'local';
let modelSettings = { available: false };
let modelRequest = null;
let requestVersion = 0;
let voice;
let voiceAllowed = false;
let toastTimer;
let returnFocus;
let recentResult = null;
let memoryAction = null;
let savedMemory = null;
let intentTimer;
let discoveryTimer;
let discovered = new Set(['palace']);
let discoverySite = null;
let travelMode = 'quick';
let navigationVersion = 0;
let transitionTimer;
let latestTransition = null;
let loadingStarted = performance.now();
let readyMilliseconds = null;
const transcript = [];
const sound = new OceanSound();
const panelIds = ['objects', 'history', 'journey', 'settings', 'chart'];
const mediaExperience = setupMedia({ getOcean: () => ocean, toast });
const seaChart = new SeaChart({ navigate: (id, mode) => dispatchWorld(worldAction('travel', { site: id, mode })), open: () => panel('chart', true), guide: () => panel('journey', true) });
const director = new WorldDirector({ observe: observeWorld, render: renderWorldAction });
let soundtrackSite = null;
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('cancel', () => { dialog.returnValue = 'cancel'; }));

function toast(message) {
  clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 5200);
}
function panel(name, open) {
  if (open) returnFocus = document.activeElement;
  if (open) ocean?.movement.clear();
  if (open) document.querySelector('#media-panel').hidden = true;
  for (const id of panelIds) elements[`${id}-panel`].hidden = id !== name || !open;
  document.body.classList.toggle('panel-open', open);
  elements['chart-button'].setAttribute('aria-expanded', String(open && name === 'chart'));
  if (open) elements[`close-${name}`].focus(); else returnFocus?.focus();
}
function fill(text) { elements.message.value = text; elements.message.focus(); elements['input-hint'].textContent = '示例只填入，不执行。改成你的想法，再按回车。'; previewIntent(); }
function renderSuggestions() {
  const selected = state.entities.find(item => item.id === state.selected);
  const site = ocean?.currentLandmark;
  const examples = selected ? [{ label: '再小一点', text: '把它缩小一点，其他都别变' }, { label: '染上金色', text: '让它变成金色，发光' }, LIVING_ASSETS.includes(selected.asset) ? { label: selected.following ? '在这里分别' : '一起探索', text: selected.following ? '让它停止跟随' : '让它跟随我' } : { label: '让生命环绕', text: '创造一只蝠鲼，然后让它环绕原来的神殿游' }] : site?.wonder ? [{ label: '唤醒这片奇观', text: site.invitation }, { label: '与蝠鲼同行', text: '创造一只蝠鲼，然后让它跟随我' }, { label: '让奇观平静', text: '让奇观平静下来' }] : CREATION_EXAMPLES;
  elements.suggestions.replaceChildren();
  for (const example of examples) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = example.label; button.title = example.text;
    button.addEventListener('click', () => fill(example.text)); elements.suggestions.append(button);
  }
}
function select(id) { state.selected = id; const item = state.entities.find(item => item.id === id); if (item) state.focused[item.asset] = id; if (ocean) ocean.creationScene.selected = id; renderState(); previewIntent(); }
function renderState() {
  sound.setPaused(state.paused);
  elements['object-count'].textContent = String(state.entities.length).padStart(2, '0');
  const selected = state.entities.find(item => item.id === state.selected);
  elements['selection-label'].hidden = !selected || ocean?.region !== 'city';
  elements['selected-name'].textContent = selected ? `正在修改 · ${selected.name}` : '';
  elements['object-list'].replaceChildren();
  for (const item of state.entities) {
    const button = document.createElement('button'); button.className = 'object-item'; button.dataset.object = item.id; button.setAttribute('aria-pressed', String(item.id === state.selected));
    const number = document.createElement('small'); number.textContent = item.id.replace('form-', '');
    const content = document.createElement('span'); const name = document.createElement('strong'); name.textContent = ASSETS[item.asset];
    const detail = document.createElement('em'); detail.textContent = `${item.preset ? '初始造物' : '你的创造'} · ${item.params.scale.toFixed(2)}×${item.orbit ? ' · 环绕中' : ''}${item.following ? ' · 与你同行' : ''}${item.leader ? ' · 结伴巡游' : ''}${item.resonance ? ' · 距离共鸣' : ''}`;
    content.append(name, detail); button.append(number, content);
    button.addEventListener('click', () => { select(item.id); panel('objects', false); toast(`已选中${item.name}，可说“让它……”`); }); elements['object-list'].append(button);
  }
  elements['undo-button'].disabled = !state.past.length; elements['redo-button'].disabled = !state.future.length;
  elements['pause-button'].innerHTML = icon(state.paused ? 'play' : 'pause'); elements['pause-button'].setAttribute('aria-label', state.paused ? '继续画面' : '暂停画面'); elements['pause-button'].setAttribute('aria-pressed', String(state.paused));
  elements['stop-button'].textContent = state.paused ? '继续造物' : '暂停造物'; renderSuggestions();
}
function renderHistory() {
  elements['history-count'].textContent = String(transcript.length).padStart(2, '0'); elements['history-list'].replaceChildren();
  if (!transcript.length) elements['history-list'].textContent = '还没有创作记录。世界正在等待你的第一句话。';
  for (const turn of [...transcript].reverse()) {
    const article = document.createElement('article'); const source = document.createElement('small'); source.textContent = turn.source;
    const quote = document.createElement('h3'); quote.textContent = turn.text; article.append(source, quote);
    for (const description of [...turn.descriptions, ...turn.issues]) { const paragraph = document.createElement('p'); paragraph.textContent = description; if (turn.issues.includes(description)) paragraph.className = 'issue'; article.append(paragraph); }
    elements['history-list'].append(article);
  }
}
function previewIntent() {
  clearTimeout(intentTimer);
  const text = elements.message.value.trim();
  elements['intent-preview'].hidden = !text;
  if (!text) return;
  intentTimer = setTimeout(() => {
    const world = planWorld(text, { site: ocean?.currentLandmark?.id, travelMode });
    const preview = elements['intent-preview'];
    if (world) {
      try {
        validateWorldPlan(world, observeWorld());
        const labels = { travel: '前往所选海域', ritual: world.args.summon ? `唤醒奇观并召唤${world.args.summon}` : '奏响海底盛典', calm: '让光与和声缓缓平息', trial: '化身生物，开启当地试炼', talk: '触发附近角色的预设回应', inhabit: '进入生物视角', 'release-view': '平滑返回自由探索', cruise: '沿当前朝向持续前游' };
        preview.classList.remove('issue'); preview.textContent = `${labels[world.kind]} · 发送后执行，世界尚未改变`;
      } catch (error) { preview.classList.add('issue'); preview.textContent = error.message; }
      return;
    }
    const plan = interpretCreation(text, state);
    const result = executeCreation(state, plan);
    preview.classList.toggle('issue', engine === 'local' && result.issues.length > 0);
    preview.textContent = engine === 'model' ? '发送后由已启用的模型理解；此刻不会外发文字或改变世界。' : result.issues.length ? result.issues[0] : result.changed ? `即将${result.descriptions.slice(0, 2).join(' · ')} · 尚未执行` : '继续描述你想创造的事物。';
  }, 180);
}
elements.message.addEventListener('input', previewIntent);

function refreshMemory() {
  let invalid = false;
  let stored = false;
  savedMemory = null;
  try { const raw = localStorage.getItem(MEMORY_KEY); stored = Boolean(raw); if (raw) savedMemory = readMemory(raw); } catch { invalid = true; }
  elements['load-world'].disabled = !savedMemory;
  elements['forget-world'].disabled = !stored;
  elements['memory-summary'].textContent = invalid ? '本机存档无法读取；不会自动覆盖或应用。可删除损坏存档后重新保存。' : savedMemory ? `${new Date(savedMemory.savedAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 保存 · ${savedMemory.state.entities.length} 个造物 · ${savedMemory.visited.length} 处足迹` : '尚无本机存档。点击输入框上方的“保存世界”，下次可以从这里继续。';
}
function confirmMemory(action) {
  memoryAction = action;
  const copy = { save: [savedMemory ? '更新这份世界存档？' : '把这个世界留在本机？', `${savedMemory ? '这会替换本浏览器里上一次保存的世界。' : '保存在当前浏览器里，不上传服务器。'}只保存造物、关系、视角与足迹，不保存你输入的文字。`], load: ['回到上次的世界？', '当前未保存的创作会被替换。恢复后先暂停画面，确认好再继续探索。'], forget: ['忘记这份存档？', '只删除本浏览器的保存记录，不影响此刻正在探索的世界。此操作无法撤销。'] }[action];
  elements['memory-title'].textContent = copy[0]; elements['memory-detail'].textContent = copy[1]; elements['memory-confirm'].showModal();
}
function saveWorld() {
  if (!ocean || modelRequest) return toast('请等当前构筑或理解完成，再保存世界。');
  if (ocean.embodiment.active) return toast('请先返回自由探索，再保存操控后的世界。');
  try {
    const raw = writeMemory(ocean.creationScene.captureFollowing(state), ocean.captureView(), discovered);
    localStorage.setItem(MEMORY_KEY, raw);
    refreshMemory(); toast('世界已保存在本浏览器 · 下次在“此刻的造物”中继续');
  } catch { toast('无法保存：浏览器存储可能已满、被禁用，或世界状态不完整。当前创作仍在。'); }
}
function cancelUnderstanding() {
  modelRequest?.abort(); requestVersion++; modelRequest = null; elements['send-button'].disabled = false; elements['conversation-form'].setAttribute('aria-busy', 'false');
}
elements['save-world'].addEventListener('click', () => { refreshMemory(); confirmMemory('save'); });
elements['load-world'].addEventListener('click', () => { if (ocean && savedMemory) confirmMemory('load'); });
elements['forget-world'].addEventListener('click', () => confirmMemory('forget'));
elements['memory-confirm'].addEventListener('close', () => {
  if (elements['memory-confirm'].returnValue !== 'allow') return;
  if (memoryAction === 'save') return saveWorld();
  if (memoryAction === 'forget') { try { localStorage.removeItem(MEMORY_KEY); refreshMemory(); toast('本机存档已删除。眼前的世界没有改变。'); } catch { toast('浏览器没有允许删除存档。'); } return; }
  if (memoryAction === 'load' && ocean) {
    try {
      const memory = readMemory(localStorage.getItem(MEMORY_KEY));
      cancelUnderstanding();
      cancelNavigation(); ocean.wonders.resetPulses();
      ocean.syncCreation({ ...state, entities: [] }, true);
      state = memory.state; discovered = new Set(memory.visited);
      ocean.restoreView(memory.view); ocean.syncCreation(state, true); ocean.creationScene.update(0); ocean.paused = true;
      mediaExperience.setPaused(true); sound.stopVoices(); transcript.length = 0; recentResult = null;
      elements.message.value = ''; previewIntent(); renderState(); renderHistory(); renderAtlas(); panel('objects', false);
      document.body.classList.add('has-interacted');
      elements['response-line'].textContent = '你留下的世界，还在这里。'; elements['action-label'].textContent = '已恢复并暂停 · 点击“继续造物”，从这一刻出发';
    } catch (error) { toast(error.message || '存档恢复失败，当前世界未改变。'); }
  }
});

function renderAtlas() {
  elements['visited-count'].textContent = `${String(discovered.size).padStart(2, '0')} / ${String(LANDMARKS.length).padStart(2, '0')} 已抵达`;
  for (const landmark of LANDMARKS) {
    const marker = document.querySelector(`[data-visited="${landmark.id}"]`);
    marker.textContent = discovered.has(landmark.id) ? '✓' : '↗';
    marker.setAttribute('aria-label', discovered.has(landmark.id) ? '已抵达' : '尚未抵达');
  }
}
function discover(landmark) {
  if (!landmark || discovered.has(landmark.id)) return;
  discovered.add(landmark.id); discoverySite = landmark; renderAtlas();
  elements['discovery-number'].textContent = `${landmark.number} / 新的足迹`;
  elements['discovery-name'].textContent = landmark.name; elements['discovery-caption'].textContent = landmark.caption;
  elements['discovery-invite'].textContent = landmark.wonder ? '试着唤醒它 ↗' : '在这里创造 ↗'; elements.discovery.hidden = false;
  clearTimeout(discoveryTimer); discoveryTimer = setTimeout(() => { elements.discovery.hidden = true; }, 8000);
  sound.bell();
}
elements['discovery-invite'].addEventListener('click', () => { if (discoverySite) fill(discoverySite.invitation); elements.discovery.hidden = true; });
function applyResult(text, result, source) {
  state = result.state; ocean.syncCreation(state); ocean.paused = state.paused; renderState(); recentResult = result;
  mediaExperience.setPaused(state.paused);
  if (!['暂停', '继续', '撤销上一步', '重做上一步'].includes(text)) mediaExperience.updateFromCreation(text, result.changed);
  elements['response-line'].textContent = result.changed ? result.descriptions.slice(0, 2).join('，') : '世界保持不变。';
  elements['action-label'].textContent = result.issues.length ? result.issues.join(' ') : state.paused ? '已暂停。继续时从当前时刻恢复。' : '改变已应用 · 可以继续描述，也可以撤销';
  elements['action-label'].classList.toggle('issue', Boolean(result.issues.length));
  transcript.push({ text, descriptions: result.descriptions, issues: result.issues, source }); if (transcript.length > 12) transcript.shift(); renderHistory();
  if (result.changed) { document.body.classList.add('has-interacted'); if (!state.paused && !/撤销|重做|继续/.test(text)) sound.voice(state.entities.find(item => item.id === state.selected)?.asset || 'jelly'); }
}
async function send(raw, directPlan = null) {
  if (!ocean) return toast('圣城仍在构筑中，请稍候。');
  const text = String(raw).trim().slice(0, 240); if (!text) return;
  state.viewpoint = { position: ocean.worldPosition().toArray(), forward: ocean.camera.getWorldDirection(ocean.camera.position.clone()).setY(0).normalize().toArray() };
  const worldPlan = !directPlan && planWorld(text, { site: ocean.currentLandmark?.id, travelMode });
  if (worldPlan) { const result = await dispatchWorld(worldPlan); if (result.ok) elements.message.value = ''; previewIntent(); return; }
  const local = directPlan || interpretCreation(text, state); const stop = local.operations.some(action => action.kind === 'pause');
  if (stop) cancelNavigation();
  modelRequest?.abort(); const version = ++requestVersion;
  let plan = local;
  if (engine === 'model' && !directPlan && !stop) {
    modelRequest = new AbortController(); elements['send-button'].disabled = true; elements['conversation-form'].setAttribute('aria-busy', 'true'); elements['action-label'].textContent = '模型正在理解 · 可随时暂停取消；画面尚未改变';
    try {
      const response = await fetch('/api/interpret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'creation', text, context: creationContext(state), history: transcript.map(turn => turn.text).slice(-4) }), signal: modelRequest.signal });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || '模型没有返回可执行操作。'); plan = validateCreationPlan({ operations: payload.operations, issues: payload.issues });
    } catch (error) {
      if (version !== requestVersion || error.name === 'AbortError') return;
      applyResult(text, { state, changed: false, descriptions: [], issues: [error.message || '模型请求失败，没有应用任何改变。'] }, '模型请求未完成'); return;
    } finally {
      if (version === requestVersion) { modelRequest = null; elements['send-button'].disabled = false; elements['conversation-form'].setAttribute('aria-busy', 'false'); }
    }
  }
  if (version !== requestVersion) return;
  const result = await dispatchWorld(worldAction('creation', { plan, text, provenance: directPlan ? 'direct' : engine === 'model' && !stop ? 'model' : 'local' }));
  modelRequest = null; elements['send-button'].disabled = false; elements['conversation-form'].setAttribute('aria-busy', 'false');
  if (result.changed) elements.message.value = ''; previewIntent();
}
function direct(kind) { return send({ undo: '撤销上一步', redo: '重做上一步', pause: '暂停', resume: '继续' }[kind], { operations: [operation(kind)], issues: [] }); }
elements['conversation-form'].addEventListener('submit', event => { event.preventDefault(); send(elements.message.value); });
elements.message.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(elements.message.value); } });
elements['undo-button'].addEventListener('click', () => direct('undo')); elements['redo-button'].addEventListener('click', () => direct('redo'));
for (const id of ['pause-button', 'stop-button']) elements[id].addEventListener('click', () => direct(state.paused && !modelRequest ? 'resume' : 'pause'));
for (const name of panelIds) { elements[`${name}-button`].addEventListener('click', () => panel(name, elements[`${name}-panel`].hidden)); elements[`close-${name}`].addEventListener('click', () => panel(name, false)); }
elements['boundary-button'].addEventListener('click', () => panel('settings', true)); elements['clear-selection'].addEventListener('click', () => select(null));
elements['focus-button'].addEventListener('click', () => { ocean?.focusCreation(state.selected); document.body.classList.add('has-explored'); });
elements['quality-select'].addEventListener('change', event => ocean?.setQuality(event.target.value));
elements['reduced-toggle'].checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
elements['reduced-toggle'].addEventListener('change', event => { if (ocean) ocean.reduced = event.target.checked; document.body.classList.toggle('reduced-motion', event.target.checked); });
function immersive(enabled) { document.body.classList.toggle('immersive', enabled); elements['exit-immersive'].hidden = !enabled; (enabled ? elements['exit-immersive'] : elements['immersive-button']).focus(); }
elements['immersive-button'].addEventListener('click', () => immersive(true)); elements['exit-immersive'].addEventListener('click', () => immersive(false));
elements['fullscreen-button'].addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('当前环境不支持全屏，可使用纯净观景。'); } });
elements['sound-button'].addEventListener('click', async () => { try { const enabled = await sound.toggle(); elements['sound-button'].innerHTML = icon(enabled ? 'sound' : 'muted'); elements['sound-button'].setAttribute('aria-label', enabled ? '关闭海域配乐与环境声' : '开启海域配乐与环境声'); toast(enabled ? '海域配乐与海流已开启 · 建议佩戴耳机' : '海域配乐与环境声已关闭'); } catch { toast('当前环境不能开启声音。'); } });
function cancelNavigation() {
  navigationVersion++; clearTimeout(transitionTimer); elements['water-transition'].classList.remove('switching');
  elements['transition-label'].textContent = '';
}
for (const mode of ['quick', 'sail']) elements[`mode-${mode}`].addEventListener('click', () => {
  travelMode = mode;
  for (const option of ['quick', 'sail']) elements[`mode-${option}`].setAttribute('aria-pressed', String(option === mode));
  elements['travel-mode-note'].textContent = mode === 'quick' ? '默认快速切换，世界和你的造物不会重置。' : '看沿途景色。拖动或方向键可随时接管，暂停可停下。'; previewIntent();
});
async function navigate(region, requestedMode = travelMode) {
  if (!ocean) return;
  const landmark = [...LANDMARKS, ...ECOLOGY_VIEWS].find(item => item.id === region);
  if (!landmark) return;
  ocean.play.stop(); ocean.embodiment.exit(false); updateEmbodimentUI();
  cancelUnderstanding(); cancelNavigation();
  const version = navigationVersion;
  state.paused = false; ocean.paused = false; ocean.creationScene.paused = false;
  mediaExperience.setPaused(false);
  panel('journey', false); elements.discovery.hidden = true; elements['place-name'].textContent = landmark.name;
  recentResult = null; renderState(); document.body.classList.add('has-explored');
  if (requestedMode === 'sail') {
    ocean.travelTo(landmark.camera, landmark.target);
    elements['response-line'].textContent = `沿着海流，前往${landmark.name}。`; elements['action-label'].textContent = '沿途漫游 · 方向键或拖动可随时接管';
    return;
  }
  const started = performance.now();
  elements['transition-label'].textContent = `正在抵达 · ${landmark.name}`;
  elements['water-transition'].classList.add('switching');
  ocean.travelTarget = null; ocean.cruising = false; ocean.movement.clear();
  await new Promise(resolve => setTimeout(resolve, ocean.reduced ? 0 : 130));
      if (version !== navigationVersion) return;
  try {
    ocean.prepareDestination(landmark); ocean.jumpTo(landmark);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (version !== navigationVersion) return;
    latestTransition = { destination: region, mode: 'quick', elapsedMs: Math.round(performance.now() - started) };
    elements['response-line'].textContent = landmark.caption; elements['action-label'].textContent = landmark.gesture;
    elements['action-label'].classList.remove('issue'); renderSuggestions(); if (landmark.center) discover(landmark);
  } catch (error) { console.error(error); return { ok: false, message: '此处构筑未完成，可以重新选择海域。' }; }
  finally { if (version === navigationVersion) { elements['water-transition'].classList.remove('switching'); transitionTimer = setTimeout(() => { elements['transition-label'].textContent = ''; }, 180); } }
}
function requestTravel(site, mode = travelMode) { return dispatchWorld(worldAction('travel', { site, mode })); }
document.querySelectorAll('[data-region]').forEach(button => button.addEventListener('click', () => requestTravel(button.dataset.region))); elements['home-button'].addEventListener('click', () => requestTravel('palace'));
elements['first-wonder'].addEventListener('click', () => requestTravel('vortex'));
const ecologySection = document.createElement('section'); ecologySection.className = 'about-section';
ecologySection.innerHTML = '<h3>走近这片生态</h3><p>海扇与桌形珊瑚构成礁丛，海龟穿过中层，装甲古鱼缓慢巡游。礁鱼会避让靠近的视角与巨兽。</p><div class="memory-actions"></div><p>环境生物用于观景；想修改它们的同类，请用文字创造。古鱼与人鱼是幻想设计，不是古生物复原。</p>';
for (const view of ECOLOGY_VIEWS) {
  const button = document.createElement('button'); button.className = 'text-button'; button.textContent = view.name;
  button.addEventListener('click', () => requestTravel(view.id)); ecologySection.querySelector('.memory-actions').append(button);
}
elements['journey-panel'].append(ecologySection);
elements['snapshot-button'].addEventListener('click', async () => {
  if (!ocean) return; elements['snapshot-button'].disabled = true;
  try {
    const blob = await ocean.snapshot(); const image = await createImageBitmap(blob); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); image.close(); const size = Math.max(12, canvas.width / 100);
    context.fillStyle = 'rgba(8, 26, 30, .75)'; context.fillRect(0, canvas.height - size * 4, canvas.width, size * 4); context.fillStyle = '#e2dcc5'; context.font = `${size}px sans-serif`; context.fillText('即境 · 语言造物 | 实时 3D 原型 · 非 AI 视频模型生成', size * 2, canvas.height - size * 1.6);
    const output = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); const url = URL.createObjectURL(output); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `worldstage-creation-${Date.now()}.png`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast('已保存当前画面，保留实时三维原型标识。');
  } catch { toast('暂时无法保存画面，请重试。'); } finally { elements['snapshot-button'].disabled = false; }
});
function refreshEngine() { elements['engine-label'].textContent = engine === 'model' ? '大模型理解 · 受限造物指令' : '本地造物规则 · 未调用大模型'; elements['model-toggle'].textContent = engine === 'model' ? '切回本地规则' : modelSettings.available ? '启用大模型理解' : '大模型尚未配置'; }
elements['model-toggle'].addEventListener('click', () => {
  if (engine === 'model') { modelRequest?.abort(); requestVersion++; modelRequest = null; elements['send-button'].disabled = false; elements['conversation-form'].setAttribute('aria-busy', 'false'); engine = 'local'; refreshEngine(); toast('已切回本地模式，后续文字不发送给模型服务。'); }
  else if (modelSettings.available) elements['model-consent'].showModal();
});
elements['model-consent'].addEventListener('close', () => { if (elements['model-consent'].returnValue === 'allow') { engine = 'model'; refreshEngine(); } });
async function checkModel() {
  try { const response = await fetch(import.meta.env.MODE === 'public' ? './capabilities.json' : '/api/config'); if (response.ok) modelSettings = await response.json(); } catch {}
  elements['model-toggle'].disabled = !modelSettings.available; elements['model-status'].textContent = modelSettings.available ? `发现配置的服务 ${modelSettings.provider}，尚未调用。启用前须同意。` : '当前未配置大模型。正在使用本地语义规则，不具备开放式语言理解。'; elements['model-provider'].textContent = modelSettings.provider || '配置的服务商'; refreshEngine();
}
function startVoice() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Recognition) return toast('当前浏览器不支持语音识别，请使用文字输入。'); if (voice) { voice.stop(); return; }
  voice = new Recognition(); voice.lang = 'zh-CN'; voice.interimResults = true; voice.continuous = false;
  voice.onstart = () => { elements['mic-button'].classList.add('listening'); elements['mic-button'].setAttribute('aria-label', '停止语音输入'); elements['input-hint'].textContent = '正在倾听 · 再点麦克风停止'; };
  voice.onresult = event => { elements.message.value = Array.from(event.results).map(result => result[0].transcript).join('').slice(0, 240); previewIntent(); };
  voice.onerror = event => { toast(event.error === 'not-allowed' ? '麦克风未获授权，请用文字输入。' : '语音未完成，请检查输入文字或重试。'); };
  voice.onend = () => { voice = null; elements['mic-button'].classList.remove('listening'); elements['mic-button'].setAttribute('aria-label', '语音输入（使用前说明隐私）'); elements['input-hint'].textContent = '语音只填入文字 · 请检查后再点击创造'; elements.message.focus(); };
  try { voice.start(); } catch { voice = null; toast('无法启动语音识别，请使用文字。'); }
}
elements['mic-button'].addEventListener('click', () => { if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) return toast('当前浏览器不支持语音识别，请使用文字输入。'); if (voiceAllowed) startVoice(); else elements['voice-consent'].showModal(); });
elements['voice-consent'].addEventListener('close', () => { if (elements['voice-consent'].returnValue === 'allow') { voiceAllowed = true; startVoice(); } });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('dialog[open]')) return;
  if (event.key === 'Escape' && ocean?.embodiment.active) { event.preventDefault(); if (document.body.classList.contains('embodied-chat')) toggleEmbodiedChat(false); else dispatchWorld(worldAction('release-view')); return; }
  if (event.key === 'Escape') { voice?.stop(); if (document.body.classList.contains('immersive')) immersive(false); for (const name of panelIds) if (!elements[`${name}-panel`].hidden) panel(name, false); }
  if (event.key === 'Tab' && document.body.classList.contains('panel-open')) {
    const drawer = document.querySelector('.drawer:not([hidden])');
    const controls = [...(drawer?.querySelectorAll('button:not(:disabled), input, select, textarea, a[href]') || [])].filter(element => element.getClientRects().length);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (event.key === '/' && !event.target.matches('input, textarea, select') && !document.querySelector('dialog[open]') && !document.body.classList.contains('panel-open')) { event.preventDefault(); if (ocean?.embodiment.active) toggleEmbodiedChat(true); else elements.message.focus(); return; }
  if (!ocean || event.target.matches('input, textarea, select') || document.querySelector('dialog[open]') || document.body.classList.contains('panel-open')) return;
  if (event.code === 'KeyM' && !event.repeat && !event.metaKey && !event.ctrlKey) { event.preventDefault(); panel('chart', true); return; }
  const movementKey = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyQ: 'up', KeyE: 'down', ShiftLeft: 'fast', ShiftRight: 'fast' }[event.code];
  if (movementKey) { event.preventDefault(); cancelNavigation(); ocean.travelTarget = null; ocean.movement.add(movementKey); document.body.classList.add('has-explored'); return; }
  if (event.target !== ocean.renderer.domElement) return;
  if (event.code === 'Space') { event.preventDefault(); direct(state.paused ? 'resume' : 'pause'); }
  const movement = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[event.key];
  if (movement) { event.preventDefault(); ocean.flight = null; ocean.camera.position.x += movement[0]; ocean.camera.position.z += movement[1]; ocean.controls.target.x += movement[0]; ocean.controls.target.z += movement[1]; }
});
document.addEventListener('keyup', event => { const key = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyQ: 'up', KeyE: 'down', ShiftLeft: 'fast', ShiftRight: 'fast' }[event.code]; if (key) ocean?.movement.delete(key); });
window.addEventListener('blur', () => ocean?.movement.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) voice?.stop(); });
renderState(); renderHistory(); checkModel(); refreshMemory(); renderAtlas();
elements['place-caption'].textContent = 'W A S D 移动 · Q E 升降 · SHIFT 加速';
const cruise = document.createElement('button'); cruise.id = 'cruise-button'; cruise.className = 'text-button'; cruise.textContent = '▷ 持续前游'; cruise.setAttribute('aria-pressed', 'false');
document.querySelector('.world-tools').append(cruise);
cruise.addEventListener('click', () => { if (ocean) dispatchWorld(worldAction('cruise', { enabled: !ocean.cruising })); });
function nearbyActors() {
  if (!ocean) return [];
  const authored = [...ocean.creationScene.objects.values()].filter(entry => entry.root.visible && LIVING_ASSETS.includes(entry.item.asset)).map(entry => ({ root: entry.root, shape: entry.shape, species: entry.item.asset, id: entry.item.id, name: entry.item.name, living: true }));
  const natural = ocean.ecology.animals.filter(actor => actor.root.visible).map(actor => ({ ...actor, shape: actor.root, species: actor.kind, name: ASSETS[actor.kind], living: true }));
  if (ocean.ecology.ancient.root.visible) natural.push({ ...ocean.ecology.ancient, shape: ocean.ecology.ancient.root, species: 'ancient', name: ASSETS.ancient, living: true });
  if (ocean.embodiment.active?.living) natural.push(ocean.embodiment.active);
  const landmarks = [...ocean.landmarks.entries, ...ocean.wonders.entries.values()].filter(entry => entry.root.visible);
  for (const entry of landmarks) entry.root.traverse(root => { if (root.userData.creature && !root.isInstancedMesh) natural.push({ root, shape: root, species: root.userData.creature, name: ASSETS[root.userData.creature], living: true }); });
  return [...authored, ...natural].map(actor => ({ ...actor, distance: actor.root.getWorldPosition(ocean.camera.position.clone()).distanceTo(ocean.camera.position) })).filter(actor => actor.distance < 320).sort((first, second) => first.distance - second.distance);
}
function observeWorld() {
  return { position: ocean?.worldPosition().toArray(), time: ocean?.time || 0, paused: state.paused, actors: [...new Set(nearbyActors().map(actor => actor.species))], selection: Boolean(ocean?.embodiment.candidate), entities: state.entities.map(item => ({ id: item.id, asset: item.asset, params: { ...item.params }, position: [...item.position], renderedPosition: ocean?.creationScene.objects.get(item.id)?.root.getWorldPosition(ocean.camera.position.clone()).add(ocean.worldOffset).toArray() || null, following: item.following, leader: item.leader, orbit: item.orbit })), embodiment: ocean?.embodiment.inspect() || null, play: ocean?.play.inspect() || null, travel: { moving: Boolean(ocean?.travelTarget), cruising: Boolean(ocean?.cruising) } };
}
async function dispatchWorld(plan) { if (!ocean) return { ok: false, message: '世界仍在构筑中。' }; const result = await director.dispatch(plan); if (!result.ok) toast(result.message); return result; }
async function renderWorldAction({ kind, args }) {
  cancelUnderstanding();
  if (kind === 'creation') {
    const previous = args.plan.operations.some(action => action.kind === 'release') ? ocean.creationScene.captureFollowing(state) : state;
    const result = executeCreation(previous, args.plan, args.text);
    applyResult(args.text, result, { direct: '直接操作 → 世界规划器', local: '本地规则 → 世界规划器', model: '大模型理解 → 白名单 → 世界规划器' }[args.provenance]); return result;
  }
  if (kind === 'travel') return navigate(args.site, args.mode);
  if (kind === 'cruise') { ocean.cruising = args.enabled; ocean.travelTarget = null; if (args.enabled) wakeWorld(); renderState(); document.body.classList.add('has-explored'); return; }
  if (kind === 'calm') { ocean.play.calm(); toast('光与和声正在缓缓回落。'); return; }
  if (kind === 'release-view') { endEmbodiment(); return; }
  if (kind === 'trial') { wakeWorld(); ocean.play.start(args.site, args.species); updateEmbodimentUI(); document.body.classList.add('has-explored'); ocean.renderer.domElement.focus(); return; }
  if (kind === 'switch-view') { ocean.embodiment.setView(); updateEmbodimentUI(); return; }
  if (kind === 'inhabit') { const actor = args.target === 'selection' ? ocean.embodiment.candidate : nearbyActors().find(actor => actor.species === args.species); if (!actor) return { ok: false, message: '它已游远，请重新选择。' }; wakeWorld(); ocean.embodiment.enter(actor); updateEmbodimentUI(); document.body.classList.add('has-explored'); ocean.renderer.domElement.focus(); return; }
  if (kind === 'talk') {
    const actor = nearbyActors().find(actor => actor.species === args.species);
    const replies = { whale: '我记得这座城尚在海面之上的歌。你若愿意，我与你同行。', shark: '沿着海流前行。与我保持距离，也保持好奇。', turtle: '不必赶路。珊瑚的光，会告诉我们方向。', manta: '把视角交给我，一起穿过那些沉睡的光环。', mermaid: '天门听见名字，海流记住来者。试着呼唤你的伙伴。' };
    const response = replies[args.species] || '海流替它回应了你。';
    ocean.pulse(actor.root.getWorldPosition(ocean.camera.position.clone()), 3); sound.voice(args.species, args.species === 'whale'); sound.chant(response);
    elements['response-line'].textContent = response; elements['action-label'].textContent = '预设角色回应 · 非开放式 AI 对话 · 点选生物可进入它的视角';
    if (actor.id) select(actor.id); return;
  }
  if (kind === 'ritual') {
    const site = LANDMARKS.find(site => site.id === args.site);
    if (args.summon) {
      const phrase = `在前方创造一只${args.summon}`;
      const previous = { ...state, viewpoint: { position: [site.center[0], site.id === 'gate' ? 37 : site.center[1], site.center[2] + 28], forward: [0, 0, 1] } };
      const result = executeCreation(previous, interpretCreation(phrase, previous), phrase);
      if (!result.changed || result.issues.length) return { ok: false, message: result.issues[0] || '召唤未完成。' };
      applyResult(phrase, result, '世界规划器 → 天门召唤');
    }
    wakeWorld(); ocean.play.celebrate(args.site);
    const response = args.summon ? `潮汐记得你的呼唤。${args.summon}，从旧日之海归来。` : `${site.name}，听见了你的声音。`;
    sound.chant(response); elements['response-line'].textContent = response; elements['action-label'].textContent = '36 秒海底盛典 · 可暂停或让海流平静 · 吟声为合成艺术效果';
    recentResult = null; document.body.classList.add('has-interacted');
  }
}
function wakeWorld() { state.paused = false; ocean.paused = false; ocean.creationScene.paused = false; mediaExperience.setPaused(false); renderState(); }
function updateEmbodimentUI() {
  const active = ocean?.embodiment.active;
  document.body.classList.toggle('is-embodied', Boolean(active)); elements['inhabit-controls'].hidden = !active; elements['swim-pad'].hidden = !active?.living;
  if (!active) { toggleEmbodiedChat(false); return; }
  elements['inhabit-prompt'].hidden = true;
  elements['inhabit-mode'].textContent = active.living ? 'INHABIT THIS WORLD' : 'A DIFFERENT POINT OF VIEW';
  elements['inhabit-title'].textContent = active.name;
  elements['inhabit-help'].textContent = active.living ? 'WASD 游动 · Q / E 升降 · Shift 加速 · 拖动转向' : '自动 360° 环绕 · 拖动接管 · 滚轮靠近';
  elements['inhabit-view'].textContent = active.living ? ocean.embodiment.firstPerson ? '切换第三人称' : '切换第一人称' : ocean.controls.autoRotate ? '暂停环绕' : '继续环绕';
}
function endEmbodiment() { if (ocean?.play.trial) ocean.play.stop(); else ocean?.embodiment.exit(); updateEmbodimentUI(); elements['home-button'].focus(); }
elements['inhabit-enter'].addEventListener('click', () => dispatchWorld(worldAction('inhabit', { target: 'selection' })));
elements['inhabit-dismiss'].addEventListener('click', () => { elements['inhabit-prompt'].hidden = true; });
elements['inhabit-exit'].addEventListener('click', () => dispatchWorld(worldAction('release-view')));
elements['inhabit-view'].addEventListener('click', () => dispatchWorld(worldAction('switch-view')));
function toggleEmbodiedChat(open) { document.body.classList.toggle('embodied-chat', open); elements['inhabit-speak'].setAttribute('aria-expanded', String(open)); elements['inhabit-speak'].textContent = open ? '收起对话' : '对世界说话'; if (open) { ocean.movement.clear(); elements.message.focus(); } }
elements['inhabit-speak'].addEventListener('click', () => toggleEmbodiedChat(!document.body.classList.contains('embodied-chat')));
for (const button of document.querySelectorAll('[data-swim]')) {
  button.addEventListener('pointerdown', event => { event.preventDefault(); if (!ocean) return; button.setPointerCapture(event.pointerId); ocean.movement.add(button.dataset.swim); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => ocean?.movement.delete(button.dataset.swim));
}
elements['trial-start'].addEventListener('click', () => dispatchWorld(worldAction('trial', { site: ocean?.currentLandmark?.id, species: elements['trial-species'].value })));
elements['trial-exit'].addEventListener('click', () => dispatchWorld(worldAction('release-view')));
elements['festival-start'].addEventListener('click', () => dispatchWorld(worldAction('ritual', { site: ocean?.currentLandmark?.id })));
elements['festival-stop'].addEventListener('click', () => dispatchWorld(worldAction('calm')));
elements['ritual-example'].addEventListener('click', () => fill(ocean?.currentLandmark?.id === 'gate' ? '唤醒回声天门，召唤鲸鱼' : `唤醒${ocean?.currentLandmark?.name || '潮生圣城'}`));
const audioSettings = document.createElement('section'); audioSettings.className = 'about-section';
audioSettings.innerHTML = '<h3>海域配乐与回声</h3><p>每片海域有独立的原创合成和声、钟鸣与水流音色。切换时渐变，盛典时增加层次；默认关闭，不加载第三方音乐。</p><label class="setting-row">本机文字吟诵<input id="narration-toggle" type="checkbox"/></label><p>仅选用浏览器标记为本机的中文语音。不上传文字；无本机声音时仅展示字幕与合成吟声。合成吟声是艺术设计，不是历史古语或动物语言复原。</p>';
elements['settings-panel'].append(audioSettings);
audioSettings.querySelector('input').addEventListener('change', event => { sound.narration = event.target.checked; if (!sound.narration) sound.stopChant(); else if (!globalThis.speechSynthesis?.getVoices().some(voice => voice.localService && /^zh/i.test(voice.lang))) toast('当前没有可用的本机中文声音，保留字幕与合成吟声，不会改用云端服务。'); });
function updatePlayUI() {
  const site = ocean.currentLandmark; const play = ocean.play.inspect();
  document.body.classList.toggle('trial-complete', Boolean(play.trial?.finished));
  elements['site-play'].hidden = !site || Boolean(ocean.embodiment.active);
  if (site) { elements['site-play-name'].textContent = SITE_PLAY[site.id].name; elements['site-play-hint'].textContent = SITE_PLAY[site.id].instruction; elements['ritual-example'].textContent = site.id === 'gate' ? '输入召唤内容，让天门回应 →' : '用一句话唤醒这里 →'; }
  elements['trial-hud'].hidden = !play.trial; elements['trial-bearing'].hidden = !play.trial || play.trial.finished;
  if (play.trial) {
    const trial = play.trial; elements['trial-name'].textContent = SITE_PLAY[trial.id].name; elements['trial-category'].textContent = trial.finished ? 'THE SEA REMEMBERS YOU' : 'A JOURNEY IN FIVE LIGHTS';
    elements['trial-instruction'].textContent = SITE_PLAY[trial.id].instruction; elements['trial-score'].textContent = `${trial.progress} / 5`; elements['trial-time'].textContent = `${trial.elapsed.toFixed(1)} s`; elements['trial-feedback'].textContent = trial.feedback;
    if (trial.next) {
      const direction = trial.next.map((value, index) => value - ocean.embodiment.position.getComponent(index));
      const angle = (Math.atan2(-direction[0], -direction[2]) - ocean.embodiment.heading) * -180 / Math.PI;
      elements['trial-bearing'].querySelector('span').style.transform = `rotate(${angle}deg)`;
      elements['trial-bearing'].querySelector('b').textContent = `下一枚光环 · ${Math.round(Math.hypot(...direction))} m${direction[1] > 8 ? ' · 上浮' : direction[1] < -8 ? ' · 下潜' : ''}`;
    }
  }
  elements['festival-caption'].hidden = !play.show;
  if (play.show) { elements['festival-title'].textContent = LANDMARKS.find(site => site.id === play.show.id).name; elements['festival-stage'].textContent = play.show.name; }
  if (!ocean.embodiment.active && document.body.classList.contains('is-embodied')) updateEmbodimentUI();
}
async function boot() {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    await Promise.all([prepareSurfaces(), prepareCreatureSurfaces()]);
    ocean = new Ocean(elements.ocean, {
      sound,
      onCeremony: () => { elements.discovery.hidden = true; },
      onObjectInspect: candidate => { elements['inhabit-name'].textContent = `${candidate.name} · ${candidate.living ? '可化身' : '可环绕观察'}`; elements['inhabit-prompt'].hidden = false; },
      onCreationSelect: id => select(id), onAnchor: point => { state.anchor = point; select(null); elements['input-hint'].textContent = '已指认一处海床。试着说“在这里创造珊瑚”。'; toast('已指认海床位置 · “这里”将指向此处'); },
      onExplore: () => { cancelNavigation(); document.body.classList.add('has-explored'); }, onFlightInterrupted: () => { journeyState = interruptJourney(journeyState); },
      onRegionChange: () => { elements['water-transition'].classList.remove('crossing'); void elements['water-transition'].offsetWidth; elements['water-transition'].classList.add('crossing'); renderState(); },
      onArrive: destination => { const arrival = arriveAt(journeyState, destination); journeyState = arrival.state; elements['place-name'].textContent = PLACES[destination].name; },
      onTravelArrive: () => { const landmark = ocean.currentLandmark; elements['response-line'].textContent = landmark?.caption || '海流在这里慢了下来。'; elements['action-label'].textContent = landmark?.gesture || '继续前游，或者在这里创造'; renderSuggestions(); },
      onFrame: () => {
        if (!ocean) return;
        cruise.textContent = ocean.cruising ? 'Ⅱ 停止前游' : '▷ 持续前游'; cruise.setAttribute('aria-pressed', String(ocean.cruising));
        elements['place-name'].textContent = ocean.currentLandmark?.name || ocean.currentBiome?.name || '潮生圣城';
        const position = ocean.worldPosition();
        const nearest = nearestLandmark(position.toArray());
        const heading = ocean.camera.getWorldDirection(ocean.camera.position.clone());
        const bearing = Math.round((Math.atan2(heading.x, -heading.z) * 180 / Math.PI + 360) % 360);
        seaChart.update({ position: position.toArray(), bearing, visited: [...discovered] });
        updatePlayUI();
        const site = ocean.currentLandmark?.id || ocean.currentBiome?.id;
        if (site !== soundtrackSite) { soundtrackSite = site; sound.setScene(site); }
        elements['place-caption'].textContent = `${String(bearing).padStart(3, '0')}° / ${Math.round(position.x)} E · ${Math.round(-position.z)} N`;
        if (ocean.travelTarget) elements['action-label'].textContent = `沿海流航行 · ${Math.round(ocean.travelElapsed / ocean.travelDuration * 100)}% · 拖动画面即可接管`;
        discover(ocean.currentLandmark);
        if (!elements['journey-panel'].hidden) for (const landmark of LANDMARKS) document.querySelector(`[data-distance="${landmark.id}"]`).textContent = `${Math.round(Math.hypot(position.x - landmark.center[0], position.z - landmark.center[2]))} m${nearest.id === landmark.id ? ' · 最近的遗迹' : ''}`;
        if (modelRequest || !recentResult?.changed || recentResult.issues.length || state.paused) return;
        const growing = ocean.creationScene.inspect().filter(item => item.growing); elements['action-label'].textContent = growing.length ? `${growing.length} 个造物正在成形 · 可以随时暂停` : '改变已应用 · 接着描述，世界会记住上一次改变';
      },
      onPerformance: fps => { elements['performance-note'].textContent = `当前约 ${fps} 帧 / 秒 · 设备实测值，非性能承诺`; }, onError: toast,
    });
    ocean.syncCreation(state, true); ocean.creationScene.update(0.01); document.body.classList.add('is-ready'); setTimeout(() => { elements.loading.hidden = true; }, 700);
    readyMilliseconds = Math.round(performance.now() - loadingStarted);
    window.__WORLDSTAGE__ = { ready: true, inspect: () => ({ ...ocean.inspect(), position: ocean.worldPosition().toArray(), offset: ocean.worldOffset.toArray(), streaming: ocean.endless.inspect(), biome: ocean.currentBiome, landmark: ocean.currentLandmark?.id || null, visited: [...discovered], traveling: Boolean(ocean.travelTarget), switching: elements['water-transition'].classList.contains('switching'), travelMode, readyMilliseconds, latestTransition, media: mediaExperience.inspect(), chart: seaChart.inspect(), embodiment: ocean.embodiment.inspect(), play: ocean.play.inspect(), audio: { enabled: sound.enabled, site: sound.site, intensity: sound.intensity, narration: sound.narration }, state: structuredClone(state), engine, transcript: structuredClone(transcript) }) }; if (import.meta.env.DEV) window.__ART__ = ocean;
    window.__WORLDSTAGE__.planning = () => director.inspect();
    const requestedScene = new URLSearchParams(location.search).get('scene');
    if ([...LANDMARKS, ...ECOLOGY_VIEWS].some(place => place.id === requestedScene) && requestedScene !== 'palace') await requestTravel(requestedScene);
    if (savedMemory) toast('发现上次的世界 · 打开“此刻的造物”，可以继续探索');
  } catch (error) {
    console.error(error); elements.loading.replaceChildren(); const title = document.createElement('strong'); title.textContent = '暂时无法构筑这片海'; const detail = document.createElement('p'); detail.textContent = '图形初始化或资源加载未完成，请确认浏览器支持 WebGL 2 与硬件加速。'; const retry = document.createElement('button'); retry.className = 'primary-button'; retry.textContent = '重新载入'; retry.onclick = () => location.reload(); elements.loading.append(title, detail, retry);
  }
}
boot();
