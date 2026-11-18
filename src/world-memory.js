import { ASSETS, COLORS, LIVING_ASSETS, initialCreation } from './creation.js';
import { LANDMARKS } from './landmarks.js';

export const MEMORY_KEY = 'worldstage.world.v1';
export const MEMORY_LIMIT = 40000;
const fail = () => { throw new Error('这份本机存档不完整或版本不兼容。当前世界未改变。'); };
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const vector = value => Array.isArray(value) && value.length === 3 && value.every(part => Number.isFinite(part) && Math.abs(part) <= 10000000);
const ranges = { scale: [0.3, 3], height: [-10, 90], speed: [0.15, 2.5], weathering: [0, 1], spread: [0.45, 2.2] };

export function readMemory(raw) {
  if (typeof raw !== 'string' || !raw.length || raw.length > MEMORY_LIMIT) fail();
  let value;
  try { value = JSON.parse(raw); } catch { fail(); }
  if (!exactKeys(value, ['version', 'savedAt', 'entities', 'selected', 'lighting', 'view', 'visited']) || value.version !== 1 || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) fail();
  if (!Array.isArray(value.entities) || value.entities.length > 20 || !['sunlit', 'moonlit', 'golden'].includes(value.lighting)) fail();
  if (!exactKeys(value.view, ['position', 'target']) || !vector(value.view.position) || !vector(value.view.target)) fail();
  if (Math.hypot(...value.view.position.map((part, index) => part - value.view.target[index])) < 0.5) fail();
  if (!Array.isArray(value.visited) || value.visited.length > LANDMARKS.length || value.visited.some(id => !LANDMARKS.some(landmark => landmark.id === id))) fail();
  const ids = new Set();
  for (const item of value.entities) {
    if (!exactKeys(item, ['id', 'asset', 'position', 'params', 'orbit', 'resonance', 'following', 'preset'])) fail();
    if (!/^form-\d{2,5}$/.test(item.id) || Number(item.id.slice(5)) > 99900 || ids.has(item.id) || !Object.hasOwn(ASSETS, item.asset) || !vector(item.position)) fail();
    ids.add(item.id);
    if (typeof item.following !== 'boolean' || typeof item.preset !== 'boolean' || item.following && !LIVING_ASSETS.includes(item.asset)) fail();
    if (!exactKeys(item.params, [...Object.keys(ranges), 'color', 'glow']) || !Object.hasOwn(COLORS, item.params.color) || typeof item.params.glow !== 'boolean') fail();
    for (const [key, limits] of Object.entries(ranges)) if (!Number.isFinite(item.params[key]) || item.params[key] < limits[0] || item.params[key] > limits[1]) fail();
  }
  for (const item of value.entities) {
    for (const relation of ['orbit', 'resonance']) if (item[relation] !== null && (!ids.has(item[relation]) || item[relation] === item.id)) fail();
    const around = value.entities.find(candidate => candidate.id === item.orbit);
    if (around && (!LIVING_ASSETS.includes(item.asset) || LIVING_ASSETS.includes(around.asset) || item.following)) fail();
    if (item.resonance && (item.asset !== 'whale' || value.entities.find(candidate => candidate.id === item.resonance)?.asset !== 'coral')) fail();
  }
  if (value.selected !== null && !ids.has(value.selected)) fail();
  const state = initialCreation();
  state.entities = value.entities.map(item => ({ ...item, name: `${ASSETS[item.asset]} · ${item.id.slice(5)}` }));
  state.selected = value.selected;
  state.nextId = Math.max(0, ...state.entities.map(item => Number(item.id.slice(5)))) + 1;
  state.lighting = value.lighting;
  state.paused = true;
  state.lastCreated = [];
  state.focused = {};
  for (const item of state.entities) state.focused[item.asset] = item.id;
  return { state, view: value.view, visited: [...new Set(value.visited)], savedAt: value.savedAt };
}

export function writeMemory(state, view, visited, now = new Date()) {
  const value = {
    version: 1, savedAt: now.toISOString(),
    entities: state.entities.map(item => ({ id: item.id, asset: item.asset, position: [...item.position], params: { ...item.params }, orbit: item.orbit, resonance: item.resonance, following: item.following === true, preset: item.preset === true })),
    selected: state.selected, lighting: state.lighting,
    view: { position: [...view.position], target: [...view.target] }, visited: [...visited],
  };
  const serialized = JSON.stringify(value);
  readMemory(serialized);
  return serialized;
}
