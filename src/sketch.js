// 笔记里的手画小图：滑块木板、v-t 图、能量条、贴上去的原题截图、小卡车。
// 每个函数返回 { svg, bbox }，bbox 进遮挡检查。
import { handStroke, handArrow, hatchLine, handCircle } from './paper.js';

const box = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
const rectPts = (x, y, w, h, rng, j = 1.5) => [[x + rng.gauss() * j, y], [x + w, y + rng.gauss() * j], [x + w + rng.gauss() * j, y + h], [x, y + h + rng.gauss() * j], [x + 2, y - 1]];

// 光滑地面上的木板 + 左端物块 + v0 箭头
export async function blockBoard(x, y, w, o) {
  const { rng, ink, red, blue } = o;
  const bh = w * 0.11, bw = w * 0.74, kb = w * 0.16;
  const gy = y + bh + kb;               // 地面
  let s = hatchLine(x - 10, x + w + 10, gy, { width: 2.6, color: ink, rng }, true);
  s += handStroke(rectPts(x + w * 0.12, gy - bh, bw, bh, rng), { width: 3, color: blue, rng, jitter: 0.8 });
  s += handStroke(rectPts(x + w * 0.14, gy - bh - kb, kb, kb, rng), { width: 3, color: red, rng, jitter: 0.8 });
  s += handArrow(x + w * 0.14 + kb + 8, gy - bh - kb * 0.55, x + w * 0.14 + kb + w * 0.2, gy - bh - kb * 0.55, { width: 2.6, color: red, rng, head: 11 });
  // 标签由调用方按 anchors 写（v₀ 之类要走公式笔）
  const anchors = {
    v0: [x + w * 0.14 + kb + w * 0.04, gy - bh - kb * 0.72], block: [x + w * 0.14 + kb * 0.1, gy - bh - kb - 12],
    board: [x + w * 0.12 + bw + 12, gy - 6], ground: [x + w * 0.42, gy + 42],
  };
  return { svg: s, bbox: box(x - 12, gy - bh - kb - 14, x + w + 12, gy + 22), anchors };
}

// v-t 图：series = [{pts:[[t,v]...], color}]，shade = [[t,v]...] 多边形（数据坐标）
export async function vtGraph(x, y, w, h, o) {
  const { rng, T, ink } = o;
  const [t0, t1, v0, v1] = o.range;   // t 从 t0 到 t1，v 从 v0 到 v1
  const X = (t) => x + ((t - t0) / (t1 - t0)) * w, Y = (v) => y + h - ((v - v0) / (v1 - v0)) * h;
  let s = '';
  if (o.shade) {
    const d = 'M' + o.shade.map(([t, v]) => `${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join('L') + 'Z';
    s += `<path d="${d}" fill="${o.shadeColor || '#ffe45c'}" opacity="0.55" style="mix-blend-mode:multiply"/>`;
  }
  s += handArrow(x - 6, y + h, x + w + 34, y + h, { width: 2.6, color: ink, rng, head: 11 });
  s += handArrow(x, y + h + 6, x, y - 30, { width: 2.6, color: ink, rng, head: 11 });
  for (const se of o.series) s += handStroke(se.pts.map(([t, v]) => [X(t), Y(v)]), { width: 3.2, color: se.color, rng, jitter: 0.7 });
  for (const g of o.guides || []) s += handStroke([[X(g[0]), Y(g[1])], [X(g[2]), Y(g[3])]], { width: 1.8, color: '#9a8f78', rng, jitter: 0.4 });
  let t = '';
  if (T) {
    t += (await T('v', x - 34, y - 6, 30, ink)).svg + (await T('t', x + w + 26, y + h + 36, 30, ink)).svg;
    for (const [str, tt, vv, col, size, dx = 0, dy = 0] of o.labels || []) t += (await T(str, X(tt) + dx, Y(vv) + dy, size || 26, col || ink)).svg;
  }
  return { svg: s + t, bbox: box(x - 40, y - 40, x + w + 50, y + h + 44), X, Y };
}

// 能量条：parts = [[值, 颜色, 标签]]，按值分段
export async function energyBar(x, y, w, h, parts, o) {
  const { rng, T, ink } = o;
  const total = parts.reduce((a, p) => a + p[0], 0);
  let s = '', t = '', cx = x;
  for (const [v, col, label] of parts) {
    const pw = (v / total) * w;
    s += `<path d="M${cx} ${y}h${pw}v${h}h${-pw}Z" fill="${col}" opacity="0.6" style="mix-blend-mode:multiply"/>`;
    if (T && label) t += (await T(label, cx + 10, y + h + 40, 28, ink)).svg;
    cx += pw;
  }
  s += handStroke(rectPts(x, y, w, h, rng, 1), { width: 3, color: ink, rng, jitter: 0.6 });
  s += handStroke([[x + (parts[0][0] / total) * w, y - 4], [x + (parts[0][0] / total) * w + 1, y + h + 4]], { width: 2.6, color: ink, rng, jitter: 0.5 });
  return { svg: s + t, bbox: box(x - 6, y - 6, x + w + 6, y + h + 6) };  // 标签另行登记
}

// 贴在笔记上的原题截图：白边、投影、两条胶带
export function pasteImage(href, x, y, w, h, rng, rot = -1.2) {
  const cx = x + w / 2, cy = y + h / 2, pad = 14;
  const tape = (tx, ty, a) => `<rect x="${tx - 55}" y="${ty - 16}" width="110" height="32" fill="#f3e6a6" opacity="0.78" transform="rotate(${a} ${tx} ${ty})"/>`;
  const svg = `<g transform="rotate(${rot} ${cx} ${cy})">
    <rect x="${x - pad + 5}" y="${y - pad + 7}" width="${w + pad * 2}" height="${h + pad * 2}" fill="#000" opacity="0.10" filter="url(#soft)"/>
    <rect x="${x - pad}" y="${y - pad}" width="${w + pad * 2}" height="${h + pad * 2}" fill="#fff"/>
    <image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>
    ${tape(x + 40, y - pad, -8 + rng.gauss() * 2)}${tape(x + w - 40, y - pad, 7 + rng.gauss() * 2)}
  </g>`;
  return { svg, bbox: box(x - pad - 8, y - pad - 24, x + w + pad + 8, y + h + pad + 12) };
}

// 小卡车 + 车板上的箱子 + 前壁
export function truck(x, y, o) {
  const { rng, ink, red, blue } = o;
  let s = handStroke(rectPts(x, y, 230, 18, rng, 1), { width: 3, color: blue, rng, jitter: 0.6 });          // 车板
  s += handStroke([[x + 230, y + 18], [x + 230, y - 62], [x + 290, y - 62], [x + 312, y - 24], [x + 312, y + 18], [x + 230, y + 18]], { width: 3, color: blue, rng, jitter: 0.8 }); // 车头
  s += handStroke([[x + 218, y], [x + 218, y - 46]], { width: 3, color: ink, rng, jitter: 0.5 });          // 前壁
  s += handStroke(rectPts(x + 120, y - 40, 40, 40, rng, 1), { width: 3, color: red, rng, jitter: 0.6 });   // 箱子
  s += handCircle(x + 50, y + 34, 18, { width: 3, color: ink, rng });
  s += handCircle(x + 270, y + 34, 18, { width: 3, color: ink, rng });
  s += handArrow(x + 168, y - 22, x + 205, y - 22, { width: 2.4, color: red, rng, head: 9 });
  return { svg: s, bbox: box(x - 6, y - 70, x + 318, y + 56) };
}

// ───── 第二课新增（只追加，不改上面的函数：第一课重出要逐像素一致）─────
const D2R = Math.PI / 180;
const dashed = (x0, y0, x1, y1, o, seg = 12, gap = 8) => {
  let s = '', L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  for (let t = 0; t < L - 2; t += seg + gap) { const e = Math.min(L, t + seg); s += handStroke([[x0 + ux * t, y0 + uy * t], [x0 + ux * e, y0 + uy * e]], { ...o, jitter: 0.3 }); }
  return s;
};
export function dashedArrow(x0, y0, x1, y1, o) {
  const a = Math.atan2(y1 - y0, x1 - x0), L = o.head ?? 14, sp = 0.45;
  return dashed(x0, y0, x1 - Math.cos(a) * 4, y1 - Math.sin(a) * 4, o) + handStroke([[x1 - L * Math.cos(a - sp), y1 - L * Math.sin(a - sp)], [x1, y1], [x1 - L * Math.cos(a + sp), y1 - L * Math.sin(a + sp)]], o);
}

// 小车上放斜面体（坡向右升高，倾角 deg），坡上一个物块；dir = -1 车向左加速，+1 向右
export function inclineCart(x, y, w, o) {
  const { rng, ink, red, blue } = o, deg = o.deg ?? 37, r = w * 0.055, hb = w * 0.1;
  const gy = y, bodyTop = gy - 2 * r - hb, bx0 = x + w * 0.1, bx1 = x + w * 0.9, H = (bx1 - bx0) * Math.tan(deg * D2R);
  let s = hatchLine(x - 20, x + w + 20, gy, { width: 2.4, color: ink, rng }, true);
  s += handStroke([[x, bodyTop], [x + w, bodyTop - 1], [x + w + 1, bodyTop + hb], [x, bodyTop + hb + 1], [x + 1, bodyTop - 1]], { width: 3, color: blue, rng, jitter: 0.6 });
  s += handCircle(x + w * 0.2, gy - r, r, { width: 3, color: ink, rng }) + handCircle(x + w * 0.8, gy - r, r, { width: 3, color: ink, rng });
  s += handStroke([[bx0, bodyTop], [bx1, bodyTop], [bx1, bodyTop - H], [bx0, bodyTop]], { width: 3, color: blue, rng, jitter: 0.6 });
  // 角标小弧
  const arc = Array.from({ length: 7 }, (_, i) => { const a = (-deg * D2R * i) / 6; return [bx0 + 34 * Math.cos(a), bodyTop + 34 * Math.sin(a)]; });
  s += handStroke(arc, { width: 2.2, color: ink, rng, jitter: 0.3 });
  // 物块
  const c = Math.cos(deg * D2R), sn = Math.sin(deg * D2R), t = o.t ?? 0.46, k = w * 0.12;
  const P = [bx0 + (bx1 - bx0) * t, bodyTop - H * t], u = [c, -sn], n = [-sn, -c];
  const q = (a, b) => [P[0] + u[0] * a + n[0] * b, P[1] + u[1] * a + n[1] * b];
  s += handStroke([q(-k / 2, 0), q(k / 2, 0), q(k / 2, k), q(-k / 2, k), q(-k / 2 + 2, 2)], { width: 3, color: red, rng, jitter: 0.5 });
  const dir = o.dir ?? -1, ay = bodyTop + hb / 2, ax0 = dir < 0 ? x - 14 : x + w + 14;
  s += handArrow(ax0, ay, ax0 + dir * w * 0.24, ay, { width: 3, color: red, rng, head: 13 });
  const center = q(0, k / 2);
  return { svg: s, bbox: box(Math.min(x, ax0 + dir * w * 0.24) - 24, bodyTop - H - k - 10, Math.max(x + w, ax0 + dir * w * 0.24) + 24, gy + 22),
    anchors: { center, u, n, k, angle: [bx0 + 40, bodyTop - 8], A: [ax0 + dir * w * 0.12, ay - 18], top: [bx1, bodyTop - H] } };
}

// 车厢里挂吊坠：车向左加速，吊坠向右偏 phi 度
export function carPendulum(x, y, w, h, o) {
  const { rng, ink, red, blue, green } = o, phi = (o.phi ?? 26.6) * D2R;
  let s = handStroke([[x, y], [x + w, y - 1], [x + w + 1, y + h], [x, y + h + 1], [x + 1, y - 1]], { width: 3, color: blue, rng, jitter: 0.8 });
  s += handCircle(x + w * 0.22, y + h + 16, 15, { width: 3, color: ink, rng }) + handCircle(x + w * 0.78, y + h + 16, 15, { width: 3, color: ink, rng });
  const px = x + w * 0.42, py = y + 4, L = h * 0.56, bx = px + L * Math.sin(phi), by = py + L * Math.cos(phi);
  s += dashed(px, py, px, py + L * 1.02, { width: 1.8, color: '#9a8f78', rng }, 8, 8);
  s += handStroke([[px, py], [bx, by]], { width: 2.6, color: ink, rng, jitter: 0.3 });
  s += handCircle(bx, by + 2, 11, { width: 3.2, color: red, rng });
  const g = h * 0.3, ia = g * Math.tan(phi);
  s += handArrow(bx, by + 16, bx, by + 16 + g, { width: 2.8, color: blue, rng, head: 11 });
  s += dashedArrow(bx + 14, by + 2, bx + 14 + ia, by + 2, { width: 2.6, color: red, rng, head: 11 });
  s += handArrow(bx + 8, by + 14, bx + 8 + ia * 0.95, by + 14 + g * 0.95, { width: 3, color: green, rng, head: 12 });
  const arc = Array.from({ length: 6 }, (_, i) => { const a = (phi * i) / 5; return [px + 44 * Math.sin(a), py + 44 * Math.cos(a)]; });
  s += handStroke(arc, { width: 2, color: ink, rng, jitter: 0.3 });
  s += handArrow(x - 16, y + h * 0.5, x - 16 - w * 0.22, y + h * 0.5, { width: 3, color: red, rng, head: 13 });
  return { svg: s, bbox: box(x - 16 - w * 0.22 - 20, y - 8, x + w + 10, y + h + 36),
    anchors: { bob: [bx, by], pivot: [px, py], mg: [bx - 34, by + 16 + g], mA: [bx + 18 + ia, by - 6], geff: [bx + 14 + ia, by + 20 + g], phi: [px + 10, py + 66], A: [x - 16 - w * 0.12, y + h * 0.5 - 16] } };
}

// 「把画面摆正」后的坡：等效重力竖直向下，坡与水平夹 deg（正 = 右高，负 = 左高）；slide = 'down' / 'up' / 'stay'
export function levelledSlope(x, y, w, deg, o) {
  const { rng, ink, red, blue, green } = o, a = deg * D2R, c = Math.cos(a), sn = Math.sin(a);
  const cx = x + w / 2, cy = y, half = w * 0.42;
  const p0 = [cx - half * c, cy + half * sn], p1 = [cx + half * c, cy - half * sn];
  let s = handStroke([p0, p1], { width: 3.2, color: blue, rng, jitter: 0.5 });
  for (let i = 1; i < 6; i++) { const t = i / 6, bx = p0[0] + (p1[0] - p0[0]) * t, by = p0[1] + (p1[1] - p0[1]) * t; s += handStroke([[bx, by + 2], [bx - 10, by + 16]], { width: 1.8, color: ink, rng, jitter: 0.2 }); }
  const k = 30, u = [c, -sn], n = [-sn, -c], P = [cx, cy];
  const q = (aa, b) => [P[0] + u[0] * aa + n[0] * b, P[1] + u[1] * aa + n[1] * b];
  s += handStroke([q(-k / 2, 0), q(k / 2, 0), q(k / 2, k), q(-k / 2, k), q(-k / 2 + 2, 2)], { width: 3, color: red, rng, jitter: 0.4 });
  s += handArrow(x + w - 10, cy - 70, x + w - 10, cy - 10, { width: 2.8, color: green, rng, head: 11 });
  if (o.slide !== 'stay') {
    // 方向按原来的坡定：'down' 朝原坡底（左端，-u），'up' 朝原坡顶（右端，+u）；摆正后坡怎么斜都一样
    const sg = o.slide === 'down' ? -1 : 1, m = q(sg * 34, k + 18);
    s += handArrow(m[0], m[1], m[0] + sg * u[0] * 46, m[1] + sg * u[1] * 46, { width: 2.8, color: red, rng, head: 11 });
  }
  return { svg: s, bbox: box(x, cy - 80, x + w, cy + half * Math.abs(sn) + 24), anchors: { geff: [x + w - 4, cy - 80], below: [x + 6, cy + half * Math.abs(sn) + 62] } };
}
