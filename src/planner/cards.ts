import { Plan, PACE_STYLES } from "./model";
import {
  calculate,
  Calculation,
  cardPoints,
  pointLabel,
  elapsed,
  clockText,
  marginText,
  paceText,
  numberValue,
} from "./engine";

export const htmlEscape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function comparisonResults(plan: Plan): Calculation[] {
  return plan.comparison.map((target) =>
    calculate({
      ...plan,
      intent: "target",
      inputKind: "time",
      target,
      timeBasis: plan.timeBasis,
    }),
  );
}
export function displayPoints(plan: Plan): number[] {
  const points = cardPoints(numberValue(plan.distance));
  if (plan.cardGates)
    points.push(...plan.gates.map((g) => Math.round(numberValue(g.km) * 1e6)));
  if (plan.cardNotes)
    points.push(...plan.stops.map((s) => Math.round(numberValue(s.km) * 1e6)));
  return [...new Set(points)].filter(Number.isFinite).sort((a, b) => a - b);
}
export function cardTime(
  plan: Plan,
  result: Calculation,
  point: number,
): string {
  if (point === 0)
    return elapsed(plan.cardClock === "gun" ? result.start - result.gun : 0);
  const row = result.rows.find((r) => r.mm === point);
  return row
    ? elapsed(
        row.pass + (plan.cardClock === "gun" ? result.start - result.gun : 0),
      )
    : "—";
}
export function exportProblems(plan: Plan): string[] {
  const result = calculate(plan);
  const errors = [...result.errors];
  if (plan.raceName.length > 60 || plan.name.length > 40)
    errors.push(
      "カード用の大会名は60文字以内、計画名は40文字以内にしてください。",
    );
  if (plan.cardNotes && plan.stops.some((s) => s.memo.length > 80))
    errors.push("カードに載せる補給メモは80文字以内にしてください。");
  if (plan.cardGates && plan.gates.some((g) => g.name.length > 40))
    errors.push("カードに載せる関門名は40文字以内にしてください。");
  if (!result.canPrint && !errors.length)
    errors.push(
      "締切を超える、または締切ちょうどの計画です。配分を見直してください。",
    );
  if (plan.migrationNotes.length)
    errors.push("移行した計画を確認してから出力してください。");
  if (plan.cardMode !== "single")
    comparisonResults(plan).forEach((r, i) => {
      if (r.errors.length || !r.canPrint)
        errors.push(
          `比較案${i + 1}：${r.errors[0] || "締切超過または締切境界です。"}`,
        );
    });
  return errors;
}
export function buildCardHtml(
  plan: Plan,
  createdAt = new Date().toISOString(),
): string {
  const problems = exportProblems(plan);
  if (problems.length) throw new Error(problems.join("\n"));
  const result = calculate(plan),
    comparisons = comparisonResults(plan),
    points = displayPoints(plan);
  const basis =
    plan.cardClock === "net" ? "ライン通過からの累計" : "大会号砲からの累計";
  const status = !plan.gates.some((g) => g.kind === "official")
    ? "正式関門未登録"
    : "登録済み関門で計算";
  const esc = htmlEscape;
  const parts: string[] = [];
  const chunkSize =
    plan.cardFormat === "wrist"
      ? 8
      : plan.cardGates || (plan.cardNotes && plan.stops.length)
        ? 8
        : 11;
  const groups: number[][] = [];
  for (let i = 0; i < points.length; i += chunkSize)
    groups.push(points.slice(i, i + chunkSize));
  const footer = `<footer>${esc(basis)}<br>${esc(status)} · ${esc(createdAt.slice(0, 16).replace("T", " "))} UTC</footer>`;
  const header = `<header><span>RUN FINISH PLANNER</span><h2>${esc(plan.raceName)}</h2><small>${esc(plan.date || "開催日未入力")} · ${esc(plan.name)}</small></header>`;
  groups.forEach((group, page) => {
    if (plan.cardMode !== "compare") {
      const rows = group
        .map((x) => {
          const row = result.rows.find((r) => r.mm === x)!;
          const gates = result.gates.filter(
            (g) => Math.round(numberValue(g.gate.km) * 1e6) === x,
          );
          const note = [
            ...(plan.cardNotes
              ? plan.stops
                  .filter((s) => Math.round(numberValue(s.km) * 1e6) === x)
                  .map((s) => `${s.memo || "停止"} ${s.seconds}秒`)
              : []),
            ...(plan.cardGates
              ? gates.map(
                  (g) =>
                    `${g.advisory ? "参考 " : ""}${g.gate.name} ${clockText(g.absolute + g.margin)} / 余裕 ${marginText(g.margin)}`,
                )
              : []),
            ...(plan.cardTerrain && row?.adjustment
              ? [`補正 ${row.adjustment > 0 ? "+" : ""}${row.adjustment}秒/km`]
              : []),
          ].join(" / ");
          return `<tr><th>${esc(pointLabel(x / 1e6, numberValue(plan.distance)))}</th><td><b>${cardTime(plan, result, x)}</b></td></tr>${note ? `<tr class="note"><td colspan="2">${esc(note)}</td></tr>` : ""}`;
        })
        .join("");
      parts.push(
        `<section class="card single">${header}<div class="target">${elapsed(result.actualNet)}<small>ネット予定 / ${paceText(result.averagePace)}/km</small></div><p class="strategy">${esc(PACE_STYLES.find((s) => s.id === plan.style)!.label)} · ${page + 1}/${groups.length}</p><table><thead><tr><th>距離</th><th>累計時間</th></tr></thead><tbody>${rows}</tbody></table>${footer}</section>`,
      );
    }
    if (plan.cardMode !== "single") {
      const rows = group
        .map((x) => {
          const notes = [
            ...(plan.cardNotes
              ? plan.stops
                  .filter((s) => Math.round(numberValue(s.km) * 1e6) === x)
                  .map((s) => `${s.memo || "停止"} ${s.seconds}秒`)
              : []),
            ...(plan.cardGates
              ? plan.gates
                  .filter((g) => Math.round(numberValue(g.km) * 1e6) === x)
                  .map(
                    (g) =>
                      `${g.kind === "advisory" ? "参考 " : ""}${g.name} ${g.time} / 余裕 ${comparisons.map((r) => marginText(r.gates.find((v) => v.gate.id === g.id)!.margin)).join("・")}`,
                  )
              : []),
            ...(plan.cardTerrain &&
            result.rows.find((r) => r.mm === x)?.adjustment
              ? [`補正 ${result.rows.find((r) => r.mm === x)!.adjustment}秒/km`]
              : []),
          ];
          return `<tr><th>${esc(pointLabel(x / 1e6, numberValue(plan.distance)))}</th>${comparisons.map((r) => `<td>${cardTime(plan, r, x)}</td>`).join("")}</tr>${notes.length ? `<tr class="note"><td colspan="4">${esc(notes.join(" / "))}</td></tr>` : ""}`;
        })
        .join("");
      parts.push(
        `<section class="card compare">${header}<p class="strategy">3案比較 · 目標は${plan.timeBasis === "net" ? "ネット" : "号砲基準"} · ${page + 1}/${groups.length}</p><table><thead><tr><th>距離</th>${plan.comparison.map((t) => `<th>${esc(t)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>${footer}</section>`,
      );
    }
  });
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(plan.raceName)} 早見カード</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif;color:#102522;margin:0;background:#edf1ed}main{max-width:210mm;margin:auto;padding:8mm;background:white}h1{font-size:14pt;margin:0 0 2mm}.instructions{font-size:9pt;line-height:1.6}.cards{display:flex;gap:5mm;flex-wrap:wrap;align-items:flex-start}.card{border:1px dashed #56736b;padding:4mm;width:90mm;min-height:110mm;break-inside:avoid;page-break-inside:avoid;background:#fff}.card.single{${plan.cardFormat === "wrist" ? "width:40mm;min-height:190mm;" : ""}}header span{font-size:8pt;letter-spacing:1px}h2{font-size:11pt;margin:2mm 0;overflow-wrap:anywhere}header small{font-size:8pt}.target{font-size:24pt;font-weight:800;margin:3mm 0}.single .target{${plan.cardFormat === "wrist" ? "font-size:18pt;" : ""}}.target small{display:block;font-size:9pt;font-weight:500}.strategy{font-size:8pt;line-height:1.5}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{padding:1.35mm .5mm;border-bottom:1px solid #a1b7b0;text-align:right;font-size:10pt;white-space:nowrap}th:first-child{text-align:left;font-size:9pt}thead th{font-size:9pt;color:#164d3d;background:#edf5ef}.single td b{font-size:14pt}.note td{font-size:8pt;text-align:left;white-space:normal;overflow-wrap:anywhere;line-height:1.4}.compare{width:100mm}.compare td{font-size:10pt;font-weight:700}footer{font-size:8pt;line-height:1.5;margin-top:3mm;overflow-wrap:anywhere}.scale{width:50mm;border-bottom:2px solid black;font-size:8pt;margin:5mm 0}.print{padding:10px 18px;background:#154c3c;color:white;border:0;border-radius:5px;cursor:pointer}@page{size:A4 portrait;margin:8mm}@media print{body{background:white}main{padding:0;max-width:none}.print{display:none}.cards{gap:4mm}.card{break-inside:avoid}tr{break-inside:avoid}}
  </style></head><body><main><h1>早見カード</h1><p class="instructions">実際のサイズ（100%）で印刷し、点線に沿って切り取ってください。汗・雨への対策をして練習で読みやすさを確認してください。<br>計画は入力条件に基づく目安です。大会の最新要項を確認してください。</p><button class="print" onclick="window.print()">印刷・PDFとして保存</button><div class="scale">50mm 印刷サイズ確認</div><div class="cards">${parts.join("")}</div><p class="instructions">PCSAPO / マキシ企画 · 計算 ${result.version} · ${esc(plan.sourceStatus)} ${esc(plan.sourceChecked)}</p></main></body></html>`;
}
