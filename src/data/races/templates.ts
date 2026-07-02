import type { MccCategory, OfficialRaceData, SourceUsageStatus } from "../raceData";

type TemplateInput = {
  id: string;
  slug: string;
  name: string;
  officialName?: string;
  prefecture: string;
  city?: string;
  url: string;
  mccCategory?: MccCategory | null;
  mccListedDate?: string | null;
  sourceUsageStatus?: SourceUsageStatus;
};

export function createUnverifiedFullMarathonTemplate(input: TemplateInput): OfficialRaceData {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    officialName: input.officialName ?? input.name,
    year: null,
    prefecture: input.prefecture,
    city: input.city,
    eventDate: null,
    officialEventDate: null,
    mccListedDate: input.mccListedDate ?? null,
    dateConflict: false,
    category: "full",
    distanceKm: 42.195,
    startLocation: null,
    finishLocation: null,
    startTime: null,
    timeLimitMinutes: null,
    mccMember: input.mccCategory ? input.mccCategory !== "other" : null,
    mccCategory: input.mccCategory ?? null,
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
    sources: [{
      title: `${input.name} 公式サイト`,
      url: input.url,
      type: "official-web",
      accessedAt: "2026-07-02",
      usageStatus: input.sourceUsageStatus ?? "public-facts-only",
      usageNotes: [
        "大会名、開催地、距離などの客観的な事実確認だけに使用します。",
        "公式画像、ロゴ、コース図、公式文章は保存・転載しません。"
      ]
    }],
    verificationStatus: "needs-review",
    publicationAllowed: true,
    verifiedAt: null,
    extractionWarnings: [
      "公式詳細は未確認です。URL提供後に、関門時刻・制限時間・開催日などの客観情報だけを人が確認して反映します。"
    ],
    legalReviewNotes: [
      "公式画像、ロゴ、コース図、PDF画像、長い公式説明文はアプリ内に保存していません。",
      "公開前に公式サイトの利用条件と最新情報を確認してください。"
    ],
    notes: [
      "このデータは未確認のひな型です。関門、制限時間、スタート時刻は公式サイトで確認して入力してください。",
      "公式画像、ロゴ、コース図、公式文章は保存・転載していません。"
    ]
  };
}
