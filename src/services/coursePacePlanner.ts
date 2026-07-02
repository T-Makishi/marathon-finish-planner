import { DataConfidence, RaceDataSection, RaceDataTerrain } from "../data/raceData";

export type CoursePaceStrategy = "even" | "negative" | "positive";

export type FiveKmPacePlanRow = {
  startKm: number;
  endKm: number;
  distanceKm: number;
  terrain: RaceDataTerrain;
  paceSecondsPerKm: number;
  sectionSeconds: number;
  cumulativeSeconds: number;
  adjustmentSecondsPerKm: number;
  confidence: DataConfidence;
  description: string;
};

type BuildCoursePacePlanInput = {
  distanceKm: number;
  targetSeconds: number;
  sections?: RaceDataSection[];
  strategy: CoursePaceStrategy;
  splitDifferenceMinutes?: number;
  climbSecPerKm?: number;
  descentSecPerKm?: number;
};

export function calculateElevationAdjustment(section: RaceDataSection, climbSecPerKm: number, descentSecPerKm: number) {
  if (section.terrain === "unknown") return 0;
  if (section.elevationGainM == null && section.elevationLossM == null && (section.terrain === "rolling" || section.terrain === "mixed")) {
    return section.terrain === "rolling" ? Math.max(3, Math.round(climbSecPerKm * 0.35)) : Math.max(2, Math.round(climbSecPerKm * 0.2));
  }
  if (section.terrain === "uphill") return Math.min(45, Math.max(0, climbSecPerKm));
  if (section.terrain === "downhill") return Math.max(-12, Math.min(0, descentSecPerKm));
  if (section.terrain === "rolling") {
    const gain = section.elevationGainM ?? 0;
    const loss = section.elevationLossM ?? 0;
    return Math.max(0, Math.min(30, Math.round((gain - loss * 0.35) / Math.max(section.endKm - section.startKm, 1) / 10)));
  }
  if (section.terrain === "mixed") return Math.max(0, Math.min(20, Math.round(climbSecPerKm * 0.2)));
  return 0;
}

function defaultSections(distanceKm: number): RaceDataSection[] {
  const rows: RaceDataSection[] = [];
  for (let start = 0; start < distanceKm; start += 5) {
    rows.push({
      startKm: start,
      endKm: Math.min(distanceKm, start + 5),
      terrain: "unknown",
      confidence: "unknown",
      description: "コースデータ未登録のため、平坦として試算"
    });
  }
  return rows;
}

function halfBudget(targetSeconds: number, strategy: CoursePaceStrategy, splitDifferenceMinutes: number) {
  const diffSeconds = Math.max(0, splitDifferenceMinutes) * 60;
  if (strategy === "negative") {
    return { firstHalf: targetSeconds / 2 + diffSeconds / 2, secondHalf: targetSeconds / 2 - diffSeconds / 2 };
  }
  if (strategy === "positive") {
    return { firstHalf: targetSeconds / 2 - diffSeconds / 2, secondHalf: targetSeconds / 2 + diffSeconds / 2 };
  }
  return { firstHalf: targetSeconds / 2, secondHalf: targetSeconds / 2 };
}

function splitSectionAtHalf(section: RaceDataSection, halfKm: number): RaceDataSection[] {
  if (section.startKm < halfKm && section.endKm > halfKm) {
    return [
      { ...section, endKm: halfKm },
      { ...section, startKm: halfKm }
    ];
  }
  return [section];
}

export function calculateFiveKmPacePlan({
  distanceKm,
  targetSeconds,
  sections,
  strategy,
  splitDifferenceMinutes = 0,
  climbSecPerKm = 10,
  descentSecPerKm = -5
}: BuildCoursePacePlanInput): FiveKmPacePlanRow[] {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(targetSeconds) || targetSeconds <= 0) return [];
  const halfKm = distanceKm / 2;
  const sourceSections = (sections && sections.length ? sections : defaultSections(distanceKm))
    .flatMap((section) => splitSectionAtHalf({ ...section, startKm: Math.max(0, section.startKm), endKm: Math.min(distanceKm, section.endKm) }, halfKm))
    .filter((section) => section.endKm > section.startKm)
    .sort((a, b) => a.startKm - b.startKm);
  const budgets = halfBudget(targetSeconds, strategy, splitDifferenceMinutes);

  const seeded = sourceSections.map((section) => {
    const distance = section.endKm - section.startKm;
    const isFirstHalf = section.endKm <= halfKm;
    const halfDistance = isFirstHalf ? halfKm : distanceKm - halfKm;
    const halfBasePace = (isFirstHalf ? budgets.firstHalf : budgets.secondHalf) / Math.max(halfDistance, 0.001);
    const adjustment = calculateElevationAdjustment(section, climbSecPerKm, descentSecPerKm);
    return {
      section,
      distance,
      isFirstHalf,
      adjustment,
      weightedSeconds: Math.max(30, halfBasePace + adjustment) * distance
    };
  });

  const totalFirst = seeded.filter((row) => row.isFirstHalf).reduce((sum, row) => sum + row.weightedSeconds, 0);
  const totalSecond = seeded.filter((row) => !row.isFirstHalf).reduce((sum, row) => sum + row.weightedSeconds, 0);
  let cumulative = 0;

  return seeded.map((row, index) => {
    const targetHalf = row.isFirstHalf ? budgets.firstHalf : budgets.secondHalf;
    const rawHalfTotal = row.isFirstHalf ? totalFirst : totalSecond;
    const sectionSeconds = rawHalfTotal > 0 ? row.weightedSeconds * (targetHalf / rawHalfTotal) : row.weightedSeconds;
    cumulative += sectionSeconds;
    if (index === seeded.length - 1) cumulative = targetSeconds;
    return {
      startKm: row.section.startKm,
      endKm: row.section.endKm,
      distanceKm: row.distance,
      terrain: row.section.terrain,
      paceSecondsPerKm: sectionSeconds / Math.max(row.distance, 0.001),
      sectionSeconds,
      cumulativeSeconds: cumulative,
      adjustmentSecondsPerKm: row.adjustment,
      confidence: row.section.confidence ?? "unknown",
      description: row.section.description ?? "5km区間の目安"
    };
  });
}
