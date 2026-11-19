import './boot.css';

import('./main.js').catch(() => {
  let shell = document.querySelector('#boot-shell');
  if (!shell) {
    shell = document.createElement('section'); shell.id = 'boot-shell'; shell.setAttribute('role', 'alert');
    shell.append(document.createElement('h1'), document.createElement('p'), document.createElement('button'));
    shell.querySelector('button').textContent = '重新载入';
    shell.querySelector('button').addEventListener('click', () => location.reload());
    document.querySelector('#app').replaceChildren(shell);
  }
  shell.querySelector('h1').textContent = '海流还没有抵达这里';
  shell.querySelector('p').textContent = '界面资源未能加载。请检查网络后重试，已有的本机存档不会删除。';
  shell.querySelector('button').hidden = false;
});

document.querySelector('#boot-retry')?.addEventListener('click', () => location.reload());
