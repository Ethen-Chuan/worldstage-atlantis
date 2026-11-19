import * as THREE from 'three';

export const SEA_LEVEL = 190;
export const DOLPHIN_GRAVITY = 9.81;
export const DOLPHIN_CYCLE = 46;

export function waveHeight(horizontal, depth, time) {
  return SEA_LEVEL + Math.sin(horizontal * 0.075 + depth * 0.051 - time * 0.65) * 0.65 + Math.sin(horizontal * 0.15 - depth * 0.11 + time * 0.9) * 0.24;
}

function transition(time, duration, start, finish, startVelocity, finishVelocity, startAcceleration, finishAcceleration) {
  const fraction = THREE.MathUtils.clamp(time / duration, 0, 1);
  const linear = startVelocity * duration; const quadratic = startAcceleration * duration ** 2 / 2;
  const distance = finish - start - linear - quadratic;
  const velocity = finishVelocity * duration - linear - 2 * quadratic;
  const acceleration = finishAcceleration * duration ** 2 - 2 * quadratic;
  const cubic = 10 * distance - 4 * velocity + acceleration / 2;
  const quartic = -15 * distance + 7 * velocity - acceleration;
  const quintic = 6 * distance - 3 * velocity + acceleration / 2;
  return { height: start + linear * fraction + quadratic * fraction ** 2 + cubic * fraction ** 3 + quartic * fraction ** 4 + quintic * fraction ** 5, velocity: (linear + 2 * quadratic * fraction + 3 * cubic * fraction ** 2 + 4 * quartic * fraction ** 3 + 5 * quintic * fraction ** 4) / duration };
}

export function dolphinPath(time, index) {
  const lane = index % 3; const radius = 32 + lane * 16;
  const phase = ((time - Math.floor(index / 3) * DOLPHIN_CYCLE / 3 - lane * 1.65) % DOLPHIN_CYCLE + DOLPHIN_CYCLE) % DOLPHIN_CYCLE;
  const straight = 168; const circumference = straight * 2 + Math.PI * 2 * radius;
  const speed = circumference / DOLPHIN_CYCLE; const distance = phase * speed;
  let horizontal; let depth; let horizontalVelocity; let depthVelocity; let bank = 0;
  if (distance < straight) {
    horizontal = radius; depth = 62 - distance; horizontalVelocity = 0; depthVelocity = -speed;
  } else if (distance < straight + Math.PI * radius) {
    const angle = (distance - straight) / radius;
    horizontal = radius * Math.cos(angle); depth = -106 - radius * Math.sin(angle);
    horizontalVelocity = -Math.sin(angle) * speed; depthVelocity = -Math.cos(angle) * speed; bank = Math.sin(angle) * 0.12;
  } else if (distance < straight * 2 + Math.PI * radius) {
    horizontal = -radius; depth = -106 + distance - straight - Math.PI * radius; horizontalVelocity = 0; depthVelocity = speed;
  } else {
    const angle = (distance - straight * 2 - Math.PI * radius) / radius;
    horizontal = -radius * Math.cos(angle); depth = 62 + radius * Math.sin(angle);
    horizontalVelocity = Math.sin(angle) * speed; depthVelocity = Math.cos(angle) * speed; bank = Math.sin(angle) * 0.12;
  }
  const duration = 2.45 + lane * 0.1; const launch = 76 / speed - duration / 2;
  const elapsed = phase - launch; const launchVelocity = DOLPHIN_GRAVITY * duration / 2;
  const submerged = -8.5 - lane * 0.5;
  let height = submerged; let verticalVelocity = 0; let stage = 'cruise'; let effort = 0.55;
  if (elapsed >= -2.4 && elapsed < 0) {
    const ascent = transition(elapsed + 2.4, 2.4, submerged, 0, 0, launchVelocity, 0, -DOLPHIN_GRAVITY);
    height = ascent.height; verticalVelocity = ascent.velocity; stage = 'approach'; effort = 1;
  } else if (elapsed >= 0 && elapsed <= duration) {
    height = launchVelocity * elapsed - DOLPHIN_GRAVITY * elapsed ** 2 / 2;
    verticalVelocity = launchVelocity - DOLPHIN_GRAVITY * elapsed; stage = verticalVelocity >= 0 ? 'rising' : 'falling'; effort = 0.07;
  } else if (elapsed > duration && elapsed < duration + 2.8) {
    const recovery = transition(elapsed - duration, 2.8, 0, submerged, -launchVelocity, 0, -DOLPHIN_GRAVITY, 0);
    height = recovery.height; verticalVelocity = recovery.velocity; stage = 'recovery'; effort = 0.35;
  }
  return { position: [horizontal - 70, SEA_LEVEL + height, depth], velocity: [horizontalVelocity, verticalVelocity, depthVelocity], heading: Math.atan2(-horizontalVelocity, -depthVelocity), pitch: Math.atan2(verticalVelocity, speed), bank, phase, stage, effort, flightDuration: duration, launch, splash: -1 };
}

export function waterCrossing(previous, current, previousTime, time) {
  if (!(time > previousTime) || time - previousTime > 0.5 || previous.distanceTo(current) > 20) return null;
  const before = previous.y - waveHeight(previous.x, previous.z, previousTime);
  const after = current.y - waveHeight(current.x, current.z, time);
  if ((before >= 0) === (after >= 0)) return null;
  const fraction = before / (before - after); const position = previous.clone().lerp(current, fraction);
  const impactTime = THREE.MathUtils.lerp(previousTime, time, fraction);
  position.y = waveHeight(position.x, position.z, impactTime);
  return { position, time: impactTime, entering: before > 0, velocity: current.clone().sub(previous).divideScalar(time - previousTime) };
}

export class DolphinPilot {
  constructor(position, velocity = new THREE.Vector3()) {
    this.velocity = velocity.clone(); this.airborne = position.y > SEA_LEVEL; this.cooldown = 0;
  }
  step(position, heading, keys, delta, time) {
    if (!(delta > 0)) return position.clone();
    const seconds = Math.min(delta, 0.1); const surface = waveHeight(position.x, position.z, time);
    this.cooldown = Math.max(0, this.cooldown - seconds);
    if (this.airborne) this.velocity.y -= DOLPHIN_GRAVITY * seconds;
    else {
      const speed = keys.has('forward') ? keys.has('fast') ? 19 : 14 : keys.has('back') ? 3 : 7;
      const forward = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
      const desired = forward.multiplyScalar(speed);
      desired.y = keys.has('up') ? 6 : keys.has('down') ? -7 : THREE.MathUtils.clamp((surface - 8 - position.y) * 1.2, -5, 5);
      this.velocity.lerp(desired, 1 - Math.exp(-seconds * 2.2));
      if (keys.has('up') && position.y > surface - 2.4 && this.cooldown === 0 && Math.hypot(this.velocity.x, this.velocity.z) > 9) {
        this.velocity.y = 11.5; this.airborne = true; this.cooldown = 4;
      }
    }
    const next = position.clone().addScaledVector(this.velocity, seconds);
    if (this.airborne && this.velocity.y < 0 && next.y < waveHeight(next.x, next.z, time)) { this.airborne = false; this.cooldown = 2.2; }
    else if (!this.airborne && this.velocity.y > 0 && next.y > surface - 1.8) { next.y = surface - 1.8; this.velocity.y = 0; }
    return next;
  }
}
