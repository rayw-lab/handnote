// 一行字写到纸上：逐字取字形 → 写一次（抖动）→ 上墨，返回 SVG 片段与行尾 x
import { glyph } from './glyphs.js';
import { writeGlyph, inkPath, HAND, PENS } from './pen.js';

export const INKS = {
  red: '#c8352b', blue: '#1f3f9a', navy: '#22305c', brown: '#7a4a12', olive: '#5e5a12',
  green: '#1f6b3a', black: '#26262b',
};

export async function writeText(str, o) {
  const { size, color = INKS.blue, rng, hand = HAND, pen = PENS.gel } = o;
  const width = o.width ?? Math.max(1.6, size * 0.043);
  let x = o.x;
  const parts = [];
  const bb = newBox();
  let prevHan = null;
  for (const ch of [...str]) {
    if (ch === ' ') { x += size * (0.28 + rng.next() * 0.08); prevHan = null; continue; }
    const g = await glyph(ch);
    // 汉字与字母数字相邻处多留一点空，窄字母（I、l、1）才不会被汉字吞掉
    const han = !!g.hanzi, punct = /[，。、；：！？（）]/.test(ch);
    if (!punct && prevHan !== null && prevHan !== han) x += size * 0.07;
    if (!punct) prevHan = han;
    const w = writeGlyph(g, rng, hand);
    for (const st of w.strokes) {
      const pts = st.map(([u, v]) => [x + u * size, o.y + v * size]);
      grow(bb, pts, width);
      parts.push(inkPath(pts, width * (0.94 + rng.next() * 0.12), rng, pen));
    }
    x += w.adv * size + (g.hanzi ? size * (0.01 + rng.next() * 0.04) : size * 0.035);
  }
  const svg = `<g fill="${color}">${parts.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  return { svg, x, bbox: bb };
}

// 墨迹外接框：排版检查遮挡、越界用
export const newBox = () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
export function grow(b, pts, pad = 0) {
  for (const [x, y] of pts) { b.x0 = Math.min(b.x0, x - pad); b.y0 = Math.min(b.y0, y - pad); b.x1 = Math.max(b.x1, x + pad); b.y1 = Math.max(b.y1, y + pad); }
  return b;
}

// 量一行字的宽度（不出墨），排版用
export async function measureText(str, size) {
  let w = 0;
  for (const ch of [...str]) {
    if (ch === ' ') { w += size * 0.32; continue; }
    const g = await glyph(ch);
    w += g.adv * size + (g.hanzi ? size * 0.04 : size * 0.03);
  }
  return w;
}

// 手写公式：原子 → 笔画。数学斜体字母多斜一点，像手写时的连笔方向
import { layoutMath } from './math.js';
import { bbox } from './pen.js';

export async function writeMath(tex, o) {
  const { size, color = INKS.blue, rng, hand = HAND, pen = PENS.gel } = o;
  const width = o.width ?? Math.max(1.6, size * 0.043);
  const L = await layoutMath(tex, size);
  const paths = [];
  const bb = newBox();
  const put = (strokes) => { for (const st of strokes) { grow(bb, st, width); paths.push(inkPath(st, width * (0.94 + rng.next() * 0.12), rng, pen)); } };
  for (const a of L.atoms) {
    const b = { x: o.x + a.box.x, y: o.y + a.box.y, w: a.box.w, h: a.box.h };
    if (a.type === 'rule') {
      const yc = b.y + b.h / 2 + rng.gauss() * size * 0.01, sag = rng.gauss() * size * 0.012;
      const x0 = b.x - size * (0.02 + rng.next() * 0.04), x1 = b.x + b.w + size * (rng.next() * 0.05);
      put([Array.from({ length: 9 }, (_, i) => { const t = i / 8; return [x0 + (x1 - x0) * t, yc + sag * Math.sin(Math.PI * t) + rng.gauss() * size * 0.002]; })]);
      continue;
    }
    if (a.type === 'surd') {
      const j = () => rng.gauss() * size * 0.012;
      const key = [[b.x + j(), b.y + b.h * 0.6 + j()], [b.x + b.w * 0.16, b.y + b.h * 0.52 + j()], [b.x + b.w * 0.45 + j(), b.y + b.h + j()], [b.x + b.w + size * 0.03, b.y + j()]];
      // resample so the pen-pressure model sees an even stroke (4 far-apart points thin out to a hairline)
      const dense = [];
      for (let i = 0; i < key.length - 1; i++) {
        const [p, q] = [key[i], key[i + 1]], n = Math.max(2, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (size * 0.06)));
        for (let k = 0; k < n; k++) dense.push([p[0] + (q[0] - p[0]) * (k / n), p[1] + (q[1] - p[1]) * (k / n)]);
      }
      dense.push(key[key.length - 1]);
      put([dense]);
      continue;
    }
    if (a.type === 'text') {
      // 公式里的中文（下标「相对」「物」等）：按 MathJax 给的框宽撑满，别缩成一团留大空
      const n = [...a.str].length, s = Math.min(b.h * 1.05, b.w / (n * 0.9));
      const t = await writeText(a.str, { x: b.x, y: b.y + b.h / 2 + s * 0.4, size: s, color, rng, hand, pen, width: width * 0.92 });
      grow(bb, [[t.bbox.x0, t.bbox.y0], [t.bbox.x1, t.bbox.y1]]);
      paths.push(...[...t.svg.matchAll(/d="([^"]+)"/g)].map((m) => m[1]));
      continue;
    }
    const g = await glyph(a.ch);
    const wg = writeGlyph(g, rng, a.italic ? { ...hand, slant: hand.slant + 0.14 } : hand);
    const gb = bbox(wg.strokes), gw = Math.max(1e-3, gb.x1 - gb.x0), gh = Math.max(1e-3, gb.y1 - gb.y0);
    let sc;
    if (gw < 0.12 && gh < 0.12) sc = size;                       // 点
    else if (gh < 0.22 && gw > gh * 1.6) sc = (b.w * 1.02) / gw;   // 横线类：− = 等号
    else if (a.ch === '±' || a.ch === '∓') sc = (b.w * 0.92) / gw;  // MathJax's box includes depth; fit width instead
    else { sc = b.h / gh; if (gw * sc > b.w * 1.4) sc = (b.w * 1.4) / gw; }
    const ox = b.x + b.w / 2 - ((gb.x0 + gb.x1) / 2) * sc, oy = b.y + b.h / 2 - ((gb.y0 + gb.y1) / 2) * sc;
    put(wg.strokes.map((st) => st.map(([u, v]) => [ox + u * sc, oy + v * sc])));
  }
  return { svg: `<g fill="${color}">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`, x: o.x + L.width, width: L.width, ascent: L.ascent, descent: L.descent, bbox: bb };
}
