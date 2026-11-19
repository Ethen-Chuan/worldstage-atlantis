export const SITE_PLAY = Object.freeze({
  palace: { name: '圣城巡礼', invitation: '触动石阶上的微光', instruction: '依次穿过五道金环，让沉睡的城重新回应。', mode: 'route', colors: ['#8dbba9', '#a9cfc1', '#bfbc8e'] },
  gate: { name: '回声寻径', invitation: '让古老刻纹回应', instruction: '循着逐次亮起的光环，驾驭生物把回声带过天门。', mode: 'route', colors: ['#98bdb7', '#b6c8b2', '#93b6c1'] },
  garden: { name: '鲸落授光', invitation: '唤起鲸骨旁的生命', instruction: '自由寻找五枚光种，将它们送回沉眠的花园。', mode: 'collect', colors: ['#91b8a4', '#a4c5b8', '#b2b58d'] },
  choir: { name: '星潮合奏', invitation: '让水母沿海流舒展', instruction: '依次点亮音符，每一道环都会加入一层回声。', mode: 'route', colors: ['#a7badc', '#9fbbc4', '#b8cab4'] },
  vortex: { name: '穿越星瞳', invitation: '唤醒星瞳 · 让群星奔涌', instruction: '驾驭生物沿着鱼群的轨迹穿环，让它们向外舒展。', mode: 'route', colors: ['#a7c5be', '#83b8b1', '#b8bd9b'] },
  prism: { name: '珊瑚播光', invitation: '轻触珊瑚，让光传开', instruction: '按任意顺序收集五枚光种，让光回到珊瑚枝脉。', mode: 'collect', colors: ['#9bcac0', '#97bcb8', '#b5ba93'] },
  vents: { name: '潮汐共振', invitation: '观察热泉的流动', instruction: '观察光环的呼吸，在金色明亮的时刻穿过。', mode: 'rhythm', colors: ['#b1b99c', '#91b9b4', '#b1bdc0'] },
});

export function playMarkup() {
  return `<section id="site-play" class="site-play" aria-label="此地的互动"><span class="eyebrow">LET THE WORLD ANSWER</span><h3 id="site-play-name">圣城巡礼</h3><p id="site-play-hint">在画面中轻触生物，直接成为它。</p><div class="site-play-actions"><button id="trial-start">沿着光迹探索 ↗</button><button id="festival-start">触动石阶上的微光</button><button id="whale-fall-start" hidden>看一场鲸落 · 时间叙事</button></div><button id="ritual-example" class="ritual-example">用一句话，让这里回应 →</button></section><section id="trial-hud" class="trial-hud" aria-label="海域试炼进度" hidden><span class="eyebrow" id="trial-category"></span><h3 id="trial-name"></h3><p id="trial-instruction"></p><div><strong id="trial-score">0 / 5</strong><span id="trial-time"></span><button id="trial-exit">结束试炼</button></div><p id="trial-feedback" role="status"></p></section><div id="trial-bearing" class="trial-bearing" hidden><span>◇</span><b></b></div><div id="festival-caption" hidden><h3 id="festival-title"></h3><p id="festival-stage"></p><button id="festival-stop">让海流平静</button></div><section id="whale-fall-note" class="world-note" hidden aria-live="polite"><p id="whale-fall-stage"></p><small>压缩时间的艺术叙事 · 非真实速度</small><p><button id="whale-fall-stop">结束观看</button></p></section>`;
}

export function embodimentMarkup() {
  return `<section id="inhabit-controls" class="inhabit-controls" aria-label="代入视角控制" hidden><div><span class="eyebrow" id="inhabit-mode"></span><strong id="inhabit-title"></strong><p id="inhabit-help"></p></div><div class="inhabit-actions"><button id="inhabit-view">切换第三人称</button><button id="inhabit-speak" aria-expanded="false">对世界说话</button><button id="inhabit-trial">以当前生物探索</button><button id="inhabit-exit">返回自由探索 <small>Esc</small></button></div></section><div id="swim-pad" class="swim-pad" aria-label="触屏移动" hidden><button data-swim="up" aria-label="上浮">升</button><button data-swim="forward" aria-label="向前游">↑</button><button data-swim="down" aria-label="下潜">降</button><button data-swim="left" aria-label="向左转向">↶</button><button data-swim="back" aria-label="向后游">↓</button><button data-swim="right" aria-label="向右转向">↷</button></div>`;
}
