import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCreation, interpretCreation, executeCreation, operation } from '../src/creation.js';
import { initialGuide, advanceGuide, guideCopy } from '../src/creation-guide.js';

function fixture() {
  let world = initialCreation();
  let guide = initialGuide(true);
  const say = (text, explicit) => {
    const plan = explicit || interpretCreation(text, world);
    const result = executeCreation(world, plan, text);
    guide = advanceGuide(guide, { kind: 'creation', changed: result.changed, before: world, after: result.state, operations: plan.operations });
    world = result.state;
    return result;
  };
  return { say, world: () => world, guide: () => guide, event: event => { guide = advanceGuide(guide, event); } };
}

test('guide advances only through real creation, editing, targeted undo, embodiment and successful saving', () => {
  const session = fixture();
  session.say('在前方创造一只海龟，然后让它跟随我');
  const id = session.guide().targetId;
  assert.equal(session.guide().step, 'edit');
  assert.equal(session.world().entities.find(entity => entity.id === id).following, true);
  session.say('让它变成金色');
  assert.equal(session.guide().step, 'undo');
  session.say('撤销它的上一步修改', { operations: [operation('undo', { target: id })], issues: [] });
  assert.equal(session.guide().step, 'inhabit');
  assert.equal(session.world().entities.find(entity => entity.id === id).following, true);
  session.event({ kind: 'inhabit', id: 'form-04' });
  assert.equal(session.guide().step, 'inhabit');
  session.event({ kind: 'inhabit', id });
  assert.equal(session.guide().step, 'save');
  session.event({ kind: 'saved', entityIds: ['form-04'] });
  assert.equal(session.guide().step, 'save');
  session.event({ kind: 'saved', entityIds: session.world().entities.map(entity => entity.id) });
  assert.equal(session.guide().step, 'complete');
});

test('unsupported input, existing creatures, mere previews and early saves cannot fake guide progress', () => {
  const session = fixture();
  session.say('创造一条火龙');
  session.say('让鲸鱼变成金色');
  session.event({ kind: 'inhabit', id: 'form-04' });
  session.event({ kind: 'saved', entityIds: ['form-04'] });
  assert.equal(session.guide().step, 'create');
  session.say('创造一座神殿');
  assert.equal(session.guide().step, 'create');
});

test('color edits and undo on other objects never advance the tracked creature', () => {
  const session = fixture();
  session.say('创造一只海龟');
  session.say('让鲸鱼变成金色');
  assert.equal(session.guide().step, 'edit');
  session.say('让海龟变成金色');
  session.say('让鲸鱼变成珍珠色');
  session.say('撤销上一步');
  assert.equal(session.guide().step, 'undo');
  session.say('让海龟变成蓝色');
  assert.equal(session.guide().step, 'undo');
});

test('deleting a tracked creature resets only the guide, not the world or other creations', () => {
  const session = fixture();
  session.say('创造一只海龟');
  const count = session.world().entities.length;
  session.say('删除海龟');
  assert.equal(session.guide().step, 'create');
  assert.equal(session.world().entities.length, count - 1);
  assert.match(session.guide().notice, /其他内容会保留/);
});

test('inactive guides do not collect activity and completed guides do not reset on ordinary actions', () => {
  const inactive = initialGuide();
  assert.equal(advanceGuide(inactive, { kind: 'saved', entityIds: [] }), inactive);
  const complete = { ...initialGuide(true), step: 'complete' };
  assert.equal(advanceGuide(complete, { kind: 'creation', changed: true }), complete);
});

test('guide wording distinguishes filling, actual clicking, local persistence and returning from embodiment', () => {
  assert.match(guideCopy(initialGuide(true)).detail, /发送后/);
  assert.equal(guideCopy({ step: 'edit' }, { color: 'gold' }).action, '填写珍珠色示例');
  assert.match(guideCopy({ step: 'inhabit' }).detail, /直接点击画面/);
  assert.match(guideCopy({ step: 'save' }, { embodied: true }).action, /返回/);
  assert.match(guideCopy({ step: 'save' }).detail, /当前浏览器/);
});
