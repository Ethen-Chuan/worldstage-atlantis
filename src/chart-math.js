import { ATLAS_SITES } from './landmarks.js';

export const planarDistance = (first, second) => Math.hypot(first[0] - second[0], first[2] - second[2]);
export const formatDistance = distance => distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`;
export const compassBearing = forward => (Math.atan2(forward[0], -forward[2]) * 180 / Math.PI + 360) % 360;

export function chartView(center, span, width, height, bearing = 0) {
  return { center, span, width, height, bearing, scale: Math.min(width, height) / span };
}

export function projectChart(position, view, margin = 0) {
  const angle = view.bearing * Math.PI / 180;
  const horizontal = position[0] - view.center[0];
  const depth = position[2] - view.center[2];
  const offsetX = (horizontal * Math.cos(angle) + depth * Math.sin(angle)) * view.scale;
  const offsetY = (-horizontal * Math.sin(angle) + depth * Math.cos(angle)) * view.scale;
  const limitX = Math.max(1, view.width / 2 - margin);
  const limitY = Math.max(1, view.height / 2 - margin);
  const ratio = margin ? Math.max(1, Math.abs(offsetX) / limitX, Math.abs(offsetY) / limitY) : 1;
  return { x: view.width / 2 + offsetX / ratio, y: view.height / 2 + offsetY / ratio, edge: ratio > 1, angle: Math.atan2(offsetX, -offsetY) * 180 / Math.PI };
}

export function unprojectChart(point, view) {
  const angle = view.bearing * Math.PI / 180;
  const horizontal = (point.x - view.width / 2) / view.scale;
  const depth = (point.y - view.height / 2) / view.scale;
  return [view.center[0] + horizontal * Math.cos(angle) - depth * Math.sin(angle), 0, view.center[2] + horizontal * Math.sin(angle) + depth * Math.cos(angle)];
}

export function fitChart(position, width, height) {
  const points = [...ATLAS_SITES.map(landmark => landmark.center), position];
  const minimumX = Math.min(...points.map(point => point[0]));
  const maximumX = Math.max(...points.map(point => point[0]));
  const minimumZ = Math.min(...points.map(point => point[2]));
  const maximumZ = Math.max(...points.map(point => point[2]));
  const scale = Math.min(Math.max(1, width - 120) / Math.max(1, maximumX - minimumX), Math.max(1, height - 120) / Math.max(1, maximumZ - minimumZ));
  return chartView([(minimumX + maximumX) / 2, 0, (minimumZ + maximumZ) / 2], Math.max(800, Math.min(width, height) / scale), width, height);
}

export function chartScale(view) {
  const target = 70 / view.scale;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const meters = [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= target) || magnitude * 10;
  return { meters, pixels: meters * view.scale };
}
