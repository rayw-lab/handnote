// handnote — programmable Chinese handwriting notes (browser ESM).
//
//   import { createNote } from 'handnote';
//   const note = createNote({ seed: 7 });
//   await note.write('# 牛顿第二定律\n合力决定加速度：$F=ma$');   // or place things yourself:
//   await note.T('受力分析', 62, 700, 56, note.INK.red);
//   await note.M('a=\\frac{F}{m}', 62, 800, 64);
//   document.body.innerHTML = note.toSVG();
//
// Same seed → same strokes, byte for byte. Change the seed and the page is "written again".
import { makeRng } from './rng.js';
import { writeText, writeMath, measureText } from './write.js';
import { PENS } from './pen.js';
import { makeCtx, checkLayout, INK, HL } from './note.js';
import { writeBlock } from './layout.js';

export { configure, assets } from './config.js';
export { makeRng } from './rng.js';
export { writeText, writeMath, measureText, INKS } from './write.js';
export { HAND, LATIN_HAND, PENS, REC, writeGlyph, inkPath } from './pen.js';
export { glyph, loadHanzi, loadLatin } from './glyphs.js';
export { linedPaper, highlighter, handStroke, handCircle, handArrow, hatchLine } from './paper.js';
export * as sketch from './sketch.js';
export { makeCtx, checkLayout, INK, HL } from './note.js';
export { writeBlock } from './layout.js';
export { layoutMath } from './math.js';

const DEFS = '<defs><filter id="soft"><feGaussianBlur stdDeviation="5"/></filter></defs>';

/**
 * A page you can write on.
 * @param {object} [o]
 * @param {number} [o.seed=1]     handwriting seed
 * @param {number} [o.width=1080] page width in px
 * @param {number} [o.height=1440] page height in px (3:4 fits Xiaohongshu / Instagram portrait)
 * @param {object} [o.paper]      lined paper options { top, gap, color, bg }
 * @param {number} [o.total=1]    page count, used by pageNo()
 * @param {'gel'|'felt'|object} [o.pen='gel']  pen: gel pen (thin) or felt marker (bolder taper), or custom PENS-like params
 */
export function createNote({ seed = 1, width = 1080, height = 1440, paper, total = 1, pen = 'gel' } = {}) {
  const rng = makeRng(seed);
  const P = typeof pen === 'string' ? (PENS[pen] || PENS.gel) : pen;
  const W = { text: (s, opt) => writeText(s, { pen: P, ...opt }), math: (t, opt) => writeMath(t, { pen: P, ...opt }) };
  const c = makeCtx(W, rng, total, { w: width, h: height, paper });
  const toSVG = () => {
    const { svg } = c.done();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${DEFS}${svg}</svg>`;
  };
  const check = () => checkLayout(c.done().boxes, width, height);
  const note = { ...c, INK, HL, seed, toSVG, check, measure: measureText };
  // note.write(text, opts): whole block with wrapping, '# ' titles and $TeX$ — see layout.js
  note.write = (text, o = {}) => writeBlock(note, text, { top: paper?.top, gap: paper?.gap, ...o });
  return note;
}
