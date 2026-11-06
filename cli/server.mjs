// Tiny static server that maps the engine, its data packages and the user's page module
// to fixed URL prefixes, so the browser shell can import everything without a bundler.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// Locate an installed package's directory (some packages don't export ./package.json).
const pkgDir = (name) => {
  for (const base of require.resolve.paths(name) || []) {
    const d = path.join(base, name);
    if (fs.existsSync(path.join(d, 'package.json'))) return d;
  }
  throw new Error(`Cannot find package ${name}; run npm install`);
};

const TYPES = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html;charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.css': 'text/css',
};

/** Start the server. extra: [[prefix, dir], ...] added before the defaults. */
export async function serve(extra = []) {
  const routes = [
    ...extra,
    ['/src/', path.join(ROOT, 'src') + '/'],
    ['/shell/', path.join(ROOT, 'shell') + '/'],
    ['/nm/perfect-freehand/', pkgDir('perfect-freehand') + '/'],
    ['/hz/', pkgDir('hanzi-writer-data') + '/'],
    ['/hershey/', path.join(pkgDir('hersheytext'), 'svg_fonts') + '/'],
    ['/mj/', pkgDir('mathjax') + '/'],
    ['/mjfont/', pkgDir('@mathjax/mathjax-newcm-font') + '/'],
  ];
  const server = http.createServer((rq, rs) => {
    const u = decodeURIComponent(new URL(rq.url, 'http://x').pathname);
    const hit = routes.find(([p]) => u.startsWith(p));
    if (!hit) { rs.writeHead(404); return rs.end(); }
    const f = path.join(hit[1], u.slice(hit[0].length));
    if (!f.startsWith(hit[1])) { rs.writeHead(403); return rs.end(); }
    fs.readFile(f, (err, buf) => {
      if (err) { rs.writeHead(404); return rs.end(); }
      rs.setHeader('content-type', TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream');
      rs.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { origin: 'http://127.0.0.1:' + server.address().port, close: () => server.close() };
}

/** Launch headless Chromium: Playwright's own build first, then a locally installed Chrome. */
export async function launch() {
  const { chromium } = await import('playwright');
  try { return await chromium.launch({ headless: true }); } catch (e1) {
    try { return await chromium.launch({ headless: true, channel: 'chrome' }); } catch {
      throw new Error('No browser found. Run `npx playwright install chromium` once (or install Google Chrome).\n' + e1.message);
    }
  }
}
