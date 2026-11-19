import { PALACE_ROOMS } from './palace-layout.js';

export const PALACE_GLYPHS = Object.freeze({
  reception: [[[5, 23], [4, 12], [10, 17], [16, 7], [22, 17], [28, 12], [27, 23], [5, 23]], [[8, 27], [24, 27]]],
  salon: [[[7, 17], [7, 10], [25, 10], [25, 17]], [[4, 15], [8, 15], [8, 22], [24, 22], [24, 15], [28, 15], [28, 25], [4, 25], [4, 15]], [[7, 25], [7, 28]], [[25, 25], [25, 28]]],
  banquet: [[[4, 17], [28, 17]], [[6, 17], [6, 26]], [[26, 17], [26, 26]], [[16, 17], [16, 5]], [[10, 8], [10, 12], [22, 12], [22, 8]], [[13, 26], [19, 26]]],
  bedroom: [[[21, 4], [12, 6], [7, 13], [8, 22], [15, 28], [24, 26], [28, 20], [20, 21], [14, 16], [14, 9], [21, 4]]],
  club: [[[8, 5], [24, 5], [23, 12], [20, 17], [16, 19], [12, 17], [9, 12], [8, 5]], [[16, 19], [16, 27]], [[10, 27], [22, 27]], [[9, 10], [23, 10]]],
  conservatory: [[[16, 28], [16, 5]], [[16, 21], [7, 15], [4, 8]], [[16, 17], [25, 12], [28, 5]], [[16, 12], [10, 7], [10, 3]], [[7, 15], [3, 15]], [[25, 12], [28, 16]], [[11, 28], [21, 28]]],
  dining: [[[14, 9], [21, 9], [25, 13], [25, 21], [21, 25], [14, 25], [10, 21], [10, 13], [14, 9]], [[4, 4], [4, 28]], [[1, 4], [1, 11], [7, 11], [7, 4]], [[29, 4], [29, 28]]],
  exit: [[[11, 27], [5, 27], [5, 11], [8, 5], [14, 3], [20, 5], [23, 11], [23, 14]], [[14, 22], [29, 22]], [[24, 17], [29, 22], [24, 27]]],
  journal: [[[6, 5], [14, 5], [17, 8], [20, 5], [28, 5], [28, 25], [20, 25], [17, 28], [14, 25], [6, 25], [6, 5]], [[17, 8], [17, 28]]],
});

export function palaceGlyph(id) {
  const strokes = PALACE_GLYPHS[id] || PALACE_GLYPHS.reception;
  return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${strokes.map(points => `<polyline points="${points.map(point => point.join(',')).join(' ')}"/>`).join('')}</svg>`;
}

export function palaceNavigationMarkup() {
  const roomButtons = PALACE_ROOMS.map(room => `<button type="button" data-room="${room.id}" aria-label="前往${room.name}" aria-current="false">${palaceGlyph(room.id)}</button>`).join('');
  return `<details><summary aria-label="展开或收起宫城图形导览">${palaceGlyph('reception')}<svg class="palace-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><nav aria-label="宫城空间"><button type="button" data-palace-journal aria-label="阅读潮汐手记">${palaceGlyph('journal')}</button>${roomButtons}<button type="button" data-room="exit" aria-label="返回宫城前庭">${palaceGlyph('exit')}</button></nav></details>`;
}
