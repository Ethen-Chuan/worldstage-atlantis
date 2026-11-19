export const SCHOOL_LANES = {
  city: [[-98, 34, 118], [100, 46, -75], [-76, 74, -192], [104, 22, 106], [92, 83, -205], [-143, 38, -48]],
  reef: [[-64, 17, 40], [65, 36, 7], [-111, 49, -131], [141, 17, 38], [-125, 25, 144], [69, 57, -153]],
};

export function schoolTarget(fish, clock, habitat, anchor, target) {
  const center = SCHOOL_LANES[habitat][fish.group];
  const angle = clock * (0.026 + fish.group * 0.003) + fish.group * 1.37;
  const horizontal = Math.cos(angle); const depth = Math.sin(angle);
  const length = Math.sin(fish.phase) * fish.radius * 1.8;
  const width = Math.cos(fish.phase * 3.7) * 4.5;
  target.set(anchor[0] + center[0] + horizontal * 17 - depth * length + horizontal * width,
    anchor[1] + center[1] + fish.height * 0.65 + Math.sin(clock * 0.42 + fish.phase) * 0.45,
    anchor[2] + center[2] + depth * 24 + horizontal * length + depth * width);
  return target;
}

export function habitatRoute(species, index, clock, anchor) {
  let center; let radius; let rate;
  if (species === 'ancient') { center = [-91, 106, -130]; radius = [18, 2.2, 45]; rate = 0.021; }
  else if (species === 'shark') { center = [[35, 48, 65], [-35, 50, -74], [73, 67, -230]][index % 3]; radius = [18, 2.5, 30]; rate = 0.036; }
  else if (species === 'turtle') { center = [[-44, 16, 115], [59, 24, -90], [-115, 27, -102], [70, 20, 146]][index % 4]; radius = [9, 1.7, 18]; rate = 0.046; }
  else if (species === 'nautilus') { center = [65 + index % 2 * 12, 12 + index % 3 * 4, 80 - index * 26]; radius = [5, 1.2, 8]; rate = 0.023; }
  else { center = [-38, 23, 70]; radius = [8, 2.4, 19]; rate = 0.043; }
  const phase = clock * rate + index * 2.399;
  return {
    position: [anchor[0] + center[0] + Math.cos(phase) * radius[0], anchor[1] + center[1] + Math.sin(phase * 1.3) * radius[1], anchor[2] + center[2] + Math.sin(phase) * radius[2]],
    heading: Math.atan2(Math.sin(phase) * radius[0], -Math.cos(phase) * radius[2]),
  };
}
