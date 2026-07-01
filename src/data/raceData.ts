export type RaceDataCategory = "full" | "half" | "ultra" | "other";
export type RaceDataStatus = "verified" | "partially-verified" | "previous-year" | "unverified" | "awaiting-official";
export type RaceDataDifficulty = "easy" | "normal" | "hard" | "very-hard";
export type RaceDataTerrain = "flat" | "uphill" | "downhill" | "rolling" | "mixed" | "unknown";

export type RaceDataSource = {
  title: string;
  url: string;
  type: "official-web" | "official-pdf";
  accessedAt: string;
};

export type RaceDataCheckpoint = {
  id: string;
  name: string;
  distanceKm: number;
  closingTime?: string;
  elapsedLimitMinutes?: number;
  memo?: string;
};

export type RaceDataSection = {
  startKm: number;
  endKm: number;
  elevationGainM?: number;
  elevationLossM?: number;
  terrain: RaceDataTerrain;
  description?: string;
  confidence?: "high" | "medium" | "low";
};

export type RaceDataWaterStation = {
  distanceKm: number;
  name?: string;
};

export type OfficialRaceData = {
  id: string;
  slug: string;
  name: string;
  year: number;
  prefecture: string;
  city?: string;
  eventDate?: string;
  category: RaceDataCategory;
  distanceKm: number;
  startTime?: string;
  timeLimitMinutes?: number;
  mccMember?: boolean;
  courseDifficulty?: RaceDataDifficulty;
  courseSummary?: string;
  checkpoints: RaceDataCheckpoint[];
  sections: RaceDataSection[];
  waterStations?: RaceDataWaterStation[];
  sources: RaceDataSource[];
  verificationStatus: RaceDataStatus;
  verifiedAt?: string;
  notes?: string[];
};

export const OFFICIAL_RACE_DATA: OfficialRaceData[] = [
  {
    id: "naha-marathon-2026",
    slug: "naha-marathon",
    name: "第40回記念NAHAマラソン",
    year: 2026,
    prefecture: "沖縄県",
    city: "那覇市",
    eventDate: "2026-12-06",
    category: "full",
    distanceKm: 42.195,
    startTime: "09:00",
    timeLimitMinutes: 375,
    mccMember: false,
    courseDifficulty: "hard",
    courseSummary: "那覇市、南風原町、八重瀬町、糸満市、豊見城市の南部5市町を通るフルマラソン。公式サイトの高低図を参考に、前半から中盤に起伏があるものとして試算します。",
    checkpoints: [
      { id: "naha-2026-gate-1", name: "第1制限地点", distanceKm: 21.3, closingTime: "12:15", memo: "平和祈念公園内" },
      { id: "naha-2026-gate-2", name: "第2制限地点", distanceKm: 34.3, closingTime: "14:10", memo: "那覇看護専門学校" },
      { id: "naha-2026-finish", name: "FINISH", distanceKm: 42.195, closingTime: "15:15", memo: "奥武山陸上競技場" }
    ],
    sections: [
      { startKm: 0, endKm: 5, terrain: "flat", description: "市街地スタート区間。混雑を考慮して無理に上げすぎない区間。", confidence: "medium" },
      { startKm: 5, endKm: 10, terrain: "uphill", description: "南部方面へ向かう序盤の上り基調として試算。", confidence: "low" },
      { startKm: 10, endKm: 15, terrain: "rolling", description: "起伏が続く区間として試算。", confidence: "low" },
      { startKm: 15, endKm: 20, terrain: "uphill", description: "中間点手前まで余裕を残したい区間。", confidence: "low" },
      { startKm: 20, endKm: 25, terrain: "downhill", description: "第1制限地点通過後、脚を使い切らない下り基調として試算。", confidence: "low" },
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
      "大会基本情報、スタート、ゴール、制限時間、関門時刻は公式サイトを参照しています。",
      "5km区間の地形分類は公式高低図を数値化したものではなく、試験版の目安です。必ず公式資料で確認してください。",
      "公式画像、ロゴ、コース画像は保存・転載していません。"
    ]
  },
  {
    id: "sample-full-course-2026",
    slug: "sample-full-course",
    name: "開発用サンプル フルマラソン",
    year: 2026,
    prefecture: "東京都",
    city: "千代田区",
    eventDate: "2026-11-01",
    category: "full",
    distanceKm: 42.195,
    startTime: "09:00",
    timeLimitMinutes: 360,
    mccMember: false,
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
    sources: [
      { title: "アプリ内開発用サンプル", url: "https://example.com/sample-race-data", type: "official-web", accessedAt: "2026-07-02" }
    ],
    verificationStatus: "unverified",
    verifiedAt: "2026-07-02",
    notes: ["このデータは動作確認用の架空データです。公式大会情報として利用しないでください。"]
  }
];
