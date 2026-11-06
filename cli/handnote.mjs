#!/usr/bin/env node
// handnote CLI
//
//   handnote write "# 标题\n正文 $E=mc^2$" -o note.png [--seed 7] [--size 44] [--width 1080 --height 1440] [--svg]
//   handnote write -f notes.txt -o note.png
//   handnote render page.js -o out/ [--pages 1,3-4] [--scale 2] [--seed 7] [--svg]
//
// Exit codes: 0 ok · 2 usage/render error · 3 layout overlap or out-of-page (images are still written)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, ROOT } from './server.mjs';

const HELP = `handnote — programmable Chinese handwriting notes · 可编程中文手写笔记

Usage
  handnote write <text> -o <file.png|file.svg>   write a block of text (# title, $TeX$, auto wrap)
  handnote write -f <file.txt> -o <file.png>     same, text from a file
  handnote render <page.js> -o <dir>             render a page module (see examples/)
  handnote animate <page.js> --page N -o out.gif|out.mp4 [--all] [--fps 30] [--dur 3] [--hold 1.2]
  handnote animate --text <text> -o out.gif [--size 44] [--pen felt] [--width 1080 --height 1440]
                    [--seed n] [--gif-width 720] [--live-photo <dir>]

Options
  --seed <n>         handwriting seed (same seed = same strokes)      [write: 1]
  --size <px>        text size                                        [44]
  --width/--height   page size in px                                 [1080x1440]
  --scale <n>        device pixel ratio for PNG                       [2]
  --pages <list>     render: which pages, e.g. 1,3-4                  [all]
  --svg              also write .svg next to each .png
  --plain            write: blank paper instead of ruled lines
  --pen gel|felt     write: gel pen (default) or felt marker
`;

const argv = process.argv.slice(2);
const cmd = argv.shift();
const opt = (k, d, short) => { let i = argv.indexOf('--' + k); if (i < 0 && short) i = argv.indexOf('-' + short); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes('--' + k);
const positional = () => { for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('-')) { if (!['--svg', '--plain'].includes(argv[i])) i++; continue; } return argv[i]; } return null; };
const die = (msg) => { console.error(msg); process.exit(2); };

if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') { console.log(HELP); process.exit(0); }
if (cmd === '-v' || cmd === '--version') { console.log(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'))).version); process.exit(0); }

if (cmd === 'animate') {
  try { await (await import('./animate.mjs')).animate(argv); }
  catch (error) { console.error(error.message); process.exit(2); }
  process.exit(0);
}

const scale = Number(opt('scale', '2'));
let modPath, out, pages, outIsFile = false, tmp;

if (cmd === 'write') {
  const file = opt('file', null, 'f');
  const text = file ? fs.readFileSync(file, 'utf8') : positional();
  out = opt('out', null, 'o');
  if (!text || !out) die('handnote write <text> -o <file.png>\n\n' + HELP);
  const W = Number(opt('width', '1080')), H = Number(opt('height', '1440')), size = Number(opt('size', '44'));
  const seed = Number(opt('seed', '1')), plain = flag('plain');
  const gap = Math.round(size * 1.73), top = Math.round(gap * 2);
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'handnote-'));
  modPath = path.join(tmp, 'page.js');
  fs.writeFileSync(modPath, `import { writeBlock } from '/src/layout.js';
export const PAGE = { w: ${W}, h: ${H}, pen: ${JSON.stringify(opt('pen', 'gel'))}, paper: ${plain ? `{ top: ${top}, gap: ${gap}, color: 'transparent' }` : `{ top: ${top}, gap: ${gap} }`} };
export const SEED_BASE = ${seed - 1};
export const PAGES = [async (c) => {
  const r = await writeBlock(c, ${JSON.stringify(text.replace(/\\n/g, '\n'))}, { size: ${size}, top: ${top}, gap: ${gap} });
  if (r.skipped.length) console.warn('skipped (no glyph): ' + r.skipped.join(' '));
}];
`);
  pages = [1];
  outIsFile = true;
} else if (cmd === 'render') {
  modPath = positional();
  out = opt('out', null, 'o');
  if (!modPath || !fs.existsSync(modPath) || !out) die('handnote render <page.js> -o <dir>\n\n' + HELP);
} else die(`unknown command: ${cmd}\n\n` + HELP);

const modAbs = path.resolve(modPath);
const srv = await serve([['/work/', path.dirname(modAbs) + '/']]);
const browser = await launch();
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: scale });
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.error(m.text()); });
  const modUrl = '/work/' + encodeURIComponent(path.basename(modAbs));
  await page.goto(`${srv.origin}/shell/page.html`);
  const [total, PW, PH] = await page.evaluate(async (m) => { const x = await import(m); return [x.TOTAL || x.PAGES.length, x.PAGE?.w || 1080, x.PAGE?.h || 1440]; }, modUrl);
  await page.setViewportSize({ width: PW, height: PH });
  const spec = opt('pages') || `1-${total}`;
  pages ??= spec.split(',').flatMap((s) => { const [a, b] = s.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
  if (!outIsFile) fs.mkdirSync(path.resolve(out), { recursive: true });
  const seedArg = cmd === 'render' && opt('seed') ? `&seed=${opt('seed')}` : '';
  for (const n of pages) {
    await page.goto(`${srv.origin}/shell/page.html?mod=${modUrl}&p=${n}${seedArg}`);
    await page.waitForFunction(() => window.__done || window.__error, null, { timeout: 180000 });
    const err = await page.evaluate(() => window.__error);
    if (err) { console.error(`page ${n} failed:\n${err}`); code = 2; continue; }
    const rep = await page.evaluate(() => window.__report);
    const file = outIsFile ? path.resolve(out) : path.join(path.resolve(out), String(n).padStart(2, '0') + '.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const svgSrc = await page.evaluate(() => document.getElementById('s').outerHTML);
    if (file.endsWith('.svg')) fs.writeFileSync(file, svgSrc);
    else {
      await page.screenshot({ path: file });
      if (flag('svg')) fs.writeFileSync(file.replace(/\.png$/i, '.svg'), svgSrc);
    }
    const issues = rep.issues.length ? `  ⚠ ${rep.issues.length} layout issue(s): ${JSON.stringify(rep.issues)}` : '';
    console.log(`${path.relative(process.cwd(), file)}  seed ${rep.seed}${issues}`);
    if (rep.issues.length && code === 0 && cmd === 'render') code = 3;
  }
} finally {
  await browser.close();
  srv.close();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(code);
