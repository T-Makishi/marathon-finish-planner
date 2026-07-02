import type { OfficialRaceData } from "../raceData";

export const nahaMarathon: OfficialRaceData = {
  id: "naha-marathon-2026",
  slug: "naha-marathon",
  name: "第40回記念NAHAマラソン",
  year: 2026,
  prefecture: "沖縄県",
  city: "那覇市",
  eventDate: "2026-12-06",
  category: "full",
  distanceKm: 42.195,
  startLocation: "奥武山陸上競技場付近",
  finishLocation: "奥武山陸上競技場",
  startTime: "09:00",
  timeLimitMinutes: 375,
  mccMember: false,
  startType: "single",
  courseDifficulty: "hard",
  courseSummary: "沖縄本島南部を走るフルマラソン。公式サイトの公開情報を基に、確認済みの関門時刻と試験版の5km区間目安を保持しています。",
  checkpoints: [
    { id: "naha-2026-gate-1", name: "第1制限地点", distanceKm: 21.3, closingTime: "12:15", memo: "平和祈念公園内" },
    { id: "naha-2026-gate-2", name: "第2制限地点", distanceKm: 34.3, closingTime: "14:10", memo: "那覇看護専門学校" },
    { id: "naha-2026-finish", name: "FINISH", distanceKm: 42.195, closingTime: "15:15", memo: "奥武山陸上競技場" }
  ],
  sections: [
    { startKm: 0, endKm: 5, terrain: "flat", description: "序盤の混雑を考慮する区間。", confidence: "medium" },
    { startKm: 5, endKm: 10, terrain: "uphill", description: "上り基調として試算。", confidence: "low" },
    { startKm: 10, endKm: 15, terrain: "rolling", description: "起伏が続く区間として試算。", confidence: "low" },
    { startKm: 15, endKm: 20, terrain: "uphill", description: "中間点手前まで余裕を残したい区間。", confidence: "low" },
    { startKm: 20, endKm: 25, terrain: "downhill", description: "第1制限地点後の下り基調として試算。", confidence: "low" },
    { startKm: 25, endKm: 30, terrain: "mixed", description: "後半に入る前の切り替え区間。", confidence: "low" },
    { startKm: 30, endKm: 35, terrain: "rolling", description: "第2制限地点に向けて余裕確認が必要な区間。", confidence: "low" },
    { startKm: 35, endKm: 40, terrain: "flat", description: "終盤の粘り区間。", confidence: "medium" },
    { startKm: 40, endKm: 42.195, terrain: "flat", description: "ゴールまでの最終区間。", confidence: "medium" }
  ],
  waterStations: [],
  sources: [
    { title: "NAHAマラソン公式サイト 大会概要", url: "https://naha-marathon.jp/info/", type: "official-web", accessedAt: "2026-07-02" },
    { title: "NAHAマラソン公式サイト コース・関門規制", url: "https://naha-marathon.jp/course/", type: "official-web", accessedAt: "2026-07-02" }
  ],
  verificationStatus: "partially-verified",
  verifiedAt: "2026-07-02",
  notes: [
    "大会基本情報と関門時刻は公式サイトの公開情報を参照しています。",
    "5km区間の地形分類は試験版の目安です。公式高低図の数値転載ではありません。",
    "公式画像、ロゴ、コース図は保存・転載していません。"
  ]
};
