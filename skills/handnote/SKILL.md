---
name: handnote
description: Turn text, formulas and simple diagrams into realistic handwritten Chinese/English note images (PNG/SVG), stroke by stroke, with handwritten math and an optional write-on animation (GIF/MP4). Use when the user wants 手写笔记 / 手写图 / handwritten notes, study-note cards for Xiaohongshu or Instagram, a handwritten formula, or a "being written" animation. Not for typesetting documents or for a handwriting font file.
---

# handnote · 手写笔记

handnote writes every character with its real strokes (jittered per stroke, pen-pressure ink), lays out TeX with MathJax and redraws every glyph by hand. Same `--seed` → identical output; a new seed writes the page again.

## Setup (once)

```bash
npm install github:rayw-lab/handnote
npx playwright install chromium
```

## One page from text — start here

```bash
npx handnote write "# 标题\n第一行文字，公式写在 \$…\$ 里：\$a=\\frac{F}{m}\$\n\n空行是段落间隔" -o note.png --seed 3
npx handnote write -f notes.txt -o note.png --svg       # long text from a file
```

Rules for the text: `# ` starts a red title line, `$…$` is TeX, a blank line adds space, wrapping is automatic (Chinese per character, English per word). Options: `--size 44` text px, `--width 1080 --height 1440` page (3:4 default), `--plain` for blank paper, `--scale 2` PNG pixel ratio. Characters with no stroke data (rare CJK, emoji) are skipped and listed on stderr — rephrase them.

Too much text for one page? Split it into several `write` calls (one per page) rather than shrinking `--size` below ~36.

## Designed pages — page modules

For notes with highlights, boxed answers and drawings, write a page module (copy `examples/notes.js` from the package as the template) and run:

```bash
npx handnote render my-notes.js -o out/ [--pages 1,3] [--seed 7] [--svg]
```

Each page is `async (c) => {…}` on a 1080×1440 px page, y = text baseline:
`c.T(text,x,y,size,color)`, `c.M(tex,x,y,size,color)`, `c.L(['text',{m:'tex'}],x,y,size)`, `c.hl(x0,x1,yCenter,h,HL.yellow)`, `c.titleRow(title, tag)`, `c.answerBox(result)`, `c.sketch(name,{svg,bbox})` with `handStroke / handArrow / handCircle`, `c.pageNo(n)`. Colors: `INK.red/blue/navy/brown/green/gray`, highlighters `HL.yellow/green/pink/blue`.

## Check your work

`render` prints any overlapping or out-of-page ink boxes and exits with code 3 (images are still written). Fix positions until it exits 0, then **look at the PNG** — the checker only knows bounding boxes, not whether the page reads well.

## Write-on animation

```bash
npx handnote animate --text "# 手写\n\$F=ma\$" -o write.gif
npx handnote animate my-notes.js --page 1 -o page1.mp4 --all     # needs ffmpeg
```

Strokes after `c.live()` in a page module are animated; `--all` writes the whole page from blank. `--live-photo <dir>` (macOS only) also exports an iPhone Live Photo.
