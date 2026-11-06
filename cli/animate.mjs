#!/usr/bin/env node
// Render deterministic SVG frames, then encode with the system ffmpeg.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, serve, launch } from './server.mjs';

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') {
    throw new Error(command === 'ffmpeg'
      ? 'ffmpeg is required. Install with `brew install ffmpeg` (macOS), `sudo apt install ffmpeg` (Debian/Ubuntu), or visit https://ffmpeg.org/download.html'
      : `Required command not found: ${command}`);
  }
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout;
}

function options(argv) {
  const values = {}, flags = new Set(), files = [];
  const names = new Set(['text', 'out', 'page', 'fps', 'dur', 'hold', 'seed', 'gif-width', 'size', 'pen', 'width', 'height', 'live-photo']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') flags.add('all');
    else if (arg.startsWith('-')) {
      const name = arg === '-o' ? 'out' : arg.slice(2);
      if (!names.has(name)) throw new Error(`Unknown option: ${arg}`);
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
      values[name] = argv[++i];
    } else files.push(arg);
  }
  if (files.length > 1) throw new Error('Expected one page module');
  return { values, flags, file: files[0] };
}

export async function animate(argv = []) {
  const { values: o, flags, file } = options(argv);
  const textMode = o.text !== undefined;
  if (!o.out || (textMode ? !o.text || file : !file)) {
    throw new Error('Usage: handnote animate <page.js> --page N -o out.gif|out.mp4 [--all]\n       handnote animate --text <text> -o out.gif');
  }
  const number = (key, fallback, min, max = Infinity, integer = false) => {
    const n = Number(o[key] ?? fallback);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`Invalid --${key}`);
    return n;
  };
  const fps = number('fps', 30, 1, 60, true), dur = number('dur', 3, 0.1);
  const hold = number('hold', 1.2, 0), pageNumber = number('page', 1, 1, Infinity, true);
  const width = number('width', 1080, 2, 16384, true), height = number('height', 1440, 2, 16384, true);
  const size = number('size', 44, 1), gifWidth = number('gif-width', 720, 2, 16384, true);
  const seed = o.seed === undefined ? (textMode ? 1 : undefined) : number('seed', 1, -Infinity);
  const pen = o.pen ?? 'gel';
  if (!['gel', 'felt'].includes(pen)) throw new Error('--pen must be gel or felt');
  const out = path.resolve(o.out), ext = path.extname(out).toLowerCase();
  if (!['.gif', '.mp4'].includes(ext)) throw new Error('Output must end in .gif or .mp4');
  if (o['live-photo'] && process.platform !== 'darwin') throw new Error('Live Photo export is macOS-only');
  const liveTarget = o['live-photo'] ? path.resolve(o['live-photo']) : null;
  if (liveTarget && fs.existsSync(liveTarget)) throw new Error('Live Photo output directory already exists; choose a new directory');
  run('ffmpeg', ['-version']);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'handnote-animate-'));
  const frames = path.join(work, 'frames');
  fs.mkdirSync(frames);
  let browser, server;
  try {
    let modulePath = file && path.resolve(file);
    if (textMode) {
      const gap = Math.round(size * 1.73), top = Math.round(gap * 2);
      modulePath = path.join(work, 'page.js');
      fs.writeFileSync(modulePath, `import { writeBlock } from 'handnote';
export const PAGE = { w: ${width}, h: ${height}, pen: ${JSON.stringify(pen)}, paper: { top: ${top}, gap: ${gap} } };
export const SEED_BASE = ${seed - 1};
export const PAGES = [async (c) => {
  c.live();
  const r = await writeBlock(c, ${JSON.stringify(o.text.replace(/\\n/g, '\n'))}, { size: ${size}, top: ${top}, gap: ${gap} });
  if (r.skipped.length) console.warn('skipped (no glyph): ' + r.skipped.join(' '));
}];
`);
    }
    if (!fs.existsSync(modulePath)) throw new Error(`Page module not found: ${modulePath}`);
    server = await serve([['/work/', path.dirname(modulePath) + '/']]);
    browser = await launch();
    const pg = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    pg.on('console', (m) => { if (['warning', 'error'].includes(m.type())) console.error(m.text()); });
    const query = new URLSearchParams({ mod: '/work/' + path.basename(modulePath), p: String(pageNumber), t0: '0', t1: String(dur) });
    if (seed !== undefined) query.set('seed', String(seed));
    if (textMode || flags.has('all')) query.set('all', '1');
    await pg.goto(`${server.origin}/shell/live.html?${query}`);
    await pg.waitForFunction(() => window.__done || window.__error, null, { timeout: 180000 });
    const state = await pg.evaluate(() => ({ error: window.__error, report: window.__report }));
    if (state.error) throw new Error(state.error);
    const report = state.report;
    if (report.missing) throw new Error(`${report.missing} recorded strokes did not match SVG paths`);
    await pg.setViewportSize({ width: report.width, height: report.height });
    if (report.issues.length) console.error(`Layout warning: ${JSON.stringify(report.issues)}`);
    // Include a fully written endpoint even with --hold 0.
    const count = Math.ceil(dur * fps) + Math.max(1, Math.ceil(hold * fps));
    for (let i = 0; i < count; i++) {
      await pg.evaluate(([i, fps]) => window.__frame(i, fps), [i, fps]);
      await pg.screenshot({ path: path.join(frames, `${String(i).padStart(6, '0')}.png`) });
    }
    await browser.close(); browser = null;
    server.close(); server = null;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const input = ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(frames, '%06d.png')];
    const mp4 = ext === '.mp4' ? out : path.join(work, 'motion.mp4');
    const encodeMP4 = () => run('ffmpeg', [...input, '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', mp4]);
    if (ext === '.mp4') encodeMP4();
    else run('ffmpeg', [...input, '-filter_complex', `[0:v]scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a`, '-loop', '0', out]);
    let livePhoto = null;
    if (liveTarget) {
      if (ext !== '.mp4') encodeMP4();
      const cover = path.join(work, 'cover.jpg'), pairBin = path.join(work, 'pair_live_photo');
      // The cover must match padded MP4 dimensions for odd-sized pages as well.
      run('ffmpeg', ['-y', '-v', 'error', '-i', path.join(frames, `${String(count - 1).padStart(6, '0')}.png`), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-frames:v', '1', cover]);
      run('swiftc', ['-O', path.join(ROOT, 'cli/livephoto/pair_live_photo.swift'), '-o', pairBin]);
      fs.mkdirSync(liveTarget, { recursive: true });
      const pairDir = path.join(liveTarget, 'live');
      const manifest = JSON.parse(run(pairBin, [cover, mp4, pairDir, String((count - 1) / fps), String(fps)]));
      if (!manifest.metadataVerified || manifest.localPHLivePhotoLoad !== 'passed') throw new Error('Live Photo validation failed');
      const pvt = path.join(liveTarget, path.basename(liveTarget) + '.pvt');
      const receipt = JSON.parse(run('python3', [path.join(ROOT, 'cli/livephoto/package_live_photo.py'), pairDir, pvt]));
      livePhoto = { manifest, receipt, pvt };
    }
    const result = { output: out, frames: count, duration: count / fps, fps, hold, report, livePhoto };
    console.log(`${path.relative(process.cwd(), out) || out}  ${count} frames · ${(count / fps).toFixed(1)}s` + (livePhoto ? `  · Live Photo ${livePhoto.pvt}` : '') + (report.issues.length ? `  ⚠ ${report.issues.length} layout issue(s)` : ''));
    return result;
  } finally {
    try { if (browser) await browser.close(); }
    finally { if (server) server.close(); fs.rmSync(work, { recursive: true, force: true }); }
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  animate(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 2; });
}
