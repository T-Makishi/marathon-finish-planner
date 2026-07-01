import { calculateFiveKmPacePlan } from "./coursePacePlanner";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runCoursePacePlannerTests() {
  const targetSeconds = 4 * 3600;
  const rows = calculateFiveKmPacePlan({
    distanceKm: 42.195,
    targetSeconds,
    strategy: "negative",
    splitDifferenceMinutes: 10,
    sections: [
      { startKm: 0, endKm: 5, terrain: "flat" },
      { startKm: 5, endKm: 10, terrain: "uphill" },
      { startKm: 10, endKm: 15, terrain: "downhill" },
      { startKm: 15, endKm: 20, terrain: "flat" },
      { startKm: 20, endKm: 25, terrain: "rolling" },
      { startKm: 25, endKm: 30, terrain: "flat" },
      { startKm: 30, endKm: 35, terrain: "uphill" },
      { startKm: 35, endKm: 40, terrain: "downhill" },
      { startKm: 40, endKm: 42.195, terrain: "flat" }
    ]
  });
  assert(rows.length > 0, "5km区間の計算結果が必要です");
  assert(Math.abs(rows[rows.length - 1].cumulativeSeconds - targetSeconds) <= 1, "累計時間は目標時間に一致する必要があります");
  assert(rows.some((row) => row.terrain === "uphill" && row.adjustmentSecondsPerKm > 0), "上り区間にはプラス補正が必要です");
  assert(rows.some((row) => row.terrain === "downhill" && row.adjustmentSecondsPerKm < 0), "下り区間にはマイナス補正が必要です");
  return true;
}
