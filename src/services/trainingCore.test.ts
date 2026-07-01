import { detectTrainingColumns } from "../constants/csvColumnAliases";
import {
  calculateAveragePace,
  calculateReadinessScore,
  normalizeActivityType,
  parseTrainingCsv,
  parseTrainingDate,
  parseTrainingDistance,
  parseTrainingDuration,
  summarizeTraining,
  trainingDuplicateKey
} from "./trainingCore";
import { TrainingActivity } from "../types/training";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runTrainingCoreTests() {
  assert(parseTrainingDate("2026-06-01") === "2026-06-01", "YYYY-MM-DD date");
  assert(parseTrainingDate("06/15/2026") === "2026-06-15", "US date");
  assert(parseTrainingDate("15/06/2026") === "2026-06-15", "EU date");
  assert(parseTrainingDate("06/06/2026") == null, "ambiguous date");
  assert(parseTrainingDistance("1 mile", "Distance") === 1.609, "mile to km");
  assert(parseTrainingDistance("5.2 km", "Distance") === 5.2, "explicit km");
  assert(parseTrainingDistance("5200", "Distance (m)") === 5.2, "meter to km");
  assert(parseTrainingDuration("01:30:20") === 5420, "HH:MM:SS");
  assert(parseTrainingDuration("3600") === 3600, "seconds");
  assert(normalizeActivityType("Trail Running") === "running", "running type");
  assert(calculateAveragePace(3600, 10) === 360, "pace");
  assert(detectTrainingColumns(["Activity Date", "Activity Type", "Distance (km)", "Moving Time"]).date === "Activity Date", "column detection");

  const csv = "日付,種目,距離(km),経過時間,平均心拍,メモ\n2026-06-01,ランニング,5.2,00:31:20,142,ゆっくり走\n2026-06-08,ウォーキング,3.0,00:45:00,110,回復";
  const parsed = parseTrainingCsv(csv, "other", []);
  assert(parsed.totalRows === 2, "csv rows");
  assert(parsed.rows[0].status === "取込予定", "running planned");
  assert(parsed.rows[1].status === "主要集計対象外", "non-running excluded from main stats");

  const activity: TrainingActivity = {
    id: "1",
    date: "2026-06-01",
    activityType: "ランニング",
    normalizedActivityType: "running",
    distanceKm: 10,
    durationSeconds: 3600,
    averagePaceSecondsPerKm: 360,
    sourceApp: "other",
    importedAt: "2026-06-01T00:00:00.000Z",
    importBatchId: "b1"
  };
  assert(trainingDuplicateKey(activity) === "2026-06-01|running|10.000|3600", "duplicate key");
  const summary = summarizeTraining([activity], new Date(2026, 5, 20));
  assert(summary.last30DistanceKm === 10, "summary distance");
  const score = calculateReadinessScore({ raceDistanceKm: 42.195, summary, targetPaceSec: 420, minGateMarginSec: 600 });
  assert(score.total >= 0 && score.total <= 100, "score range");
  return true;
}
