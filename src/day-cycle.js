const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const amount = clamp(value); return amount * amount * (3 - 2 * amount); };
const color = hex => [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
const stops = [
  [0, '101c37', '24394f', '071f30', '234255', 'a7c6e8', '102c42'],
  [5, '24304b', '886975', '123447', '516276', 'd4c8e1', '193d50'],
  [6.5, '6689a3', 'e8ad88', '1e5d6b', '769caa', 'ffdfb0', '2a6471'],
  [9, '3979ab', 'c6dce0', '145968', '78acba', 'fff2d9', '28717c'],
  [15.5, '3379a6', 'c7e0e2', '125b69', '6ea8b6', 'fff0d6', '2a7079'],
  [18, '4b6589', 'e2a06f', '244957', '9c8980', 'ffc58a', '325d68'],
  [19.5, '242d4b', '715776', '102c43', '455571', 'c7c5e8', '16384c'],
  [22, '101c37', '24394f', '071f30', '234255', 'a7c6e8', '102c42'],
  [24, '101c37', '24394f', '071f30', '234255', 'a7c6e8', '102c42'],
];

export function dayCycleAt(hour) {
  const localHour = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : 12;
  const upper = stops.findIndex(stop => stop[0] > localHour);
  const first = stops[Math.max(0, upper - 1)]; const second = stops[upper];
  const blend = smooth((localHour - first[0]) / (second[0] - first[0]));
  const palette = ['skyTop', 'skyHorizon', 'waterDeep', 'waterHorizon', 'lightColor', 'fog'].reduce((result, name, index) => {
    const start = color(first[index + 1]); const end = color(second[index + 1]);
    result[name] = start.map((value, channel) => value + (end[channel] - value) * blend); return result;
  }, {});
  const elevation = Math.sin((localHour - 6) / 24 * Math.PI * 2);
  const daylight = smooth((elevation + 0.13) / 0.55);
  const twilight = (1 - smooth(Math.abs(elevation) / 0.45)) * smooth((elevation + 0.3) / 0.3);
  const lightElevation = Math.max(0.045, elevation > 0 ? elevation : -elevation * 0.6);
  const direction = [-0.18, lightElevation, -1]; const magnitude = Math.hypot(...direction);
  return { ...palette, hour: localHour, daylight, night: 1 - daylight, twilight, direction: direction.map(value => value / magnitude), phase: daylight < 0.16 ? 'night' : twilight > 0.45 ? localHour < 12 ? 'dawn' : 'dusk' : 'day' };
}

export class WorldDayClock {
  constructor(now = () => new Date()) { this.now = now; this.mode = 'realtime'; this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; }
  setMode(mode) { if (!['realtime', 'day', 'dusk', 'night'].includes(mode)) return false; this.mode = mode; return true; }
  sample() {
    const date = this.now(); const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600 + date.getMilliseconds() / 3600000;
    return { ...dayCycleAt(this.mode === 'realtime' ? hour : { day: 12, dusk: 18, night: 23 }[this.mode]), mode: this.mode, timezone: this.timezone, artisticCycle: true };
  }
}
