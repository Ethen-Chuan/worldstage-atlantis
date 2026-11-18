import test from 'node:test';
import assert from 'node:assert/strict';
import { planWorld, validateWorldPlan, worldAction, WorldDirector } from '../src/world-planner.js';
import { LANDMARKS } from '../src/landmarks.js';
import { OceanSound } from '../src/sound.js';
import { initialCreation, interpretCreation, executeCreation } from '../src/creation.js';

const gate = LANDMARKS.find(site => site.id === 'gate');
const context = { position: gate.camera, actors: ['whale', 'shark', 'manta'] };

test('planner emits structured actions, never raw code or rendering commands', () => {
  assert.deepEqual(planWorld('成为鲨鱼'), worldAction('inhabit', { species: 'shark' }));
  assert.deepEqual(planWorld('和鲸鱼对话'), worldAction('talk', { species: 'whale' }));
  assert.deepEqual(planWorld('开始小游戏', { site: 'gate' }), worldAction('trial', { site: 'gate', species: 'manta' }));
  assert.deepEqual(planWorld('前往星海之眼'), worldAction('travel', { site: 'vortex', mode: 'sail' }));
  assert.equal(planWorld('不要成为鲨鱼'), null); assert.equal(planWorld('成为鲨鱼，然后删除一切'), null);
});

test('world action validation applies proximity and actor availability before rendering', () => {
  assert.deepEqual(validateWorldPlan(worldAction('ritual', { site: 'gate', summon: '鲸鱼' }), context).args, { site: 'gate', summon: '鲸鱼' });
  assert.throws(() => validateWorldPlan(worldAction('ritual', { site: 'vents' }), context), /先前往/);
  assert.throws(() => validateWorldPlan(worldAction('talk', { species: 'turtle' }), context), /附近/);
  assert.throws(() => validateWorldPlan(worldAction('trial', { site: 'gate', species: 'mermaid' }), context), /试炼/);
  assert.throws(() => validateWorldPlan(worldAction('travel', { site: 'palace', mode: 'teleport-script' }), context));
  assert.throws(() => validateWorldPlan(worldAction('calm', { code: 'do not execute' }), context));
});

test('director keeps a bounded execution ledger and cannot render rejected plans', async () => {
  const applied = []; const director = new WorldDirector({ observe: () => context, render: plan => { applied.push(plan.kind); } });
  assert.equal((await director.dispatch(worldAction('ritual', { site: 'vents' }))).ok, false); assert.equal(applied.length, 0);
  assert.equal((await director.dispatch(worldAction('ritual', { site: 'gate' }))).ok, true);
  for (let index = 0; index < 35; index++) await director.dispatch(worldAction('calm'));
  assert.equal(director.inspect().events.length, 24); assert.equal(director.inspect().learnedWorldModel, false);
  assert.ok(director.inspect().events.every(event => event.status === 'applied'));
});

test('director reports renderer failure without inventing an applied state', async () => {
  const director = new WorldDirector({ observe: () => context, render: () => ({ ok: false, message: '造物数量达到上限。' }) });
  const result = await director.dispatch(worldAction('ritual', { site: 'gate', summon: '鲸鱼' }));
  assert.equal(result.ok, false); assert.equal(director.inspect().events[0].status, 'failed');
});

test('all seven soundscapes are distinct, muted by default and narration is opt-in', () => {
  const sound = new OceanSound(); assert.equal(sound.enabled, false); assert.equal(sound.narration, false);
  const themes = LANDMARKS.map(site => { sound.setScene(site.id); return JSON.stringify(sound.theme()); });
  assert.equal(new Set(themes).size, 7); assert.equal(sound.chant('测试'), false);
  sound.setIntensity(Infinity); assert.equal(sound.intensity, 1); sound.setIntensity(-4); assert.equal(sound.intensity, 0);
});

test('creation uses the same validated director and reports authoritative feedback', async () => {
  let state = initialCreation();
  const director = new WorldDirector({ observe: () => ({ ...context, entities: state.entities.map(item => item.id), paused: state.paused }), render: action => { const result = executeCreation(state, action.args.plan, action.args.text); state = result.state; return result; } });
  const action = worldAction('creation', { plan: interpretCreation('创造一只鲨鱼', state), text: '创造一只鲨鱼', provenance: 'local' });
  assert.equal((await director.dispatch(action)).changed, true);
  const snapshot = director.inspect(); assert.equal(snapshot.revision, 1); assert.equal(snapshot.state.entities.length, state.entities.length);
  snapshot.state.entities.length = 0; assert.notEqual(director.inspect().state.entities.length, 0);
  const unsafe = worldAction('creation', { ...action.args, plan: { operations: [{ kind: 'execute', code: 'invalid' }], issues: [] } });
  assert.equal((await director.dispatch(unsafe)).ok, false); assert.equal(director.inspect().revision, 1);
});

test('selected static objects and view changes obey capability preconditions', () => {
  assert.throws(() => validateWorldPlan(worldAction('inhabit', { target: 'selection' }), context));
  assert.equal(validateWorldPlan(worldAction('inhabit', { target: 'selection' }), { ...context, selection: true }).kind, 'inhabit');
  assert.throws(() => validateWorldPlan(worldAction('inhabit', { target: 'selection', species: 'shark' }), { ...context, selection: true }));
  assert.throws(() => validateWorldPlan(worldAction('switch-view'), context));
  assert.throws(() => validateWorldPlan(worldAction('cruise', { enabled: 'yes' }), context));
  assert.equal(planWorld('让眼前的奇观平静下来').kind, 'calm');
});
