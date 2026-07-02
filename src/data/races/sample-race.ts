import type { OfficialRaceData } from "../raceData";

export const sampleRaceData: OfficialRaceData = {
  id: "sample-full-course-2026",
  slug: "sample-full-course",
  name: "開発用サンプル フルマラソン",
  year: 2026,
  prefecture: "東京都",
  city: "千代田区",
  eventDate: "2026-11-01",
  category: "full",
  distanceKm: 42.195,
  startLocation: "サンプルスタート",
  finishLocation: "サンプルゴール",
  startTime: "09:00",
  timeLimitMinutes: 360,
  mccMember: false,
  startType: "single",
  courseDifficulty: "normal",
  courseSummary: "画面動作確認用の架空データです。実在大会の公式情報ではありません。",
  checkpoints: [
    { id: "sample-gate-1", name: "第1関門", distanceKm: 21.1, closingTime: "12:05", memo: "中間地点" },
    { id: "sample-gate-2", name: "第2関門", distanceKm: 35, closingTime: "14:10", memo: "終盤確認地点" },
    { id: "sample-finish", name: "FINISH", distanceKm: 42.195, closingTime: "15:00", memo: "ゴール" }
  ],
  sections: [
    { startKm: 0, endKm: 5, terrain: "flat", description: "平坦な序盤", confidence: "low" },
    { startKm: 5, endKm: 10, terrain: "uphill", description: "ゆるい上り", confidence: "low" },
    { startKm: 10, endKm: 15, terrain: "downhill", description: "下り基調", confidence: "low" },
    { startKm: 15, endKm: 20, terrain: "flat", description: "平坦", confidence: "low" },
    { startKm: 20, endKm: 25, terrain: "rolling", description: "小刻みな起伏", confidence: "low" },
    { startKm: 25, endKm: 30, terrain: "flat", description: "平坦", confidence: "low" },
    { startKm: 30, endKm: 35, terrain: "uphill", description: "終盤の上り", confidence: "low" },
    { startKm: 35, endKm: 40, terrain: "downhill", description: "ゴールへ向かう下り", confidence: "low" },
    { startKm: 40, endKm: 42.195, terrain: "flat", description: "最終区間", confidence: "low" }
  ],
  waterStations: [],
  sources: [{ title: "アプリ内開発用サンプル", url: "https://example.com/sample-race-data", type: "official-web", accessedAt: "2026-07-02" }],
  verificationStatus: "unverified",
  verifiedAt: "2026-07-02",
  notes: ["このデータは動作確認用の架空データです。公式大会情報として利用しないでください。"]
};
