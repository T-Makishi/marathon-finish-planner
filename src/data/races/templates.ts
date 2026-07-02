import type { OfficialRaceData } from "../raceData";

type TemplateInput = {
  id: string;
  slug: string;
  name: string;
  prefecture: string;
  city?: string;
  url: string;
};

export function createUnverifiedFullMarathonTemplate(input: TemplateInput): OfficialRaceData {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    year: null,
    prefecture: input.prefecture,
    city: input.city,
    eventDate: null,
    category: "full",
    distanceKm: 42.195,
    startLocation: null,
    finishLocation: null,
    startTime: null,
    timeLimitMinutes: null,
    mccMember: null,
    startType: "unknown",
    courseDifficulty: "unknown",
    courseSummary: "公式情報の確認待ちです。大会名、距離、公式サイトURLだけをひな型として登録しています。",
    checkpoints: [],
    sections: [
      { startKm: 0, endKm: 5, terrain: "unknown", description: "高低差データなし", confidence: "unknown" },
      { startKm: 5, endKm: 10, terrain: "unknown", description: "高低差データなし", confidence: "unknown" },
      { startKm: 10, endKm: 15, terrain: "unknown", description: "高低差データなし", confidence: "unknown" },
      { startKm: 15, endKm: 20, terrain: "unknown", description: "高低差データなし", confidence: "unknown" },
      { startKm: 20, endKm: 25, terrain: "unknown", description: "高低差データなし", confidence: "unknown" },
      { startKm: 25, endKm: 30, terrain: "unknown", description: "高低差データなし", confidence: "unknown" },
      { startKm: 30, endKm: 35, terrain: "unknown", description: "高低差データなし", confidence: "unknown" },
      { startKm: 35, endKm: 40, terrain: "unknown", description: "高低差データなし", confidence: "unknown" },
      { startKm: 40, endKm: 42.195, terrain: "unknown", description: "高低差データなし", confidence: "unknown" }
    ],
    waterStations: [],
    sources: [{ title: `${input.name} 公式サイト`, url: input.url, type: "official-web", accessedAt: "2026-07-02" }],
    verificationStatus: "unverified",
    verifiedAt: null,
    notes: [
      "このデータは未確認のひな型です。関門、制限時間、スタート時刻は公式サイトで確認して入力してください。",
      "公式画像、ロゴ、コース図、公式文章は保存・転載していません。"
    ]
  };
}
