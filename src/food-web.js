import * as THREE from 'three';

export class FoodWeb {
  constructor() { this.predators = new Map(); this.captures = 0; this.arrivals = 0; this.clock = 0; this.nextArrival = 45; this.lastEvent = '鱼群巡游，捕食者正在寻找机会。'; }

  update(delta, predators, prey, protectedActor, camera, collisions = null) {
    if (!(delta > 0)) return;
    const step = Math.min(delta, 0.1); this.clock += step;
    const reserved = new Set();
    for (const [index, predator] of predators.entries()) {
      if (!predator.root.visible || protectedActor?.root === predator.root) continue;
      let state = this.predators.get(predator.root);
      if (!state) { state = { position: predator.root.position.clone(), heading: predator.root.rotation.y, hunger: 0.62 + index * 0.08, target: null, pursuit: 0, rest: index * 4, mode: '巡游' }; this.predators.set(predator.root, state); }
      if (state.position.distanceToSquared(predator.root.position) > 90000) { state.position.copy(predator.root.position); state.target = null; }
      state.hunger = Math.min(1, state.hunger + step * 0.004); state.rest = Math.max(0, state.rest - step);
      const edible = fish => fish.alive !== false && fish.position && !(protectedActor?.source === fish.mesh && protectedActor.instance === fish.index) && !(protectedActor?.root === fish.mesh) && !reserved.has(fish);
      if (state.target && !edible(state.target)) state.target = null;
      if (!state.target && state.hunger > 0.66 && state.rest === 0) {
        let nearest = 95;
        for (const fish of prey) {
          if (!edible(fish)) continue;
          const distance = state.position.distanceTo(fish.position);
          if (distance < nearest) { nearest = distance; state.target = fish; }
        }
        state.pursuit = 0;
      }
      const origin = state.position.clone();
      const destination = state.target?.position || predator.root.position;
      const direction = destination.clone().sub(state.position);
      const distance = direction.length();
      const speed = state.target ? 16 : 4;
      if (distance > 0.01) state.position.addScaledVector(direction.normalize(), Math.min(distance, speed * step));
      predator.root.position.copy(state.position);
      if (distance > 0.1) {
        const heading = Math.atan2(-direction.x, -direction.z);
        const difference = Math.atan2(Math.sin(heading - state.heading), Math.cos(heading - state.heading));
        state.heading += difference * (1 - Math.exp(-step * 4));
      }
      predator.root.rotation.y = state.heading;
      state.mode = state.target ? '追捕' : state.rest > 0 ? state.restMode || '巡游间歇' : '巡游';
      if (state.target) {
        reserved.add(state.target); state.pursuit += step;
        const reachable = distance < 8.5 && (!collisions || collisions.move(origin, state.target.position, { radius: Math.max(0.3, state.target.size || 0.3), ignore: predator.root, dynamic: false }).distanceToSquared(state.target.position) < 0.01);
        if (reachable) {
          state.target.alive = false; state.target.consumedAt = this.clock;
          this.captures++; this.lastEvent = '灰礁鲨捕获一尾礁鱼，鱼群分散后重新集结。';
          state.target = null; state.hunger = 0.15; state.rest = 42 + index * 7; state.restMode = '饱食休息'; state.mode = state.restMode;
        } else if (state.pursuit > 18) { state.target = null; state.rest = 16; state.restMode = '追捕后恢复'; state.mode = state.restMode; this.lastEvent = '鱼群躲过追捕；捕食者放弃，恢复体力。'; }
      }
    }
    if (this.clock >= this.nextArrival) {
      this.nextArrival = this.clock + 45;
      const vacant = prey.find(fish => fish.alive === false && this.clock - fish.consumedAt > 80 && fish.position.distanceTo(camera) > 110);
      if (vacant) { vacant.alive = true; this.arrivals++; this.lastEvent = '远处有游鱼迁入；种群缓慢补充，并非原地复活。'; }
    }
  }

  inspect(prey) { return { model: 'bounded-predator-prey-not-evolution', living: prey.filter(fish => fish.alive !== false).length, captured: this.captures, immigrants: this.arrivals, predators: [...this.predators.values()].map(state => ({ mode: state.mode, hunger: Number(state.hunger.toFixed(2)) })), lastEvent: this.lastEvent }; }
}
