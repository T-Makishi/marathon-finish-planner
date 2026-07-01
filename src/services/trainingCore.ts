import { detectTrainingColumns } from "../constants/csvColumnAliases";
import {
  NormalizedActivityType,
  ParsedTrainingPreviewRow,
  TrainingActivity,
  TrainingColumnMapping,
  TrainingImportBatch,
  TrainingParseResult,
  TrainingReadinessScore,
  TrainingSourceApp,
  TrainingSummary
} from "../types/training";

const MAX_IMPORT_ROWS = 1000;
const MILE_TO_KM = 1.609344;

export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[]; errors: string[] } {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = guessDelimiter(normalized);
  const records: string[][] = [];
  const errors: string[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) errors.push("CSV形式を読み取れません。引用符の閉じ忘れがあります。");
  row.push(field.trim());
  if (row.some((cell) => cell.trim())) records.push(row);
  const headers = (records.shift() ?? []).map((header) => header.replace(/^\uFEFF/, "").trim());
  const rows = records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
  return { headers, rows, errors };
}

function guessDelimiter(text: string) {
  const firstLine = text.split(/\n/)[0] ?? "";
  return firstLine.split("\t").length > firstLine.split(",").length ? "\t" : ",";
}

export function parseTrainingCsv(
  text: string,
  sourceApp: TrainingSourceApp,
  existingActivities: TrainingActivity[],
  manualMapping?: TrainingColumnMapping
): TrainingParseResult {
  const parsed = parseCsvText(text);
  const baseMapping = { ...detectTrainingColumns(parsed.headers), ...(manualMapping ?? {}) };
  const rows = parsed.rows;
  const limitExceededRows = Math.max(0, rows.length - MAX_IMPORT_ROWS);
  const limitedRows = rows.slice(0, MAX_IMPORT_ROWS);
  const existingKeys = new Set(existingActivities.map((activity) => trainingDuplicateKey(activity)));
  const previewRows = limitedRows.map((raw, index) => normalizeTrainingRow(raw, index + 1, sourceApp, baseMapping, existingKeys));
  const recognizedColumns = Object.values(baseMapping).filter((value): value is string => !!value);
  const errors = [...parsed.errors];
  if (!baseMapping.date) errors.push("日付の列が見つかりません。列の割当て画面で日付に対応する列を選択してください。");
  if (!baseMapping.distance) errors.push("距離の列が見つかりません。列の割当て画面で距離に対応する列を選択してください。");
  if (!baseMapping.duration) errors.push("時間の列が見つかりません。列の割当て画面で時間に対応する列を選択してください。");
  if (!baseMapping.activityType) errors.push("種目の列が見つかりません。列の割当て画面で種目に対応する列を選択してください。");
  if (limitExceededRows > 0) errors.push("最大1,000件を超えています。CSVを分割してから取り込んでください。");
  return { headers: parsed.headers, totalRows: rows.length, limitExceededRows, mapping: baseMapping, rows: previewRows, recognizedColumns, errors };
}

function normalizeTrainingRow(
  raw: Record<string, string>,
  index: number,
  sourceApp: TrainingSourceApp,
  mapping: TrainingColumnMapping,
  existingKeys: Set<string>
): ParsedTrainingPreviewRow {
  if (!Object.values(raw).some((value) => String(value ?? "").trim())) return { index, raw, status: "除外", reason: "空行" };
  if (!mapping.date || !mapping.distance || !mapping.duration || !mapping.activityType) return { index, raw, status: "要確認", reason: "必須列の割当てが必要です" };
  const date = parseTrainingDate(raw[mapping.date]);
  if (!date) return { index, raw, status: "除外", reason: "日付を読み取れません" };
  const distance = parseTrainingDistance(raw[mapping.distance], mapping.distance);
  if (distance == null) return { index, raw, status: "除外", reason: "距離がありません" };
  const duration = parseTrainingDuration(raw[mapping.duration], sourceApp);
  if (duration == null) return { index, raw, status: "除外", reason: "時間を読み取れません" };
  const activityType = String(raw[mapping.activityType] ?? "").trim();
  if (!activityType) return { index, raw, status: "除外", reason: "種目がありません" };
  const normalizedActivityType = normalizeActivityType(activityType);
  const averagePaceSecondsPerKm = calculateAveragePace(duration, distance);
  if (averagePaceSecondsPerKm == null) return { index, raw, status: "除外", reason: "平均ペースを計算できません" };
  const heartRaw = mapping.heartRate ? raw[mapping.heartRate] : "";
  const averageHeartRate = parseHeartRate(heartRaw);
  const memo = mapping.memo ? String(raw[mapping.memo] ?? "").trim() : "";
  const activity = { date, activityType, normalizedActivityType, distanceKm: distance, durationSeconds: duration, averagePaceSecondsPerKm, averageHeartRate, memo };
  const duplicateKey = trainingDuplicateKey(activity);
  if (existingKeys.has(duplicateKey)) return { index, raw, activity, status: "重複候補", duplicateKey };
  if (normalizedActivityType !== "running") return { index, raw, activity, status: "主要集計対象外", reason: "ランニング以外" };
  return { index, raw, activity, status: "取込予定", duplicateKey };
}

export function parseTrainingDate(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return validateDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const usOrEu = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usOrEu) {
    const a = Number(usOrEu[1]);
    const b = Number(usOrEu[2]);
    const year = Number(usOrEu[3]);
    if (a > 12 && b <= 12) return validateDateParts(year, b, a);
    if (b > 12 && a <= 12) return validateDateParts(year, a, b);
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return toLocalDateString(date);
}

function validateDateParts(year: number, month: number, day: number) {
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toLocalDateString(date);
}

export function parseTrainingDistance(value: string, columnName = ""): number | null {
  const raw = String(value ?? "").normalize("NFKC").trim().toLowerCase();
  if (!raw) return null;
  const numeric = Number(raw.replace(",", ".").match(/-?\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const column = columnName.normalize("NFKC").toLowerCase();
  let km = numeric;
  if (raw.includes("mile") || column.includes("mile")) km = numeric * MILE_TO_KM;
  else if (!raw.includes("km") && !column.includes("km") && (/\d\s*m$/.test(raw) || column.includes("(m)") || column.includes("meter"))) km = numeric / 1000;
  if (!Number.isFinite(km) || km <= 0 || km > 500) return null;
  return Number(km.toFixed(3));
}

export function parseTrainingDuration(value: string, sourceApp: TrainingSourceApp = "other"): number | null {
  const raw = String(value ?? "").normalize("NFKC").trim().toLowerCase();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const seconds = Number(raw);
    return seconds > 0 ? Math.round(seconds) : null;
  }
  const iso = raw.match(/^pt(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (iso) return positiveSeconds(Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0));
  const words = raw.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/);
  if (words && (words[1] || words[2] || words[3])) return positiveSeconds(Number(words[1] ?? 0) * 3600 + Number(words[2] ?? 0) * 60 + Number(words[3] ?? 0));
  const parts = raw.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return positiveSeconds(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  if (parts.length === 2) {
    if (sourceApp === "strava" || sourceApp === "garmin" || sourceApp === "runkeeper") return positiveSeconds(parts[0] * 60 + parts[1]);
    return parts[0] >= 10 ? positiveSeconds(parts[0] * 60 + parts[1]) : positiveSeconds(parts[0] * 3600 + parts[1] * 60);
  }
  return null;
}

function positiveSeconds(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

export function normalizeActivityType(value: string): NormalizedActivityType {
  const raw = value.normalize("NFKC").trim().toLowerCase();
  if (["running", "run", "road running", "trail running", "treadmill running", "virtual running", "ランニング", "ラン", "トレイルラン", "トレッドミル"].some((key) => raw.includes(key))) return "running";
  if (raw.includes("walk") || raw.includes("ウォーキング") || raw.includes("徒歩")) return "walking";
  if (raw.includes("cycling") || raw.includes("bike") || raw.includes("サイクリング") || raw.includes("自転車")) return "cycling";
  if (raw.includes("swim") || raw.includes("スイム") || raw.includes("水泳")) return "swimming";
  return "other";
}

function parseHeartRate(value: string) {
  const number = Number(String(value ?? "").match(/\d+/)?.[0]);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function calculateAveragePace(durationSeconds: number, distanceKm: number) {
  if (!Number.isFinite(durationSeconds) || !Number.isFinite(distanceKm) || durationSeconds <= 0 || distanceKm <= 0) return null;
  return Math.round(durationSeconds / distanceKm);
}

export function trainingDuplicateKey(activity: Pick<TrainingActivity, "date" | "normalizedActivityType" | "distanceKm" | "durationSeconds">) {
  return `${activity.date}|${activity.normalizedActivityType}|${activity.distanceKm.toFixed(3)}|${Math.round(activity.durationSeconds)}`;
}

export function buildImportedActivities(rows: ParsedTrainingPreviewRow[], sourceApp: TrainingSourceApp, importedAt: string, batchId: string, includeDuplicates: boolean): TrainingActivity[] {
  return rows
    .filter((row) => row.activity && (row.status === "取込予定" || row.status === "主要集計対象外" || (includeDuplicates && row.status === "重複候補")))
    .map((row, index) => ({
      id: `${batchId}-${index + 1}`,
      ...row.activity!,
      sourceApp,
      importedAt,
      importBatchId: batchId
    }));
}

export function buildTrainingBatch(id: string, importedAt: string, sourceApp: TrainingSourceApp, fileName: string | undefined, result: TrainingParseResult, importedRows: number): TrainingImportBatch {
  return {
    id,
    importedAt,
    sourceApp,
    fileName,
    totalRows: result.totalRows,
    importedRows,
    excludedRows: result.rows.filter((row) => row.status === "除外" || row.status === "要確認").length + result.limitExceededRows,
    duplicateRows: result.rows.filter((row) => row.status === "重複候補").length
  };
}

export function summarizeTraining(activities: TrainingActivity[], today = new Date()): TrainingSummary {
  const running = activities.filter((activity) => activity.normalizedActivityType === "running");
  const todayText = toLocalDateString(today);
  const weekStart = addDays(todayText, -(dayOfWeekMonday(todayText) - 1));
  const monthStart = `${todayText.slice(0, 8)}01`;
  const last30Start = addDays(todayText, -29);
  const last90Start = addDays(todayText, -89);
  const inRange = (start: string) => running.filter((activity) => activity.date >= start && activity.date <= todayText);
  const last30 = inRange(last30Start);
  const last90 = inRange(last90Start);
  return {
    weekDistanceKm: sumDistance(inRange(weekStart)),
    monthDistanceKm: sumDistance(inRange(monthStart)),
    last30DistanceKm: sumDistance(last30),
    last90DistanceKm: sumDistance(last90),
    last30Count: last30.length,
    last90Count: last90.length,
    allCount: running.length,
    last30AveragePaceSec: weightedAveragePace(last30),
    last90AveragePaceSec: weightedAveragePace(last90),
    allLongestDistanceKm: Math.max(0, ...running.map((activity) => activity.distanceKm)),
    last90LongestDistanceKm: Math.max(0, ...last90.map((activity) => activity.distanceKm))
  };
}

function sumDistance(activities: TrainingActivity[]) {
  return activities.reduce((sum, activity) => sum + activity.distanceKm, 0);
}

function weightedAveragePace(activities: TrainingActivity[]) {
  const distance = sumDistance(activities);
  const seconds = activities.reduce((sum, activity) => sum + activity.durationSeconds, 0);
  return distance > 0 ? Math.round(seconds / distance) : null;
}

function dayOfWeekMonday(dateText: string) {
  const day = new Date(`${dateText}T00:00:00`).getDay();
  return day === 0 ? 7 : day;
}

function addDays(dateText: string, offset: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return toLocalDateString(date);
}

export function toLocalDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function paceDifferenceLabel(diffSeconds: number | null) {
  if (diffSeconds == null) return "比較できる練習データがまだありません。";
  const abs = Math.abs(Math.round(diffSeconds));
  if (abs <= 5) return "目標ペースとほぼ同じです。";
  return diffSeconds > 0 ? `目標ペースより${abs}秒/km遅い傾向です。` : `目標ペースより${abs}秒/km速い傾向です。`;
}

export function calculateReadinessScore(args: {
  raceDistanceKm?: number;
  summary: TrainingSummary;
  targetPaceSec?: number | null;
  minGateMarginSec?: number | null;
}): TrainingReadinessScore {
  const raceDistance = args.raceDistanceKm && args.raceDistanceKm > 0 ? args.raceDistanceKm : 42.195;
  const scale = raceDistance / 42.195;
  const last30Distance = distanceScore(args.summary.last30DistanceKm, [120, 90, 60, 30, 1].map((v) => v * scale), [25, 21, 16, 9, 4]);
  const last90Distance = distanceScore(args.summary.last90DistanceKm, [300, 220, 150, 80, 1].map((v) => v * scale), [15, 12, 9, 5, 2]);
  const longestDistance = distanceScore(args.summary.last90LongestDistanceKm, [30, 25, 20, 15, 10, 1].map((v) => Math.min(v * scale, raceDistance * 0.9)), [20, 17, 13, 9, 5, 2]);
  const trainingCount = args.summary.last30Count >= 12 ? 15 : args.summary.last30Count >= 8 ? 12 : args.summary.last30Count >= 5 ? 8 : args.summary.last30Count >= 2 ? 4 : args.summary.last30Count >= 1 ? 2 : 0;
  const paceDiff = args.targetPaceSec && args.summary.last30AveragePaceSec ? args.summary.last30AveragePaceSec - args.targetPaceSec : null;
  const paceDiffScore = paceDiff == null ? 7 : paceDiff <= -30 ? 15 : paceDiff <= -5 ? 13 : Math.abs(paceDiff) <= 5 ? 12 : paceDiff <= 20 ? 9 : paceDiff <= 40 ? 5 : 2;
  const gateMargin = args.minGateMarginSec == null ? 5 : args.minGateMarginSec < 0 ? 0 : args.minGateMarginSec >= 15 * 60 ? 10 : args.minGateMarginSec >= 10 * 60 ? 8 : args.minGateMarginSec >= 5 * 60 ? 5 : 2;
  const details = { last30Distance, last90Distance, longestDistance, trainingCount, paceDiff: paceDiffScore, gateMargin };
  const total = clampScore(Object.values(details).reduce((sum, value) => sum + value, 0));
  const suggestions = buildSuggestions(args.summary, raceDistance, paceDiff, args.minGateMarginSec);
  return { total, label: total >= 80 ? "順調" : total >= 60 ? "やや注意" : total >= 40 ? "準備を増やしたい" : "目標見直し推奨", details, suggestions };
}

function distanceScore(value: number, thresholds: number[], scores: number[]) {
  const index = thresholds.findIndex((threshold) => value >= threshold);
  return index >= 0 ? scores[index] : 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildSuggestions(summary: TrainingSummary, raceDistance: number, paceDiff: number | null, minGateMarginSec?: number | null) {
  const suggestions: string[] = [];
  if (summary.last30DistanceKm < Math.max(30, raceDistance * 1.4)) suggestions.push("直近30日の走行距離を少し増やすとスコアが上がります。");
  if (summary.last90LongestDistanceKm < Math.min(20, raceDistance * 0.5)) suggestions.push("長めの練習記録がまだ少なめです。");
  if (paceDiff != null && paceDiff > 20) suggestions.push("目標ペースとの差があるため、計画ペースを確認してください。");
  if (minGateMarginSec != null && minGateMarginSec < 5 * 60) suggestions.push("関門余裕が5分未満のため、目標ペースを確認してください。");
  return suggestions.slice(0, 3);
}
