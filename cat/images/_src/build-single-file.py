import base64
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[2]
MD = ROOT / "CAT-Transaction小时图表详解.md"
OUT = ROOT / "CAT-Transaction小时图表详解-单文件.html"

text = MD.read_text(encoding="utf-8")
body = markdown.markdown(text, extensions=["tables", "fenced_code"])


def inline(m):
    p = ROOT / m.group(1)
    return 'src="data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode() + '"'


body = re.sub(r'src="(images/[^"]+)"', inline, body)
title = text.splitlines()[0].lstrip("# ")

html = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
html{{scroll-behavior:smooth}}
.top{{position:fixed;right:14px;bottom:18px;background:#2f7ed8;color:#fff;text-decoration:none;font-size:13px;padding:8px 14px;border-radius:20px;box-shadow:0 2px 8px rgba(0,0,0,.25)}}
body{{margin:0 auto;padding:20px 16px 48px;max-width:860px;font:16px/1.8 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#24292f;background:#fff}}
h1{{font-size:25px;line-height:1.4}}
h2{{font-size:20px;margin-top:34px;padding-bottom:6px;border-bottom:1px solid #eaecef}}
h3{{font-size:17px;margin-top:24px}}
h4{{font-size:15px}}
img{{max-width:100%;height:auto;display:block;margin:14px auto;border:1px solid #eaecef;border-radius:6px}}
p>em:only-child{{display:block;font-size:13px;color:#57606a;margin-top:-6px}}
table{{border-collapse:collapse;width:100%;font-size:14px;margin:12px 0}}
th,td{{border:1px solid #d0d7de;padding:6px 9px;text-align:left}}
th{{background:#f6f8fa}}
code{{background:#f6f8fa;border-radius:4px;padding:2px 5px;font-size:13px;font-family:Consolas,Menlo,monospace}}
pre{{background:#f6f8fa;border-radius:6px;padding:12px;overflow-x:auto}}
pre code{{background:none;padding:0}}
blockquote{{margin:14px 0;padding:8px 14px;border-left:4px solid #bfd6ee;background:#f8fafc;color:#444}}
blockquote p{{margin:6px 0}}
hr{{border:none;border-top:1px solid #eaecef;margin:28px 0}}
@media screen and (max-width:600px){{table{{display:block;overflow-x:auto}}body{{font-size:15px}}}}
@page{{size:A4;margin:14mm 12mm}}
@media print{{body{{max-width:none;padding:0;font-size:12px}}img,table,pre,blockquote{{break-inside:avoid}}h1,h2,h3,h4{{break-after:avoid}}p>em:only-child{{break-before:avoid}}.top{{display:none}}}}
</style>
</head>
<body>
{body}
<a class="top" href="#toc">↑ 目录</a>
</body>
</html>
"""
OUT.write_text(html, encoding="utf-8")
print("wrote", OUT.name, f"{OUT.stat().st_size / 1024 / 1024:.2f} MB")