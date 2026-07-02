import type { MccCategory, OfficialRaceData, SourceUsageStatus } from "../raceData";

type TemplateInput = {
  id: string;
  slug: string;
  name: string;
  officialName?: string;
  prefecture: string;
  city?: string;
  url: string;
  category?: OfficialRaceData["category"];
  distanceKm?: number;
  mccCategory?: MccCategory | null;
  mccListedDate?: string | null;
  sourceUsageStatus?: SourceUsageStatus;
};

export function createUnverifiedRaceTemplate(input: TemplateInput): OfficialRaceData {
  const category = input.category ?? "full";
  const distanceKm = input.distanceKm ?? (category === "half" ? 21.0975 : category === "ultra" ? 100 : 42.195);
  const sections = Array.from({ length: Math.ceil(distanceKm / 5) }, (_, index) => {
    const startKm = index * 5;
    const endKm = Math.min((index + 1) * 5, distanceKm);
    return { startKm, endKm, terrain: "unknown" as const, description: "高低差データなし", confidence: "unknown" as const };
  });
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
    category,
    distanceKm,
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
    sections,
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

export function createUnverifiedFullMarathonTemplate(input: TemplateInput): OfficialRaceData {
  return createUnverifiedRaceTemplate({ ...input, category: "full", distanceKm: 42.195 });
}
