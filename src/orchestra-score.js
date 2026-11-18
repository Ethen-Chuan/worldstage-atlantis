export const SCORES = {
  palace: { title: '沉没的王冠', character: '弦乐 · 圆号 · 庄严行板', tempo: 64, root: 62, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 2, 6, 3, 5, 4, 0], melody: [[0, 4, 2], [5, 4, 2], [7, 6, 4], [3, 2, 1], [3, 5, 7], [9, 7, 5], [4, 6, 8], [7, 4, 0]], lead: 'horn', water: 240 },
  gate: { title: '古神之门', character: '低弦 · 遥远铜管 · 仪式慢板', tempo: 58, root: 57, scale: [0, 1, 3, 5, 7, 8, 10], chords: [0, 1, 0, 5, 3, 1, 4, 0], melody: [[0, 1, 0], [1, 3, 5], [4, 0, 2], [5, 7, 4], [3, 5, 7], [8, 5, 3], [4, 1, 0], [0, 4, 7]], lead: 'horn', water: 170 },
  garden: { title: '鲸骨上开出的花', character: '大提琴 · 长笛 · 竖琴', tempo: 70, root: 60, scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 3, 5, 1, 0, 6, 3, 0], melody: [[4, 7, 8], [7, 5, 3], [5, 7, 9], [8, 6, 4], [7, 4, 2], [6, 8, 7], [5, 3, 1], [4, 2, 0]], lead: 'flute', water: 320 },
  choir: { title: '群星记得海的名字', character: '弦乐群 · 钟琴 · 悠长咏叹', tempo: 60, root: 65, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 6, 2, 5, 4, 0], melody: [[7, 4, 2], [5, 7, 9], [10, 7, 5], [6, 4, 3], [4, 6, 8], [9, 7, 5], [8, 6, 4], [7, 2, 0]], lead: 'violin', water: 200 },
  vortex: { title: '星海之眼', character: '圆号长线 · 旋转竖琴 · 深鼓', tempo: 68, root: 62, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 6, 5, 4, 0, 2, 3, 4], melody: [[0, 2, 4], [6, 8, 7], [9, 7, 5], [4, 6, 8], [7, 9, 11], [9, 6, 4], [5, 3, 7], [8, 6, 4]], lead: 'horn', water: 220 },
  prism: { title: '虹珊瑚的加冕', character: '长笛 · 竖琴 · 璀璨弦乐', tempo: 72, root: 67, scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 1, 5, 4, 2, 3, 4, 0], melody: [[0, 4, 7], [8, 5, 3], [9, 7, 5], [6, 8, 11], [9, 6, 4], [7, 5, 3], [8, 6, 4], [7, 4, 0]], lead: 'flute', water: 390 },
  vents: { title: '深渊之下的炉火', character: '大提琴 · 低铜管 · 定音鼓', tempo: 56, root: 59, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 0, 5, 3, 6, 5, 4, 0], melody: [[0, 0, 4], [2, 4, 0], [5, 7, 4], [3, 0, 2], [6, 8, 6], [7, 5, 3], [4, 6, 1], [0, 4, 0]], lead: 'cello', water: 140 },
};

export function scoreFor(site) { return SCORES[site] || SCORES.palace; }

export function scaleNote(score, degree) {
  return score.root + score.scale[((degree % 7) + 7) % 7] + Math.floor(degree / 7) * 12;
}

export function composeScore(site) {
  const score = scoreFor(site); const events = [];
  const add = (instrument, beat, degree, duration, gain, pan, layer = 'foundation') => events.push({ instrument, beat, midi: scaleNote(score, degree), duration, gain, pan, layer });
  for (let bar = 0; bar < 16; bar++) {
    const chord = score.chords[bar % 8]; const beat = bar * 4; const lift = bar >= 8 ? 1.12 : 0.9;
    add('cello', beat, chord - 14, 3.85, 0.2, 0.12);
    add('cello', beat + 0.06, chord - 7, 3.7, 0.09, 0.18);
    [chord - 7, chord - 3, chord + 2].forEach((degree, index) => add('violin', beat + index * 0.045, degree, 3.8, 0.105 * lift, -0.4 + index * 0.32));
    const melody = score.melody[bar % 8];
    melody.forEach((degree, index) => add(score.lead, beat + [0.15, 1.75, 2.7][index], degree - (score.lead === 'horn' ? 7 : 0), [1.45, 0.85, 1.15][index], 0.21 * lift, score.lead === 'flute' ? -0.2 : 0.25, 'melody'));
    const arpeggio = site === 'vortex' || site === 'prism' ? [0, 2, 4, 6, 4, 2] : [0, 4, 2, 4];
    arpeggio.forEach((degree, index) => add('harp', beat + 0.1 + index * 3.6 / arpeggio.length, chord + degree, 2.8, 0.065, index % 2 ? 0.4 : -0.35));
    add('horn', beat + 0.08, chord - 7, 3.5, 0.19, 0.18, 'brass');
    add('horn', beat + 0.14, chord - 3, 3.35, 0.105, 0.35, 'brass');
    add('timpani', beat, chord - 14, 3, 0.24, 0.05, 'percussion');
    if (bar % 2) add('timpani', beat + 2.6, chord - 10, 2, 0.12, 0.05, 'percussion');
    if (bar % 4 === 0) { add('cymbal', beat + 0.1, 0, 7, 0.095, -0.05, 'percussion'); add('glock', beat + 0.2, chord + 7, 6, 0.08, -0.3); }
    if (bar >= 8) add('violin', beat + 0.1, melody[0] + 7, 3.5, 0.08, -0.15, 'brass');
  }
  return { ...score, beats: 64, events: events.sort((first, second) => first.beat - second.beat) };
}

export function orchestralMix(intensity, trial = false) {
  const strength = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : 0));
  return { foundation: 0.86, melody: 0.85 + strength * 0.12, brass: 0.2 + strength * 0.8, percussion: (trial ? 0.3 : 0.08) + strength * 0.78 };
}
