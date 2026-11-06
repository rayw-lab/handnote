// Write a whole block of plain text onto a note, with automatic line wrapping.
//
//   # 标题            → a red title line
//   普通文字 $F=ma$   → text with inline TeX (between $…$)
//   (blank line)      → paragraph gap
//
// Lines snap to the ruled paper (paper.top / paper.gap), Chinese wraps per character,
// Latin wraps per word, a formula is never split.
import { measureText } from './write.js';
import { layoutMath, loadMathJax } from './math.js';
import { glyph } from './glyphs.js';
import { INK } from './note.js';

const isCJK = (c) => /[\p{Script=Han}　-〿＀-￯]/u.test(c);
const NO_LINE_START = /^[，。、；：！？）】》”’,.;:!?)]/;

function units(str) {
  const out = [];
  for (const m of str.matchAll(/[A-Za-z0-9_'’\-.]+|\s+|./gsu)) {
    const t = m[0];
    if (/^\s+$/.test(t)) out.push({ space: true });
    else if (t.length > 1 || !isCJK(t)) out.push({ text: t });
    else out.push({ text: t });
  }
  return out;
}

function tokenize(line) {
  const parts = line.split(/\$([^$]+)\$/);
  const out = [];
  parts.forEach((p, i) => { if (i % 2) out.push({ math: p }); else out.push(...units(p)); });
  return out;
}

/**
 * @param note  a note from createNote() (or a makeCtx context)
 * @param text  the text to write
 * @param o     { x=70, right=width-70, size=44, color=INK.blue, titleColor=INK.red, top=paper.top|150, gap=paper.gap|76, startLine=1 }
 * @returns { line } the next free ruled line index
 */
export async function writeBlock(note, text, o = {}) {
  const size = o.size ?? 44, x0 = o.x ?? 70, right = o.right ?? note.PW - 70;
  const top = o.top ?? 150, gap = o.gap ?? 76, color = o.color ?? INK.blue, titleColor = o.titleColor ?? INK.red;
  let line = o.startLine ?? 1;
  const baseline = (k) => top + gap * k - gap * 0.2;
  const skipped = new Set();

  // Fetch every glyph (and MathJax, if there is any math) in parallel up front —
  // otherwise each character is a separate round trip while writing.
  const plain = String(text).replace(/\$[^$]*\$/g, ' ');
  await Promise.allSettled([
    ...(/\$[^$]+\$/.test(text) && typeof document !== 'undefined' ? [loadMathJax()] : []),
    ...[...new Set(plain)].filter((c) => !/\s/.test(c)).map((c) => glyph(c)),
  ]);

  for (const raw of String(text).split('\n')) {
    if (!raw.trim()) { line += 0.5; continue; }
    const title = raw.startsWith('# ');
    const s = title ? Math.min(size * 1.5, gap * 0.95) : size;
    const toks = tokenize(title ? raw.slice(2) : raw);
    // measure
    for (const t of toks) {
      if (t.space) t.w = s * 0.32;
      else if (t.math) { const L = await layoutMath(t.math, s * 1.04); t.w = L.width; t.asc = L.ascent; t.desc = L.descent; }
      else {
        try { t.w = await measureText(t.text, s); } catch { skipped.add(t.text); t.skip = true; t.w = 0; }
      }
    }
    // break into rows
    const rows = [[]];
    let w = 0;
    const max = right - x0;
    for (const t of toks) {
      if (t.skip) continue;
      const row = rows[rows.length - 1];
      if (w + t.w > max && row.length && !(t.text && NO_LINE_START.test(t.text))) {
        rows.push([]); w = 0;
        if (t.space) continue;
      }
      rows[rows.length - 1].push(t); w += t.w;
    }
    for (const row of rows) {
      line = Math.ceil(line);
      // a tall formula (fraction, root) gets room above and below instead of touching the next line
      const asc = Math.max(0, ...row.map((t) => t.asc || 0)), desc = Math.max(0, ...row.map((t) => t.desc || 0));
      if (asc > gap * 0.95) line += 1;
      let x = x0;
      const y = baseline(line);
      let run = '';
      const flush = async () => { if (run) { const r = await note.T(run, x, y, s, title ? titleColor : color); x = r.x; run = ''; } };
      for (const t of row) {
        if (t.space) { await flush(); x += t.w; continue; }
        if (t.math) { await flush(); const r = await note.M(t.math, x, y, s * 1.04, title ? titleColor : INK.navy); x = r.x + s * 0.12; continue; }
        run += t.text;
      }
      await flush();
      line += 1 + (desc > gap * 0.3 ? 1 : 0);
    }
  }
  return { line, skipped: [...skipped] };
}
