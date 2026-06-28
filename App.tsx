import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
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
  targetTime: string;
  paceType: "イーブンペース" | "前半抑えめ" | "後半型" | "関門安全重視";
  gateBufferMin: string;
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
  cumulativeSec: number;
  etaMinutes: number | null;
  gate?: Gate;
  gateMarginSec?: number;
  status: StatusLabel;
};

type StatusLabel = "安全" | "注意" | "危険" | "関門アウト" | "-";

const STORAGE_KEY = "marathon-finish-planner-v1";
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
  officialUrl: "",
  memo: ""
};
const emptyGate: Gate = { id: "", raceId: "", name: "", distanceKm: "", gateTime: "", memo: "" };
const emptySegment: ElevationSegment = { id: "", raceId: "", startKm: "", endKm: "", terrain: "上り", adjustSecPerKm: "10" };
const emptyPlan: Plan = { id: "", raceId: "", targetTime: "05:30:00", paceType: "イーブンペース", gateBufferMin: "10" };
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

function formatClockFromStart(startTime: string, cumulativeSec: number): string {
  const start = parseClock(startTime);
  if (start == null) return "-";
  const totalMinutes = start + cumulativeSec / 60;
  const dayMinutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(dayMinutes / 60);
  const m = dayMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

function escapeCsv(value: string | number | undefined) {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}

function getTerrainAdjustment(km: number, segments: ElevationSegment[]) {
  const hit = segments.find((segment) => km > n(segment.startKm) && km <= n(segment.endKm));
  return hit ? n(hit.adjustSecPerKm) : 0;
}

function paceFactor(type: Plan["paceType"], km: number, distance: number) {
  const ratio = km / distance;
  if (type === "前半抑えめ") return ratio <= 0.5 ? 1.04 : 0.96;
  if (type === "後半型") return ratio <= 0.6 ? 1.03 : 0.955;
  if (type === "関門安全重視") return ratio <= 0.7 ? 0.985 : 1.035;
  return 1;
}

function buildPaceRows(race?: Race, plan?: Plan, gates: Gate[] = [], segments: ElevationSegment[] = []): PaceRow[] {
  if (!race || !plan) return [];
  const distance = n(race.distanceKm);
  const targetSec = parseDuration(plan.targetTime);
  if (!distance || !targetSec) return [];
  const rows: PaceRow[] = [];
  const wholeKms = Math.floor(distance);
  const lastDistance = distance - wholeKms > 0.001 ? distance : wholeKms;
  const kmPoints = Array.from({ length: Math.ceil(lastDistance) }, (_, index) => index + 1);
  const basePace = targetSec / distance;
  let cumulativeSec = 0;
  const sortedGates = [...gates].sort((a, b) => n(a.distanceKm) - n(b.distanceKm));

  kmPoints.forEach((kmPoint) => {
    const actualKm = Math.min(kmPoint, distance);
    const segmentDistance = kmPoint > wholeKms ? distance - wholeKms : 1;
    const factor = paceFactor(plan.paceType, actualKm, distance);
    const baseLapSec = basePace * segmentDistance * factor;
    const adjustedLapSec = Math.max(60, baseLapSec + getTerrainAdjustment(actualKm, segments) * segmentDistance);
    cumulativeSec += adjustedLapSec;
    const gate = sortedGates.find((candidate) => Math.abs(n(candidate.distanceKm) - actualKm) < 0.51);
    const gateClock = gate ? parseClock(gate.gateTime) : null;
    const startClock = parseClock(race.startTime);
    const etaMinutes = startClock == null ? null : startClock + cumulativeSec / 60;
    const gateMarginSec = gateClock != null && etaMinutes != null ? (gateClock - etaMinutes) * 60 : undefined;
    rows.push({
      km: actualKm,
      baseLapSec,
      adjustedLapSec,
      cumulativeSec,
      etaMinutes,
      gate,
      gateMarginSec,
      status: statusFromMargin(gateMarginSec)
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
      { id: uid(), raceId: sampleRaceId, name: "中間関門", distanceKm: "21.0975", gateTime: "12:45", memo: "" },
      { id: uid(), raceId: sampleRaceId, name: "35km関門", distanceKm: "35", gateTime: "14:40", memo: "" }
    ],
    segments: [
      { id: uid(), raceId: sampleRaceId, startKm: "0", endKm: "15", terrain: "平坦", adjustSecPerKm: "0" },
      { id: uid(), raceId: sampleRaceId, startKm: "15", endKm: "28", terrain: "上り", adjustSecPerKm: "10" },
      { id: uid(), raceId: sampleRaceId, startKm: "28", endKm: "42.195", terrain: "下り", adjustSecPerKm: "-5" }
    ],
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
  const [planForm, setPlanForm] = useState<Plan>(emptyPlan);
  const [pbForm, setPbForm] = useState<PBRecord>(emptyPb);
  const [pastForm, setPastForm] = useState<PastRace>(emptyPast);

  const selectedRace = store.races.find((race) => race.id === store.selectedRaceId) ?? store.races[0];
  const selectedRaceId = selectedRace?.id ?? "";
  const selectedPlan = store.plans.find((plan) => plan.raceId === selectedRaceId);
  const raceGates = store.gates.filter((gate) => gate.raceId === selectedRaceId);
  const raceSegments = store.segments.filter((segment) => segment.raceId === selectedRaceId);
  const paceRows = useMemo(
    () => buildPaceRows(selectedRace, selectedPlan, raceGates, raceSegments),
    [selectedRace, selectedPlan, raceGates, raceSegments]
  );
  const minMargin = paceRows.map((row) => row.gateMarginSec).filter((value): value is number => value != null).sort((a, b) => a - b)[0];
  const basePace = selectedRace && selectedPlan ? (parseDuration(selectedPlan.targetTime) ?? 0) / Math.max(n(selectedRace.distanceKm), 1) : null;
  const homeStatus = statusFromMargin(minMargin);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) setStore(JSON.parse(saved));
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
  const selectRace = (id: string) => updateStore({ ...store, selectedRaceId: id });
  const raceOptions = store.races.length ? store.races : [];

  function saveRace() {
    if (!raceForm.name.trim()) return Alert.alert("入力不足", "大会名を入力してください。");
    const id = raceForm.id || uid();
    const nextRace = { ...raceForm, id, location: combineLocation(raceForm.prefecture, raceForm.municipality, raceForm.location) };
    const exists = store.races.some((race) => race.id === id);
    updateStore({
      ...store,
      races: exists ? store.races.map((race) => (race.id === id ? nextRace : race)) : [...store.races, nextRace],
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
    const nextSegment = { ...segmentForm, id: segmentForm.id || uid(), raceId: selectedRaceId };
    const exists = store.segments.some((segment) => segment.id === nextSegment.id);
    updateStore({
      ...store,
      segments: exists ? store.segments.map((segment) => (segment.id === nextSegment.id ? nextSegment : segment)) : [...store.segments, nextSegment]
    });
    setSegmentForm(emptySegment);
  }

  function savePlan() {
    if (!selectedRaceId) return Alert.alert("大会未選択", "先に大会を登録してください。");
    const nextPlan = { ...planForm, id: planForm.id || selectedPlan?.id || uid(), raceId: selectedRaceId };
    const exists = store.plans.some((plan) => plan.id === nextPlan.id);
    updateStore({ ...store, plans: exists ? store.plans.map((plan) => (plan.id === nextPlan.id ? nextPlan : plan)) : [...store.plans, nextPlan] });
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
    const header = ["km", "予定ラップ", "補正後ラップ", "累計タイム", "到達予定時刻", "関門", "余裕時間", "判定"];
    const lines = paceRows.map((row) => [
      row.km,
      formatDuration(row.baseLapSec),
      formatDuration(row.adjustedLapSec),
      formatDuration(row.cumulativeSec),
      selectedRace ? formatClockFromStart(selectedRace.startTime, row.cumulativeSec) : "-",
      row.gate?.name ?? "",
      formatDuration(row.gateMarginSec),
      row.status
    ]);
    const csv = "\uFEFF" + [header, ...lines].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const safeName = (selectedRace?.name || "race-plan").replace(/[\\/:*?"<>|]/g, "_");
    const uri = `${FileSystem.documentDirectory}${safeName}-pace.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await shareFile(uri);
  }

  async function exportPdf() {
    const rows = paceRows
      .map(
        (row) =>
          `<tr><td>${row.km}</td><td>${formatDuration(row.adjustedLapSec)}</td><td>${formatDuration(row.cumulativeSec)}</td><td>${selectedRace ? formatClockFromStart(selectedRace.startTime, row.cumulativeSec) : "-"}</td><td>${row.gate?.name ?? ""}</td><td>${formatDuration(row.gateMarginSec)}</td><td>${row.status}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:22mm}body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:#263238}h1{font-size:22px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ccd6d0;padding:5px;text-align:left}th{background:#e9f1eb}.summary{margin:12px 0 18px;padding:10px;background:#f6f3ee}</style></head><body><h1>マラソン完走プランナー</h1><div class="summary"><b>${selectedRace?.name ?? ""}</b><br>目標 ${selectedPlan?.targetTime ?? "-"} / 平均 ${formatPace(basePace)} / 最小関門余裕 ${formatDuration(minMargin)} / ${homeStatus}</div><table><thead><tr><th>km</th><th>補正後ラップ</th><th>累計</th><th>到達予定</th><th>関門</th><th>余裕</th><th>判定</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
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
      { text: "削除", style: "destructive", onPress: () => updateStore({ ...createInitialStore(), races: [], gates: [], segments: [], plans: [], pbs: [], pastRaces: [], selectedRaceId: undefined }) }
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
      <View style={styles.header}>
        <Text style={styles.appName}>マラソン完走プランナー</Text>
        <Text style={styles.appSub}>GPSなしで大会前の完走計画を作成</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {tab === "ホーム" && renderHome()}
        {tab === "大会登録" && renderRaceTab()}
        {tab === "レースプラン" && renderPlanTab()}
        {tab === "ペース表" && renderPaceTable()}
        {tab === "PB管理" && renderPbTab()}
      </ScrollView>
      <View style={styles.tabbar}>
        {["ホーム", "大会登録", "レースプラン", "ペース表", "PB管理"].map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.tabButton, tab === item && styles.tabButtonActive]}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );

  function renderHome() {
    return (
      <>
        <Card>
          <Text style={styles.sectionTitle}>次回大会</Text>
          <Text style={styles.heroTitle}>{selectedRace?.name || "大会未登録"}</Text>
          <Text style={styles.muted}>{selectedRace ? `${selectedRace.date} / ${selectedRace.location} / ${selectedRace.category}` : "大会登録タブから追加してください"}</Text>
          <View style={styles.grid2}>
            <Metric label="目標タイム" value={selectedPlan?.targetTime ?? "-"} />
            <Metric label="平均ペース" value={formatPace(basePace)} />
            <Metric label="最小関門余裕" value={formatDuration(minMargin)} />
            <Metric label="安全判定" value={homeStatus} tone={homeStatus} />
          </View>
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>対象大会</Text>
          <RacePicker races={raceOptions} selectedId={selectedRaceId} onSelect={selectRace} />
        </Card>
        <Card>
          <Text style={styles.sectionTitle}>設計方針</Text>
          <Text style={styles.body}>大会情報は手入力で保存します。Garmin、Strava、GPS計測、公式サイト自動取得は実装していません。公式サイトURLは参照用に保存のみ行います。</Text>
        </Card>
      </>
    );
  }

  function renderRaceTab() {
    return (
      <>
        <Segment value={raceSection} values={["大会", "関門", "高低差", "設定"]} onChange={setRaceSection} />
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
                onSelect={(value) => setRaceForm((prev) => ({ ...prev, prefecture: value, municipality: "", location: combineLocation(value, "", prev.location) }))}
              />
              <SelectField
                label="市町村"
                value={raceForm.municipality ?? ""}
                placeholder={raceForm.prefecture ? "市町村を選択" : "先に都道府県を選択"}
                options={raceForm.prefecture ? PREFECTURE_MUNICIPALITIES[raceForm.prefecture] ?? [] : []}
                onSelect={(value) => setRaceForm((prev) => ({ ...prev, municipality: value, location: combineLocation(prev.prefecture, value, prev.location) }))}
              />
              <CalendarField label="大会日" value={raceForm.date} onSelect={(value) => setField(setRaceForm, "date", value)} />
              <SelectField
                label="種目"
                value={raceForm.category}
                options={RACE_CATEGORIES}
                onSelect={(value) => setRaceForm((prev) => ({ ...prev, category: value, distanceKm: CATEGORY_DISTANCE[value] ?? prev.distanceKm }))}
              />
              <Input label="距離 km" value={raceForm.distanceKm} onChangeText={(v) => setField(setRaceForm, "distanceKm", v)} keyboardType="decimal-pad" />
              <TimeSelectField label="スタート時刻" value={raceForm.startTime} onSelect={(value) => setField(setRaceForm, "startTime", value)} />
              <DurationSelectField label="制限時間" value={raceForm.limitTime} onSelect={(value) => setField(setRaceForm, "limitTime", value)} />
              <Input label="公式サイトURL" value={raceForm.officialUrl} onChangeText={(v) => setField(setRaceForm, "officialUrl", v)} />
              <Input label="メモ" value={raceForm.memo} onChangeText={(v) => setField(setRaceForm, "memo", v)} multiline />
              <PrimaryButton label={raceForm.id ? "更新する" : "保存する"} onPress={saveRace} />
            </Card>
            {store.races.map((race) => (
              <ListCard key={race.id} title={race.name} subtitle={`${race.date} / ${race.distanceKm}km / ${race.startTime}開始`} onEdit={() => setRaceForm(normalizeRaceForm(race))} onDelete={() => deleteRace(race.id)} />
            ))}
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
              <Input label="補正秒数 / km" value={segmentForm.adjustSecPerKm} onChangeText={(v) => setField(setSegmentForm, "adjustSecPerKm", v)} keyboardType="numbers-and-punctuation" />
              <PrimaryButton label={segmentForm.id ? "更新する" : "保存する"} onPress={saveSegment} />
            </Card>
            {raceSegments.map((segment) => (
              <ListCard key={segment.id} title={`${segment.startKm}km - ${segment.endKm}km / ${segment.terrain}`} subtitle={`${segment.adjustSecPerKm}秒/km`} onEdit={() => setSegmentForm(segment)} onDelete={() => updateStore({ ...store, segments: store.segments.filter((item) => item.id !== segment.id) })} />
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
            <Text style={styles.sectionTitle}>レースプラン作成</Text>
            <RacePicker races={raceOptions} selectedId={selectedRaceId} onSelect={(id) => {
              selectRace(id);
              const existing = store.plans.find((plan) => plan.raceId === id);
              setPlanForm(existing ?? { ...emptyPlan, raceId: id });
            }} />
            <Input label="目標ゴールタイム" value={planForm.id ? planForm.targetTime : selectedPlan?.targetTime ?? planForm.targetTime} onChangeText={(v) => setField(setPlanForm, "targetTime", v)} placeholder="05:30:00" />
            <Text style={styles.label}>ペースタイプ</Text>
            <Segment value={planForm.id ? planForm.paceType : selectedPlan?.paceType ?? planForm.paceType} values={["イーブンペース", "前半抑えめ", "後半型", "関門安全重視"]} onChange={(v) => setPlanForm((prev) => ({ ...prev, paceType: v as Plan["paceType"] }))} />
            <Input label="関門余裕時間 分" value={planForm.id ? planForm.gateBufferMin : selectedPlan?.gateBufferMin ?? planForm.gateBufferMin} onChangeText={(v) => setField(setPlanForm, "gateBufferMin", v)} keyboardType="number-pad" />
            <PrimaryButton label="プランを保存・再計算" onPress={savePlan} />
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
          <Text style={styles.body}>{selectedRace?.name ?? "大会未選択"} / 目標 {selectedPlan?.targetTime ?? "-"} / 最小関門余裕 {formatDuration(minMargin)}</Text>
        </Card>
        {paceRows.map((row) => (
          <View key={`${row.km}`} style={styles.paceCard}>
            <View style={styles.paceHead}>
              <Text style={styles.kmText}>{row.km.toFixed(row.km % 1 ? 3 : 0)} km</Text>
              <Badge label={row.status} />
            </View>
            <View style={styles.grid2}>
              <Metric label="予定ラップ" value={formatDuration(row.baseLapSec)} />
              <Metric label="補正後" value={formatDuration(row.adjustedLapSec)} />
              <Metric label="累計" value={formatDuration(row.cumulativeSec)} />
              <Metric label="到達予定" value={selectedRace ? formatClockFromStart(selectedRace.startTime, row.cumulativeSec) : "-"} />
            </View>
            {row.gate && <Text style={styles.gateLine}>{row.gate.name} / 余裕 {formatDuration(row.gateMarginSec)}</Text>}
          </View>
        ))}
      </>
    );
  }

  function renderPbTab() {
    return (
      <>
        <Segment value={pbSection} values={["PB", "過去比較"]} onChange={setPbSection} />
        {pbSection === "PB" ? (
          <>
            <Card>
              <Text style={styles.sectionTitle}>PB管理</Text>
              <Segment value={pbForm.event} values={["5km", "10km", "ハーフ", "フル"]} onChange={(v) => setPbForm((prev) => ({ ...prev, event: v as PBRecord["event"] }))} />
              <Input label="大会名" value={pbForm.raceName} onChangeText={(v) => setField(setPbForm, "raceName", v)} />
              <Input label="日付" value={pbForm.date} onChangeText={(v) => setField(setPbForm, "date", v)} />
              <Input label="タイム" value={pbForm.time} onChangeText={(v) => setField(setPbForm, "time", v)} placeholder="03:59:30" />
              <Input label="メモ" value={pbForm.memo} onChangeText={(v) => setField(setPbForm, "memo", v)} />
              <PrimaryButton label={pbForm.id ? "更新する" : "保存する"} onPress={savePb} />
            </Card>
            {(["5km", "10km", "ハーフ", "フル"] as PBRecord["event"][]).map((event) => {
              const best = currentPbBest(event);
              return <MetricCard key={event} label={event} value={best ? best.time : "-"} sub={best ? `${best.raceName} ${best.date}` : "未登録"} />;
            })}
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
    return (
      <Card>
        <Text style={styles.sectionTitle}>設定</Text>
        <Text style={styles.body}>保存先: スマホ内保存。クラウド保存は準備中として設計のみ残しています。</Text>
        <Input label="上り 初期補正 秒/km" value={store.settings.climbSec} onChangeText={(v) => updateStore({ ...store, settings: { ...store.settings, climbSec: v } })} />
        <Input label="下り 初期補正 秒/km" value={store.settings.descentSec} onChangeText={(v) => updateStore({ ...store, settings: { ...store.settings, descentSec: v } })} />
        <Input label="平坦 初期補正 秒/km" value={store.settings.flatSec} onChangeText={(v) => updateStore({ ...store, settings: { ...store.settings, flatSec: v } })} />
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
  placeholder = "選択してください"
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const disabled = options.length === 0;

  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable disabled={disabled} onPress={() => setOpen((current) => !current)} style={[styles.selectButton, disabled && styles.selectButtonDisabled]}>
        <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>{value || placeholder}</Text>
        <Text style={styles.selectArrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && !disabled && (
        <View style={styles.selectMenu}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.selectScroll}>
            {options.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  onSelect(option);
                  setOpen(false);
                }}
                style={[styles.selectOption, value === option && styles.selectOptionActive]}
              >
                <Text style={[styles.selectOptionText, value === option && styles.selectOptionTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function CalendarField({ label, value, onSelect }: { label: string; value: string; onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateValue(value));
  const dates = buildCalendarDates(visibleMonth);
  const selected = value ? parseDateValue(value) : null;
  const monthLabel = `${visibleMonth.getFullYear()}年 ${visibleMonth.getMonth() + 1}月`;

  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.selectButton}>
        <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>{value || "カレンダーから選択"}</Text>
        <Text style={styles.selectArrow}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
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
                    setOpen(false);
                  }}
                  style={[styles.dayCell, active && styles.dayCellActive]}
                >
                  <Text style={[styles.dayText, !inMonth && styles.dayTextMuted, active && styles.dayTextActive]}>{date.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

function TimeSelectField({ label, value, onSelect }: { label: string; value: string; onSelect: (value: string) => void }) {
  const [hour = "09", minute = "00"] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));

  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.twoColumn}>
        <SelectField label="時" value={hour.padStart(2, "0")} options={hours} onSelect={(nextHour) => onSelect(`${nextHour}:${minute.padStart(2, "0")}`)} />
        <SelectField label="分" value={minute.padStart(2, "0")} options={MINUTE_OPTIONS} onSelect={(nextMinute) => onSelect(`${hour.padStart(2, "0")}:${nextMinute}`)} />
      </View>
    </View>
  );
}

function DurationSelectField({ label, value, onSelect }: { label: string; value: string; onSelect: (value: string) => void }) {
  const [hour = "07", minute = "00"] = value.split(":");
  const hours = Array.from({ length: 15 }, (_, index) => String(index).padStart(2, "0"));

  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.twoColumn}>
        <SelectField label="時間" value={hour.padStart(2, "0")} options={hours} onSelect={(nextHour) => onSelect(`${nextHour}:${minute.padStart(2, "0")}`)} />
        <SelectField label="分" value={minute.padStart(2, "0")} options={MINUTE_OPTIONS} onSelect={(nextMinute) => onSelect(`${hour.padStart(2, "0")}:${nextMinute}`)} />
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

function Segment({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.segment}>
      {values.map((item) => (
        <Pressable key={item} onPress={() => onChange(item)} style={[styles.segmentItem, value === item && styles.segmentItemActive]}>
          <Text style={[styles.segmentText, value === item && styles.segmentTextActive]} numberOfLines={1}>{item}</Text>
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
      <Text style={[styles.metricValue, tone && statusStyle(tone)]} numberOfLines={1}>{value}</Text>
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
  safe: { flex: 1, backgroundColor: "#f6f3ee" },
  loading: { margin: 24, color: "#263238" },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, backgroundColor: "#f6f3ee" },
  appName: { fontSize: 22, fontWeight: "800", color: "#263238" },
  appSub: { marginTop: 3, color: "#61716a", fontSize: 13 },
  content: { flex: 1 },
  contentInner: { padding: 14, paddingBottom: 24 },
  card: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e2ded2", borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#31423b", marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: "900", color: "#263238", marginBottom: 5 },
  muted: { color: "#6d766f", fontSize: 13, lineHeight: 19 },
  body: { color: "#42514a", fontSize: 14, lineHeight: 21 },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  metric: { width: "48%", minHeight: 68, backgroundColor: "#f0f5ef", borderRadius: 8, padding: 10, justifyContent: "center" },
  metricLabel: { color: "#68766e", fontSize: 12, marginBottom: 5 },
  metricValue: { color: "#263238", fontSize: 16, fontWeight: "800" },
  metricCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e2ded2", borderRadius: 8, padding: 16, marginBottom: 10 },
  inputWrap: { marginBottom: 10 },
  label: { fontSize: 12, color: "#526158", fontWeight: "700", marginBottom: 5 },
  input: { minHeight: 44, backgroundColor: "#ffffff", borderColor: "#d8d7cd", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, color: "#263238", fontSize: 15 },
  textarea: { minHeight: 76, paddingTop: 10, textAlignVertical: "top" },
  selectButton: { minHeight: 44, backgroundColor: "#ffffff", borderColor: "#d8d7cd", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectButtonDisabled: { backgroundColor: "#f1f0eb" },
  selectText: { color: "#263238", fontSize: 15, fontWeight: "700", flex: 1 },
  selectPlaceholder: { color: "#8d948e", fontWeight: "600" },
  selectArrow: { color: "#64736a", fontSize: 12, fontWeight: "800" },
  selectMenu: { backgroundColor: "#ffffff", borderColor: "#d8d7cd", borderWidth: 1, borderRadius: 8, marginTop: 6, maxHeight: 220, overflow: "hidden" },
  selectScroll: { maxHeight: 220 },
  selectOption: { minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderBottomColor: "#ece9df", borderBottomWidth: 1 },
  selectOptionActive: { backgroundColor: "#e4eee7" },
  selectOptionText: { color: "#33423b", fontSize: 14, fontWeight: "700" },
  selectOptionTextActive: { color: "#176b51" },
  twoColumn: { flexDirection: "row", gap: 10 },
  calendarBox: { backgroundColor: "#ffffff", borderColor: "#d8d7cd", borderWidth: 1, borderRadius: 8, marginTop: 6, padding: 10 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  calendarNav: { minHeight: 34, minWidth: 58, borderRadius: 8, backgroundColor: "#e6eee8", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  calendarNavText: { color: "#176b51", fontSize: 12, fontWeight: "800" },
  calendarTitle: { color: "#263238", fontSize: 15, fontWeight: "900" },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekText: { flex: 1, textAlign: "center", color: "#6b746e", fontSize: 12, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1.25, alignItems: "center", justifyContent: "center", borderRadius: 8 },
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
  segment: { flexDirection: "row", backgroundColor: "#e8e3d8", borderRadius: 8, padding: 4, marginBottom: 12 },
  segmentItem: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 6, paddingHorizontal: 4 },
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
  paceCard: { backgroundColor: "#fffdf8", borderColor: "#e2ded2", borderWidth: 1, borderRadius: 8, padding: 13, marginBottom: 10 },
  paceHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kmText: { fontSize: 18, fontWeight: "900", color: "#263238" },
  gateLine: { marginTop: 10, fontSize: 13, color: "#42514a", fontWeight: "700" },
  badge: { minWidth: 72, minHeight: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  badgeText: { color: "#263238", fontSize: 12, fontWeight: "800" },
  tabbar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#ddd8ca", backgroundColor: "#fffdf8", paddingHorizontal: 6, paddingTop: 6, paddingBottom: Platform.OS === "ios" ? 18 : 8 },
  tabButton: { flex: 1, minHeight: 46, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  tabButtonActive: { backgroundColor: "#e4eee7" },
  tabText: { color: "#6b746e", fontWeight: "800", fontSize: 11 },
  tabTextActive: { color: "#176b51" }
});
