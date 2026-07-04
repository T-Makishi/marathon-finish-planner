import { calculateFiveKmPacePlan } from "./coursePacePlanner";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runCoursePacePlannerTests() {
  const targetSeconds = 3 * 3600 + 20 * 60;
  const sections = [
    { startKm: 0, endKm: 5, terrain: "flat" as const },
    { startKm: 5, endKm: 10, terrain: "uphill" as const },
    { startKm: 10, endKm: 15, terrain: "downhill" as const },
    { startKm: 15, endKm: 20, terrain: "flat" as const },
    { startKm: 20, endKm: 25, terrain: "rolling" as const },
    { startKm: 25, endKm: 30, terrain: "flat" as const },
    { startKm: 30, endKm: 35, terrain: "uphill" as const },
    { startKm: 35, endKm: 40, terrain: "downhill" as const },
    { startKm: 40, endKm: 42.195, terrain: "flat" as const }
  ];
  const evenRows = calculateFiveKmPacePlan({
    distanceKm: 42.195,
    targetSeconds,
    runStyle: "even",
    sections
  });
  const negativeRows = calculateFiveKmPacePlan({
    distanceKm: 42.195,
    targetSeconds,
    runStyle: "negative-10",
    sections
  });
  const positiveRows = calculateFiveKmPacePlan({
    distanceKm: 42.195,
    targetSeconds,
    runStyle: "positive-10",
    sections
  });
  const adaptiveRows = calculateFiveKmPacePlan({
    distanceKm: 42.195,
    targetSeconds,
    runStyle: "course-adaptive",
    sections
  });
  for (const rows of [evenRows, negativeRows, positiveRows, adaptiveRows]) {
    assert(rows.length > 0, "5km区間の計算結果が必要です");
    assert(Math.abs(rows[rows.length - 1].cumulativeSeconds - targetSeconds) <= 1, "累計時間は目標時間に一致する必要があります");
    assert(Math.abs(rows[rows.length - 1].endKm - 42.195) < 0.001, "最後の区間はゴール距離で終わる必要があります");
  }
  assert(negativeRows[0].paceSecondsPerKm > negativeRows[negativeRows.length - 1].paceSecondsPerKm, "後半型は後半が速くなる必要があります");
  assert(positiveRows[0].paceSecondsPerKm < positiveRows[positiveRows.length - 1].paceSecondsPerKm, "前半速め型は後半が遅くなる必要があります");
  assert(adaptiveRows.some((row) => row.terrain === "uphill" && row.adjustmentSecondsPerKm > 0), "上り区間にはプラス補正が必要です");
  assert(adaptiveRows.some((row) => row.terrain === "downhill" && row.adjustmentSecondsPerKm < 0), "下り区間にはマイナス補正が必要です");
  return true;
}
