// The write-on GIF at the top of the README.
//   node cli/handnote.mjs animate docs/readme-anim.js --all --dur 4.5 --hold 1.8 --fps 20 --gif-width 800 -o docs/images/write-on.gif
import { INK, HL } from 'handnote';

export const PAGE = { w: 1200, h: 620, paper: { top: 70, gap: 92 } };
export const SEED_BASE = 40;

export const PAGES = [async (c) => {
  const { T, M, L, hl } = c;
  const t = await T('手写笔记', 70, 244, 104, INK.red);
  hl(64, t.x + 14, 210, 84, HL.yellow);
  await T('每一笔都是现写的，', 74, 338, 62, INK.blue);
  await L(['公式也是：', { m: 'a=\\dfrac{F}{m}' }], 74, 522, 62);
  await T('同一个字写四遍：', 770, 338, 40, INK.brown);
  let x = 772;
  for (let i = 0; i < 4; i++) x = (await T('力', x, 430, 84, INK.navy)).x + 18;
}];
