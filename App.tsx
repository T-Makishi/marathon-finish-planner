import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image
} from "react-native";
import { JAPAN_MUNICIPALITIES } from "./data/japanMunicipalities";

type Race = {
  id: string;
  name: string;
  location: string;
  prefecture?: string;
  municipality?: string;
  date: string;
  category: string;
  distanceKm: string;
  startTime: string;
  limitTime: string;
  lostTimeMin?: string;
  lastUsedAt?: number;
  officialUrl: string;
  memo: string;
};

type Gate = {
  id: string;
  raceId: string;
  name: string;
  distanceKm: string;
  gateTime: string;
  memo: string;
};

type ElevationSegment = {
  id: string;
  raceId: string;
  startKm: string;
  endKm: string;
  terrain: "上り" | "下り" | "平坦";
  adjustSecPerKm: string;
};

type Plan = {
  id: string;
  raceId: string;
  inputMode?: "制限時間内で完走" | "目標ゴールタイムを狙う" | "自己ベスト更新を狙う";
  targetTime: string;
  pbTargetOffsetMin?: string;
  paceType: "安全完走型" | "一定ペース型" | "後半温存型" | "イーブンペース" | "前半抑えめ" | "後半型" | "関門安全重視";
  gateBufferMin: string;
};

type StopPoint = {
  id: string;
  raceId: string;
  distanceKm: string;
  stopSec: string;
  memo: string;
};

type ManualLap = {
  id: string;
  raceId: string;
  km: string;
  lapTime: string;
};

type PBRecord = {
  id: string;
  event: "5km" | "10km" | "ハーフ" | "フル";
  raceName: string;
  date: string;
  time: string;
  memo: string;
};

type PastRace = {
  id: string;
  raceName: string;
  year: string;
  category: string;
  finishTime: string;
  weather: string;
  temperature: string;
  humidity: string;
};

type Settings = {
  climbSec: string;
  descentSec: string;
  flatSec: string;
};

type Store = {
  races: Race[];
  gates: Gate[];
  segments: ElevationSegment[];
  stops: StopPoint[];
  manualLaps: ManualLap[];
  plans: Plan[];
  pbs: PBRecord[];
  pastRaces: PastRace[];
  selectedRaceId?: string;
  settings: Settings;
};

type PaceRow = {
  km: number;
  baseLapSec: number;
  adjustedLapSec: number;
  stopSec: number;
  stopMemo?: string;
  cumulativeSec: number;
  etaMinutes: number | null;
  gate?: Gate;
  gateMarginSec?: number;
  status: StatusLabel;
  manual?: ManualLap;
};

type StatusLabel = "安全" | "注意" | "危険" | "関門アウト" | "-";

const STORAGE_KEY = "marathon-finish-planner-v1";
const RUNNER_BACKGROUND = require("./assets/runner-monochrome.jpg");
const defaultSettings: Settings = { climbSec: "10", descentSec: "-5", flatSec: "0" };
const emptyRace: Race = {
  id: "",
  name: "",
  location: "",
  prefecture: "",
  municipality: "",
  date: "",
  category: "フルマラソン",
  distanceKm: "42.195",
  startTime: "09:00",
  limitTime: "07:00",
  lostTimeMin: "8",
  officialUrl: "",
  memo: ""
};
const emptyGate: Gate = { id: "", raceId: "", name: "", distanceKm: "", gateTime: "", memo: "" };
const emptySegment: ElevationSegment = { id: "", raceId: "", startKm: "", endKm: "", terrain: "上り", adjustSecPerKm: "10" };
const emptyPlan: Plan = { id: "", raceId: "", inputMode: "制限時間内で完走", targetTime: "05:30:00", pbTargetOffsetMin: "3", paceType: "安全完走型", gateBufferMin: "10" };
const emptyStop: StopPoint = { id: "", raceId: "", distanceKm: "", stopSec: "30", memo: "" };
const emptyManualLap: ManualLap = { id: "", raceId: "", km: "", lapTime: "" };
const emptyPb: PBRecord = { id: "", event: "フル", raceName: "", date: "", time: "", memo: "" };
const emptyPast: PastRace = { id: "", raceName: "", year: "", category: "フル", finishTime: "", weather: "", temperature: "", humidity: "" };

const PREFECTURE_MUNICIPALITIES: Record<string, string[]> = JAPAN_MUNICIPALITIES;
const PREFECTURES = Object.keys(PREFECTURE_MUNICIPALITIES);
const RACE_CATEGORIES = ["フルマラソン", "ハーフマラソン", "10km", "5km", "ウルトラマラソン", "その他"];
const CATEGORY_DISTANCE: Record<string, string> = {
  フルマラソン: "42.195",
  ハーフマラソン: "21.0975",
  "10km": "10",
  "5km": "5",
  ウルトラマラソン: "100"
};
const MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const ADJUST_OPTIONS = ["-30", "-20", "-15", "-10", "-5", "0", "5", "10", "15", "20", "30", "45", "60"];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const n = (value: string, fallback = 0) => {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

function parseDuration(value: string): number | null {
  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function parsePace(value: string): number | null {
  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function getFullPbSeconds(pbs: PBRecord[] = []): number | null {
  const best = pbs.filter((pb) => pb.event === "フル").sort((a, b) => (parseDuration(a.time) ?? Infinity) - (parseDuration(b.time) ?? Infinity))[0];
  return best ? parseDuration(best.time) : null;
}

function getPlanOfficialTargetSeconds(race?: Race, plan?: Plan, pbs: PBRecord[] = []): number | null {
  if (!race || !plan) return null;
  if ((plan.inputMode ?? "制限時間内で完走") === "制限時間内で完走") {
    return parseDuration(race.limitTime);
  }
  if (plan.inputMode === "自己ベスト更新を狙う") {
    const pbSec = getFullPbSeconds(pbs);
    if (!pbSec) return parseDuration(plan.targetTime);
    return Math.max(60, pbSec - n(plan.pbTargetOffsetMin ?? "3") * 60);
  }
  return parseDuration(plan.targetTime);
}

function getPlanTargetSeconds(race?: Race, plan?: Plan, pbs: PBRecord[] = []): number | null {
  const officialTargetSec = getPlanOfficialTargetSeconds(race, plan, pbs);
  if (!race || officialTargetSec == null) return null;
  return Math.max(60, officialTargetSec - n(race.lostTimeMin ?? "0") * 60);
}

function parseClock(value: string): number | null {
  const parts = value.trim().split(":").map(Number);
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return null;
  return parts[0] * 60 + parts[1];
}

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "-";
  const sign = sec < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(sec));
  const h = Math.floor(absolute / 3600);
  const m = Math.floor((absolute % 3600) / 60);
  const s = absolute % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPace(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "-";
  const m = Math.floor(Math.round(sec) / 60);
  const s = Math.round(sec) % 60;
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function formatDurationJa(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "-";
  const sign = sec < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(sec));
  const h = Math.floor(absolute / 3600);
  const m = Math.floor((absolute % 3600) / 60);
  if (h && m) return `${sign}${h}時間${m}分`;
  if (h) return `${sign}${h}時間`;
  return `${sign}${m}分`;
}

function formatMinutesLabel(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "-";
  return `${Math.round(sec / 60)}分`;
}

function formatClockFromStart(startTime: string, cumulativeSec: number): string {
  const start = parseClock(startTime);
  if (start == null) return "-";
  const totalMinutes = start + cumulativeSec / 60;
  const dayMinutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(dayMinutes / 60);
  const m = dayMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addMinutesToClock(startTime: string, addMin: number): string {
  const start = parseClock(startTime);
  if (start == null) return "-";
  const dayMinutes = ((Math.round(start + addMin) % 1440) + 1440) % 1440;
  const h = Math.floor(dayMinutes / 60);
  const m = dayMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getRealStartTime(race?: Race): string {
  if (!race) return "-";
  return addMinutesToClock(race.startTime, n(race.lostTimeMin ?? "0"));
}

function getLimitGoalTime(race?: Race): string {
  if (!race) return "-";
  const limitSec = parseDuration(race.limitTime);
  return limitSec == null ? "-" : addMinutesToClock(race.startTime, limitSec / 60);
}

function getRealRunnableSeconds(race?: Race): number | null {
  if (!race) return null;
  const limitSec = parseDuration(race.limitTime);
  if (limitSec == null) return null;
  return Math.max(0, limitSec - n(race.lostTimeMin ?? "0") * 60);
}

function parseLocationParts(race: Race) {
  if (race.prefecture || race.municipality) {
    return { prefecture: race.prefecture ?? "", municipality: race.municipality ?? "" };
  }
  const prefecture = PREFECTURES.find((candidate) => race.location.includes(candidate)) ?? "";
  const municipality = prefecture
    ? PREFECTURE_MUNICIPALITIES[prefecture].find((candidate) => race.location.includes(candidate)) ?? ""
    : "";
  return { prefecture, municipality };
}

function normalizeRaceForm(race: Race): Race {
  const locationParts = parseLocationParts(race);
  return { ...race, ...locationParts };
}

function combineLocation(prefecture?: string, municipality?: string, fallback?: string) {
  return [prefecture, municipality].filter(Boolean).join(" ") || fallback || "";
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarDates(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function statusFromMargin(sec?: number): StatusLabel {
  if (sec == null) return "-";
  if (sec < 0) return "関門アウト";
  if (sec < 5 * 60) return "危険";
  if (sec < 10 * 60) return "注意";
  return "安全";
}

function subLabel(sec: number | null | undefined) {
  if (sec == null) return "-";
  if (sec <= 3.5 * 3600) return "サブ3.5圏内";
  if (sec <= 4 * 3600) return "サブ4圏内";
  if (sec <= 4.5 * 3600) return "サブ4.5圏内";
  if (sec <= 5 * 3600) return "サブ5圏内";
  if (sec <= 5.5 * 3600) return "サブ5.5圏内";
  if (sec <= 6 * 3600) return "サブ6圏内";
  return "完走重視";
}

function isFullMarathon(race?: Race) {
  if (!race) return false;
  return race.category.includes("フル") || Math.abs(n(race.distanceKm) - 42.195) < 0.2;
}

function planModeDescription(mode?: Plan["inputMode"]) {
  if (mode === "目標ゴールタイムを狙う") return "入力したゴールタイムに合わせてペースを作成します。";
  if (mode === "自己ベスト更新を狙う") return "登録済みPBより少し速い目標で計画します。";
  return "関門に間に合うことを最優先に計画します。";
}

function paceTypeDescription(type?: Plan["paceType"]) {
  const normalized = normalizedPaceType(type ?? "安全完走型");
  if (normalized === "一定ペース型") return "最初から最後までできるだけ同じペースで走ります。";
  if (normalized === "後半温存型") return "前半を少し抑えて、後半に余力を残します。";
  return "関門に余裕を持つことを最優先にします。";
}

function planTargetLabel(mode?: Plan["inputMode"]) {
  if (mode === "目標ゴールタイムを狙う") return "入力した目標ゴールタイム";
  if (mode === "自己ベスト更新を狙う") return "フルPBから短縮した目標タイム";
  return "大会の制限時間";
}

function planModeShortLabel(mode: string) {
  if (mode === "制限時間内で完走") return "制限完走";
  if (mode === "目標ゴールタイムを狙う") return "目標タイム";
  if (mode === "自己ベスト更新を狙う") return "PB更新";
  return mode;
}

function escapeCsv(value: string | number | undefined) {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}

function sanitizeStore(raw: Partial<Store>): Store {
  const initial = createInitialStore();
  const races = (raw.races ?? initial.races).map((race) => ({ ...race, lostTimeMin: race.lostTimeMin ?? "0", lastUsedAt: race.lastUsedAt ?? 0 }));
  const plans = (raw.plans ?? initial.plans).map((plan) => ({
    ...plan,
    inputMode: (plan.inputMode as string) === "申告ペース" || (plan.inputMode as string) === "目標タイム" ? "目標ゴールタイムを狙う" : plan.inputMode ?? "制限時間内で完走",
    paceType: normalizedPaceType(plan.paceType ?? "安全完走型"),
    pbTargetOffsetMin: plan.pbTargetOffsetMin ?? "3"
  }));
  return {
    ...initial,
    ...raw,
    races,
    gates: raw.gates ?? [],
    segments: raw.segments ?? [],
    stops: raw.stops ?? [],
    manualLaps: raw.manualLaps ?? [],
    plans,
    pbs: raw.pbs ?? [],
    pastRaces: raw.pastRaces ?? [],
    settings: sanitizeSettings(raw.settings ?? defaultSettings)
  };
}

function sanitizeSettings(settings: Settings): Settings {
  return {
    climbSec: sanitizeAdjustValue(settings.climbSec, defaultSettings.climbSec),
    descentSec: sanitizeAdjustValue(settings.descentSec, defaultSettings.descentSec),
    flatSec: sanitizeAdjustValue(settings.flatSec, defaultSettings.flatSec)
  };
}

function sanitizeAdjustValue(value: string | undefined, fallback: string) {
  const numeric = n(value ?? "", Number.NaN);
  if (!Number.isFinite(numeric) || numeric < -120 || numeric > 120) return fallback;
  return String(Math.round(numeric));
}

function getTerrainAdjustment(km: number, segments: ElevationSegment[]) {
  const hit = segments.find((segment) => km > n(segment.startKm) && km <= n(segment.endKm));
  return hit ? n(hit.adjustSecPerKm) : 0;
}

function normalizedPaceType(type: Plan["paceType"]) {
  if (type === "関門安全重視") return "安全完走型";
  if (type === "イーブンペース") return "一定ペース型";
  if (type === "前半抑えめ" || type === "後半型") return "後半温存型";
  return type;
}

function paceFactor(type: Plan["paceType"], km: number, distance: number) {
  const normalized = normalizedPaceType(type);
  const ratio = km / distance;
  if (normalized === "後半温存型") return ratio <= 0.55 ? 1.04 : 0.96;
  if (normalized === "安全完走型") return ratio <= 0.7 ? 0.985 : 1.035;
  return 1;
}

function buildPaceRows(race?: Race, plan?: Plan, gates: Gate[] = [], segments: ElevationSegment[] = [], stops: StopPoint[] = [], manualLaps: ManualLap[] = [], pbs: PBRecord[] = []): PaceRow[] {
  if (!race || !plan) return [];
  const distance = n(race.distanceKm);
  const targetSec = getPlanTargetSeconds(race, plan, pbs);
  if (!distance || !targetSec) return [];
  const wholeKms = Math.floor(distance);
  const lastDistance = distance - wholeKms > 0.001 ? distance : wholeKms;
  const kmPoints = Array.from({ length: Math.ceil(lastDistance) }, (_, index) => index + 1);
  const totalStopSec = stops.reduce((sum, stop) => sum + Math.max(0, n(stop.stopSec)), 0);
  const manualByKm = new Map(manualLaps.map((manual) => [Math.round(n(manual.km) * 1000) / 1000, manual]));
  const rowSeeds = kmPoints.map((kmPoint) => {
    const actualKm = Math.min(kmPoint, distance);
    const previousKm = Math.max(0, Math.min(kmPoint - 1, distance));
    const segmentDistance = kmPoint > wholeKms ? distance - wholeKms : 1;
    const weight = segmentDistance * paceFactor(plan.paceType, actualKm, distance);
    const terrainSec = getTerrainAdjustment(actualKm, segments) * segmentDistance;
    const manual = manualByKm.get(Math.round(actualKm * 1000) / 1000);
    const manualSec = manual ? parsePace(manual.lapTime) : null;
    const segmentStops = stops.filter((stop) => {
      const stopKm = n(stop.distanceKm);
      return stopKm > previousKm && stopKm <= actualKm;
    });
    return { actualKm, segmentDistance, weight, terrainSec, manual, manualSec, segmentStops };
  });
  const manualTotalSec = rowSeeds.reduce((sum, seed) => sum + (seed.manualSec ?? 0), 0);
  const autoWeight = rowSeeds.reduce((sum, seed) => sum + (seed.manualSec == null ? seed.weight : 0), 0);
  const autoBudgetSec = Math.max(60, targetSec - totalStopSec - manualTotalSec);
  let cumulativeSec = 0;
  const sortedGates = [...gates].sort((a, b) => n(a.distanceKm) - n(b.distanceKm));
  const rows: PaceRow[] = [];

  rowSeeds.forEach((seed) => {
    const autoLapSec = autoWeight ? (autoBudgetSec * seed.weight) / autoWeight : autoBudgetSec / rowSeeds.length;
    const baseLapSec = seed.manualSec ?? autoLapSec;
    const adjustedLapSec = Math.max(60, baseLapSec + (seed.manualSec == null ? seed.terrainSec : 0));
    const stopSec = seed.segmentStops.reduce((sum, stop) => sum + Math.max(0, n(stop.stopSec)), 0);
    cumulativeSec += adjustedLapSec + stopSec;
    const actualKm = seed.actualKm;
    const gate = sortedGates.find((candidate) => Math.abs(n(candidate.distanceKm) - actualKm) < 0.51);
    const gateClock = gate ? parseClock(gate.gateTime) : null;
    const startClock = parseClock(getRealStartTime(race));
    const etaMinutes = startClock == null ? null : startClock + cumulativeSec / 60;
    const gateMarginSec = gateClock != null && etaMinutes != null ? (gateClock - etaMinutes) * 60 : undefined;
    rows.push({
      km: actualKm,
      baseLapSec,
      adjustedLapSec,
      stopSec,
      stopMemo: seed.segmentStops.map((stop) => `${stop.distanceKm}km ${stop.memo || "停止"} +${stop.stopSec}秒`).join(" / "),
      cumulativeSec,
      etaMinutes,
      gate,
      gateMarginSec,
      status: statusFromMargin(gateMarginSec),
      manual: seed.manual
    });
  });

  return rows;
}

function createInitialStore(): Store {
  const sampleRaceId = uid();
  return {
    races: [
      {
        ...emptyRace,
        id: sampleRaceId,
        name: "サンプルマラソン",
        location: "東京都 新宿区",
        prefecture: "東京都",
        municipality: "新宿区",
        date: "2026-10-25",
        memo: "大会情報は手入力で管理"
      }
    ],
    gates: [
      { id: uid(), raceId: sampleRaceId, name: "第1関門", distanceKm: "21.0975", gateTime: "12:45", memo: "中間地点" },
      { id: uid(), raceId: sampleRaceId, name: "第2関門", distanceKm: "35", gateTime: "14:40", memo: "35km地点" }
    ],
    segments: [
      { id: uid(), raceId: sampleRaceId, startKm: "0", endKm: "15", terrain: "平坦", adjustSecPerKm: "0" },
      { id: uid(), raceId: sampleRaceId, startKm: "15", endKm: "28", terrain: "上り", adjustSecPerKm: "10" },
      { id: uid(), raceId: sampleRaceId, startKm: "28", endKm: "42.195", terrain: "下り", adjustSecPerKm: "-5" }
    ],
    stops: [
      { id: uid(), raceId: sampleRaceId, distanceKm: "6.2", stopSec: "30", memo: "給水" },
      { id: uid(), raceId: sampleRaceId, distanceKm: "13", stopSec: "45", memo: "補給" },
      { id: uid(), raceId: sampleRaceId, distanceKm: "18", stopSec: "30", memo: "給水" }
    ],
    manualLaps: [],
    plans: [{ ...emptyPlan, id: uid(), raceId: sampleRaceId }],
    pbs: [],
    pastRaces: [],
    selectedRaceId: sampleRaceId,
    settings: defaultSettings
  };
}

export default function App() {
  const [store, setStore] = useState<Store>(createInitialStore);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("ホーム");
  const [raceSection, setRaceSection] = useState("大会");
  const [planSection, setPlanSection] = useState("作成");
  const [pbSection, setPbSection] = useState("PB");
  const [raceForm, setRaceForm] = useState<Race>(emptyRace);
  const [gateForm, setGateForm] = useState<Gate>(emptyGate);
  const [segmentForm, setSegmentForm] = useState<ElevationSegment>(emptySegment);
  const [stopForm, setStopForm] = useState<StopPoint>(emptyStop);
  const [manualForm, setManualForm] = useState<ManualLap>(emptyManualLap);
  const [planForm, setPlanForm] = useState<Plan>(emptyPlan);
  const [pbForm, setPbForm] = useState<PBRecord>(emptyPb);
  const [pastForm, setPastForm] = useState<PastRace>(emptyPast);
  const [raceSearch, setRaceSearch] = useState("");
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [planSavedMessage, setPlanSavedMessage] = useState("");

  const selectedRace = store.races.find((race) => race.id === store.selectedRaceId) ?? store.races[0];
  const selectedRaceId = selectedRace?.id ?? "";
  const selectedPlan = store.plans.find((plan) => plan.raceId === selectedRaceId);
  const raceGates = store.gates.filter((gate) => gate.raceId === selectedRaceId);
  const raceSegments = store.segments.filter((segment) => segment.raceId === selectedRaceId);
  const raceStops = store.stops.filter((stop) => stop.raceId === selectedRaceId);
  const raceManualLaps = store.manualLaps.filter((manual) => manual.raceId === selectedRaceId);
  const paceRows = useMemo(
    () => buildPaceRows(selectedRace, selectedPlan, raceGates, raceSegments, raceStops, raceManualLaps, store.pbs),
    [selectedRace, selectedPlan, raceGates, raceSegments, raceStops, raceManualLaps, store.pbs]
  );
  const gateMargins = paceRows.map((row) => row.gateMarginSec).filter((value): value is number => value != null);
  const minMargin = gateMargins.sort((a, b) => a - b)[0];
  const maxMargin = gateMargins.sort((a, b) => b - a)[0];
  const selectedTargetSec = getPlanTargetSeconds(selectedRace, selectedPlan, store.pbs);
  const selectedOfficialTargetSec = getPlanOfficialTargetSeconds(selectedRace, selectedPlan, store.pbs);
  const totalStopSec = raceStops.reduce((sum, stop) => sum + n(stop.stopSec), 0);
  const basePace = selectedRace && selectedTargetSec ? Math.max(60, selectedTargetSec - totalStopSec) / Math.max(n(selectedRace.distanceKm), 1) : null;
  const homeStatus = statusFromMargin(minMargin);
  const homeJudgement = !raceGates.length ? "関門未登録" : minMargin == null ? "判定待ち" : minMargin < 0 ? "関門アウト" : "完走可能";
  const goalTimeLabel = formatDuration(selectedOfficialTargetSec);
  const gateRows = paceRows.filter((row) => row.gate);
  const tightestGateRow = gateRows.filter((row) => row.gateMarginSec != null).sort((a, b) => (a.gateMarginSec ?? Infinity) - (b.gateMarginSec ?? Infinity))[0];
  const predictedOfficialGoalSec = paceRows.length ? n(selectedRace?.lostTimeMin ?? "0") * 60 + paceRows[paceRows.length - 1].cumulativeSec : selectedOfficialTargetSec;
  const finishZone = subLabel(predictedOfficialGoalSec);
  const showSubLabel = isFullMarathon(selectedRace);
  const attentionComment = minMargin == null
    ? "関門を登録すると、どこに余裕が少ないか確認できます。"
    : minMargin < 0
      ? "この計画では関門に間に合わない地点があります。目標を緩めるか、安全完走型を選んでください。"
      : totalStopSec > 0 && minMargin < 10 * 60
        ? "給水や補給の停止時間を含めると、関門余裕が少なめです。"
        : "現在の計画では関門に余裕があります。";
  const sortedRaces = [...store.races]
    .filter((race) => race.name.includes(raceSearch.trim()) || race.location.includes(raceSearch.trim()))
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) setStore(sanitizeStore(JSON.parse(saved)));
      })
      .catch(() => Alert.alert("読込エラー", "保存データの読込に失敗しました。"))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store)).catch(() => {});
  }, [ready, store]);

  useEffect(() => {
    setPlanForm(selectedPlan ?? { ...emptyPlan, raceId: selectedRaceId });
  }, [selectedRaceId, selectedPlan?.id]);

  const updateStore = (next: Store) => setStore(next);
  const selectRace = (id: string) => updateStore({ ...store, selectedRaceId: id, races: store.races.map((race) => (race.id === id ? { ...race, lastUsedAt: Date.now() } : race)) });
  const raceOptions = store.races.length ? store.races : [];

  function saveRace() {
    if (!raceForm.name.trim()) return Alert.alert("入力不足", "大会名を入力してください。");
    const id = raceForm.id || uid();
    const nextRace = { ...raceForm, id, location: combineLocation(raceForm.prefecture, raceForm.municipality, raceForm.location) };
    const exists = store.races.some((race) => race.id === id);
    updateStore({
      ...store,
      races: exists ? store.races.map((race) => (race.id === id ? { ...nextRace, lastUsedAt: Date.now() } : race)) : [{ ...nextRace, lastUsedAt: Date.now() }, ...store.races],
      selectedRaceId: id
    });
    setRaceForm(emptyRace);
  }

  function deleteRace(id: string) {
    updateStore({
      ...store,
      races: store.races.filter((race) => race.id !== id),
      gates: store.gates.filter((gate) => gate.raceId !== id),
      segments: store.segments.filter((segment) => segment.raceId !== id),
      stops: store.stops.filter((stop) => stop.raceId !== id),
      manualLaps: store.manualLaps.filter((manual) => manual.raceId !== id),
      plans: store.plans.filter((plan) => plan.raceId !== id),
      selectedRaceId: store.races.find((race) => race.id !== id)?.id
    });
  }

  function saveGate() {
    if (!selectedRaceId) return Alert.alert("大会未選択", "先に大会を登録してください。");
    if (!gateForm.name || !gateForm.distanceKm || !gateForm.gateTime) return Alert.alert("入力不足", "関門名、距離、関門時刻を入力してください。");
    const nextGate = { ...gateForm, id: gateForm.id || uid(), raceId: selectedRaceId };
    const exists = store.gates.some((gate) => gate.id === nextGate.id);
    updateStore({ ...store, gates: exists ? store.gates.map((gate) => (gate.id === nextGate.id ? nextGate : gate)) : [...store.gates, nextGate] });
    setGateForm(emptyGate);
  }

  function saveSegment() {
    if (!selectedRaceId) return Alert.alert("大会未選択", "先に大会を登録してください。");
    const fallback = segmentForm.terrain === "上り" ? defaultSettings.climbSec : segmentForm.terrain === "下り" ? defaultSettings.descentSec : defaultSettings.flatSec;
    const nextSegment = { ...segmentForm, adjustSecPerKm: sanitizeAdjustValue(segmentForm.adjustSecPerKm, fallback), id: segmentForm.id || uid(), raceId: selectedRaceId };
    const exists = store.segments.some((segment) => segment.id === nextSegment.id);
    updateStore({
      ...store,
      segments: exists ? store.segments.map((segment) => (segment.id === nextSegment.id ? nextSegment : segment)) : [...store.segments, nextSegment]
    });
    setSegmentForm(emptySegment);
  }

  function saveStop() {
    if (!selectedRaceId) return Alert.alert("大会未選択", "先に大会を登録してください。");
    if (!stopForm.distanceKm || !stopForm.stopSec) return Alert.alert("入力不足", "地点距離と停止時間を入力してください。");
    const nextStop = { ...stopForm, id: stopForm.id || uid(), raceId: selectedRaceId };
    const exists = store.stops.some((stop) => stop.id === nextStop.id);
    updateStore({ ...store, stops: exists ? store.stops.map((stop) => (stop.id === nextStop.id ? nextStop : stop)) : [...store.stops, nextStop] });
    setStopForm(emptyStop);
  }

  function saveManualLap() {
    if (!selectedRaceId) return Alert.alert("大会未選択", "先に大会を登録してください。");
    if (!manualForm.km || !manualForm.lapTime) return Alert.alert("入力不足", "距離と予定ラップを入力してください。");
    const nextManual = { ...manualForm, id: manualForm.id || uid(), raceId: selectedRaceId };
    const exists = store.manualLaps.some((manual) => manual.id === nextManual.id);
    updateStore({ ...store, manualLaps: exists ? store.manualLaps.map((manual) => (manual.id === nextManual.id ? nextManual : manual)) : [...store.manualLaps, nextManual] });
    setManualForm(emptyManualLap);
  }

  function savePlan() {
    if (!selectedRaceId) return Alert.alert("大会未選択", "先に大会を登録してください。");
    if ((planForm.inputMode ?? "制限時間内で完走") === "目標ゴールタイムを狙う" && !parseDuration(planForm.targetTime)) return Alert.alert("入力不足", "目標ゴールタイムを 05:30:00 の形式で入力してください。");
    if (planForm.inputMode === "自己ベスト更新を狙う" && !getFullPbSeconds(store.pbs)) return Alert.alert("PB未登録", "PB画面でフルマラソンPBを登録してください。");
    const nextPlan = { ...planForm, id: planForm.id || selectedPlan?.id || uid(), raceId: selectedRaceId };
    const exists = store.plans.some((plan) => plan.id === nextPlan.id);
    updateStore({ ...store, plans: exists ? store.plans.map((plan) => (plan.id === nextPlan.id ? nextPlan : plan)) : [...store.plans, nextPlan] });
    setPlanSavedMessage("保存しました。ホームとペース表に反映済みです。");
  }

  function savePb() {
    if (!pbForm.time) return Alert.alert("入力不足", "タイムを入力してください。");
    const nextPb = { ...pbForm, id: pbForm.id || uid() };
    const exists = store.pbs.some((pb) => pb.id === nextPb.id);
    updateStore({ ...store, pbs: exists ? store.pbs.map((pb) => (pb.id === nextPb.id ? nextPb : pb)) : [...store.pbs, nextPb] });
    setPbForm(emptyPb);
  }

  function savePast() {
    if (!pastForm.raceName || !pastForm.finishTime) return Alert.alert("入力不足", "大会名と完走タイムを入力してください。");
    const nextPast = { ...pastForm, id: pastForm.id || uid() };
    const exists = store.pastRaces.some((past) => past.id === nextPast.id);
    updateStore({
      ...store,
      pastRaces: exists ? store.pastRaces.map((past) => (past.id === nextPast.id ? nextPast : past)) : [...store.pastRaces, nextPast]
    });
    setPastForm(emptyPast);
  }

  async function shareFile(uri: string) {
    if (Platform.OS === "web") {
      Alert.alert("出力完了", uri);
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(uri);
    else Alert.alert("出力完了", uri);
  }

  async function exportCsv() {
    const header = ["大会名", "スタート時刻", "ロスタイム", "実走開始時刻", "目標ゴールタイム", "距離", "予定ラップ", "通過予定", "関門時刻", "関門余裕", "給水/停止", "メモ"];
    const lines = paceRows.map((row) => [
      selectedRace?.name ?? "",
      selectedRace?.startTime ?? "",
      `${selectedRace?.lostTimeMin ?? "0"}分`,
      getRealStartTime(selectedRace),
      goalTimeLabel,
      row.gate?.distanceKm ?? row.km,
      formatDuration(row.adjustedLapSec),
      row.etaMinutes == null ? "-" : addMinutesToClock("00:00", row.etaMinutes),
      row.gate?.gateTime ?? "",
      formatMinutesLabel(row.gateMarginSec),
      row.stopSec ? `+${row.stopSec}秒 ${row.stopMemo ?? ""}` : "",
      [row.gate?.name, row.gate?.memo, row.manual ? "手動調整" : ""].filter(Boolean).join(" / ")
    ]);
    const csv = "\uFEFF" + [header, ...lines].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const safeName = (selectedRace?.name || "race-plan").replace(/[\\/:*?"<>|]/g, "_");
    if (Platform.OS === "web") {
      const web = globalThis as any;
      const blob = new web.Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = web.URL.createObjectURL(blob);
      const link = web.document.createElement("a");
      link.href = url;
      link.download = `${safeName}-pace.csv`;
      link.click();
      web.URL.revokeObjectURL(url);
      return;
    }
    const uri = `${FileSystem.documentDirectory}${safeName}-pace.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await shareFile(uri);
  }

  async function exportPdf() {
    const rows = paceRows
      .map(
        (row) =>
          `<tr><td>${row.gate?.distanceKm ?? row.km}</td><td>${formatDuration(row.adjustedLapSec)}</td><td>${row.etaMinutes == null ? "-" : addMinutesToClock("00:00", row.etaMinutes)}</td><td>${row.gate?.gateTime ?? ""}</td><td>${formatMinutesLabel(row.gateMarginSec)}</td><td>${row.stopSec ? `+${row.stopSec}秒` : ""}</td><td>${[row.gate?.name, row.gate?.memo, row.stopMemo, row.manual ? "手動調整" : ""].filter(Boolean).join("<br>")}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:12mm}body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:#263238}h1{font-size:18px;margin:0 0 8px}.summary{margin:8px 0 12px;padding:8px;background:#f6f3ee;font-size:11px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #ccd6d0;padding:4px;text-align:left;vertical-align:top}th{background:#e9f1eb}@media print{body{margin:0}.summary{break-inside:avoid}tr{break-inside:avoid}}</style></head><body><h1>RUN Finish Planner</h1><div class="summary"><b>${selectedRace?.name ?? ""}</b><br>スタート ${selectedRace?.startTime ?? "-"} / ロスタイム ${selectedRace?.lostTimeMin ?? "0"}分 / 実走開始 ${getRealStartTime(selectedRace)} / 目標 ${goalTimeLabel} / 予測ゴール ${formatDurationJa(predictedOfficialGoalSec)} / 関門余裕 最小${formatMinutesLabel(minMargin)}</div><table><thead><tr><th>距離</th><th>予定ラップ</th><th>通過予定</th><th>関門時刻</th><th>関門余裕</th><th>給水/停止</th><th>メモ</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    if (Platform.OS === "web") {
      const web = globalThis as any;
      const win = web.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      } else {
        Alert.alert("印刷画面", "ポップアップがブロックされました。ブラウザ設定を確認してください。");
      }
      return;
    }
    const result = await Print.printToFileAsync({ html, width: 595, height: 842 });
    await shareFile(result.uri);
  }

  function backupData() {
    const json = JSON.stringify(store, null, 2);
    const uri = `${FileSystem.documentDirectory}marathon-planner-backup.json`;
    FileSystem.writeAsStringAsync(uri, json).then(() => shareFile(uri));
  }

  function restoreSample() {
    updateStore(createInitialStore());
    Alert.alert("復元", "サンプルを復元しました。バックアップJSONからの復元UIは将来拡張用です。");
  }

  function clearAll() {
    Alert.alert("全データ削除", "スマホ内保存データを削除します。", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => updateStore({ ...createInitialStore(), races: [], gates: [], segments: [], stops: [], manualLaps: [], plans: [], pbs: [], pastRaces: [], selectedRaceId: undefined }) }
    ]);
  }

  const setField = <T extends object>(setter: React.Dispatch<React.SetStateAction<T>>, key: keyof T, value: string) => setter((prev) => ({ ...prev, [key]: value }));
  const currentPbBest = (event: PBRecord["event"]) => store.pbs.filter((pb) => pb.event === event).sort((a, b) => (parseDuration(a.time) ?? Infinity) - (parseDuration(b.time) ?? Infinity))[0];

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>読込中...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBackground}>
        <Image source={RUNNER_BACKGROUND} style={styles.appBackgroundImage} resizeMode="cover" />
        <View style={styles.appOverlay} />
        <View style={styles.header}>
          <Text style={styles.appName}>CHEBIS RUN</Text>
          <Text style={styles.appSub}>関門時間から完走ペースを逆算</Text>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {tab === "ホーム" && renderHome()}
          {tab === "大会登録" && renderRaceTab()}
          {tab === "プラン" && renderPlanTab()}
          {tab === "ペース表" && renderPaceTable()}
          {tab === "PB" && renderPbTab()}
        </ScrollView>
        <View style={styles.tabbar}>
          {["ホーム", "大会登録", "プラン", "ペース表", "PB"].map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tabButton, tab === item && styles.tabButtonActive]}>
              <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );

  function renderHome() {
    const planType = normalizedPaceType(selectedPlan?.paceType ?? "安全完走型");
    const pacePreview = [5, 10, 15, 20]
      .map((km) => paceRows.find((row) => Math.abs(row.km - km) < 0.01))
      .filter(Boolean) as PaceRow[];
    const goalRow = paceRows[paceRows.length - 1];
    const homePaceRows = [...pacePreview, ...(goalRow ? [goalRow] : [])].filter((row, index, rows) => rows.findIndex((item) => Math.abs(item.km - row.km) < 0.01) === index);
    return (
      <>
        <View style={styles.homeHero}>
          <View style={styles.raceFocusCard}>
            <Text style={styles.darkLabel}>対象大会</Text>
            <Text style={styles.darkRaceTitle}>{selectedRace?.name || "大会未登録"}</Text>
            <Text style={styles.darkRaceMeta}>{selectedRace ? `${selectedRace.date} / ${selectedRace.location} / ${selectedRace.category}` : "大会登録タブから追加してください"}</Text>
          </View>

          <View style={styles.homeMetricGrid}>
            <View style={styles.glassMetric}>
              <Text style={styles.homeMetricLabel}>予測ゴール</Text>
              <Text style={styles.homeMetricValue}>{formatDuration(predictedOfficialGoalSec)}</Text>
            </View>
            <View style={styles.glassMetric}>
              <Text style={styles.homeMetricLabel}>平均ペース</Text>
              <Text style={styles.homeMetricValue}>{formatPace(basePace)}</Text>
            </View>
            <View style={styles.glassMetric}>
              <Text style={styles.homeMetricLabel}>関門余裕（最小/最大）</Text>
              <Text style={styles.homeMetricValue}>{formatMinutesLabel(minMargin)} / {formatMinutesLabel(maxMargin)}</Text>
            </View>
            <View style={styles.glassMetric}>
              <Text style={styles.homeMetricLabel}>最も余裕が少ない関門</Text>
              <Text style={styles.homeMetricValue}>{tightestGateRow?.gate?.name ?? "-"}</Text>
            </View>
          </View>

          <View style={styles.glassWidePanel}>
            <Text style={styles.homeMetricLabel}>完走判定</Text>
            {showSubLabel && homeJudgement !== "関門アウト" && <Text style={styles.subJudgementText}>{finishZone}</Text>}
            <Text style={[styles.homeJudgeText, homeJudgement === "完走可能" && styles.resultOk, homeJudgement === "関門アウト" && styles.resultDanger]}>{homeJudgement}</Text>
          </View>

          <View style={styles.glassWidePanel}>
            <Text style={styles.homeMetricLabel}>プランタイプ</Text>
            <Text style={styles.planTypeText}>{planType}</Text>
            <Text style={styles.homePanelSub}>{paceTypeDescription(selectedPlan?.paceType ?? "安全完走型")}</Text>
          </View>

          <View style={styles.darkPacePanel}>
            <Text style={styles.darkPanelTitle}>ペース表（目安）</Text>
            <View style={styles.darkTableHeader}>
              <Text style={styles.darkTableCell}>距離km</Text>
              <Text style={styles.darkTableCell}>通過予定</Text>
              <Text style={styles.darkTableCell}>ペース/km</Text>
            </View>
            {homePaceRows.map((row) => (
              <View key={`home-${row.km}`} style={styles.darkTableRow}>
                <Text style={styles.darkTableCell}>{row === goalRow ? "ゴール" : row.km.toFixed(0)}</Text>
                <Text style={styles.darkTableCell}>{formatDuration(row.cumulativeSec)}</Text>
                <Text style={styles.darkTableCell}>{formatPace(row.adjustedLapSec).replace("/km", "")}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.noticeText}>注意: {attentionComment}</Text>
        </View>
        <Card>
          <Text style={styles.sectionTitle}>対象大会</Text>
          <RacePicker races={raceOptions} selectedId={selectedRaceId} onSelect={selectRace} />
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>関門チェック</Text>
          {gateRows.length ? (
            gateRows.map((row) => (
              <View key={row.gate?.id} style={styles.gateSummary}>
                <View style={styles.gateSummaryText}>
                  <Text style={styles.listTitle}>{row.gate?.name} / {row.gate?.distanceKm ?? row.km.toFixed(row.km % 1 ? 3 : 0)}km</Text>
                  <Text style={styles.muted}>通過予定 {row.etaMinutes == null ? "-" : addMinutesToClock("00:00", row.etaMinutes)} / 関門 {row.gate?.gateTime}</Text>
                </View>
                <View style={styles.gateSummaryBadge}>
                  <Text style={[styles.metricValue, statusStyle(row.status)]}>{formatDuration(row.gateMarginSec)}</Text>
                  <Badge label={row.status} />
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.body}>大会登録タブで関門を追加すると、ここに通過予定時刻と余裕時間が表示されます。</Text>
          )}
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>方針</Text>
          <Text style={styles.body}>GPS計測や外部アプリ連携ではなく、大会前に関門アウトを避けるペース配分を作るためのアプリです。大会情報と関門は手入力で保存します。</Text>
        </Card>
      </>
    );
  }

  function renderRaceTab() {
    return (
      <>
        <Segment value={raceSection} values={["大会", "関門", "給水P", "高低差", "設定"]} onChange={(value) => {
          setActivePicker(null);
          setRaceSection(value);
        }} />
        <Card>
          <Text style={styles.sectionTitle}>対象大会</Text>
          <RacePicker races={raceOptions} selectedId={selectedRaceId} onSelect={selectRace} />
        </Card>
        {raceSection === "大会" && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>{raceForm.id ? "大会を編集" : "大会登録"}</Text>
              <Input label="大会名" value={raceForm.name} onChangeText={(v) => setField(setRaceForm, "name", v)} />
              <SelectField
                label="都道府県"
                value={raceForm.prefecture ?? ""}
                placeholder="都道府県を選択"
                options={PREFECTURES}
                pickerId="race-prefecture"
                activePicker={activePicker}
                setActivePicker={setActivePicker}
                onSelect={(value) => setRaceForm((prev) => ({ ...prev, prefecture: value, municipality: "", location: combineLocation(value, "", prev.location) }))}
              />
              <SelectField
                label="市町村"
                value={raceForm.municipality ?? ""}
                placeholder={raceForm.prefecture ? "市町村を選択" : "先に都道府県を選択"}
                options={raceForm.prefecture ? PREFECTURE_MUNICIPALITIES[raceForm.prefecture] ?? [] : []}
                pickerId="race-municipality"
                activePicker={activePicker}
                setActivePicker={setActivePicker}
                onSelect={(value) => setRaceForm((prev) => ({ ...prev, municipality: value, location: combineLocation(prev.prefecture, value, prev.location) }))}
              />
              <CalendarField label="大会日" value={raceForm.date} pickerId="race-date" activePicker={activePicker} setActivePicker={setActivePicker} onSelect={(value) => setField(setRaceForm, "date", value)} />
              <SelectField
                label="種目"
                value={raceForm.category}
                options={RACE_CATEGORIES}
                pickerId="race-category"
                activePicker={activePicker}
                setActivePicker={setActivePicker}
                onSelect={(value) => setRaceForm((prev) => ({ ...prev, category: value, distanceKm: CATEGORY_DISTANCE[value] ?? prev.distanceKm }))}
              />
              <Input label="距離 km" value={raceForm.distanceKm} onChangeText={(v) => setField(setRaceForm, "distanceKm", v)} keyboardType="decimal-pad" />
              <TimeSelectField label="スタート時刻" value={raceForm.startTime} pickerId="race-start" activePicker={activePicker} setActivePicker={setActivePicker} onSelect={(value) => setField(setRaceForm, "startTime", value)} />
              <DurationSelectField label="制限時間（制限ゴール時刻も計算）" value={raceForm.limitTime} pickerId="race-limit" activePicker={activePicker} setActivePicker={setActivePicker} onSelect={(value) => setField(setRaceForm, "limitTime", value)} />
              <Input label="ロスタイム 分（号砲からスタートラインまで）" value={raceForm.lostTimeMin ?? ""} onChangeText={(v) => setField(setRaceForm, "lostTimeMin", v)} keyboardType="number-pad" />
              <View style={styles.limitSummary}>
                <Text style={styles.limitText}>制限ゴール時刻: {getLimitGoalTime(raceForm)}</Text>
                <Text style={styles.limitText}>実走開始: {getRealStartTime(raceForm)}</Text>
                <Text style={styles.limitText}>実質走行可能時間: {formatDurationJa(getRealRunnableSeconds(raceForm))}</Text>
              </View>
              <Input label="公式サイトURL" value={raceForm.officialUrl} onChangeText={(v) => setField(setRaceForm, "officialUrl", v)} />
              <Input label="メモ" value={raceForm.memo} onChangeText={(v) => setField(setRaceForm, "memo", v)} multiline />
              <PrimaryButton label={raceForm.id ? "更新する" : "保存する"} onPress={saveRace} />
            </Card>
            <Card>
              <Text style={styles.sectionTitle}>登録大会一覧</Text>
              <Input label="大会名で検索" value={raceSearch} onChangeText={setRaceSearch} placeholder="例: 東京" />
              {sortedRaces.map((race) => (
                <View key={race.id} style={[styles.raceCard, race.id === selectedRaceId && styles.raceCardActive]}>
                  <View style={styles.raceCardHead}>
                    <Text style={styles.listTitle}>{race.name}</Text>
                    {race.id === selectedRaceId && <Text style={styles.usingBadge}>使用中</Text>}
                    {raceForm.id === race.id && <Text style={styles.editingBadge}>編集中</Text>}
                  </View>
                  <Text style={styles.muted}>{race.date} / {combineLocation(race.prefecture, race.municipality, race.location)} / {race.distanceKm}km</Text>
                  <Text style={styles.muted}>開始 {race.startTime} / ロスタイム {race.lostTimeMin ?? "0"}分 / 制限ゴール {getLimitGoalTime(race)}</Text>
                  <View style={styles.buttonRow}>
                    <SecondaryButton label="この大会を使う" onPress={() => selectRace(race.id)} />
                    <SecondaryButton label="編集" onPress={() => setRaceForm(normalizeRaceForm(race))} />
                    <DangerButton label="削除" onPress={() => deleteRace(race.id)} />
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
        {raceSection === "関門" && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>{gateForm.id ? "関門を編集" : "関門登録"}</Text>
              <Input label="関門名" value={gateForm.name} onChangeText={(v) => setField(setGateForm, "name", v)} />
              <Input label="距離 km" value={gateForm.distanceKm} onChangeText={(v) => setField(setGateForm, "distanceKm", v)} keyboardType="decimal-pad" />
              <Input label="関門時刻" value={gateForm.gateTime} onChangeText={(v) => setField(setGateForm, "gateTime", v)} placeholder="12:45" />
              <Input label="メモ" value={gateForm.memo} onChangeText={(v) => setField(setGateForm, "memo", v)} />
              <PrimaryButton label={gateForm.id ? "更新する" : "保存する"} onPress={saveGate} />
            </Card>
            {raceGates.map((gate) => {
              const row = paceRows.find((pace) => pace.gate?.id === gate.id);
              return (
                <ListCard
                  key={gate.id}
                  title={`${gate.name} ${gate.distanceKm}km`}
                  subtitle={`関門 ${gate.gateTime} / 余裕 ${formatDuration(row?.gateMarginSec)} / ${statusFromMargin(row?.gateMarginSec)}`}
                  onEdit={() => setGateForm(gate)}
                  onDelete={() => updateStore({ ...store, gates: store.gates.filter((item) => item.id !== gate.id) })}
                />
              );
            })}
          </>
        )}
        {raceSection === "高低差" && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>高低差補正</Text>
              <Input label="区間開始距離" value={segmentForm.startKm} onChangeText={(v) => setField(setSegmentForm, "startKm", v)} keyboardType="decimal-pad" />
              <Input label="区間終了距離" value={segmentForm.endKm} onChangeText={(v) => setField(setSegmentForm, "endKm", v)} keyboardType="decimal-pad" />
              <Segment value={segmentForm.terrain} values={["上り", "下り", "平坦"]} onChange={(v) => setSegmentForm((prev) => ({ ...prev, terrain: v as ElevationSegment["terrain"], adjustSecPerKm: v === "上り" ? store.settings.climbSec : v === "下り" ? store.settings.descentSec : store.settings.flatSec }))} />
              <SelectField
                label="補正 秒/km"
                value={sanitizeAdjustValue(segmentForm.adjustSecPerKm, segmentForm.terrain === "上り" ? "10" : segmentForm.terrain === "下り" ? "-5" : "0")}
                options={ADJUST_OPTIONS}
                displayValue={(value) => `${Number(value) > 0 ? "+" : ""}${value}秒/km`}
                pickerId="segment-adjust"
                activePicker={activePicker}
                setActivePicker={setActivePicker}
                onSelect={(value) => setField(setSegmentForm, "adjustSecPerKm", value)}
              />
              <PrimaryButton label={segmentForm.id ? "更新する" : "保存する"} onPress={saveSegment} />
            </Card>
            {raceSegments.map((segment) => (
              <ListCard key={segment.id} title={`${segment.startKm}km - ${segment.endKm}km / ${segment.terrain}`} subtitle={`${segment.adjustSecPerKm}秒/km`} onEdit={() => setSegmentForm(segment)} onDelete={() => updateStore({ ...store, segments: store.segments.filter((item) => item.id !== segment.id) })} />
            ))}
          </>
        )}
        {(raceSection === "給水P" || raceSection === "給水") && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>{stopForm.id ? "給水/停止を編集" : "給水/停止ポイント"}</Text>
              <Text style={styles.body}>給水、補給、トイレなどで立ち止まる時間を入れると、その地点以降の通過予定に反映されます。</Text>
              <Input label="地点距離 km" value={stopForm.distanceKm} onChangeText={(v) => setField(setStopForm, "distanceKm", v)} keyboardType="decimal-pad" />
              <Input label="停止時間 秒" value={stopForm.stopSec} onChangeText={(v) => setField(setStopForm, "stopSec", v)} keyboardType="number-pad" />
              <Input label="メモ" value={stopForm.memo} onChangeText={(v) => setField(setStopForm, "memo", v)} placeholder="給水、補給、トイレなど" />
              <PrimaryButton label={stopForm.id ? "更新する" : "保存する"} onPress={saveStop} />
            </Card>
            {raceStops.sort((a, b) => n(a.distanceKm) - n(b.distanceKm)).map((stop) => (
              <ListCard key={stop.id} title={`${stop.distanceKm}km / ${stop.memo || "停止"}`} subtitle={`+${stop.stopSec}秒`} onEdit={() => setStopForm(stop)} onDelete={() => updateStore({ ...store, stops: store.stops.filter((item) => item.id !== stop.id) })} />
            ))}
          </>
        )}
        {raceSection === "設定" && renderSettings()}
      </>
    );
  }

  function renderPlanTab() {
    return (
      <>
        <Segment value={planSection} values={["作成", "出力", "過去比較"]} onChange={setPlanSection} />
        {planSection === "作成" && (
          <Card>
            <Text style={styles.sectionTitle}>関門・ゴール逆算プラン</Text>
            <RacePicker races={raceOptions} selectedId={selectedRaceId} onSelect={(id) => {
              selectRace(id);
              setPlanSavedMessage("");
              const existing = store.plans.find((plan) => plan.raceId === id);
              setPlanForm(existing ?? { ...emptyPlan, raceId: id });
            }} />
            <View style={styles.explainBox}>
              <Text style={styles.explainTitle}>計算の考え方</Text>
              <Text style={styles.body}>入力方法は「何時間でゴールするか」を決めます。ペースタイプは「前半と後半にどう配分するか」を決めます。</Text>
            </View>
            <Text style={styles.label}>入力方法</Text>
            <Segment value={planForm.inputMode ?? "制限時間内で完走"} values={["制限時間内で完走", "目標ゴールタイムを狙う", "自己ベスト更新を狙う"]} labelForValue={planModeShortLabel} onChange={(v) => {
              setPlanSavedMessage("");
              setPlanForm((prev) => ({ ...prev, inputMode: v as Plan["inputMode"] }));
            }} />
            <Text style={styles.helpText}>{planModeDescription(planForm.inputMode)}</Text>
            {(planForm.inputMode ?? "制限時間内で完走") === "目標ゴールタイムを狙う" && (
              <Input label="目標ゴールタイム" value={planForm.targetTime} onChangeText={(v) => {
                setPlanSavedMessage("");
                setField(setPlanForm, "targetTime", v);
              }} placeholder="05:30:00" />
            )}
            {planForm.inputMode === "自己ベスト更新を狙う" && (
              <>
                <Input label="PBより何分速く狙うか" value={planForm.pbTargetOffsetMin ?? "3"} onChangeText={(v) => {
                  setPlanSavedMessage("");
                  setField(setPlanForm, "pbTargetOffsetMin", v);
                }} keyboardType="number-pad" />
                <Text style={styles.helpText}>フルPB: {formatDuration(getFullPbSeconds(store.pbs))} / 提案目標: {formatDuration(getPlanOfficialTargetSeconds(selectedRace, planForm, store.pbs))}</Text>
              </>
            )}
            <Text style={styles.label}>ペースタイプ</Text>
            <Segment value={normalizedPaceType(planForm.paceType)} values={["安全完走型", "一定ペース型", "後半温存型"]} onChange={(v) => {
              setPlanSavedMessage("");
              setPlanForm((prev) => ({ ...prev, paceType: v as Plan["paceType"] }));
            }} />
            <Text style={styles.helpText}>{paceTypeDescription(planForm.paceType)}</Text>
            <Input label="最低ほしい関門余裕（分）" value={planForm.gateBufferMin} onChangeText={(v) => {
              setPlanSavedMessage("");
              setField(setPlanForm, "gateBufferMin", v);
            }} keyboardType="number-pad" />
            <Text style={styles.helpText}>現在は表示確認用です。自動補正は次の改善候補として残しています。</Text>
            <View style={styles.planPreview}>
              <Metric label="ゴール目標の決め方" value={planTargetLabel(planForm.inputMode)} />
              <Metric label="配分方法" value={normalizedPaceType(planForm.paceType)} />
              <Metric label="予測ゴール" value={formatDuration(getPlanOfficialTargetSeconds(selectedRace, planForm, store.pbs))} />
              <Metric label="必要な平均ペース" value={selectedRace && getPlanTargetSeconds(selectedRace, planForm, store.pbs) ? formatPace(((getPlanTargetSeconds(selectedRace, planForm, store.pbs) ?? 0) - totalStopSec) / Math.max(n(selectedRace.distanceKm), 1)) : "-"} />
            </View>
            <PrimaryButton label="保存・再計算" onPress={savePlan} />
            {!!planSavedMessage && <Text style={styles.savedText}>{planSavedMessage}</Text>}
          </Card>
        )}
        {planSection === "出力" && (
          <Card>
            <Text style={styles.sectionTitle}>出力</Text>
            <Text style={styles.body}>現在のペース表をCSVまたはA4縦PDFで出力し、スマホ共有を開きます。CSVはUTF-8 BOM付きです。</Text>
            <View style={styles.rowGap}>
              <PrimaryButton label="CSV出力" onPress={exportCsv} />
              <SecondaryButton label="PDF出力" onPress={exportPdf} />
            </View>
          </Card>
        )}
        {planSection === "過去比較" && renderPastRace()}
      </>
    );
  }

  function renderPaceTable() {
    return (
      <>
        <Card>
          <Text style={styles.sectionTitle}>ペース表</Text>
          <Text style={styles.body}>{selectedRace?.name ?? "大会未選択"} / 予測ゴール {formatDurationJa(predictedOfficialGoalSec)} / 平均 {formatPace(basePace)} / 関門余裕 最小{formatMinutesLabel(minMargin)}</Text>
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>一部だけ手入力で調整</Text>
          <Text style={styles.body}>坂道や混雑で一部の距離だけペースを変えたい場合に使います。保存すると、その後の通過予定を再計算します。</Text>
          <View style={styles.twoColumn}>
            <Input label="距離 km" value={manualForm.km} onChangeText={(v) => setField(setManualForm, "km", v)} keyboardType="decimal-pad" />
            <Input label="予定ラップ" value={manualForm.lapTime} onChangeText={(v) => setField(setManualForm, "lapTime", v)} placeholder="07:15" />
          </View>
          <View style={styles.buttonRow}>
            <PrimaryButton label={manualForm.id ? "手動調整を更新" : "手動調整を保存"} onPress={saveManualLap} />
            <SecondaryButton label="自動計算に戻す" onPress={() => updateStore({ ...store, manualLaps: store.manualLaps.filter((manual) => manual.raceId !== selectedRaceId) })} />
          </View>
        </Card>
        {paceRows.map((row) => (
          <View key={`${row.km}`} style={styles.paceCard}>
            <View style={styles.paceHead}>
              <Text style={styles.kmText}>{row.gate?.distanceKm ?? row.km.toFixed(row.km % 1 ? 3 : 0)} km</Text>
              <View style={styles.badgeRow}>
                {row.manual && <Text style={styles.manualBadge}>手動調整</Text>}
                {row.gate ? <Badge label={row.status} /> : <Text style={styles.muted}>通過</Text>}
              </View>
            </View>
            <View style={styles.grid2}>
              <Metric label="予定ラップ" value={formatDuration(row.adjustedLapSec)} />
              <Metric label="通過予定" value={row.etaMinutes == null ? "-" : addMinutesToClock("00:00", row.etaMinutes)} />
              <Metric label="給水/停止" value={row.stopSec ? `+${row.stopSec}秒` : "-"} />
              <Metric label="メモ" value={row.stopMemo || row.gate?.memo || "-"} />
            </View>
            {row.gate && (
              <View style={styles.gateDetail}>
                <Text style={styles.gateLine}>関門: {row.gate.name}</Text>
                <Text style={styles.muted}>メモ: {row.gate.memo || "-"}</Text>
                <Text style={styles.muted}>関門時刻: {row.gate.gateTime} / 通過予定: {row.etaMinutes == null ? "-" : addMinutesToClock("00:00", row.etaMinutes)}</Text>
                <Text style={[styles.gateMargin, statusStyle(row.status)]}>余裕 {formatMinutesLabel(row.gateMarginSec)}</Text>
              </View>
            )}
            <View style={styles.buttonRow}>
              <SecondaryButton label="このラップを調整" onPress={() => setManualForm(row.manual ?? { ...emptyManualLap, raceId: selectedRaceId, km: String(row.km), lapTime: formatDuration(row.adjustedLapSec).slice(3) })} />
              {row.manual && <DangerButton label="調整を解除" onPress={() => updateStore({ ...store, manualLaps: store.manualLaps.filter((manual) => manual.id !== row.manual?.id) })} />}
            </View>
          </View>
        ))}
      </>
    );
  }

  function renderPbTab() {
    const fullPb = currentPbBest("フル");
    const halfPb = currentPbBest("ハーフ");
    const tenPb = currentPbBest("10km");
    const fullPbSec = fullPb ? parseDuration(fullPb.time) : null;
    const targetDiff = selectedOfficialTargetSec != null && fullPbSec != null ? selectedOfficialTargetSec - fullPbSec : null;
    const pbUpdateNeed = targetDiff != null && targetDiff < 0 ? Math.abs(targetDiff) : null;
    return (
      <>
        <Segment value={pbSection} values={["PB", "過去比較"]} onChange={setPbSection} />
        {pbSection === "PB" ? (
          <>
            <Card>
              <Text style={styles.sectionTitle}>PB管理</Text>
              <Text style={styles.body}>自己ベストを登録すると、今回の目標との差と、自己ベスト更新モードの提案目標に使われます。</Text>
              <Segment value={pbForm.event} values={["5km", "10km", "ハーフ", "フル"]} onChange={(v) => setPbForm((prev) => ({ ...prev, event: v as PBRecord["event"] }))} />
              <Input label="大会名" value={pbForm.raceName} onChangeText={(v) => setField(setPbForm, "raceName", v)} />
              <Input label="日付" value={pbForm.date} onChangeText={(v) => setField(setPbForm, "date", v)} />
              <Input label="タイム" value={pbForm.time} onChangeText={(v) => setField(setPbForm, "time", v)} placeholder="03:59:30" />
              <Input label="メモ" value={pbForm.memo} onChangeText={(v) => setField(setPbForm, "memo", v)} />
              <PrimaryButton label={pbForm.id ? "更新する" : "保存する"} onPress={savePb} />
            </Card>
            <View style={styles.grid2}>
              <Metric label="フルマラソンPB" value={fullPb?.time ?? "-"} />
              <Metric label="ハーフPB" value={halfPb?.time ?? "-"} />
              <Metric label="10km PB" value={tenPb?.time ?? "-"} />
              <Metric label="今回目標との差" value={formatDuration(targetDiff)} />
              <Metric label="必要な平均ペース" value={formatPace(basePace)} />
              <Metric label="PB更新に必要な短縮" value={pbUpdateNeed ? formatDuration(pbUpdateNeed) : "-"} />
            </View>
            {store.pbs.map((pb) => (
              <ListCard key={pb.id} title={`${pb.event} ${pb.time}`} subtitle={`${pb.raceName} / ${pb.date}`} onEdit={() => setPbForm(pb)} onDelete={() => updateStore({ ...store, pbs: store.pbs.filter((item) => item.id !== pb.id) })} />
            ))}
          </>
        ) : (
          renderPastRace()
        )}
      </>
    );
  }

  function renderPastRace() {
    const fullPb = currentPbBest("フル");
    return (
      <>
        <Card>
          <Text style={styles.sectionTitle}>過去大会比較</Text>
          <Input label="大会名" value={pastForm.raceName} onChangeText={(v) => setField(setPastForm, "raceName", v)} />
          <Input label="年" value={pastForm.year} onChangeText={(v) => setField(setPastForm, "year", v)} keyboardType="number-pad" />
          <Input label="種目" value={pastForm.category} onChangeText={(v) => setField(setPastForm, "category", v)} />
          <Input label="完走タイム" value={pastForm.finishTime} onChangeText={(v) => setField(setPastForm, "finishTime", v)} />
          <Input label="天候" value={pastForm.weather} onChangeText={(v) => setField(setPastForm, "weather", v)} />
          <Input label="気温" value={pastForm.temperature} onChangeText={(v) => setField(setPastForm, "temperature", v)} keyboardType="decimal-pad" />
          <Input label="湿度" value={pastForm.humidity} onChangeText={(v) => setField(setPastForm, "humidity", v)} keyboardType="number-pad" />
          <PrimaryButton label={pastForm.id ? "更新する" : "保存する"} onPress={savePast} />
        </Card>
        {store.pastRaces.map((past, index) => {
          const previous = store.pastRaces[index + 1];
          const diffPrev = previous ? (parseDuration(past.finishTime) ?? 0) - (parseDuration(previous.finishTime) ?? 0) : null;
          const diffPb = fullPb ? (parseDuration(past.finishTime) ?? 0) - (parseDuration(fullPb.time) ?? 0) : null;
          return (
            <ListCard
              key={past.id}
              title={`${past.raceName} ${past.year}`}
              subtitle={`${past.category} ${past.finishTime} / ${past.weather} ${past.temperature}℃ ${past.humidity}% / 前回差 ${formatDuration(diffPrev)} / PB差 ${formatDuration(diffPb)}`}
              onEdit={() => setPastForm(past)}
              onDelete={() => updateStore({ ...store, pastRaces: store.pastRaces.filter((item) => item.id !== past.id) })}
            />
          );
        })}
      </>
    );
  }

  function renderSettings() {
    const adjustLabel = (value: string) => `${Number(value) > 0 ? "+" : ""}${value}秒/km`;
    return (
      <Card>
        <Text style={styles.sectionTitle}>設定</Text>
        <Text style={styles.body}>保存先: スマホ内保存。クラウド保存は準備中として設計のみ残しています。</Text>
        <Text style={styles.helpText}>高低差は「1kmあたり何秒増減するか」を選びます。迷ったら初期値のままで大丈夫です。</Text>
        <SelectField
          label="上り 初期補正"
          value={sanitizeAdjustValue(store.settings.climbSec, defaultSettings.climbSec)}
          options={ADJUST_OPTIONS}
          displayValue={adjustLabel}
          pickerId="setting-climb"
          activePicker={activePicker}
          setActivePicker={setActivePicker}
          onSelect={(value) => updateStore({ ...store, settings: { ...store.settings, climbSec: value } })}
        />
        <SelectField
          label="下り 初期補正"
          value={sanitizeAdjustValue(store.settings.descentSec, defaultSettings.descentSec)}
          options={ADJUST_OPTIONS}
          displayValue={adjustLabel}
          pickerId="setting-descent"
          activePicker={activePicker}
          setActivePicker={setActivePicker}
          onSelect={(value) => updateStore({ ...store, settings: { ...store.settings, descentSec: value } })}
        />
        <SelectField
          label="平坦 初期補正"
          value={sanitizeAdjustValue(store.settings.flatSec, defaultSettings.flatSec)}
          options={ADJUST_OPTIONS}
          displayValue={adjustLabel}
          pickerId="setting-flat"
          activePicker={activePicker}
          setActivePicker={setActivePicker}
          onSelect={(value) => updateStore({ ...store, settings: { ...store.settings, flatSec: value } })}
        />
        <View style={styles.rowGap}>
          <PrimaryButton label="データバックアップ" onPress={backupData} />
          <SecondaryButton label="データ復元" onPress={restoreSample} />
          <DangerButton label="全データ削除" onPress={clearAll} />
        </View>
      </Card>
    );
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput {...props} placeholderTextColor="#9b9b93" style={[styles.input, props.multiline && styles.textarea, props.style]} />
    </View>
  );
}

function SelectField({
  label,
  value,
  options,
  onSelect,
  placeholder = "選択してください",
  pickerId,
  activePicker,
  setActivePicker,
  displayValue
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  pickerId?: string;
  activePicker?: string | null;
  setActivePicker?: (value: string | null) => void;
  displayValue?: (value: string) => string;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const disabled = options.length === 0;
  const open = pickerId && activePicker !== undefined ? activePicker === pickerId : localOpen;
  const toggleOpen = () => {
    if (pickerId && setActivePicker) setActivePicker(open ? null : pickerId);
    else setLocalOpen((current) => !current);
  };
  const closePicker = () => {
    if (pickerId && setActivePicker) setActivePicker(null);
    else setLocalOpen(false);
  };

  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable disabled={disabled} onPress={toggleOpen} style={[styles.selectButton, disabled && styles.selectButtonDisabled]}>
        <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>{value ? displayValue?.(value) ?? value : placeholder}</Text>
        <Text style={styles.selectArrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      <Modal visible={open && !disabled} transparent animationType="fade" onRequestClose={closePicker}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{label}</Text>
              <Pressable onPress={closePicker} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>閉じる</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
              {options.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    onSelect(option);
                    closePicker();
                  }}
                  style={[styles.selectOption, value === option && styles.selectOptionActive]}
                >
                  <Text style={[styles.selectOptionText, value === option && styles.selectOptionTextActive]}>{displayValue?.(option) ?? option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CalendarField({
  label,
  value,
  onSelect,
  pickerId,
  activePicker,
  setActivePicker
}: {
  label: string;
  value: string;
  onSelect: (value: string) => void;
  pickerId?: string;
  activePicker?: string | null;
  setActivePicker?: (value: string | null) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateValue(value));
  const open = pickerId && activePicker !== undefined ? activePicker === pickerId : localOpen;
  const dates = buildCalendarDates(visibleMonth);
  const selected = value ? parseDateValue(value) : null;
  const monthLabel = `${visibleMonth.getFullYear()}年 ${visibleMonth.getMonth() + 1}月`;
  const toggleOpen = () => {
    if (pickerId && setActivePicker) setActivePicker(open ? null : pickerId);
    else setLocalOpen((current) => !current);
  };
  const closePicker = () => {
    if (pickerId && setActivePicker) setActivePicker(null);
    else setLocalOpen(false);
  };

  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={toggleOpen} style={styles.selectButton}>
        <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>{value || "カレンダーから選択"}</Text>
        <Text style={styles.selectArrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={closePicker}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{label}</Text>
              <Pressable onPress={closePicker} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>閉じる</Text>
              </Pressable>
            </View>
            <View style={styles.calendarBox}>
              <View style={styles.calendarHeader}>
                <Pressable style={styles.calendarNav} onPress={() => setVisibleMonth((current) => addMonths(current, -1))}>
                  <Text style={styles.calendarNavText}>前月</Text>
                </Pressable>
                <Text style={styles.calendarTitle}>{monthLabel}</Text>
                <Pressable style={styles.calendarNav} onPress={() => setVisibleMonth((current) => addMonths(current, 1))}>
                  <Text style={styles.calendarNavText}>翌月</Text>
                </Pressable>
              </View>
              <View style={styles.weekRow}>
                {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
                  <Text key={day} style={styles.weekText}>{day}</Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {dates.map((date) => {
                  const formatted = formatDateValue(date);
                  const inMonth = date.getMonth() === visibleMonth.getMonth();
                  const active = selected ? formatted === formatDateValue(selected) : false;
                  return (
                    <Pressable
                      key={formatted}
                      onPress={() => {
                        onSelect(formatted);
                        closePicker();
                      }}
                      style={[styles.dayCell, active && styles.dayCellActive]}
                    >
                      <Text style={[styles.dayText, !inMonth && styles.dayTextMuted, active && styles.dayTextActive]}>{date.getDate()}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimeSelectField({
  label,
  value,
  onSelect,
  pickerId,
  activePicker,
  setActivePicker
}: {
  label: string;
  value: string;
  onSelect: (value: string) => void;
  pickerId?: string;
  activePicker?: string | null;
  setActivePicker?: (value: string | null) => void;
}) {
  const [hour = "09", minute = "00"] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));

  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.twoColumn}>
        <SelectField label="時" value={hour.padStart(2, "0")} options={hours} pickerId={`${pickerId ?? label}-hour`} activePicker={activePicker} setActivePicker={setActivePicker} onSelect={(nextHour) => onSelect(`${nextHour}:${minute.padStart(2, "0")}`)} />
        <SelectField label="分" value={minute.padStart(2, "0")} options={MINUTE_OPTIONS} pickerId={`${pickerId ?? label}-minute`} activePicker={activePicker} setActivePicker={setActivePicker} onSelect={(nextMinute) => onSelect(`${hour.padStart(2, "0")}:${nextMinute}`)} />
      </View>
    </View>
  );
}

function DurationSelectField({
  label,
  value,
  onSelect,
  pickerId,
  activePicker,
  setActivePicker
}: {
  label: string;
  value: string;
  onSelect: (value: string) => void;
  pickerId?: string;
  activePicker?: string | null;
  setActivePicker?: (value: string | null) => void;
}) {
  const [hour = "07", minute = "00"] = value.split(":");
  const hours = Array.from({ length: 15 }, (_, index) => String(index).padStart(2, "0"));

  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.twoColumn}>
        <SelectField label="時間" value={hour.padStart(2, "0")} options={hours} pickerId={`${pickerId ?? label}-hour`} activePicker={activePicker} setActivePicker={setActivePicker} onSelect={(nextHour) => onSelect(`${nextHour}:${minute.padStart(2, "0")}`)} />
        <SelectField label="分" value={minute.padStart(2, "0")} options={MINUTE_OPTIONS} pickerId={`${pickerId ?? label}-minute`} activePicker={activePicker} setActivePicker={setActivePicker} onSelect={(nextMinute) => onSelect(`${hour.padStart(2, "0")}:${nextMinute}`)} />
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.dangerButton} onPress={onPress}>
      <Text style={styles.dangerButtonText}>{label}</Text>
    </Pressable>
  );
}

function Segment({ value, values, onChange, labelForValue }: { value: string; values: string[]; onChange: (value: string) => void; labelForValue?: (value: string) => string }) {
  return (
    <View style={styles.segment}>
      {values.map((item) => (
        <Pressable key={item} onPress={() => onChange(item)} style={[styles.segmentItem, value === item && styles.segmentItemActive]}>
          <Text style={[styles.segmentText, value === item && styles.segmentTextActive]} numberOfLines={1}>{labelForValue?.(item) ?? item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RacePicker({ races, selectedId, onSelect }: { races: Race[]; selectedId: string; onSelect: (id: string) => void }) {
  if (!races.length) return <Text style={styles.muted}>登録済み大会がありません。</Text>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.chipRow}>
        {races.map((race) => (
          <Pressable key={race.id} onPress={() => onSelect(race.id)} style={[styles.chip, selectedId === race.id && styles.chipActive]}>
            <Text style={[styles.chipText, selectedId === race.id && styles.chipTextActive]}>{race.name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: StatusLabel }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone && statusStyle(tone)]}>{value}</Text>
    </View>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.heroTitle}>{value}</Text>
      <Text style={styles.muted}>{sub}</Text>
    </View>
  );
}

function ListCard({ title, subtitle, onEdit, onDelete }: { title: string; subtitle: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.listCard}>
      <View style={styles.listText}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.muted}>{subtitle}</Text>
      </View>
      <View style={styles.listActions}>
        <SecondaryButton label="編集" onPress={onEdit} />
        <DangerButton label="削除" onPress={onDelete} />
      </View>
    </View>
  );
}

function Badge({ label }: { label: StatusLabel }) {
  return (
    <View style={[styles.badge, badgeStyle(label)]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function statusStyle(tone: StatusLabel) {
  if (tone === "安全") return { color: "#147a4b" };
  if (tone === "注意") return { color: "#9a6500" };
  if (tone === "危険") return { color: "#b14c00" };
  if (tone === "関門アウト") return { color: "#b3261e" };
  return { color: "#263238" };
}

function badgeStyle(tone: StatusLabel) {
  if (tone === "安全") return { backgroundColor: "#dcefe5" };
  if (tone === "注意") return { backgroundColor: "#fff1c7" };
  if (tone === "危険") return { backgroundColor: "#ffe0c7" };
  if (tone === "関門アウト") return { backgroundColor: "#ffd6d2" };
  return { backgroundColor: "#e5e8e3" };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f1ec" },
  appBackground: { flex: 1 },
  appBackgroundImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", opacity: 0.74 },
  appOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(247,245,240,0.62)" },
  loading: { margin: 24, color: "#263238" },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, backgroundColor: "transparent" },
  appName: { fontSize: 34, lineHeight: 38, fontWeight: "900", color: "#101514", letterSpacing: 0 },
  appSub: { marginTop: 3, color: "#1f2926", fontSize: 13, fontWeight: "800" },
  content: { flex: 1 },
  contentInner: { padding: 14, paddingBottom: 150 },
  card: { backgroundColor: "rgba(255,255,255,0.88)", borderWidth: 1, borderColor: "rgba(30,34,32,0.12)", borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#31423b", marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: "900", color: "#263238", marginBottom: 5 },
  muted: { color: "#6d766f", fontSize: 13, lineHeight: 19 },
  body: { color: "#42514a", fontSize: 14, lineHeight: 21 },
  helpText: { color: "#5d6d65", fontSize: 12, lineHeight: 18, marginTop: 2, marginBottom: 12 },
  noticeText: { marginTop: 12, color: "#6b4d10", backgroundColor: "#fff4d6", borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  homeHero: { gap: 10, marginBottom: 12 },
  raceFocusCard: { backgroundColor: "rgba(15,17,16,0.82)", borderRadius: 8, padding: 16, minHeight: 110, justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  darkLabel: { color: "#ffffff", fontSize: 13, fontWeight: "900", marginBottom: 8 },
  darkRaceTitle: { color: "#ffffff", fontSize: 23, lineHeight: 29, fontWeight: "900" },
  darkRaceMeta: { color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 19, marginTop: 6, fontWeight: "800" },
  homeMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  glassMetric: { width: "48%", minHeight: 86, backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.78)", borderRadius: 8, padding: 12, justifyContent: "center" },
  glassWidePanel: { backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.78)", borderRadius: 8, padding: 14 },
  homeMetricLabel: { color: "#26302c", fontSize: 12, lineHeight: 17, fontWeight: "800", marginBottom: 4 },
  homeMetricValue: { color: "#111817", fontSize: 21, lineHeight: 27, fontWeight: "900" },
  homeJudgeText: { fontSize: 24, lineHeight: 30, fontWeight: "900" },
  planTypeText: { color: "#111817", fontSize: 22, lineHeight: 28, fontWeight: "900" },
  homePanelSub: { color: "#28332f", fontSize: 13, lineHeight: 19, marginTop: 5, fontWeight: "700" },
  darkPacePanel: { backgroundColor: "rgba(14,15,15,0.88)", borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  darkPanelTitle: { color: "#ffffff", fontSize: 16, lineHeight: 22, fontWeight: "900", marginBottom: 8 },
  darkTableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.22)", paddingBottom: 6, marginBottom: 4 },
  darkTableRow: { flexDirection: "row", paddingVertical: 4 },
  darkTableCell: { flex: 1, color: "#ffffff", fontSize: 13, lineHeight: 19, fontWeight: "800" },
  judgementBox: { backgroundColor: "#f0f5ef", borderRadius: 8, padding: 12, marginTop: 12 },
  judgementText: { color: "#263238", fontSize: 24, fontWeight: "900", marginBottom: 4 },
  subJudgementText: { color: "#263238", fontSize: 23, fontWeight: "900", marginBottom: 6 },
  resultLine: { color: "#263238", fontSize: 16, fontWeight: "800", lineHeight: 24 },
  resultOk: { color: "#1f5fbf", fontWeight: "900" },
  resultDanger: { color: "#b3261e", fontWeight: "900" },
  explainBox: { backgroundColor: "#eef5f8", borderRadius: 8, padding: 12, marginBottom: 12 },
  explainTitle: { color: "#2f4d5d", fontSize: 13, fontWeight: "900", marginBottom: 4 },
  savedText: { marginTop: 10, color: "#1f5fbf", backgroundColor: "#e7eef8", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: "900" },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  metric: { width: "48%", minHeight: 74, backgroundColor: "#f0f5ef", borderRadius: 8, padding: 10, justifyContent: "center" },
  metricLabel: { color: "#68766e", fontSize: 12, lineHeight: 17, marginBottom: 5 },
  metricValue: { color: "#263238", fontSize: 16, lineHeight: 21, fontWeight: "800" },
  metricCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e2ded2", borderRadius: 8, padding: 16, marginBottom: 10 },
  inputWrap: { flex: 1, minWidth: 0, marginBottom: 16 },
  label: { fontSize: 12, lineHeight: 18, color: "#526158", fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 44, backgroundColor: "#ffffff", borderColor: "#d8d7cd", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, color: "#263238", fontSize: 15 },
  textarea: { minHeight: 76, paddingTop: 10, textAlignVertical: "top" },
  selectButton: { minHeight: 44, backgroundColor: "#ffffff", borderColor: "#d8d7cd", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectButtonDisabled: { backgroundColor: "#f1f0eb" },
  selectText: { color: "#263238", fontSize: 15, fontWeight: "700", flex: 1 },
  selectPlaceholder: { color: "#8d948e", fontWeight: "600" },
  selectArrow: { color: "#64736a", fontSize: 12, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(38,50,56,0.35)", justifyContent: "center", padding: 18 },
  pickerSheet: { maxHeight: "82%", backgroundColor: "#fffdf8", borderRadius: 8, borderWidth: 1, borderColor: "#e2ded2", overflow: "hidden" },
  pickerHeader: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#e2ded2", backgroundColor: "#f6f3ee" },
  pickerTitle: { flex: 1, color: "#263238", fontSize: 16, fontWeight: "900" },
  modalCloseButton: { minHeight: 36, borderRadius: 8, backgroundColor: "#e6eee8", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  modalCloseText: { color: "#176b51", fontSize: 13, fontWeight: "900" },
  modalScroll: { maxHeight: 420 },
  selectMenu: { backgroundColor: "#ffffff", borderColor: "#d8d7cd", borderWidth: 1, borderRadius: 8, marginTop: 6, height: 220, overflow: "hidden" },
  selectScroll: { height: 220 },
  selectOption: { minHeight: 46, justifyContent: "center", paddingHorizontal: 14, borderBottomColor: "#ece9df", borderBottomWidth: 1 },
  selectOptionActive: { backgroundColor: "#e4eee7" },
  selectOptionText: { color: "#33423b", fontSize: 14, fontWeight: "700" },
  selectOptionTextActive: { color: "#176b51" },
  twoColumn: { flexDirection: "row", gap: 10 },
  limitSummary: { backgroundColor: "#f0f5ef", borderRadius: 8, padding: 12, marginBottom: 10, gap: 4 },
  limitText: { color: "#31423b", fontSize: 13, fontWeight: "800" },
  calendarBox: { backgroundColor: "#ffffff", padding: 12 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  calendarNav: { minHeight: 34, minWidth: 58, borderRadius: 8, backgroundColor: "#e6eee8", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  calendarNavText: { color: "#176b51", fontSize: 12, fontWeight: "800" },
  calendarTitle: { color: "#263238", fontSize: 15, fontWeight: "900" },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekText: { flex: 1, textAlign: "center", color: "#6b746e", fontSize: 12, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  dayCellActive: { backgroundColor: "#176b51" },
  dayText: { color: "#263238", fontSize: 13, fontWeight: "800" },
  dayTextMuted: { color: "#b0b5af" },
  dayTextActive: { color: "#ffffff" },
  primaryButton: { minHeight: 46, borderRadius: 8, backgroundColor: "#176b51", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginTop: 4 },
  primaryButtonText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },
  secondaryButton: { minHeight: 38, borderRadius: 8, backgroundColor: "#e6eee8", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  secondaryButtonText: { color: "#176b51", fontWeight: "800", fontSize: 13 },
  dangerButton: { minHeight: 38, borderRadius: 8, backgroundColor: "#fde3df", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  dangerButtonText: { color: "#a83429", fontWeight: "800", fontSize: 13 },
  rowGap: { gap: 9 },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  planPreview: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2, marginBottom: 12 },
  segment: { flexDirection: "row", backgroundColor: "#e8e3d8", borderRadius: 8, padding: 4, marginBottom: 14 },
  segmentItem: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 6, paddingHorizontal: 4 },
  segmentItemActive: { backgroundColor: "#fffdf8" },
  segmentText: { color: "#66736d", fontWeight: "700", fontSize: 12 },
  segmentTextActive: { color: "#176b51" },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: "#d4d8cf", backgroundColor: "#ffffff", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 },
  chipActive: { backgroundColor: "#176b51", borderColor: "#176b51" },
  chipText: { color: "#3e4c46", fontWeight: "700" },
  chipTextActive: { color: "#ffffff" },
  listCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e2ded2", borderRadius: 8, padding: 12, marginBottom: 10 },
  listText: { flex: 1 },
  listTitle: { color: "#263238", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  listActions: { gap: 6 },
  raceCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2ded2", borderRadius: 8, padding: 12, marginBottom: 10 },
  raceCardActive: { borderColor: "#176b51", backgroundColor: "#f2f8f3" },
  raceCardHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  usingBadge: { backgroundColor: "#dcefe5", color: "#176b51", fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  editingBadge: { backgroundColor: "#fff1c7", color: "#8a6200", fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  gateSummary: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#ebe7dc", paddingTop: 10, marginTop: 10 },
  gateSummaryText: { flex: 1 },
  gateSummaryBadge: { alignItems: "flex-end", gap: 5 },
  paceCard: { backgroundColor: "#fffdf8", borderColor: "#e2ded2", borderWidth: 1, borderRadius: 8, padding: 13, marginBottom: 10 },
  paceHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kmText: { fontSize: 18, fontWeight: "900", color: "#263238" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  manualBadge: { backgroundColor: "#e7eef8", color: "#2d5f91", fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  gateLine: { marginTop: 10, fontSize: 13, color: "#42514a", fontWeight: "700" },
  gateDetail: { borderTopWidth: 1, borderTopColor: "#ebe7dc", marginTop: 10, paddingTop: 2 },
  gateMargin: { marginTop: 4, fontSize: 16, fontWeight: "900" },
  badge: { minWidth: 72, minHeight: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  badgeText: { color: "#263238", fontSize: 12, fontWeight: "800" },
  tabbar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(30,34,32,0.14)", backgroundColor: "rgba(255,255,255,0.94)", paddingHorizontal: 6, paddingTop: 6, paddingBottom: Platform.OS === "ios" ? 18 : 8 },
  tabButton: { flex: 1, minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  tabButtonActive: { backgroundColor: "#dfeee7" },
  tabText: { color: "#5e6763", fontWeight: "900", fontSize: 11 },
  tabTextActive: { color: "#176b51" }
});
