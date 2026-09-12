import { validSettings, validOpeningImage } from "./settings";
import {
  Plan,
  PlannerStore,
  newPlan,
  newStore,
  uid,
  PACE_STYLES,
} from "./model";

export const LEGACY_KEY = "marathon-finish-planner-v1";
const PREFIX = "run-finish-planner-v2";
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
type KV = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
};
type Envelope = { generation: number; digest: string; payload: string };
export function digest(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
const object = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);
function validatePlan(p: unknown): p is Plan {
  if (!object(p)) return false;
  const base = newPlan();
  for (const key of Object.keys(base) as (keyof Plan)[]) {
    const expected = base[key],
      actual = p[key];
    if (
      typeof expected === "string" &&
      (typeof actual !== "string" || actual.length > 5000)
    )
      return false;
    if (typeof expected === "boolean" && typeof actual !== "boolean")
      return false;
    if (
      Array.isArray(expected) &&
      (!Array.isArray(actual) || actual.length > 1000)
    )
      return false;
  }
  if (
    !p.id ||
    !PACE_STYLES.some((s) => s.id === p.style) ||
    !["target", "finish", "pb"].includes(p.intent) ||
    !["net", "gun"].includes(p.timeBasis) ||
    !["time", "pace"].includes(p.inputKind) ||
    !["goal", "fixed"].includes(p.adjustmentMode) ||
    !["single", "compare", "both"].includes(p.cardMode) ||
    !["pocket", "wrist"].includes(p.cardFormat) ||
    !["net", "gun"].includes(p.cardClock)
  )
    return false;
  for (const [key, fields] of Object.entries({
    gates: ["id", "name", "km", "time", "day", "kind"],
    terrain: ["id", "start", "end", "adjustment", "memo"],
    stops: ["id", "km", "seconds", "memo"],
    overrides: ["id", "start", "end", "pace"],
  })) {
    const items = p[key];
    if (
      items.some(
        (row: unknown) =>
          !object(row) ||
          fields.some(
            (f) => typeof row[f] !== "string" || row[f].length > 5000,
          ),
      )
    )
      return false;
    if (new Set(items.map((r: any) => r.id)).size !== items.length)
      return false;
  }
  return (
    p.stops.every((s: any) => typeof s.afterGate === "boolean") &&
    p.gates.every((g: any) => ["official", "advisory"].includes(g.kind)) &&
    p.comparison.length === 3 &&
    p.comparison.every((s: unknown) => typeof s === "string") &&
    p.migrationNotes.every((s: unknown) => typeof s === "string")
  );
}
export function parseStore(text: string): PlannerStore {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("バックアップは20MB以下にしてください。");
  const s: unknown = JSON.parse(text);
  if (
    !object(s) ||
    s.schemaVersion !== 2 ||
    (s.settings !== undefined && !validSettings(s.settings)) ||
    !Array.isArray(s.plans) ||
    s.plans.length > 500 ||
    !s.plans.every(validatePlan) ||
    !Array.isArray(s.trash) ||
    s.trash.length > 500 ||
    !s.trash.every(validatePlan) ||
    !Array.isArray(s.snapshots) ||
    s.snapshots.length > 500 ||
    !s.snapshots.every(
      (x: unknown) =>
        object(x) &&
        typeof x.id === "string" &&
        typeof x.createdAt === "string" &&
        validatePlan(x.plan) &&
        (x.html === undefined || typeof x.html === "string") &&
        (x.engineVersion === undefined || typeof x.engineVersion === "string"),
    ) ||
    typeof s.selectedId !== "string" ||
    !("legacyArchive" in s)
  )
    throw new Error(
      "対応していない形式、または欠けた項目があります。現在のデータは変更していません。",
    );
  if (new Set(s.plans.map((p: Plan) => p.id)).size !== s.plans.length)
    throw new Error("プランIDが重複しています。");
  if (s.plans.length && !s.plans.some((p: Plan) => p.id === s.selectedId))
    throw new Error("選択中のプランが見つかりません。");
  return s as PlannerStore;
}
const txt = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback;
const list = (v: unknown): Record<string, any>[] =>
  Array.isArray(v) ? v.filter(object) : [];
export function migrateLegacy(raw: unknown): PlannerStore {
  if (!object(raw))
    throw new Error("旧データの形式が不正です。原本を保護しました。");
  const store = newStore();
  store.legacyArchive = raw;
  store.plans = [];
  for (const race of list(raw.races)) {
    const old = list(raw.plans).find((p) => p.raceId === race.id) || {};
    const p = newPlan();
    p.id = `legacy-${txt(race.id, uid())}`;
    p.name = "旧版からの移行";
    p.raceName = txt(race.name, "大会");
    p.distance = txt(race.distanceKm, "42.195");
    p.date = txt(race.date);
    p.startTime = txt(race.startTime, "09:00");
    p.limit = txt(race.limitTime);
    p.delayMinutes = txt(race.lostTimeMin, "0");
    p.target = txt(old.targetTime, "03:30:00");
    p.intent = old.inputMode === "制限時間内で完走" ? "finish" : "target";
    p.timeBasis = "gun";
    p.style = PACE_STYLES.some((s) => s.id === old.runStyle)
      ? old.runStyle
      : "custom";
    const diff = Number(
      old.splitDifferenceMin === "custom"
        ? old.customSplitDifferenceMin
        : old.splitDifferenceMin || 0,
    );
    p.splitSeconds = String(
      Number.isFinite(diff)
        ? diff * 60 * (old.splitStrategy === "positive" ? -1 : 1)
        : 0,
    );
    p.elevation = !!old.useElevationAdjustment;
    p.showGates = p.intent === "finish" || !!old.showCheckpointDetails;
    p.cardGates = p.showGates;
    p.bufferMinutes = txt(old.gateBufferMin, "5");
    p.sourceUrl = txt(race.officialUrl);
    p.sourceChecked = txt(race.officialAccessedAt);
    p.sourceStatus = "旧版・再確認が必要";
    p.migrationNotes = [
      "旧版の原文をデータ管理に保管しています。目標の時間基準、配分、関門を確認して「確認済み」にしてください。",
    ];
    const belonging = (key: string) =>
      list(raw[key]).filter((x) => x.raceId === race.id);
    p.gates = belonging("gates").map((g) => ({
      id: txt(g.id, uid()),
      name: txt(g.name),
      km: txt(g.distanceKm),
      time: txt(g.gateTime),
      day: "0",
      kind: /勧告/.test(txt(g.name)) ? "advisory" : "official",
    }));
    p.stops = belonging("stops").map((s) => ({
      id: txt(s.id, uid()),
      km: txt(s.distanceKm),
      seconds: txt(s.stopSec),
      memo: txt(s.memo),
      afterGate: false,
    }));
    p.terrain = belonging("segments").map((s) => ({
      id: txt(s.id, uid()),
      start: txt(s.startKm),
      end: txt(s.endKm),
      adjustment: txt(s.adjustSecPerKm, "0"),
      memo: txt(s.memo, txt(s.terrain)),
    }));
    p.overrides = []; // v1 lap duration != seconds/km for partial intervals; preserve for explicit re-entry.
    if (belonging("manualLaps").length)
      p.migrationNotes.push(
        "旧版の手動ラップは区間時間とペースの意味が異なるため、自動適用していません。旧データを確認して区間編集で再設定してください。",
      );
    if (validatePlan(p)) store.plans.push(p);
  }
  if (!store.plans.length) {
    const p = newPlan();
    p.migrationNotes = [
      "旧版データを原文のまま保管しました。大会を確認して作成してください。",
    ];
    store.plans.push(p);
  }
  store.selectedId =
    store.plans.find((p) => p.id === `legacy-${txt(raw.selectedRaceId)}`)?.id ||
    store.plans[0].id;
  return store;
}
/** Keep usable plans/settings; discard obsolete duplicated data after conversion. */
export function compactStore(store: PlannerStore): PlannerStore {
  const cleanPlan = (p: Plan): Plan => ({ ...p,
    name: /^(旧版からの移行|9番から引き継ぎ)$/.test(p.name) ? 'プランA' : p.name,
    sourceStatus: /^旧版/.test(p.sourceStatus) ? '入力した大会情報' : p.sourceStatus,
    migrationNotes: [],
  });
  const image = (store.legacyArchive as { settings?: { openingBackgroundUri?: unknown } } | null)?.settings?.openingBackgroundUri;
  const settings = store.settings ?? (validOpeningImage(image) ? { openingBackground: image } : undefined);
  return { ...store, ...(settings ? { settings } : {}), plans: store.plans.map(cleanPlan), trash: store.trash.map(cleanPlan), snapshots: [], legacyArchive: null };
}
export function parseBackup(text: string): PlannerStore {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error("バックアップは20MB以下にしてください。");
  const raw = JSON.parse(text);
  if (object(raw) && raw.schemaVersion === 2) return compactStore(parseStore(text));
  if (object(raw) && Array.isArray(raw.races) && Array.isArray(raw.plans))
    return compactStore(migrateLegacy(raw));
  throw new Error("RUN Finish PlannerのバックアップJSONを選択してください。");
}
export function createRepository(kv: KV) {
  let queue: Promise<unknown> = Promise.resolve();
  let knownGeneration: number | null = null;
  async function readSlot(key: string): Promise<Envelope | null> {
    const value = await kv.getItem(key);
    if (!value) return null;
    try {
      const e = JSON.parse(value);
      if (
        !Number.isSafeInteger(e.generation) ||
        e.generation < 1 ||
        typeof e.payload !== "string" ||
        e.digest !== digest(e.payload)
      )
        return null;
      parseStore(e.payload);
      return e;
    } catch {
      return null;
    }
  }
  const saveNow = async (payload: string) => {
    parseStore(payload);
    const [a, b] = await Promise.all([
      readSlot(`${PREFIX}-a`),
      readSlot(`${PREFIX}-b`),
    ]);
    const latestGeneration = Math.max(a?.generation || 0, b?.generation || 0);
    if (knownGeneration !== null && latestGeneration !== knownGeneration)
      throw new Error(
        "別の画面で計画が更新されました。この画面のバックアップを保存してから再読み込みしてください。",
      );
    const generation = latestGeneration + 1;
    const slot = (a?.generation || 0) <= (b?.generation || 0) ? "a" : "b";
    const text = JSON.stringify({
      generation,
      digest: digest(payload),
      payload,
    });
    await kv.setItem(`${PREFIX}-${slot}`, text);
    if ((await kv.getItem(`${PREFIX}-${slot}`)) !== text)
      throw new Error("保存内容を確認できませんでした。");
    knownGeneration = generation;
  };
  async function finishCleanup(store: PlannerStore, force = false): Promise<PlannerStore> {
    return typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(PREFIX, () => cleanupNow(store, force))
      : cleanupNow(store, force);
  }
  async function cleanupNow(store: PlannerStore, force: boolean): Promise<PlannerStore> {
    const clean = compactStore(store);
    const obsolete = [LEGACY_KEY, `${PREFIX}-legacy-original`];
    const oldValues = await Promise.all(obsolete.map(key => kv.getItem(key)));
    const previous = await kv.getItem(`${PREFIX}-before-restore`);
    const changed = JSON.stringify(clean) !== JSON.stringify(store);
    if (force || changed || oldValues.some(Boolean)) {
      await saveNow(JSON.stringify(clean));
      await saveNow(JSON.stringify(clean));
      if (kv.removeItem) for (const key of obsolete) await kv.removeItem(key);
    }
    if (previous) {
      try {
        const trimmed = JSON.stringify(compactStore(parseStore(previous)));
        if (trimmed !== previous) {
          await kv.setItem(`${PREFIX}-before-restore`, trimmed);
          if (await kv.getItem(`${PREFIX}-before-restore`) !== trimmed) throw new Error('復元用コピーの保存を確認できません。');
        }
      } catch (e) { /* An unreadable recovery copy is retained, never silently deleted. */ }
    }
    return clean;
  }
  return {
    async load(): Promise<{ store: PlannerStore; notice: string }> {
      const [a, b, rawA, rawB] = await Promise.all([
        readSlot(`${PREFIX}-a`),
        readSlot(`${PREFIX}-b`),
        kv.getItem(`${PREFIX}-a`),
        kv.getItem(`${PREFIX}-b`),
      ]);
      const latest = [a, b]
        .filter((e): e is Envelope => !!e)
        .sort((x, y) => y.generation - x.generation)[0];
      if (latest) {
        knownGeneration = latest.generation;
        return {
          store: await finishCleanup(parseStore(latest.payload), [a, b].some(e => e && JSON.stringify(compactStore(parseStore(e.payload))) !== e.payload)),
          notice:
            (rawA && !a) || (rawB && !b)
              ? "保存データの予備コピーから回復しました。バックアップを保存してください。"
              : "",
        };
      }
      if (rawA || rawB)
        throw new Error(
          "保存データを読み込めません。初期化せず、バックアップから復元してください。",
        );
      knownGeneration = 0;
      const legacy = await kv.getItem(LEGACY_KEY);
      if (legacy) {
        return { store: await finishCleanup(migrateLegacy(JSON.parse(legacy))), notice: '' };
      }
      return { store: newStore(), notice: "" };
    },
    save(store: PlannerStore): Promise<void> {
      const payload = JSON.stringify(compactStore(store));
      const task = queue
        .catch(() => {})
        .then(() =>
          typeof navigator !== "undefined" && navigator.locks
            ? navigator.locks.request(PREFIX, () => saveNow(payload))
            : saveNow(payload),
        );
      queue = task;
      return task;
    },
    async preserveBeforeRestore(store: PlannerStore) {
      const value = JSON.stringify(compactStore(store));
      await kv.setItem(`${PREFIX}-before-restore`, value);
      if ((await kv.getItem(`${PREFIX}-before-restore`)) !== value)
        throw new Error("復元前の退避に失敗しました。");
    },
    async previousRestore() {
      const text = await kv.getItem(`${PREFIX}-before-restore`);
      return text ? compactStore(parseStore(text)) : null;
    },
    async rawRecovery() {
      return JSON.stringify(
        {
          a: await kv.getItem(`${PREFIX}-a`),
          b: await kv.getItem(`${PREFIX}-b`),
          legacy: await kv.getItem(LEGACY_KEY),
        },
        null,
        2,
      );
    },
  };
}
