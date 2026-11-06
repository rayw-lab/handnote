import { createNote, REC } from 'handnote';

const PRESETS = {
  physics: `# 牛顿第二定律
合力决定加速度：$F=ma$
加速度的方向，和合力的方向相同。

质量不变时，力越大，加速度越大；
力不变时，质量越大，越难加速。
所以也可以写成：$a=\\dfrac{F}{m}$

注意：F 是合力，不是某一个力。`,
  math: `# 一元二次方程
$ax^2+bx+c=0\\ (a\\ne0)$
配方之后开平方，得到求根公式：
$x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$

判别式 $\\Delta=b^2-4ac$ 决定根的个数：
大于零，两个不等实根；
等于零，两个相等实根；
小于零，没有实数根。`,
  reading: `# 费曼学习法
一、选一个概念，写在纸的最上面。
二、假装讲给一个外行听，用最简单的话。
三、讲不下去的地方，就是还没懂的地方，回去再看书。
四、去掉术语，换成例子和类比。

学东西最快的办法，是试着把它教给别人。`,
  english: `# Handwriting, by code
Every stroke is drawn on the fly,
so no two letters look the same.

Math works too: $E=mc^2$
and fractions: $\\dfrac{1}{2}mv^2$

同一页里，中文和 English 可以混着写。`,
};

const INKS = [
  ['blue', '靛蓝', '#1f3f9a'], ['navy', '藏青', '#22305c'], ['black', '墨黑', '#26262b'],
  ['brown', '赭石', '#7a4a12'], ['green', '墨绿', '#1d6a3a'], ['red', '朱红', '#c8352b'],
];
const FORMATS = { portrait: [1080, 1440], square: [1440, 1440], wide: [1600, 900] };
const RED = '#c8352b', NAVY = '#22305c';

const $ = (id) => document.getElementById(id);
const S = { seed: 1, preset: 'physics', ink: 'blue', size: 52, pen: 'gel', paper: 'lined', format: 'portrait' };
let svgText = '', job = 0, stopAnim = null, debounce = 0;

/* ---------- state <-> URL ---------- */
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  for (const k of ['preset', 'ink', 'pen', 'paper', 'format']) if (q.get(k)) S[k] = q.get(k);
  if (q.get('seed')) S.seed = Math.max(1, Number(q.get('seed')) || 1);
  if (q.get('size')) S.size = Number(q.get('size')) || 52;
  $('text').value = q.get('t') ?? PRESETS[S.preset] ?? PRESETS.physics;
}
function shareUrl() {
  const q = new URLSearchParams({ seed: S.seed, ink: S.ink, size: S.size, pen: S.pen, paper: S.paper, format: S.format, t: $('text').value });
  return location.href.split('#')[0] + '#' + q.toString();
}

/* ---------- controls ---------- */
function syncControls() {
  document.querySelectorAll('.presets button').forEach((b) => b.classList.toggle('on', b.dataset.preset === S.preset && $('text').value === PRESETS[S.preset]));
  document.querySelectorAll('.seg').forEach((g) => g.querySelectorAll('button').forEach((b) => {
    const on = S[g.dataset.name] === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
  }));
  document.querySelectorAll('#ink button').forEach((b) => { const on = b.dataset.v === S.ink; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('size').value = S.size; $('size-out').textContent = S.size; $('seed-no').textContent = S.seed;
}
function buildSwatches() {
  $('ink').innerHTML = INKS.map(([k, name, c]) => `<button type="button" role="radio" data-v="${k}" title="${name}" aria-label="${name}" style="--c:${c}"></button>`).join('');
}

/* ---------- render ---------- */
async function build(text) {
  // shrink the text until it fits the page (a 16:9 page holds far fewer lines than 3:4)
  let size = S.size, out;
  for (let i = 0; i < 5; i++) {
    out = await buildAt(text, size);
    if (out.fits || size <= 26) break;
    size = Math.max(26, Math.floor(size * Math.min(0.92, Math.sqrt(out.room)) / 2) * 2);
  }
  out.size = size;
  return out;
}

async function buildAt(text, size) {
  const [W, H] = FORMATS[S.format] || FORMATS.portrait;
  const gap = Math.round(size * 1.73), top = Math.round(gap * 1.9);
  const paper = S.paper === 'lined' ? { top, gap } : { top, gap, color: 'transparent' };
  const ink = (INKS.find((i) => i[0] === S.ink) || INKS[0])[2];
  const note = createNote({ seed: S.seed, width: W, height: H, paper, pen: S.pen });
  REC.items = []; REC.on = true; REC.live = true;
  let r;
  try {
    r = await note.write(text, { x: Math.round(W * .065), right: W - Math.round(W * .065), size, top, gap, color: ink, titleColor: S.ink === 'red' ? NAVY : RED });
  } finally { REC.on = false; }
  const used = top + gap * (r.line - 1), avail = H - gap * 0.6;
  return { svg: note.toSVG(), items: REC.items.slice(), skipped: r.skipped, fits: used <= avail, room: (avail - top) / Math.max(1, used - top) };
}

async function render({ animate = $('animate').checked } = {}) {
  const my = ++job;
  stopAnim?.();
  const text = $('text').value;
  $('message').textContent = '';
  try {
    const out = await build(text);
    if (my !== job) return;
    svgText = out.svg;
    const paper = $('paper');
    paper.className = 'paper ' + (S.format === 'portrait' ? '' : S.format);
    paper.innerHTML = out.svg;
    $('loading').hidden = true;
    const notes = [];
    if (out.size < S.size) notes.push(`内容比较多，字号自动缩到 ${out.size}`);
    if (out.skipped.length) notes.push(`这些字暂时写不了，已跳过：${out.skipped.join(' ')}`);
    $('message').textContent = notes.join('。');
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) stopAnim = writeOn(paper.querySelector('svg'), out.items);
  } catch (e) {
    if (my !== job) return;
    $('loading').hidden = true;
    $('message').textContent = /TeX|公式/.test(e.message) ? '有个公式写不出来，检查一下 $…$ 里的写法。' : '出错了：' + e.message;
  }
}

/* Reveal every recorded stroke in writing order: ink is unmasked along its centre line,
   highlighter sweeps left to right. Click the paper to skip to the end. */
function writeOn(svg, items) {
  if (!svg || !items.length) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
  const byD = new Map();
  for (const el of svg.querySelectorAll('path')) { const d = el.getAttribute('d'); if (!byD.has(d)) byD.set(d, []); byD.get(d).push(el); }
  const len = (p) => p.reduce((s, q, i) => s + (i ? Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
  const tracks = [];
  items.forEach((it, i) => {
    const el = (byD.get(it.d) || []).shift();
    if (!el) return;
    const t = { el, kind: it.kind };
    if (it.kind === 'ink') {
      t.L = Math.max(1, len(it.pts));
      const m = document.createElementNS(NS, 'mask'); m.id = 'w' + i; m.setAttribute('maskUnits', 'userSpaceOnUse');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + it.pts.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L'));
      for (const [k, v] of Object.entries({ fill: 'none', stroke: '#fff', 'stroke-width': Math.max(6, it.width * 3.2), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': `${t.L} ${t.L + 50}`, 'stroke-dashoffset': t.L })) p.setAttribute(k, v);
      m.appendChild(p); defs.appendChild(m); t.mp = p; el.setAttribute('mask', `url(#${m.id})`);
      t.dur = 0.04 + t.L / 1400; t.from = it.pts[0]; t.to = it.pts[it.pts.length - 1];
    } else {
      const c = document.createElementNS(NS, 'clipPath'); c.id = 'w' + i;
      const r = document.createElementNS(NS, 'rect');
      for (const [k, v] of Object.entries({ x: it.x0, y: it.y0, width: 0, height: it.y1 - it.y0 })) r.setAttribute(k, v);
      c.appendChild(r); defs.appendChild(c); t.rect = r; t.w = it.x1 - it.x0; el.setAttribute('clip-path', `url(#${c.id})`);
      t.dur = 0.35; t.from = [it.x0, it.y0]; t.to = [it.x1, it.y0];
    }
    tracks.push(t);
  });
  // timeline: pen lifts take a moment longer when the next stroke starts far away
  let T = 0, prev = null;
  for (const t of tracks) { const far = prev && Math.hypot(t.from[0] - prev[0], t.from[1] - prev[1]) > 60; T += far ? 0.06 : 0.015; t.start = T; T += t.dur; prev = t.to; }
  const k = T > 7 ? 7 / T : 1;
  for (const t of tracks) { t.start *= k; t.dur *= k; }
  const set = (t, p) => {
    if (t.kind === 'ink') t.mp.setAttribute('stroke-dashoffset', (t.L * (1 - p)).toFixed(1));
    else t.rect.setAttribute('width', (t.w * p).toFixed(1));
  };
  const finish = () => { for (const t of tracks) { t.el.removeAttribute('mask'); t.el.removeAttribute('clip-path'); } defs.querySelectorAll('mask[id^=w],clipPath[id^=w]').forEach((n) => n.remove()); };
  let raf = 0, t0 = performance.now(), done = 0;
  const tick = (now) => {
    const s = (now - t0) / 1000;
    while (done < tracks.length && s >= tracks[done].start + tracks[done].dur) {
      const t = tracks[done++]; t.el.removeAttribute(t.kind === 'ink' ? 'mask' : 'clip-path');
    }
    for (let i = done; i < tracks.length && tracks[i].start <= s; i++) set(tracks[i], Math.min(1, (s - tracks[i].start) / tracks[i].dur));
    if (done < tracks.length) raf = requestAnimationFrame(tick); else finish();
  };
  raf = requestAnimationFrame(tick);
  const skip = () => { cancelAnimationFrame(raf); finish(); svg.removeEventListener('click', skip); };
  svg.addEventListener('click', skip);
  return skip;
}

/* ---------- downloads ---------- */
function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function toPng() {
  stopAnim?.();
  const svg = $('paper').querySelector('svg'); if (!svg) return;
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
  await img.decode();
  const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  c.toBlob((b) => b && download(`handnote-${S.seed}.png`, b), 'image/png');
}

/* ---------- wiring ---------- */
function later() { clearTimeout(debounce); debounce = setTimeout(() => render({ animate: false }), 350); }
function init() {
  buildSwatches(); readHash(); syncControls();
  document.querySelector('.presets').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.preset = b.dataset.preset; $('text').value = PRESETS[S.preset]; syncControls(); render();
  });
  $('ink').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.ink = b.dataset.v; syncControls(); render({ animate: false }); });
  document.querySelectorAll('.seg').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; S[g.dataset.name] = b.dataset.v; syncControls(); render({ animate: false });
  }));
  $('size').addEventListener('input', () => { S.size = +$('size').value; $('size-out').textContent = S.size; later(); });
  $('text').addEventListener('input', () => { syncControls(); later(); });
  $('rewrite').addEventListener('click', () => { S.seed += 1; syncControls(); render({ animate: $('animate').checked }); });
  $('dl-png').addEventListener('click', toPng);
  $('dl-svg').addEventListener('click', () => { stopAnim?.(); download(`handnote-${S.seed}.svg`, new Blob([$('paper').querySelector('svg')?.outerHTML || svgText], { type: 'image/svg+xml' })); });
  $('share').addEventListener('click', async () => {
    const url = shareUrl(); history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); $('message').textContent = '链接已复制，打开就是这一页、这一遍的笔迹。'; }
    catch { $('message').textContent = '复制失败，地址栏里的链接就是这一页。'; }
  });
  render({ animate: true });
}
init();
