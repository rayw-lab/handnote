// Where the engine loads its data from. Defaults point at jsDelivr so a plain web page works
// with no build step; the CLI points everything at the local node_modules instead.
//
//   hanzi:   per-character stroke medians (hanzi-writer-data, Arphic Public License — see NOTICE.md)
//   latin:   single-line SVG font for letters/digits/symbols (hersheytext, EMS fonts under SIL OFL)
//   mathjax: MathJax 4 tex-svg component (used only for layout; every glyph is re-drawn by hand)
//   mathjaxFont: base URL of @mathjax/mathjax-newcm-font
//   mathjaxRoot: optional; where MathJax loads its own extensions from. Only needed when `mathjax`
//                is not a normal URL (e.g. a blob: URL of a script you downloaded yourself).
const CDN = 'https://cdn.jsdelivr.net/npm';

export const assets = {
  hanzi: (ch) => `${CDN}/hanzi-writer-data@2.0.1/${encodeURIComponent(ch)}.json`,
  latin: (font) => `${CDN}/hersheytext@2.0.0/svg_fonts/${font}.svg`,
  mathjax: `${CDN}/mathjax@4.1.3/tex-svg.js`,
  mathjaxFont: `${CDN}/@mathjax/mathjax-newcm-font@4.1.3`,
};

// configure({ hanzi, latin, mathjax, mathjaxFont, mathjaxRoot }) — strings may be templates with {ch} / {font}.
export function configure(o = {}) {
  for (const k of ['hanzi', 'latin']) {
    if (typeof o[k] === 'string') {
      const t = o[k], key = k === 'hanzi' ? '{ch}' : '{font}';
      assets[k] = (v) => t.replace(key, k === 'hanzi' ? encodeURIComponent(v) : v);
    } else if (typeof o[k] === 'function') assets[k] = o[k];
  }
  if (o.mathjax) assets.mathjax = o.mathjax;
  if (o.mathjaxFont) assets.mathjaxFont = o.mathjaxFont;
  if (o.mathjaxRoot) assets.mathjaxRoot = o.mathjaxRoot;
  return assets;
}
