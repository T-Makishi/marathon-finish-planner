import type { OfficialRaceData, RaceDataCheckpoint } from '../raceData';

// Official event facts checked on 2026-09-12. Missing course/gate data is not inferred.
type Event = { slug: string; name: string; prefecture: string; city: string; date: string; url: string; extraUrls?: string[]; notes?: string[] };
type Distance = { km: number; time?: string; limit?: number; waves?: string[]; gates?: [number, string][]; notes?: string[] };
function races(event: Event, distances: Distance[]): OfficialRaceData[] {
  return distances.map(d => {
    const category = d.km === 42.195 ? 'full' : d.km === 21.0975 ? 'half' : d.km > 42.195 ? 'ultra' : 'other';
    const slug = `${event.slug}-${d.km}`;
    const checkpoints: RaceDataCheckpoint[] = (d.gates || []).map(([distanceKm, closingTime], i) => ({ id: `${slug}-gate-${i + 1}`, name: `第${i + 1}関門`, distanceKm, closingTime }));
    return {
      id: `${slug}-${event.date.slice(0, 4)}`, slug, name: event.name, officialName: event.name,
      year: Number(event.date.slice(0, 4)), prefecture: event.prefecture, city: event.city,
      eventDate: event.date, officialEventDate: event.date, category, distanceKm: d.km,
      startTime: d.time || null, timeLimitMinutes: d.limit || null, startType: d.waves ? 'wave' : d.time ? 'single' : 'unknown',
      startOptions: d.waves?.map((time, i) => ({ id: String(i), label: `${time} スタート（参加案内で確認）`, time })),
      checkpoints, sections: [], waterStations: [], courseDifficulty: 'unknown',
      sources: [event.url, ...(event.extraUrls || [])].map(url => ({ title: `${event.name} 公式開催情報`, url, type: 'official-web', accessedAt: '2026-09-12', usageStatus: 'public-facts-only' })),
      verificationStatus: 'partially-verified', verifiedAt: '2026-09-12', publicationAllowed: true,
      notes: [...(d.notes || []), ...(event.notes || []), checkpoints.length ? '高低差・給水地点は未登録です。関門の当日変更は公式案内で確認してください。' : '関門・高低差・給水地点は未登録です。参加年度の公式案内で確認して入力してください。'],
    };
  });
}
const waveNote = '選択した参加区分の号砲を開始時刻に設定します。スタートラインまでの遅れは計画画面で追加してください。';
export const domesticRaceData: OfficialRaceData[] = [
  ...races({ slug: 'fuji-five-lakes', name: 'チャレンジ富士五湖ウルトラマラソン', prefecture: '山梨県', city: '富士吉田市', date: '2026-04-19', url: 'https://www.r-wellness.com/fuji5/outline/', notes: [waveNote] }, [
    { km: 120, limit: 915, waves: ['04:00', '04:15'] }, { km: 100, limit: 840, waves: ['04:30', '04:45', '05:00'] }, { km: 80, time: '06:00', limit: 750 }, { km: 62, limit: 660, waves: ['06:45', '07:00'] },
  ]),
  ...races({ slug: 'nobeyama', name: '星の郷八ヶ岳野辺山高原100kmウルトラマラソン', prefecture: '長野県', city: '南牧村', date: '2026-05-17', url: 'https://www.r-wellness.com/nobeyama/outline/', notes: [waveNote] }, [{ km: 100, limit: 840, waves: ['04:55', '05:10'] }, { km: 68, time: '04:55', limit: 590 }]),
  ...races({ slug: 'hida-takayama', name: '飛騨高山ウルトラマラソン', prefecture: '岐阜県', city: '高山市', date: '2026-06-14', url: 'https://www.r-wellness.com/takayama/outline/', notes: [waveNote] }, [{ km: 100, limit: 840, waves: ['04:30', '04:50'] }, { km: 71, time: '05:20', limit: 660 }]),
  ...races({ slug: 'tango', name: '丹後100kmウルトラマラソン', prefecture: '京都府', city: '京丹後市', date: '2026-09-20', url: 'https://www.r-wellness.com/tango/outline/', notes: [waveNote] }, [{ km: 100, limit: 840, waves: ['04:20', '04:25', '04:30', '04:35', '04:40'] }, { km: 60, time: '09:00', limit: 570 }]),
  ...races({ slug: 'nara-ultra', name: '奈良ウルトラマラソン', prefecture: '奈良県', city: '橿原市', date: '2026-05-31', url: 'https://www.r-wellness.com/nara/outline/', notes: [waveNote] }, [{ km: 100, limit: 870, waves: ['04:30', '04:35', '04:40', '04:45', '04:50', '04:55'] }]),
  ...races({ slug: 'okinoshima', name: '隠岐の島ウルトラマラソン', prefecture: '島根県', city: '隠岐の島町', date: '2026-06-21', url: 'https://okinoshima-ultra.jp/outline/' }, [{ km: 100, time: '05:00', limit: 870 }, { km: 50, time: '11:30', limit: 480 }]),
  ...races({ slug: 'iki', name: '神々の島 壱岐ウルトラマラソン', prefecture: '長崎県', city: '壱岐市', date: '2026-10-17', url: 'https://iki-ultra.jp/about/', notes: ['関門には到着と出発の条件があります。両方を参加案内で確認して登録してください。'] }, [{ km: 100, time: '05:00', limit: 840 }, { km: 50, time: '11:00', limit: 480 }]),
  ...races({ slug: 'iwate-ginga', name: 'いわて銀河ウルトラマラソン', prefecture: '岩手県', city: '北上市・花巻市・西和賀町・雫石町', date: '2026-06-14', url: 'https://www.iwate-ginga100.jp/20%E5%9B%9E%E5%A4%A7%E4%BC%9A%E6%A6%82%E8%A6%81' }, [{ km: 100, time: '04:00', limit: 840 }, { km: 70, time: '07:00', limit: 660 }, { km: 50, time: '10:00', limit: 480 }]),
  ...races({ slug: 'ibaraki-rokko', name: '茨城100Kウルトラマラソン in 鹿行', prefecture: '茨城県', city: '行方市', date: '2026-03-08', url: 'https://ibaraki100k.teamsportsjapan.jp/outline/' }, [{ km: 100, time: '05:00', limit: 840, gates: [[34,'10:00'],[49,'12:00'],[59,'13:30'],[70,'15:00'],[85,'17:00'],[95,'18:15']] }]),
  ...races({ slug: 'aizu-bandai', name: '会津磐梯山ウルトラマラソン', prefecture: '福島県', city: '猪苗代町・北塩原村・磐梯町', date: '2026-06-14', url: 'https://www.outdoorsportsjapan.com/aizu_ultra/race-aizu/' }, [
    { km: 100, time: '05:00', limit: 900, gates: [[33,'10:00'],[63,'15:00'],[84,'17:15'],[93,'18:45']] },
    { km: 65, time: '07:00', limit: 660, gates: [[30,'12:15'],[51,'15:15'],[60,'16:45']] },
    { km: 44, time: '10:00', limit: 450, gates: [[27,'14:45'],[37,'16:15']] },
  ]),
  ...races({ slug: 'aga', name: '阿賀ウルトラマラソン', prefecture: '新潟県', city: '阿賀町', date: '2026-09-27', url: 'https://agaultra.com/race-information/', extraUrls: ['https://agaultra.com/%E6%96%B0%E3%82%B3%E3%83%BC%E3%82%B9%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6/'] }, [
    { km: 103, time: '04:00', limit: 855, notes: ['ロングは2026年9月1日の公式変更により100kmから103kmへ変更されています。'] }, { km: 65, time: '07:30', limit: 540 },
  ]),
  ...races({ slug: 'shonan-international', name: '湘南国際マラソン', prefecture: '神奈川県', city: '大磯町', date: '2026-12-06', url: 'https://www.shonan-kokusai.jp/outline/', notes: ['スタート制限は号砲後30分です。回収バスに追いつかれると、関門時刻前でも競技終了になります。'] }, [{ km: 42.195, time: '09:00', limit: 390, gates: [[5.1,'10:10'],[10.8,'10:56'],[14.2,'11:24'],[19.2,'12:03'],[21.9,'12:25'],[28.3,'13:17'],[35,'14:13'],[37.1,'14:29'],[39.6,'14:55']] }]),
  ...races({ slug: 'chiba-aqualine', name: 'ちばアクアラインマラソン', prefecture: '千葉県', city: '木更津市・袖ケ浦市', date: '2026-11-08', url: 'https://chiba-aqualine-marathon.com/tournament/', extraUrls: ['https://chiba-aqualine-marathon.com/tournament/wavestart.html'], notes: ['制限時間と各関門は参加するウェーブの公式案内で確認して入力してください。短縮開催時は開始時刻も変わります。'] }, [{ km: 42.195, waves: ['09:45','09:50','09:55'] }, { km: 21.0975, waves: ['09:45','09:50','09:55'] }]),
  ...races({ slug: 'asahikawa-half', name: '旭川ハーフマラソン', prefecture: '北海道', city: '旭川市', date: '2026-09-27', url: 'https://www.asahikawa-half-marathon.jp/outline/' }, [{ km: 21.0975, time: '08:30', limit: 180, gates: [[4.6,'09:09'],[8.3,'09:39'],[15,'10:36'],[18,'11:02']] }]),
  ...races({ slug: 'tokyo-legacy-half', name: '東京レガシーハーフマラソン', prefecture: '東京都', city: '新宿区', date: '2026-10-18', url: 'https://legacyhalf.tokyo/about/outline/', notes: ['制限時間は第1ウェーブ08:05基準です。第2ウェーブ08:08、第3ウェーブ08:15の参加者は、計画のスタート詳細に自分のウェーブ時刻を入力してください。'] }, [{ km: 21.0975, time: '08:05', limit: 180 }]),
  ...races({ slug: 'osaka-half', name: '大阪ハーフマラソン', prefecture: '大阪府', city: '大阪市', date: '2027-01-31', url: 'https://half.osaka-marathon.jp/outline/' }, [{ km: 21.0975, time: '12:00', limit: 125, gates: [[2,'12:18'],[5.8,'12:39'],[6.9,'12:44'],[12.6,'13:14'],[14.9,'13:28'],[18.6,'13:51'],[20.6,'14:05']] }]),
  ...races({ slug: 'gifu-seiryu-half', name: '高橋尚子杯ぎふ清流ハーフマラソン', prefecture: '岐阜県', city: '岐阜市', date: '2027-04-25', url: 'https://www.gifu-marathon.jp/race/outline/', notes: ['制限時間は第1ウェーブ09:00基準です。第2ウェーブ参加者は、計画のスタート詳細に09:10を入力してください。関門時刻は予定です。'] }, [{ km: 21.0975, time: '09:00', limit: 185, gates: [[5.8,'10:10'],[10.1,'10:40'],[13.2,'11:00'],[17.3,'11:32']] }]),
];
