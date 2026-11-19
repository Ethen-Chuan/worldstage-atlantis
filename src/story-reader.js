import { STORY_ENTRIES, STORY_SOURCES, TIDE_READINGS, initialStoryState, restoreStoryState, storyAvailable, storyObjective, advanceStory } from './tide-stories.js';

const MEMORY_KEY = 'worldstage-tide-stories-v1';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export class StoryReader {
  constructor({ container, context, dispatch, navigate, notify, synchronize }) {
    this.container = container; this.context = context; this.dispatch = dispatch; this.navigate = navigate; this.notify = notify; this.synchronize = synchronize;
    this.state = initialStoryState(); this.entry = null; this.reply = ''; this.render();
  }
  button(label, action, className = 'story-choice') {
    const button = element('button', label, className); button.type = 'button'; button.addEventListener('click', action); return button;
  }
  open(entry = null) {
    this.entry = entry;
    if (entry) {
      const result = advanceStory(this.state, entry, null, this.context()); this.state = result.state; this.reply = result.reply;
    }
    this.render();
  }
  apply(result) { this.state = result.state; this.entry = result.entry.id; this.reply = result.reply; this.render(); }
  reading(reading) {
    const details = element('details', '', 'story-reading');
    details.append(element('summary', reading.title));
    details.append(element('small', reading.category, 'story-category'));
    for (const paragraph of reading.paragraphs) details.append(element('p', paragraph));
    const source = STORY_SOURCES[reading.source];
    const link = element('a', `${source.title} · 阅读原文译本 ↗`); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    details.append(link, element('small', source.detail, 'story-source'));
    return details;
  }
  render() {
    const focusedChoice = this.container.contains(document.activeElement) ? document.activeElement.dataset.storyChoice : null;
    const fragment = document.createDocumentFragment();
    const objective = storyObjective(this.state);
    const progress = element('div', '', 'story-progress'); progress.setAttribute('aria-label', `未赴之约 ${this.state.flags.length} / 4`);
    for (const [index, label] of ['读铭文', '护花园', '留一席', '赴邀约'].entries()) {
      const step = element('span', `${index + 1} ${label}`); step.classList.toggle('complete', index < this.state.flags.length); progress.append(step);
    }
    fragment.append(element('small', '可探索支线 / 未赴之约', 'story-category'), progress, element('p', objective.label, 'story-objective'));
    const entry = STORY_ENTRIES.find(candidate => candidate.id === this.entry);
    if (entry) {
      fragment.append(this.button('← 返回手记与文献', () => this.open(), 'text-button story-back'));
      fragment.append(element('small', entry.type, 'story-category'), element('h3', entry.title), element('p', entry.speaker, 'story-speaker'));
      const reply = element('p', this.reply, 'story-dialogue'); reply.setAttribute('aria-live', 'polite'); fragment.append(reply);
      const available = storyAvailable(entry, this.context());
      if (!available) {
        fragment.append(element('p', entry.room ? `阅读不受地点限制；要改变场景，请先前往${entry.cue}。` : '请靠近对应生物或进入它的视角后，再继续对话。', 'story-location'));
        if (entry.room) fragment.append(this.button('沿长廊前往这处空间', () => this.navigate(entry.room)));
      }
      const choices = element('div', '', 'story-choices');
      for (const choice of entry.choices) {
        const locked = choice.requires?.some(flag => !this.state.flags.includes(flag));
        const button = this.button(choice.label, () => this.dispatch(entry.id, choice.id));
        button.dataset.storyChoice = choice.id; button.disabled = !available || locked;
        if (locked) button.append(element('small', '需先完成前一段邀约'));
        if (this.state.choices.includes(`${entry.id}:${choice.id}`)) button.append(element('small', '已回应 · 可以重读'));
        choices.append(button);
      }
      fragment.append(choices, element('h4', '文献札记 · 与角色台词分开阅读'));
      for (const id of entry.lore) fragment.append(this.reading(TIDE_READINGS.find(reading => reading.id === id)));
    } else {
      fragment.append(this.button(this.state.flags.includes('ending') ? '回到铭文，重读结尾' : '继续这段邀约', () => this.dispatch(objective.entry)));
      fragment.append(element('p', '点击器物会保留环绕视角；点击生物仍立即化身，再选择“交谈 / 阅读”。没有强制答题，也不要求拿走任何生命。', 'story-location'));
      fragment.append(element('h3', `遇见与回声 · ${this.state.discovered.length} / ${STORY_ENTRIES.length}`));
      for (const item of STORY_ENTRIES) {
        const discovered = this.state.discovered.includes(item.id);
        const button = this.button(item.title, () => this.dispatch(item.id), 'story-entry');
        button.dataset.storyEntry = item.id;
        button.append(element('small', `${discovered ? '已遇见' : item.room ? '宫城器物' : '海中生物'} · ${item.speaker}`)); fragment.append(button);
      }
      fragment.append(element('h3', '文献阅览 · 六则札记'));
      for (const reading of TIDE_READINGS) fragment.append(this.reading(reading));
    }
    const footer = element('section', '', 'story-memory');
    footer.append(element('p', '预设分支叙事，非开放式 AI 对话。宫廷人物为器物留声，人鱼为神话角色；不合成中文朗读、不上传输入。手记需手动保存，刷新不会自动恢复。'));
    const actions = element('div', '', 'story-memory-actions');
    actions.append(this.button('保存手记到本机', () => this.save(), 'text-button'), this.button('读取上次手记', () => this.load(), 'text-button'));
    const erase = this.button('删除本机手记', () => {
      if (erase.dataset.confirm !== 'true') { erase.dataset.confirm = 'true'; erase.textContent = '再次点击确认删除'; return; }
      try { localStorage.removeItem(MEMORY_KEY); this.notify('已删除本机手记，本次探索进度不变。'); erase.textContent = '删除本机手记'; delete erase.dataset.confirm; }
      catch { this.notify('浏览器未允许删除，请在浏览器设置中清理本站数据。'); }
    }, 'text-button');
    actions.append(erase);
    footer.append(actions); fragment.append(footer); this.container.replaceChildren(fragment);
    if (focusedChoice) this.container.querySelector(`[data-story-choice="${focusedChoice}"]`)?.focus({ preventScroll: true });
  }
  save() {
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(restoreStoryState(this.state))); this.notify('手记已手动保存到此浏览器，仅保存故事编号与选择进度。'); }
    catch { this.notify('浏览器未允许保存手记；本次进度仍在，刷新后会丢失。'); }
  }
  load() {
    try {
      const raw = localStorage.getItem(MEMORY_KEY);
      if (!raw) return this.notify('还没有保存过手记。');
      if (raw.length > 16000) throw new Error('手记过大。');
      this.state = restoreStoryState(JSON.parse(raw)); this.synchronize(this.state); this.open(); this.notify('已读取手记；花园、餐席和铭文会恢复对应状态。');
    } catch { this.notify('手记无法读取，未覆盖本次进度。'); }
  }
  inspect() { return { ...structuredClone(this.state), objective: storyObjective(this.state), entry: this.entry }; }
}
