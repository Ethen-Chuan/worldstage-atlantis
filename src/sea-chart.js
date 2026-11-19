import { ATLAS_SITES } from './landmarks.js';
import { seaHeight } from './terrain.js';
import { chartView, projectChart, unprojectChart, fitChart, chartScale, planarDistance, formatDistance } from './chart-math.js';
import './sea-chart.css';

const glyphs = {
  'sunset-surface': '<path d="M2 20c3-3 4 3 7 0s4 3 7 0 4 2 6 0M3 14c3-6 9-9 14-5l4-1-2 3 2 3-5-1c-3-4-6-3-9 0l-4 1ZM12 8l1-4 3 4"/>',
  'reef-closeup': '<path d="M12 22V4m0 10L5 9V5m7 13 7-7V7M5 9 2 7m17 4 3-2M12 8l4-3"/>',
  'ancient-closeup': '<path d="M2 12c5-7 11-6 16-1l4-4v10l-4-4c-7 5-12 5-16-1Zm5-3v6m4-7v8m4-6v4"/>',
  crown: '<path d="m3 10 9-7 9 7H3Zm2 2v7m4-7v7m6-7v7m4-7v7M3 21h18M2 23h20M12 5v3"/>',
  palace: '<path d="M3 10 12 4l9 6M5 10h14M6 11v8m6-8v8m6-8v8M3 20h18"/>',
  gate: '<path d="M5 20V10a7 7 0 0 1 14 0v10M8 20V10a4 4 0 0 1 8 0v10M3 20h7m4 0h7M12 6v3"/>',
  garden: '<path d="M3 12c4-4 9-4 13-1l5-4-1 5 1 5-5-3c-5 3-10 1-13-2ZM7 11v3m4-3v4m4-4v3"/>',
  choir: '<path d="m12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3 2-7Z"/><circle cx="12" cy="12" r="2"/>',
  vortex: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="4"/><path d="m8 3 1 2m7 14 1 2"/>',
  prism: '<path d="M12 21V8m0 7L6 9l-3 1m9 1 5-5V3M6 9V4m6 14 6-4 3 1M18 14l1-5M12 8 9 4"/>',
  vents: '<path d="m4 21 2-6h3l1 6m4 0 1-9h3l3 9M7 12c-4-4 4-5 1-9m9 6c-3-3 3-4 1-7"/>',
};
export const landmarkIcon = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[id] || glyphs.choir}</svg>`;
const options = ATLAS_SITES.map(landmark => `<option value="${landmark.id}">${landmark.name}</option>`).join('');
const viewport = id => `<div id="${id}" class="chart-viewport" aria-label="海域航图"><svg class="chart-lines" aria-hidden="true"><g class="chart-contours"></g><path class="chart-route"/><path class="chart-measure"/></svg><span class="chart-north" aria-hidden="true">N<i></i></span><div class="chart-player" aria-label="你的位置"><span></span></div><div class="chart-markers">${ATLAS_SITES.map(landmark => `<button type="button" class="chart-marker" data-site="${landmark.id}" aria-label="查看${landmark.name}" title="${landmark.name}">${landmarkIcon(landmark.id)}<span>${landmark.name}</span><i></i></button>`).join('')}</div><div class="chart-scale"><i></i><span></span></div></div>`;

export function seaChartMarkup() {
  return `<section class="mini-chart" aria-label="小地图"><button id="chart-button" class="chart-opener" aria-controls="chart-panel" aria-expanded="false"><span>${landmarkIcon('choir')}<b>海域航图</b></span><small>M <i>↗</i></small></button>${viewport('mini-viewport')}<div class="mini-reading"><span id="mini-heading">000° · 北</span><span id="mini-destination">每片海域，都可独立抵达</span></div></section>
  <aside id="chart-panel" class="drawer sea-atlas" aria-label="海域航图" hidden><header class="chart-header"><div><span class="eyebrow">CARTOGRAPHY OF THE LOST WORLD</span><h2>海流之下，万象有迹。</h2></div><button id="close-chart" class="icon-button" aria-label="收起海域航图">×</button></header><div class="chart-workspace"><div class="chart-map-area"><div class="chart-toolbar" role="group" aria-label="航图控制"><button id="chart-fit">全海域</button><button id="chart-follow" aria-pressed="false">跟随我</button><button id="chart-orient" aria-pressed="false">北向上</button><span></span><button id="chart-out" aria-label="缩小航图">−</button><button id="chart-in" aria-label="放大航图">＋</button></div>${viewport('atlas-viewport')}<div class="chart-footnote"><span>拖动平移 · 滚轮缩放 · 点选地标</span><span id="chart-discoveries"></span></div></div><section class="chart-detail" aria-label="目的地与测距"><div class="chart-site-icon" id="chart-site-icon"></div><span id="chart-kind" class="eyebrow"></span><h3 id="chart-name"></h3><p id="chart-caption"></p><div class="chart-distance"><strong id="chart-distance"></strong><span>距你 · 水平直线距离</span></div><div class="chart-travel"><button id="chart-sail" class="primary-button">沿途航行 ↗</button><button id="chart-jump">快速抵达</button></div><p id="chart-navigation-note">路线通向观景点，不会改变你的造物。</p><div class="chart-ruler"><label for="chart-from">两地测距</label><div><select id="chart-from" aria-label="测距起点">${options}</select><span>至</span><select id="chart-to" aria-label="测距终点">${options}</select></div><output id="chart-pair-distance"></output><small>按地标中心计算 · 不代表避障路线</small></div><button id="chart-guide" class="text-button">查看地标手册 →</button></section></div><p id="chart-announcement" class="sr-only" role="status"></p></aside>`;
}

function contourPaths() {
  const paths = [];
  for (const level of [-24, -16, -8, 0, 8, 16]) {
    let path = '';
    for (let depth = -2400; depth < 1200; depth += 65) for (let horizontal = -2300; horizontal < 2400; horizontal += 65) {
      const corners = [[horizontal, depth], [horizontal + 65, depth], [horizontal + 65, depth + 65], [horizontal, depth + 65]];
      const heights = corners.map(point => seaHeight(...point));
      const intersections = [];
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4;
        if ((heights[edge] < level) === (heights[next] < level)) continue;
        const fraction = (level - heights[edge]) / (heights[next] - heights[edge]);
        intersections.push(corners[edge].map((value, index) => value + (corners[next][index] - value) * fraction));
      }
      for (let index = 0; index + 1 < intersections.length; index += 2) path += `M${intersections[index].map(value => value.toFixed(1)).join(',')}L${intersections[index + 1].map(value => value.toFixed(1)).join(',')}`;
    }
    paths.push(`<path d="${path}"/>`);
  }
  return paths.join('');
}

export class SeaChart {
  constructor({ navigate, open, guide }) {
    this.navigate = navigate; this.open = open;
    this.selected = 'vortex'; this.follow = false; this.headingUp = false; this.snapshot = null; this.view = null; this.lastHeading = 0;
    this.compact = document.querySelector('#mini-viewport'); this.atlas = document.querySelector('#atlas-viewport');
    const contours = contourPaths();
    for (const viewport of [this.compact, this.atlas]) {
      viewport.querySelector('.chart-contours').innerHTML = contours;
      viewport.querySelectorAll('[data-site]').forEach(button => button.addEventListener('click', () => { this.select(button.dataset.site); if (viewport === this.compact) this.open(); }));
    }
    document.querySelector('#chart-guide').addEventListener('click', guide);
    document.querySelector('#chart-fit').addEventListener('click', () => { this.follow = false; this.view = null; this.render(); });
    document.querySelector('#chart-follow').addEventListener('click', () => { this.follow = !this.follow; this.render(); });
    document.querySelector('#chart-orient').addEventListener('click', () => { this.headingUp = !this.headingUp; this.render(); });
    document.querySelector('#chart-in').addEventListener('click', () => this.zoom(0.75));
    document.querySelector('#chart-out').addEventListener('click', () => this.zoom(1.33));
    for (const mode of ['sail', 'jump']) document.querySelector(`#chart-${mode}`).addEventListener('click', () => this.navigate(this.selected, mode === 'sail' ? 'sail' : 'quick'));
    document.querySelector('#chart-from').value = 'palace'; document.querySelector('#chart-to').value = 'vortex';
    for (const id of ['chart-from', 'chart-to']) document.querySelector(`#${id}`).addEventListener('change', () => this.render());
    this.atlas.addEventListener('wheel', event => { event.preventDefault(); this.zoom(event.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
    this.atlas.addEventListener('pointerdown', event => {
      if (event.target.closest('button') || !this.view) return;
      this.drag = { x: event.clientX, y: event.clientY, view: { ...this.view, center: [...this.view.center] } };
      this.atlas.setPointerCapture(event.pointerId); this.atlas.classList.add('dragging');
    });
    this.atlas.addEventListener('pointermove', event => {
      if (!this.drag) return;
      const start = unprojectChart({ x: this.drag.view.width / 2, y: this.drag.view.height / 2 }, this.drag.view);
      const end = unprojectChart({ x: this.drag.view.width / 2 + event.clientX - this.drag.x, y: this.drag.view.height / 2 + event.clientY - this.drag.y }, this.drag.view);
      this.follow = false; this.view.center = start.map((value, index) => value - end[index] + this.drag.view.center[index]); this.render();
    });
    const endDrag = () => { this.drag = null; this.atlas.classList.remove('dragging'); };
    this.atlas.addEventListener('pointerup', endDrag); this.atlas.addEventListener('pointercancel', endDrag);
    this.observer = new ResizeObserver(() => this.render()); this.observer.observe(this.atlas); this.observer.observe(this.compact);
    this.select(this.selected);
  }

  select(id) {
    const landmark = ATLAS_SITES.find(item => item.id === id); if (!landmark) return;
    this.selected = id;
    document.querySelector('#chart-name').textContent = landmark.name;
    document.querySelector('#chart-caption').textContent = landmark.caption;
    document.querySelector('#chart-site-icon').innerHTML = landmarkIcon(id);
    document.querySelector('#chart-kind').textContent = `${landmark.number} / ${landmark.category || (landmark.wonder ? '动态奇观' : '失落遗迹')}`;
    document.querySelector('#chart-to').value = id;
    document.querySelector('#chart-announcement').textContent = `已选中${landmark.name}。可选择沿途航行或快速抵达。`;
    this.render();
  }

  zoom(factor) { if (!this.view) return; this.view.span = Math.max(350, Math.min(80000, this.view.span * factor)); this.render(); }
  update(snapshot) { this.snapshot = snapshot; this.render(); }

  renderViewport(viewport, view, compact) {
    const { position, bearing, visited } = this.snapshot;
    const origin = projectChart([0, 0, 0], view);
    viewport.querySelector('.chart-contours').setAttribute('transform', `translate(${origin.x} ${origin.y}) rotate(${-view.bearing}) scale(${view.scale})`);
    const player = projectChart(position, view, 14);
    const marker = viewport.querySelector('.chart-player'); marker.style.transform = `translate(${player.x}px, ${player.y}px) rotate(${bearing - view.bearing}deg)`; marker.classList.toggle('off-chart', player.edge);
    viewport.querySelector('.chart-north').style.transform = `rotate(${-view.bearing}deg)`;
    for (const landmark of ATLAS_SITES) {
      const point = projectChart(landmark.center, view, compact ? 16 : 38);
      const button = viewport.querySelector(`[data-site="${landmark.id}"]`);
      button.style.left = `${point.x}px`; button.style.top = `${point.y}px`;
      button.classList.toggle('at-edge', point.edge); button.classList.toggle('is-visited', visited.includes(landmark.id));
      button.setAttribute('aria-pressed', String(landmark.id === this.selected));
      button.setAttribute('aria-label', `${landmark.name}，距你 ${formatDistance(planarDistance(position, landmark.center))}${point.edge ? '，在图外' : ''}`);
    }
    const destination = ATLAS_SITES.find(landmark => landmark.id === this.selected);
    const target = projectChart(destination.center, view);
    const actualPlayer = projectChart(position, view);
    viewport.querySelector('.chart-route').setAttribute('d', `M${actualPlayer.x},${actualPlayer.y}L${target.x},${target.y}`);
    const start = ATLAS_SITES.find(landmark => landmark.id === document.querySelector('#chart-from').value);
    const end = ATLAS_SITES.find(landmark => landmark.id === document.querySelector('#chart-to').value);
    const first = projectChart(start.center, view); const second = projectChart(end.center, view);
    viewport.querySelector('.chart-measure').setAttribute('d', compact ? '' : `M${first.x},${first.y}L${second.x},${second.y}`);
    const scale = chartScale(view);
    viewport.querySelector('.chart-scale i').style.width = `${scale.pixels}px`; viewport.querySelector('.chart-scale span').textContent = formatDistance(scale.meters);
  }

  render() {
    if (!this.snapshot) return;
    const { position, bearing, visited } = this.snapshot;
    const destination = ATLAS_SITES.find(landmark => landmark.id === this.selected);
    const distance = formatDistance(planarDistance(position, destination.center));
    document.querySelector('#mini-heading').textContent = `${String(Math.round(bearing) % 360).padStart(3, '0')}°`;
    document.querySelector('#mini-destination').textContent = `${destination.name} · ${distance}`;
    if (this.compact.clientWidth) this.renderViewport(this.compact, chartView(position, 2500, this.compact.clientWidth, this.compact.clientHeight, this.headingUp ? bearing : 0), true);
    if (!this.atlas.clientWidth) return;
    this.view ||= fitChart(position, this.atlas.clientWidth, this.atlas.clientHeight);
    if (this.follow) this.view.center = [...position];
    this.view = chartView(this.view.center, this.view.span, this.atlas.clientWidth, this.atlas.clientHeight, this.headingUp ? bearing : 0);
    this.renderViewport(this.atlas, this.view, false);
    document.querySelector('#chart-distance').textContent = distance;
    document.querySelector('#chart-discoveries').textContent = `${visited.length} / ${ATLAS_SITES.length} 已抵达`;
    document.querySelector('#chart-follow').setAttribute('aria-pressed', String(this.follow));
    document.querySelector('#chart-orient').setAttribute('aria-pressed', String(this.headingUp));
    document.querySelector('#chart-orient').textContent = this.headingUp ? '朝向上' : '北向上';
    const start = ATLAS_SITES.find(landmark => landmark.id === document.querySelector('#chart-from').value);
    const end = ATLAS_SITES.find(landmark => landmark.id === document.querySelector('#chart-to').value);
    document.querySelector('#chart-pair-distance').textContent = formatDistance(planarDistance(start.center, end.center));
  }

  inspect() { return { selected: this.selected, follow: this.follow, headingUp: this.headingUp, center: this.view?.center, span: this.view?.span }; }
}
