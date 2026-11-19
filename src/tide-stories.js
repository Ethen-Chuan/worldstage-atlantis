export const STORY_SOURCES = Object.freeze({
  critias: { title: '柏拉图《克里提亚篇》', detail: 'Internet Classics Archive · Benjamin Jowett 英译 · 113c–121c', url: 'https://classics.mit.edu/Plato/critias.html' },
  symposium: { title: '柏拉图《会饮篇》', detail: 'Internet Classics Archive · Benjamin Jowett 英译 · 176a–178a', url: 'https://classics.mit.edu/Plato/symposium.html' },
  odyssey: { title: '荷马《奥德赛》第七卷', detail: 'Internet Classics Archive · Samuel Butler 英译 · 阿尔喀诺俄斯的宫殿、果园与迎客', url: 'https://classics.mit.edu/Homer/odyssey.7.vii.html' },
});

export const TIDE_READINGS = Object.freeze([
  { id: 'rings', title: '一座城，为何层层环绕？', category: '古代文献中的叙事', source: 'critias', paragraphs: ['《克里提亚篇》把中心山丘写成波塞冬与克利托居住之地，周围由交替的水环与陆环围合。后来的统治者又开凿通道、架设桥梁，使内城与海相连。', '环带既在组织交通，也在区分中心与外围。阅读这段文字，可以关注谁能进入中心、资源怎样流动，而不仅是想象一座金色王宫。', '本作的弧形柱廊借用了“层层接近中心”的空间意象；不是依据遗址测绘，也没有把神话中的城市位置当作已确认事实。'] },
  { id: 'metal', title: '比黄金更重要的，是什么？', category: '古代文献中的叙事', source: 'critias', paragraphs: ['柏拉图用石材、金属、港口和物产描绘城邦的富足。他提及白、黑、红三色石材，以及被称作 orichalcum 的材料。这里不把它武断解释为某一种已经确定的现代合金。', '篇章后段的重心却从财富转向节制：当人物不再正确对待富足，城邦的秩序开始改变。外观越奢华，并不等于文明越完整。', '因此，本作的留席故事不以搜刮宝物为终点，而让你决定怎样对待后来者。这是当代创作对文献主题的回应，不是原文剧情。'] },
  { id: 'garden', title: '宫殿旁，被围墙守护的果园', category: '史诗文学的文化背景', source: 'odyssey', paragraphs: ['《奥德赛》第七卷描写阿尔喀诺俄斯宫殿旁的果园：梨、石榴、苹果、无花果和橄榄与葡萄园、泉水一起构成富足的景象。成熟与生长在诗中仿佛不会中断。', '花园不只是装饰。它把居所、供给、季节和待客联系在一起。诗中的长年丰收带有理想化与神异色彩，不是普通古代园艺的实测记录。', '那是另一部作品里的陆地宫廷，不是亚特兰蒂斯遗址。本作把“照料与供给”的意象改写成海草、珊瑚与贝砂花池；留声贝和发光反馈均属神话设计。'] },
  { id: 'table', title: '饭后，话语才开始', category: '古代对话作品的文化背景', source: 'symposium', paragraphs: ['《会饮篇》以阿伽通家中的宴集为场景。众人在进餐后商议如何饮酒、如何度过夜晚，随后轮流谈论爱。器皿与座席在这里围成了一个共同说话的空间。', '这部哲学对话不能代表所有古希腊人的日常生活。它呈现的是特定人物与社会场景；不要据此想象古代人人都能平等参与宴席。', '珊瑚餐厅采用独立圆桌，金枝宴会厅保留长桌：这是当代交互设计的空间分工，不冒充古希腊会饮室的家具复原。为陌生人留席是本作新增的故事选择。'] },
  { id: 'guest', title: '先接住一个疲惫的来者', category: '史诗文学的文化背景', source: 'odyssey', paragraphs: ['奥德修斯来到陌生的宫廷时，接待、座席、食物与返乡的承诺共同组成一段迎客叙事。读者看到的不是抽象的“好客”标签，而是一连串具体行动。', '它也有身份、权力和礼仪的边界，不能直接等同于今天的普遍权利。阅读古代故事，既可以感受善意，也需要保留距离。', '“未赴之约”的空席、守园人的委托和终章都由本作虚构。你完成的是一段可重玩的神话支线，而不是重演某次有考古证据的历史宴会。'] },
  { id: 'unfinished', title: '在宙斯开口之前，文本停下', category: '古代文献与创作边界', source: 'critias', paragraphs: ['现存《克里提亚篇》在宙斯召集众神、即将发言的地方中断。阅读者不会在这一篇里得到一段完整展开的惩罚结局。', '缺失容易诱发想象，但想象不能自动补成史实。本作让器物保存“未完成的句子”，正是把这一空白变为探索的起点。', '角色姓名、宫廷房间、海底居民的对话以及最终亮起的留名贝，都属于原创设定。历史阅读与角色台词分栏呈现，不用拟古口吻掩盖证据边界。'] },
]);

export const STORY_ENTRIES = Object.freeze([
  { id: 'inscription', title: '未赴之约', speaker: '刻在石上的邀约', type: '原创支线 · 铭文', room: 'reception', object: '潮汐邀约铭文', cue: '接待厅入口右侧的矮石碑', lore: ['rings', 'unfinished'], intro: '“若还有来者，请替他留一处阴凉，一席灯火。”石面最后一行停在名字之前。你听见两枚贝扣在水中轻轻相碰。', choices: [
    { id: 'accept', label: '我愿替这座城完成邀约', reply: '石缝里的金线亮了起来。沿长廊走到底，先找左侧花园的留声贝；守园人留下了第二句话。', grant: 'accepted', effect: 'inscription' },
    { id: 'question', label: '这是真实历史，还是你们的传说？', reply: '这是一段原创的海底传说。下方文献札记单独标出了柏拉图文本的出处；不要把我的邀约当成古代出土铭文。' },
    { id: 'finish', label: '花园已醒，席位已留：我回来赴约', requires: ['table'], grant: 'ending', effect: 'ending', reply: '“那么，最后一个名字不必刻下。”花园与餐桌的光同时回应，石碑中的留名贝缓缓亮起。你没有取走王冠，而让这座城重新拥有迎接陌生人的能力。' },
  ] },
  { id: 'library', title: '失去最后一页的书', speaker: '书记官 · 塔利昂的器物留声', type: '原创 NPC 回声 · 分支对话', room: 'salon', object: '海国藏书柜', cue: '蓝绒客厅内的藏书柜或茶壶', lore: ['metal', 'unfinished'], intro: '“人们记得我们用了多少黄金，却忘了问：那些门是为谁打开的。”书页没有翻动，声音来自书柜边的一枚旧贝。', choices: [
    { id: 'history', label: '失落的结尾讲了什么？', reply: '我不能替一份残缺的文本作证。现存《克里提亚篇》在宙斯即将发言处中断；我们可以讨论它，但不能把自己的结尾塞回古书。' },
    { id: 'wealth', label: '奢华为什么没有保护这座城？', reply: '在我们的故事里，问题不在金属，而在遗忘。你可以继续收集珍宝，也可以替一位不知姓名的来者留席。去花园看看吧。' },
    { id: 'hint', label: '我该从哪里继续？', reply: '接待厅的邀约先于一切。接受它，再去长廊尽头左侧的内花园，最后走到对面的餐厅。' },
  ] },
  { id: 'garden-keeper', title: '一片不必折下的叶子', speaker: '守园人 · 涅瑞伊丝的留声贝', type: '原创 NPC 回声 · 分支对话', room: 'conservatory', object: '守园人的留声贝', cue: '内花园入口附近的贝壳，花池也可触发阅读', lore: ['garden'], intro: '“别摘下它。你要证明自己来过，不需要让这里少掉一片叶子。”贝壳记住的是离去前的嘱托，不是一个被困在里面的灵魂。', choices: [
    { id: 'care', label: '轻触留声贝，让花池重新亮起', requires: ['accepted'], grant: 'garden', effect: 'garden', reply: '你的手离开贝壳，花池中的珠光逐渐亮起。海草仍扎根在贝砂里，没有被采走。守园人补上了第二句话：“现在，让灯火也照见一位陌生人。”' },
    { id: 'why', label: '海底为何会有宫廷花园？', reply: '这座内花园是我们的神话改写。我们借用了古代文学里照料、供给与迎客的意象，却没有把陆地果树搬到海床。下方可读《奥德赛》的花园段落背景。' },
    { id: 'leave', label: '我只想安静地坐一会儿', reply: '“那也很好。”不必完成委托才配得上停留。贝壳不再催促，花池保持原来的呼吸。' },
  ] },
  { id: 'dining-host', title: '为谁留下这一席', speaker: '侍宴者 · 伊翁的留名贝', type: '原创 NPC 回声 · 分支对话', room: 'dining', object: '侍宴者的留名贝', cue: '珊瑚餐厅入口圆桌上的贝壳与成套餐具', lore: ['table', 'guest'], intro: '“最后一席，不按王冠的轻重安排。”桌上两只杯子朝向彼此，留名贝却没有刻字。伊翁在等你的回答。', choices: [
    { id: 'welcome', label: '留给还没有名字的远行者', requires: ['garden'], grant: 'table', effect: 'table', reply: '空白贝壳亮起，暖光绕过杯沿。伊翁说：“姓名可以晚一点再问，疲惫不必等。”带着这句话回接待厅，回应那块邀约铭文。' },
    { id: 'king', label: '一定要留给这座城的王吗？', reply: '“王已有自己的席位。”伊翁并不责备你，只把那枚无名贝转向门口。这一席等待的，是尚未被写进名单的人。' },
    { id: 'banquet', label: '餐厅与宴会厅有什么不同？', reply: '这里是安静的小桌用餐空间，金枝宴会厅则保留仪式性的长桌。下方《会饮篇》札记谈的是另一种古代宴集，不能把眼前的圆桌当成其历史复原。' },
  ] },
  { id: 'banquet-memory', title: '杯盏之后的谈话', speaker: '长桌留下的记忆', type: '原创器物叙事', room: 'banquet', object: '金枝织锦桌旗', cue: '金枝宴会厅的桌旗、餐盘与高脚杯', lore: ['table', 'metal'], intro: '一张长桌能容纳很多人，也可能只允许一种声音。你端详杯沿的刻痕，听见有人把座席向后挪了一点。', choices: [
    { id: 'listen', label: '听听席间被忽略的人', reply: '“轮到我了吗？”回声没有交代他的身份。这个问题比金杯更久地留在水里。这是虚构台词，而不是古希腊宴集的录音。' },
    { id: 'read', label: '他们会在宴席中谈些什么？', reply: '《会饮篇》让众人轮流赞颂爱。我们知道的是一部哲学对话怎样安排叙事，不是所有古代宴席都遵循同一种程序。' },
  ] },
  { id: 'mermaid-memory', title: '海流记住的名字', speaker: '人鱼 · 澜歌', type: '原创 NPC · 文字分支对话', species: 'mermaid', lore: ['rings', 'guest'], intro: '“你听见鲸声时，会以为那是过去在说话吗？我更愿意把它当成：远处还有生命。”她并不要求你交出视角，只愿与你同行一段。', choices: [
    { id: 'memory', label: '你真的见过城还在海面上的时候？', reply: '那是我在故事里的记忆，不是历史证词。真正可核对的是文献与器物；关于我，请把想象留在它应该在的位置。' },
    { id: 'palace', label: '宫城里有什么值得寻找？', reply: '先读接待厅的邀约铭文。花园留声贝与餐厅留名贝，会把“照料”和“迎接”连成同一条路。' },
    { id: 'song', label: '愿意为这段旅途唱一首吗？', effect: 'song', reply: '她准备唱起一段歌曲。歌声使用作品已有的授权录音，不是把这些中文台词转成朗读；静音时不会擅自开启。' },
  ] },
  { id: 'whale-memory', title: '远方并不空无一物', speaker: '巨鲸 · 溯', type: '神话拟人对话 · 非动物语言翻译', species: 'whale', lore: ['unfinished'], intro: '你把低频的回声想象成一句话：“别急着替沉默填满答案。”这里的文字是神话拟人，不是对真实鲸语的翻译。', choices: [
    { id: 'call', label: '停下来，听一次远方的回应', effect: 'whale', reply: '鲸声向远处散开。它不是在读字幕，也没有向你透露某个被证实的沉没王国。请把这段距离留给耳朵。' },
    { id: 'history', label: '你会替我补完遗失的历史吗？', reply: '“我可以陪你寻找，却不能替证据说话。”从文献里读到的、从场景中想象的，可以相遇，但不必混为一谈。' },
    { id: 'quest', label: '我想让这座宫城重新有生活', reply: '先照料花园，再替后来者留席。你不必让每一道墙都发光；一盏确实为人留下的灯，已经足够开始。' },
  ] },
  { id: 'turtle-memory', title: '慢一点，也会抵达', speaker: '海龟 · 砚', type: '神话拟人对话 · 非动物语言翻译', species: 'turtle', lore: ['garden'], intro: '你想象它侧身让开一条路：“花园里不必每一株都属于你。”它继续游动，谈话不会把海洋按下暂停。', choices: [
    { id: 'garden', label: '该怎样拜访花园？', reply: '在我们的故事里，轻触贝壳而不折取海草，就能回应守园人。真正的海洋保护不能由一个发光按钮代替；这是一次关于克制的叙事选择。' },
    { id: 'hint', label: '告诉我下一步的线索', reply: '接待厅接受邀约，左侧内花园照料花池，对面餐厅留下席位，最后回到铭文。你可以随时停下，也可以再读一遍。' },
  ] },
  { id: 'shark-memory', title: '不是每一份回应都温柔', speaker: '灰礁鲨的神话回声', type: '神话拟人对话 · 非动物语言翻译', species: 'shark', lore: ['metal'], intro: '“不要因为我没有加入宴席，就把我写成反派。”这是一句借由捕食者形象写出的虚构台词。', choices: [
    { id: 'balance', label: '这片海为何不一直和平？', reply: '作品保留追捕、逃逸和饱食后的间歇，不把所有生物摆成装饰。它仍是有限的模拟，不能据此推断真实海域的种群规律。' },
    { id: 'distance', label: '我会留出距离观察', reply: '你可以退出化身，回到自己的视角，再观察鱼群如何改变方向。理解并不总以触碰开始。' },
  ] },
  { id: 'manta-memory', title: '向着有光的地方', speaker: '蝠鲼 · 澜', type: '神话拟人对话 · 非动物语言翻译', species: 'manta', lore: ['rings'], intro: '“你看见环，而我看见环之间的路。”它的轮廓掠过石阶，像替地图翻过一页。', choices: [
    { id: 'route', label: '除了目的地，还能看什么？', reply: '柱廊之间的距离、花池旁留下的通道、同一扇窗内外的光。试着以我的视角慢游，再回到自己的视角对照。' },
    { id: 'return', label: '我们为什么还要回到宫城？', reply: '因为探索不只是找到新地方。未赴之约最后一步，是带着你做过的事，重新理解起点那块石碑。' },
  ] },
]);

const FLAGS = ['accepted', 'garden', 'table', 'ending'];
export function initialStoryState() { return { version: 1, discovered: [], flags: [], choices: [], savedAt: null }; }

export function restoreStoryState(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.discovered) || !Array.isArray(value.flags) || !Array.isArray(value.choices)) throw new Error('手记格式不兼容。');
  const ids = new Set(STORY_ENTRIES.map(entry => entry.id));
  const choices = new Set(STORY_ENTRIES.flatMap(entry => entry.choices.map(choice => `${entry.id}:${choice.id}`)));
  const flags = [];
  for (const flag of FLAGS) { if (!value.flags.includes(flag)) break; flags.push(flag); }
  return { version: 1, discovered: [...new Set(value.discovered.filter(id => ids.has(id)))], flags, choices: [...new Set(value.choices.filter(id => choices.has(id)))], savedAt: null };
}

export function storyAvailable(entry, context) { return Boolean(entry && (entry.room ? context.palaceRoom === entry.room : context.actors?.includes(entry.species))); }

export function storyForObject(candidate, room) {
  if (candidate?.living) return STORY_ENTRIES.find(entry => entry.species === candidate.species) || null;
  const direct = STORY_ENTRIES.find(entry => entry.object === candidate?.name);
  if (direct) return direct;
  const matches = { reception: ['潮汐邀约铭文'], salon: ['海国藏书柜', '贝瓷茶壶'], banquet: ['金枝织锦桌旗', '贝瓷餐盘与银制餐具', '水晶高脚杯'], conservatory: ['内花园实体种植池', '随海流摆动的有根海草', '珊瑚海扇细枝', '贝壳花园休憩座'], dining: ['珊瑚餐厅独立圆桌', '贝瓷餐盘与银制餐具', '水晶高脚杯', '备餐台叠放贝瓷碟'] };
  return matches[room]?.includes(candidate?.name) ? STORY_ENTRIES.find(entry => entry.room === room) : null;
}

export function storyObjective(state) {
  if (!state.flags.includes('accepted')) return { entry: 'inscription', room: 'reception', label: '在接待厅读邀约铭文，接受未赴之约。' };
  if (!state.flags.includes('garden')) return { entry: 'garden-keeper', room: 'conservatory', label: '长廊尽头左侧：轻触守园人的留声贝。' };
  if (!state.flags.includes('table')) return { entry: 'dining-host', room: 'dining', label: '前往对面餐厅，为无名的远行者留席。' };
  if (!state.flags.includes('ending')) return { entry: 'inscription', room: 'reception', label: '回到接待厅，让邀约铭文听见你的回答。' };
  return { entry: 'inscription', room: 'reception', label: '未赴之约已完成。灯火留下，你仍可继续探索与重读。' };
}

export function advanceStory(state, entryId, choiceId, context = {}) {
  const entry = STORY_ENTRIES.find(candidate => candidate.id === entryId);
  if (!entry) throw new Error('没有这条故事。');
  const next = restoreStoryState(state);
  if (!choiceId) {
    if (storyAvailable(entry, context) && !next.discovered.includes(entryId)) next.discovered.push(entryId);
    return { state: next, entry, reply: entry.intro, effect: null };
  }
  const choice = entry.choices.find(candidate => candidate.id === choiceId);
  if (!choice) throw new Error('没有这个对话选项。');
  if (!storyAvailable(entry, context)) throw new Error(entry.room ? '请先抵达对应房间，再与眼前的器物互动。' : '它已经游远了，请靠近后继续交谈。');
  if (choice.requires?.some(flag => !next.flags.includes(flag))) throw new Error(`故事尚未走到这里。${storyObjective(next).label}`);
  if (!next.discovered.includes(entryId)) next.discovered.push(entryId);
  if (!next.choices.includes(`${entryId}:${choiceId}`)) next.choices.push(`${entryId}:${choiceId}`);
  if (choice.grant && !next.flags.includes(choice.grant)) next.flags.push(choice.grant);
  return { state: next, entry, reply: choice.reply, effect: choice.effect || null };
}
