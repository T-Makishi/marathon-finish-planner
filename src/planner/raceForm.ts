import { newPlan, Plan, PlannerStore } from './model';
import { numberValue, duration } from './engine';
export const raceFields = ['raceName','name','date','distance','startTime','limit','sourceUrl','sourceChecked'] as const;
export function emptyRaceForm(): Plan {
  const p = newPlan();
  for (const key of raceFields) p[key] = '';
  return p;
}
export function applyRaceForm(store: PlannerStore, draft: Plan, editingId: string | null): PlannerStore {
  if (!draft.raceName.trim()) throw new Error('大会名を入力してください。');
  if (!draft.name.trim()) throw new Error('計画名を入力してください。');
  if (!Number.isFinite(numberValue(draft.distance)) || numberValue(draft.distance) <= 0) throw new Error('距離を正の数値で入力してください。');
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(draft.startTime)) throw new Error('大会号砲を時:分で入力してください。');
  if (draft.limit && (!Number.isFinite(duration(draft.limit)) || duration(draft.limit) <= 0)) throw new Error('完走制限を時:分:秒で入力してください。');
  const base = editingId ? store.plans.find(p => p.id === editingId) : draft;
  if (!base) throw new Error('編集対象の計画が見つかりません。');
  const updated = { ...base };
  for (const key of raceFields) updated[key] = draft[key].trim();
  return { ...store, plans: editingId ? store.plans.map(p => p.id === editingId ? updated : p) : [...store.plans, updated], selectedId: updated.id };
}
