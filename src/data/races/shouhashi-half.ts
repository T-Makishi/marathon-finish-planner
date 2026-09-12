import type { OfficialRaceData } from '../raceData';

export const shouhashiHalf: OfficialRaceData = {
  id: 'shouhashi-half-2026', slug: 'shouhashi-half',
  name: '第23回 尚巴志ハーフマラソン（2026年）',
  officialName: '第23回 琉球国王 尚巴志ハーフマラソン in 南城市',
  year: 2026, prefecture: '沖縄県', city: '南城市',
  eventDate: '2026-11-01', officialEventDate: '2026-11-01',
  category: 'half', distanceKm: 21.442,
  startLocation: '佐敷小学校前', finishLocation: 'シュガーホール駐車場前',
  startTime: '09:00', startType: 'single', timeLimitMinutes: 195,
  checkpoints: [{ id: 'shouhashi-half-2026-13km', name: '知念小学校前', distanceKm: 13, closingTime: '11:00', elapsedLimitMinutes: 120 }],
  sections: [], waterStations: [],
  courseSummary: '新里坂の上りとニライ・カナイ橋の下りを含むコース。後半16〜20kmは平坦。',
  verificationStatus: 'partially-verified', verifiedAt: '2026-09-12', publicationAllowed: true,
  sources: [
    { title: '第23回 大会要項', url: 'https://www.shouhashi.jp/yoko', type: 'official-web', accessedAt: '2026-09-12', usageStatus: 'public-facts-only' },
    { title: '公式レースガイド', url: 'https://www.shouhashi.jp/guide', type: 'official-web', accessedAt: '2026-09-12', usageStatus: 'public-facts-only' },
    { title: '公式トップページ・受付状況', url: 'https://www.shouhashi.jp/', type: 'official-web', accessedAt: '2026-09-12', usageStatus: 'public-facts-only' },
  ],
  notes: [
    'ハーフの部は21.442km。13km・知念小学校前11:00、ゴール12:15（号砲から3時間15分）。関門に間に合わない場合は競技中止し、係員の指示に従ってリタイアバスへ。',
    '新里坂は5km付近、長さ1.2km・高低差150m。ニライ・カナイ橋は11〜12km付近（公式ページ間で表記差あり）。16〜20kmは平坦。正確な坂の区間境界・給水地点・ペース補正は未登録です。',
    '会場：シュガーホール駐車場特設会場。スタート：佐敷小学校前。フィニッシュ：シュガーホール駐車場前。',
    '対象：高校生以上。ハーフ定員5,000人。2026年9月12日確認時点で定員到達・受付終了。',
    '2026年参加費：大人7,000円、18歳以下4,000円。大会運営・安全対策・保険・参加賞を含みます。',
    '第14回以降は県道137号線を経由し、沖縄のみち自転車道を通りません。当日の変更は最新の公式案内で確認してください。',
  ],
};
