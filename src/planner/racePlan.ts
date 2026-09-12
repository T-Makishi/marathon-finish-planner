import type { OfficialRaceData } from '../data/raceData';
import { newPlan, uid } from './model';
import { elapsed, clockText } from './engine';
import { raceDataLabel } from './catalog';

/** Import only published facts; missing times remain blank for the runner to confirm. */
export function planFromRace(race: OfficialRaceData, optionId?: string) {
  const option = race.startOptions?.find(o => o.id === optionId);
  if (race.startOptions?.length && !option) throw new Error('参加するスタート時刻を選択してください。');
  const p = newPlan();
  p.raceName = race.name;
  p.distance = String(race.distanceKm);
  p.date = race.officialEventDate || race.eventDate || '';
  p.startTime = option?.time || race.startTime || '';
  p.limit = race.timeLimitMinutes ? elapsed(race.timeLimitMinutes * 60) : '';
  p.sourceUrl = race.sources[0]?.url || '';
  p.sourceChecked = race.verifiedAt || '';
  p.sourceRevision = race.year ? String(race.year) : '';
  p.sourceStatus = [raceDataLabel(race), ...(race.notes || [])].join(' / ').slice(0, 5000);
  const [h, m] = p.startTime.split(':').map(Number);
  const startSeconds = h * 3600 + m * 60;
  p.gates = race.checkpoints.flatMap(g => {
    const closingSeconds = g.closingTime ? NaN : Number.isFinite(startSeconds) && g.elapsedLimitMinutes != null ? startSeconds + g.elapsedLimitMinutes * 60 : NaN;
    const time = g.closingTime || (Number.isFinite(closingSeconds) ? clockText(closingSeconds % 86400) : '');
    if (!time) return [];
    return [{ id: uid(), name: g.name, km: String(g.distanceKm), time, day: Number.isFinite(closingSeconds) ? String(Math.floor(closingSeconds / 86400)) : '0', kind: /勧告/.test(g.name) ? 'advisory' as const : 'official' as const }];
  });
  p.terrain = race.sections.filter(t => t.terrain !== 'unknown').map(t => ({ id: uid(), start: String(t.startKm), end: String(t.endKm), adjustment: '0', memo: t.description || t.terrain }));
  return p;
}
