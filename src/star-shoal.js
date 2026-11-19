export function starOrbit(time, fish, energy = 0) {
  const lane = fish.lane ?? Math.floor(fish.layer * 3);
  const angle = fish.angle + time * fish.speed;
  const breathing = Math.sin(time * 0.12 + fish.angle * 0.4) * 1.5;
  const radius = 36 + lane * 14 + (fish.layer * 3 % 1) * 5 + breathing + energy * 6;
  const horizontal = Math.cos(angle) * radius;
  const vertical = Math.sin(angle) * radius * (0.68 + lane * 0.05);
  const inclination = [-0.55, 0.16, 0.75][lane];
  const precession = time * (lane % 2 ? -0.008 : 0.011) + lane * 0.32;
  const tiltedY = vertical * Math.cos(inclination);
  const tiltedZ = vertical * Math.sin(inclination) + fish.depth * 4;
  return [horizontal * Math.cos(precession) - tiltedZ * Math.sin(precession), 75 + tiltedY, horizontal * Math.sin(precession) + tiltedZ * Math.cos(precession)];
}
