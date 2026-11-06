# Third-party notices · 第三方声明

handnote's own code is MIT (see `LICENSE`). It does **not** bundle any font or stroke data;
the packages below are installed as dependencies (or loaded from jsDelivr in the browser),
each under its own license.

handnote 自己的代码用 MIT。仓库里**不打包**任何字体或笔画数据，下面这些都是作为依赖安装
（浏览器里从 jsDelivr 加载），各自适用自己的许可证。

| What · 内容 | Package · 包 | License · 许可 | Notes |
|---|---|---|---|
| Chinese stroke medians · 汉字笔画中线 | [`hanzi-writer-data`](https://github.com/chanind/hanzi-writer-data) | [Arphic Public License](https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/ARPHICPL.TXT) | Derived by [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) from fonts released by Arphic Technology. If you redistribute this data (e.g. bundle it), keep the APL with it. |
| Latin / digit / symbol single-line font · 拉丁字母与数字单线字 | [`hersheytext`](https://github.com/techninja/hersheytextjs) (EMS Tech) | package MIT; EMS fonts by Evil Mad Scientist Laboratories under SIL OFL 1.1 | |
| Pen-pressure outlines · 笔压轮廓 | [`perfect-freehand`](https://github.com/steveruizok/perfect-freehand) | MIT | |
| Formula layout · 公式排版 | [`mathjax`](https://github.com/mathjax/MathJax), `@mathjax/mathjax-newcm-font` | Apache-2.0 | Used only to position glyphs; every glyph is re-drawn by hand strokes. |
| Live Photo pairing scripts | [pengchujin/livecanvas](https://github.com/pengchujin/livecanvas) | MIT | vendored unchanged |
| Headless rendering (CLI) · 命令行出图 | [`playwright`](https://github.com/microsoft/playwright) | Apache-2.0 | |
