// 一页笔记的书写上下文：写字、写公式、混排、荧光笔、标题行、答案框、小图登记、页码、遮挡检查。
// 随机数的调用顺序不能改：同一 seed 必须出同一张图（改了这里要跑 test/ 里的确定性对账）。
// RNG call order is part of the output: same seed → same SVG. Run the determinism test after any change here.
import { linedPaper, highlighter, handStroke } from './paper.js';
import { REC } from './pen.js';
import { pasteImage } from './sketch.js';

export const INK = { red: '#c8352b', blue: '#1f3f9a', navy: '#22305c', brown: '#7a4a12', green: '#1d6a3a', gray: '#8a7f6a' };
export const HL = { green: '#8fdc6a', pink: '#f28cc2', yellow: '#ffe45c', blue: '#9fd0ff' };

// W：写字接口 { text(str,o), math(tex,o) }；total：本套张数（页码用）
// page：可选版面 { w, h, paper: linedPaper 参数 }，缺省 1080×1440（高密度满版用 1620×2160）
export function makeCtx(W, rng, total = 6, page = {}) {
  const PW = page.w || 1080, PH = page.h || 1440;
  const under = [], over = [], boxes = [], texts = [];
  const reg = (name, b) => { if (b && isFinite(b.x0)) boxes.push({ name, ...b }); };
  const T = async (s, x, y, size, color = INK.blue, tag = '字') => { texts.push(s); const r = await W.text(s, { x, y, size, color, rng }); over.push(r.svg); reg(tag + ':' + s, r.bbox); return r; };
  // 图上的标注：只和别的内容比遮挡，不和自己所属的图比（落在图上是本意，压线要看图）
  const lab = (fig) => (s, x, y, size, color) => T(s, x, y, size, color, '标@' + fig);
  const labM = async (fig, t, x, y, size, color) => { const r = await W.math(t, { x, y, size, color, rng }); over.push(r.svg); reg('标@' + fig + ':' + t, r.bbox); return r; };
  const M = async (t, x, y, size, color = INK.navy) => { const r = await W.math(t, { x, y, size, color, rng }); over.push(r.svg); reg('式:' + t, r.bbox); return r; };
  // 一行里文字和公式混排：items = ['文字', {m:'tex'}, ...]
  const L = async (items, x, y, size, color = INK.blue, gap = 10) => {
    let cx = x, last;
    for (const it of items) {
      last = typeof it === 'string' ? await T(it, cx, y, size, color) : await M(it.m, cx, y, it.size || size * 1.04, it.color || color);
      cx = last.x + gap;
    }
    return { x: cx - gap };
  };
  const hl = (x0, x1, yc, h, c) => under.push(highlighter(x0, x1, yc, h, c, rng, c === HL.pink ? 0.55 : 0.72));
  const titleRow = async (title, chip, y = 214, size = 100) => {
    const t = await T(title, 62, y, size, INK.red);
    const c = await T(chip, t.x + 40, y - 10, size * 0.58, INK.green);
    hl(t.x + 22, c.x + 14, y - 10 - size * 0.2, size * 0.8, HL.green);
    return c;
  };
  const answerBox = (r, pad = 10) => over.push(handStroke([[r.bbox.x0 - pad, r.bbox.y0 - pad], [r.bbox.x1 + pad, r.bbox.y0 - pad - 2], [r.bbox.x1 + pad + 2, r.bbox.y1 + pad], [r.bbox.x0 - pad - 2, r.bbox.y1 + pad + 1], [r.bbox.x0 - pad + 3, r.bbox.y0 - pad - 3]], { width: 3.2, color: INK.red, rng, jitter: 1.2 }));
  const sketch = (name, r) => { over.push(r.svg); reg('图:' + name, r.bbox); return r; };
  const pageNo = async (n) => T(`${n}/${total}`, PW - 100, PH - 36, 34 * PW / 1080, INK.gray);
  // 实况图 / 板书动画：live() 之后写的笔画在动画里现写，live(false) 收住；静态出图里是空操作
  const live = (on = true) => { REC.live = on; };
  // 实况图里的视频窗口：贴在笔记上的一张"截图"，动画时逐帧换成 /frames/NNNN.png（静态出图显示第 0 帧）
  const video = (name, x, y, w, h, rot = -0.8) => sketch(name, pasteImage(page.videoFrame || '/frames/0000.png', x, y, w, h, rng, rot));
  const done = () => ({ svg: linedPaper({ w: PW, h: PH, ...(page.paper || {}) }) + `<g>${under.join('')}</g>` + over.join(''), boxes, texts });
  return { PW, PH, T, M, L, hl, titleRow, answerBox, sketch, pageNo, done, over, under, rng, lab, labM, reg, live, video };
}

// 遮挡 / 越界检查：任意两块墨迹外接框相交（面积超过 60px²）或超出页边 18px 即报
export function checkLayout(boxes, w = 1080, h = 1440) {
  const issues = [];
  for (const b of boxes) if (b.x0 < 18 || b.y0 < 18 || b.x1 > w - 18 || b.y1 > h - 18) issues.push(['越界', b.name, [b.x0, b.y0, b.x1, b.y1].map(Math.round)]);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    const own = (p, q) => p.name.startsWith('标@') && q.name.startsWith('图:') && p.name.slice(2).split(':')[0] === q.name.slice(2);
    if (own(a, b) || own(b, a)) continue;
    if (ix > 0 && iy > 0 && ix * iy > 60) issues.push(['相交', a.name, b.name, Math.round(ix * iy)]);
  }
  return issues;
}
