import type { OfficialRaceData } from '../data/raceData';
export const PREFECTURES = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
export const CATEGORIES = [{ value: '', label: 'すべての種別' }, { value: 'half', label: 'ハーフマラソン' }, { value: 'full', label: 'フルマラソン' }, { value: 'ultra', label: 'ウルトラマラソン' }, { value: 'other', label: 'その他の距離' }];
const normalized = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/\s+/g, '');
export function filterRaces(races: OfficialRaceData[], prefecture: string, category: string, search: string): OfficialRaceData[] {
  const query = normalized(search);
  return races.filter(r => r.publicationAllowed !== false && (!prefecture || r.prefecture.split(/[・、/]/).includes(prefecture)) && (!category || r.category === category) && normalized(`${r.name}${r.officialName || ''}${r.prefecture}${r.city || ''}`).includes(query));
}
export function raceDataLabel(race: OfficialRaceData, today = new Date().toLocaleDateString('sv-SE')): string {
  const date = race.officialEventDate || race.eventDate;
  if (date && date < today) return `${race.year || date.slice(0, 4)}年の開催情報（開催済み）`;
  if (race.verificationStatus === 'verified') return '公式情報を確認済み';
  if (race.verificationStatus === 'partially-verified') return '基本情報を確認済み・関門等は要確認';
  return '開催日・時刻・関門の確認が必要';
}
