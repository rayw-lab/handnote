// 手写公式：MathJax 4 只负责排版（分式、上下标、根号的位置都按它来），
// 再把它排出来的每个字符、分数线、根号拆成"原子"，交给手写笔或手写字体重新写一遍。

import { assets } from './config.js';

let ready = null;
export function loadMathJax() {
  if (ready) return ready;
  const paths = { 'mathjax-newcm': assets.mathjaxFont };
  if (assets.mathjaxRoot) paths.mathjax = assets.mathjaxRoot;
  // 只借它排版：关掉读屏用的语义增强 / 语音 / 盲文，否则会在后台多下约 1 MB 的语音引擎
  window.MathJax = {
    loader: { paths }, svg: { fontCache: 'none' }, startup: { typeset: false },
    options: {
      enableEnrichment: false, enableSpeech: false, enableBraille: false, enableExplorer: false,
      menuOptions: { settings: { enrich: false, speech: false, braille: false } },
    },
  };
  ready = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = assets.mathjax;
    s.onload = () => window.MathJax.startup.promise.then(res, rej);
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return ready;
}

// 数学斜体字母（U+1D434 起）还原成普通字母
function plainChar(cp) {
  if (cp === 0x210e) return 'h';
  if (cp >= 0x1d434 && cp <= 0x1d467) { const i = cp - 0x1d434; return i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(97 + i - 26); }
  if (cp >= 0x1d6e2 && cp <= 0x1d71b) { // 数学斜体希腊
    const greek = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϴΣΤΥΦΧΨΩ∇αβγδεζηθικλμνξοπρςστυφχψω';
    return [...greek][cp - 0x1d6e2] || '?';
  }
  const map = { 0x2248: '≈', 0x2260: '≠', 0x20d7: '→', 0x2264: '≤', 0x2265: '≥', 0x2217: '*', 0x2223: '|', 0x2212: '−', 0x2032: '′', 0x22c5: '·', 0x00d7: '×', 0x27f9: '⟹', 0x21d2: '⇒', 0x2192: '→', 0x2061: '', 0x2062: '' };
  if (cp in map) return map[cp];
  return String.fromCodePoint(cp);
}
const isItalic = (cp) => (cp >= 0x1d434 && cp <= 0x1d467) || cp === 0x210e || (cp >= 0x1d6e2 && cp <= 0x1d71b);

// 返回原子列表，坐标是相对公式基线左端的 px；以及公式总宽
export async function layoutMath(tex, size) {
  await loadMathJax();
  // display 模式：MathJax 4 的行内公式会在等号处自动拆成多个 svg，块级才是一整块
  const node = await window.MathJax.tex2svgPromise(tex, { display: true });
  const svg = node.querySelector('svg');
  if (svg.querySelector('[data-mjx-error]')) throw new Error('Invalid TeX (公式写错了): ' + tex);
  const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const k = size / 1000;
  svg.setAttribute('width', vb[2] * k);
  svg.setAttribute('height', vb[3] * k);
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden';
  host.appendChild(svg);
  document.body.appendChild(host);
  const R = svg.getBoundingClientRect();
  const baseY = R.top + -vb[1] * k;
  const rel = (r) => ({ x: r.left - R.left, y: r.top - baseY, w: r.width, h: r.height });
  const atoms = [];
  for (const el of svg.querySelectorAll('path[data-c], rect, text')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (el.tagName === 'rect') { atoms.push({ type: 'rule', box: rel(r) }); continue; }
    if (el.tagName === 'text') { atoms.push({ type: 'text', str: el.textContent, box: rel(r) }); continue; }
    const cp = parseInt(el.getAttribute('data-c'), 16);
    const ch = plainChar(cp);
    if (!ch) continue;
    if (ch === '√') { atoms.push({ type: 'surd', box: rel(r) }); continue; }
    atoms.push({ type: 'glyph', ch, italic: isItalic(cp), box: rel(r) });
  }
  host.remove();
  return { atoms, width: vb[2] * k, ascent: -vb[1] * k, descent: (vb[3] + vb[1]) * k };
}
