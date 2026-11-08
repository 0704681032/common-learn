import { writeFileSync } from 'node:fs';

const C = { hits: '#2f7ed8', avg: '#f28e2b', dist: '#17a2a6', fail: '#d64541', ok: '#59a14f', grid: '#e3e6e8', text: '#333', sub: '#777' };
const FONT = `'Microsoft YaHei','PingFang SC',sans-serif`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function frame(w, h, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">${inner}</svg>`;
}
function txt(x, y, s, { size = 12, fill = C.text, anchor = 'start', weight = 'normal', halo = false } = {}) {
  const h = halo ? ` paint-order="stroke" stroke="#fff" stroke-width="4" stroke-linejoin="round"` : '';
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}"${h}>${esc(s)}</text>`;
}
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function axes(w, h, pad, ymax, yLabel, xLabels, { ticks = 4, size = 11 } = {}) {
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  let s = '';
  for (let i = 0; i <= ticks; i++) {
    const y = pad.t + ih - (ih * i) / ticks;
    s += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="${C.grid}" stroke-width="1"/>`;
    s += txt(pad.l - 6, y + 4, fmt((ymax * i) / ticks), { size, fill: C.sub, anchor: 'end' });
  }
  s += `<line x1="${pad.l}" y1="${pad.t + ih}" x2="${w - pad.r}" y2="${pad.t + ih}" stroke="#9aa9b9" stroke-width="1"/>`;
  const n = xLabels.length;
  xLabels.forEach((lb, i) => {
    const x = pad.l + (iw * (i + 0.5)) / n;
    s += txt(x, h - pad.b + 16, lb, { size, fill: C.sub, anchor: 'middle' });
  });
  if (yLabel) s += txt(pad.l - 6, pad.t - 8, yLabel, { size, fill: C.sub, anchor: 'end' });
  return { s, iw, ih, x: i => pad.l + (iw * (i + 0.5)) / n, y: v => pad.t + ih - (ih * v) / ymax };
}
const fmt = v => v >= 10000 ? (v / 1000) + 'k' : (Number.isInteger(v) ? String(v) : v.toFixed(1));

function lineChart({ w = 400, h = 220, values, labels, color, title, yLabel = '', showValues = false, pad = { l: 52, r: 14, t: 30, b: 30 }, size = 11 }) {
  const ymax = niceMax(Math.max(...values) * 1.15);
  const a = axes(w, h, pad, ymax, yLabel, labels, { size });
  let s = a.s;
  const pts = values.map((v, i) => [a.x(i), a.y(v)]);
  s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
  pts.forEach(([x, y], i) => {
    s += `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`;
    if (showValues) s += txt(x, y - 9, fmt(values[i]), { size, fill: color, anchor: 'middle', weight: 'bold' });
  });
  if (title) s += txt(w / 2, 16, title, { size: 13, anchor: 'middle', weight: 'bold' });
  return frame(w, h, s);
}

function barChart({ w = 400, h = 220, values, labels, color, title, yLabel = '', highlight = -1, highlightColor = C.fail, showValues = true, avgLine = null, ymax: fixedMax = null, pad = { l: 52, r: 14, t: 30, b: 30 }, size = 11, annotations = [] }) {
  const ymax = fixedMax ?? niceMax(Math.max(...values, avgLine ?? 0) * 1.15);
  const a = axes(w, h, pad, ymax, yLabel, labels, { size });
  let s = a.s;
  const bw = (a.iw / values.length) * 0.56;
  values.forEach((v, i) => {
    const x = a.x(i) - bw / 2, y = a.y(v);
    s += `<rect x="${x}" y="${y}" width="${bw}" height="${pad.t + a.ih - y}" fill="${i === highlight ? highlightColor : color}" rx="2"/>`;
    if (showValues) s += txt(a.x(i), y - 6, fmt(v), { size, fill: i === highlight ? highlightColor : C.text, anchor: 'middle', weight: 'bold' });
  });
  if (avgLine != null) {
    const y = a.y(avgLine);
    s += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="${C.fail}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
    s += txt(w - pad.r, y - 6, `平均 ${fmt(avgLine)}`, { size, fill: C.fail, anchor: 'end', weight: 'bold', halo: true });
  }
  annotations.forEach(an => { s += txt(an.x, an.y, an.text, { size: an.size ?? size, fill: an.fill ?? C.sub, anchor: an.anchor ?? 'middle', halo: an.halo }); });
  if (title) s += txt(w / 2, 16, title, { size: 13, anchor: 'middle', weight: 'bold' });
  return frame(w, h, s);
}

function hist({ w = 270, h = 210, values, labels, color = C.dist, title, size = 10 }) {
  return barChart({ w, h, values, labels, color, title, yLabel: '次数', showValues: false, pad: { l: 40, r: 8, t: 30, b: 30 }, size });
}

const BUCKETS = ['<16', '16-64', '64-256', '256-1k', '1k-4k', '>4k'];
const MIN = ['0', '10', '20', '30', '40', '50', '59'];
const ramp = (a, b, n = 7) => Array.from({ length: n }, (_, i) => Math.round(a + (b - a) * (i / (n - 1)) ** 1.6));
const flat = (v, n = 7) => Array.from({ length: n }, (_, i) => Math.round(v * (1 + 0.04 * Math.sin(i * 2.1))));

function scenario(name, title, cfg) {
  const cell = (svg, cap) => `<div class="cell">${svg}<div class="cap">${cap}</div></div>`;
  const body = `<div class="grid2">` +
    cell(lineChart({ w: 400, h: 190, values: cfg.hits, labels: MIN, color: C.hits, title: 'Hits Over Time', yLabel: '次数', size: 10, pad: { l: 44, r: 10, t: 26, b: 26 } }), '调用量') +
    cell(lineChart({ w: 400, h: 190, values: cfg.avg, labels: MIN, color: C.avg, title: 'Average Duration Over Time', yLabel: 'ms', size: 10, pad: { l: 44, r: 10, t: 26, b: 26 } }), '平均耗时') +
    cell(hist({ w: 400, h: 190, values: cfg.dist, labels: BUCKETS, title: 'Duration Distribution', size: 10 }), '耗时结构（ms）') +
    cell(lineChart({ w: 400, h: 190, values: cfg.fail, labels: MIN, color: C.fail, title: 'Failures Over Time', yLabel: '次数', size: 10, pad: { l: 44, r: 10, t: 26, b: 26 } }), '失败次数') +
    `</div>`;
  return section(name, title, body, 840);
}

function section(id, title, body, width = 860) {
  return `<section class="fig" id="${id}" role="img" aria-label="${id}" style="width:${width}px"><div class="fig-title">${title}</div>${body}</section>`;
}
const row = (...svgs) => `<div class="row">${svgs.map(s => `<div class="cell">${s}</div>`).join('')}</div>`;

const figs = [];

figs.push(section('fig-analogy', '奶茶店比喻：一个 Transaction = 制作一杯奶茶', `
<div class="cards">
  <div class="card"><div class="emoji-free big">客流量</div><div class="map">Hits Over Time</div><div class="q">每分钟接了多少单？</div></div>
  <div class="card"><div class="big">平均出餐时间</div><div class="map">Average Duration Over Time</div><div class="q">每分钟平均多久做好一杯？</div></div>
  <div class="card"><div class="big">出餐时长分布</div><div class="map">Duration Distribution</div><div class="q">订单分别落在哪些制作时长区间？</div></div>
  <div class="card"><div class="big">做砸 / 退单数</div><div class="map">Failures Over Time</div><div class="q">每分钟做砸或退了多少单？</div></div>
</div>`, 860));

figs.push(section('fig-hits-spike', '§3.2 Hits Over Time：调用量突增示例', row(
  barChart({ w: 500, h: 260, values: [1000, 1200, 9000], labels: ['10:00', '10:01', '10:02'], color: C.hits, highlight: 2, yLabel: '执行次数', title: '每分钟执行次数（成功+失败都计入）' }),
  `<div class="note" style="width:300px"><b>10:02 从 1200 跳到 9000</b><br><br>可能原因：<br>· 业务流量增长 / 促销开始<br>· 定时任务集中触发<br>· 上游服务重试<br>· 异常循环调用<br><br>Hits 本身不代表异常，它为其他三张图提供<b>流量背景</b>。</div>`
), 860));

figs.push(section('fig-avg-example', '§4.2 Average Duration：计算示例与恶化趋势', row(
  barChart({ w: 400, h: 250, values: [100, 200, 600], labels: ['请求A', '请求B', '请求C'], color: C.avg, yLabel: 'ms', avgLine: 300, title: '(100+200+600) ÷ 3 = 300ms' }),
  lineChart({ w: 420, h: 250, values: [80, 90, 300, 800, 1500], labels: ['10:00', '10:01', '10:02', '10:03', '10:04'], color: C.avg, yLabel: 'ms', showValues: true, title: '平均耗时持续上升 = 整体在恶化' })
), 860));

figs.push(section('fig-avg-mask', '§4.3 陷阱一：平均数掩盖个体差异', row(
  barChart({
    w: 560, h: 300, values: [100, 100, 100, 100, 100, 100, 100, 100, 100, 9100],
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], color: C.avg, highlight: 9,
    yLabel: 'ms', avgLine: 1000, title: '10 次请求：9 次 100ms + 1 次 9100ms',
    annotations: [{ x: 150, y: 250, text: '9 个请求其实很快', fill: C.sub }]
  }),
  `<div class="note" style="width:240px"><b>平均 = 1000ms</b><br><br>但真实体验是：<br>9 个请求 100ms（快）<br>1 个请求 9100ms（极慢）<br><br>平均耗时<b>不能代替 P95 / P99</b>，也看不到长尾。<br><br>→ 需要 Duration Distribution 补位。</div>`
), 860));

figs.push(section('fig-fast-fail', '§4.4 陷阱二：平均耗时下降 ≠ 变快（示意）', row(
  barChart({ w: 200, h: 230, values: [500], labels: ['原来'], color: C.avg, yLabel: 'ms', ymax: 600, title: '平均耗时 500ms' }),
  barChart({ w: 200, h: 230, values: [20], labels: ['现在'], color: C.avg, yLabel: 'ms', ymax: 600, title: '平均耗时 20ms' }),
  barChart({ w: 200, h: 230, values: [60], labels: ['原来'], color: C.fail, yLabel: '次数', ymax: 1000, showValues: false, title: '失败很少', annotations: [{ x: 100, y: 180, text: '很少', fill: C.fail }] }),
  barChart({ w: 200, h: 230, values: [900], labels: ['现在'], color: C.fail, yLabel: '次数', ymax: 1000, showValues: false, title: '失败很多', annotations: [{ x: 100, y: 40, text: '很多', fill: C.fail, halo: true }] })
), 860));

figs.push(section('fig-dist-shapes', '§5.2 Duration Distribution：三种典型形态', row(
  hist({ w: 270, h: 230, values: [760, 200, 35, 5, 0, 0], labels: BUCKETS, title: '情况一：集中低耗时（健康）' }),
  hist({ w: 270, h: 230, values: [30, 90, 220, 360, 240, 60], labels: BUCKETS, title: '情况二：整体右移（普遍变慢）' }),
  hist({ w: 270, h: 230, values: [640, 220, 70, 30, 18, 22], labels: BUCKETS, title: '情况三：右侧长尾（少数极慢）' })
), 860));

figs.push(section('fig-fail-rate', '§6.2 失败次数相同 ≠ 严重程度相同', `
<div class="rate-wrap">
  ${[['调用量 100', 10, '10%'], ['调用量 10000', 10, '0.1%']].map(([lab, fails, rate]) => {
    const pct = parseFloat(rate);
    const w = 700, h = 46, fw = Math.max(w * pct / 100, 3);
    return `<div class="rate-row"><div class="rate-lab">${lab}<br>失败 ${fails} 次</div>
    <svg width="${w}" height="${h + 22}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
      <rect x="0" y="0" width="${w}" height="${h}" fill="${C.ok}" rx="4"/>
      <rect x="0" y="0" width="${fw}" height="${h}" fill="${C.fail}" rx="2"/>
      ${txt(w / 2, h / 2 + 5, `成功 ${100 - pct}%`, { size: 13, fill: '#fff', anchor: 'middle' })}
      ${txt(0, h + 16, `失败率 ${rate}`, { size: 13, fill: C.fail, weight: 'bold' })}
    </svg></div>`;
  }).join('')}
  <div class="note">红色 = 失败占比。失败次数都是 10，但失败率差 <b>100 倍</b>。<br>分钟失败率 ≈ 当分钟失败次数 ÷ 当分钟执行总次数（结合同一分钟的 Hits）。</div>
</div>`, 860));

figs.push(scenario('fig-scenario-1', '§7.1 场景一：流量暴涨，系统逐渐扛不住', {
  hits: ramp(1000, 9000), avg: ramp(80, 1500), dist: [30, 90, 220, 360, 240, 60], fail: [0, 0, 2, 10, 60, 220, 600]
}));
figs.push(scenario('fig-scenario-2', '§7.2 场景二：流量没变，但系统变慢', {
  hits: flat(3000), avg: ramp(80, 900), dist: [120, 200, 260, 240, 140, 40], fail: flat(2)
}));
figs.push(scenario('fig-scenario-3', '§7.3 场景三：平均耗时下降，但发生故障（快速失败）', {
  hits: flat(3000), avg: [500, 480, 300, 60, 20, 20, 20], dist: [820, 140, 30, 8, 2, 0], fail: [0, 2, 40, 300, 800, 850, 820]
}));
figs.push(scenario('fig-scenario-4', '§7.4 场景四：平均耗时正常，但少数用户非常慢', {
  hits: flat(3000), avg: flat(120), dist: [640, 220, 70, 30, 18, 22], fail: flat(1)
}));

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
body{margin:0;background:#f5f6f8;font-family:${FONT};color:${C.text}}
.fig{background:#fff;margin:16px auto;padding:14px 16px 16px;border:1px solid #e9ecef;border-radius:8px;box-sizing:content-box}
.fig-title{font-size:16px;font-weight:bold;margin:0 0 10px}
.row{display:flex;gap:14px;align-items:flex-start;justify-content:center}
.cell{display:flex;flex-direction:column;align-items:center}
.cap{font-size:11px;color:${C.sub};margin-top:2px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}
.note{font-size:13px;line-height:1.7;color:${C.text};background:#fafbfc;border:1px solid #eef1f3;border-radius:6px;padding:12px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.card{border:1px solid #e3e6e8;border-radius:8px;padding:14px 10px;text-align:center;background:#fafbfc}
.card .big{font-size:17px;font-weight:bold}
.card .map{font-size:12px;color:${C.hits};margin:8px 0 6px;font-weight:bold}
.card .q{font-size:12px;color:${C.sub}}
.rate-wrap{padding:4px 8px}
.rate-row{display:flex;align-items:center;gap:14px;margin:10px 0}
.rate-lab{width:110px;font-size:13px;line-height:1.5}
</style></head><body>${figs.join('\n')}</body></html>`;

writeFileSync(new URL('../charts.html', import.meta.url), html);
console.log('wrote charts.html with', figs.length, 'figures');