import { Plan, Gate } from "./model";

export const ENGINE_VERSION = "2.0.0";
export function numberValue(value: string): number {
  return /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
}
export function duration(value: string): number {
  const m = value.trim().match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0) : NaN;
}
export function paceValue(value: string): number {
  const m = value.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
export function clockValue(value: string): number {
  const m = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0) : NaN;
}
export function elapsed(
  sec: number,
  rounding: "ceil" | "nearest" = "ceil",
): string {
  if (!Number.isFinite(sec)) return "—";
  const s = Math.max(
    0,
    rounding === "ceil" ? Math.ceil(sec - 0.000001) : Math.round(sec),
  );
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
export function paceText(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export function clockText(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  const day = Math.floor(sec / 86400);
  return `${day ? `翌${day === 1 ? "" : day}日 ` : ""}${elapsed(sec % 86400).padStart(8, "0")}`;
}
export function marginText(sec: number): string {
  const rounded = Math.floor(sec + 0.000001);
  return `${rounded < 0 ? "−" : ""}${elapsed(Math.abs(rounded), "nearest")}`;
}
export type ResultRow = {
  mm: number;
  km: number;
  fromKm: number;
  move: number;
  stop: number;
  pace: number;
  arrival: number;
  elapsed: number;
  pass: number;
  adjustment: number;
  notes: string[];
};
export type GateResult = {
  gate: Gate;
  elapsed: number;
  absolute: number;
  margin: number;
  advisory: boolean;
};
export type Calculation = {
  version: string;
  errors: string[];
  warnings: string[];
  rows: ResultRow[];
  gates: GateResult[];
  targetNet: number;
  actualNet: number;
  actualGun: number;
  start: number;
  gun: number;
  finishMargin: number | null;
  averagePace: number;
  firstHalf: number;
  secondHalf: number;
  canPrint: boolean;
  boundary: boolean;
};
const mm = (km: number) => Math.round(km * 1e6);
export function cardPoints(distance: number): number[] {
  if (!Number.isFinite(distance) || distance < 0.000002 || distance > 1000)
    return [];
  return [
    ...new Set(
      [
        1,
        ...Array.from(
          { length: Math.floor(distance / 5) },
          (_, i) => (i + 1) * 5,
        ),
        distance / 2,
        distance,
      ]
        .filter((k) => k > 0 && k <= distance)
        .map(mm),
    ),
  ].sort((a, b) => a - b);
}
export function pointLabel(km: number, distance: number): string {
  if (km === 0) return "スタート";
  if (mm(km) === mm(distance)) return "ゴール";
  if (mm(km) === mm(distance / 2)) return "中間点";
  return `${Number(km.toFixed(4))}km`;
}
export function calculate(plan: Plan): Calculation {
  const out: Calculation = {
    version: ENGINE_VERSION,
    errors: [],
    warnings: [],
    rows: [],
    gates: [],
    targetNet: NaN,
    actualNet: NaN,
    actualGun: NaN,
    start: NaN,
    gun: NaN,
    finishMargin: null,
    averagePace: NaN,
    firstHalf: NaN,
    secondHalf: NaN,
    canPrint: false,
    boundary: false,
  };
  const fail = (s: string) => out.errors.push(s);
  const distance = numberValue(plan.distance),
    delay = numberValue(plan.delayMinutes);
  const gun = clockValue(plan.startTime),
    wave = plan.waveTime ? clockValue(plan.waveTime) : gun;
  const limit = plan.limit ? duration(plan.limit) : null;
  const buffer = numberValue(plan.bufferMinutes) * 60;
  if (!Number.isFinite(distance) || distance < 0.000002 || distance > 1000)
    fail("距離は0.000002〜1,000kmの数値で入力してください。");
  if (!Number.isFinite(gun) || !Number.isFinite(wave) || wave < gun)
    fail(
      "開始時刻を確認してください。ウェーブ開始は大会号砲以降に設定します。",
    );
  if (!Number.isFinite(delay) || delay < 0 || delay > 1440)
    fail("スタートロスは0〜1,440分で入力してください。");
  if (limit !== null && (!Number.isFinite(limit) || limit <= 0))
    fail("制限時間は 時:分:秒 で入力してください。");
  if (!Number.isFinite(buffer) || buffer < 0 || buffer > 86400)
    fail("関門余裕は0〜1,440分で入力してください。");
  if (
    plan.gates.length +
      plan.stops.length +
      plan.overrides.length * 2 +
      plan.terrain.length * 2 >
    800
  )
    fail("地点・区間の合計が多すぎます。800以内に整理してください。");
  if (out.errors.length) return out;
  const start = wave + delay * 60,
    D = mm(distance),
    half = Math.round(D / 2);
  out.start = start;
  out.gun = gun;
  const bounds = new Set([0, D, half, ...cardPoints(distance)]);
  for (let k = 1; k < distance; k++) bounds.add(mm(k));
  const gates = plan.gates.map((g) => ({
    ...g,
    x: mm(numberValue(g.km)),
    deadline: clockValue(g.time) + numberValue(g.day) * 86400,
  }));
  gates.forEach((g) => {
    if (
      !g.name.trim() ||
      !Number.isFinite(g.x) ||
      g.x < 0 ||
      g.x > D ||
      !Number.isFinite(g.deadline) ||
      !/^\d$/.test(g.day)
    )
      fail(
        `関門「${g.name || "名称未入力"}」の距離・締切・日付差を確認してください。`,
      );
    else bounds.add(g.x);
  });
  const stops = plan.stops.map((s) => ({
    ...s,
    x: mm(numberValue(s.km)),
    secondsN: numberValue(s.seconds),
  }));
  stops.forEach((s) => {
    if (
      !Number.isFinite(s.x) ||
      s.x <= 0 ||
      s.x >= D ||
      !Number.isFinite(s.secondsN) ||
      s.secondsN < 0 ||
      s.secondsN > 86400
    )
      fail(
        "停止地点はスタートより後・ゴールより前、停止時間は0〜86,400秒で入力してください。",
      );
    else bounds.add(s.x);
  });
  const terrains = plan.terrain.map((s) => ({
    ...s,
    a: mm(numberValue(s.start)),
    b: mm(numberValue(s.end)),
    adjustmentN: numberValue(s.adjustment),
  }));
  const overrides = plan.overrides.map((s) => ({
    ...s,
    a: mm(numberValue(s.start)),
    b: mm(numberValue(s.end)),
    paceN: paceValue(s.pace),
  }));
  for (const [label, sections] of [
    ["高低差", terrains],
    ["手動ペース", overrides],
  ] as const) {
    const sorted = [...sections].sort((a, b) => a.a - b.a);
    sorted.forEach((s, i) => {
      if (
        ![s.a, s.b].every(Number.isFinite) ||
        s.a < 0 ||
        s.b > D ||
        s.a >= s.b
      )
        fail(`${label}の開始・終了距離を確認してください。`);
      else {
        bounds.add(s.a);
        bounds.add(s.b);
      }
      if (i && sorted[i - 1].b > s.a) fail(`${label}の区間が重複しています。`);
    });
  }
  if (
    terrains.some(
      (s) => !Number.isFinite(s.adjustmentN) || Math.abs(s.adjustmentN) > 120,
    )
  )
    fail("高低差補正は−120〜120秒/kmで入力してください。");
  if (
    overrides.some(
      (s) => !Number.isFinite(s.paceN) || s.paceN < 1 || s.paceN > 7200,
    )
  )
    fail("区間ペースを 分:秒 で入力してください。");
  let delta =
    plan.style === "negative-5"
      ? 300
      : plan.style === "negative-10"
        ? 600
        : plan.style === "positive-5"
          ? -300
          : plan.style === "positive-10"
            ? -600
            : plan.style === "custom"
              ? numberValue(plan.splitSeconds)
              : 0;
  if (!Number.isFinite(delta))
    fail("前後半差は秒数で入力してください。プラスは後半が速い配分です。");
  let target = duration(plan.target);
  if (plan.intent === "pb") {
    const pb = duration(plan.pb),
      gain = numberValue(plan.pbGainSeconds);
    if (!Number.isFinite(pb) || !Number.isFinite(gain) || gain < 0)
      fail("自己記録と短縮する秒数を確認してください。");
    target = pb - gain;
  } else if (plan.inputKind === "pace" && plan.intent === "target")
    target =
      paceValue(plan.pace) * distance +
      stops.reduce((s, p) => s + p.secondsN, 0);
  if (
    plan.timeBasis === "gun" &&
    (plan.intent === "pb" || plan.inputKind !== "pace")
  )
    target -= start - gun;
  if (
    plan.intent !== "finish" &&
    (!Number.isFinite(target) || target <= 0 || target > 86400 * 7)
  )
    fail("目標タイムが不正、またはスタートロスより短くなっています。");
  const fastest = plan.intent === "finish" && plan.fastestPace ? paceValue(plan.fastestPace) : 1;
  if (!Number.isFinite(fastest) || fastest < 1 || fastest > 7200)
    fail("最速許容ペースを 分:秒 で入力してください。");
  if (plan.style === "custom" && overrides.some(s => s.paceN < fastest))
    fail("直接指定した区間が最速許容ペースを超えています。区間ペースか許容ペースを見直してください。");
  if (plan.intent === "finish" && (limit === null || !Number.isFinite(limit)))
    fail("制限完走にはゴールの制限時間が必要です。");
  if (out.errors.length) return out;
  const points = [...bounds].sort((a, b) => a - b);
  const seeds = points.slice(1).map((end, i) => {
    const from = points[i],
      terrain = terrains.find((s) => s.a <= from && s.b >= end);
    return {
      from,
      end,
      km: (end - from) / 1e6,
      first: end <= half,
      adjustment: plan.elevation ? terrain?.adjustmentN || 0 : 0,
      manual:
        plan.style === "custom"
          ? overrides.find((s) => s.a <= from && s.b >= end)?.paceN
          : undefined,
      notes: terrain?.memo ? [terrain.memo] : [],
    };
  });
  const totalStops = stops.reduce((s, p) => s + p.secondsN, 0);
  const firstStops = stops
    .filter((s) => s.x < half || (s.x === half && !s.afterGate))
    .reduce((a, s) => a + s.secondsN, 0);
  const paceAt = (lambda: number, adjustment: number) =>
    Math.min(7200, Math.max(fastest, lambda + adjustment));
  let moves: number[] = [];
  if (plan.intent === "finish") {
    // One monotone control parameter; each checkpoint and finish constrains it.
    const official = gates.filter((g) => g.kind === "official");
    const requiredBuffer = Math.max(1, buffer);
    const budgets = [
      ...official.map((g) => ({
        x: g.x,
        budget: g.deadline - start - requiredBuffer,
        stopped: stops
          .filter((s) => s.x < g.x || (s.x === g.x && !s.afterGate))
          .reduce((a, s) => a + s.secondsN, 0),
      })),
      {
        x: D,
        budget: gun + limit! - start - requiredBuffer,
        stopped: totalStops,
      },
    ];
    const evalMoves = (lambda: number) =>
      seeds.map((s) => s.km * (s.manual ?? paceAt(lambda, s.adjustment)));
    const feasible = (m: number[]) =>
      budgets.every(
        (b) =>
          seeds.reduce((sum, s, i) => sum + (s.end <= b.x ? m[i] : 0), 0) +
            b.stopped <=
          b.budget + 1e-7,
      );
    let low = -120,
      high = 7320;
    if (!feasible(evalMoves(low))) {
      fail(
        "この停止時間・固定区間・最速許容ペースでは、希望する関門余裕を確保できません。",
      );
      return out;
    }
    for (let i = 0; i < 70; i++) {
      const mid = (low + high) / 2;
      if (feasible(evalMoves(mid))) low = mid;
      else high = mid;
    }
    moves = evalMoves(low);
    target = moves.reduce((a, n) => a + n, 0) + totalStops;
    if (plan.style !== "even" || plan.adjustmentMode === "fixed")
      out.warnings.push(
        "制限完走は共通の基準ペース・高低差・固定区間で逆算します。前後半差は適用しません。",
      );
  } else {
    const split = plan.style !== "even" && delta !== 0;
    if (Math.abs(delta) >= target) {
      fail("前後半差が目標時間以上です。");
      return out;
    }
    moves = Array(seeds.length).fill(0);
    const groups = split ? [true, false] : [null];
    for (const first of groups) {
      const indices = seeds
        .map((s, i) => i)
        .filter((i) => first === null || seeds[i].first === first);
      const budget =
        first === null
          ? target - totalStops
          : first
            ? (target + delta) / 2 - firstStops
            : (target - delta) / 2 - (totalStops - firstStops);
      if (budget <= 0) {
        fail("停止時間を含めると移動に使える時間がありません。");
        return out;
      }
      if (plan.adjustmentMode === "fixed") {
        const km = indices.reduce((n, i) => n + seeds[i].km, 0);
        indices.forEach((i) => {
          const s = seeds[i];
          moves[i] = s.km * (s.manual ?? paceAt(budget / km, s.adjustment));
        });
      } else {
        const total = (lambda: number) =>
          indices.reduce((n, i) => {
            const s = seeds[i];
            return n + s.km * (s.manual ?? paceAt(lambda, s.adjustment));
          }, 0);
        let low = -120,
          high = 7320;
        if (total(low) > budget + 1e-6 || total(high) < budget - 1e-6) {
          fail(
            "固定した区間・停止時間・ペース範囲では目標を維持できません。条件を見直してください。",
          );
          return out;
        }
        for (let i = 0; i < 70; i++) {
          const mid = (low + high) / 2;
          if (total(mid) < budget) low = mid;
          else high = mid;
        }
        indices.forEach((i) => {
          const s = seeds[i];
          moves[i] =
            s.km * (s.manual ?? paceAt((low + high) / 2, s.adjustment));
        });
      }
    }
  }
  let cumulative = 0;
  seeds.forEach((s, i) => {
    const at = stops.filter((p) => p.x === s.end),
      stop = at.reduce((a, p) => a + p.secondsN, 0);
    const arrival = cumulative + moves[i],
      pass =
        arrival +
        at.filter((p) => !p.afterGate).reduce((a, p) => a + p.secondsN, 0);
    cumulative = arrival + stop;
    out.rows.push({
      mm: s.end,
      km: s.end / 1e6,
      fromKm: s.from / 1e6,
      move: moves[i],
      stop,
      pace: moves[i] / s.km,
      arrival,
      pass,
      elapsed: cumulative,
      adjustment: s.adjustment,
      notes: [...s.notes, ...at.map((p) => p.memo || "停止")],
    });
  });
  out.gates = gates.map((g) => {
    const pass = g.x === 0 ? 0 : out.rows.find((r) => r.mm === g.x)!.pass;
    return {
      gate: g,
      elapsed: pass,
      absolute: start + pass,
      margin: g.deadline - start - pass,
      advisory: g.kind === "advisory",
    };
  });
  out.targetNet = target;
  out.actualNet = cumulative;
  out.actualGun = start - gun + cumulative;
  out.averagePace = moves.reduce((a, n) => a + n, 0) / distance;
  const h = out.rows.find((r) => r.mm === half)!;
  out.firstHalf = h.pass;
  out.secondHalf = cumulative - h.pass;
  out.finishMargin = limit === null ? null : limit - out.actualGun;
  out.boundary = [
    ...out.gates.filter((g) => !g.advisory).map((g) => g.margin),
    ...(out.finishMargin === null ? [] : [out.finishMargin]),
  ].some((m) => Math.abs(m) < 0.001);
  out.gates.forEach((g) => {
    if (g.margin < -0.001)
      out.warnings.push(
        `${g.gate.name}：${g.advisory ? "参考締切" : "締切"}を${marginText(-g.margin)}超過`,
      );
    else if (!g.advisory && g.margin < buffer - 0.001)
      out.warnings.push(
        `${g.gate.name}：希望余裕未達（残り${marginText(g.margin)}）`,
      );
  });
  if (out.finishMargin !== null && out.finishMargin < -0.001)
    out.warnings.push("ゴールの制限時間を超えています。");
  if (out.boundary)
    out.warnings.push(
      "締切ちょうどの地点があります。余裕を確保して再確認してください。",
    );
  if (!gates.some((g) => g.kind === "official"))
    out.warnings.push("正式関門が未登録です。関門通過の可否は未判定です。");
  if (out.finishMargin === null)
    out.warnings.push("ゴール制限時間が未登録です。");
  out.canPrint =
    !out.boundary &&
    !out.gates.some((g) => !g.advisory && g.margin < -0.001) &&
    !(out.finishMargin !== null && out.finishMargin < -0.001);
  return out;
}

export function aggregateAt(
  result: Calculation,
  endMm: number,
  previousMm = 0,
) {
  const end = result.rows.find((r) => r.mm === endMm);
  if (!end) return null;
  const interval = result.rows.filter(
    (r) => r.mm > previousMm && r.mm <= endMm,
  );
  const distance = (endMm - previousMm) / 1e6;
  return {
    ...end,
    pace: distance
      ? interval.reduce((n, r) => n + r.move, 0) / distance
      : end.pace,
  };
}
