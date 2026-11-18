export class SceneTap {
  constructor() { this.pointers = new Set(); this.press = null; }
  down(event) {
    this.pointers.add(event.pointerId);
    if (this.pointers.size !== 1 || event.button !== 0 || event.isPrimary === false) { this.press = null; return; }
    this.press = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
  }
  move(event) {
    if (this.press?.id === event.pointerId && Math.hypot(this.press.x - event.clientX, this.press.y - event.clientY) > 6) this.press = null;
  }
  up(event) {
    const press = this.press; this.move(event);
    const tapped = Boolean(press && this.press && press.id === event.pointerId && this.pointers.size === 1 && event.timeStamp - press.time < 700);
    this.pointers.delete(event.pointerId); this.press = null; return tapped;
  }
  cancel(event) { this.pointers.delete(event.pointerId); this.press = null; }
}
