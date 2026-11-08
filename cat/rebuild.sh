#!/usr/bin/env bash
# 改完 md 或 images/ 后跑一次：bash rebuild.sh
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cygpath -m "$(pwd)")"

node images/_src/gen-charts.mjs
node images/_src/render-pngs.mjs
py images/_src/build-single-file.py

CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
if [ ! -x "$CHROME" ]; then
  CHROME="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
fi
if "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --user-data-dir="$ROOT/images/_src/chrome-profile" --virtual-time-budget=8000 \
  --print-to-pdf="$ROOT/CAT-Transaction小时图表详解-单文件.pdf" \
  "file:///$ROOT/CAT-Transaction小时图表详解-单文件.html" 2>"$ROOT/images/_src/chrome.log"; then
  grep -v "externally_managed_app_manager" "$ROOT/images/_src/chrome.log" || true
  if grep -q "Failed to write file" "$ROOT/images/_src/chrome.log"; then
    rm -rf "$ROOT/images/_src/chrome-profile"
    echo "PDF 生成失败：目标文件被占用（常见为 WPS/阅读器预览），关闭后重试" >&2
    exit 1
  fi
else
  cat "$ROOT/images/_src/chrome.log"
  rm -rf "$ROOT/images/_src/chrome-profile"
  echo "PDF 生成失败：若提示文件被占用，请先关闭正在预览该 PDF 的程序再重试" >&2
  exit 1
fi
rm -rf "$ROOT/images/_src/chrome-profile"
echo "rebuilt: 单文件.html + 单文件.pdf"