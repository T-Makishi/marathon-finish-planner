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
