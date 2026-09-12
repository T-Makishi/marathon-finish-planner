import type { OfficialRaceData, RaceDataCategory } from '../raceData';

// Public event facts only. Annual editions are independent; never update saved plans.
type Event = { key: string; name: string; date: string; city: string; urls: string[]; notes?: string[] };
type Course = { km: number; category?: RaceDataCategory; slug?: string; title?: string; start?: string; limit?: number; gates?: [number, number, string][]; notes?: string[] };
function courses(e: Event, entries: Course[]): OfficialRaceData[] {
  return entries.map(c => {
    const slug = c.slug || `${e.key}-${e.date.slice(0, 4)}-${c.km}`;
    const name = `${e.name}（${e.date.slice(0, 4)}年）${c.title ? `・${c.title}` : ''}`;
    return {
      id: `${slug}-${e.date}`, slug, name, officialName: e.name,
      year: Number(e.date.slice(0, 4)), prefecture: '沖縄県', city: e.city,
      eventDate: e.date, officialEventDate: e.date,
      category: c.category || (c.km === 42.195 ? 'full' : c.km === 21.0975 ? 'half' : c.km > 42.195 ? 'ultra' : 'other'),
      distanceKm: c.km, startTime: c.start || null, timeLimitMinutes: c.limit ?? null,
      startType: c.start ? 'single' : 'unknown',
      checkpoints: (c.gates || []).map(([distanceKm, elapsedLimitMinutes, name], i) => ({ id: `${slug}-gate-${i + 1}`, name, distanceKm, elapsedLimitMinutes })),
      sections: [], waterStations: [], courseDifficulty: 'unknown',
      sources: e.urls.map(url => ({ title: `${e.name} 開催情報・要項`, url, type: /\.pdf(?:\?|$)/i.test(url) ? 'official-pdf' : 'official-web', accessedAt: '2026-09-12', usageStatus: 'public-facts-only' })),
      verificationStatus: 'partially-verified', verifiedAt: '2026-09-12', publicationAllowed: true,
      notes: [...(e.notes || []), ...(c.notes || []), '確認日：2026年9月12日。空欄の時刻と未登録の関門・高低差・給水地点は、参加年度の公式案内を確認してください。'],
    };
  });
}
const approxTrail = 'トレイルコースです。距離は公式の概数です。高低差・路面による補正は自動適用しません。';
const halfNominal = '公式要項は「ハーフ」表記です。計算距離は標準ハーフの21.0975kmを使用しています。実際のコース距離は参加案内で確認してください。';
const multiDay = '日をまたぐ大会です。号砲は最初のスタート時刻を使用し、グループの遅れはスタート詳細に入力してください。';
export const okinawaRaceData: OfficialRaceData[] = [
  ...courses({ key:'iheya-moonlight', name:'第32回伊平屋ムーンライトマラソン', date:'2026-10-24', city:'伊平屋村', urls:['https://iheya-moonlight.jp/about/'], notes:['2026年大会は24kmの種目で開催されます。過去のフル・ハーフの距離を使用しないでください。'] }, [{ km:24, start:'16:30', limit:240, gates:[[15.7,150,'第5エイドステーション']] }]),
  ...courses({ key:'kumejima', name:'久米島マラソン', date:'2026-10-25', city:'久米島町', urls:['https://www.kumejima-marathon.net/outline/'] }, [
    { km:42.195, start:'08:00', limit:420, gates:[[23,220,'23km関門'],[33,330,'33km関門']] },
    { km:21.0975, start:'09:30', limit:210 }, { km:10, start:'09:40', limit:120 }, { km:5, start:'10:00', limit:90 }, { km:3, start:'08:30', limit:45, notes:['小学4年生～中学生、70歳以上の部です。参加資格を確認してください。'] },
  ]),
  ...courses({ key:'miyako-17end', name:'第5回宮古島市17ENDハーフマラソン in 伊良部島大会', date:'2026-11-08', city:'宮古島市', urls:['https://17end-miyakojima.com/outline/'] }, [{ km:21, category:'half', start:'08:30', notes:['Aコースは公式表記21kmです。標準ハーフの距離とは異なります。'] },{ km:8, start:'08:00' },{ km:2, start:'08:00' }]),
  ...courses({ key:'yonaguni', name:'第32回日本最西端与那国島一周マラソン', date:'2026-11-14', city:'与那国町', urls:['https://yonaguni-oneroundmarathon.jp/outline/'] }, [{ km:25, start:'13:00', limit:220, gates:[[16,160,'南牧場テキサスゲート西側']] },{ km:10, start:'14:00', limit:120 },{ km:4, start:'14:00', limit:120 }]),
  ...courses({ key:'okinawa-survival', name:'沖縄本島1周サバイバルラン', date:'2026-11-20', city:'那覇市・沖縄本島全域', urls:['https://teamultra-k.info/race/survival2026/'], notes:[multiDay,'開催期間は11月20日～23日。交通規制・主催者エイドはありません。補給・夜間装備は大会要項を確認してください。'] }, [{ km:400, start:'12:00', limit:4320, gates:[[34,300,'残波岬'],[77,720,'宮里三丁目'],[162,1440,'辺戸岬'],[295,2880,'海の駅あやはし']] }]),
  ...courses({ key:'tarama', name:'第26回たらま島一周マラソン', date:'2026-11-21', city:'多良間村', urls:['https://taramajima-run.com/require/'] }, [
    { km:23.75, start:'12:00', limit:210 },
    ...([{km:10,start:'12:20'},{km:5,start:'12:30'},{km:3,start:'12:05'}].map(c => ({...c, notes:['公式要項内の終了時刻と制限時間の記載が一致しないため、制限時間は未設定です。大会事務局の案内を確認してください。']}))),
    { km:1, start:'11:30', limit:20 },
  ]),
  ...courses({ key:'zanpa-sunset', name:'第2回沖縄残波岬夕空絶景マラソン大会', date:'2026-12-06', city:'読谷村', urls:['https://www.sportsentry.ne.jp/event/t/104407'], notes:['個人種目です。リレーの計画ではありません。'] }, [{ km:20, start:'12:30', limit:140 },{ km:10, start:'12:35', limit:80 },{ km:5, start:'12:35', limit:40 }]),
  ...courses({ key:'okinawa-100k', name:'第9回沖縄100Kウルトラマラソン', date:'2026-12-20', city:'与那原町・糸満市・南城市', urls:['https://www.okinawa100k.jp/outline/'] }, [
    { km:100, slug:'okinawa-100k-ultra-marathon', start:'05:00', limit:840 },{ km:50, start:'10:00', limit:540 },{ km:22.5, title:'ニライカナイラン＆ウォーク', start:'12:00', limit:420 },
  ]),
  ...courses({ key:'ishigaki', name:'第24回石垣島マラソン', date:'2027-01-17', city:'石垣市', urls:['https://www.ishigakijima-marathon.jp/outline/'] }, [
    { km:42.195, slug:'ishigakijima-marathon', start:'09:00', limit:420, gates:[[21.0975,195,'中間点'],[34,330,'34km関門']] },
    { km:21.6, category:'half', start:'09:50', limit:240, gates:[[15,150,'15km関門']], notes:['ハーフの公式距離は21.6kmです。'] },{ km:10, start:'09:30', limit:120 },
  ]),
  ...courses({ key:'nago-challenge', name:'名護チャレンジRUN', date:'2027-01-17', city:'名護市', urls:['https://nagocityrun.com/'], notes:['2027年は従来の20kmからハーフへ変更されています。'] }, [{ km:21.0975, start:'08:30', limit:210, gates:[[10,105,'10km関門']] },{ km:10, limit:105 },{ km:3, start:'08:45', limit:60 }]),
  ...courses({ key:'ayahashi', name:'第25回あやはし海中ロードレース大会', date:'2027-01-24', city:'うるま市', urls:['https://www.city.uruma.lg.jp/1007003000/event/p000038.html','https://www.city.uruma.lg.jp/documents/10296/bosyuyoko.pdf'] }, [{ km:21.0975, start:'08:30', limit:180, notes:[halfNominal] },{ km:10, start:'09:20', limit:90 },{ km:3.8, title:'ポケモンラン', start:'12:10', limit:60 }]),
  ...courses({ key:'okinawa-mini', name:'JTAプレゼンツおきなわミニマラソン', date:'2027-02-20', city:'沖縄市', urls:['https://okinawa-marathon.com/outline-mini-marathon/'] }, [{ km:4.2195, start:'11:00', limit:90 }]),
  ...courses({ key:'okinawa-marathon', name:'第31回おきなわマラソン', date:'2027-02-21', city:'沖縄市', urls:['https://okinawa-marathon.com/outline/'], notes:['2026年の休止後、2027年に開催される大会です。'] }, [{ km:42.195, start:'09:00', limit:375 },{ km:10, start:'09:40', limit:80 }]),
  ...courses({ key:'nanjo-newyear', name:'南城市新春マラソン', date:'2026-01-02', city:'南城市', urls:['https://www.city.nanjo.okinawa.jp/topics/1761701272/'], notes:['距離は主催者掲載の概数です。'] }, [{ km:10, start:'10:00' },{ km:5, start:'10:00' },{ km:3, start:'10:00' }]),
  ...courses({ key:'haebaru-newyear', name:'第46回南風原町新春マラソン', date:'2026-01-04', city:'南風原町', urls:['https://www.town.haebaru.lg.jp/soshiki/17/3431.html'] }, [{ km:5, start:'11:10', notes:['中学生以上の部です。'] },{ km:2, notes:['小学生の部。3・4年生は10:30、5・6年生は10:50です。参加区分の開始時刻を入力してください。'] },{ km:1, start:'10:00', notes:['幼児・小学1・2年生の部です。'] }]),
  ...courses({ key:'itoman-newyear', name:'第55回糸満市新春マラソン', date:'2026-01-11', city:'糸満市', urls:['https://itomantaikyo.com/user.php?CMD=101400000000158','https://drive.google.com/file/d/1eI3NMunbXwtujciQzZj9xRVBJ20R4t5E/view'], notes:['糸満市民および大会に賛同する方が対象です。学年・年齢・性別によって種目とスタート時刻が異なります。'] }, [{ km:5 },{ km:3 },{ km:2 },{ km:1 }]),
  ...courses({ key:'gosamaru', name:'第53回ごさまるトリムマラソン', date:'2026-01-11', city:'中城村', urls:['https://nakagusuku.spoyell.okinawa/user.php?CMD=101400000000081','https://www.vill.nakagusuku.okinawa.jp/userfiles/files/autoupload/kouhoushi/2026/02/S4DPe6YWqD6n.pdf'], notes:['開始時刻は募集要項の予定時刻です。目標タイムとの差を競うトリム種目です。'] }, [{ km:5.8, start:'09:30', limit:60 },{ km:2.7, start:'09:40', limit:50 }]),
  ...courses({ key:'miyako-waido', name:'第36回宮古島100kmワイドーマラソン', date:'2026-01-25', city:'宮古島市', urls:['https://www.waido-miyako.com/','https://www.waido-miyako.com/archive/2026/2026-completion-rate.pdf'], notes:['開催済みの2026年大会の情報です。2026年9月1日に大会終了が発表され、2027年大会はありません。'] }, [{ km:100 },{ km:50 }]),
  ...courses({ key:'iheya-trail', name:'第10回伊平屋ヴィレッジトレイル ラン＆ウォーク', date:'2026-01-31', city:'伊平屋村', urls:['https://iheya-villagetrail.com/','https://iheya-villagetrail.com/iheyavillagetrail2026_docs.pdf?v=20251020'], notes:[approxTrail] }, [{ km:30, start:'08:00', limit:450 },{ km:15, start:'13:30', limit:270 },{ km:6, title:'ウォーク・キッズラン', limit:210, notes:['公式要項に14:00と14:30の両方の記載があるため、開始時刻は未設定です。'] }]),
  ...courses({ key:'yamaneko', name:'第31回竹富町やまねこマラソン', date:'2026-02-14', city:'竹富町', urls:['https://www.town.taketomi.lg.jp/yamanekomarathon/outline/'], notes:['2026年大会の種目です。2027年大会の種目・時間へは流用しないでください。'] }, [{ km:23 },{ km:10 },{ km:5 }]),
  ...courses({ key:'higashi-tsutsuji', name:'第44回東村つつじマラソン', date:'2026-03-08', city:'東村', urls:['https://i-sam.co.jp/tutuji/outline.html'] }, [{ km:20, start:'10:00', limit:180, notes:['折返地点の関門は開始から1時間30分。地点の正確な距離は要確認です。'] },{ km:5, start:'10:15', limit:60 },{ km:3, start:'09:20' },{ km:1.5, start:'09:00' }]),
  ...courses({ key:'itoman-heiwa', name:'第6回いとまん平和マラソン', date:'2026-03-15', city:'糸満市', urls:['https://itoman-heiwa.jp/outline/'], notes:['種目名の概数ではなく、公式要項の距離欄を使用しています。'] }, [{ km:21.025, category:'half', start:'09:00', limit:180 },{ km:5.06, start:'09:30', limit:60 },{ km:2.59, title:'エンジョイ', start:'11:00', limit:60 }]),
  ...courses({ key:'iejima', name:'第33回伊江島一周マラソン', date:'2026-04-11', city:'伊江村', urls:['https://www.iejima.org/document/2025120800024/','https://www.iejima.org/document/2025120800024/file_contents/04.pdf'] }, [{ km:21, category:'half', notes:['要項のハーフ（21km）表記を使用しています。種目別スタート時刻は参加案内を確認してください。'] },{ km:10 },{ km:5 },{ km:3 }]),
  ...courses({ key:'shioyawan', name:'第48回塩屋湾一周マラソン', date:'2026-04-19', city:'大宜味村', urls:['https://okinawasportsisland.jp/events/detail/10934/','https://www.i-sam.co.jp/shioyawan_trim/'] }, [{ km:9, start:'09:20', limit:90 },{ km:5, start:'09:15', limit:75 },{ km:3, start:'11:00', limit:60 }]),
  ...courses({ key:'nago-sunset', name:'第6回沖縄名護夕空絶景マラソン', date:'2026-04-19', city:'名護市', urls:['https://www.sportsentry.ne.jp/event/t/103259'], notes:['個人種目。時差スタートの遅れは参加区分に合わせて設定してください。'] }, [{ km:20, start:'13:00', limit:160 },{ km:10, start:'13:32', limit:80 },{ km:5, start:'13:32', limit:40 }]),
  ...courses({ key:'miyako-100mile', name:'宮古島ウルトラ100マイル', date:'2026-06-06', city:'宮古島市', urls:['https://teamultra-k.info/past/miyako100mile-2/'], notes:[multiDay] }, [{ km:161, start:'10:00', limit:1800, gates:[[64.5,750,'池間大橋'],[106.8,1200,'東平安名崎'],[152.4,1680,'久松漁港']] }]),
  ...courses({ key:'mccs-tengan', name:'MCCS Lord of the Tengan Race', date:'2026-02-08', city:'うるま市', urls:['https://www.okinawa.usmc-mccs.org/activity/28902415-0114-4589-bec1-8242a9bd829e'], notes:['キャンプ・コートニー内。基地入場条件と身分証明書は主催者案内を確認してください。'] }, [{ km:10, start:'08:05' },{ km:5, start:'08:05' }]),
  ...courses({ key:'mccs-pow-mia', name:'MCCS POW/MIA 5K Memorial Run', date:'2026-09-18', city:'金武町', urls:['https://www.okinawa.usmc-mccs.org/activity/40e2d27b-face-41ef-8c9c-4866ee7335ed'], notes:['キャンプ・ハンセン内。主催者が認める利用者が対象です。基地入場条件を確認してください。'] }, [{ km:5, start:'07:00' }]),
  ...courses({ key:'kinser-half', name:'MCCS Kinser Half Marathon', date:'2026-11-15', city:'浦添市', urls:['https://www.okinawa.usmc-mccs.org/activity/ac364786-e043-455d-af70-2e81b3dec5cf'], notes:[halfNominal,'キャンプ・キンザー内。公式ページは部隊ポイント登録の案内です。一般参加の可否と本登録・基地入場条件は主催者に確認してください。'] }, [{ km:21.0975, start:'08:05' }]),

  ...courses({ key:'ishigaki', name:'第23回石垣島マラソン', date:'2026-01-18', city:'石垣市', urls:['https://runnet.jp/entry/runtes/smp/racedetail.do?raceId=379258'], notes:['2026年大会の開始時刻・関門です。2027年大会とは異なります。'] }, [{ km:42.195, start:'08:00', limit:420, gates:[[21.0975,195,'中間地点'],[35,330,'35km関門']] },{ km:21.6, category:'half', start:'09:00', limit:240, gates:[[15,150,'15km関門']] },{ km:10, start:'08:30', limit:120 }]),
  ...courses({ key:'nago', name:'名護チャレンジRUN', date:'2026-01-18', city:'名護市', urls:['https://www.sportsentry.ne.jp/event/t/101367','https://nagocityrun.com/2026-list/'] }, [{ km:20, start:'08:30', limit:210, gates:[[10,105,'10km関門']] },{ km:10, start:'08:30', limit:105 },{ km:3, start:'08:45', notes:['2026年要項では3kmの制限時間は「なし」です。'] }]),
  ...courses({ key:'ayahashi', name:'第24回あやはし海中ロードレース大会', date:'2026-01-18', city:'うるま市', urls:['https://www.city.uruma.lg.jp/documents/9163/youkou2026.pdf'], notes:['2026年の開催済み大会です。2027年の時刻は流用していません。'] }, [{ km:21.0975, start:'09:00', notes:[halfNominal] },{ km:10 },{ km:3.8, title:'ポケモンラン' }]),
  ...courses({ key:'kaiyohaku', name:'海洋博公園エンジョイマラソン', date:'2026-01-18', city:'本部町', urls:['https://oki-park.jp/userfiles/files/20251020NRKaiyouhakukouenenjoymarathon2026.pdf'], notes:['09:00と10:00の2回の開会式・スタート、ゴール制限時刻12:00。参加区分に合わせて開始時刻と制限時間を入力してください。'] }, [{ km:3.75 }]),
  ...courses({ key:'runnet-ekiden-solo', name:'第13回RUNNET EKIDEN 沖縄', date:'2026-05-10', city:'豊見城市', urls:['https://runnet-ekiden.jp/okinawa/outline/'], notes:['個人で走るソロの部または親子ペアランです。駅伝種目ではありません。'] }, [{ km:18, title:'ソロの部', start:'10:00' },{ km:1.5, title:'親子ペアラン', start:'09:30', notes:['4歳以下の子と16歳以上の保護者。計測・表彰なし。'] }]),
  ...courses({ key:'shouhashi-road', name:'第23回琉球国王尚巴志ハーフマラソン in 南城市', date:'2026-11-01', city:'南城市', urls:['https://www.shouhashi.jp/yoko'] }, [{ km:3, title:'ロードレースの部', start:'09:30', limit:30 }]),
  ...courses({ key:'toyosaki-winter', name:'豊崎ウィンターラン IN豊崎海浜公園美らSUNビーチ', date:'2026-02-15', city:'豊見城市', urls:['https://moshicom.com/139132','https://ssol.co.jp/6311'], notes:['周回型のランニング記録会です。距離・タイムは参加者自身で管理します。42km・21kmは標準フル・ハーフとは異なります。'] }, [{ km:42, category:'full', start:'09:00', limit:360 },{ km:21, category:'half', start:'09:00', limit:360 },{ km:9, start:'09:00', limit:360 },{ km:3, start:'09:00', limit:360 },{ km:1, start:'08:00', limit:60 }]),

  ...courses({ key:'october-run', name:'オクトーバーランフェスティバル', date:'2026-10-03', city:'豊見城市', urls:['https://moshicom.com/151651'], notes:['周回型ランイベント。距離・タイムは自己管理です。42km・21kmは標準フル・ハーフとは異なります。時間走・チーム競技は含みません。'] }, [{ km:42, category:'full', start:'16:00', limit:180 },{ km:30, start:'16:00', limit:180 },{ km:21, category:'half', start:'16:00', limit:180 },{ km:9, start:'16:00', limit:180 },{ km:3, start:'16:00', limit:180 },{ km:1, start:'14:00', limit:60 }]),
  ...[
    { key:'mccs-taiyo', name:'MCCS Taiyo 3K/5K/10K Run', date:'2026-04-12', city:'大洋ゴルフクラブ', distances:[3,5,10] },
    { key:'mccs-child', name:'MCCS Month of the Military Child 1K/5K Fun Run', date:'2026-04-25', city:'キャンプ・キンザー', distances:[1,5] },
    { key:'mccs-magic', name:'MCCS Futenma Magic 10 Miler', date:'2026-05-10', city:'普天間基地', distances:[16.09344] },
    { key:'mccs-memorial', name:'MCCS Foster 5K Memorial Run', date:'2026-05-23', city:'キャンプ・フォスター', distances:[5] },
  ].flatMap(e => courses({ ...e, urls:['https://www.okinawa.usmc-mccs.org/modules/media/?do=inline&id=4b6facac-2448-4f86-bec6-0a21ef897774&v=2'], notes:['主催者の2026年年間予定表で日程と種目を確認。開始時刻・制限時間・一般参加資格・基地入場条件は未確認です。10 Milerは10マイルをkm換算しています。'] }, e.distances.map(km => ({km})))),
];
