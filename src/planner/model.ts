import type { PlannerSettings } from "./settings";
export const COMPARISON_GOALS = [
  { label: "挑戦目標", short: "挑戦" },
  { label: "本命目標", short: "本命" },
  { label: "堅実目標", short: "堅実" },
] as const;
export type PaceStyle =
  | "even"
  | "negative-5"
  | "negative-10"
  | "positive-5"
  | "positive-10"
  | "custom";
export const PACE_STYLES: { id: PaceStyle; label: string; detail: string }[] = [
  { id: "even", label: "一定ペース", detail: "移動ペースを一定に" },
  { id: "negative-5", label: "後半を5分速く", detail: "前半より後半を5分短く" },
  {
    id: "negative-10",
    label: "後半を10分速く",
    detail: "前半より後半を10分短く",
  },
  { id: "positive-5", label: "後半を5分遅く", detail: "後半の減速を5分見込む" },
  {
    id: "positive-10",
    label: "後半を10分遅く",
    detail: "後半の減速を10分見込む",
  },
  { id: "custom", label: "自分で設定", detail: "前後半差・区間を直接編集" },
];
export type Gate = {
  id: string;
  name: string;
  km: string;
  time: string;
  day: string;
  kind: "official" | "advisory";
};
export type Terrain = {
  id: string;
  start: string;
  end: string;
  adjustment: string;
  memo: string;
};
export type Stop = {
  id: string;
  km: string;
  seconds: string;
  memo: string;
  afterGate: boolean;
};
export type Override = { id: string; start: string; end: string; pace: string };
export type Plan = {
  id: string;
  name: string;
  raceName: string;
  date: string;
  distance: string;
  startTime: string;
  waveTime: string;
  delayMinutes: string;
  limit: string;
  intent: "target" | "finish" | "pb";
  timeBasis: "net" | "gun";
  inputKind: "time" | "pace";
  target: string;
  pace: string;
  pb: string;
  pbGainSeconds: string;
  style: PaceStyle;
  splitSeconds: string;
  elevation: boolean;
  adjustmentMode: "goal" | "fixed";
  bufferMinutes: string;
  showGates: boolean;
  fastestPace: string;
  gates: Gate[];
  terrain: Terrain[];
  stops: Stop[];
  overrides: Override[];
  comparison: [string, string, string];
  cardMode: "single" | "compare" | "both";
  cardFormat: "pocket" | "wrist";
  cardClock: "net" | "gun";
  cardGates: boolean;
  cardNotes: boolean;
  cardTerrain: boolean;
  sourceUrl: string;
  sourceChecked: string;
  sourceStatus: string;
  sourceRevision: string;
  migrationNotes: string[];
};
export type Snapshot = {
  id: string;
  createdAt: string;
  plan: Plan;
  html?: string;
  engineVersion?: string;
};
export type PlannerStore = {
  schemaVersion: 2;
  settings?: PlannerSettings;
  plans: Plan[];
  selectedId: string;
  snapshots: Snapshot[];
  trash: Plan[];
  legacyArchive: unknown | null;
};
export const uid = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export function newPlan(): Plan {
  return {
    id: uid(),
    name: "プランA",
    raceName: "マイマラソン",
    date: "",
    distance: "42.195",
    startTime: "09:00",
    waveTime: "",
    delayMinutes: "0",
    limit: "",
    intent: "target",
    timeBasis: "net",
    inputKind: "time",
    target: "03:30:00",
    pace: "4:59",
    pb: "",
    pbGainSeconds: "60",
    style: "even",
    splitSeconds: "0",
    elevation: false,
    adjustmentMode: "goal",
    bufferMinutes: "5",
    showGates: false,
    fastestPace: "",
    gates: [],
    terrain: [],
    stops: [],
    overrides: [],
    comparison: ["03:25:00", "03:30:00", "03:35:00"],
    cardMode: "single",
    cardFormat: "pocket",
    cardClock: "net",
    cardGates: false,
    cardNotes: true,
    cardTerrain: false,
    sourceUrl: "",
    sourceChecked: "",
    sourceStatus: "手入力",
    sourceRevision: "",
    migrationNotes: [],
  };
}
export function newStore(): PlannerStore {
  const plan = newPlan();
  return {
    schemaVersion: 2,
    plans: [plan],
    selectedId: plan.id,
    snapshots: [],
    trash: [],
    legacyArchive: null,
  };
}
export const copyPlan = (plan: Plan): Plan => ({
  ...JSON.parse(JSON.stringify(plan)),
  id: uid(),
  name: `${plan.name} のコピー`,
});

/** Seed only a previously unused device; ordinary new plans keep their own defaults. */
export function firstUseStore(): PlannerStore {
  const store = newStore();
  Object.assign(store.plans[0], {
    raceName: "使い方サンプル｜フルマラソン",
    name: "4時間・一定ペース",
    target: "04:00:00",
    pace: "5:41",
    comparison: ["03:55:00", "04:00:00", "04:05:00"],
    cardMode: "both",
    sourceStatus: "架空の大会・使い方サンプル",
  });
  return store;
}
