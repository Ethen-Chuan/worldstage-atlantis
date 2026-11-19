export class FrameBudget {
  constructor() {
    this.enabled = true;
    this.level = 0;
    this.lastChange = 0;
    this.reset();
  }

  get scale() { return [1, 0.9, 0.8, 0.72][this.level]; }

  reset(now = 0) {
    this.samples = [];
    this.duration = 0;
    this.slowWindows = 0;
    this.fastWindows = 0;
    this.warmUntil = now + 4000;
  }

  configure(enabled, now) {
    this.enabled = enabled;
    this.level = 0;
    this.lastChange = now;
    this.reset(now);
  }

  sample(milliseconds, now, eligible = true) {
    if (!this.enabled || !eligible || !Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > 250) {
      this.reset(now);
      return false;
    }
    if (now < this.warmUntil) return false;
    this.samples.push(milliseconds);
    this.duration += milliseconds;
    if (this.duration < 2000 || this.samples.length < 20) return false;
    const sorted = this.samples.sort((first, second) => first - second);
    const mean = this.duration / sorted.length;
    this.metrics = { meanMs: Math.round(mean * 10) / 10, p95Ms: Math.round(sorted[Math.floor((sorted.length - 1) * 0.95)] * 10) / 10 };
    this.samples = [];
    this.duration = 0;
    this.slowWindows = mean > 25 ? this.slowWindows + 1 : 0;
    this.fastWindows = mean < 17.5 && this.metrics.p95Ms < 23 ? this.fastWindows + 1 : 0;
    if (now - this.lastChange < 6000) return false;
    const lower = this.slowWindows >= 2 && this.level < 3;
    const higher = this.fastWindows >= 6 && this.level > 0;
    if (!lower && !higher) return false;
    this.level += lower ? 1 : -1;
    this.lastChange = now;
    this.reset(now);
    return true;
  }

  inspect() { return { enabled: this.enabled, scale: this.scale, metrics: this.metrics || null }; }
}
