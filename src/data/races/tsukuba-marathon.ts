import type { OfficialRaceData } from '../raceData';

export const tsukubaMarathon: OfficialRaceData = {
  id: 'tsukuba-marathon-2026', slug: 'tsukuba-marathon',
  name: '第46回つくばマラソン（2026年）', officialName: '第46回つくばマラソン',
  year: 2026, prefecture: '茨城県', city: 'つくば市', category: 'full', distanceKm: 42.195,
  eventDate: '2026-11-22', officialEventDate: '2026-11-22',
  startTime: '08:50', startType: 'wave', timeLimitMinutes: null,
  startLocation: 'イーアスつくば外周道路', finishLocation: 'つくば市役所',
  checkpoints: [], sections: [], waterStations: [],
  verificationStatus: 'partially-verified', verifiedAt: '2026-09-12', publicationAllowed: true,
  sources: [
    { title: 'つくば市公式・第46回大会', url: 'https://www.city.tsukuba.lg.jp/tsukubamarathon/tsukubamarathon_46th/index.html', type: 'official-web', accessedAt: '2026-09-12', usageStatus: 'public-facts-only' },
    { title: '大会公式サイト（提供一覧掲載URL）', url: 'https://www.tsukuba-marathon.com/', type: 'official-web', accessedAt: '2026-09-12', usageStatus: 'public-facts-only', usageNotes: ['本文取得はアクセス確認画面のため未完了。市公式と公式エントリーの公表事項を使用。'] },
    { title: '市公式が案内する第46回一般エントリー・大会要項', url: 'https://runnet.jp/entry/runtes/user/pc/competitionDetailAction.do?raceId=391457&div=1', type: 'official-web', accessedAt: '2026-09-12', usageStatus: 'public-facts-only' },
  ],
  notes: [
    '第1ウェーブ08:50、08:50〜09:10のウェーブスタート予定。自分のウェーブ時刻は参加案内で確認し、計画画面のスタート詳細に入力してください。',
    '公表制限時間は6時間。基準ウェーブ・競技終了時刻と関門の距離・閉鎖時刻は未確認のため、計算用の完走制限・関門は未登録です。参加案内で確認して入力してください。',
    'スタートはイーアスつくば外周道路、フィニッシュはつくば市役所。第45回からコースを大幅変更しているため、旧コースの関門・高低差を流用しないでください。',
  ],
};
