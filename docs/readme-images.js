// README images, drawn by handnote itself.
//   node cli/handnote.mjs render docs/readme-images.js -o docs/images/_raw --scale 1
// Page 1: banner (light) · page 2: banner (dark) · page 3: typed vs handwritten comparison
import { INK, HL, handStroke, handArrow } from 'handnote';

export const PAGE = { w: 1600, h: 1000, paper: { top: 90, gap: 76 } };
export const SEED_BASE = 20;

async function bannerLight(c) {
  const { T, M, hl } = c;
  const t = await T('handnote', 120, 300, 150, INK.navy);
  const z = await T('手写笔记', t.x + 60, 300, 150, INK.red);
  hl(t.x + 50, z.x + 20, 252, 118, HL.yellow);
  await T('每个字一笔一笔写出来，公式也是', 128, 460, 64, INK.blue);
  await M('y=\\dfrac{g}{2v_0^2}\\,x^2', 128, 640, 84, INK.navy);
  await T('Programmable Chinese handwriting', 128, 830, 56, INK.brown);
}

async function bannerDark(c) {
  const { T, M } = c;
  const ink = '#e9e4d6', red = '#ff8a7a', blue = '#9cc2ff', brown = '#d9b98a';
  let bg = `<rect width="${c.PW}" height="${c.PH}" fill="#1c1e23"/>`;
  for (let y = 90; y < c.PH; y += 76) bg += `<line x1="0" x2="${c.PW}" y1="${y}" y2="${y}" stroke="#2c3038" stroke-width="1.6"/>`;
  c.under.unshift(bg);
  const t = await T('handnote', 120, 300, 150, ink);
  await T('手写笔记', t.x + 60, 300, 150, red);
  await T('每个字一笔一笔写出来，公式也是', 128, 460, 64, blue);
  await M('y=\\dfrac{g}{2v_0^2}\\,x^2', 128, 640, 84, ink);
  await T('Programmable Chinese handwriting', 128, 830, 56, brown);
}

const SAMPLE = [
  ['牛顿第二定律', 'title'],
  ['合力决定加速度', 'text'],
  ['F = ma', 'math'],
  ['加速度和合力同向', 'text'],
];

async function compare(c) {
  const { T, M, hl, sketch, rng } = c;
  // left: typed (system font) on a plain card
  let typed = '<rect x="40" y="40" width="720" height="920" rx="18" fill="#ffffff" stroke="#d9d3c3" stroke-width="2"/>';
  typed += '<text x="400" y="110" text-anchor="middle" font-family="PingFang SC, Noto Sans CJK SC, sans-serif" font-size="34" fill="#9a8f78">打字 · typed</text>';
  const ys = [260, 400, 540, 680];
  SAMPLE.forEach(([s, kind], i) => {
    const size = kind === 'title' ? 84 : 60, fill = kind === 'title' ? '#c8352b' : '#1f3f9a';
    const fam = kind === 'math' ? 'Times New Roman, serif' : 'PingFang SC, Noto Sans CJK SC, sans-serif';
    typed += `<text x="100" y="${ys[i]}" font-family="${fam}" font-style="${kind === 'math' ? 'italic' : 'normal'}" font-size="${size}" fill="${fill}">${s}</text>`;
  });
  sketch('typed', { svg: typed, bbox: { x0: 40, y0: 40, x1: 760, y1: 960 } });
  sketch('arrow', { svg: handArrow(770, 500, 830, 500, { width: 4, color: INK.red, rng, head: 18 }), bbox: { x0: 766, y0: 480, x1: 834, y1: 520 } });
  // right: handnote
  await T('handnote · 手写', 1030, 110, 36, INK.gray);
  const t = await T('牛顿第二定律', 870, ys[0], 84, INK.red);
  hl(866, t.x + 10, ys[0] - 26, 70, HL.green);
  await T('合力决定加速度', 870, ys[1], 60, INK.blue);
  const f = await M('F=ma', 870, ys[2], 72, INK.navy);
  hl(866, f.x + 16, ys[2] - 22, 60, HL.yellow);
  await T('加速度和合力同向', 870, ys[3], 60, INK.blue);
  await T('同一个字写六遍，每次都不一样：', 870, 830, 40, INK.brown);
  let x = 870;
  for (let i = 0; i < 6; i++) { const r = await T('力', x, 910, 60, INK.navy); x = r.x + 24; }
}

export const PAGES = [bannerLight, bannerDark, compare];
