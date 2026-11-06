// CLI 端到端测试：不引入测试框架，只用 node:test + node:assert。
// 覆盖 handnote 引擎的对外承诺：同 seed 逐字节同 SVG、换 seed 变化、
// 公式可渲染、缺字形不崩溃并在 stderr 提示 skipped。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'cli', 'handnote.mjs');
const EXAMPLES = path.join(ROOT, 'examples', 'notes.js');

// 临时文件统一放进 os.tmpdir() 下的唯一目录，测完整目录删除
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'handnote-test-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** 跑一次 CLI。每次调用会起一个独立 headless Chromium。 */
function runCli(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 300_000 });
  assert.equal(r.error, undefined, `CLI 未在时限内退出: ${r.error}`);
  return r;
}

test('write：PNG 存在且大于 20KB，--svg 同时输出含 <path> 的 SVG', () => {
  const png = path.join(TMP, 'write-basic.png');
  const r = runCli(['write', '可编程中文手写笔记，逐字书写测试。hello world', '-o', png, '--seed', '3', '--svg']);
  assert.equal(r.status, 0, `write 退出码非 0，stderr:\n${r.stderr}`);
  assert.ok(fs.existsSync(png), 'PNG 未生成');
  const kb = fs.statSync(png).size / 1024;
  assert.ok(kb > 20, `PNG 只有 ${kb.toFixed(1)}KB，应大于 20KB`);
  const svg = png.replace(/\.png$/i, '.svg');
  assert.ok(fs.existsSync(svg), '--svg 未生成同名 SVG');
  assert.ok(fs.readFileSync(svg, 'utf8').includes('<path'), 'SVG 中没有 <path');
});

test('同一 seed 两次 SVG sha256 完全相同；换 seed SVG 不同', () => {
  const text = '确定性检查 seed 测试 abc123';
  const a = path.join(TMP, 'det-a.png');
  const b = path.join(TMP, 'det-b.png');
  const c = path.join(TMP, 'det-c.png');
  for (const [file, seed] of [[a, '3'], [b, '3'], [c, '4']]) {
    const r = runCli(['write', text, '-o', file, '--seed', seed, '--svg']);
    assert.equal(r.status, 0, `write --seed ${seed} 退出码非 0，stderr:\n${r.stderr}`);
  }
  const svg = (p) => p.replace(/\.png$/i, '.svg');
  assert.equal(sha256(svg(a)), sha256(svg(b)), '同一 seed 两次生成的 SVG 不一致');
  assert.notEqual(sha256(svg(a)), sha256(svg(c)), '不同 seed 生成的 SVG 竟然相同');
});

test('write：内联公式 $a=\\frac{F}{m}$ 能出图', () => {
  const png = path.join(TMP, 'write-math.png');
  const r = runCli(['write', '牛顿第二定律 $a=\\frac{F}{m}$，合力决定加速度。', '-o', png, '--seed', '3']);
  assert.equal(r.status, 0, `含公式的 write 退出码非 0，stderr:\n${r.stderr}`);
  assert.ok(fs.existsSync(png), '含公式的文本未生成 PNG');
  assert.ok(fs.statSync(png).size > 0, '公式页 PNG 为空');
});

test('write：引擎无数据的罕见字（😀）不崩溃，退出码 0 且 stderr 提示 skipped', () => {
  const png = path.join(TMP, 'write-emoji.png');
  const r = runCli(['write', '表情这样处理😀就好', '-o', png, '--seed', '3']);
  assert.equal(r.status, 0, `含罕见字的 write 退出码非 0，stderr:\n${r.stderr}`);
  assert.match(r.stderr, /skipped/, 'stderr 没有出现 skipped 提示');
});

test('render examples/notes.js 第 1 页退出码为 0（文件存在时）', (t) => {
  if (!fs.existsSync(EXAMPLES)) return t.skip('examples/notes.js 不存在');
  const out = path.join(TMP, 'render-out');
  const r = runCli(['render', EXAMPLES, '-o', out, '--pages', '1']);
  assert.equal(r.status, 0, `render 退出码非 0，stderr:\n${r.stderr}`);
  assert.ok(fs.existsSync(path.join(out, '01.png')), 'render 未写出 01.png');
});

test('render：两段字叠在一起时，遮挡检查报红（退出码 3），图照样写出', () => {
  const out = path.join(TMP, 'overlap-out');
  const r = runCli(['render', path.join(ROOT, 'test', 'fixtures', 'overlap.js'), '-o', out]);
  assert.equal(r.status, 3, `叠字页应以 3 退出，实际 ${r.status}，stdout:\n${r.stdout}`);
  assert.match(r.stdout, /layout issue/, 'stdout 没有列出遮挡问题');
  assert.ok(fs.existsSync(path.join(out, '01.png')), '报红时也应写出 01.png');
});

test('write：--pen felt 与默认中性笔出的笔迹不同', () => {
  const gel = path.join(TMP, 'pen-gel.svg'), felt = path.join(TMP, 'pen-felt.svg');
  for (const [file, extra] of [[gel, []], [felt, ['--pen', 'felt']]]) {
    const r = runCli(['write', '笔型测试', '-o', file, '--seed', '5', ...extra]);
    assert.equal(r.status, 0, `write 退出码非 0，stderr:\n${r.stderr}`);
  }
  assert.notEqual(sha256(gel), sha256(felt), '换笔之后 SVG 没有变化');
});

test('animate --text 出 GIF（没有 ffmpeg 时跳过）', (t) => {
  if (spawnSync('ffmpeg', ['-version']).error) return t.skip('ffmpeg not installed');
  const gif = path.join(TMP, 'anim.gif');
  const r = runCli(['animate', '--text', '# 动画\\n$F=ma$', '-o', gif, '--width', '480', '--height', '320', '--size', '40', '--fps', '8', '--dur', '1', '--hold', '0.3']);
  assert.equal(r.status, 0, `animate 退出码非 0，stderr:\n${r.stderr}`);
  const head = fs.readFileSync(gif).subarray(0, 6).toString('latin1');
  assert.match(head, /^GIF8[79]a$/, '输出不是 GIF');
  assert.match(r.stdout, /frames/, 'stdout 没有帧数摘要');
});
