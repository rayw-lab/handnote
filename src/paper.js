// 纸面与"画"的部分：横线纸、荧光笔、手画线 / 圆 / 箭头（都走同一支笔，带手抖）
import { inkPath, PENS, REC } from './pen.js';

export function linedPaper({ w = 1080, h = 1440, top = 150, gap = 76, color = '#d9d3c3', bg = '#fbf8ee' } = {}) {
  let s = `<rect width="${w}" height="${h}" fill="${bg}"/>`;
  for (let y = top; y < h; y += gap) s += `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="1.6"/>`;
  return s;
}

// 荧光笔：一笔扫过去，两头略斜、边缘轻微起伏；用 multiply 叠在字下面
export function highlighter(x0, x1, yc, h, color, rng, opacity = 0.62) {
  const n = 18, top = [], bot = [];
  const tilt = rng.gauss() * h * 0.06, wob = rng.smooth(3), wob2 = rng.smooth(3);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, dy = tilt * (t - 0.5);
    top.push([x, yc - h / 2 + dy + wob(t) * h * 0.035]);
    bot.push([x, yc + h / 2 + dy + wob2(t) * h * 0.035]);
  }
  const capL = h * 0.12, capR = h * 0.18;
  const pts = [[x0 - capL, yc - h * 0.38], ...top, [x1 + capR, yc - h * 0.3], [x1 + capR * 0.6, yc + h * 0.42], ...bot.reverse(), [x0 - capL * 0.4, yc + h * 0.44]];
  const d = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z';
  if (REC.on) REC.items.push({ kind: 'hl', d, x0: x0 - capL, x1: x1 + capR, y0: yc - h, y1: yc + h, live: REC.live });
  return `<path d="${d}" fill="${color}" opacity="${opacity}" style="mix-blend-mode:multiply"/>`;
}

// 手画折线 / 曲线：pts 是 px 点，自动加细小抖动
export function handStroke(pts, { width = 3, color = '#22305c', rng, pen = PENS.gel, jitter = 1.2 }) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.ceil(L / 8));
    for (let j = 0; j < n; j++) dense.push([a[0] + (b[0] - a[0]) * (j / n), a[1] + (b[1] - a[1]) * (j / n)]);
  }
  dense.push(pts[pts.length - 1]);
  const w1 = rng.smooth(4), w2 = rng.smooth(4);
  const out = dense.map(([x, y], i) => { const t = i / (dense.length - 1); return [x + w1(t) * jitter, y + w2(t) * jitter]; });
  return `<path fill="${color}" d="${inkPath(out, width, rng, pen)}"/>`;
}

export function handCircle(cx, cy, r, o) {
  const { rng } = o, start = rng.next() * Math.PI * 2, over = 0.25 + rng.next() * 0.25, rr = rng.smooth(4);
  const n = 48, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = start + t * (Math.PI * 2 + over);
    const k = 1 + rr(t) * 0.025 + (t > 0.9 ? (t - 0.9) * 0.4 : 0);
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.97]);
  }
  return handStroke(pts, { ...o, jitter: 0.6 });
}

export function handArrow(x0, y0, x1, y1, o) {
  const a = Math.atan2(y1 - y0, x1 - x0), L = o.head ?? 16, sp = 0.45;
  const mid = [(x0 + x1) / 2 + o.rng.gauss() * 2, (y0 + y1) / 2 + o.rng.gauss() * 2];
  let s = handStroke([[x0, y0], mid, [x1, y1]], o);
  s += handStroke([[x1 - L * Math.cos(a - sp), y1 - L * Math.sin(a - sp)], [x1, y1], [x1 - L * Math.cos(a + sp), y1 - L * Math.sin(a + sp)]], o);
  return s;
}

// 斜线阴影（天花板、地面）
export function hatchLine(x0, x1, y, o, below = false) {
  let s = handStroke([[x0, y], [x1, y]], o);
  for (let x = x0 + 10; x < x1; x += 22) s += handStroke([[x, y + (below ? 2 : -2)], [x - 14, y + (below ? 18 : -18)]], { ...o, width: o.width * 0.7 });
  return s;
}
