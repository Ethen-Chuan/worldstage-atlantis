export const STAR_WAKE_DURATION = 18;

function smooth(start, end, value) {
  const fraction = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return fraction * fraction * (3 - 2 * fraction);
}

export function starWakeStage(age) {
  if (!Number.isFinite(age) || age < 0 || age >= STAR_WAKE_DURATION) return { name: '星海静流', strength: 0, gather: 0, surge: 0 };
  const gather = smooth(0, 1.6, age) * (1 - smooth(2, 3.4, age));
  const surge = smooth(1.8, 2.25, age) * (1 - smooth(7.5, 17, age));
  return { name: age < 1.8 ? '万鱼收束 · 星瞳蓄光' : age < 3.4 ? '星环奔涌 · 群星初耀' : age < 9 ? '银蓝星轨 · 环流交辉' : '余辉入海 · 鱼群归流', strength: Math.max(gather * 0.32, surge), gather, surge };
}

export class StarWake {
  constructor() { this.clock = 0; this.speed = 1; this.gather = 0; this.radiance = 0; this.stage = starWakeStage(-1); }
  update(delta, age, reduced = false) {
    if (!(delta > 0)) return this;
    const step = Math.min(delta, 0.1); const stage = starWakeStage(age);
    const speedTarget = 1 + stage.surge * (reduced ? 1.2 : 7);
    const damping = 1 - Math.exp(-step * (speedTarget > this.speed ? 10 : 2.4));
    const previousSpeed = this.speed;
    this.speed += (speedTarget - this.speed) * damping;
    this.clock += step * (previousSpeed + this.speed) * 0.5;
    this.gather += (stage.gather - this.gather) * (1 - Math.exp(-step * 3.5));
    this.radiance += (stage.strength - this.radiance) * (1 - Math.exp(-step * (stage.strength > this.radiance ? 12 : 2)));
    this.stage = stage;
    return this;
  }
  inspect() { return { phase: this.stage.name, speed: Number(this.speed.toFixed(3)), radiance: Number(this.radiance.toFixed(3)), clock: Number(this.clock.toFixed(3)) }; }
}

export function starOrbit(time, fish, energy = 0, motionTime = time, gather = 0, target = []) {
  const lane = fish.lane ?? Math.floor(fish.layer * 3);
  const angle = fish.angle + motionTime * fish.speed;
  const breathing = Math.sin(time * 0.12 + fish.angle * 0.4) * 1.5;
  const spread = (fish.layer * 3 % 1) * (5 - gather * 3.5);
  const radius = 38 + lane * 16 + spread + breathing - gather * 4 + energy * 5;
  const horizontal = Math.cos(angle) * radius;
  const vertical = Math.sin(angle) * radius * (0.68 + lane * 0.05);
  const inclination = [-0.55, 0.16, 0.75][lane];
  const precession = time * (lane % 2 ? -0.008 : 0.011) + lane * 0.32;
  const tiltedY = vertical * Math.cos(inclination);
  const tiltedZ = vertical * Math.sin(inclination) + fish.depth * 4;
  target[0] = horizontal * Math.cos(precession) - tiltedZ * Math.sin(precession);
  target[1] = 75 + tiltedY;
  target[2] = horizontal * Math.sin(precession) + tiltedZ * Math.cos(precession);
  return target;
}
