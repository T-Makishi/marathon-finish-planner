import { Plan, PACE_STYLES, COMPARISON_GOALS } from "./model";
import { calculate, Calculation, cardPoints, pointLabel, elapsed, clockText, marginText, paceText, numberValue, duration } from "./engine";

export const htmlEscape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const printedTotal = (plan: Plan, result: Calculation) => plan.cardClock === 'gun' ? result.actualGun : result.actualNet;
export const printedBasis = (plan: Plan) => plan.cardClock === 'gun' ? '号砲からの累計' : 'ネット累計';
export function comparisonResults(plan: Plan): Calculation[] {
  return plan.comparison.map(target => calculate({ ...plan, intent: 'target', inputKind: 'time', target, timeBasis: plan.timeBasis }));
}
// Carry cards include registered checkpoints only when checkpoint display is enabled.
function showCardGates(plan: Plan) { return plan.showGates || plan.intent === 'finish'; }
function gatesAt(plan: Plan, point: number) { return showCardGates(plan) ? plan.gates.filter(g => Math.round(numberValue(g.km) * 1e6) === point) : []; }
function pointHeight(plan: Plan, point: number, wrist: boolean) { return (wrist ? 6.5 : 5.2) + gatesAt(plan, point).length * 3.2; }
export function displayPoints(plan: Plan): number[] { return [...new Set([...cardPoints(numberValue(plan.distance)), ...(showCardGates(plan) ? plan.gates.map(g => Math.round(numberValue(g.km) * 1e6)) : [])])].sort((a, b) => a - b); }
export function cardTime(plan: Plan, result: Calculation, point: number): string {
  if (point === 0) return elapsed(plan.cardClock === 'gun' ? result.start - result.gun : 0);
  const row = result.rows.find(r => r.mm === point);
  return row ? elapsed(row.pass + (plan.cardClock === 'gun' ? result.start - result.gun : 0)) : '—';
}
export function exportProblems(plan: Plan): string[] {
  const result = calculate(plan), errors = [...result.errors];
  if (plan.raceName.length > 60 || plan.name.length > 40) errors.push('カード用の大会名は60文字以内、計画名は40文字以内にしてください。');
  const wrist = plan.cardFormat === 'wrist';
  if (displayPoints(plan).some(p => pointHeight(plan, p, wrist) > (wrist ? 145 : 120.5))) errors.push('同じ距離の関門が多すぎます。関門を整理してください。');
  if (plan.cardNotes && plan.stops.some(s => s.memo.length > 80)) errors.push('印刷する補給メモは80文字以内にしてください。');
  if (plan.gates.some(g => g.name.length > 40)) errors.push('印刷する関門名は40文字以内にしてください。');
  if (plan.cardTerrain && plan.terrain.some(t => t.memo.length > 120)) errors.push('印刷するコースメモは120文字以内にしてください。');
  if (!result.canPrint && !errors.length) errors.push('締切を超える、または締切ちょうどの計画です。配分を見直してください。');
  if (plan.cardMode !== 'single') comparisonResults(plan).forEach((r, i) => { if (r.errors.length || !r.canPrint) errors.push(`${COMPARISON_GOALS[i].label}：${r.errors[0] || '締切超過または締切境界です。'}`); });
  if (plan.cardMode !== 'single') {
    const times = plan.comparison.map(duration);
    if (times.every(Number.isFinite) && !(times[0] < times[1] && times[1] < times[2])) errors.push('比較目標は、挑戦目標・本命目標・堅実目標の順にタイムを長くしてください。');
  }
  return errors;
}
export type CarryCard = { kind: 'single' | 'compare'; width: number; height: number; points: number[]; part: number; parts: number };
export type DetailTable = { title: string; subtitle: string; headers: string[]; widths: number[]; rows: string[][]; heights: number[]; continuation: number; emphasizeDeadline?: boolean[] };
export type PrintPage = { kind: 'cards'; cards: CarryCard[]; folded?: boolean } | { kind: 'detail'; tables: DetailTable[] };
export type PrintLayout = { pages: PrintPage[]; width: number; height: number; cardCount: number; detailCount: number; warnings: string[] };
const chunks = <T,>(values: T[], size: number): T[][] => Array.from({ length: Math.ceil(values.length / size) }, (_, i) => values.slice(i * size, (i + 1) * size));
// Explicit line breaks make supplemental table heights independent of browser font wrapping.
function wrap(text: string, widthMm: number): string[] {
  const capacity = Math.max(5, Math.floor((widthMm - 4) / 1.8));
  const lines: string[] = []; let line = '', units = 0;
  for (const ch of text) {
    const weight = ch.codePointAt(0)! > 255 ? 2 : 1;
    if (ch === '\n' || units + weight > capacity) { lines.push(line); line = ''; units = 0; }
    if (ch !== '\n') { line += ch; units += weight; }
  }
  lines.push(line); return lines;
}
const DETAIL_PAGE_HEIGHT = 240;
const DETAIL_SECTION_OVERHEAD = 36; // Title, up to two subtitle lines, column headings and spacing (mm).
function detailTables(title: string, subtitle: string, headers: string[], widths: number[], rawRows: string[][], emphasizeDeadline?: boolean[]): DetailTable[] {
  if (!rawRows.length) return [];
  const rows = rawRows.map(raw => raw.map((text, i) => wrap(text, widths[i]).join('\n')));
  const heights = rows.map(row => Math.max(...row.map(cell => cell.split('\n').length)) * 4.2 + 3);
  return [{ title, subtitle, headers, widths, rows, heights, continuation: 1, ...(emphasizeDeadline ? { emphasizeDeadline } : {}) }];
}
function packDetails(tables: DetailTable[]): PrintPage[] {
  const pages: PrintPage[] = [];
  let current: DetailTable[] = [], used = 0;
  const flush = () => { if (current.length) pages.push({ kind: 'detail', tables: current }); current = []; used = 0; };
  for (const table of tables) {
    const total = DETAIL_SECTION_OVERHEAD + table.heights.reduce((a, b) => a + b, 0);
    if (total <= DETAIL_PAGE_HEIGHT && used + total > DETAIL_PAGE_HEIGHT) flush();
    let start = 0, continuation = 1;
    while (start < table.rows.length) {
      if (used + DETAIL_SECTION_OVERHEAD + table.heights[start] > DETAIL_PAGE_HEIGHT) flush();
      let end = start, height = DETAIL_SECTION_OVERHEAD;
      while (end < table.rows.length && used + height + table.heights[end] <= DETAIL_PAGE_HEIGHT) height += table.heights[end++];
      if (end === start) throw new Error('追加資料の1行が用紙に収まりません。メモを短くしてください。');
      current.push({ ...table, rows: table.rows.slice(start, end), heights: table.heights.slice(start, end), continuation: continuation++, ...(table.emphasizeDeadline ? { emphasizeDeadline: table.emphasizeDeadline.slice(start, end) } : {}) });
      used += height; start = end;
      if (start < table.rows.length) flush();
    }
  }
  flush(); return pages;
}
export function buildPrintLayout(plan: Plan): PrintLayout {
  const isWrist = plan.cardFormat === 'wrist';
  const width = isWrist ? (plan.cardMode === 'compare' ? 70 : 50) : 85;
  const rowLimit = isWrist ? 145 : 120.5;
  const groups: number[][] = []; let group: number[] = [], used = 0;
  for (const point of displayPoints(plan)) {
    const height = pointHeight(plan, point, isWrist);
    if (group.length && used + height > rowLimit + 0.001) { groups.push(group); group = []; used = 0; }
    group.push(point); used += height;
  }
  if (group.length) groups.push(group);
  const cardHeight = (points: number[]) => {
    if (isWrist) return Math.min(195, Math.max(180, Math.ceil((50 + points.reduce((sum, point) => sum + pointHeight(plan, point, true), 0)) * 2) / 2));
    const rowHeight = points.reduce((sum, point) => sum + pointHeight(plan, point, false), 0);
    return Math.min(195, Math.ceil(Math.max(135, 135 + rowHeight - 60.5) * 2) / 2);
  };
  const cards: CarryCard[] = [];
  for (const [i, points] of groups.entries()) {
    for (const kind of ['single', 'compare'] as const) {
      if (plan.cardMode !== 'both' && plan.cardMode !== kind) continue;
      cards.push({ kind, width: isWrist && kind === 'compare' ? 70 : width, height: cardHeight(points), points, part: i + 1, parts: groups.length });
    }
  }
  const height = cards.length ? Math.max(...cards.map(card => card.height)) : isWrist ? 180 : 135;
  const pages: PrintPage[] = [];
  if (isWrist) {
    let current: CarryCard[] = [], usedWidth = 0;
    for (const card of cards) {
      if (current.length && usedWidth + 8 + card.width > 186) { pages.push({ kind: 'cards', cards: current }); current = []; usedWidth = 0; }
      usedWidth += (current.length ? 8 : 0) + card.width; current.push(card);
    }
    if (current.length) pages.push({ kind: 'cards', cards: current });
  } else pages.push(...chunks(cards, 2).map(cards => ({ kind: 'cards' as const, cards, folded: plan.cardMode === 'both' })));
  const result = calculate(plan), results = plan.cardMode === 'single' ? [result] : plan.cardMode === 'compare' ? comparisonResults(plan) : [result, ...comparisonResults(plan)];
  const resultLabels = plan.cardMode === 'single' ? ['本番案'] : plan.cardMode === 'compare' ? COMPARISON_GOALS.map(g => g.label) : ['本番案', ...COMPARISON_GOALS.map(g => g.label)];
  const warnings: string[] = [];
  if (!isWrist && height > 135) warnings.push(`全地点を1枚に収めるため、カードの高さを${height}mmに延長しました。`);
  if (groups.length > 1) warnings.push('全地点を最大サイズの1枚に収められないため、情報を欠落させず複数枚に分けました。');
  const details: DetailTable[] = [];
  if (plan.cardGates) {
    const sortedGates = [...plan.gates].sort((a, b) => numberValue(a.km) - numberValue(b.km));
    const emphasized = sortedGates.map(g => g.kind === 'official');
    if (plan.limit) emphasized.push(true);
    const rows = sortedGates.map(g => [
      `${numberValue(g.km) === 0 ? "スタート (0km)" : `${g.km}km`}\n${g.name}\n${g.kind === 'advisory' ? '参考・勧告' : '正式関門'}`,
      `${numberValue(g.day) ? `翌${g.day}日 ` : ''}${g.time}`,
      results.map((r, i) => `${resultLabels[i]} ${clockText(r.gates.find(x => x.gate.id === g.id)?.absolute ?? NaN)}`).join('\n'),
      results.map((r, i) => `${resultLabels[i]} ${marginText(r.gates.find(x => x.gate.id === g.id)?.margin ?? NaN)}`).join('\n'),
    ]);
    if (plan.limit) rows.push(['ゴール制限', clockText(result.gun + duration(plan.limit)), results.map((r, i) => `${resultLabels[i]} ${clockText(r.start + r.actualNet)}`).join('\n'), results.map((r, i) => `${resultLabels[i]} ${marginText(r.finishMargin ?? NaN)}`).join('\n')]);
    details.push(...detailTables('関門・制限時間の確認表', '締切・通過予定は時刻。余裕は登録情報に基づく計算です。', ['地点・区分', '締切時刻', '通過予定時刻', '残り余裕'], [51, 31, 52, 52], rows, emphasized));
    if (!rows.length) warnings.push('関門・制限時間が未登録のため、関門一覧は出力しません。');
  }
  if (plan.cardNotes) {
    details.push(...detailTables('補給・停止の計画', '停止時間はペースカードの累計に反映されています。', ['地点', '停止時間', '関門との順序', 'メモ'], [23, 26, 48, 89], [...plan.stops].sort((a, b) => numberValue(a.km) - numberValue(b.km)).map(s => [`${s.km}km`, `${s.seconds}秒`, s.afterGate ? '同地点の関門通過後' : '同地点の関門通過前', s.memo])));
  }
  if (plan.cardTerrain) {
    details.push(...detailTables('コース補正の設定', plan.elevation ? 'この補正を計画に適用しています。' : '補正はOFFです。下記は保存済み設定で、計画には適用していません。', ['区間', '補正', 'メモ'], [38, 33, 115], plan.terrain.map(t => [`${t.start}〜${t.end}km`, `${numberValue(t.adjustment) > 0 ? '+' : ''}${t.adjustment}秒/km`, t.memo])));
  }
  pages.push(...packDetails(details));
  return { pages, width, height, cardCount: plan.cardMode === 'both' && !isWrist ? cards.length / 2 : cards.length, detailCount: pages.filter(p => p.kind === 'detail').length, warnings };
}
export function buildCardHtml(plan: Plan, createdAt = new Date().toISOString(), options: { previewPage?: number; preview?: boolean } = {}): string {
  const errors = exportProblems(plan); if (errors.length) throw new Error(errors.join('\n'));
  const result = calculate(plan), comparison = comparisonResults(plan), layout = buildPrintLayout(plan), esc = htmlEscape;
  const basis = printedBasis(plan);
  const card = (c: CarryCard) => {
    const values = c.kind === 'single' ? [result] : comparison;
    const totals = values.map(r => elapsed(printedTotal(plan, r)));
    const other = plan.cardClock === 'gun' ? `ネット ${elapsed(result.actualNet)}` : `号砲から ${elapsed(result.actualGun)}`;
    const styleLabel = c.kind === 'single' && plan.intent === 'finish' ? '制限完走に合わせた配分' : PACE_STYLES.find(s => s.id === plan.style)!.label;
    const correction = !plan.terrain.some(t => numberValue(t.adjustment) !== 0) ? '未設定' : plan.elevation ? 'ON' : 'OFF';
    const averages = c.kind === 'single'
      ? `<div class="foot-average">移動平均 ${paceText(result.averagePace)}/km</div>`
      : `<div class="foot-average-label">移動平均（分/km）</div><div class="foot-averages">${comparison.map((r, i) => `<span><small>${COMPARISON_GOALS[i].short}</small><b>${paceText(r.averagePace)}</b></span>`).join('')}</div>`;
    if (plan.cardFormat === 'wrist') {
      return `<section class="carry wrist-strip ${c.kind}" data-card="${c.kind}" style="width:${c.width}mm;height:${c.height}mm"><div class="strip-head"><div class="eyebrow">手首用・${c.kind === 'single' ? '累計時間' : '3目標比較'} ${c.parts > 1 ? `${c.part}/${c.parts}` : ''}</div><h2>${esc(plan.raceName)}</h2><div class="date">${esc(plan.date)}</div><div class="basis">${esc(basis)}</div></div><table class="pace"><colgroup>${c.kind === 'single' ? '<col style="width:35%"><col style="width:65%">' : '<col style="width:22%"><col style="width:26%"><col style="width:26%"><col style="width:26%">'}</colgroup><thead><tr><th>距離</th>${c.kind === 'single' ? '<th>累計時間</th>' : COMPARISON_GOALS.map(g => `<th>${g.label}</th>`).join('')}</tr></thead><tbody>${c.points.map(p => `<tr data-point="${p}" style="height:${pointHeight(plan, p, true)}mm"><th>${esc(pointLabel(p / 1e6, numberValue(plan.distance)))}${gatesAt(plan, p).map(g => `<span class="gate-deadline"><span class="${g.kind === 'official' ? 'deadline-highlight' : 'deadline-reference'}">${g.kind === 'advisory' ? '参考' : '関門'} ${numberValue(g.day) ? `翌${g.day}日 ` : ''}${esc(g.time)}</span></span>`).join('')}</th>${values.map(r => `<td>${cardTime(plan, r, p)}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="card-foot strip-end">RUN FINISH PLANNER</div></section>`;
    }
    const cols = c.kind === 'single' ? '<col style="width:35%"><col style="width:65%">' : '<col style="width:22%"><col style="width:26%"><col style="width:26%"><col style="width:26%">';
    return `<section class="carry ${c.kind}${c.width === 50 ? ' wrist' : ''}" data-card="${c.kind}" style="width:${c.width}mm;height:${c.height}mm"><div class="card-head"><div class="eyebrow">${c.kind === 'single' ? '当日のペースカード' : '3案比較カード'} ${c.parts > 1 ? `${c.part}/${c.parts}` : ''}</div><h2>${esc(plan.raceName)}</h2><div class="date">${esc(plan.date || '開催日未入力')}</div></div><div class="card-summary"><div class="basis">${esc(basis)}</div>${c.kind === 'single' ? `<div class="finish-pair"><strong class="finish-time">${totals[0]}</strong><span class="other-time">${esc(other).replace(" ", "<br>")}</span></div>` : `<div class="comparison-goals">${totals.map((t, i) => `<span><small>${COMPARISON_GOALS[i].label}</small><b>${t}</b></span>`).join('')}</div>`}</div><table class="pace"><colgroup>${cols}</colgroup><thead><tr><th>距離</th>${c.kind === 'single' ? '<th>累計時間</th>' : COMPARISON_GOALS.map(g => `<th>${g.short}</th>`).join('')}</tr></thead><tbody>${c.points.map(p => `<tr data-point="${p}" style="height:${pointHeight(plan, p, c.width === 50)}mm"><th>${esc(pointLabel(p / 1e6, numberValue(plan.distance)))}${gatesAt(plan, p).map(g => `<span class="gate-deadline"><span class="${g.kind === 'official' ? 'deadline-highlight' : 'deadline-reference'}">${g.kind === 'advisory' ? '参考' : '関門'} ${numberValue(g.day) ? `翌${g.day}日 ` : ''}${esc(g.time)}</span></span>`).join('')}</th>${values.map(r => `<td>${cardTime(plan, r, p)}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="card-foot"><div class="foot-style">${esc(styleLabel)}</div>${averages}<div class="foot-meta">コース補正：${correction} · RUN FINISH PLANNER</div></div></section>`;
  };
  const renderedPages = layout.pages.map((page, index) => {
    if (options.previewPage !== undefined && index !== options.previewPage) return '';
    const title = page.kind === 'cards' ? (plan.cardFormat === 'wrist' ? '手首用ペースカード' : '携帯用ペースカード') : '大会当日の確認資料';
    const pageHeight = page.kind === 'cards' ? Math.max(...page.cards.map(c => c.height)) : layout.height;
    const sub = page.kind === 'cards' ? page.folded ? `二つ折り1枚 ／ 広げて170 × ${pageHeight}mm → 折って85 × ${pageHeight}mm` : `各カードの寸法は切り取り枠の上に表示 ／ このページは${page.cards.length}枚` : `${plan.raceName} ／ ${plan.name}`;
    return `<article class="sheet" data-page="${index + 1}"><div class="sheet-head"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><b>${index + 1} / ${layout.pages.length}</b></div>${page.kind === 'cards' ? `<div class="cut-guide"><span>${page.folded ? '外周の破線だけを切り取る。中央は切らずに山折り。' : '外周の破線で切り取り、100%で印刷してください。'}</span><span class="scale">50mm</span></div><div class="card-grid">${page.folded ? `<div class="fold-unit"><div class="fold-labels"><span>表面：本番案</span><span>裏面：3目標比較</span></div><div class="fold-card" style="height:${pageHeight}mm">${page.cards.map(c => card(c)).join('')}<div class="fold-line"><span>折り線・切らない</span></div></div></div>` : page.cards.map(c => `<div class="card-wrap"><div class="dimension">${c.kind === 'single' ? '本番案' : '比較用'} · ${c.width} × ${c.height}mm</div>${card(c)}</div>`).join('')}</div><div class="page-note">${page.folded ? '<strong>外周のみ切り取り → 印刷面を外側にして中央を山折り（中央は切らない）</strong><br>' : ''}${esc(plan.name)} ／ ${esc(basis)}<br>関門の締切は表内の時刻表示です。補給・補正の詳細は選択した場合に別紙で出力します。<br>大会の最新要項を確認し、切り取ったカードの読みやすさを確かめてください。</div>` : page.tables.map(table => `<section class="detail-section"><h2>${esc(table.title)}${table.continuation > 1 ? `（続き ${table.continuation}）` : ''}</h2><p class="detail-subtitle">${esc(table.subtitle)}</p><table class="detail${table.title === '関門・制限時間の確認表' ? ' gate-table' : ''}"><colgroup>${table.widths.map(w => `<col style="width:${w}mm">`).join('')}</colgroup><thead><tr>${table.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row, i) => `<tr style="height:${table.heights[i]}mm">${row.map((cell, column) => `<td>${column === 1 && table.emphasizeDeadline?.[i] ? `<span class="deadline-highlight">${esc(cell).replace(/\n/g, '<br>')}</span>` : esc(cell).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('')}<div class="sheet-foot"><span>PCSAPO / マキシ企画</span><span>作成 ${esc(createdAt.slice(0, 10))} · ${index + 1}/${layout.pages.length}</span></div></article>`;
  }).join('');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=794"><title>${esc(plan.raceName)} 早見カード</title><style>
*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#e9eeea;color:#172923;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Noto Sans CJK JP',sans-serif}button{font:inherit}.toolbar{max-width:210mm;margin:20px auto;padding:20px;background:#fff;border-radius:12px;font-size:14px;line-height:1.7}.toolbar h1{font-size:20px;margin:0 0 8px}.toolbar button{background:#164d3c;color:white;border:0;border-radius:7px;padding:12px 20px;font-weight:700;cursor:pointer}.toolbar strong{color:#164d3c}.toolbar .print-error{color:#9d3023;margin:8px 0}.sheet{width:210mm;height:297mm;padding:12mm;background:white;margin:0 auto 8mm;position:relative;break-after:page;page-break-after:always}.sheet:last-of-type{break-after:auto;page-break-after:auto}.sheet-head{display:flex;justify-content:space-between;align-items:flex-start;height:20mm;border-bottom:0.25mm solid #becbc4}.sheet-head h1{font-size:15pt;margin:0 0 2mm;font-weight:750}.sheet-head p{font-size:9pt;margin:0;line-height:1.5}.sheet-head>b{font-size:10pt}.cut-guide{height:14mm;display:flex;align-items:center;justify-content:space-between;font-size:8pt}.scale{width:50mm;height:6mm;border:solid #172923;border-width:0 0.25mm 0.4mm;text-align:center;font-size:8pt;line-height:5mm}.card-grid{display:flex;align-items:flex-start;gap:8mm}.card-wrap{flex:none}.fold-unit{flex:none;width:170mm}.fold-labels{display:flex;height:6mm;font-size:8pt;line-height:5mm;color:#52645a}.fold-labels>span{width:85mm}.fold-labels>span:last-child{text-align:right}.fold-card{display:flex;position:relative;width:170mm;height:135mm;outline:.25mm dashed #596c60}.fold-card .carry{border:0;flex:none}.fold-line{position:absolute;left:85mm;top:0;bottom:0;border-left:.25mm solid #596c60;pointer-events:none}.fold-line>span{position:absolute;top:-5mm;left:0;transform:translateX(-50%);white-space:nowrap;font-size:8pt;line-height:4mm;font-weight:700;background:white;padding:0 1mm}.gate-table td:nth-child(2){font-weight:750}.dimension{height:6mm;line-height:5mm;font-size:8pt;color:#52645a}.carry{border:.25mm dashed #596c60;padding:4mm;background:white;position:relative;font-variant-numeric:tabular-nums}.card-head{height:19mm}.eyebrow{font-size:8pt;font-weight:700;line-height:4mm;color:#52645a}h2{font-size:10pt;line-height:4mm;margin:1mm 0;font-weight:750;overflow-wrap:anywhere}.date{font-size:8pt;line-height:4mm}.card-summary{height:17mm;border-top:.3mm solid #1b392c;padding-top:2mm}.basis{font-size:8pt;font-weight:700;line-height:4mm}.finish-time{font-size:22pt;line-height:10mm;letter-spacing:.2mm}.finish-pair{display:flex;align-items:center;gap:3mm}.other-time{font-size:10pt;font-weight:700;display:block;line-height:4mm}.gate-deadline{display:block;font-size:7pt;line-height:3.2mm;font-weight:750;white-space:nowrap}.wrist .finish-pair{gap:1mm}.wrist .other-time{font-size:7pt;line-height:3mm}.comparison-goals{display:flex;gap:1mm;margin-top:1mm}.comparison-goals span{flex:1;min-width:0;text-align:center}.comparison-goals small{display:block;font-size:8pt;line-height:4mm}.comparison-goals b{font-size:12pt;line-height:6mm;white-space:nowrap}.pace{border-collapse:collapse;width:100%;table-layout:fixed}.pace thead tr{height:6mm}.pace th,.pace td{padding:0 1mm;border-bottom:.2mm solid #cbd5ce;text-align:right;white-space:nowrap}.pace th:first-child{text-align:left;font-size:9pt;font-weight:600}.pace thead th{font-size:8pt;background:#eef3ef}.pace tbody tr{height:5.2mm}.pace td{font-size:14pt;font-weight:750;line-height:5.2mm}.compare .pace td{font-size:11pt}.pace tbody tr:last-child th,.pace tbody tr:last-child td{border-bottom:.35mm solid #183a2b}.card-foot{position:absolute;bottom:3mm;left:4mm;right:4mm;font-size:7pt;line-height:3.3mm;color:#405a4c}.foot-style,.foot-average,.foot-average-label{font-size:14pt;font-weight:750;line-height:6mm}.compare .foot-style,.compare .foot-average-label{font-size:11pt;line-height:5mm}.foot-averages{display:flex;gap:1mm;text-align:center}.foot-averages>span{flex:1;min-width:0}.foot-averages small{display:block;font-size:8pt;line-height:3.5mm}.foot-averages b{display:block;font-size:11pt;font-weight:750;line-height:5mm}.foot-meta{font-size:6pt;line-height:3mm;margin-top:1mm}.wrist .foot-style,.wrist .foot-average{font-size:13pt;line-height:5.2mm}.wrist .foot-meta{font-size:6pt}.wrist .card-head{height:30mm}.wrist h2{font-size:9pt;line-height:4mm}.wrist .finish-time{font-size:16pt}.wrist .pace tbody tr{height:6.5mm}.wrist .pace td{font-size:13pt}.wrist .pace th:first-child{font-size:8.5pt}.page-note{font-size:8pt;line-height:4.5mm;margin-top:7mm;color:#4c6255;overflow-wrap:anywhere}.sheet-foot{position:absolute;left:12mm;right:12mm;bottom:10mm;display:flex;justify-content:space-between;border-top:.2mm solid #d4ddd5;padding-top:3mm;font-size:7.5pt;color:#53685a}.detail-section{padding-top:5mm;break-inside:avoid}.detail-section h2{font-size:11pt;line-height:6mm;margin:0 0 2mm}.detail-subtitle{font-size:9pt;line-height:5mm;margin:0 0 3mm}.detail{width:186mm;table-layout:fixed;border-collapse:collapse;font-variant-numeric:tabular-nums}.detail thead tr{height:8mm}.detail th{font-size:9pt;background:#edf3ee;text-align:left;padding:1.5mm 2mm}.detail td{font-size:9pt;line-height:4.2mm;padding:1.5mm 2mm;vertical-align:top;border-bottom:.2mm solid #cbd5ce;overflow-wrap:anywhere}.preview .sheet{margin:0}.preview .toolbar{display:none}@page{size:A4 portrait;margin:0}@media print{html,body{width:210mm}body{background:white}.toolbar{display:none}.sheet{height:296.5mm;margin:0;box-shadow:none;overflow:hidden}.pace thead th,.detail th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
.wrist-strip{padding:3mm}.strip-head{height:28mm}.wrist-strip h2{font-size:9pt;line-height:4mm}.wrist-strip .pace td{font-size:13pt}.wrist-strip.compare .pace td{font-size:10pt}.wrist-strip .pace th,.wrist-strip .pace td{padding:0 .5mm}.wrist-strip .pace thead th{font-size:7.5pt}.wrist-strip .pace th:first-child{font-size:8pt}.wrist-strip .gate-deadline{font-size:6pt}.strip-end{font-size:6pt;text-align:center}
.deadline-highlight{background:#000;color:#fff;font-weight:750;print-color-adjust:exact;-webkit-print-color-adjust:exact;box-decoration-break:clone;-webkit-box-decoration-break:clone}.gate-deadline .deadline-highlight{display:inline-block;padding:0 .35mm;line-height:3.2mm}.detail .deadline-highlight{padding:.3mm .7mm}
</style></head><body class="${options.preview ? 'preview' : ''}">${options.preview ? '' : `<div class="toolbar"><h1>印刷する内容を確認</h1><strong>A4縦 ${layout.pages.length}ページ ／ 携帯カード ${layout.cardCount}枚${layout.detailCount ? ` ／ 追加資料 ${layout.detailCount}ページ` : ''}</strong><p>用紙：A4 ／ 倍率：100%（実際のサイズ）／ ヘッダーとフッター：OFF<br>${plan.cardFormat === 'wrist' ? '手首用は各カードの外周を切り取ります。本番案は幅50mm、3目標比較は幅70mmです。中央の折り線はありません。' : `本番案＋比較は170 × ${layout.height}mmの外周を切り取り、中央を山折りして85 × ${layout.height}mmにします。中央は切りません。単独カードは幅85mmです。`}画面の説明部分は印刷されません。</p><div class="print-error" id="print-error" role="alert"></div><button onclick="printChecked()">この内容を印刷・PDF保存</button></div>`}${renderedPages}${options.preview ? '' : `<script>function printChecked(){var cards=Array.from(document.querySelectorAll('.carry'));var invalid=cards.some(function(c){var t=c.querySelector('.pace').getBoundingClientRect(),f=c.querySelector('.card-foot').getBoundingClientRect();return c.scrollWidth>c.clientWidth+2||c.scrollHeight>c.clientHeight+2||t.bottom>f.top;});if(invalid){document.getElementById('print-error').textContent='文字がカード枠を超えています。大会名を短くするか、ポケットサイズを選んで再出力してください。';return;}window.print();}</script>`}</body></html>`;
}
