import type { OfficialRaceData } from "../raceData";

export const nagoyaWomensMarathon: OfficialRaceData = {
  id: "nagoya-womens-marathon-2027",
  slug: "nagoya-womens-marathon",
  name: "名古屋ウィメンズマラソン2027",
  officialName: "名古屋ウィメンズマラソン2027",
  year: 2027,
  prefecture: "愛知県",
  city: "名古屋市",
  eventDate: "2027-03-14",
  officialEventDate: "2027-03-14",
  mccListedDate: null,
  dateConflict: false,
  category: "full",
  distanceKm: 42.195,
  startLocation: "バンテリンドーム ナゴヤ",
  finishLocation: "バンテリンドーム ナゴヤ",
  startTime: "09:10",
  timeLimitMinutes: 420,
  mccMember: null,
  mccCategory: null,
  startType: "single",
  courseDifficulty: "normal",
  courseSummary: "バンテリンドーム ナゴヤ発着の女子フルマラソン。公式開催概要で確認できる開催日、スタート時刻、制限時間、コース閉鎖地点を反映しています。公式サイト上ではMGCシリーズ対象大会として案内されていますが、MCC区分は未確認です。",
  checkpoints: [
    { id: "nagoya-womens-2027-start-close", name: "スタート閉鎖", distanceKm: 0, closingTime: "09:40", memo: "スタート地点" },
    { id: "nagoya-womens-2027-close-1", name: "コース閉鎖 1", distanceKm: 6.0, closingTime: "10:30", memo: "名古屋市博物館" },
    { id: "nagoya-womens-2027-close-2", name: "コース閉鎖 2", distanceKm: 10.4, closingTime: "11:55", memo: "妙音通4交差点" },
    { id: "nagoya-womens-2027-close-3", name: "コース閉鎖 3", distanceKm: 15.7, closingTime: "12:35", memo: "大久手交差点" },
    { id: "nagoya-womens-2027-close-4", name: "コース閉鎖 4", distanceKm: 21.5, closingTime: "12:52", memo: "若宮北交差点" },
    { id: "nagoya-womens-2027-close-5", name: "コース閉鎖 5", distanceKm: 26.2, closingTime: "13:37", memo: "丸の内中学校" },
    { id: "nagoya-womens-2027-close-6", name: "コース閉鎖 6", distanceKm: 29.9, closingTime: "14:11", memo: "秩父通交差点" },
    { id: "nagoya-womens-2027-close-7", name: "コース閉鎖 7", distanceKm: 35.0, closingTime: "14:59", memo: "中日新聞社" },
    { id: "nagoya-womens-2027-close-8", name: "コース閉鎖 8", distanceKm: 38.6, closingTime: "15:32", memo: "桜通車道交差点" },
    { id: "nagoya-womens-2027-close-9", name: "コース閉鎖 9", distanceKm: 41.7, closingTime: "16:05", memo: "ドーム駐車場入口" },
    { id: "nagoya-womens-2027-finish", name: "FINISH", distanceKm: 42.195, closingTime: "16:10", memo: "バンテリンドーム ナゴヤ" }
  ],
  sections: [
    { startKm: 0, endKm: 5, terrain: "flat", description: "スタート直後の混雑を見込み、無理に上げない序盤区間。", confidence: "low" },
    { startKm: 5, endKm: 10, terrain: "flat", description: "名古屋市博物館方面を通過する前半の一定ペース区間。", confidence: "low" },
    { startKm: 10, endKm: 15, terrain: "flat", description: "妙音通4交差点から大久手交差点方面。閉鎖時刻に対する余裕を確認する区間。", confidence: "low" },
    { startKm: 15, endKm: 20, terrain: "flat", description: "中間点へ向けてペースを整える区間。", confidence: "low" },
    { startKm: 20, endKm: 25, terrain: "flat", description: "若宮北交差点通過後、後半に備えて補給と余裕を確認する区間。", confidence: "low" },
    { startKm: 25, endKm: 30, terrain: "flat", description: "名古屋城周辺の通過目安を含む中盤後半。", confidence: "low" },
    { startKm: 30, endKm: 35, terrain: "flat", description: "市街地を戻る終盤入り。ペース低下を抑える区間。", confidence: "low" },
    { startKm: 35, endKm: 40, terrain: "flat", description: "桜通車道交差点方面を含む終盤。残り時間と脚の余裕を優先。", confidence: "low" },
    { startKm: 40, endKm: 42.195, terrain: "flat", description: "ドーム駐車場入口からフィニッシュへ向かう最終区間。", confidence: "low" }
  ],
  waterStations: [],
  supportPoints: [],
  sources: [
    {
      title: "名古屋ウィメンズマラソン公式サイト 開催概要",
      url: "https://womens-marathon.nagoya/outline/general/",
      type: "official-web",
      accessedAt: "2026-07-03",
      usageStatus: "public-facts-only",
      usageNotes: [
        "開催日、スタート時刻、制限時間、コース閉鎖地点などの客観情報だけを参照しています。",
        "参加資格や規約の長文は転載していません。"
      ]
    },
    {
      title: "名古屋ウィメンズマラソン公式サイト コース",
      url: "https://womens-marathon.nagoya/course/",
      type: "official-web",
      accessedAt: "2026-07-03",
      usageStatus: "public-facts-only",
      usageNotes: [
        "コースの地点確認だけに使用しています。",
        "公式画像、コース図、高低図、動画は保存・転載していません。"
      ]
    }
  ],
  verificationStatus: "partially-verified",
  publicationAllowed: true,
  verifiedAt: "2026-07-03",
  extractionWarnings: [
    "高低差は公式高低図画像を転載せず、アプリ用の参考目安として平坦寄りに設定しています。精密な標高データではありません。",
    "MCC加盟区分は公式ページ上で確認できていないため未確認です。公式ページではMGCシリーズ対象大会として案内されています。"
  ],
  legalReviewNotes: [
    "公式画像、ロゴ、コース図、PDF画像、動画、長い公式説明文は保存・転載していません。",
    "大会要項や閉鎖時刻は変更される場合があるため、参加前に公式サイトで最新情報を確認してください。"
  ],
  notes: [
    "公式開催概要に掲載された客観情報をもとに登録しています。",
    "コース閉鎖地点は完走計画上の関門相当として登録しています。",
    "本アプリは大会主催者の公式アプリではありません。"
  ]
};
