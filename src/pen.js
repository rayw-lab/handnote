// 把单线笔画"写"出来：每个字、每一笔都带独立的手抖，再用 perfect-freehand 模拟笔压出墨迹轮廓。
import { getStroke } from 'perfect-freehand';

// 手写参数：数值都按 em 计
export const HAND = {
  size: 0.035, rot: 0.03, slant: 0.06, slantJit: 0.025, base: 0.022, dx: 0.012,
  strokeMove: 0.011, strokeRot: 0.045, strokeScale: 0.05, wobble: 0.0045,
  trimStart: 0.025, overshoot: 0.02, advJit: 0.06, hanziSquash: 1.0, warp: 0.028,
};

function catmull(pts, step) {
  if (pts.length < 2) return pts;
  const out = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const centroid = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
const bbox = (strokes) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};
export { bbox };

// 一个字的一次"书写"：返回 em 坐标的笔画（已加抖动、已平滑重采样）
// 拉丁字母笔画少、靠笔画相接成形，笔画级抖动要小得多，不然 B 会散成 3
export const LATIN_HAND = { strokeMove: 0.004, strokeRot: 0.012, strokeScale: 0.02, warp: 0.01, trimStart: 0.0, overshoot: 0.008 };

export function writeGlyph(g, rng, hand = HAND) {
  if (!g.hanzi) hand = { ...hand, ...LATIN_HAND, ...(hand.latin || {}) };
  const b = bbox(g.strokes), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const s = (1 + rng.gauss() * hand.size) * (g.hanzi ? hand.hanziSquash : 1);
  const rot = rng.gauss() * hand.rot, sl = hand.slant + rng.gauss() * hand.slantJit;
  const dy = rng.gauss() * hand.base, dx = rng.gauss() * hand.dx;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const wk = Array.from({ length: 2 }, () => ({ ax: rng.gauss(), ay: rng.gauss(), px: rng.next() * 6.3, py: rng.next() * 6.3, f: 2.2 + rng.next() * 1.6 }));
  const warp = (x, y, i) => hand.warp * (wk[i].ax * Math.sin(wk[i].f * x + wk[i].px) * 0.6 + wk[i].ay * Math.sin(wk[i].f * y + wk[i].py) * 0.6);
  const strokes = g.strokes.map((st) => {
    const c = centroid(st), a = rng.gauss() * hand.strokeRot, k = 1 + rng.gauss() * hand.strokeScale;
    const mx = rng.gauss() * hand.strokeMove, my = rng.gauss() * hand.strokeMove;
    let pts = st.map(([x, y]) => {
      const ux = (x - c[0]) * k, uy = (y - c[1]) * k;
      return [c[0] + ux * Math.cos(a) - uy * Math.sin(a) + mx, c[1] + ux * Math.sin(a) + uy * Math.cos(a) + my];
    });
    pts = catmull(pts, 0.012);
    // 起笔稍收、收笔稍冲出
    const n = pts.length;
    if (n > 4) {
      // 起笔只收一点点（按长度，≤ trimStart·0.5 em），不能按点数比例剪：转折笔画的头一段横会被整段剪掉（"几"写成"儿"）
      const maxCut = rng.next() * hand.trimStart * 0.5;
      let acc = 0, cut = 0;
      while (cut < n - 3 && acc + Math.hypot(pts[cut + 1][0] - pts[cut][0], pts[cut + 1][1] - pts[cut][1]) < maxCut) { acc += Math.hypot(pts[cut + 1][0] - pts[cut][0], pts[cut + 1][1] - pts[cut][1]); cut++; }
      pts = pts.slice(cut);
      const [pa, pb] = [pts[pts.length - 2], pts[pts.length - 1]];
      const ex = rng.next() * hand.overshoot, L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1;
      pts.push([pb[0] + ((pb[0] - pa[0]) / L) * ex, pb[1] + ((pb[1] - pa[1]) / L) * ex]);
    }
    // 沿笔画法向的低频手抖
    const w = rng.smooth(3);
    pts = pts.map((p, i) => {
      const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
      const tx = q[0] - o[0], ty = q[1] - o[1], L = Math.hypot(tx, ty) || 1;
      const off = w(i / Math.max(1, pts.length - 1)) * hand.wobble;
      return [p[0] - (ty / L) * off, p[1] + (tx / L) * off];
    });
    // 整字：低频形变场（字内比例每次都不一样）+ 缩放、旋转、斜体、基线漂移
    return pts.map(([x0, y0]) => {
      const x = x0 + warp(x0, y0, 0), y = y0 + warp(x0, y0, 1);
      let ux = (x - cx) * s, uy = (y - cy) * s;
      [ux, uy] = [ux * cr - uy * sr, ux * sr + uy * cr];
      ux -= uy * sl;
      return [cx + ux + dx, cy + uy + dy];
    });
  });
  return { strokes, adv: g.adv * (1 + rng.gauss() * hand.advJit) };
}

// 笔：width 是笔宽（px）。返回 SVG 路径 d
export const PENS = {
  gel: { thinning: 0.16, smoothing: 0.6, streamline: 0.32, taperEnd: 0.9, taperStart: 0.25 },
  felt: { thinning: 0.22, smoothing: 0.7, streamline: 0.4, taperEnd: 1.2, taperStart: 0.3 },
};

// 板书动画 / 实况图用：on 时记下每一笔的轮廓 d、中线和笔宽（只记录，不调随机数，静态出图逐像素不变）。
// live 由页面里的 c.live() 切换：标了 live 的笔画在动画里现写，其余从第一帧就在。
export const REC = { on: false, live: false, items: [] };
const rec = (d, pts, width) => { if (REC.on) REC.items.push({ kind: 'ink', d, pts: pts.map((p) => [p[0], p[1]]), width, live: REC.live }); return d; };

export function inkPath(pts, width, rng, pen = PENS.gel) {
  return rec(inkPathRaw(pts, width, rng, pen), pts, width);
}

function inkPathRaw(pts, width, rng, pen) {
  const n = pts.length;
  // 用点的外接框判断"点"：来回折返的短笔画路径长不短，但实际只占一个点大小
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const ext = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (ext < width * 2.2) {
    // 点：句点、冒号、小数点。按笔宽画一个略扁的墨点
    const [cx, cy] = pts[Math.floor(n / 2)], r = Math.max(2.4, width * (0.95 + rng.next() * 0.2)), k = 0.55228 * r;
    return `M${cx - r} ${cy}C${cx - r} ${cy - k} ${cx - k} ${cy - r * 0.9} ${cx} ${cy - r * 0.9}C${cx + k} ${cy - r * 0.9} ${cx + r} ${cy - k} ${cx + r} ${cy}C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r}C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy}Z`;
  }
  const input = pts.map(([x, y], i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const p = Math.min(1, 0.8 + t * 2) * (t > 0.85 ? 1 - (t - 0.85) * 1.2 : 1);
    return [x, y, Math.max(0.25, p * (0.92 + rng.next() * 0.16))];
  });
  if (input.length === 1) input.push([input[0][0] + 0.3, input[0][1] + 0.3, input[0][2]]);
  const outline = getStroke(input, {
    size: width, thinning: pen.thinning, smoothing: pen.smoothing, streamline: pen.streamline,
    simulatePressure: false, last: true,
    start: { taper: width * pen.taperStart, cap: true }, end: { taper: width * pen.taperEnd, cap: true },
  });
  return outlineToPath(outline);
}

function outlineToPath(pts) {
  if (!pts.length) return '';
  const f = (v) => v.toFixed(2);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}Q`;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    d += `${f(a[0])} ${f(a[1])} ${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)} `;
  }
  return d + 'Z';
}
