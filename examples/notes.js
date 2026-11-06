// Three example pages. Render them with:
//   npx handnote render examples/notes.js -o out/
// A page module exports PAGES: an array of async (c) => {...}. `c` is the writing context:
//   c.T(text, x, y, size, color)   handwritten text        c.M(tex, x, y, size, color)  handwritten formula
//   c.L([text, {m: tex}, ...], x, y, size)  mixed line      c.hl(x0, x1, yCenter, height, color)  highlighter
//   c.titleRow(title, chip)        red title + green tag    c.answerBox(result)  circle an answer
//   c.sketch(name, {svg, bbox})    add a drawing            c.pageNo(n)
// Coordinates are px on a 1080×1440 page; text y is the baseline.
import { INK, HL, handStroke, handArrow, handCircle } from 'handnote';

// ─── 1 · 平抛运动 ───
async function projectile(c) {
  const { T, M, L, hl, titleRow, answerBox, sketch, pageNo, rng } = c;
  await T('物理笔记 · 曲线运动', 68, 118, 40, INK.brown);
  await titleRow('平抛运动', '拆成两个直线运动');

  // a hand-drawn trajectory
  const ox = 640, oy = 300, X = (t) => ox + 120 * t, Y = (t) => oy + 40 * t * t;
  let s = handArrow(ox - 10, oy, ox + 380, oy, { width: 2.6, color: INK.navy, rng, head: 12 });
  s += handArrow(ox, oy - 10, ox, oy + 400, { width: 2.6, color: INK.navy, rng, head: 12 });
  s += handStroke(Array.from({ length: 13 }, (_, i) => [X(i * 0.25), Y(i * 0.25)]), { width: 3.4, color: INK.red, rng, jitter: 0.6 });
  s += handArrow(X(2) , Y(2), X(2) + 90, Y(2), { width: 2.4, color: INK.blue, rng, head: 10 });
  s += handArrow(X(2), Y(2), X(2), Y(2) + 110, { width: 2.4, color: INK.green, rng, head: 10 });
  s += handCircle(ox, oy, 7, { width: 2.4, color: INK.red, rng });
  sketch('轨迹', { svg: s, bbox: { x0: ox - 20, y0: oy - 20, x1: ox + 400, y1: oy + 410 } });
  await T('x', ox + 386, oy + 12, 34, INK.navy, '标@轨迹');
  await T('y', ox - 34, oy + 400, 34, INK.navy, '标@轨迹');
  await c.labM('轨迹', 'v_x', X(2) + 70, Y(2) - 14, 32, INK.blue);
  await c.labM('轨迹', 'v_y', X(2) + 12, Y(2) + 112, 32, INK.green);

  const a = await T('水平：匀速', 50, 362, 48, INK.blue);
  hl(46, a.x + 8, 346, 44, HL.blue);
  await M('x=v_0t', 90, 446, 56);
  const b = await T('竖直：自由落体', 50, 590, 48, INK.blue);
  hl(46, b.x + 8, 574, 44, HL.green);
  await M('y=\\tfrac12 gt^2', 90, 680, 56);

  await T('消去 t，得到轨迹方程', 50, 818, 44, INK.brown);
  const traj = await M('y=\\dfrac{g}{2v_0^2}\\,x^2', 90, 930, 64, INK.red);
  answerBox(traj, 12);
  await T('← 一条抛物线', traj.x + 40, 930, 40, INK.brown);

  await L(['落地时间只看高度：', { m: 't=\\sqrt{\\dfrac{2h}{g}}' }], 50, 1100, 46);
  const n = await T('和水平速度无关！', 50, 1220, 50, INK.red);
  hl(46, n.x + 8, 1204, 46, HL.yellow);
  await pageNo(1);
}

// ─── 2 · 求根公式 ───
async function quadratic(c) {
  const { T, M, L, hl, titleRow, answerBox, pageNo } = c;
  await T('数学笔记 · 一元二次方程', 68, 118, 40, INK.brown);
  await titleRow('求根公式', '配方一步到位');
  await M('ax^2+bx+c=0\\quad(a\\ne0)', 70, 360, 60);
  await T('两边除以 a，再配方：', 50, 470, 44, INK.brown);
  await M('\\left(x+\\dfrac{b}{2a}\\right)^2=\\dfrac{b^2-4ac}{4a^2}', 90, 590, 56);
  await T('开方：', 50, 720, 44, INK.brown);
  const r = await M('x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}', 90, 850, 70, INK.red);
  answerBox(r, 14);

  const d = await T('判别式', 50, 1010, 52, INK.blue);
  hl(46, d.x + 8, 994, 48, HL.yellow);
  await M('\\Delta=b^2-4ac', d.x + 30, 1010, 54);
  await L([{ m: '\\Delta>0' }, '：两个不等实根'], 90, 1110, 44);
  await L([{ m: '\\Delta=0' }, '：两个相等实根'], 90, 1186, 44);
  await L([{ m: '\\Delta<0' }, '：没有实数根'], 90, 1262, 44);
  await pageNo(2);
}

// ─── 3 · 读书笔记（中英混排） ───
async function feynman(c) {
  const { T, hl, titleRow, pageNo } = c;
  await T('读书笔记', 68, 118, 40, INK.brown);
  await titleRow('费曼学习法', 'Feynman');
  const steps = [
    ['① 选一个概念', '写在白纸最上面', HL.yellow],
    ['② 讲给外行听', '像给十二岁的孩子讲', HL.green],
    ['③ 卡住就回去', '卡住的地方就是没懂的地方', HL.pink],
    ['④ 简化与类比', '去掉术语，换成例子', HL.blue],
  ];
  let y = 380;
  for (const [h, sub, col] of steps) {
    const t = await T(h, 50, y, 56, INK.blue);
    hl(96, t.x + 10, y - 20, 50, col);
    await T(sub, 110, y + 80, 42, INK.brown);
    y += 190;
  }
  const q = await T('Learn it by teaching it.', 50, 1200, 50, INK.navy);
  hl(46, q.x + 8, 1184, 44, HL.yellow);
  await pageNo(3);
}

export const PAGES = [projectile, quadratic, feynman];
