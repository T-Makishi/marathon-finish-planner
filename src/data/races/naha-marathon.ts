import type { OfficialRaceData } from "../raceData";

export const nahaMarathon: OfficialRaceData = {
  id: "naha-marathon-2026",
  slug: "naha-marathon",
  name: "第40回記念NAHAマラソン",
  officialName: "第40回記念NAHAマラソン",
  year: 2026,
  prefecture: "沖縄県",
  city: "那覇市",
  eventDate: "2026-12-06",
  officialEventDate: "2026-12-06",
  mccListedDate: null,
  dateConflict: false,
  category: "full",
  distanceKm: 42.195,
  startLocation: "奥武山公園",
  finishLocation: "奥武山陸上競技場",
  startTime: "09:00",
  timeLimitMinutes: 375,
  mccMember: false,
  mccCategory: "other",
  startType: "single",
  courseDifficulty: "hard",
  courseSummary: "那覇市から南部5市町を通り、平和祈念公園を経由して奥武山陸上競技場へ戻るフルマラソン。公式サイトで確認できる大会概要、関門規制、競技中止勧告地点、リタイアバス地点を反映しています。",
  checkpoints: [
    { id: "naha-2026-stop-advisory-1", name: "競技中止勧告 1", distanceKm: 7.2, closingTime: "10:25", memo: "仲井真交差点。関門ではなく、交通規制解除に伴う安全確認地点として登録。" },
    { id: "naha-2026-stop-advisory-2", name: "競技中止勧告 2", distanceKm: 13.3, closingTime: "11:20", memo: "東風平中学校前。関門ではなく、交通規制解除に伴う安全確認地点として登録。" },
    { id: "naha-2026-stop-advisory-3", name: "競技中止勧告 3", distanceKm: 17.1, closingTime: "11:50", memo: "具志頭交差点。関門ではなく、交通規制解除に伴う安全確認地点として登録。" },
    { id: "naha-2026-gate-1", name: "第1制限地点", distanceKm: 21.3, closingTime: "12:15", memo: "平和祈念公園内" },
    { id: "naha-2026-stop-advisory-4", name: "競技中止勧告 4", distanceKm: 28.3, closingTime: "13:20", memo: "南部病院跡地前。関門ではなく、交通規制解除に伴う安全確認地点として登録。" },
    { id: "naha-2026-gate-2", name: "第2制限地点", distanceKm: 34.3, closingTime: "14:10", memo: "那覇看護専門学校" },
    { id: "naha-2026-stop-advisory-5", name: "競技中止勧告 5", distanceKm: 39.3, closingTime: "14:55", memo: "赤嶺交差点。関門ではなく、交通規制解除に伴う安全確認地点として登録。" },
    { id: "naha-2026-finish", name: "FINISH", distanceKm: 42.195, closingTime: "15:15", memo: "奥武山陸上競技場" }
  ],
  sections: [
    { startKm: 0, endKm: 7.2, terrain: "mixed", description: "奥武山公園から久茂地、国際通り方面を経て仲井真交差点へ向かう序盤。混雑とロスタイムを見込む区間。", confidence: "low" },
    { startKm: 7.2, endKm: 13.3, terrain: "uphill", description: "仲井真交差点から東風平中学校前方面。前半の余裕を削りやすい上り基調の参考区間。", confidence: "low" },
    { startKm: 13.3, endKm: 17.1, terrain: "rolling", description: "東風平中学校前から具志頭交差点方面。起伏を見込んで無理に上げない区間。", confidence: "low" },
    { startKm: 17.1, endKm: 21.3, terrain: "rolling", description: "具志頭交差点から平和祈念公園内の第1制限地点へ向かう区間。第1制限地点の余裕を優先。", confidence: "low" },
    { startKm: 21.3, endKm: 28.3, terrain: "downhill", description: "平和祈念公園からひめゆりの塔、琉球ガラス村方面を経て南部病院跡地前へ向かう後半入りの区間。", confidence: "low" },
    { startKm: 28.3, endKm: 34.3, terrain: "mixed", description: "南部病院跡地前から糸満ロータリー方面を経て第2制限地点へ向かう区間。給水・補給の停止を含めて余裕確認。", confidence: "low" },
    { startKm: 34.3, endKm: 39.3, terrain: "flat", description: "那覇看護専門学校から小禄バイパス、赤嶺交差点方面。終盤の失速を抑える区間。", confidence: "low" },
    { startKm: 39.3, endKm: 42.195, terrain: "flat", description: "赤嶺交差点から奥武山運動公園へ戻る最終区間。ゴール制限時刻までの残り余裕を確認。", confidence: "medium" }
  ],
  waterStations: [],
  supportPoints: [
    { distanceKm: 13.3, name: "東風平中学校前", type: "retire-bus", confidence: "high" },
    { distanceKm: 17.5, name: "ローソン八重瀬 玻名城店", type: "retire-bus", confidence: "high" },
    { distanceKm: 21.3, name: "第1制限地点", type: "retire-bus", confidence: "high" },
    { distanceKm: 26.2, name: "琉球ガラス村", type: "retire-bus", confidence: "high" },
    { distanceKm: 34.3, name: "第2制限地点", type: "retire-bus", confidence: "high" }
  ],
  sources: [
    {
      title: "NAHAマラソン公式サイト 大会概要",
      url: "https://naha-marathon.jp/info/",
      type: "official-web",
      accessedAt: "2026-07-02",
      usageStatus: "public-facts-only",
      usageNotes: ["大会概要に掲載された客観的な基本情報だけを参照しています。"]
    },
    {
      title: "NAHAマラソン公式サイト コース・関門規制",
      url: "https://naha-marathon.jp/course/",
      type: "official-web",
      accessedAt: "2026-07-02",
      usageStatus: "public-facts-only",
      usageNotes: ["関門時刻、距離、地点名などの客観情報だけを参照しています。コース図画像は保存・転載していません。"]
    }
  ],
  verificationStatus: "partially-verified",
  publicationAllowed: true,
  verifiedAt: "2026-07-02",
  extractionWarnings: [
    "高低差区間は公式画像や数値を転載せず、コース上の地点から作った参考目安です。精密な標高データではありません。"
  ],
  legalReviewNotes: [
    "公式画像、ロゴ、コース図、PDF画像、長い公式説明文は保存・転載していません。",
    "大会要項は変更される場合があるため、参加前に公式サイトで最新情報を確認してください。"
  ],
  notes: [
    "大会基本情報、関門時刻、競技中止勧告地点、リタイアバス待機所は公式サイトの公開情報を参照しています。",
    "競技中止勧告地点は正式な関門とは異なりますが、完走計画上の安全確認地点として登録しています。",
    "区間の地形分類は公式高低図の画像や数値を転載せず、低信頼度の参考目安として設定しています。",
    "公式画像、ロゴ、コース図は保存・転載していません。"
  ]
};
