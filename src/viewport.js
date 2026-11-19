export function keyboardViewport({ height, visualHeight, offsetTop = 0, scale = 1, editing = false }) {
  const keyboard = editing && scale < 1.05 && height - visualHeight > 100;
  return { keyboard, bottom: keyboard ? Math.max(0, height - visualHeight - offsetTop) : 0, height: keyboard ? visualHeight : height };
}

export function setupViewport({ closePanels, toast }) {
  const root = document.documentElement;
  const compact = matchMedia('(max-width: 1100px), (max-height: 600px)');
  const content = document.querySelector('#tools-content');
  const movable = ['.world-tools', '.site-play', '.ai-view-button', '.composer-topline', '.capture-tools'].map(selector => {
    const element = document.querySelector(selector);
    const marker = document.createTextNode(''); element.before(marker);
    return { element, marker };
  });
  const adapt = () => {
    closePanels();
    document.body.classList.toggle('compact-ui', compact.matches);
    for (const { element, marker } of movable) if (compact.matches) content.append(element); else marker.after(element);
  };
  compact.addEventListener('change', adapt); adapt();
  let frame = 0;
  const measure = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const visual = window.visualViewport;
      const layout = keyboardViewport({ height: innerHeight, visualHeight: visual?.height || innerHeight, offsetTop: visual?.offsetTop || 0, scale: visual?.scale || 1, editing: document.activeElement?.matches('textarea, input:not([type="range"]):not([type="checkbox"])') });
      document.body.classList.toggle('keyboard-open', layout.keyboard);
      root.style.setProperty('--keyboard-bottom', `${layout.bottom}px`);
      root.style.setProperty('--visible-height', `${layout.height}px`);
    });
  };
  window.addEventListener('resize', measure);
  window.visualViewport?.addEventListener('resize', measure);
  window.visualViewport?.addEventListener('scroll', measure);
  document.addEventListener('focusin', measure); document.addEventListener('focusout', measure); measure();
  const fullscreenButton = document.querySelector('#fullscreen-button');
  const immersiveButton = document.querySelector('#immersive-button');
  const exitButton = document.querySelector('#exit-immersive');
  let nativeSession = false;
  const setImmersive = enabled => {
    document.body.classList.toggle('immersive', enabled); exitButton.hidden = !enabled;
    immersiveButton.setAttribute('aria-pressed', String(enabled));
    (enabled ? exitButton : immersiveButton).focus({ preventScroll: true });
  };
  const exit = async () => {
    setImmersive(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  };
  const enter = async () => {
    closePanels(); document.activeElement?.blur(); setImmersive(true);
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
    try {
      if (!root.requestFullscreen || !document.fullscreenEnabled) throw new Error('unavailable');
      await root.requestFullscreen(); nativeSession = true;
    } catch { toast('已进入纯净观景。若浏览器不支持网页全屏，可在 Safari 分享菜单中“添加到主屏幕”，再从主屏幕打开。'); }
  };
  immersiveButton.addEventListener('click', enter);
  fullscreenButton.addEventListener('click', () => document.fullscreenElement ? exit() : enter());
  exitButton.addEventListener('click', exit);
  document.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement ? '退出全屏' : '全屏观看';
    if (!document.fullscreenElement && nativeSession) { nativeSession = false; setImmersive(false); }
    measure();
  });
  return { exit };
}
