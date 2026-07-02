import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { JAPAN_MUNICIPALITIES } from "./data/japanMunicipalities";
import { OFFICIAL_RACE_DATA, OfficialRaceData, RaceDataCategory, RaceDataDifficulty, RaceDataStatus } from "./src/data/raceData";
import { calculateFiveKmPacePlan, CoursePaceStrategy } from "./src/services/coursePacePlanner";
import { pickCsvFile } from "./src/services/filePickerService";
import {
  buildImportedActivities,
  buildTrainingBatch,
  calculateAveragePace,
  calculateReadinessScore,
  normalizeActivityType,
  paceDifferenceLabel,
  parseTrainingDate,
  parseTrainingDistance,
  parseTrainingDuration,
  parseTrainingCsv,
  summarizeTraining
} from "./src/services/trainingCore";
import {
  ParsedTrainingPreviewRow,
  TrainingColumnMapping,
  TrainingImportBatch,
  TrainingParseResult,
  TrainingSourceApp,
  TrainingActivity
} from "./src/types/training";

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
  raceDataId?: string;
  raceDataYear?: string;
  raceDataStatus?: string;
  sourceRaceId?: string;
  sourceRaceYear?: string;
  raceDataSnapshot?: OfficialRaceData;
  officialSourceTitle?: string;
  officialAccessedAt?: string;
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
  splitStrategy?: CoursePaceStrategy;
  splitDifferenceMin?: string;
  customSplitDifferenceMin?: string;
  gateBufferMin: string;
};

type PaceExportMode = "5km目安" | "全距離";

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

type ManualTrainingForm = {
  date: string;
  activityType: string;
  distanceKm: string;
  duration: string;
  averageHeartRate: string;
  memo: string;
};

type Settings = {
  climbSec: string;
  descentSec: string;
  flatSec: string;
  openingBackgroundUri?: string;
  homeHeroImageUri?: string;
  advancedFeaturesEnabled?: boolean;
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
  trainingActivities: TrainingActivity[];
  trainingImportBatches: TrainingImportBatch[];
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
const OPENING_BACKGROUND = require("./assets/opening-background.jpg");
const HOME_HERO_BACKGROUND = require("./assets/home-hero-runner.png");
const OPENING_LOGO = require("./assets/run-to-chebis-logo-white.png");
const defaultSettings: Settings = { climbSec: "10", descentSec: "-5", flatSec: "0", openingBackgroundUri: "", homeHeroImageUri: "", advancedFeaturesEnabled: false };
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
const emptyPlan: Plan = { id: "", raceId: "", inputMode: "制限時間内で完走", targetTime: "05:30:00", pbTargetOffsetMin: "3", paceType: "安全完走型", splitStrategy: "even", splitDifferenceMin: "0", customSplitDifferenceMin: "", gateBufferMin: "10" };
const emptyStop: StopPoint = { id: "", raceId: "", distanceKm: "", stopSec: "30", memo: "" };
const emptyManualLap: ManualLap = { id: "", raceId: "", km: "", lapTime: "" };
const emptyPb: PBRecord = { id: "", event: "フル", raceName: "", date: "", time: "", memo: "" };
const emptyPast: PastRace = { id: "", raceName: "", year: "", category: "フル", finishTime: "", weather: "", temperature: "", humidity: "" };
const emptyManualTrainingForm: ManualTrainingForm = {
  date: "",
  activityType: "ランニング",
  distanceKm: "",
  duration: "",
  averageHeartRate: "",
  memo: ""
};

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
const RACE_DATA_MONTH_OPTIONS = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const RACE_DATA_CATEGORY_OPTIONS: Array<"" | RaceDataCategory> = ["", "full", "half", "ultra", "other"];
const RACE_DATA_STATUS_OPTIONS: Array<"" | RaceDataStatus> = ["", "verified", "partially-verified", "previous-year", "unverified", "awaiting-official"];
const RACE_DATA_DIFFICULTY_OPTIONS: Array<"" | RaceDataDifficulty> = ["", "easy", "normal", "hard", "very-hard"];
const SPLIT_DIFF_OPTIONS = ["0", "5", "10", "15", "20", "custom"];

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

function formatKm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function sourceAppLabel(value: string): string {
  if (value === "garmin") return "Garmin";
  if (value === "runkeeper") return "ASICS Runkeeper";
  if (value === "strava") return "Strava";
  return "その他";
}

function raceDaysLabel(dateText: string): string {
  if (!dateText) return "大会日を登録すると残り日数を表示できます。";
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const raceDate = parseDateValue(dateText).getTime();
  const diff = Math.round((raceDate - todayLocal) / 86400000);
  if (diff < 0) return "大会日は終了しています。";
  if (diff === 0) return "大会当日です。";
  return `大会まで残り${diff}日です。`;
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
    pbTargetOffsetMin: plan.pbTargetOffsetMin ?? "3",
    splitStrategy: plan.splitStrategy ?? defaultStrategyForPaceType(plan.paceType ?? "安全完走型"),
    splitDifferenceMin: plan.splitDifferenceMin ?? "0",
    customSplitDifferenceMin: plan.customSplitDifferenceMin ?? ""
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
    trainingActivities: raw.trainingActivities ?? [],
    trainingImportBatches: raw.trainingImportBatches ?? [],
    settings: sanitizeSettings(raw.settings ?? defaultSettings)
  };
}

function sanitizeSettings(settings: Settings): Settings {
  return {
    climbSec: sanitizeAdjustValue(settings.climbSec, defaultSettings.climbSec),
    descentSec: sanitizeAdjustValue(settings.descentSec, defaultSettings.descentSec),
    flatSec: sanitizeAdjustValue(settings.flatSec, defaultSettings.flatSec),
    openingBackgroundUri: settings.openingBackgroundUri ?? "",
    homeHeroImageUri: settings.homeHeroImageUri ?? "",
    advancedFeaturesEnabled: Boolean(settings.advancedFeaturesEnabled)
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

function splitStrategyLabel(value: string) {
  if (value === "negative") return "ネガティブ";
  if (value === "positive") return "ポジティブ";
  return "イーブン";
}

function splitStrategyDescription(value?: CoursePaceStrategy) {
  if (value === "negative") return "前半を少し抑えて、後半を速める配分です。余力を残したい時に使います。";
  if (value === "positive") return "前半を少し速めて、後半に余裕を持たせる配分です。関門が前半に厳しい時に使います。";
  return "前半と後半をできるだけ同じ時間で走る配分です。迷ったらここから始めます。";
}

function splitDiffMinutes(plan?: Plan) {
  if (!plan) return 0;
  if (plan.splitDifferenceMin === "custom") return Math.max(0, n(plan.customSplitDifferenceMin ?? "0"));
  return Math.max(0, n(plan.splitDifferenceMin ?? "0"));
}

function defaultStrategyForPaceType(type?: Plan["paceType"]): CoursePaceStrategy {
  const normalized = normalizedPaceType(type ?? "安全完走型");
  if (normalized === "後半温存型") return "negative";
  if (normalized === "安全完走型") return "positive";
  return "even";
}

function raceDataCategoryLabel(value: string) {
  if (value === "full") return "フル";
  if (value === "half") return "ハーフ";
  if (value === "ultra") return "ウルトラ";
  if (value === "other") return "その他";
  return "すべて";
}

function raceDataStatusLabel(value: string) {
  if (value === "verified") return "確認済み";
  if (value === "partially-verified") return "一部確認済み";
  if (value === "previous-year") return "前年度情報";
  if (value === "unverified") return "未確認";
  if (value === "awaiting-official") return "公式発表待ち";
  return "すべて";
}

function raceDataDifficultyLabel(value: string | undefined) {
  if (value === "easy") return "やさしめ";
  if (value === "normal") return "標準";
  if (value === "hard") return "起伏あり";
  if (value === "very-hard") return "かなり厳しい";
  return "未設定";
}

function terrainLabel(value: string) {
  if (value === "uphill") return "上り";
  if (value === "downhill") return "下り";
  if (value === "rolling") return "起伏";
  if (value === "mixed") return "混在";
  if (value === "flat") return "平坦";
  return "未確認";
}

function raceCategoryFromData(category: RaceDataCategory) {
  if (category === "full") return "フルマラソン";
  if (category === "half") return "ハーフマラソン";
  if (category === "ultra") return "ウルトラマラソン";
  return "その他";
}

function limitTimeFromMinutes(minutes?: number) {
  if (!minutes || !Number.isFinite(minutes)) return emptyRace.limitTime;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
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
    trainingActivities: [],
    trainingImportBatches: [],
    selectedRaceId: sampleRaceId,
    settings: defaultSettings
  };
}

export default function App() {
  const [store, setStore] = useState<Store>(createInitialStore);
  const [ready, setReady] = useState(false);
  const [showOpening, setShowOpening] = useState(true);
  const [tab, setTab] = useState("ホーム");
  const [raceSection, setRaceSection] = useState("大会");
  const [planSection, setPlanSection] = useState("作成");
  const [paceExportMode, setPaceExportMode] = useState<PaceExportMode>("5km目安");
  const [pbSection, setPbSection] = useState("PB");
  const [settingsSection, setSettingsSection] = useState("設定");
  const [trainingSection, setTrainingSection] = useState("概要");
  const [trainingImportOpen, setTrainingImportOpen] = useState(false);
  const [trainingGuideOpen, setTrainingGuideOpen] = useState(false);
  const [trainingManualOpen, setTrainingManualOpen] = useState(false);
  const [trainingSourceApp, setTrainingSourceApp] = useState<TrainingSourceApp>("garmin");
  const [trainingFileName, setTrainingFileName] = useState("");
  const [trainingCsvText, setTrainingCsvText] = useState("");
  const [trainingMapping, setTrainingMapping] = useState<TrainingColumnMapping>({});
  const [trainingParseResult, setTrainingParseResult] = useState<TrainingParseResult | null>(null);
  const [trainingDuplicateMode, setTrainingDuplicateMode] = useState<"exclude" | "all">("exclude");
  const [trainingImportMessage, setTrainingImportMessage] = useState("");
  const [manualTrainingForm, setManualTrainingForm] = useState<ManualTrainingForm>(emptyManualTrainingForm);
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
  const [raceDataOpen, setRaceDataOpen] = useState(false);
  const [raceDataDetail, setRaceDataDetail] = useState<OfficialRaceData | null>(null);
  const [raceDataConfirm, setRaceDataConfirm] = useState<OfficialRaceData | null>(null);
  const [raceDataQuery, setRaceDataQuery] = useState("");
  const [raceDataPrefecture, setRaceDataPrefecture] = useState("");
  const [raceDataMonth, setRaceDataMonth] = useState("");
  const [raceDataAdvancedOpen, setRaceDataAdvancedOpen] = useState(false);
  const [raceDataCategory, setRaceDataCategory] = useState("");
  const [raceDataLimit, setRaceDataLimit] = useState("");
  const [raceDataMcc, setRaceDataMcc] = useState("");
  const [raceDataElevation, setRaceDataElevation] = useState("");
  const [raceDataDifficulty, setRaceDataDifficulty] = useState("");
  const [raceDataStatus, setRaceDataStatus] = useState("");
  const [planSavedMessage, setPlanSavedMessage] = useState("");
  const openingLogoX = useRef(new Animated.Value(-420)).current;
  const openingLogoOpacity = useRef(new Animated.Value(0)).current;
  const openingCopyOpacity = useRef(new Animated.Value(0)).current;
  const openingProgress = useRef(new Animated.Value(0)).current;

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
  const openingBackgroundSource = store.settings.openingBackgroundUri ? { uri: store.settings.openingBackgroundUri } : OPENING_BACKGROUND;
  const homeHeroImageSource = store.settings.homeHeroImageUri ? { uri: store.settings.homeHeroImageUri } : HOME_HERO_BACKGROUND;
  const advancedFeaturesEnabled = Boolean(store.settings.advancedFeaturesEnabled);
  const selectedRaceData = selectedRace?.raceDataId ? OFFICIAL_RACE_DATA.find((race) => race.id === selectedRace.raceDataId) : undefined;
  const raceDataResults = useMemo(() => {
    const query = raceDataQuery.trim().toLowerCase();
    return OFFICIAL_RACE_DATA.filter((race) => {
      const month = race.eventDate ? String(parseDateValue(race.eventDate).getMonth() + 1) : "";
      const matchQuery = !query || `${race.name} ${race.prefecture} ${race.city ?? ""}`.toLowerCase().includes(query);
      const matchPrefecture = !raceDataPrefecture || race.prefecture === raceDataPrefecture;
      const matchMonth = !raceDataMonth || month === raceDataMonth;
      const matchCategory = !raceDataCategory || race.category === raceDataCategory;
      const matchLimit = !raceDataLimit || (race.timeLimitMinutes ?? 0) <= n(raceDataLimit) * 60;
      const matchMcc = !raceDataMcc || (raceDataMcc === "yes" ? race.mccMember : !race.mccMember);
      const hasElevation = race.sections.some((section) => section.terrain !== "unknown" || section.elevationGainM != null || section.elevationLossM != null);
      const matchElevation = !raceDataElevation || (raceDataElevation === "yes" ? hasElevation : !hasElevation);
      const matchDifficulty = !raceDataDifficulty || race.courseDifficulty === raceDataDifficulty;
      const matchStatus = !raceDataStatus || race.verificationStatus === raceDataStatus;
      return matchQuery && matchPrefecture && matchMonth && matchCategory && matchLimit && matchMcc && matchElevation && matchDifficulty && matchStatus;
    });
  }, [raceDataCategory, raceDataDifficulty, raceDataElevation, raceDataLimit, raceDataMcc, raceDataMonth, raceDataPrefecture, raceDataQuery, raceDataStatus]);
  const coursePaceRows = useMemo(() => {
    if (!selectedRace || !selectedPlan || !selectedTargetSec) return [];
    return calculateFiveKmPacePlan({
      distanceKm: n(selectedRace.distanceKm),
      targetSeconds: Math.max(60, selectedTargetSec - totalStopSec),
      sections: selectedRaceData?.sections,
      strategy: selectedPlan.splitStrategy ?? defaultStrategyForPaceType(selectedPlan.paceType),
      splitDifferenceMinutes: splitDiffMinutes(selectedPlan),
      climbSecPerKm: n(store.settings.climbSec, 10),
      descentSecPerKm: n(store.settings.descentSec, -5)
    });
  }, [selectedRace, selectedPlan, selectedTargetSec, selectedRaceData, totalStopSec, store.settings.climbSec, store.settings.descentSec]);
  const trainingSummary = useMemo(() => summarizeTraining(store.trainingActivities), [store.trainingActivities]);
  const trainingScore = useMemo(
    () =>
      calculateReadinessScore({
        raceDistanceKm: selectedRace ? n(selectedRace.distanceKm) : undefined,
        summary: trainingSummary,
        targetPaceSec: basePace,
        minGateMarginSec: minMargin
      }),
    [trainingSummary, selectedRace?.distanceKm, basePace, minMargin]
  );
  const trainingPaceDiff = basePace && trainingSummary.last30AveragePaceSec ? trainingSummary.last30AveragePaceSec - basePace : null;
  const latestTrainingImport = [...store.trainingImportBatches].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  const recentTrainingActivities = useMemo(
    () => [...store.trainingActivities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50),
    [store.trainingActivities]
  );

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
    if (!ready || !showOpening) return;
    openingLogoX.setValue(-420);
    openingLogoOpacity.setValue(0);
    openingCopyOpacity.setValue(0);
    openingProgress.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(openingLogoOpacity, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.timing(openingLogoX, {
            toValue: 18,
            duration: 760,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(openingLogoX, {
            toValue: -8,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(openingLogoX, {
            toValue: 0,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          })
        ])
      ]),
      Animated.parallel([
        Animated.timing(openingCopyOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(openingProgress, {
          toValue: 1,
          duration: 1120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false
        })
      ])
    ]).start();
    const timer = setTimeout(() => setShowOpening(false), 2600);
    return () => clearTimeout(timer);
  }, [openingCopyOpacity, openingLogoOpacity, openingLogoX, openingProgress, ready, showOpening]);

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

  function registerRaceData(data: OfficialRaceData, mode: "add" | "update") {
    const dataYear = data.year == null ? "" : String(data.year);
    const existing = store.races.find((race) => (race.raceDataId === data.id || race.sourceRaceId === data.id) && (!dataYear || race.raceDataYear === dataYear || race.sourceRaceYear === dataYear));
    const id = mode === "update" && existing ? existing.id : uid();
    const source = data.sources[0];
    const nextRace: Race = {
      ...emptyRace,
      id,
      name: data.name,
      prefecture: data.prefecture,
      municipality: data.city ?? "",
      location: combineLocation(data.prefecture, data.city),
      date: data.eventDate ?? "",
      category: raceCategoryFromData(data.category),
      distanceKm: String(data.distanceKm),
      startTime: data.startTime ?? "",
      limitTime: data.timeLimitMinutes ? limitTimeFromMinutes(data.timeLimitMinutes) : "",
      lostTimeMin: existing?.lostTimeMin ?? emptyRace.lostTimeMin,
      officialUrl: source?.url ?? "",
      memo: [
        data.courseSummary,
        data.startLocation ? `スタート地点: ${data.startLocation}` : "",
        data.finishLocation ? `ゴール地点: ${data.finishLocation}` : "",
        ...(data.notes ?? []),
        `データ状態: ${raceDataStatusLabel(data.verificationStatus)}`,
        source ? `参照: ${source.title}（確認日 ${source.accessedAt}）` : ""
      ].filter(Boolean).join("\n"),
      raceDataId: data.id,
      raceDataYear: dataYear,
      raceDataStatus: data.verificationStatus,
      sourceRaceId: data.id,
      sourceRaceYear: dataYear,
      raceDataSnapshot: data,
      officialSourceTitle: source?.title ?? "",
      officialAccessedAt: source?.accessedAt ?? "",
      lastUsedAt: Date.now()
    };
    const nextGates = data.checkpoints
      .filter((checkpoint) => checkpoint.closingTime)
      .map((checkpoint) => ({
        id: uid(),
        raceId: id,
        name: checkpoint.name,
        distanceKm: String(checkpoint.distanceKm),
        gateTime: checkpoint.closingTime ?? "",
        memo: checkpoint.memo ?? ""
      }));
    const nextSegments = data.sections
      .filter((section) => section.terrain === "uphill" || section.terrain === "downhill" || section.terrain === "flat")
      .map((section) => {
        const terrain: ElevationSegment["terrain"] = section.terrain === "uphill" ? "上り" : section.terrain === "downhill" ? "下り" : "平坦";
        const adjustSecPerKm = terrain === "上り" ? store.settings.climbSec : terrain === "下り" ? store.settings.descentSec : store.settings.flatSec;
        return { id: uid(), raceId: id, startKm: String(section.startKm), endKm: String(section.endKm), terrain, adjustSecPerKm };
      });
    const planExists = store.plans.some((plan) => plan.raceId === id);
    const nextPlan: Plan | null = data.timeLimitMinutes ? { ...emptyPlan, id: uid(), raceId: id, targetTime: limitTimeFromMinutes(data.timeLimitMinutes), splitStrategy: "even", splitDifferenceMin: "0" } : null;
    updateStore({
      ...store,
      races: mode === "update" && existing ? store.races.map((race) => (race.id === id ? nextRace : race)) : [nextRace, ...store.races],
      gates: [...store.gates.filter((gate) => gate.raceId !== id), ...nextGates],
      segments: [...store.segments.filter((segment) => segment.raceId !== id), ...nextSegments],
      plans: planExists || !nextPlan ? store.plans : [...store.plans, nextPlan],
      selectedRaceId: id
    });
    setRaceForm(emptyRace);
    setRaceDataDetail(null);
    setRaceDataConfirm(null);
    setRaceDataOpen(false);
    setRaceSection("大会");
    setTab("大会");
  }

  function findExistingRaceDataRegistration(data: OfficialRaceData) {
    const dataYear = data.year == null ? "" : String(data.year);
    return store.races.find((race) => (race.raceDataId === data.id || race.sourceRaceId === data.id) && (!dataYear || race.raceDataYear === dataYear || race.sourceRaceYear === dataYear));
  }

  function raceDataMissingItems(data: OfficialRaceData) {
    return [
      data.eventDate ? "" : "開催日",
      data.startTime ? "" : "スタート時刻",
      data.timeLimitMinutes ? "" : "制限時間",
      data.checkpoints.length ? "" : "関門",
      data.sections.some((section) => section.terrain !== "unknown") ? "" : "高低差"
    ].filter(Boolean);
  }

  function raceDataHasElevation(data: OfficialRaceData) {
    return data.sections.some((section) => section.terrain !== "unknown");
  }

  function confirmRegisterRaceData(data: OfficialRaceData) {
    setRaceDataConfirm(data);
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

  function openTrainingImport() {
    setTrainingImportOpen(true);
    setTrainingImportMessage("");
    setTrainingFileName("");
    setTrainingCsvText("");
    setTrainingMapping({});
    setTrainingParseResult(null);
    setTrainingDuplicateMode("exclude");
  }

  function openManualTrainingEntry() {
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setManualTrainingForm({ ...emptyManualTrainingForm, date: localDate });
    setTrainingManualOpen(true);
    setTrainingImportMessage("");
  }

  function saveManualTrainingActivity() {
    const date = parseTrainingDate(manualTrainingForm.date);
    if (!date) {
      Alert.alert("日付形式を判定できません", "日付は 2026-07-01 のように入力してください。");
      return;
    }
    const distanceKm = parseTrainingDistance(manualTrainingForm.distanceKm, "距離(km)");
    if (!distanceKm) {
      Alert.alert("距離の単位を判定できません", "距離は km 単位の数字で入力してください。例: 5.2");
      return;
    }
    const durationSeconds = parseTrainingDuration(manualTrainingForm.duration, "other");
    if (!durationSeconds) {
      Alert.alert("時間形式を判定できません", "時間は 00:31:20 または 31:20 のように入力してください。");
      return;
    }
    const activityType = manualTrainingForm.activityType.trim() || "ランニング";
    const normalizedActivityType = normalizeActivityType(activityType);
    const averageHeartRate = manualTrainingForm.averageHeartRate.trim() ? Number(manualTrainingForm.averageHeartRate) : undefined;
    if (averageHeartRate != null && (!Number.isFinite(averageHeartRate) || averageHeartRate <= 0)) {
      Alert.alert("平均心拍を確認してください", "平均心拍は数字で入力してください。空欄でも保存できます。");
      return;
    }
    const averagePaceSecondsPerKm = calculateAveragePace(durationSeconds, distanceKm);
    if (averagePaceSecondsPerKm == null) {
      Alert.alert("平均ペースを計算できません", "距離と時間を確認してください。");
      return;
    }
    const importedAt = new Date().toISOString();
    const activity: TrainingActivity = {
      id: `manual-${uid()}`,
      date,
      activityType,
      normalizedActivityType,
      distanceKm,
      durationSeconds,
      averagePaceSecondsPerKm,
      averageHeartRate,
      sourceApp: "other",
      memo: manualTrainingForm.memo.trim(),
      importedAt,
      importBatchId: "manual"
    };
    updateStore({ ...store, trainingActivities: [activity, ...store.trainingActivities] });
    setTrainingManualOpen(false);
    setTrainingSection("概要");
    setTrainingImportMessage("手入力の練習を保存しました。");
  }

  async function chooseTrainingCsvFile() {
    try {
      const file = await pickCsvFile();
      if (!file) {
        Alert.alert("CSVファイルが選択されていません", "CSVを選択するとプレビューへ進めます。");
        return;
      }
      const result = parseTrainingCsv(file.text, trainingSourceApp, store.trainingActivities);
      setTrainingFileName(file.name ?? "training.csv");
      setTrainingCsvText(file.text);
      setTrainingMapping(result.mapping);
      setTrainingParseResult(result);
      setTrainingImportMessage(result.errors.length ? result.errors[0] : "CSVを読み込みました。列とプレビューを確認してください。");
    } catch {
      Alert.alert("ファイルを開けませんでした", "UTF-8のCSVファイルを選び直してください。");
    }
  }

  function updateTrainingMapping(field: keyof TrainingColumnMapping, column: string) {
    const nextMapping = { ...trainingMapping, [field]: column === "なし" ? undefined : column };
    setTrainingMapping(nextMapping);
    if (trainingCsvText) {
      const result = parseTrainingCsv(trainingCsvText, trainingSourceApp, store.trainingActivities, nextMapping);
      setTrainingParseResult(result);
    }
  }

  function confirmTrainingImport() {
    if (!trainingParseResult) {
      Alert.alert("CSVファイルが選択されていません", "先にCSVファイルを選択してください。");
      return;
    }
    if (trainingParseResult.limitExceededRows > 0) {
      Alert.alert("最大1,000件を超えています", "CSVを1,000件以下に分割してから取り込んでください。");
      return;
    }
    const importable = trainingParseResult.rows.filter((row) => row.activity && (row.status === "取込予定" || row.status === "主要集計対象外" || (trainingDuplicateMode === "all" && row.status === "重複候補")));
    if (!importable.length) {
      Alert.alert("取込対象データがありません", "列の割当てやCSVの内容を確認してください。");
      return;
    }
    const importedAt = new Date().toISOString();
    const batchId = uid();
    const activities = buildImportedActivities(trainingParseResult.rows, trainingSourceApp, importedAt, batchId, trainingDuplicateMode === "all");
    const batch = buildTrainingBatch(batchId, importedAt, trainingSourceApp, trainingFileName, trainingParseResult, activities.length);
    updateStore({
      ...store,
      trainingActivities: [...activities, ...store.trainingActivities],
      trainingImportBatches: [batch, ...store.trainingImportBatches]
    });
    setTrainingImportMessage(`${activities.length}件を取り込みました。`);
    setTrainingImportOpen(false);
    setTrainingSection("概要");
  }

  function deleteTrainingActivity(id: string) {
    Alert.alert("練習データ削除", "この練習データを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => updateStore({ ...store, trainingActivities: store.trainingActivities.filter((activity) => activity.id !== id) }) }
    ]);
  }

  function deleteTrainingBatch(batchId: string) {
    Alert.alert("取込履歴ごと削除", "この取込で追加された練習データをまとめて削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () =>
          updateStore({
            ...store,
            trainingActivities: store.trainingActivities.filter((activity) => activity.importBatchId !== batchId),
            trainingImportBatches: store.trainingImportBatches.filter((batch) => batch.id !== batchId)
          })
      }
    ]);
  }

  function clearTrainingData() {
    Alert.alert("練習データ削除", "取込済みの練習データと取込履歴をすべて削除しますか？大会データは残ります。", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => updateStore({ ...store, trainingActivities: [], trainingImportBatches: [] }) }
    ]);
  }

  function getCompactPaceRows() {
    const distance = n(selectedRace?.distanceKm ?? "0");
    const fiveKmRows = Array.from({ length: Math.floor(distance / 5) }, (_, index) => (index + 1) * 5)
      .map((km) => paceRows.find((row) => Math.abs(row.km - km) < 0.01))
      .filter(Boolean) as PaceRow[];
    const importantRows = paceRows.filter((row) => row.gate || row.stopSec > 0 || Math.abs(row.km - distance) < 0.01);
    return [...fiveKmRows, ...importantRows]
      .filter((row, index, rows) => rows.findIndex((item) => Math.abs(item.km - row.km) < 0.01 && item.gate?.id === row.gate?.id) === index)
      .sort((a, b) => a.km - b.km);
  }

  function getExportPaceRows() {
    return paceExportMode === "全距離" ? paceRows : getCompactPaceRows();
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
    const exportRows = getExportPaceRows();
    const lines = exportRows.map((row) => [
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
    const exportRows = getExportPaceRows();
    const rows = exportRows
      .map(
        (row) =>
          `<tr><td>${row.gate?.distanceKm ?? row.km}</td><td>${formatDuration(row.adjustedLapSec)}</td><td>${row.etaMinutes == null ? "-" : addMinutesToClock("00:00", row.etaMinutes)}</td><td>${row.gate?.gateTime ?? ""}</td><td>${formatMinutesLabel(row.gateMarginSec)}</td><td>${row.stopSec ? `+${row.stopSec}秒` : ""}</td><td>${[row.gate?.name, row.gate?.memo, row.stopMemo, row.manual ? "手動調整" : ""].filter(Boolean).join("<br>")}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:12mm}body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:#263238}h1{font-size:18px;margin:0 0 8px}.summary{margin:8px 0 12px;padding:8px;background:#f6f3ee;font-size:11px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #ccd6d0;padding:4px;text-align:left;vertical-align:top}th{background:#e9f1eb}@media print{body{margin:0}.summary{break-inside:avoid}tr{break-inside:avoid}}</style></head><body><h1>RUN Finish Planner</h1><div class="summary"><b>${selectedRace?.name ?? ""}</b><br>出力範囲 ${paceExportMode} / スタート ${selectedRace?.startTime ?? "-"} / ロスタイム ${selectedRace?.lostTimeMin ?? "0"}分 / 実走開始 ${getRealStartTime(selectedRace)} / 目標 ${goalTimeLabel} / 予測ゴール ${formatDurationJa(predictedOfficialGoalSec)} / 関門余裕 最小${formatMinutesLabel(minMargin)}</div><table><thead><tr><th>距離</th><th>予定ラップ</th><th>通過予定</th><th>関門時刻</th><th>関門余裕</th><th>給水/停止</th><th>メモ</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
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

  async function pickLocalImage(filePrefix: string) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("写真へのアクセス", "画像を選ぶには写真ライブラリへのアクセス許可が必要です。");
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.82
    });
    if (result.canceled || !result.assets[0]?.uri) return null;
    const pickedUri = result.assets[0].uri;
    let savedUri = pickedUri;
    if (Platform.OS !== "web" && FileSystem.documentDirectory) {
      const extension = pickedUri.split(".").pop()?.split("?")[0] || "jpg";
      savedUri = `${FileSystem.documentDirectory}${filePrefix}.${extension}`;
      await FileSystem.copyAsync({ from: pickedUri, to: savedUri });
    }
    return savedUri;
  }

  async function pickOpeningBackground() {
    const savedUri = await pickLocalImage("opening-background-custom");
    if (!savedUri) return;
    updateStore({ ...store, settings: { ...store.settings, openingBackgroundUri: savedUri } });
    Alert.alert("設定しました", "次回のオープニング背景に反映されます。");
  }

  function resetOpeningBackground() {
    updateStore({ ...store, settings: { ...store.settings, openingBackgroundUri: "" } });
    Alert.alert("標準に戻しました", "標準のオープニング背景画像を使います。");
  }

  async function pickHomeHeroImage() {
    const savedUri = await pickLocalImage("home-hero-custom");
    if (!savedUri) return;
    updateStore({ ...store, settings: { ...store.settings, homeHeroImageUri: savedUri } });
    Alert.alert("設定しました", "ホームの対象大会カードに反映されます。");
  }

  function resetHomeHeroImage() {
    updateStore({ ...store, settings: { ...store.settings, homeHeroImageUri: "" } });
    Alert.alert("標準に戻しました", "標準のホームヒーロー画像を使います。");
  }

  function clearAll() {
    Alert.alert("全データ削除", "スマホ内保存データを削除します。", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => updateStore({ ...createInitialStore(), races: [], gates: [], segments: [], stops: [], manualLaps: [], plans: [], pbs: [], pastRaces: [], trainingActivities: [], trainingImportBatches: [], selectedRaceId: undefined }) }
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
        <View style={styles.header}>
          <Text style={styles.appName}>CHEBIS RUN</Text>
          <Text style={styles.appSub}>関門時間から完走ペースを逆算</Text>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {tab === "ホーム" && renderHome()}
          {tab === "大会" && renderRaceTab()}
          {tab === "プラン" && renderPlanTab()}
          {tab === "練習分析" && renderTrainingAnalysis()}
          {tab === "設定" && renderSettingsTab()}
        </ScrollView>
        <View style={styles.tabbar}>
          {["ホーム", "大会", "プラン", "練習分析", "設定"].map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tabButton, tab === item && styles.tabButtonActive]}>
              <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        {renderRaceDataSearchModal()}
        {renderRaceDataConfirmModal()}
        {showOpening && renderOpening()}
      </View>
    </SafeAreaView>
  );

  function renderOpening() {
    const progressWidth = openingProgress.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"]
    });

    return (
      <Pressable style={styles.openingScreen} onPress={() => setShowOpening(false)}>
        <Image source={openingBackgroundSource} style={styles.openingImage} resizeMode="cover" />
        <View style={styles.openingShade} />
        <View style={styles.openingCenter}>
          <Animated.Image
            source={OPENING_LOGO}
            style={[
              styles.openingLogo,
              {
                opacity: openingLogoOpacity,
                transform: [{ translateX: openingLogoX }]
              }
            ]}
            resizeMode="contain"
          />
          <Animated.Text style={[styles.openingCopy, { opacity: openingCopyOpacity }]}>関門時間から完走ペースを逆算</Animated.Text>
        </View>
        <View style={styles.openingBottom}>
          <View style={styles.openingProgressTrack}>
            <Animated.View style={[styles.openingProgressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.openingBottomText}>Preparing your race plan...</Text>
          <Text style={styles.openingSkipText}>タップでスキップ</Text>
        </View>
      </Pressable>
    );
  }

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
            <Image source={homeHeroImageSource} style={styles.raceFocusImage} resizeMode="cover" />
            <View style={styles.raceFocusShade} />
            <View style={styles.raceFocusContent}>
              <Text style={styles.darkLabel}>対象大会</Text>
              <Text style={styles.darkRaceTitle}>{selectedRace?.name || "大会未登録"}</Text>
              {selectedRace ? (
                <>
                  <Text style={styles.darkRaceMeta}>日付 {selectedRace.date || "-"}</Text>
                  <Text style={styles.darkRaceMeta}>場所 {selectedRace.location || "-"}</Text>
                </>
              ) : (
                <Text style={styles.darkRaceMeta}>大会登録タブから追加してください</Text>
              )}
            </View>
            <Text style={styles.raceFocusArrow}>›</Text>
          </View>

          <View style={styles.homeRaceSelector}>
            <Text style={styles.homeMetricLabel}>対象大会を選択</Text>
            <Text style={styles.helpText}>ここで選んだ大会が、ホーム・大会・プラン・練習分析に反映されます。</Text>
            <RacePicker races={raceOptions} selectedId={selectedRaceId} onSelect={selectRace} />
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

  function renderTrainingAnalysis() {
    const scoreDetailsOpen = trainingSection === "スコア";
    return (
      <>
        <Card>
          <Text style={styles.sectionTitle}>練習分析</Text>
          <Text style={styles.body}>取込済みデータ {store.trainingActivities.length}件 / 最終取込 {latestTrainingImport ? formatDateTime(latestTrainingImport.importedAt) : "未取込"}</Text>
          <Text style={styles.helpText}>練習データはこの端末内に保存され、CSVデータを外部サーバーへ送信しません。元CSVファイル全体は保存しません。</Text>
          <View style={styles.rowGap}>
            <PrimaryButton label="CSVを取り込む" onPress={openTrainingImport} />
            <SecondaryButton label="練習を手入力" onPress={openManualTrainingEntry} />
            <SecondaryButton label="取込方法を見る" onPress={() => setTrainingGuideOpen(true)} />
          </View>
          {!!trainingImportMessage && <Text style={styles.savedText}>{trainingImportMessage}</Text>}
        </Card>
        <Segment value={trainingSection} values={["概要", "履歴", "管理", "スコア"]} onChange={setTrainingSection} />
        {trainingSection === "概要" && (
          <>
            {renderTrainingComparisonCard()}
            <View style={styles.grid2}>
              <Metric label="今週の走行距離" value={`${formatKm(trainingSummary.weekDistanceKm)}km`} />
              <Metric label="今月の走行距離" value={`${formatKm(trainingSummary.monthDistanceKm)}km`} />
              <Metric label="直近30日" value={`${formatKm(trainingSummary.last30DistanceKm)}km`} />
              <Metric label="直近90日" value={`${formatKm(trainingSummary.last90DistanceKm)}km`} />
              <Metric label="練習回数（30日）" value={`${trainingSummary.last30Count}回`} />
              <Metric label="平均ペース（30日）" value={formatPace(trainingSummary.last30AveragePaceSec)} />
              <Metric label="最長走行距離" value={`${formatKm(trainingSummary.allLongestDistanceKm)}km`} />
              <Metric label="完走準備度" value={`${trainingScore.total}点 ${trainingScore.label}`} />
            </View>
            <Card>
              <Text style={styles.sectionTitle}>直近練習データ</Text>
              <Text style={styles.helpText}>直近50件まで表示します。ランニング以外のデータは主要集計に含まれません。</Text>
              {recentTrainingActivities.length ? recentTrainingActivities.map((activity) => (
                <View key={activity.id} style={styles.trainingActivityCard}>
                  <View style={styles.listText}>
                    <Text style={styles.listTitle}>{activity.date} / {activity.activityType}</Text>
                    <Text style={styles.muted}>{formatKm(activity.distanceKm)}km / {formatDuration(activity.durationSeconds)} / {formatPace(activity.averagePaceSecondsPerKm)} / 心拍 {activity.averageHeartRate ?? "-"} / {sourceAppLabel(activity.sourceApp)}</Text>
                  </View>
                  <DangerButton label="削除" onPress={() => deleteTrainingActivity(activity.id)} />
                </View>
              )) : <Text style={styles.muted}>まだ練習データがありません。</Text>}
            </Card>
          </>
        )}
        {trainingSection === "履歴" && (
          <Card>
            <Text style={styles.sectionTitle}>CSV取込履歴</Text>
            {store.trainingImportBatches.length ? store.trainingImportBatches.map((batch) => (
              <View key={batch.id} style={styles.trainingActivityCard}>
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>{formatDateTime(batch.importedAt)} / {sourceAppLabel(batch.sourceApp)}</Text>
                  <Text style={styles.muted}>{batch.fileName ?? "-"} / 取込 {batch.importedRows}件 / 除外 {batch.excludedRows}件 / 重複 {batch.duplicateRows}件</Text>
                </View>
                <DangerButton label="履歴ごと削除" onPress={() => deleteTrainingBatch(batch.id)} />
              </View>
            )) : <Text style={styles.muted}>取込履歴はありません。</Text>}
          </Card>
        )}
        {trainingSection === "管理" && (
          <Card>
            <Text style={styles.sectionTitle}>練習データ管理</Text>
            <Text style={styles.body}>練習データは端末内に保存されます。ブラウザデータ削除や端末変更により失われる場合があります。バックアップ機能を使うと練習データも含めて保存できます。</Text>
            <Text style={styles.noticeText}>本アプリはGarmin、Strava、ASICS Runkeeperおよび各大会主催者の公式アプリではなく、各社との提携・承認を示すものではありません。</Text>
            <DangerButton label="練習データをすべて削除" onPress={clearTrainingData} />
          </Card>
        )}
        {scoreDetailsOpen && (
          <Card>
            <Text style={styles.sectionTitle}>完走準備度スコア内訳</Text>
            <Text style={styles.body}>練習量と登録済み大会プランを比較した参考値です。完走や健康状態を保証するものではありません。</Text>
            <View style={styles.grid2}>
              <Metric label="直近30日走行距離" value={`${trainingScore.details.last30Distance}点`} />
              <Metric label="直近90日走行距離" value={`${trainingScore.details.last90Distance}点`} />
              <Metric label="最長走行距離" value={`${trainingScore.details.longestDistance}点`} />
              <Metric label="練習回数" value={`${trainingScore.details.trainingCount}点`} />
              <Metric label="目標ペースとの差" value={`${trainingScore.details.paceDiff}点`} />
              <Metric label="関門余裕" value={`${trainingScore.details.gateMargin}点`} />
            </View>
            <Text style={styles.sectionTitle}>改善ヒント</Text>
            {trainingScore.suggestions.length ? trainingScore.suggestions.map((suggestion) => <Text key={suggestion} style={styles.body}>・{suggestion}</Text>) : <Text style={styles.muted}>現在のデータでは大きな注意点はありません。</Text>}
          </Card>
        )}
        {renderTrainingImportModal()}
        {renderManualTrainingModal()}
        {renderTrainingGuideModal()}
      </>
    );
  }

  function renderTrainingComparisonCard() {
    if (!selectedRace) {
      return (
        <Card>
          <Text style={styles.sectionTitle}>大会プランとの比較</Text>
          <Text style={styles.body}>大会を登録すると、練習実績と目標ペースを比較できます。</Text>
        </Card>
      );
    }
    const daysLabel = raceDaysLabel(selectedRace.date);
    return (
      <Card>
        <Text style={styles.sectionTitle}>大会プランとの比較</Text>
        <Text style={styles.heroTitle}>{selectedRace.name}</Text>
        <Text style={styles.body}>{selectedRace.date || "日付未設定"} / {daysLabel}</Text>
        <View style={styles.grid2}>
          <Metric label="目標ゴールタイム" value={goalTimeLabel} />
          <Metric label="目標平均ペース" value={formatPace(basePace)} />
          <Metric label="30日平均ペース" value={formatPace(trainingSummary.last30AveragePaceSec)} />
          <Metric label="ペース差" value={paceDifferenceLabel(trainingPaceDiff)} />
          <Metric label="30日走行距離" value={`${formatKm(trainingSummary.last30DistanceKm)}km`} />
          <Metric label="90日走行距離" value={`${formatKm(trainingSummary.last90DistanceKm)}km`} />
          <Metric label="最長走行距離" value={`${formatKm(trainingSummary.allLongestDistanceKm)}km`} />
          <Metric label="最小関門余裕" value={formatMinutesLabel(minMargin)} />
        </View>
        <View style={styles.judgementBox}>
          <Text style={styles.homeMetricLabel}>完走準備度スコア</Text>
          <Text style={styles.judgementText}>{trainingScore.total}点 / {trainingScore.label}</Text>
          <Text style={styles.helpText}>練習全体の平均ペースと大会ペースを比較した参考値です。ゆっくり走る練習も含まれます。</Text>
        </View>
      </Card>
    );
  }

  function renderTrainingImportModal() {
    const result = trainingParseResult;
    const planned = result?.rows.filter((row) => row.status === "取込予定" || row.status === "主要集計対象外").length ?? 0;
    const duplicates = result?.rows.filter((row) => row.status === "重複候補").length ?? 0;
    const excluded = result ? result.rows.filter((row) => row.status === "除外" || row.status === "要確認").length + result.limitExceededRows : 0;
    const previewRows = result?.rows.slice(0, 50) ?? [];
    const headerOptions = ["なし", ...(result?.headers ?? [])];
    return (
      <Modal visible={trainingImportOpen} animationType="slide" onRequestClose={() => setTrainingImportOpen(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalPage}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>CSV取込み</Text>
              <Pressable onPress={() => setTrainingImportOpen(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>閉じる</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalPageInner} keyboardShouldPersistTaps="handled">
              <Text style={styles.helpText}>1 取込元選択 → 2 ファイル選択 → 3 列確認 → 4 プレビュー → 5 取込結果</Text>
              <Card>
                <Text style={styles.sectionTitle}>1. 取込元</Text>
                <Segment value={trainingSourceApp} values={["garmin", "runkeeper", "strava", "other"]} labelForValue={sourceAppLabel} onChange={(value) => {
                  const source = value as TrainingSourceApp;
                  setTrainingSourceApp(source);
                  if (trainingCsvText) {
                    const parsed = parseTrainingCsv(trainingCsvText, source, store.trainingActivities, trainingMapping);
                    setTrainingParseResult(parsed);
                  }
                }} />
                <Text style={styles.helpText}>サービス名はCSV取込元の識別目的だけで使用します。</Text>
                <PrimaryButton label="CSVファイルを選択" onPress={chooseTrainingCsvFile} />
                <Text style={styles.body}>選択中: {trainingFileName || "未選択"}</Text>
              </Card>
              {result && (
                <>
                  <Card>
                    <Text style={styles.sectionTitle}>2. 列確認</Text>
                    <Text style={styles.body}>認識した列: {result.recognizedColumns.join(" / ") || "なし"}</Text>
                    <SelectField label="日付" value={trainingMapping.date ?? ""} options={headerOptions} onSelect={(v) => updateTrainingMapping("date", v)} />
                    <SelectField label="距離" value={trainingMapping.distance ?? ""} options={headerOptions} onSelect={(v) => updateTrainingMapping("distance", v)} />
                    <SelectField label="時間" value={trainingMapping.duration ?? ""} options={headerOptions} onSelect={(v) => updateTrainingMapping("duration", v)} />
                    <SelectField label="種目" value={trainingMapping.activityType ?? ""} options={headerOptions} onSelect={(v) => updateTrainingMapping("activityType", v)} />
                    <SelectField label="平均心拍（任意）" value={trainingMapping.heartRate ?? "なし"} options={headerOptions} onSelect={(v) => updateTrainingMapping("heartRate", v)} />
                    <SelectField label="メモ（任意）" value={trainingMapping.memo ?? "なし"} options={headerOptions} onSelect={(v) => updateTrainingMapping("memo", v)} />
                  </Card>
                  <Card>
                    <Text style={styles.sectionTitle}>3. プレビュー</Text>
                    <View style={styles.grid2}>
                      <Metric label="CSV総行数" value={`${result.totalRows}件`} />
                      <Metric label="取込予定" value={`${planned}件`} />
                      <Metric label="除外" value={`${excluded}件`} />
                      <Metric label="重複候補" value={`${duplicates}件`} />
                      <Metric label="上限超過" value={`${result.limitExceededRows}件`} />
                    </View>
                    {result.limitExceededRows > 0 && <Text style={styles.noticeText}>1,000件制限により {result.limitExceededRows}件が対象外です。CSVを分割してください。</Text>}
                    {result.errors.map((error) => <Text key={error} style={styles.noticeText}>{error}</Text>)}
                    {previewRows.map((row) => <TrainingPreviewCard key={row.index} row={row} source={trainingSourceApp} />)}
                  </Card>
                  <Card>
                    <Text style={styles.sectionTitle}>4. 重複時の処理</Text>
                    <Segment value={trainingDuplicateMode} values={["exclude", "all"]} labelForValue={(value) => value === "exclude" ? "重複を除外" : "すべて取込"} onChange={(value) => setTrainingDuplicateMode(value as "exclude" | "all")} />
                    <View style={styles.buttonRow}>
                      <PrimaryButton label="取込みを確定" onPress={confirmTrainingImport} />
                      <SecondaryButton label="キャンセル" onPress={() => setTrainingImportOpen(false)} />
                    </View>
                  </Card>
                </>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  function renderManualTrainingModal() {
    return (
      <Modal visible={trainingManualOpen} animationType="slide" onRequestClose={() => setTrainingManualOpen(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalPage}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>練習を手入力</Text>
              <Pressable onPress={() => setTrainingManualOpen(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>閉じる</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalPageInner} keyboardShouldPersistTaps="handled">
              <Card>
                <Text style={styles.sectionTitle}>1回分の練習を追加</Text>
                <Text style={styles.body}>CSVを用意できない場合でも、スマホから練習記録を手入力できます。保存後は練習分析の集計に反映されます。</Text>
                <Input label="日付" value={manualTrainingForm.date} onChangeText={(v) => setField(setManualTrainingForm, "date", v)} placeholder="2026-07-01" />
                <SelectField
                  label="種目"
                  value={manualTrainingForm.activityType}
                  options={["ランニング", "ウォーキング", "自転車", "水泳", "その他"]}
                  onSelect={(value) => setField(setManualTrainingForm, "activityType", value)}
                />
                <Input label="距離 km" value={manualTrainingForm.distanceKm} onChangeText={(v) => setField(setManualTrainingForm, "distanceKm", v)} keyboardType="decimal-pad" placeholder="5.2" />
                <Input label="時間" value={manualTrainingForm.duration} onChangeText={(v) => setField(setManualTrainingForm, "duration", v)} placeholder="00:31:20" />
                <Input label="平均心拍（任意）" value={manualTrainingForm.averageHeartRate} onChangeText={(v) => setField(setManualTrainingForm, "averageHeartRate", v)} keyboardType="number-pad" placeholder="142" />
                <Input label="メモ（任意）" value={manualTrainingForm.memo} onChangeText={(v) => setField(setManualTrainingForm, "memo", v)} placeholder="ゆっくり走、ペース走など" multiline />
                <Text style={styles.helpText}>平均ペースは距離と時間から自動計算します。ランニング以外は保存できますが、主要集計には含まれません。</Text>
                <View style={styles.buttonRow}>
                  <PrimaryButton label="保存する" onPress={saveManualTrainingActivity} />
                  <SecondaryButton label="キャンセル" onPress={() => setTrainingManualOpen(false)} />
                </View>
              </Card>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  function renderTrainingGuideModal() {
    return (
      <Modal visible={trainingGuideOpen} animationType="slide" onRequestClose={() => setTrainingGuideOpen(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalPage}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>取込方法ガイド</Text>
              <Pressable onPress={() => setTrainingGuideOpen(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>閉じる</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalPageInner}>
              <Card><Text style={styles.sectionTitle}>Garmin</Text><Text style={styles.body}>Garmin ConnectのWeb版からアクティビティデータを書き出し、保存したCSVをこのアプリから選択します。</Text></Card>
              <Card><Text style={styles.sectionTitle}>ASICS Runkeeper</Text><Text style={styles.body}>RunkeeperのWeb版でデータ書き出しを行い、書き出したCSVを端末へ保存して選択します。</Text></Card>
              <Card><Text style={styles.sectionTitle}>Strava</Text><Text style={styles.body}>StravaのWeb版でデータエクスポートを行い、エクスポートデータ内のCSVを端末へ保存して選択します。</Text></Card>
              <Card><Text style={styles.sectionTitle}>その他</Text><Text style={styles.body}>日付、距離、時間、種目を含むCSVを用意してください。列名が異なる場合は取込画面で割り当てできます。平均ペースはアプリ内で自動計算します。</Text></Card>
              <Text style={styles.noticeText}>各サービスの画面や書き出し方法は変更される場合があります。最新の方法は各サービスの公式ヘルプをご確認ください。</Text>
              <Text style={styles.noticeText}>本アプリはGarmin、Strava、ASICS Runkeeperおよび各大会主催者の公式アプリではなく、各社との提携・承認を示すものではありません。</Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  function renderRaceDataSearchModal() {
    const selectedDetail = raceDataDetail;
    return (
      <Modal visible={raceDataOpen} animationType="slide" onRequestClose={() => setRaceDataOpen(false)}>
        <SafeAreaView style={styles.modalPage}>
          <ScrollView style={styles.content} contentContainerStyle={styles.modalPageInner} keyboardShouldPersistTaps="handled">
            <Card>
              <View style={styles.paceHead}>
                <View style={styles.listText}>
                  <Text style={styles.sectionTitle}>大会データから選ぶ</Text>
                  <Text style={styles.body}>公式サイトや公式PDFで確認できる範囲だけを、試験版データとして登録できます。</Text>
                </View>
                <SecondaryButton label="閉じる" onPress={() => {
                  setRaceDataDetail(null);
                  setRaceDataOpen(false);
                }} />
              </View>
            </Card>
            {selectedDetail ? (
              <>
                <Card>
                  <Text style={styles.sectionTitle}>{selectedDetail.name}</Text>
                  <Text style={styles.heroTitle}>{raceDataStatusLabel(selectedDetail.verificationStatus)}</Text>
                  <Text style={styles.body}>{selectedDetail.prefecture} {selectedDetail.city ?? ""} / 年度 {selectedDetail.year ?? "未登録"} / {selectedDetail.eventDate ?? "開催日未登録"} / {raceDataCategoryLabel(selectedDetail.category)} {selectedDetail.distanceKm}km</Text>
                  <Text style={styles.helpText}>スタート時刻 {selectedDetail.startTime ?? "未登録"} / 制限 {selectedDetail.timeLimitMinutes ? formatDurationJa(selectedDetail.timeLimitMinutes * 60) : "未登録"} / スタート方式 {selectedDetail.startType === "wave" ? "ウェーブ" : selectedDetail.startType === "single" ? "一斉" : "不明"}</Text>
                  <Text style={styles.helpText}>スタート地点 {selectedDetail.startLocation ?? "未登録"} / ゴール地点 {selectedDetail.finishLocation ?? "未登録"} / 難易度 {raceDataDifficultyLabel(selectedDetail.courseDifficulty)}</Text>
                  {selectedDetail.verificationStatus !== "verified" && (
                    <Text style={styles.noticeText}>注意: この大会データには一部確認中または試算の項目があります。登録後も必ず公式サイトで確認してください。</Text>
                  )}
                  <Text style={styles.body}>{selectedDetail.courseSummary}</Text>
                  <Text style={styles.noticeText}>本アプリは大会主催者が運営または公認する公式サービスではありません。大会要項やコースは変更される場合があります。参加前に必ず大会公式サイトで最新情報をご確認ください。</Text>
                </Card>
                <Card>
                  <Text style={styles.sectionTitle}>関門</Text>
                  {selectedDetail.checkpoints.map((checkpoint) => (
                    <View key={checkpoint.id} style={styles.courseMiniCard}>
                      <Text style={styles.listTitle}>{checkpoint.name} / {checkpoint.distanceKm}km</Text>
                      <Text style={styles.muted}>関門時刻 {checkpoint.closingTime ?? "-"} / {checkpoint.memo ?? "-"}</Text>
                    </View>
                  ))}
                </Card>
                <Card>
                  <Text style={styles.sectionTitle}>5kmごとのコース特性</Text>
                  <Text style={styles.helpText}>公式高低図などを元にした目安です。数値化済みの公式データではない場合があります。</Text>
                  {selectedDetail.sections.map((section) => (
                    <View key={`${section.startKm}-${section.endKm}`} style={styles.courseMiniCard}>
                      <Text style={styles.listTitle}>{section.startKm} - {section.endKm}km / {terrainLabel(section.terrain)}</Text>
                      <Text style={styles.muted}>{section.description ?? "データなし"} / 上昇 {section.elevationGainM ?? "データなし"} / 下降 {section.elevationLossM ?? "データなし"} / 信頼度 {section.confidence ?? "unknown"}</Text>
                    </View>
                  ))}
                </Card>
                <Card>
                  <Text style={styles.sectionTitle}>給水・サポート地点</Text>
                  {selectedDetail.waterStations?.length ? selectedDetail.waterStations.map((station) => (
                    <View key={`${station.distanceKm}-${station.name ?? "water"}`} style={styles.courseMiniCard}>
                      <Text style={styles.listTitle}>{station.distanceKm}km / 給水</Text>
                      <Text style={styles.muted}>{station.name ?? "地点名未登録"} / 信頼度 {station.confidence ?? "unknown"}</Text>
                    </View>
                  )) : null}
                  {selectedDetail.supportPoints?.length ? selectedDetail.supportPoints.map((point) => (
                    <View key={`${point.type}-${point.distanceKm}-${point.name}`} style={styles.courseMiniCard}>
                      <Text style={styles.listTitle}>{point.distanceKm}km / {point.type === "retire-bus" ? "リタイアバス" : point.type === "medical" ? "救護" : "サポート"}</Text>
                      <Text style={styles.muted}>{point.name} / 信頼度 {point.confidence ?? "unknown"}</Text>
                    </View>
                  )) : null}
                  {!selectedDetail.waterStations?.length && !selectedDetail.supportPoints?.length && <Text style={styles.muted}>データなし</Text>}
                </Card>
                <Card>
                  <Text style={styles.sectionTitle}>公式情報リンク</Text>
                  {selectedDetail.sources.map((source) => (
                    <View key={`${source.title}-${source.url}`} style={styles.courseMiniCard}>
                      <Text style={styles.listTitle}>{source.title}</Text>
                      <Text style={styles.muted}>{source.url}</Text>
                      <Text style={styles.helpText}>確認日: {source.accessedAt}</Text>
                    </View>
                  ))}
                  {!!selectedDetail.notes?.length && selectedDetail.notes.map((note) => <Text key={note} style={styles.helpText}>・{note}</Text>)}
                </Card>
                <View style={styles.buttonRow}>
                  <SecondaryButton label="検索結果へ戻る" onPress={() => setRaceDataDetail(null)} />
                  <PrimaryButton label="この大会を登録" onPress={() => confirmRegisterRaceData(selectedDetail)} />
                </View>
              </>
            ) : (
              <>
                <Card>
                  <Input label="大会名検索" value={raceDataQuery} onChangeText={setRaceDataQuery} placeholder="例: NAHA" />
                  <SelectField
                    label="都道府県"
                    value={raceDataPrefecture || "すべて"}
                    options={["すべて", ...PREFECTURES]}
                    pickerId="race-data-prefecture"
                    activePicker={activePicker}
                    setActivePicker={setActivePicker}
                    onSelect={(value) => setRaceDataPrefecture(value === "すべて" ? "" : value)}
                  />
                  <SelectField
                    label="開催月"
                    value={raceDataMonth || "すべて"}
                    options={["すべて", ...RACE_DATA_MONTH_OPTIONS.filter(Boolean)]}
                    displayValue={(value) => value === "すべて" ? value : `${value}月`}
                    pickerId="race-data-month"
                    activePicker={activePicker}
                    setActivePicker={setActivePicker}
                    onSelect={(value) => setRaceDataMonth(value === "すべて" ? "" : value)}
                  />
                  <SecondaryButton label={raceDataAdvancedOpen ? "詳細条件を閉じる" : "詳細条件を開く"} onPress={() => setRaceDataAdvancedOpen((current) => !current)} />
                  {raceDataAdvancedOpen && (
                    <View style={styles.advancedPanel}>
                      <SelectField
                        label="大会種別"
                        value={raceDataCategory || "すべて"}
                        options={RACE_DATA_CATEGORY_OPTIONS.map((value) => value || "すべて")}
                        displayValue={raceDataCategoryLabel}
                        pickerId="race-data-category"
                        activePicker={activePicker}
                        setActivePicker={setActivePicker}
                        onSelect={(value) => setRaceDataCategory(value === "すべて" ? "" : value)}
                      />
                      <Input label="制限時間 以下（時間）" value={raceDataLimit} onChangeText={setRaceDataLimit} keyboardType="decimal-pad" placeholder="例: 7" />
                      <SelectField
                        label="MCC加盟"
                        value={raceDataMcc === "yes" ? "加盟" : raceDataMcc === "no" ? "非加盟" : "すべて"}
                        options={["すべて", "加盟", "非加盟"]}
                        pickerId="race-data-mcc"
                        activePicker={activePicker}
                        setActivePicker={setActivePicker}
                        onSelect={(value) => setRaceDataMcc(value === "加盟" ? "yes" : value === "非加盟" ? "no" : "")}
                      />
                      <SelectField
                        label="高低差データ"
                        value={raceDataElevation === "yes" ? "あり" : raceDataElevation === "no" ? "なし" : "すべて"}
                        options={["すべて", "あり", "なし"]}
                        pickerId="race-data-elevation"
                        activePicker={activePicker}
                        setActivePicker={setActivePicker}
                        onSelect={(value) => setRaceDataElevation(value === "あり" ? "yes" : value === "なし" ? "no" : "")}
                      />
                      <SelectField
                        label="コース難易度"
                        value={raceDataDifficulty || "すべて"}
                        options={RACE_DATA_DIFFICULTY_OPTIONS.map((value) => value || "すべて")}
                        displayValue={raceDataDifficultyLabel}
                        pickerId="race-data-difficulty"
                        activePicker={activePicker}
                        setActivePicker={setActivePicker}
                        onSelect={(value) => setRaceDataDifficulty(value === "すべて" ? "" : value)}
                      />
                      <SelectField
                        label="データ確認状態"
                        value={raceDataStatus || "すべて"}
                        options={RACE_DATA_STATUS_OPTIONS.map((value) => value || "すべて")}
                        displayValue={raceDataStatusLabel}
                        pickerId="race-data-status"
                        activePicker={activePicker}
                        setActivePicker={setActivePicker}
                        onSelect={(value) => setRaceDataStatus(value === "すべて" ? "" : value)}
                      />
                    </View>
                  )}
                  <Text style={styles.helpText}>現在は少数の静的データで試験中です。MCC加盟大会すべての自動取得やスクレイピングは行いません。</Text>
                </Card>
                <Text style={styles.sectionCaption}>検索結果 {raceDataResults.length}件</Text>
                {raceDataResults.map((race) => (
                  <View key={race.id} style={styles.raceDataCard}>
                    <View style={styles.raceCardHead}>
                      <Text style={styles.listTitle}>{race.name}</Text>
                      <Text style={[styles.usingBadge, race.verificationStatus !== "verified" && styles.warningBadge]}>{raceDataStatusLabel(race.verificationStatus)}</Text>
                    </View>
                    <Text style={styles.muted}>{race.prefecture} {race.city ?? ""} / 年度 {race.year ?? "未登録"} / {race.eventDate ?? "開催日未登録"} / {raceDataCategoryLabel(race.category)} {race.distanceKm}km</Text>
                    <Text style={styles.muted}>制限 {race.timeLimitMinutes ? formatDurationJa(race.timeLimitMinutes * 60) : "未登録"} / 関門 {race.checkpoints.length}か所 / 高低差 {race.sections.some((section) => section.terrain !== "unknown") ? "あり" : "データなし"} / コース {raceDataDifficultyLabel(race.courseDifficulty)}</Text>
                    <Text style={styles.helpText}>確認日 {race.verifiedAt ?? "-"} / 公式情報リンクあり</Text>
                    <View style={styles.buttonRow}>
                      <SecondaryButton label="詳細を見る" onPress={() => setRaceDataDetail(race)} />
                      <PrimaryButton label="この大会を登録" onPress={() => confirmRegisterRaceData(race)} />
                    </View>
                  </View>
                ))}
                {!raceDataResults.length && <Card><Text style={styles.body}>条件に合う大会データがありません。条件を減らすか、自分で入力してください。</Text></Card>}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  function renderRaceDataConfirmModal() {
    const data = raceDataConfirm;
    if (!data) return null;
    const existing = findExistingRaceDataRegistration(data);
    const missingItems = raceDataMissingItems(data);
    const warning = data.verificationStatus === "verified"
      ? "公式情報として確認済みの範囲を大会登録へ反映します。"
      : "未確認または一部確認済みの項目があります。登録後も公式サイトで必ず確認してください。";

    return (
      <Modal visible={!!data} transparent animationType="fade" onRequestClose={() => setRaceDataConfirm(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmSheet}>
            <ScrollView contentContainerStyle={styles.confirmSheetInner}>
              <Text style={styles.sectionTitle}>{existing ? "登録済みの大会です" : "登録内容を確認"}</Text>
              <Text style={styles.heroTitle}>{data.name}</Text>
              <Text style={styles.body}>{data.prefecture} {data.city ?? ""} / 年度 {data.year ?? "未登録"} / {data.eventDate ?? "開催日未登録"}</Text>
              <View style={styles.courseMiniCard}>
                <Text style={styles.listTitle}>登録される内容</Text>
                <Text style={styles.muted}>種目: {raceDataCategoryLabel(data.category)} {data.distanceKm}km</Text>
                <Text style={styles.muted}>スタート: {data.startTime ?? "未登録"} / 制限: {data.timeLimitMinutes ? formatDurationJa(data.timeLimitMinutes * 60) : "未登録"}</Text>
                <Text style={styles.muted}>関門: {data.checkpoints.length}件 / 高低差: {raceDataHasElevation(data) ? "あり" : "データなし"}</Text>
                <Text style={styles.muted}>未確認項目: {missingItems.length ? missingItems.join("、") : "なし"}</Text>
              </View>
              {existing && (
                <Text style={styles.noticeText}>すでに同じ大会データから登録した大会があります。既存登録を更新するか、別大会として追加できます。</Text>
              )}
              <Text style={styles.noticeText}>{warning}</Text>
              <Text style={styles.helpText}>本アプリは大会主催者が運営または公認する公式サービスではありません。参加前に必ず大会公式サイトで最新情報をご確認ください。</Text>
            </ScrollView>
            <View style={styles.confirmButtonRow}>
              <SecondaryButton label="キャンセル" onPress={() => setRaceDataConfirm(null)} />
              {existing ? (
                <>
                  <SecondaryButton label="別大会として追加" onPress={() => registerRaceData(data, "add")} />
                  <PrimaryButton label="既存登録を更新" onPress={() => registerRaceData(data, "update")} />
                </>
              ) : (
                <PrimaryButton label="この内容で登録する" onPress={() => registerRaceData(data, "add")} />
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  function renderSelectedRaceContext(label: string) {
    if (!selectedRace) {
      return (
        <Card>
          <Text style={styles.sectionTitle}>{label}</Text>
          <Text style={styles.body}>大会が未選択です。ホームまたは大会一覧から対象大会を選んでください。</Text>
        </Card>
      );
    }
    return (
      <View style={styles.contextCard}>
        <Text style={styles.contextLabel}>{label}</Text>
        <Text style={styles.contextTitle}>{selectedRace.name}</Text>
        <Text style={styles.contextMeta}>{selectedRace.date || "日付未設定"} / {combineLocation(selectedRace.prefecture, selectedRace.municipality, selectedRace.location) || "開催地未設定"} / {selectedRace.distanceKm || "-"}km</Text>
        <Text style={styles.contextMeta}>開始 {selectedRace.startTime || "-"} / ロスタイム {selectedRace.lostTimeMin ?? "0"}分 / 制限ゴール {getLimitGoalTime(selectedRace)}</Text>
      </View>
    );
  }

  function renderRaceTab() {
    const raceSections = advancedFeaturesEnabled ? ["大会", "関門", "給水P", "高低差"] : ["大会", "関門", "給水P"];
    const activeRaceSection = raceSections.includes(raceSection) ? raceSection : "大会";
    return (
      <>
        <Segment value={activeRaceSection} values={raceSections} onChange={(value) => {
          setActivePicker(null);
          setRaceSection(value);
        }} />
        {renderSelectedRaceContext("選択中の大会")}
        {activeRaceSection === "大会" && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>大会登録方法</Text>
              <Text style={styles.body}>公式情報を元にした試験版データから選ぶか、自分で大会情報を入力できます。未確認の項目は登録前に注意表示します。</Text>
              <View style={styles.buttonRow}>
                <PrimaryButton label="大会データから選ぶ" onPress={() => setRaceDataOpen(true)} />
                <SecondaryButton label="自分で入力する" onPress={() => {
                  setRaceForm(emptyRace);
                  setActivePicker(null);
                }} />
              </View>
            </Card>
            {selectedRace?.raceDataId && (
              <Card>
                <Text style={styles.sectionTitle}>選択中の大会データ</Text>
                <Text style={styles.body}>{selectedRace.name}</Text>
                <Text style={styles.helpText}>状態: {raceDataStatusLabel(selectedRace.raceDataStatus ?? selectedRaceData?.verificationStatus ?? "")} / 参照: {selectedRace.officialSourceTitle || selectedRaceData?.sources[0]?.title || "-"} / 確認日: {selectedRace.officialAccessedAt || selectedRaceData?.sources[0]?.accessedAt || "-"}</Text>
                <Text style={styles.noticeText}>大会データは登録時点の内容をコピー保存しています。最新情報は公式サイトで確認してください。</Text>
              </Card>
            )}
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
        {activeRaceSection === "関門" && (
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
        {activeRaceSection === "高低差" && (
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
        {activeRaceSection === "給水P" && (
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
      </>
    );
  }

  function renderPlanTab() {
    const normalizedPlanPaceType = normalizedPaceType(planForm.paceType);
    const detailedPaceValue =
      normalizedPlanPaceType === "後半温存型"
        ? "前半ゆっくり後半アップ"
        : normalizedPlanPaceType === "安全完走型"
          ? "前半やや速め"
          : "一定ペース";
    return (
      <>
        <Segment value={planSection} values={["作成", "ペース表", "出力", "過去比較"]} onChange={setPlanSection} />
        {renderSelectedRaceContext(planSection === "作成" ? "プラン対象大会" : `${planSection}の対象大会`)}
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
            <Segment value={normalizedPlanPaceType} values={["安全完走型", "一定ペース型", "後半温存型"]} onChange={(v) => {
              setPlanSavedMessage("");
              setPlanForm((prev) => ({ ...prev, paceType: v as Plan["paceType"] }));
            }} />
            <Text style={styles.helpText}>{paceTypeDescription(planForm.paceType)}</Text>
            {advancedFeaturesEnabled && (
              <View style={styles.advancedPanel}>
                <Text style={styles.sectionTitle}>詳細ペース配分</Text>
                <Text style={styles.body}>同じペースタイプを、レース戦略の言葉で細かく確認できます。選択内容はペース表に反映されます。</Text>
                <Segment
                  value={detailedPaceValue}
                  values={["一定ペース", "前半ゆっくり後半アップ", "前半やや速め"]}
                  onChange={(value) => {
                    setPlanSavedMessage("");
                    const nextType = value === "前半ゆっくり後半アップ" ? "後半温存型" : value === "前半やや速め" ? "安全完走型" : "一定ペース型";
                    setPlanForm((prev) => ({ ...prev, paceType: nextType as Plan["paceType"], splitStrategy: defaultStrategyForPaceType(nextType as Plan["paceType"]) }));
                  }}
                />
                <Text style={styles.label}>前後半の配分</Text>
                <Segment
                  value={planForm.splitStrategy ?? defaultStrategyForPaceType(planForm.paceType)}
                  values={["even", "negative", "positive"]}
                  labelForValue={splitStrategyLabel}
                  onChange={(value) => {
                    setPlanSavedMessage("");
                    setPlanForm((prev) => ({ ...prev, splitStrategy: value as CoursePaceStrategy }));
                  }}
                />
                <Text style={styles.helpText}>{splitStrategyDescription(planForm.splitStrategy ?? defaultStrategyForPaceType(planForm.paceType))}</Text>
                <SelectField
                  label="前後半差"
                  value={planForm.splitDifferenceMin ?? "0"}
                  options={SPLIT_DIFF_OPTIONS}
                  displayValue={(value) => value === "custom" ? "自分で入力" : `${value}分`}
                  pickerId="plan-split-diff"
                  activePicker={activePicker}
                  setActivePicker={setActivePicker}
                  onSelect={(value) => {
                    setPlanSavedMessage("");
                    setPlanForm((prev) => ({ ...prev, splitDifferenceMin: value }));
                  }}
                />
                {planForm.splitDifferenceMin === "custom" && (
                  <Input label="前後半差 分" value={planForm.customSplitDifferenceMin ?? ""} onChangeText={(value) => {
                    setPlanSavedMessage("");
                    setField(setPlanForm, "customSplitDifferenceMin", value);
                  }} keyboardType="number-pad" />
                )}
                {splitDiffMinutes(planForm) >= 15 && <Text style={styles.noticeText}>前後半差が大きめです。関門時刻と後半の失速リスクを確認してください。</Text>}
              </View>
            )}
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
        {planSection === "ペース表" && renderPaceTable()}
        {planSection === "出力" && (
          <Card>
            <Text style={styles.sectionTitle}>出力</Text>
            <Text style={styles.body}>現在のペース表をCSVまたはA4縦PDFで出力します。CSVはUTF-8 BOM付きです。</Text>
            <Text style={styles.label}>出力する範囲</Text>
            <Segment value={paceExportMode} values={["5km目安", "全距離"]} onChange={(value) => setPaceExportMode(value as PaceExportMode)} />
            <Text style={styles.helpText}>{paceExportMode === "5km目安" ? "大会当日に見やすいよう、5km地点、関門、給水/停止、ゴールだけを出力します。" : "確認用として1kmごとの全行を出力します。印刷枚数は多くなります。"}</Text>
            <View style={styles.rowGap}>
              <PrimaryButton label="CSV出力" onPress={exportCsv} />
              <SecondaryButton label="PDF出力" onPress={exportPdf} />
            </View>
          </Card>
        )}
        {planSection === "過去比較" && (
          <>
            <Card>
              <Text style={styles.sectionTitle}>過去比較の役割</Text>
              <Text style={styles.body}>過去比較は完走計画そのものではなく、前回大会や自己ベストとの差を確認する補助機能です。不要なら入力しなくてもペース表作成には影響しません。</Text>
            </Card>
            {renderPastRace()}
          </>
        )}
      </>
    );
  }

  function renderPaceTable() {
    const goalRow = paceRows[paceRows.length - 1];
    const summaryRows = [
      ...Array.from({ length: Math.floor(n(selectedRace?.distanceKm ?? "0") / 5) }, (_, index) => (index + 1) * 5)
        .map((km) => paceRows.find((row) => Math.abs(row.km - km) < 0.01))
        .filter(Boolean) as PaceRow[],
      ...(goalRow ? [goalRow] : [])
    ].filter((row, index, rows) => rows.findIndex((item) => Math.abs(item.km - row.km) < 0.01) === index);

    return (
      <>
        <Card>
          <Text style={styles.sectionTitle}>ペース表</Text>
          <Text style={styles.body}>{selectedRace?.name ?? "大会未選択"} / 予測ゴール {formatDurationJa(predictedOfficialGoalSec)} / 平均 {formatPace(basePace)} / 関門余裕 最小{formatMinutesLabel(minMargin)}</Text>
          <Text style={styles.helpText}>基本は5kmごとの目安を確認します。1kmごとの詳細や手動調整は、設定で「詳細機能を表示」をオンにすると使えます。</Text>
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>5km区間ペース提案（試算）</Text>
          <Text style={styles.body}>目標タイム、前後半の配分、登録済みコース特性から計算した参考ペースです。完走や記録を保証するものではありません。</Text>
          <Text style={styles.helpText}>
            {selectedRaceData
              ? `参照データ: ${selectedRaceData.name} / ${raceDataStatusLabel(selectedRaceData.verificationStatus)}`
              : "大会データ未選択のため、コース特性なしの平坦目安として表示します。"}
          </Text>
          {coursePaceRows.length ? coursePaceRows.map((row) => (
            <View key={`course-${row.startKm}-${row.endKm}`} style={styles.coursePaceRow}>
              <View style={styles.listText}>
                <Text style={styles.listTitle}>{row.startKm.toFixed(row.startKm % 1 ? 1 : 0)} - {row.endKm.toFixed(row.endKm % 1 ? 1 : 0)}km / {terrainLabel(row.terrain)}</Text>
                <Text style={styles.muted}>{row.description}</Text>
                <Text style={styles.helpText}>補正 {row.adjustmentSecondsPerKm > 0 ? "+" : ""}{row.adjustmentSecondsPerKm}秒/km / 信頼度 {row.confidence}</Text>
              </View>
              <View style={styles.coursePaceValue}>
                <Text style={styles.metricLabel}>目安</Text>
                <Text style={styles.metricValue}>{formatPace(row.paceSecondsPerKm)}</Text>
                <Text style={styles.muted}>{formatDuration(row.sectionSeconds)}</Text>
              </View>
            </View>
          )) : <Text style={styles.muted}>プランを作成すると表示されます。</Text>}
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>5kmごとの目安</Text>
          <View style={styles.summaryTableHeader}>
            <Text style={styles.summaryTableCell}>距離</Text>
            <Text style={styles.summaryTableCell}>通過予定</Text>
            <Text style={styles.summaryTableCell}>ペース</Text>
          </View>
          {summaryRows.length ? summaryRows.map((row) => (
            <View key={`summary-${row.km}`} style={styles.summaryTableRow}>
              <Text style={styles.summaryTableCell}>{row === goalRow ? "ゴール" : `${row.km.toFixed(0)}km`}</Text>
              <Text style={styles.summaryTableCell}>{row.etaMinutes == null ? formatDuration(row.cumulativeSec) : addMinutesToClock("00:00", row.etaMinutes)}</Text>
              <Text style={styles.summaryTableCell}>{formatPace(row.adjustedLapSec)}</Text>
            </View>
          )) : <Text style={styles.muted}>ペース表を作成すると表示されます。</Text>}
        </Card>
        {raceGates.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>関門だけ確認</Text>
            {gateRows.map((row) => (
              <View key={`gate-only-${row.gate?.id}`} style={styles.gateSummary}>
                <View style={styles.gateSummaryText}>
                  <Text style={styles.listTitle}>{row.gate?.name} / {row.gate?.distanceKm ?? row.km}km</Text>
                  <Text style={styles.muted}>関門 {row.gate?.gateTime} / 通過予定 {row.etaMinutes == null ? "-" : addMinutesToClock("00:00", row.etaMinutes)}</Text>
                </View>
                <View style={styles.gateSummaryBadge}>
                  <Text style={[styles.metricValue, statusStyle(row.status)]}>{formatMinutesLabel(row.gateMarginSec)}</Text>
                  <Badge label={row.status} />
                </View>
              </View>
            ))}
          </Card>
        )}
        {advancedFeaturesEnabled ? (
          <>
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
            <Text style={styles.sectionCaption}>1kmごとの詳細</Text>
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
        ) : (
          <Card>
            <Text style={styles.sectionTitle}>詳細ペース表</Text>
            <Text style={styles.body}>1kmごとの一覧、手動ラップ調整、高低差を使った細かい確認は詳細機能で使えます。</Text>
            <SecondaryButton label="設定で詳細機能をオンにする" onPress={() => setTab("設定")} />
          </Card>
        )}
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

  function renderBasicSettings() {
    const adjustLabel = (value: string) => `${Number(value) > 0 ? "+" : ""}${value}秒/km`;
    return (
      <Card>
        <Text style={styles.sectionTitle}>基本設定</Text>
        <Text style={styles.body}>保存先: スマホ内保存。クラウド保存は準備中として設計のみ残しています。</Text>
        <View style={styles.settingToggleRow}>
          <View style={styles.settingToggleText}>
            <Text style={styles.sectionTitle}>詳細機能を表示</Text>
            <Text style={styles.helpText}>オンにすると、高低差、1km詳細ペース表、手動ラップ調整など上級者向けの項目を表示します。</Text>
          </View>
          <Switch
            value={advancedFeaturesEnabled}
            onValueChange={(value) => updateStore({ ...store, settings: { ...store.settings, advancedFeaturesEnabled: value } })}
            trackColor={{ false: "#d8d5ca", true: "#b8d9cb" }}
            thumbColor={advancedFeaturesEnabled ? "#176b51" : "#f7f5ee"}
          />
        </View>
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
      </Card>
    );
  }

  function renderImageSettings() {
    return (
      <>
        <Card>
          <Text style={styles.sectionTitle}>画像設定</Text>
          <Text style={styles.body}>オープニングとホームの画像は別々に保存されます。用途が違うので、それぞれに合う写真を選べます。</Text>
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>オープニング背景画像</Text>
          <Text style={styles.body}>現在: {store.settings.openingBackgroundUri ? "自分で選んだ画像" : "標準画像"}</Text>
          <Text style={styles.helpText}>アプリ起動時の短いアニメーションに使います。推奨: 縦長9:16、JPGまたはPNG、2MB前後まで。暗めの写真や余白のある写真だと、白いロゴと文字が読みやすくなります。</Text>
          <View style={styles.openingPreview}>
            <Image source={openingBackgroundSource} style={styles.openingPreviewImage} resizeMode="cover" />
            <View style={styles.openingPreviewShade} />
            <Image source={OPENING_LOGO} style={styles.openingPreviewLogo} resizeMode="contain" />
          </View>
          <View style={styles.buttonRow}>
            <SecondaryButton label="画像を選択" onPress={pickOpeningBackground} />
            <SecondaryButton label="標準画像に戻す" onPress={resetOpeningBackground} />
          </View>
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>ホームのヒーロー画像</Text>
          <Text style={styles.body}>現在: {store.settings.homeHeroImageUri ? "自分で選んだ画像" : "標準画像"}</Text>
          <Text style={styles.helpText}>ホーム画面の「対象大会」カードに使います。オープニング背景画像とは別物です。推奨: 横長16:9、JPGまたはPNG、2MB前後まで。</Text>
          <View style={styles.openingPreview}>
            <Image source={homeHeroImageSource} style={styles.openingPreviewImage} resizeMode="cover" />
            <View style={styles.openingPreviewShade} />
            <View style={styles.heroPreviewTextBlock}>
              <Text style={styles.darkLabel}>対象大会</Text>
              <Text style={styles.darkRaceTitle}>{selectedRace?.name || "大会未登録"}</Text>
              <Text style={styles.darkRaceMeta}>{selectedRace?.date || "2026-11-01"} / {selectedRace?.location || "開催地未登録"}</Text>
            </View>
          </View>
          <View style={styles.buttonRow}>
            <SecondaryButton label="画像を選択" onPress={pickHomeHeroImage} />
            <SecondaryButton label="標準画像に戻す" onPress={resetHomeHeroImage} />
          </View>
        </Card>
      </>
    );
  }

  function renderDataSettings() {
    return (
      <Card>
        <Text style={styles.sectionTitle}>データ管理</Text>
        <Text style={styles.body}>大会、関門、プラン、練習分析、画像設定を含む保存データを管理します。</Text>
        <View style={styles.rowGap}>
          <PrimaryButton label="データバックアップ" onPress={backupData} />
          <SecondaryButton label="データ復元" onPress={restoreSample} />
          <DangerButton label="全データ削除" onPress={clearAll} />
        </View>
      </Card>
    );
  }

  function renderSettingsTab() {
    const settingsSections = ["基本", "画像", "データ", "PB", "過去"];
    const normalizedSettingsSection = settingsSection === "設定" ? "基本" : settingsSection === "過去比較" ? "過去" : settingsSection;
    const activeSettingsSection = settingsSections.includes(normalizedSettingsSection) ? normalizedSettingsSection : "基本";
    return (
      <>
        <Segment value={activeSettingsSection} values={settingsSections} onChange={setSettingsSection} />
        {activeSettingsSection === "基本" && renderBasicSettings()}
        {activeSettingsSection === "画像" && renderImageSettings()}
        {activeSettingsSection === "データ" && renderDataSettings()}
        {activeSettingsSection === "PB" && renderPbTab()}
        {activeSettingsSection === "過去" && renderPastRace()}
      </>
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
        <Pressable key={item} onPress={() => onChange(item)} style={[styles.segmentItem, { width: `${100 / values.length}%` }, value === item && styles.segmentItemActive]}>
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

function TrainingPreviewCard({ row, source }: { row: ParsedTrainingPreviewRow; source: TrainingSourceApp }) {
  const activity = row.activity;
  const danger = row.status === "除外" || row.status === "要確認";
  const warn = row.status === "重複候補";
  return (
    <View style={styles.trainingPreviewCard}>
      <View style={styles.paceHead}>
        <Text style={styles.listTitle}>{activity?.date ?? `行 ${row.index}`}</Text>
        <Text style={[styles.previewStatus, danger ? styles.previewStatusDanger : warn ? styles.previewStatusWarn : styles.previewStatusOk]}>{row.status}</Text>
      </View>
      <Text style={styles.muted}>
        {activity?.activityType ?? "-"} / {activity ? `${formatKm(activity.distanceKm)}km` : "-"} / {activity ? formatDuration(activity.durationSeconds) : "-"} / {activity ? formatPace(activity.averagePaceSecondsPerKm) : "-"} / 心拍 {activity?.averageHeartRate ?? "-"} / {sourceAppLabel(source)}
      </Text>
      {!!row.reason && <Text style={styles.helpText}>理由: {row.reason}</Text>}
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
  appBackground: { flex: 1, backgroundColor: "#f3f1ec" },
  openingScreen: { ...StyleSheet.absoluteFillObject, zIndex: 50, elevation: 50, backgroundColor: "#0b0d0c", alignItems: "center", justifyContent: "center" },
  openingImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  openingShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.54)" },
  openingCenter: { width: "100%", alignItems: "center", paddingHorizontal: 26 },
  openingLogo: { width: "88%", maxWidth: 420, height: 124 },
  openingCopy: { marginTop: 10, color: "#ffffff", fontSize: 16, lineHeight: 23, fontWeight: "800", textAlign: "center", textShadowColor: "rgba(0,0,0,0.42)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  openingBottom: { position: "absolute", left: 36, right: 36, bottom: Platform.OS === "ios" ? 58 : 40, alignItems: "center" },
  openingProgressTrack: { width: "100%", maxWidth: 300, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.34)", overflow: "hidden" },
  openingProgressFill: { height: "100%", borderRadius: 999, backgroundColor: "#18a66b" },
  openingBottomText: { marginTop: 14, color: "#ffffff", fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" },
  openingSkipText: { marginTop: 8, color: "rgba(255,255,255,0.70)", fontSize: 11, lineHeight: 15, fontWeight: "700", textAlign: "center" },
  loading: { margin: 24, color: "#263238" },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, backgroundColor: "transparent" },
  appName: { fontSize: 34, lineHeight: 38, fontWeight: "900", color: "#101514", letterSpacing: 0 },
  appSub: { marginTop: 3, color: "#1f2926", fontSize: 13, fontWeight: "800" },
  content: { flex: 1 },
  contentInner: { padding: 14, paddingBottom: 150 },
  modalPage: { flex: 1, backgroundColor: "#f3f1ec" },
  modalPageInner: { padding: 14, paddingBottom: 34 },
  card: { backgroundColor: "rgba(255,255,255,0.88)", borderWidth: 1, borderColor: "rgba(30,34,32,0.12)", borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 },
  contextCard: { backgroundColor: "#111817", borderRadius: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  contextLabel: { color: "rgba(255,255,255,0.72)", fontSize: 12, lineHeight: 17, fontWeight: "900", marginBottom: 4 },
  contextTitle: { color: "#ffffff", fontSize: 18, lineHeight: 24, fontWeight: "900", marginBottom: 5 },
  contextMeta: { color: "rgba(255,255,255,0.84)", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#31423b", marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: "900", color: "#263238", marginBottom: 5 },
  muted: { color: "#6d766f", fontSize: 13, lineHeight: 19 },
  body: { color: "#42514a", fontSize: 14, lineHeight: 21 },
  helpText: { color: "#5d6d65", fontSize: 12, lineHeight: 18, marginTop: 2, marginBottom: 12 },
  noticeText: { marginTop: 12, color: "#6b4d10", backgroundColor: "#fff4d6", borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  homeHero: { gap: 10, marginBottom: 12, overflow: "hidden" },
  raceFocusCard: { backgroundColor: "rgba(15,17,16,0.84)", borderRadius: 8, padding: 16, minHeight: 168, justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", overflow: "hidden" },
  raceFocusImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  raceFocusShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.48)" },
  raceFocusContent: { position: "relative", zIndex: 1, maxWidth: "82%" },
  raceFocusArrow: { position: "absolute", right: 16, top: "46%", zIndex: 2, color: "rgba(255,255,255,0.90)", fontSize: 36, lineHeight: 40, fontWeight: "300" },
  homeRaceSelector: { backgroundColor: "rgba(255,255,255,0.86)", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "rgba(44,54,50,0.12)", gap: 8 },
  darkLabel: { color: "#ffffff", fontSize: 13, fontWeight: "900", marginBottom: 8 },
  darkRaceTitle: { color: "#ffffff", fontSize: 23, lineHeight: 29, fontWeight: "900" },
  darkRaceMeta: { color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 19, marginTop: 6, fontWeight: "800" },
  homeMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  glassMetric: { width: "48%", minHeight: 86, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", borderRadius: 8, padding: 12, justifyContent: "center" },
  glassWidePanel: { backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", borderRadius: 8, padding: 14 },
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
  advancedPanel: { backgroundColor: "#f6f3ee", borderRadius: 8, borderWidth: 1, borderColor: "#e2ded2", padding: 12, marginBottom: 14 },
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
  confirmSheet: { maxHeight: "88%", backgroundColor: "#fffdf8", borderRadius: 8, borderWidth: 1, borderColor: "#e2ded2", padding: 14 },
  confirmSheetInner: { paddingBottom: 8 },
  confirmButtonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: 1, borderTopColor: "#ebe7dc", paddingTop: 12, marginTop: 8 },
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
  settingToggleRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f0f5ef", borderRadius: 8, padding: 12, marginTop: 12, marginBottom: 8 },
  settingToggleText: { flex: 1 },
  settingBlock: { borderTopWidth: 1, borderTopColor: "#ebe7dc", borderBottomWidth: 1, borderBottomColor: "#ebe7dc", paddingVertical: 14, marginTop: 14, marginBottom: 14 },
  openingPreview: { height: 170, borderRadius: 8, overflow: "hidden", backgroundColor: "#111817", alignItems: "center", justifyContent: "center", marginTop: 8 },
  openingPreviewImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  openingPreviewShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.52)" },
  openingPreviewLogo: { width: "78%", height: 82 },
  heroPreviewTextBlock: { position: "absolute", left: 16, right: 16, bottom: 16 },
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
  segmentItem: { flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 6, paddingHorizontal: 4 },
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
  trainingActivityCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e2ded2", borderRadius: 8, padding: 12, marginBottom: 10 },
  trainingPreviewCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e2ded2", borderRadius: 8, padding: 12, marginTop: 10 },
  previewStatus: { minWidth: 78, textAlign: "center", borderRadius: 8, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, fontSize: 11, fontWeight: "900" },
  previewStatusOk: { color: "#176b51", backgroundColor: "#dcefe5" },
  previewStatusWarn: { color: "#8a6200", backgroundColor: "#fff1c7" },
  previewStatusDanger: { color: "#b3261e", backgroundColor: "#ffd6d2" },
  raceCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2ded2", borderRadius: 8, padding: 12, marginBottom: 10 },
  raceDataCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#d8d7cd", borderRadius: 8, padding: 14, marginBottom: 10 },
  raceCardActive: { borderColor: "#176b51", backgroundColor: "#f2f8f3" },
  raceCardHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  usingBadge: { backgroundColor: "#dcefe5", color: "#176b51", fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  warningBadge: { backgroundColor: "#fff1c7", color: "#8a6200" },
  editingBadge: { backgroundColor: "#fff1c7", color: "#8a6200", fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  courseMiniCard: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#ebe7dc", borderRadius: 8, padding: 10, marginBottom: 8 },
  coursePaceRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#ebe7dc", borderRadius: 8, padding: 12, marginTop: 8 },
  coursePaceValue: { minWidth: 86, alignItems: "flex-end" },
  gateSummary: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#ebe7dc", paddingTop: 10, marginTop: 10 },
  gateSummaryText: { flex: 1 },
  gateSummaryBadge: { alignItems: "flex-end", gap: 5 },
  sectionCaption: { color: "#31423b", fontSize: 15, fontWeight: "900", marginBottom: 8, marginTop: 2 },
  summaryTableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d8d7cd", paddingBottom: 8, marginBottom: 4 },
  summaryTableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#efede5" },
  summaryTableCell: { flex: 1, color: "#263238", fontSize: 13, lineHeight: 18, fontWeight: "800" },
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
