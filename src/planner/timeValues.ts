export type TimeKind = 'clock' | 'duration' | 'pace' | 'minutes' | 'seconds';
export function normalizeTime(value: string): string {
  return value.replace(/[０-９：．－]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[−ー]/g, '-');
}
export function timeKind(label: string): TimeKind | undefined {
  if (label.includes('時:分:秒')) return 'duration';
  if (label.includes('分:秒')) return 'pace';
  if (label.includes('時:分') || label.includes('ウェーブ号砲')) return 'clock';
  if (label.includes('秒')) return 'seconds';
  if (label.includes('（分）')) return 'minutes';
}
export function timeParts(value: string, kind: TimeKind): string[] {
  const normalized = normalizeTime(value).trim();
  if (kind === 'minutes' || kind === 'seconds') return [normalized || '0'];
  const count = kind === 'duration' ? 3 : 2;
  const parts = normalized.split(':');
  return Array.from({length: count}, (_, i) => /^\d+$/.test(parts[i] || '') ? String(Number(parts[i])) : '0');
}
export function joinTime(parts: string[], kind: TimeKind): string {
  return kind === 'minutes' || kind === 'seconds' ? parts[0] : parts.map(p => p.padStart(2, '0')).join(':');
}
export function numericOptions(label: string, current: string): {value:string;label:string}[] {
  let values: number[];
  if (label.includes('翌日')) values = Array.from({length:10},(_,n)=>n);
  else if (label.includes('補正')) values = Array.from({length:241},(_,n)=>n-120);
  else if (label.includes('後半')) values = [...Array.from({length:121},(_,n)=>n-60), ...Array.from({length:121},(_,n)=>(n-60)*60)];
  else if (label.includes('秒')) values = [...Array.from({length:601},(_,n)=>n), ...Array.from({length:50},(_,n)=>(n+11)*60), ...Array.from({length:23},(_,n)=>(n+2)*3600)];
  else values = Array.from({length:241},(_,n)=>n);
  const options=[...new Set(values)].sort((a,b)=>a-b).map(n=>({value:String(n),label:String(n)}));
  if (current && !options.some(o=>o.value === current)) options.push({value:current,label:current});
  return [{value:'',label:'未設定'},...options];
}
export function distanceParts(value: string): [string,string] {
  if (!value) return ['',''];
  const n=Number(normalizeTime(value));
  if (!Number.isFinite(n) || n<0) return [value,'0'];
  const km=Math.floor(n), metres=Math.round((n-km)*1e9)/1e6;
  return [String(km),String(metres)];
}
export function joinDistance(km: string, metres: string): string {
  return String(Math.round((Number(km)+Number(metres)/1000)*1e9)/1e9);
}
