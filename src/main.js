import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import './style.css';
import { OceanSound } from './sound.js';
import { scoreFor } from './orchestra-score.js';
import { ASSETS, LIVING_ASSETS, CREATION_EXAMPLES, initialCreation, interpretCreation, executeCreation, operation, creationContext, validateCreationPlan } from './creation.js';
import { initialState, interpretUtterance, executeUtterance, arriveAt, interruptJourney } from './dialogue.js';
import { REGIONS, PLACES } from './world.js';
import { setupMedia } from './media-experience.js';
import { LANDMARKS, ECOLOGY_VIEWS, ATLAS_SITES, nearestLandmark } from './landmarks.js';
import { MEMORY_KEY, readMemory, writeMemory } from './world-memory.js';
import { SeaChart, seaChartMarkup } from './sea-chart.js';
import { embodimentMarkup, playMarkup, SITE_PLAY } from './world-interface.js';
import './interaction.css';
import './responsive.css';
import { setupViewport } from './viewport.js';
import { planWorld, worldAction, WorldDirector, validateWorldPlan } from './world-planner.js';
import { PALACE_ROOMS } from './palace-layout.js';
import { palaceNavigationMarkup } from './palace-wayfinding.js';
import './palace.css';
import { StoryReader } from './story-reader.js';
import { STORY_ENTRIES, storyForObject, advanceStory } from './tide-stories.js';
import './story-reader.css';
import { initialGuide, advanceGuide, guideCopy } from './creation-guide.js';
import './creation-guide.css';

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
    <header class="topbar"><button id="home-button" class="brand" aria-label="回到圣城初始视角"><img src="./mark.svg" alt=""/><span>即境<small>WORLDSTAGE</small></span></button><div class="edition"><span>A WORLD, IN YOUR WORDS</span><b>亚特兰蒂斯 <i>/</i> 造物篇 <small>0.10</small></b></div><nav class="top-actions" aria-label="画面控制">${control('tools-button', 'layers', '探索工具')}<button id="settings-button" class="text-button">设置</button>${control('sound-button', 'muted', '开启奇观管弦配乐')}${control('pause-button', 'pause', '暂停画面')}${control('immersive-button', 'expand', '全屏观看')}</nav></header>
    <section class="world-title" aria-label="作品介绍"><div class="eyebrow">THE PALACE OF TIDES</div><h1>一念生城。<br/><em>万物有回声。</em></h1><p>这里的巨兽，记得潮汐以前的事。<br/>而这个世界，等待你的下一句话。</p><button id="first-wonder" class="wonder-invitation">先去看一场奇观 <span aria-hidden="true">↗</span></button><small>实时三维 · 语言造物 · 每一步都能反悔</small></section>
    <div class="world-tools"><button id="objects-button" class="objects-button">${icon('layers')}<span>此刻的造物</span><b id="object-count">04</b></button><button id="journey-button" class="text-button">${icon('compass')} 海域与奇观</button></div>
    <div id="selection-label" class="selection-label" hidden><span class="selection-dot"></span><span id="selected-name"></span>${control('focus-button', 'focus', '靠近选中的造物')}${control('clear-selection', 'close', '取消选择')}</div>
    <section id="discovery" class="discovery" aria-live="polite" hidden><small id="discovery-number"></small><h2 id="discovery-name"></h2><p id="discovery-caption"></p><button id="discovery-invite" class="text-button"></button></section>
    <section class="conversation" aria-label="用文字或语音创造世界"><div id="response" class="response" role="status" aria-live="polite"><p id="response-line">让想象，在海底有形。</p><span id="action-label">先创造，再靠近、改色，或让它与你同行。</span></div><div id="suggestions" class="suggestions" aria-label="可编辑的造物示例"></div><div class="composer-topline"><span id="engine-label">本地造物规则</span><div class="composer-aux"><button id="save-world">保存世界</button><button id="history-button">创作记录 <span id="history-count">00</span></button></div></div>
      <form id="conversation-form" class="composer" autocomplete="off"><span class="composer-mark">${icon('wave')}</span><label class="sr-only" for="message">描述你想创造或改变的事物</label><textarea id="message" maxlength="240" rows="1" placeholder="创造一只海龟，然后让它跟随我……" enterkeyhint="send"></textarea>${control('mic-button', 'mic', '语音输入（使用前说明隐私）')}<button id="send-button" type="submit" class="send-button" aria-label="创造或修改世界">${icon('arrow')}</button></form>
      <div id="intent-preview" class="intent-preview" role="status" aria-live="polite" hidden></div><div class="composer-footer"><span id="input-hint">点击生物立即化身 · 点击静物环绕 · Esc 返回</span><div class="undo-tools">${control('undo-button', 'undo', '撤销上一步')}${control('redo-button', 'redo', '重做上一步')}<button id="stop-button">暂停造物</button></div></div></section>
    <div class="scene-caption"><span id="place-name">潮生圣城</span><small id="place-caption">148 M BELOW THE SURFACE</small></div><div class="capture-tools">${control('snapshot-button', 'camera', '保存当前画面')}<span>留住这一刻</span></div>
    <footer class="bottomline"><button id="boundary-button"><i></i> 实时 3D 造物原型 <span>· 非 AI 视频模型生成</span></button><span>拖动环顾 <i> / </i> 滚轮靠近</span></footer>
    <aside id="objects-panel" class="drawer" aria-label="此刻的造物" hidden>${panelHead('objects', 'THE THINGS YOU SHAPED', '此刻的造物')}<p class="drawer-intro">点击条目直接进入它的视角。<br/>进入后点“对世界说话”，仍可继续修改它。</p><div id="object-list"></div><section class="about-section"><h3>让世界留在这里</h3><p id="memory-summary">尚无本机存档。</p><div class="memory-actions"><button id="load-world" class="primary-button" disabled>继续上次的世界</button><button id="forget-world" class="text-button" disabled>删除存档</button></div><p>仅手动保存到此浏览器。保留造物、关系、视角与足迹；不保存输入原文、录音或密钥。清理浏览器数据会清除存档。</p></section><p class="drawer-note">最多 20 个可编辑造物，远处的自然遗迹不计入。<br/>离开前点击“保存世界”。未保存的改变会在刷新后消失。</p></aside>
    <aside id="history-panel" class="drawer" aria-label="创作记录" hidden>${panelHead('history', 'WORDS BECOME WORLDS', '世界如何生长')}<p class="drawer-intro">你的描述、理解来源与应用结果。<br/>不是预录视频，每次改变都有据可查。</p><div id="history-list"></div></aside>
    <aside id="tools-panel" class="drawer tools-panel" aria-label="探索工具" hidden>${panelHead('tools', 'EXPLORE AT YOUR OWN PACE', '探索与创造')}<p class="drawer-intro">在画面里点到谁，就直接进入谁的视角。<br/>这里收纳海图、小游戏、存档与录像。</p><div id="tools-content"></div></aside>
    <aside id="journey-panel" class="drawer" aria-label="海域与奇观" hidden>${panelHead('journey', 'AN ATLAS WITHOUT AN EDGE', '奇观在远方')}<p class="drawer-intro">遗迹、宫城、海面奇观与生态海域，并列探索。<br/>先去看见，再用一句话唤醒。</p><div class="travel-mode" role="group" aria-label="地点切换方式"><button id="mode-quick" aria-pressed="true">快速抵达</button><button id="mode-sail" aria-pressed="false">沿途漫游</button></div><p id="travel-mode-note" class="travel-mode-note">默认快速切换，世界和你的造物不会重置。</p><div class="atlas-count"><span id="visited-count">01 / 11 已抵达</span><span>遗迹与动态奇观</span></div><div class="region-list">${ATLAS_SITES.map(landmark => `<button data-region="${landmark.id}" aria-label="前往${landmark.name}"><small>${landmark.number}</small><span>${landmark.name}${landmark.wonder || landmark.category ? `<strong class="wonder-type">${landmark.category || '动态奇观'}</strong>` : ''}<em>${landmark.caption}</em><i data-distance="${landmark.id}"></i></span><b data-visited="${landmark.id}">↗</b></button>`).join('')}</div><p class="drawer-note">拖动环顾，WASD 前后左右，Q / E 升降。<br/>触屏可拖动转向，点击“持续前游”。地标之外仍可探索，没有固定地图墙。</p></aside>
    <aside id="settings-panel" class="drawer" aria-label="设置与能力说明" hidden>${panelHead('settings', 'THE CRAFT BEHIND THE WORLD', '让想象有所回应')}
      <section class="about-section"><h3>这一版可以创造什么</h3><p>14 类资产：神殿、拱门、星门、珊瑚、鲸鱼、鲨鱼、蝠鲼、水母、鱼群、三叉戟、装甲古鱼、海龟、鹦鹉螺、人鱼。文字可以指定位置、数量、尺度、材质色、光芒、速度与高度；遗迹可调整侵蚀与附生珊瑚。</p><p>例如：“创造一只海龟” → “让海龟跟随鲸鱼”。可让生物同行、环绕建筑，或让鲸鱼接近珊瑚时触发发光。说“停止跟随”，它会留在旅途中的当前位置。</p><p>形状来自有边界的三维资产与参数组合，不支持任意新物种或逐帧视频生成。已有实体碰撞、近域避让和有限捕食，不是科研级物理或生态模拟。命名地标与环境生态不能任意修改；可直接代入，或创造同类。人鱼头手使用经 Blender 处理的基础网格，装甲古鱼与人鱼仍为幻想设计，不是科学复原。</p></section>
      <section class="about-section"><h3>理解引擎</h3><p id="model-status">正在检查服务配置……</p><button id="model-toggle" class="primary-button" disabled>大模型尚未配置</button><p>默认是有边界的本地规则，不假装任意自然语言都能理解。模型接入后也只能操作支持的资产和属性；失败不会偷偷降级。</p></section>
      <section class="about-section"><h3>让世界持续回应</h3><p>微光沿着水流、珊瑚枝脉与石纹传播；鱼群形成倾斜交叠的星环。花火只作为层次与规模的美术参考，不在海底发射烟花或举办庆典。天门支持召唤已有生物形态，三类小游戏可重复探索。</p><p>直接点击生物进入它的第一视角，点击静物进入环绕视角。代入后可用当前生物探索；未代入时小游戏以蝠鲼开始，不弹视角选择框。暂停会冻结画面，轻声伴奏继续；“让海流平静”让环境回应缓缓结束。</p></section>
      <section class="about-section"><h3>一片有竞争的海</h3><p id="ecology-status">灰礁鲨追捕礁鱼，鱼群分散躲避；捕食后会饱食休息，不持续屠杀。</p><p>种群补充受迁入间隔和可见范围限制。保护正在操控的角色与手工造物；不显示血腥。有限捕食与种群模型，不代表完整食物网、遗传演化或真实种群比例。</p><h3>鲸鸣与鲸落</h3><p>鲸鸣使用 NOAA PMEL 座头鲸录音，做距离衰减与立体声定位；远方也会不定时传来回声。鲸落花园可主动观看 76 秒时间叙事；活鲸回声退去后不再鸣叫。遗骸与生态接续是漫长过程的压缩艺术演绎，保留神话花园，不作为深海生态科学复原。</p></section>
      <section class="about-section"><h3>混合世界架构</h3><p>规划器理解意图，白名单校验可执行范围；持久造物状态与即时世界反馈记录位置、关系、视角和试炼进度；三维、镜头和音频负责连续呈现。文字与主要互动按钮共用执行入口。</p><p>当前是“规则规划器 + 显式世界状态 + 实时渲染器”，不是经过训练的神经世界模型。可选语言模型只输出受限造物计划，不能直接执行代码；公开版不调用付费模型，也未集成高斯泼溅。</p></section>
      <section class="about-section"><h3>画面与动态</h3><label class="setting-row">画质<select id="quality-select"><option value="high">精细</option><option value="balanced" selected>均衡</option><option value="performance">流畅</option></select></label><label class="setting-row">自适应渲染分辨率<input id="adaptive-toggle" type="checkbox" checked/></label><p>持续卡顿时逐级降低三维渲染分辨率，稳定后缓慢恢复。不会删除生物、关掉碰撞或降低界面清晰度；关闭后使用固定画质。</p><label class="setting-row">降低动态效果<input id="reduced-toggle" type="checkbox"/></label><p id="performance-note">根据设备选择画质，优先保持交互流畅。</p><button id="fullscreen-button" class="text-button">全屏观看</button><p>安卓支持时使用浏览器全屏；iPhone 不支持时进入纯净观景。可从 Safari 分享菜单添加到主屏幕，以独立窗口打开。横竖屏均可操作。</p></section>
      <section class="about-section"><h3>隐私与素材</h3><p>本地模式不外发文字。语音可能使用浏览器提供商服务，先告知再使用；识别后仅填入输入框，确认才执行。不保存录音。模型模式另行征求同意。</p><p>参考图仅用于本地美术分析，没有作为背景贴图，也未上传外部模型。石材纹理由 Poly Haven CC0 资源提供；建筑和生态以程序化建模为主；人鱼局部使用授权基础网格，音乐由采样乐器演奏，歌声与鲸鸣使用来源明确的录音。</p></section></aside>
    <dialog id="voice-consent" aria-labelledby="voice-title"><form method="dialog"><span class="eyebrow">VOICE INPUT</span><h2 id="voice-title">先说清楚，再听你说。</h2><p>语音由浏览器识别，音频可能发送给浏览器提供商。本作品不保存录音。</p><p>识别结果只填入输入框。请检查文字，再点击创造。</p><div class="dialog-actions"><button value="cancel">继续用文字</button><button value="allow" class="primary-button">同意并开启麦克风</button></div></form></dialog>
    <dialog id="model-consent" aria-labelledby="model-title"><form method="dialog"><span class="eyebrow">LANGUAGE MODEL</span><h2 id="model-title">让模型理解，让世界执行。</h2><p>你的文字、最近 4 条描述和必要的造物状态将发送给 <strong id="model-provider"></strong>。服务可能收费，并受其数据政策约束。</p><p>不发送参考图、文件或录音；密钥仅在服务端。模型结果经过白名单校验，不能执行任意代码。</p><div class="dialog-actions"><button value="cancel">保留本地模式</button><button value="allow" class="primary-button">同意并启用</button></div></form></dialog>
    <dialog id="memory-confirm" aria-labelledby="memory-title"><form method="dialog"><span class="eyebrow">A WORLD REMEMBERED</span><h2 id="memory-title"></h2><p id="memory-detail"></p><div class="dialog-actions"><button value="cancel">取消</button><button value="allow" class="primary-button">确认</button></div></form></dialog>
    <aside id="story-panel" class="drawer story-panel" aria-label="潮汐手记与角色对话" hidden>${panelHead('story', 'MEMORIES BENEATH THE TIDE', '潮汐手记')}<div id="story-content"></div></aside>
    ${seaChartMarkup()}${embodimentMarkup()}${playMarkup()}
    <div id="toast" class="toast" role="status" hidden></div><button id="exit-immersive" class="exit-immersive" hidden>返回造物 ↗</button>
  </main>`;

const elements = Object.fromEntries([...document.querySelectorAll('[id]')].map(element => [element.id, element]));
document.querySelector('.edition small').textContent = '0.14.5 · 柔光浮游';
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
const loadingStarted = 0;
const startupStages = [];
let readyMilliseconds = null;
let creationGuide = initialGuide();
const transcript = [];
const sound = new OceanSound();
const storyButton = document.createElement('button'); storyButton.id = 'story-button'; storyButton.textContent = '潮汐手记 · 故事、角色与文献'; document.querySelector('#tools-content').append(storyButton); elements['story-button'] = storyButton;
const panelIds = ['objects', 'history', 'journey', 'settings', 'chart', 'tools', 'story'];
const mediaExperience = setupMedia({ getOcean: () => ocean, toast, onPanel: open => panel('media', open) });
const seaChart = new SeaChart({ navigate: (id, mode) => dispatchWorld(worldAction('travel', { site: id, mode })), open: () => panel('chart', true), guide: () => panel('journey', true) });
const director = new WorldDirector({ observe: observeWorld, render: renderWorldAction });
let stories;
stories = new StoryReader({ container: elements['story-content'], context: observeWorld, dispatch: (entry, choice) => dispatchWorld(worldAction('story', choice ? { entry, choice } : { entry })), navigate: async room => { panel('story', false); await dispatchWorld(worldAction('palace-room', { room })); }, notify: toast, synchronize: story => ocean?.palace.setStoryState(story) });
const viewportControls = setupViewport({ closePanels: () => panel('tools', false), toast });
const guideElement = document.createElement('section');
guideElement.id = 'creation-guide'; guideElement.className = 'creation-guide'; guideElement.hidden = true;
guideElement.setAttribute('aria-label', '初次造物引导');
guideElement.innerHTML = '<div class="guide-heading"><span id="guide-progress"></span><button id="guide-dismiss" type="button" aria-label="退出引导，保留世界">退出引导</button></div><div role="status" aria-live="polite"><h2 id="guide-title"></h2><p id="guide-detail"></p></div><div class="guide-actions"><button id="guide-action" type="button"></button></div>';
document.querySelector('.conversation').prepend(guideElement);
for (const element of guideElement.querySelectorAll('[id]')) elements[element.id] = element;
const startCreation = document.createElement('button'); startCreation.id = 'start-creation'; startCreation.className = 'guide-start'; startCreation.innerHTML = '用一句话，创造生命 <span aria-hidden="true">↗</span>';
elements['first-wonder'].before(startCreation);
const guideButton = document.createElement('button'); guideButton.id = 'guide-button'; guideButton.textContent = '初次造物 · 五步亲手创造'; elements['tools-content'].prepend(guideButton);
for (const button of [startCreation, guideButton]) button.addEventListener('click', () => {
  if (!ocean) return toast('世界正在构筑，完成后就能开始。');
  if (ocean.embodiment.active) endEmbodiment();
  panel('tools', false); creationGuide = initialGuide(true); renderCreationGuide();
  if (!elements.message.value.trim()) fill('在前方创造一只海龟，然后让它跟随我');
});
elements['guide-dismiss'].addEventListener('click', () => { creationGuide.active = false; renderCreationGuide(); toast('已退出引导，你的创造和存档都保留。'); elements['home-button'].focus({ preventScroll: true }); });
elements['guide-action'].addEventListener('click', () => {
  const target = state.entities.find(entity => entity.id === creationGuide.targetId);
  if (creationGuide.step === 'create') fill('在前方创造一只海龟，然后让它跟随我');
  else if (creationGuide.step === 'edit' && target) { select(target.id); fill(target.params.color === 'gold' ? '让它变成珍珠色' : '让它变成金色'); }
  else if (creationGuide.step === 'undo' && target) void send('撤销它的上一步修改', { operations: [operation('undo', { target: target.id })], issues: [] });
  else if (creationGuide.step === 'inhabit' && target) { wakeWorld(); ocean.focusCreation(target.id); document.activeElement?.blur(); toast('直接点击画面里的伙伴，就会进入它的视角。'); }
  else if (creationGuide.step === 'save') { if (ocean.embodiment.active) void dispatchWorld(worldAction('release-view')); else { refreshMemory(); confirmMemory('save'); } }
  else if (creationGuide.step === 'complete') { creationGuide.active = false; renderCreationGuide(); elements['home-button'].focus({ preventScroll: true }); }
});
let soundtrackSite = null;
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('cancel', () => { dialog.returnValue = 'cancel'; }));

function toast(message) {
  clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 5200);
}
function panel(name, open) {
  if (name === 'story' && open) stories.render();
  if (open && !document.body.classList.contains('panel-open')) returnFocus = document.activeElement;
  if (open) ocean?.movement.clear();
  if (open) document.querySelector('#media-panel').hidden = true;
  for (const id of panelIds) elements[`${id}-panel`].hidden = id !== name || !open;
  if (name === 'media') document.querySelector('#media-panel').hidden = !open;
  document.body.classList.toggle('panel-open', open);
  document.body.classList.toggle('story-open', open && name === 'story');
  elements['chart-button'].setAttribute('aria-expanded', String(open && name === 'chart'));
  elements['tools-button'].setAttribute('aria-expanded', String(open && name === 'tools'));
  if (open) (elements[`close-${name}`] || document.querySelector(`#close-${name}`)).focus(); else returnFocus?.focus();
}
function fill(text) { elements.message.value = text; elements.message.focus(); elements['input-hint'].textContent = '示例只填入，不执行。改成你的想法，再按回车。'; previewIntent(); }
function renderCreationGuide() {
  guideElement.hidden = !creationGuide.active;
  document.body.classList.toggle('guide-active', creationGuide.active);
  if (!creationGuide.active) return;
  const target = state.entities.find(entity => entity.id === creationGuide.targetId);
  const copy = guideCopy(creationGuide, { name: target ? ASSETS[target.asset] : '伙伴', color: target?.params.color, embodied: Boolean(ocean?.embodiment.active) });
  const parent = ocean?.embodiment.active ? elements['inhabit-controls'] : document.querySelector('.conversation');
  if (guideElement.parentElement !== parent) parent.prepend(guideElement);
  guideElement.dataset.step = creationGuide.step;
  const returning = creationGuide.step === 'save' && !ocean?.embodiment.active && Boolean(ocean?.embodiment.blend || ocean?.travelTarget);
  const labels = { 'guide-progress': `初次造物 · ${copy.progress} / 5${creationGuide.step === 'complete' ? ' · 已完成' : ''}`, 'guide-title': copy.title, 'guide-detail': copy.detail, 'guide-action': returning ? '视角正在归位…' : copy.action };
  for (const [id, text] of Object.entries(labels)) if (elements[id].textContent !== text) elements[id].textContent = text;
  elements['guide-action'].disabled = returning;
}
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
    button.addEventListener('click', () => {
      const entry = ocean?.creationScene.objects.get(item.id);
      if (!entry) return;
      const candidate = { root: entry.root, shape: entry.shape, id: item.id, living: LIVING_ASSETS.includes(item.asset), species: item.asset, name: item.name, point: entry.root.getWorldPosition(ocean.camera.position.clone()).add(ocean.worldOffset) };
      panel('objects', false); enterSceneObject(candidate);
    }); elements['object-list'].append(button);
  }
  elements['undo-button'].disabled = !state.past.length; elements['redo-button'].disabled = !state.future.length;
  elements['pause-button'].innerHTML = icon(state.paused ? 'play' : 'pause'); elements['pause-button'].setAttribute('aria-label', state.paused ? '继续画面' : '暂停画面'); elements['pause-button'].setAttribute('aria-pressed', String(state.paused));
  elements['stop-button'].textContent = state.paused ? '继续造物' : '暂停造物'; renderSuggestions(); renderCreationGuide();
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
        const labels = { travel: '前往所选海域', ritual: world.args.summon ? `唤醒奇观并召唤${world.args.summon}` : '让微光沿海流传播', calm: '让光与和声缓缓平息', trial: '化身生物，开启当地试炼', talk: '打开角色的分支对话', story: '阅读手记或回应当前故事', 'palace-room': '沿真实门洞前往宫城空间', sing: '邀请人鱼演唱有词歌曲', inhabit: '进入生物视角', 'release-view': '平滑返回自由探索', cruise: '沿当前朝向持续前游', 'whale-fall': world.args.enabled ? '观看鲸落时间叙事' : '结束鲸落叙事' };
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
  if (ocean.embodiment.blend || ocean.travelTarget) return toast('镜头仍在移动，请抵达或手动接管后再保存；当前世界没有丢失。');
  try {
    const raw = writeMemory(ocean.creationScene.captureFollowing(state), ocean.captureView(), discovered);
    localStorage.setItem(MEMORY_KEY, raw);
    creationGuide = advanceGuide(creationGuide, { kind: 'saved', entityIds: state.entities.map(entity => entity.id) }); renderCreationGuide();
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
      creationGuide = initialGuide();
      ocean.restoreView(memory.view); ocean.syncCreation(state, true); ocean.creationScene.update(0); ocean.paused = true;
      mediaExperience.setPaused(true); sound.stopVoices(); transcript.length = 0; recentResult = null;
      elements.message.value = ''; previewIntent(); renderState(); renderHistory(); renderAtlas(); panel('objects', false);
      document.body.classList.add('has-interacted');
      elements['response-line'].textContent = '你留下的世界，还在这里。'; elements['action-label'].textContent = '已恢复并暂停 · 点击“继续造物”，从这一刻出发';
    } catch (error) { toast(error.message || '存档恢复失败，当前世界未改变。'); }
  }
});

function renderAtlas() {
  elements['visited-count'].textContent = `${String(discovered.size).padStart(2, '0')} / ${String(ATLAS_SITES.length).padStart(2, '0')} 已抵达`;
  for (const landmark of ATLAS_SITES) {
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
function applyResult(text, result, source, operations = []) {
  creationGuide = advanceGuide(creationGuide, { kind: 'creation', changed: result.changed, before: state, after: result.state, operations });
  state = result.state; ocean.syncCreation(state); ocean.paused = state.paused; renderState(); recentResult = result;
  mediaExperience.setPaused(state.paused);
  if (!['暂停', '继续', '撤销上一步', '重做上一步'].includes(text)) mediaExperience.updateFromCreation(text, result.changed);
  elements['response-line'].textContent = result.changed ? result.descriptions.slice(0, 2).join('，') : '世界保持不变。';
  elements['action-label'].textContent = result.issues.length ? result.issues.join(' ') : state.paused ? '已暂停。继续时从当前时刻恢复。' : '改变已应用 · 可以继续描述，也可以撤销';
  elements['action-label'].classList.toggle('issue', Boolean(result.issues.length));
  elements.response.classList.toggle('has-issue', Boolean(result.issues.length));
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
  if (result.changed) { elements.message.value = ''; if (matchMedia('(pointer: coarse)').matches && document.activeElement === elements.message) elements.message.blur(); } previewIntent();
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
elements['adaptive-toggle'].addEventListener('change', event => ocean?.setAdaptive(event.target.checked));
elements['reduced-toggle'].checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
elements['reduced-toggle'].addEventListener('change', event => { if (ocean) ocean.reduced = event.target.checked; document.body.classList.toggle('reduced-motion', event.target.checked); });
function updateAudioUI() {
  const audio = sound.inspect(); const playing = audio.enabled && audio.context === 'running';
  elements['sound-button'].innerHTML = `${icon(playing ? 'sound' : 'muted')}<span>${audio.orchestra.status === 'error' ? '重试配乐' : playing ? '配乐开' : '配乐'}</span>`;
  elements['sound-button'].setAttribute('aria-pressed', String(playing));
  elements['sound-button'].setAttribute('aria-label', playing ? '静音音乐与音效' : '开启奇观管弦配乐');
  elements['sound-button'].title = audio.orchestra.status === 'error' ? '配乐加载失败，点击重试' : playing ? `正在演奏：${scoreFor(audio.site).title}；点击静音` : '点击或操作世界，开启奇观配乐';
  const title = document.querySelector('#score-title'); const status = document.querySelector('#score-status');
  if (title) title.textContent = scoreFor(audio.site).title;
  if (status) status.textContent = audio.orchestra.status === 'error' ? '音色加载失败 · 点击顶部配乐重试' : audio.userMuted ? '已手动静音 · 不会自行重新开启' : !audio.unlocked ? '首次操作世界后奏响' : audio.orchestra.status === 'loading' ? '正在准备管弦音色…' : audio.context !== 'running' ? '音频已挂起 · 点击继续聆听' : audio.paused ? '画面已暂停 · 轻声伴奏继续' : `${scoreFor(audio.site).character} · 随奇观渐变`;
  const voices = document.querySelector('#creature-voice-status');
  if (voices) voices.textContent = audio.creatureAudio.status === 'error' ? '歌声或鲸鸣素材未就绪，请重试；不会用合成哼声替代。' : audio.creatureAudio.singing ? '人鱼正在歌唱 · 德彪西《Spleen》· 有法语歌词的女高音与钢琴' : audio.creatureAudio.whaleCalling ? '远方传来座头鲸的回声' : audio.creatureAudio.status === 'loading' ? '正在准备歌声与鲸鸣…' : '靠近人鱼听歌，远处鲸鸣间歇回应；也可输入“让人鱼唱歌”。';
  const retry = document.querySelector('#retry-creature-voices');
  if (retry) retry.hidden = audio.creatureAudio.status !== 'error';
}
sound.onChange = updateAudioUI;
elements['sound-button'].addEventListener('click', async () => { try { await sound.toggle(); } catch { toast('浏览器暂未允许声音，请再点一次配乐按钮。'); } });
function unlockScore(event) {
  if (!event.isTrusted || event.target.closest?.('#sound-button') || sound.userMuted || (sound.enabled && sound.context?.state === 'running')) return;
  if (event.type === 'keydown' && (event.repeat || !['Enter', ' ', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key))) return;
  sound.activateFromGesture().catch(() => updateAudioUI());
}
document.addEventListener('pointerup', unlockScore, { capture: true });
document.addEventListener('keydown', unlockScore, { capture: true });
updateAudioUI();
function cancelNavigation() {
  ocean?.cancelTravel();
  if (sound.gateEcho.status !== 'idle') sound.stopChant();
  navigationVersion++; clearTimeout(transitionTimer); elements['water-transition'].classList.remove('switching');
  elements['transition-label'].textContent = '';
}
for (const mode of ['quick', 'sail']) elements[`mode-${mode}`].addEventListener('click', () => {
  travelMode = mode;
  for (const option of ['quick', 'sail']) elements[`mode-${option}`].setAttribute('aria-pressed', String(option === mode));
  elements['travel-mode-note'].textContent = mode === 'quick' ? '默认快速切换，世界和你的造物不会重置。' : '自动绕开建筑、减速避让生物。拖动或方向键可随时接管，暂停可停下。'; previewIntent();
});
async function navigate(region, requestedMode = travelMode) {
  if (!ocean) return;
  const landmark = ATLAS_SITES.find(item => item.id === region);
  if (!landmark) return;
  ocean.play.stop(); ocean.embodiment.exit(false); updateEmbodimentUI();
  cancelUnderstanding(); cancelNavigation();
  const version = navigationVersion;
  state.paused = false; ocean.paused = false; ocean.creationScene.paused = false;
  mediaExperience.setPaused(false);
  panel('journey', false); elements.discovery.hidden = true; elements['place-name'].textContent = landmark.name;
  recentResult = null; renderState(); document.body.classList.add('has-explored');
  if (requestedMode === 'sail') {
    ocean.prepareDestination(landmark);
    ocean.sailTo(landmark.camera, landmark.target);
    elements['response-line'].textContent = `沿着海流，前往${landmark.name}；自动绕开沿途障碍。`; elements['action-label'].textContent = '规划自动航路 · 方向键或拖动可随时接管';
    return;
  }
  const started = performance.now();
  elements['transition-label'].textContent = `正在抵达 · ${landmark.name}`;
  elements['water-transition'].classList.add('switching');
  ocean.cancelTravel(); ocean.cruising = false; ocean.movement.clear();
  await new Promise(resolve => setTimeout(resolve, ocean.reduced ? 0 : 130));
      if (version !== navigationVersion) return;
  try {
    ocean.prepareDestination(landmark); ocean.jumpTo(landmark);
    await ocean.renderer.compileAsync(ocean.scene, ocean.camera);
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
  if (event.key === 'Escape' && !document.querySelector('#media-panel').hidden) { event.preventDefault(); panel('media', false); return; }
  if (event.key === 'Escape' && !elements['story-panel'].hidden) { event.preventDefault(); panel('story', false); return; }
  if (event.key === 'Escape' && ocean?.embodiment.active) { event.preventDefault(); if (document.body.classList.contains('embodied-chat')) toggleEmbodiedChat(false); else dispatchWorld(worldAction('release-view')); return; }
  if (event.key === 'Escape') { voice?.stop(); if (document.body.classList.contains('immersive')) viewportControls.exit(); for (const name of panelIds) if (!elements[`${name}-panel`].hidden) panel(name, false); }
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
  if (movementKey) { event.preventDefault(); cancelNavigation(); ocean.cancelTravel(); ocean.movement.add(movementKey); document.body.classList.add('has-explored'); return; }
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
  natural.push(...(ocean.visibleJellies || []).map(actor => ({ ...actor, name: actor.root.userData.displayName, living: true })));
  natural.push(...ocean.surface.animals.filter(actor => actor.root.visible).map(actor => ({ ...actor, shape: actor.root, species: 'dolphin', name: '追光海豚', living: true })));
  if (ocean.ecology.ancient.root.visible) natural.push({ ...ocean.ecology.ancient, shape: ocean.ecology.ancient.root, species: 'ancient', name: ASSETS.ancient, living: true });
  if (ocean.embodiment.active?.living) natural.push(ocean.embodiment.active);
  const landmarks = [...ocean.landmarks.entries, ...ocean.wonders.entries.values()].filter(entry => entry.root.visible);
  for (const entry of landmarks) entry.root.traverse(root => { if (root.userData.creature && !root.isInstancedMesh) natural.push({ root, shape: root, species: root.userData.creature, name: ASSETS[root.userData.creature], living: true }); });
  return [...authored, ...natural].map(actor => ({ ...actor, distance: actor.root.getWorldPosition(ocean.camera.position.clone()).distanceTo(ocean.camera.position) })).filter(actor => actor.distance < 320).sort((first, second) => first.distance - second.distance);
}
function observeWorld() {
  return { position: ocean?.worldPosition().toArray(), time: ocean?.time || 0, paused: state.paused, palaceRoom: ocean?.palace.activeRoom?.id || null, story: typeof stories === 'undefined' ? undefined : stories.state, actors: [...new Set(nearbyActors().map(actor => actor.species))], selection: Boolean(ocean?.embodiment.candidate), entities: state.entities.map(item => ({ id: item.id, asset: item.asset, params: { ...item.params }, position: [...item.position], renderedPosition: ocean?.creationScene.objects.get(item.id)?.root.getWorldPosition(ocean.camera.position.clone()).add(ocean.worldOffset).toArray() || null, following: item.following, leader: item.leader, orbit: item.orbit })), embodiment: ocean?.embodiment.inspect() || null, play: ocean?.play.inspect() || null, travel: { moving: Boolean(ocean?.travelTarget), cruising: Boolean(ocean?.cruising) } };
}
async function dispatchWorld(plan) { if (!ocean) return { ok: false, message: '世界仍在构筑中。' }; const result = await director.dispatch(plan); if (!result.ok) toast(result.message); return result; }
async function renderWorldAction({ kind, args }) {
  cancelUnderstanding();
  if (kind === 'creation') {
    const previous = args.plan.operations.some(action => action.kind === 'release') ? ocean.creationScene.captureFollowing(state) : state;
    const result = executeCreation(previous, args.plan, args.text);
    applyResult(args.text, result, { direct: '直接操作 → 世界规划器', local: '本地规则 → 世界规划器', model: '大模型理解 → 白名单 → 世界规划器' }[args.provenance], args.plan.operations); return result;
  }
  if (kind === 'travel') return navigate(args.site, args.mode);
  if (kind === 'story') {
    if (args.entry === 'journal') { stories.open(); panel('story', true); return; }
    const result = advanceStory(stories.state, args.entry, args.choice, observeWorld());
    stories.apply(result); ocean.palace.setStoryState(result.state);
    elements['response-line'].textContent = result.reply;
    elements['action-label'].textContent = '原创分支叙事 · 历史出处见文献札记 · 不使用中文语音朗读';
    panel('story', true);
    if (['inscription', 'garden', 'table', 'ending'].includes(result.effect) && sound.enabled && !sound.userMuted) sound.orchestra?.accent('ritual');
    if (result.effect === 'song') {
      const song = await renderWorldAction({ kind: 'sing', args: { species: 'mermaid' } });
      if (song?.ok === false) toast(song.message);
    } else if (result.effect === 'whale') sound.whaleCall({ distance: 65 });
    return;
  }
  if (kind === 'palace-room') {
    cancelNavigation(); wakeWorld();
    if (!ocean.enterPalace(args.room)) return { ok: false, message: '请从宫城正面靠近入口，建筑外墙不能穿过。海图可带你回到宫城正面。' };
    updateEmbodimentUI(); document.body.classList.add('has-explored');
    elements['response-line'].textContent = args.room === 'exit' ? '沿着来时的长廊，回到宫城前庭。' : `穿过真实门洞，前往${PALACE_ROOMS.find(room => room.id === args.room).name}。`;
    return;
  }
  if (kind === 'whale-fall') {
    if (!args.enabled) { ocean.whaleFall.stop(); return; }
    if (ocean.currentLandmark?.id !== 'garden') return { ok: false, message: '先前往鲸落花园，在它的海床旁观看这段时间叙事。' };
    panel('tools', false); wakeWorld(); ocean.whaleFall.start(); updateEmbodimentUI(); elements.discovery.hidden = true; elements['response-line'].textContent = '海流放慢，观察巨鲸留下的生命馈赠。'; document.body.classList.add('has-explored'); return;
  }
  if (kind === 'cruise') { ocean.cruising = args.enabled; ocean.cancelTravel(); if (args.enabled) wakeWorld(); renderState(); document.body.classList.add('has-explored'); return; }
  if (kind === 'calm') { ocean.play.calm(); toast('光与和声正在缓缓回落。'); return; }
  if (kind === 'release-view') { endEmbodiment(); return; }
  if (kind === 'trial') { panel('tools', false); wakeWorld(); ocean.play.start(args.site, args.species); updateEmbodimentUI(); document.body.classList.add('has-explored'); ocean.renderer.domElement.focus({ preventScroll: true }); return; }
  if (kind === 'switch-view') { ocean.embodiment.setView(); updateEmbodimentUI(); return; }
  if (kind === 'inhabit') { const actor = args.target === 'selection' ? ocean.embodiment.candidate : nearbyActors().find(actor => actor.species === args.species); if (!actor) return { ok: false, message: '它已游远，请重新点击。' }; wakeWorld(); ocean.embodiment.enter(actor); updateEmbodimentUI(); document.body.classList.add('has-explored'); ocean.renderer.domElement.focus({ preventScroll: true }); if (actor.species === 'whale') sound.whaleCall?.({ distance: 12 }); return; }
  if (kind === 'talk') {
    const entry = STORY_ENTRIES.find(entry => entry.species === args.species);
    if (entry) { stories.open(entry.id); panel('story', true); return; }
    const actor = nearbyActors().find(actor => actor.species === args.species);
    const replies = { whale: '我记得这座城尚在海面之上的歌。你若愿意，我与你同行。', shark: '沿着海流前行。与我保持距离，也保持好奇。', turtle: '不必赶路。珊瑚的光，会告诉我们方向。', manta: '把视角交给我，一起穿过那些沉睡的光环。', mermaid: '天门听见名字，海流记住来者。试着呼唤你的伙伴。' };
    const response = replies[args.species] || '海流替它回应了你。';
    ocean.pulse(actor.root.getWorldPosition(ocean.camera.position.clone()), 3); sound.voice(args.species, args.species === 'whale'); sound.chant(response);
    elements['response-line'].textContent = response; elements['action-label'].textContent = '预设角色回应 · 非开放式 AI 对话 · 点选生物可进入它的视角';
    if (actor.id) select(actor.id); return;
  }
  if (kind === 'sing') {
    const actor = nearbyActors().find(actor => actor.species === 'mermaid');
    if (!actor) return { ok: false, message: '人鱼已游远，请靠近后再邀请她歌唱。' };
    wakeWorld(); await sound.activateFromGesture(); await sound.creatureAudio.prepare();
    sound.creatureAudio.stopWhale();
    if (!sound.creatureAudio.sing(actor, { force: true })) return { ok: false, message: sound.userMuted ? '当前已静音，请先开启顶部配乐。' : '歌声录音尚未就绪，请在体验设置重试。' };
    elements['response-line'].textContent = '她唱起德彪西《Spleen》的一段法语歌，声线随水流漂向远方。';
    elements['action-label'].textContent = '真实女高音与钢琴录音 · 非无词吟唱 · Xiaobo Su / Giorgi Latsabidze';
    recentResult = null; return;
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
    panel('tools', false); wakeWorld(); ocean.play.awaken(args.site);
    const response = args.summon ? `潮汐记得你的呼唤。${args.summon}，从旧日之海归来。` : args.echo ? `深海记住了你的呼唤。${args.echo}，愿回声将你唤回。` : `${site.name}，听见了你的声音。`;
    elements['response-line'].textContent = response; elements['action-label'].textContent = args.site === 'vortex' ? '万鱼收束 → 星环奔涌 → 群星交辉 · 18 秒连续演变' : '光沿着海流与枝脉展开';
    if (args.site === 'gate') {
      elements['action-label'].textContent = sound.userMuted ? '当前静音 · 开启配乐后再次呼唤' : '';
      await sound.activateFromGesture({ waitForMusic: false }); sound.creatureAudio.stop();
      const pending = sound.gateEcho.speak(args.summon || args.echo || 'gate'); const voiceRevision = sound.gateEcho.revision;
      const invocation = sound.gateEcho.invocation;
      if (invocation) elements['response-line'].textContent = `${invocation.ancient}  ·  ${invocation.meaning}`;
      const spoken = await pending;
      if (voiceRevision !== sound.gateEcho.revision) return;
      elements['action-label'].textContent = spoken ? '' : sound.userMuted ? '当前静音 · 开启配乐后再次呼唤' : '回声暂时未能响起，请稍后重试。';
    }
    recentResult = null; document.body.classList.add('has-interacted');
  }
}
function wakeWorld() { state.paused = false; ocean.paused = false; ocean.creationScene.paused = false; mediaExperience.setPaused(false); renderState(); }
function enterSceneObject(candidate) {
  if (!ocean || !candidate) return;
  cancelNavigation();
  ocean.whaleFall.stop();
  if (candidate.id) select(candidate.id);
  ocean.embodiment.candidate = candidate;
  void dispatchWorld(worldAction('inhabit', { target: 'selection' }));
  const story = storyForObject(candidate, ocean.palace.activeRoom?.id);
  if (story) {
    stories.open(story.id);
    if (!candidate.living) panel('story', true);
    else toast('已进入它的视角；点“交谈 / 阅读”可以继续听它的故事。');
  }
  if (!candidate.living && ocean.currentLandmark) ocean.play.awaken(ocean.currentLandmark.id, { quiet: true });
}
function updateEmbodimentUI() {
  const active = ocean?.embodiment.active;
  if (active) creationGuide = advanceGuide(creationGuide, { kind: 'inhabit', id: active.id });
  renderCreationGuide();
  const entry = storyForObject(active, ocean?.palace.activeRoom?.id);
  if (elements['inhabit-story']) { elements['inhabit-story'].hidden = !entry; elements['inhabit-story'].dataset.entry = entry?.id || ''; }
  document.body.classList.toggle('is-embodied', Boolean(active)); elements['inhabit-controls'].hidden = !active; elements['swim-pad'].hidden = !active?.living;
  if (!active) { toggleEmbodiedChat(false); return; }
  elements['inhabit-mode'].textContent = active.living ? 'INHABIT THIS WORLD' : 'A DIFFERENT POINT OF VIEW';
  elements['inhabit-title'].textContent = active.name;
  elements['inhabit-help'].textContent = active.species === 'dolphin' ? 'W 加速 · S 减速 · A/D 转向 · Q 上浮，接近水面时加速跃出 · E 下潜 · 空中保持惯性，自动入水' : active.living ? 'W/S 前后游 · A/D 转向 · Q/E 升降 · Shift 加速 · 拖动环顾' : '自动 360° 环绕 · 拖动接管 · 滚轮靠近';
  elements['inhabit-view'].textContent = active.living ? ocean.embodiment.firstPerson ? '切换第三人称' : '切换第一人称' : ocean.controls.autoRotate ? '暂停环绕' : '继续环绕';
}
function endEmbodiment() { if (ocean?.embodiment.active) wakeWorld(); if (ocean?.play.trial) ocean.play.stop(); else ocean?.embodiment.exit(); updateEmbodimentUI(); elements['home-button'].focus(); }
elements['inhabit-exit'].addEventListener('click', () => dispatchWorld(worldAction('release-view')));
elements['inhabit-view'].addEventListener('click', () => dispatchWorld(worldAction('switch-view')));
const inhabitStory = document.createElement('button'); inhabitStory.id = 'inhabit-story'; inhabitStory.textContent = '交谈 / 阅读'; inhabitStory.hidden = true; elements['inhabit-story'] = inhabitStory; document.querySelector('.inhabit-actions').append(inhabitStory);
inhabitStory.addEventListener('click', () => { if (inhabitStory.dataset.entry) void dispatchWorld(worldAction('story', { entry: inhabitStory.dataset.entry })); });
elements['inhabit-trial'].addEventListener('click', () => elements['trial-start'].click());
function toggleEmbodiedChat(open) { document.body.classList.toggle('embodied-chat', open); elements['inhabit-speak'].setAttribute('aria-expanded', String(open)); elements['inhabit-speak'].textContent = open ? '收起对话' : '对世界说话'; if (open) { ocean.movement.clear(); elements.message.focus(); } }
elements['inhabit-speak'].addEventListener('click', () => toggleEmbodiedChat(!document.body.classList.contains('embodied-chat')));
for (const button of document.querySelectorAll('[data-swim]')) {
  button.addEventListener('pointerdown', event => { event.preventDefault(); if (!ocean) return; cancelNavigation(); ocean.cancelTravel(); button.setPointerCapture(event.pointerId); ocean.movement.add(button.dataset.swim); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => ocean?.movement.delete(button.dataset.swim));
}
elements['trial-start'].addEventListener('click', () => dispatchWorld(worldAction('trial', { site: ocean?.currentLandmark?.id, species: ['manta', 'shark', 'turtle', 'whale'].includes(ocean?.embodiment.active?.species) ? ocean.embodiment.active.species : 'manta' })));
elements['trial-exit'].addEventListener('click', () => dispatchWorld(worldAction('release-view')));
elements['festival-start'].addEventListener('click', () => dispatchWorld(worldAction('ritual', { site: ocean?.currentLandmark?.id })));
elements['festival-stop'].addEventListener('click', () => dispatchWorld(worldAction('calm')));
elements['whale-fall-start'].addEventListener('click', () => dispatchWorld(worldAction('whale-fall', { enabled: true })));
elements['whale-fall-stop'].addEventListener('click', () => dispatchWorld(worldAction('whale-fall', { enabled: false })));
elements['ritual-example'].addEventListener('click', () => fill(ocean?.currentLandmark?.id === 'gate' ? '唤醒回声天门，召唤鲸鱼' : `唤醒${ocean?.currentLandmark?.name || '潮生圣城'}`));
const audioSettings = document.createElement('section'); audioSettings.className = 'about-section';
const timeSettings = document.createElement('section'); timeSettings.className = 'about-section';
timeSettings.innerHTML = '<h3>海天时序</h3><label class="setting-row">光影时刻<select id="time-mode"><option value="realtime">跟随本机时间</option><option value="day">白昼</option><option value="dusk">黄昏</option><option value="night">夜海</option></select></label><p>海面与海底共用一条时序，切换时渐变过渡。跟随设备时区，以艺术化昼夜表现，不是当地天文日出日落计算。</p><h3>天门的声音</h3><p>使用古希腊语文本与合成男声，属于近似发音的艺术设计，不是历史录音。中文只用作字幕；门上的刻纹按实际语音音量起伏。</p>';
elements['settings-panel'].append(timeSettings);
timeSettings.querySelector('#time-mode').addEventListener('change', event => ocean?.setTimeMode(event.target.value));
audioSettings.innerHTML = `<div class="score-now"><span class="eyebrow">THE WORLD HAS A SCORE</span><h3 id="score-title">沉没的王冠</h3><p id="score-status" role="status">首次操作世界后奏响</p></div><p>七处遗迹与奇观、潮冠宫城和金色海面，九段独立的管弦主题。真实录制的弦乐、圆号、竖琴、长笛、定音鼓与钟琴音色，在本机按原创乐谱演奏。抵达时换章，环境回应时弦乐与圆号逐层铺开；不是单一海流循环。</p>${[['music', '奇观配乐'], ['effects', '互动音效'], ['ambience', '海流底声']].map(([channel, label]) => `<label class="setting-row audio-level">${label}<input data-audio-level="${channel}" type="range" min="0" max="100" value="${sound.levels[channel] * 100}" aria-label="${label}音量"/><output>${Math.round(sound.levels[channel] * 100)}%</output></label>`).join('')}<p>首次点击或按键后启声。顶部可一键静音，记住你的选择；暂停画面时轻声伴奏继续，离开标签页时停止声音。音色随项目加载，不上传文字。</p><label class="setting-row">本机文字吟诵<input id="narration-toggle" type="checkbox"/></label><p>仅使用本机中文语音，无本机声音时保留字幕与艺术化吟声；不是历史古语或动物语言复原。</p>`;
elements['settings-panel'].append(audioSettings);
audioSettings.insertAdjacentHTML('beforeend', '<div class="score-now"><h3>人鱼的歌与远处鲸鸣</h3><p id="creature-voice-status" role="status"></p><button id="retry-creature-voices" hidden>重试歌声与鲸鸣</button><p>人鱼演唱德彪西《Spleen》的法语歌词片段，女高音 Xiaobo Su、钢琴 Giorgi Latsabidze；不是中文原创歌或语音朗读。鲸声来自 NOAA PMEL 公开录音，已处理源文件加速并作空间混音。两者均随“互动音效”音量调整。</p></div>');
document.querySelector('#retry-creature-voices').addEventListener('click', async () => { await sound.activateFromGesture(); await sound.creatureAudio.prepare(); });
audioSettings.querySelector('#narration-toggle').addEventListener('change', event => { sound.narration = event.target.checked; if (!sound.narration) sound.stopChant(); else if (!globalThis.speechSynthesis?.getVoices().some(voice => voice.localService && /^zh/i.test(voice.lang))) toast('当前没有可用的本机中文声音，保留字幕与合成吟声，不会改用云端服务。'); });
audioSettings.querySelectorAll('[data-audio-level]').forEach(input => input.addEventListener('input', () => { sound.setLevel(input.dataset.audioLevel, Number(input.value) / 100); input.nextElementSibling.value = `${input.value}%`; }));
elements['settings-panel'].insertBefore(audioSettings, elements['settings-panel'].firstElementChild.nextSibling); updateAudioUI();
const palacePanel = document.createElement('section'); palacePanel.className = 'palace-panel'; palacePanel.hidden = true; palacePanel.setAttribute('aria-label', '宫城房间导览');
palacePanel.innerHTML = palaceNavigationMarkup();
document.body.append(palacePanel);
palacePanel.querySelectorAll('[data-room]').forEach(button => button.addEventListener('click', () => { void dispatchWorld(worldAction('palace-room', { room: button.dataset.room })); if (innerWidth < 700) palacePanel.querySelector('details').open = false; }));
palacePanel.querySelector('[data-palace-journal]').addEventListener('click', () => dispatchWorld(worldAction('story', { entry: 'journal' })));
function updatePlayUI() {
  const landmark = ocean.currentLandmark; const site = ocean.surface.blend < 0.5 && SITE_PLAY[landmark?.id] ? landmark : null; const play = ocean.play.inspect();
  palacePanel.hidden = landmark?.id !== 'crown' || Boolean(ocean.embodiment.active);
  document.body.classList.toggle('in-palace', Boolean(ocean.palace.activeRoom) && !ocean.embodiment.active);
  for (const button of palacePanel.querySelectorAll('[data-room]')) button.setAttribute('aria-current', String(button.dataset.room === ocean.palace.activeRoom?.id));
  document.body.classList.toggle('trial-complete', Boolean(play.trial?.finished));
  elements['site-play'].hidden = !site;
  elements['whale-fall-start'].hidden = site?.id !== 'garden';
  const falling = ocean.whaleFall.inspect();
  elements['whale-fall-note'].hidden = !falling;
  if (falling) elements['whale-fall-stage'].textContent = falling.label;
  elements['inhabit-trial'].hidden = !site || !['manta', 'shark', 'turtle', 'whale'].includes(ocean.embodiment.active?.species) || Boolean(play.trial);
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
  elements['festival-caption'].hidden = true;
  if (site) elements['festival-start'].textContent = SITE_PLAY[site.id].invitation;
  if (!elements['settings-panel'].hidden) { const ecology = ocean.ecology.foodWeb.inspect(ocean.ecology.schools.members); elements['ecology-status'].textContent = `${ecology.lastEvent} 当前近域游鱼 ${ecology.living} 尾 · 本次捕获 ${ecology.captured} 尾 · 迁入 ${ecology.immigrants} 尾。`; }
  if (!ocean.embodiment.active && document.body.classList.contains('is-embodied')) updateEmbodimentUI();
}
async function boot() {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    const loadingStage = (name, detail) => {
      startupStages.push({ name, atMs: Math.round(performance.now()) });
      elements.loading.querySelector('span').textContent = name;
      elements.loading.querySelector('small').textContent = detail;
    };
    elements.loading.setAttribute('role', 'status');
    loadingStage('让世界有形。', '01 / 04 · 载入三维引擎与生物形态');
    const [{ Ocean }, { prepareSurfaces }, { prepareCreatureSurfaces }] = await Promise.all([import('./ocean.js'), import('./surfaces.js'), import('./creature-surface.js')]);
    loadingStage('为石与生命赋予质感。', '02 / 04 · 准备石材与生物纹理');
    await Promise.all([prepareSurfaces(), prepareCreatureSurfaces()]);
    loadingStage('潮汐之间，圣城浮现。', '03 / 04 · 构筑宫城、珊瑚与生态');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    ocean = new Ocean(elements.ocean, {
      sound,
      onCeremony: () => { elements.discovery.hidden = true; },
      onObjectInspect: enterSceneObject,
      onPalaceDoor: room => dispatchWorld(worldAction('palace-room', { room })),
      onCreationSelect: id => select(id), onAnchor: point => { state.anchor = point; select(null); elements['input-hint'].textContent = '已指认一处海床。试着说“在这里创造珊瑚”。'; toast('已指认海床位置 · “这里”将指向此处'); },
      onExplore: () => { cancelNavigation(); document.body.classList.add('has-explored'); }, onFlightInterrupted: () => { journeyState = interruptJourney(journeyState); },
      onRegionChange: () => { elements['water-transition'].classList.remove('crossing'); void elements['water-transition'].offsetWidth; elements['water-transition'].classList.add('crossing'); renderState(); },
      onArrive: destination => { const arrival = arriveAt(journeyState, destination); journeyState = arrival.state; elements['place-name'].textContent = PLACES[destination].name; },
      onTravelArrive: () => { const landmark = ocean.currentLandmark; elements['response-line'].textContent = landmark?.caption || '海流在这里慢了下来。'; elements['action-label'].textContent = landmark?.gesture || '继续前游，或者在这里创造'; renderSuggestions(); },
      onFrame: () => {
        if (!ocean) return;
        if (creationGuide.active && creationGuide.step === 'save') renderCreationGuide();
        cruise.textContent = ocean.cruising ? 'Ⅱ 停止前游' : '▷ 持续前游'; cruise.setAttribute('aria-pressed', String(ocean.cruising));
        elements['place-name'].textContent = ocean.surface.blend > 0.5 ? '逐日海豚 · 海天之间' : ocean.palace.activeRoom?.name || ocean.currentLandmark?.name || ocean.currentBiome?.name || '潮生圣城';
        const position = ocean.worldPosition();
        const nearest = nearestLandmark(position.toArray());
        const heading = ocean.camera.getWorldDirection(ocean.camera.position.clone());
        const bearing = Math.round((Math.atan2(heading.x, -heading.z) * 180 / Math.PI + 360) % 360);
        seaChart.update({ position: position.toArray(), bearing, visited: [...discovered] });
        updatePlayUI();
        const audible = nearbyActors().map(actor => {
          const direction = actor.root.getWorldPosition(ocean.camera.position.clone()).sub(ocean.camera.position).normalize();
          return { ...actor, pan: direction.x * -heading.z + direction.z * heading.x };
        });
        sound.creatureAudio.update(audible, { falling: Boolean(ocean.whaleFall.active) });
        const site = ocean.surface.blend > 0.5 ? 'sunset' : ocean.currentLandmark?.id || ocean.currentBiome?.id;
        if (site !== soundtrackSite) { soundtrackSite = site; sound.setScene(site); }
        elements['place-caption'].textContent = `${String(bearing).padStart(3, '0')}° / ${Math.round(position.x)} E · ${Math.round(-position.z)} N`;
        if (ocean.travelTarget) {
          const navigation = ocean.navigator.inspect(position);
          const label = { planning: '正在规划安全航路', avoiding: '正在减速绕行', waiting: '等待生物通过' }[navigation.status] || (navigation.detour ? '沿安全航路绕行' : '沿海流自动航行');
          elements['action-label'].textContent = `${state.paused ? '航行已暂停' : label} · 余程 ${navigation.remaining} m · 拖动可接管`;
        }
        discover(ocean.surface.blend > 0.5 ? ATLAS_SITES.find(site => site.id === 'sunset-surface') : ocean.currentLandmark);
        if (document.activeElement !== timeSettings.querySelector('#time-mode')) timeSettings.querySelector('#time-mode').value = ocean.dayClock.mode;
        if (!elements['journey-panel'].hidden) for (const landmark of ATLAS_SITES) document.querySelector(`[data-distance="${landmark.id}"]`).textContent = `${Math.round(Math.hypot(position.x - landmark.center[0], position.z - landmark.center[2]))} m${nearest.id === landmark.id ? ' · 最近的遗迹' : ''}`;
        if (modelRequest || ocean.travelTarget || !recentResult?.changed || recentResult.issues.length || state.paused) return;
        const growing = ocean.creationScene.inspect().filter(item => item.growing); elements['action-label'].textContent = growing.length ? `${growing.length} 个造物正在成形 · 可以随时暂停` : '改变已应用 · 接着描述，世界会记住上一次改变';
      },
      onPerformance: fps => {
        const budget = ocean.frameBudget.inspect();
        elements['performance-note'].textContent = `当前约 ${fps} 帧 / 秒 · ${budget.enabled ? `自适应渲染 ${Math.round(budget.scale * 100)}%` : '固定渲染分辨率'}${budget.metrics ? ` · P95 帧耗时 ${budget.metrics.p95Ms} ms` : ''}。界面清晰度、碰撞与生物数量不变；此值仅为当前设备抽测。`;
      }, onError: toast,
    });
    ocean.syncCreation(state, true); ocean.creationScene.update(0.01);
    loadingStage('等待第一束光。', '04 / 04 · 呈现当前视野的首帧');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    ocean.frameBudget.reset(performance.now());
    document.body.classList.add('is-ready'); setTimeout(() => { elements.loading.hidden = true; }, 700);
    readyMilliseconds = Math.round(performance.now() - loadingStarted);
    window.__WORLDSTAGE__ = { ready: true, inspect: () => ({ ...ocean.inspect(), position: ocean.worldPosition().toArray(), offset: ocean.worldOffset.toArray(), streaming: ocean.endless.inspect(), biome: ocean.currentBiome, landmark: ocean.currentLandmark?.id || null, visited: [...discovered], traveling: Boolean(ocean.travelTarget), switching: elements['water-transition'].classList.contains('switching'), travelMode, readyMilliseconds, latestTransition, media: mediaExperience.inspect(), chart: seaChart.inspect(), embodiment: ocean.embodiment.inspect(), play: ocean.play.inspect(), audio: sound.inspect(), state: structuredClone(state), engine, transcript: structuredClone(transcript) }) }; if (import.meta.env.DEV) window.__ART__ = ocean;
    window.__WORLDSTAGE__.planning = () => director.inspect();
    window.__WORLDSTAGE__.navigation = () => ocean.navigator.inspect(ocean.worldPosition());
    window.__WORLDSTAGE__.stories = () => stories.inspect();
    window.__WORLDSTAGE__.guide = () => structuredClone(creationGuide);
    window.__WORLDSTAGE__.performance = () => ({ ...ocean.frameBudget.inspect(), startup: structuredClone(startupStages), readyMilliseconds });
    const requestedScene = new URLSearchParams(location.search).get('scene');
    if ([...LANDMARKS, ...ECOLOGY_VIEWS].some(place => place.id === requestedScene) && requestedScene !== 'palace') await requestTravel(requestedScene);
    if (savedMemory) toast('发现上次的世界 · 打开“此刻的造物”，可以继续探索');
  } catch (error) {
    console.error(error); elements.loading.replaceChildren(); const title = document.createElement('strong'); title.textContent = '暂时无法构筑这片海'; const detail = document.createElement('p'); detail.textContent = '图形初始化或资源加载未完成，请确认浏览器支持 WebGL 2 与硬件加速。'; const retry = document.createElement('button'); retry.className = 'primary-button'; retry.textContent = '重新载入'; retry.onclick = () => location.reload(); elements.loading.append(title, detail, retry);
  }
}
boot();
