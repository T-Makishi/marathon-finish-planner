export type CalendarDate = { year: number; month: number; day: number };

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
export function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
    ? { year, month, day } : null;
}
export function calendarValue(date: CalendarDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}
export function calendarLabel(date: CalendarDate): string {
  return `${date.year}年${date.month}月${date.day}日`;
}
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = Math.max(0, Math.min(9999 * 12 - 1, (year - 1) * 12 + month - 1 + delta));
  return { year: Math.floor(index / 12) + 1, month: index % 12 + 1 };
}
export function calendarCells(year: number, month: number): (number | null)[] {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, 1);
  const offset = date.getUTCDay();
  const count = daysInMonth(year, month);
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) =>
    i >= offset && i < offset + count ? i - offset + 1 : null);
}
