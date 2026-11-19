import { LIVING_ASSETS } from './creation.js';

export const GUIDE_STEPS = ['create', 'edit', 'undo', 'inhabit', 'save'];

export function initialGuide(active = false) {
  return { active, step: 'create', targetId: null, originalColor: null, editedColor: null, notice: '' };
}

export function advanceGuide(guide, event) {
  if (!guide.active || guide.step === 'complete') return guide;
  if (event.kind === 'creation' && event.changed) {
    const target = event.after.entities.find(entity => entity.id === guide.targetId);
    if (guide.targetId && !target) return { ...initialGuide(true), notice: '刚才的伙伴已离开。可以重新创造，世界中的其他内容会保留。' };
    if (guide.step === 'create') {
      const created = event.after.entities.find(entity => LIVING_ASSETS.includes(entity.asset) && !event.before.entities.some(previous => previous.id === entity.id));
      if (created) return { ...guide, step: 'edit', targetId: created.id, notice: '' };
    }
    const previous = event.before.entities.find(entity => entity.id === guide.targetId);
    if (guide.step === 'edit' && target && previous && target.params.color !== previous.params.color && event.operations.some(action => action.kind === 'modify' && action.property === 'color')) {
      return { ...guide, step: 'undo', originalColor: previous.params.color, editedColor: target.params.color, notice: '' };
    }
    if (guide.step === 'undo' && target && previous?.params.color === guide.editedColor && target.params.color === guide.originalColor && event.operations.some(action => action.kind === 'undo')) {
      return { ...guide, step: 'inhabit', notice: '' };
    }
  }
  if (guide.step === 'inhabit' && event.kind === 'inhabit' && event.id === guide.targetId) return { ...guide, step: 'save' };
  if (guide.step === 'save' && event.kind === 'saved' && event.entityIds.includes(guide.targetId)) return { ...guide, step: 'complete' };
  return guide;
}

export function guideCopy(guide, { name = '伙伴', embodied = false, color = 'teal' } = {}) {
  const content = {
    create: ['让一句话变成生命', '先填写示例，也可以改成自己的想法。发送后，它才会出现在海里。', '填写造物示例'],
    edit: [`给${name}一种新颜色`, '继续修改同一个生命，而不是再生成一个。示例只填入，不会自动执行。', color === 'gold' ? '填写珍珠色示例' : '填写金色示例'],
    undo: ['创作，也可以反悔', '撤销刚才的改色。伙伴与已经建立的关系都会保留。', '撤销这次改色'],
    inhabit: ['这次，用它的眼睛看海', `靠近${name}，直接点击画面里的它。无需选择视角或再次确认。`, '靠近我的伙伴'],
    save: ['让这个世界等你回来', embodied ? 'WASD 或触屏方向键游动。体验后返回，再亲手保存。' : '保存到当前浏览器，不上传文字。下次从“此刻的造物”中继续。', embodied ? '返回，再保存世界' : '保存我的世界'],
    complete: ['你已经成为这个世界的创造者', '创造、修改、撤销、化身、保存，都由你亲手完成。现在去看看远方。', '继续自由探索'],
  };
  const [title, detail, action] = content[guide.step];
  return { title, detail: guide.notice || detail, action, progress: guide.step === 'complete' ? 5 : GUIDE_STEPS.indexOf(guide.step) + 1 };
}
