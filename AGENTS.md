# AGENTS.md

本仓库只做文档：`cat/CAT-Transaction小时图表详解.md` 是一篇讲解 CAT Transaction 小时图表的中文文章，并随仓库提供生成好的单文件 HTML/PDF。仓库内代码只有这套文档构建脚本，没有测试和 lint。

## 构建

在 Git Bash 中任意目录执行（脚本用到 `cygpath`，仅限 Windows）：

```bash
bash cat/rebuild.sh
```

依次执行：
1. `cat/images/_src/gen-charts.mjs` → `cat/images/charts.html`
2. `cat/images/_src/render-pngs.mjs` → `cat/images/fig-*.png`（通过 9333 端口的 CDP 驱动无头 Chrome）
3. `cat/images/_src/build-single-file.py` → `cat/CAT-Transaction小时图表详解-单文件.html`（PNG 以 base64 内联）
4. 无头 Chrome/Edge 打印同名 `.pdf`

环境要求：Node 22+（脚本使用全局 `WebSocket`/`fetch`）、已安装 `markdown` 包的 Python（`py -c "import markdown"`），以及脚本中硬编码路径处的 Chrome 或 Edge。PDF 生成失败时，先关闭正在占用该 PDF 的阅读器（WPS 等）。

## 改动位置

- 图表源码唯一入口是 `cat/images/_src/gen-charts.mjs`。每张图是一个 `<section class="fig" id="fig-...">`；`render-pngs.mjs` 按 section 截图并输出 `<id>.png`。
- 文章源码是 `cat/CAT-Transaction小时图表详解.md`。图片引用必须保持 `![alt](images/foo.png)` 形式；`build-single-file.py` 只内联 `src="images/..."`。
- `cat/images/cat-transaction-real.png` 是 CAT 真实界面截图，不是生成的，不要覆盖。
- `charts.html`、`fig-*.png` 和单文件 `.html`/`.pdf` 虽然是生成物，但都要提交。不要手改；改完源码后重新构建并一并提交。不要提交 `cat/images/_src/chrome.log` 和 Chrome profile 目录。
- 正文使用简体中文，新增文案和图表标签也用中文。

## 注意

- 文章里的 `文件:行号` 指向外部 `dianping/cat` 仓库（master 分支），不是本仓库；这里没有 CAT 的 Java 源码。
- 章节锚点是手写的（`<a id="s0"></a>`），目录也是手写的；增删或调整章节顺序时两处都要改。右下角回到顶部链接指向 `#toc`。
