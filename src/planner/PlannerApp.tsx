import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OFFICIAL_RACE_DATA, OfficialRaceData } from "../data/raceData";
import {
  copyPlan,
  newPlan,
  PACE_STYLES,
  Plan,
  PlannerStore,
  uid,
} from "./model";
import {
  calculate,
  ENGINE_VERSION,
  cardPoints,
  clockText,
  elapsed,
  marginText,
  numberValue,
  paceText,
  pointLabel,
} from "./engine";
import { createRepository, parseBackup } from "./storage";
import {
  buildCardHtml,
  cardTime,
  comparisonResults,
  displayPoints,
  exportProblems,
} from "./cards";
import { pickBackup, printCard, saveText } from "./files";
const repository = createRepository(AsyncStorage);
const tabs = ["計画", "大会", "カード", "保存"] as const;
type Tab = (typeof tabs)[number];
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || pressed) && { opacity: 0.5 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: "#164d3c" }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  hint,
  small = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  small?: boolean;
}) {
  return (
    <View style={[s.field, small && { flex: 1, minWidth: 115 }]}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        style={s.input}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={160}
      />
      {hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}
function Choices<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.wrap}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          accessibilityRole="radio"
          aria-checked={value === o.id}
          accessibilityState={{ checked: value === o.id }}
          onPress={() => onChange(o.id)}
          style={[s.choice, value === o.id && s.selected]}
        >
          <Text style={[s.choiceText, value === o.id && s.selectedText]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {hint && <Text style={s.hint}>{hint}</Text>}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: "#164d3c" }}
      />
    </View>
  );
}
function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.panel}>
      {title && <Text style={s.heading}>{title}</Text>}
      {children}
    </View>
  );
}
function Messages({
  items,
  error = false,
}: {
  items: string[];
  error?: boolean;
}) {
  return items.length ? (
    <View style={[s.message, error && { backgroundColor: "#fff0ec" }]}>
      {items.map((v, i) => (
        <Text key={i} style={[s.body, error && { color: "#992d22" }]}>
          {v}
        </Text>
      ))}
    </View>
  ) : null;
}
function Planner() {
  const [store, setStore] = useState<PlannerStore | null>(null),
    [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("計画"),
    [notice, setNotice] = useState(""),
    [saved, setSaved] = useState("読込中");
  const [advanced, setAdvanced] = useState(false),
    [allRows, setAllRows] = useState(false);
  const [catalog, setCatalog] = useState(false),
    [search, setSearch] = useState(""),
    [privacy, setPrivacy] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    body: string;
    action: () => Promise<void> | void;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [undo, setUndo] = useState<Plan | null>(null);
  const current = useRef(store),
    scroll = useRef<ScrollView>(null),
    generation = useRef(0);
  current.current = store;
  useEffect(() => {
    repository
      .load()
      .then((r) => {
        setStore(r.store);
        setNotice(r.notice);
      })
      .catch((e) => setLoadError(String(e.message)));
  }, []);
  useEffect(() => {
    if (!store) return;
    const seq = ++generation.current;
    setSaved("保存中…");
    const timer = setTimeout(() => {
      repository
        .save(store)
        .then(() => {
          if (seq === generation.current) setSaved("端末に保存済み");
        })
        .catch((e) => {
          setSaved("保存できません");
          setNotice(
            `保存エラー：${e.message}。「保存」からバックアップを出力してください。`,
          );
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [store]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && current.current)
        repository.save(current.current).catch((e) => {
          setSaved("保存できません");
          setNotice(e.message);
        });
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const warn = (e: BeforeUnloadEvent) => {
      if (saved !== "端末に保存済み") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  const plan = store?.plans.find((p) => p.id === store.selectedId);
  const result = useMemo(() => (plan ? calculate(plan) : null), [plan]);
  function edit<K extends keyof Plan>(key: K, value: Plan[K]) {
    setStore(
      (old) =>
        old && {
          ...old,
          plans: old.plans.map((p) =>
            p.id === old.selectedId ? { ...p, [key]: value } : p,
          ),
        },
    );
  }
  function patch(changes: Partial<Plan>) {
    setStore(
      (old) =>
        old && {
          ...old,
          plans: old.plans.map((p) =>
            p.id === old.selectedId ? { ...p, ...changes } : p,
          ),
        },
    );
  }
  function move(next: Tab) {
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function add(p: Plan) {
    setStore(
      (old) => old && { ...old, plans: [...old.plans, p], selectedId: p.id },
    );
    setUndo(null);
    move("計画");
  }
  function removeRow(
    key: "gates" | "stops" | "terrain" | "overrides",
    id: string,
  ) {
    if (!plan) return;
    setUndo(JSON.parse(JSON.stringify(plan)));
    patch({ [key]: plan[key].filter((r) => r.id !== id) });
  }
  async function restore() {
    const text = await pickBackup();
    if (!text) return;
    const candidate = parseBackup(text);
    setConfirmation({
      title: "バックアップを復元",
      body: `${candidate.plans.length}件のプランを復元します。現在の内容は復元前のコピーとして保管します。`,
      action: async () => {
        if (current.current)
          await repository.preserveBeforeRestore(current.current);
        await repository.save(candidate);
        setStore(candidate);
        setLoadError("");
        setNotice("バックアップを復元しました。");
      },
    });
  }
  function selectRace(race: OfficialRaceData) {
    const p = newPlan();
    p.raceName = race.name;
    p.distance = String(race.distanceKm);
    p.date = race.officialEventDate || race.eventDate || "";
    p.startTime = race.startTime || "09:00";
    p.limit = race.timeLimitMinutes ? elapsed(race.timeLimitMinutes * 60) : "";
    p.sourceUrl = race.sources[0]?.url || "";
    p.sourceChecked = race.verifiedAt || "";
    p.sourceRevision = race.year ? String(race.year) : "";
    p.sourceStatus = "大会ひな型・最新要項の確認が必要";
    p.gates = race.checkpoints
      .filter((g) => g.closingTime)
      .map((g) => ({
        id: uid(),
        name: g.name,
        km: String(g.distanceKm),
        time: g.closingTime!,
        day: "0",
        kind: /勧告/.test(g.name) ? "advisory" : "official",
      }));
    p.terrain = race.sections
      .filter((t) => t.terrain !== "unknown")
      .map((t) => ({
        id: uid(),
        start: String(t.startKm),
        end: String(t.endKm),
        adjustment: "0",
        memo: t.description || t.terrain,
      }));
    add(p);
    setCatalog(false);
    move("大会");
    setNotice(
      "大会ひな型を新しい計画に追加しました。開催年・スタート・関門を公式要項と照合してください。",
    );
  }
  function exportCard() {
    if (!plan) return;
    const frozen = JSON.parse(JSON.stringify(plan)) as Plan;
    run(async () => {
      const html = buildCardHtml(frozen);
      await printCard(html);
      setStore(
        (old) =>
          old && {
            ...old,
            snapshots: [
              ...old.snapshots,
              {
                id: uid(),
                createdAt: new Date().toISOString(),
                plan: frozen,
                html,
                engineVersion: ENGINE_VERSION,
              },
            ],
          },
      );
      setNotice("印刷・共有画面を開きました。出力時の設定を保存しました。");
    });
  }
  const displayRows =
    result && plan
      ? result.rows.filter(
          (r) =>
            allRows || cardPoints(numberValue(plan.distance)).includes(r.mm),
        )
      : [];
  const problems = plan ? exportProblems(plan) : [];
  const compare = useMemo(() => (plan ? comparisonResults(plan) : []), [plan]);
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.top}>
        <View>
          <Text style={s.brand}>RUN FINISH PLANNER</Text>
          <Text style={s.hint}>レース前に整える、自分の走行計画。</Text>
        </View>
        <Text style={s.saved}>{saved}</Text>
      </View>
      <View style={s.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            aria-selected={tab === t}
            accessibilityState={{ selected: tab === t }}
            onPress={() => move(t)}
            style={[s.tab, tab === t && s.activeTab]}
          >
            <Text style={[s.tabText, tab === t && { color: "#164d3c" }]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {!!notice && (
          <Pressable
            accessibilityLabel="通知を閉じる"
            onPress={() => setNotice("")}
          >
            <Messages items={[notice, "タップして閉じる"]} />
          </Pressable>
        )}
        {!!loadError && (
          <Panel title="保存データの確認が必要です">
            <Messages items={[loadError]} error />
            <Button
              title="バックアップから復元"
              onPress={() => run(restore)}
              disabled={busy}
            />
            <Button
              title="現在の保存データを退避"
              secondary
              onPress={() =>
                run(async () =>
                  saveText(
                    "run-planner-recovery.json",
                    await repository.rawRecovery(),
                    "application/json",
                  ),
                )
              }
            />
          </Panel>
        )}
        {store && !plan && (
          <Panel title="計画を作成">
            <Button title="新しい計画" onPress={() => add(newPlan())} />
          </Panel>
        )}
        {plan && result && (
          <>
            <View style={s.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>{plan.name}</Text>
                <Text style={s.pageTitle}>
                  {tab === "計画"
                    ? "走り方を決める"
                    : tab === "大会"
                      ? "コースを整える"
                      : tab === "カード"
                        ? "当日は、この一枚で。"
                        : "計画を残す"}
                </Text>
                <Text style={s.body}>
                  {plan.raceName} · {plan.distance} km
                </Text>
              </View>
            </View>
            {!!plan.migrationNotes.length && (
              <Panel title="旧版から引き継いだ計画">
                <Messages items={plan.migrationNotes} />
                <Button
                  title="内容を確認済みにする"
                  secondary
                  onPress={() => edit("migrationNotes", [])}
                />
              </Panel>
            )}
            {undo && undo.id === plan.id && (
              <Button
                title="直前の行削除を元に戻す"
                secondary
                onPress={() => {
                  patch(undo);
                  setUndo(null);
                }}
              />
            )}
            {tab === "計画" && (
              <>
                <View style={s.hero}>
                  <Text style={s.heroLabel}>
                    予定フィニッシュ ·{" "}
                    {plan.timeBasis === "net" ? "ネット" : "号砲基準"}
                  </Text>
                  <Text style={s.bigTime}>
                    {elapsed(
                      plan.timeBasis === "net"
                        ? result.actualNet
                        : result.actualGun,
                    )}
                  </Text>
                  <View style={s.wrap}>
                    <Text style={s.heroSmall}>
                      移動平均 {paceText(result.averagePace)}/km
                    </Text>
                    <Text style={s.heroSmall}>
                      前半 {elapsed(result.firstHalf)} / 後半{" "}
                      {elapsed(result.secondHalf)}
                    </Text>
                  </View>
                </View>
                <Panel title="目標">
                  <Choices
                    value={plan.intent}
                    options={[
                      { id: "target", label: "目標タイム" },
                      { id: "pb", label: "自己ベスト更新" },
                      { id: "finish", label: "制限時間内の完走" },
                    ]}
                    onChange={(v) =>
                      patch({
                        intent: v,
                        showGates: v === "finish",
                        cardGates: v === "finish",
                        ...(v === "finish" ? { style: "even" as const } : {}),
                      })
                    }
                  />
                  {plan.intent === "target" && (
                    <>
                      <Choices
                        value={plan.inputKind}
                        options={[
                          { id: "time", label: "タイムで入力" },
                          { id: "pace", label: "平均ペースで入力" },
                        ]}
                        onChange={(v) => edit("inputKind", v)}
                      />
                      {plan.inputKind === "time" ? (
                        <Field
                          label="目標タイム（時:分:秒）"
                          value={plan.target}
                          onChange={(v) => edit("target", v)}
                        />
                      ) : (
                        <Field
                          label="移動平均ペース（分:秒/km）"
                          value={plan.pace}
                          onChange={(v) => edit("pace", v)}
                          hint="停止時間は別に加算します。"
                        />
                      )}
                    </>
                  )}
                  {plan.intent === "pb" && (
                    <View style={s.wrap}>
                      <Field
                        small
                        label="自己ベスト（時:分:秒）"
                        value={plan.pb}
                        onChange={(v) => edit("pb", v)}
                      />
                      <Field
                        small
                        label="短縮したい秒数"
                        value={plan.pbGainSeconds}
                        onChange={(v) => edit("pbGainSeconds", v)}
                      />
                    </View>
                  )}
                  {plan.intent === "finish" && (
                    <>
                      <View style={s.wrap}>
                        <Field
                          small
                          label="締切に残す余裕（分）"
                          value={plan.bufferMinutes}
                          onChange={(v) => edit("bufferMinutes", v)}
                        />
                        <Field
                          small
                          label="走れる最速ペース（分:秒/km・任意）"
                          value={plan.fastestPace}
                          onChange={(v) => edit("fastestPace", v)}
                        />
                      </View>
                      <Text style={s.hint}>
                        登録した正式関門とフィニッシュ制限のすべてに、指定の余裕を残す配分を求めます。余裕0分でも締切ちょうどを避けます。
                      </Text>
                      <Button
                        title="制限時間・関門を設定"
                        secondary
                        onPress={() => move("大会")}
                      />
                    </>
                  )}
                  <Choices
                    value={plan.timeBasis}
                    options={[
                      { id: "net", label: "ネットタイム" },
                      { id: "gun", label: "号砲からのタイム" },
                    ]}
                    onChange={(v) => edit("timeBasis", v)}
                  />
                  <Text style={s.hint}>
                    ネットはスタートライン通過から。関門は大会号砲・時刻を基準に判定します。
                  </Text>
                </Panel>
                <Panel title="ペース配分">
                  <View style={s.wrap}>
                    {PACE_STYLES.map((choice) => {
                      const disabled =
                        plan.intent === "finish" &&
                        choice.id !== "even" &&
                        choice.id !== "custom";
                      return (
                        <Pressable
                          key={choice.id}
                          accessibilityRole="radio"
                          aria-checked={plan.style === choice.id}
                          aria-disabled={disabled}
                          accessibilityState={{
                            checked: plan.style === choice.id,
                            disabled,
                          }}
                          disabled={disabled}
                          onPress={() => edit("style", choice.id)}
                          style={[
                            s.paceChoice,
                            plan.style === choice.id && s.selected,
                            disabled && { opacity: 0.4 },
                          ]}
                        >
                          <Text
                            style={[
                              s.label,
                              plan.style === choice.id && s.selectedText,
                            ]}
                          >
                            {choice.label}
                          </Text>
                          <Text
                            style={[
                              s.hint,
                              plan.style === choice.id && s.selectedText,
                            ]}
                          >
                            {choice.detail}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {plan.intent === "finish" && (
                    <Text style={s.hint}>
                      制限完走は一定ペースを基本に、必要な区間だけ直接指定できます。
                    </Text>
                  )}
                  {plan.style === "custom" && (
                    <>
                      <Field
                        label="前半より後半を短くする秒数"
                        value={plan.splitSeconds}
                        onChange={(v) => edit("splitSeconds", v)}
                        hint={
                          plan.intent === "finish"
                            ? "制限完走では前後半差を使用せず、下の区間指定を使います。"
                            : "300なら後半を5分速く、−300なら5分遅く。0は均等。"
                        }
                      />
                      {plan.overrides.map((row, i) => (
                        <View style={s.editRow} key={row.id}>
                          <Text style={s.label}>直接指定 {i + 1}</Text>
                          <View style={s.wrap}>
                            {(["start", "end", "pace"] as const).map(
                              (key, j) => (
                                <Field
                                  small
                                  key={key}
                                  label={
                                    ["開始 km", "終了 km", "ペース 分:秒/km"][j]
                                  }
                                  value={row[key]}
                                  onChange={(v) =>
                                    edit(
                                      "overrides",
                                      plan.overrides.map((r) =>
                                        r.id === row.id
                                          ? { ...r, [key]: v }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                              ),
                            )}
                          </View>
                          <Button
                            title={`直接指定 ${i + 1} を削除`}
                            secondary
                            onPress={() => removeRow("overrides", row.id)}
                          />
                        </View>
                      ))}
                      <Button
                        title="区間ペースを追加"
                        secondary
                        onPress={() =>
                          edit("overrides", [
                            ...plan.overrides,
                            { id: uid(), start: "0", end: "5", pace: "5:00" },
                          ])
                        }
                      />
                    </>
                  )}
                  {plan.style !== "custom" && !!plan.overrides.length && (
                    <Text style={s.hint}>
                      直接指定の区間は「自分で設定」に戻すと使用できます。
                    </Text>
                  )}
                  <Toggle
                    label="コースによるペース補正"
                    value={plan.elevation}
                    onChange={(v) => edit("elevation", v)}
                    hint="ペース配分とは独立した設定です。補正値は大会画面で指定します。"
                  />
                  {plan.elevation && (
                    <Button
                      title="区間ごとの補正を設定"
                      secondary
                      onPress={() => move("大会")}
                    />
                  )}
                  {(plan.elevation || plan.style === "custom") &&
                    plan.intent !== "finish" && (
                      <>
                        <Choices
                          value={plan.adjustmentMode}
                          options={[
                            { id: "goal", label: "目標タイムを維持" },
                            { id: "fixed", label: "他の区間を維持" },
                          ]}
                          onChange={(v) => edit("adjustmentMode", v)}
                        />
                        <Text style={s.hint}>
                          目標維持は未指定区間で再配分。他の区間を維持すると到着予定が変わります。
                        </Text>
                      </>
                    )}
                </Panel>
                <Panel title="スタートと関門">
                  {plan.intent !== "finish" && (
                    <Toggle
                      label="関門の余裕を表示"
                      value={plan.showGates}
                      onChange={(v) => edit("showGates", v)}
                      hint="非表示でも、登録した締切の超過は確認します。"
                    />
                  )}
                  <Button
                    title={
                      advanced ? "スタート詳細を閉じる" : "スタートの遅れを設定"
                    }
                    secondary
                    onPress={() => setAdvanced(!advanced)}
                  />
                  {advanced && (
                    <View style={s.wrap}>
                      <Field
                        small
                        label="大会号砲（時:分）"
                        value={plan.startTime}
                        onChange={(v) => edit("startTime", v)}
                      />
                      <Field
                        small
                        label="ウェーブ号砲（任意）"
                        value={plan.waveTime}
                        onChange={(v) => edit("waveTime", v)}
                      />
                      <Field
                        small
                        label="号砲後ライン通過まで（分）"
                        value={plan.delayMinutes}
                        onChange={(v) => edit("delayMinutes", v)}
                      />
                    </View>
                  )}
                </Panel>
                <Messages items={result.errors} error />
                <Messages items={result.warnings} />
                <Panel title="通過予定">
                  <Text style={s.hint}>
                    累計時間はスタートライン通過から。秒は切り上げ表示します。
                  </Text>
                  <View style={s.tableRow}>
                    <Text style={s.cell}>地点</Text>
                    <Text style={s.numeric}>累計時間</Text>
                    <Text style={s.numeric}>通過時刻</Text>
                  </View>
                  {displayRows.map((r) => (
                    <View key={r.mm} style={s.tableRow}>
                      <Text style={s.cell}>
                        {pointLabel(r.km, numberValue(plan.distance))}
                      </Text>
                      <Text style={s.numeric}>{elapsed(r.pass)}</Text>
                      <Text style={s.numeric}>
                        {clockText(result.start + r.pass)}
                      </Text>
                    </View>
                  ))}
                  <Button
                    title={
                      allRows ? "主要地点だけ表示" : "1km・関門・停止地点も表示"
                    }
                    secondary
                    onPress={() => setAllRows(!allRows)}
                  />
                  {(plan.showGates || plan.intent === "finish") && (
                    <>
                      <Text style={s.heading}>関門の余裕</Text>
                      {result.gates.map((g) => (
                        <Text key={g.gate.id} style={s.body}>
                          {g.gate.km} km · {g.gate.name}
                          {g.advisory ? "（参考）" : ""}　{marginText(g.margin)}
                        </Text>
                      ))}
                      {result.finishMargin !== null && (
                        <Text style={s.body}>
                          フィニッシュ　{marginText(result.finishMargin)}
                        </Text>
                      )}
                      {!result.gates.length && (
                        <Text style={s.hint}>正式関門は未登録です。</Text>
                      )}
                    </>
                  )}
                </Panel>
                <Button
                  title="早見カードを作る"
                  onPress={() => move("カード")}
                />
                <Button
                  title="この計画を複製して比較する"
                  secondary
                  onPress={() => add(copyPlan(plan))}
                />
              </>
            )}
            {tab === "大会" && (
              <>
                <Panel title="計画を選ぶ">
                  <View style={s.wrap}>
                    <Button
                      title="大会ひな型から追加"
                      onPress={() => setCatalog(true)}
                    />
                    <Button
                      title="空の計画を追加"
                      secondary
                      onPress={() => add(newPlan())}
                    />
                  </View>
                  <Choices
                    value={plan.id}
                    options={store!.plans.map((p) => ({
                      id: p.id,
                      label: `${p.raceName} · ${p.name}`,
                    }))}
                    onChange={(v) => {
                      setStore((old) => old && { ...old, selectedId: v });
                      setUndo(null);
                    }}
                  />
                </Panel>
                <Panel title="大会と計画">
                  <Field
                    label="大会名"
                    value={plan.raceName}
                    onChange={(v) => edit("raceName", v)}
                  />
                  <Field
                    label="計画名"
                    value={plan.name}
                    onChange={(v) => edit("name", v)}
                  />
                  <View style={s.wrap}>
                    <Field
                      small
                      label="開催日（YYYY-MM-DD）"
                      value={plan.date}
                      onChange={(v) => edit("date", v)}
                    />
                    <Field
                      small
                      label="距離（km）"
                      value={plan.distance}
                      onChange={(v) => edit("distance", v)}
                    />
                  </View>
                  <View style={s.wrap}>
                    <Field
                      small
                      label="大会号砲（時:分）"
                      value={plan.startTime}
                      onChange={(v) => edit("startTime", v)}
                    />
                    <Field
                      small
                      label="完走制限（時:分:秒）"
                      value={plan.limit}
                      onChange={(v) => edit("limit", v)}
                    />
                  </View>
                  <Text style={s.hint}>
                    完走制限は大会号砲からの経過時間です。大会ひな型は最新要項の確認が必要です。
                  </Text>
                  <Field
                    label="公式要項URL（任意）"
                    value={plan.sourceUrl}
                    onChange={(v) => edit("sourceUrl", v)}
                  />
                  <Field
                    label="要項を確認した日（任意）"
                    value={plan.sourceChecked}
                    onChange={(v) => edit("sourceChecked", v)}
                  />
                  <Text style={s.hint}>
                    {plan.sourceStatus} {plan.sourceRevision}
                  </Text>
                  {/^https?:\/\//.test(plan.sourceUrl) && (
                    <Button
                      title="公式要項を開く"
                      secondary
                      onPress={() =>
                        run(async () => {
                          await Linking.openURL(plan.sourceUrl);
                        })
                      }
                    />
                  )}
                </Panel>
                <Panel title="関門">
                  {plan.gates.map((row, i) => (
                    <View style={s.editRow} key={row.id}>
                      <Field
                        label={`関門 ${i + 1} の名称`}
                        value={row.name}
                        onChange={(v) =>
                          edit(
                            "gates",
                            plan.gates.map((r) =>
                              r.id === row.id ? { ...r, name: v } : r,
                            ),
                          )
                        }
                      />
                      <View style={s.wrap}>
                        {(["km", "time", "day"] as const).map((key, j) => (
                          <Field
                            small
                            key={key}
                            label={
                              [
                                "距離 km",
                                "閉鎖時刻 時:分",
                                "翌日なら1（当日0）",
                              ][j]
                            }
                            value={row[key]}
                            onChange={(v) =>
                              edit(
                                "gates",
                                plan.gates.map((r) =>
                                  r.id === row.id ? { ...r, [key]: v } : r,
                                ),
                              )
                            }
                          />
                        ))}
                      </View>
                      <Choices
                        value={row.kind}
                        options={[
                          { id: "official", label: "正式な関門" },
                          { id: "advisory", label: "参考・勧告時刻" },
                        ]}
                        onChange={(v) =>
                          edit(
                            "gates",
                            plan.gates.map((r) =>
                              r.id === row.id ? { ...r, kind: v } : r,
                            ),
                          )
                        }
                      />
                      <Button
                        title={`関門 ${i + 1} を削除`}
                        secondary
                        onPress={() => removeRow("gates", row.id)}
                      />
                    </View>
                  ))}
                  <Button
                    title="関門を追加"
                    secondary
                    onPress={() =>
                      edit("gates", [
                        ...plan.gates,
                        {
                          id: uid(),
                          name: "関門",
                          km: "10",
                          time: "11:00",
                          day: "0",
                          kind: "official",
                        },
                      ])
                    }
                  />
                  <Text style={s.hint}>
                    同じ1km区間内の複数関門も、それぞれの正確な距離で計算します。
                  </Text>
                </Panel>
                <Panel title="給水・補給などの停止">
                  {plan.stops.map((row, i) => (
                    <View style={s.editRow} key={row.id}>
                      <View style={s.wrap}>
                        {(["km", "seconds", "memo"] as const).map((key, j) => (
                          <Field
                            small
                            key={key}
                            label={["停止地点 km", "停止時間 秒", "メモ"][j]}
                            value={row[key]}
                            onChange={(v) =>
                              edit(
                                "stops",
                                plan.stops.map((r) =>
                                  r.id === row.id ? { ...r, [key]: v } : r,
                                ),
                              )
                            }
                          />
                        ))}
                      </View>
                      <Toggle
                        label="同地点の関門を通過してから停止"
                        value={row.afterGate}
                        onChange={(v) =>
                          edit(
                            "stops",
                            plan.stops.map((r) =>
                              r.id === row.id ? { ...r, afterGate: v } : r,
                            ),
                          )
                        }
                      />
                      <Button
                        title={`停止 ${i + 1} を削除`}
                        secondary
                        onPress={() => removeRow("stops", row.id)}
                      />
                    </View>
                  ))}
                  <Button
                    title="停止を追加"
                    secondary
                    onPress={() =>
                      edit("stops", [
                        ...plan.stops,
                        {
                          id: uid(),
                          km: "20",
                          seconds: "30",
                          memo: "補給",
                          afterGate: false,
                        },
                      ])
                    }
                  />
                </Panel>
                <Panel title="コースによるペース補正">
                  <Text style={s.hint}>
                    例：上りで1kmあたり10秒遅くするなら10、下りで5秒速くするなら−5。高低差からの自動推定ではありません。
                  </Text>
                  {plan.terrain.map((row, i) => (
                    <View style={s.editRow} key={row.id}>
                      <View style={s.wrap}>
                        {(["start", "end", "adjustment"] as const).map(
                          (key, j) => (
                            <Field
                              small
                              key={key}
                              label={["開始 km", "終了 km", "補正 秒/km"][j]}
                              value={row[key]}
                              onChange={(v) =>
                                edit(
                                  "terrain",
                                  plan.terrain.map((r) =>
                                    r.id === row.id ? { ...r, [key]: v } : r,
                                  ),
                                )
                              }
                            />
                          ),
                        )}
                      </View>
                      <Field
                        label="区間メモ"
                        value={row.memo}
                        onChange={(v) =>
                          edit(
                            "terrain",
                            plan.terrain.map((r) =>
                              r.id === row.id ? { ...r, memo: v } : r,
                            ),
                          )
                        }
                      />
                      <Button
                        title={`補正 ${i + 1} を削除`}
                        secondary
                        onPress={() => removeRow("terrain", row.id)}
                      />
                    </View>
                  ))}
                  <Button
                    title="補正区間を追加"
                    secondary
                    onPress={() =>
                      edit("terrain", [
                        ...plan.terrain,
                        {
                          id: uid(),
                          start: "0",
                          end: "5",
                          adjustment: "0",
                          memo: "",
                        },
                      ])
                    }
                  />
                  <Toggle
                    label="計画に補正を適用"
                    value={plan.elevation}
                    onChange={(v) => edit("elevation", v)}
                  />
                </Panel>
                <Button
                  title="この計画を削除済みに移す"
                  secondary
                  onPress={() =>
                    setConfirmation({
                      title: "計画を削除済みに移す",
                      body: "保存画面から戻せます。",
                      action: () => {
                        setStore((old) => {
                          if (!old) return old;
                          const remaining = old.plans.filter(
                            (p) => p.id !== plan.id,
                          );
                          return {
                            ...old,
                            plans: remaining,
                            selectedId: remaining[0]?.id || "",
                            trash: [...old.trash, plan],
                          };
                        });
                        move("保存");
                      },
                    })
                  }
                />
              </>
            )}
            {tab === "カード" && (
              <>
                <Panel title="カードの設定">
                  <Choices
                    value={plan.cardMode}
                    options={[
                      { id: "single", label: "1案を大きく" },
                      { id: "compare", label: "3案を比較" },
                      { id: "both", label: "両方作る" },
                    ]}
                    onChange={(v) => edit("cardMode", v)}
                  />
                  {plan.cardMode !== "single" && (
                    <View style={s.wrap}>
                      {plan.comparison.map((time, i) => (
                        <Field
                          small
                          key={i}
                          label={`比較案 ${i + 1}（時:分:秒）`}
                          value={time}
                          onChange={(v) => {
                            const values = [
                              ...plan.comparison,
                            ] as Plan["comparison"];
                            values[i] = v;
                            edit("comparison", values);
                          }}
                        />
                      ))}
                    </View>
                  )}
                  <Choices
                    value={plan.cardFormat}
                    options={[
                      { id: "pocket", label: "ポケット用" },
                      { id: "wrist", label: "手首用" },
                    ]}
                    onChange={(v) => edit("cardFormat", v)}
                  />
                  <Choices
                    value={plan.cardClock}
                    options={[
                      { id: "net", label: "ネット累計" },
                      { id: "gun", label: "号砲からの累計" },
                    ]}
                    onChange={(v) => edit("cardClock", v)}
                  />
                  <Toggle
                    label="関門・余裕を載せる"
                    value={plan.cardGates}
                    onChange={(v) => edit("cardGates", v)}
                  />
                  <Toggle
                    label="停止・補給メモを載せる"
                    value={plan.cardNotes}
                    onChange={(v) => edit("cardNotes", v)}
                  />
                  <Toggle
                    label="コース補正値を載せる"
                    value={plan.cardTerrain}
                    onChange={(v) => edit("cardTerrain", v)}
                  />
                  <Text style={s.hint}>
                    1案は幅90mm、手首用は40mm。3案比較は読みやすさのため幅100mmです。地点が多い場合は複数枚に分け、行を省略しません。
                  </Text>
                </Panel>
                <Messages items={problems} error />
                <Panel title="累計時間プレビュー">
                  <Text style={s.hint}>
                    印刷画面には大会名・時間基準・選択した補足も表示されます。
                  </Text>
                  <ScrollView horizontal>
                    <View
                      style={{
                        minWidth: plan.cardMode === "single" ? 275 : 440,
                      }}
                    >
                      <View style={s.tableRow}>
                        <Text style={s.cell}>距離</Text>
                        {(plan.cardMode === "single"
                          ? ["累計時間"]
                          : plan.comparison
                        ).map((label, i) => (
                          <Text key={i} style={s.numeric}>
                            {label}
                          </Text>
                        ))}
                      </View>
                      {displayPoints(plan).map((point) => (
                        <View key={point} style={s.tableRow}>
                          <Text style={s.cell}>
                            {pointLabel(
                              point / 1e6,
                              numberValue(plan.distance),
                            )}
                          </Text>
                          {(plan.cardMode === "single"
                            ? [result]
                            : compare
                          ).map((r, i) => (
                            <Text key={i} style={s.numeric}>
                              {cardTime(plan, r, point)}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                  {plan.cardMode === "both" && (
                    <Text style={s.hint}>1案のカードも同時に出力します。</Text>
                  )}
                </Panel>
                <Button
                  title={busy ? "準備中…" : "印刷・PDF・共有"}
                  disabled={busy || !!problems.length}
                  onPress={exportCard}
                />
                <Text style={s.hint}>
                  大会前に印刷し、持参してください。走行中のアプリ操作は必要ありません。
                </Text>
              </>
            )}
          </>
        )}
        {store && tab === "保存" && (
          <>
            <Panel title="バックアップ">
              <Text style={s.body}>
                計画はこの端末・ブラウザに保存します。別の端末に移すときやブラウザデータを消す前に、JSONファイルを保管してください。
              </Text>
              <Button
                title="バックアップを保存"
                disabled={busy}
                onPress={() =>
                  run(async () =>
                    saveText(
                      `run-planner-${new Date().toISOString().slice(0, 10)}.json`,
                      JSON.stringify(store, null, 2),
                      "application/json",
                    ),
                  )
                }
              />
              <Button
                title="バックアップから復元"
                secondary
                disabled={busy}
                onPress={() => run(restore)}
              />
              <Button
                title="端末への保存を再試行"
                secondary
                onPress={() =>
                  run(async () => {
                    await repository.save(store);
                    setSaved("端末に保存済み");
                    setNotice("保存内容を確認しました。");
                  })
                }
              />
              <Button
                title="復元前の内容に戻す"
                secondary
                onPress={() =>
                  run(async () => {
                    const previous = await repository.previousRestore();
                    if (!previous)
                      throw new Error("復元前のコピーはありません。");
                    setConfirmation({
                      title: "復元前に戻す",
                      body: "現在の内容と復元前のコピーを入れ替えます。",
                      action: async () => {
                        await repository.preserveBeforeRestore(store);
                        await repository.save(previous);
                        setStore(previous);
                      },
                    });
                  })
                }
              />
            </Panel>
            <Panel title="カード出力時の設定">
              {!store.snapshots.length && (
                <Text style={s.hint}>
                  カードを出力すると、その時点の計画をここに残します。
                </Text>
              )}
              {[...store.snapshots].reverse().map((snapshot) => (
                <View style={s.editRow} key={snapshot.id}>
                  <Text style={s.body}>
                    {snapshot.plan.raceName} · {snapshot.plan.name}
                  </Text>
                  <Text style={s.hint}>
                    {new Date(snapshot.createdAt).toLocaleString("ja-JP")}
                  </Text>
                  <Button
                    title="この設定を新しい計画として開く"
                    secondary
                    onPress={() => add(copyPlan(snapshot.plan))}
                  />
                </View>
              ))}
            </Panel>
            <Panel title="削除済みの計画">
              {!store.trash.length && (
                <Text style={s.hint}>削除済みの計画はありません。</Text>
              )}
              {store.trash.map((p) => (
                <View style={s.editRow} key={p.id}>
                  <Text style={s.body}>
                    {p.raceName} · {p.name}
                  </Text>
                  <Button
                    title="計画を戻す"
                    secondary
                    onPress={() =>
                      setStore(
                        (old) =>
                          old && {
                            ...old,
                            plans: [...old.plans, p],
                            selectedId: p.id,
                            trash: old.trash.filter((t) => t.id !== p.id),
                          },
                      )
                    }
                  />
                </View>
              ))}
            </Panel>
            {!!store.legacyArchive && (
              <Panel title="旧版データの原文">
                <Text style={s.body}>
                  練習記録や旧手動ラップを含め、移行前の内容を保管しています。
                </Text>
                <Button
                  title="旧版データを保存"
                  secondary
                  onPress={() =>
                    run(async () =>
                      saveText(
                        "run-planner-legacy.json",
                        JSON.stringify(store.legacyArchive, null, 2),
                        "application/json",
                      ),
                    )
                  }
                />
              </Panel>
            )}
            <Panel title="アプリについて">
              <Text style={s.body}>RUN Finish Planner 2.0.0</Text>
              <Button
                title="プライバシー・データの取り扱い"
                secondary
                onPress={() => setPrivacy(true)}
              />
              <Button
                title="不具合・お問い合わせ"
                secondary
                onPress={() =>
                  run(async () => {
                    await Linking.openURL(
                      "https://github.com/T-Makishi/marathon-finish-planner/issues",
                    );
                  })
                }
              />
              <Text style={s.hint}>PCSAPO / マキシ企画</Text>
            </Panel>
          </>
        )}
        <Text style={s.footer}>PLAN YOUR RACE. RUN YOUR PLAN.</Text>
      </ScrollView>
      <Modal
        visible={catalog}
        animationType="slide"
        onRequestClose={() => setCatalog(false)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.content}>
            <Button
              title="閉じる"
              secondary
              onPress={() => setCatalog(false)}
            />
            <Text style={s.pageTitle}>大会ひな型</Text>
            <Text style={s.body}>
              最新の開催要項を確認してから使います。選ぶと新しい計画を追加します。
            </Text>
            <Field
              label="大会名・都道府県で検索"
              value={search}
              onChange={setSearch}
            />
            {OFFICIAL_RACE_DATA.filter(
              (r) =>
                r.publicationAllowed !== false &&
                `${r.name}${r.prefecture}`.includes(search),
            ).map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                onPress={() => selectRace(r)}
                style={s.panel}
              >
                <Text style={s.heading}>{r.name}</Text>
                <Text style={s.hint}>
                  {r.prefecture} · {r.distanceKm} km · 最新要項の確認が必要
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!confirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmation(null)}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.heading}>{confirmation?.title}</Text>
            <Text style={s.body}>{confirmation?.body}</Text>
            <Button
              title="実行する"
              disabled={busy}
              onPress={() => {
                const action = confirmation?.action;
                setConfirmation(null);
                if (action)
                  run(async () => {
                    await action();
                  });
              }}
            />
            <Button
              title="キャンセル"
              secondary
              onPress={() => setConfirmation(null)}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={privacy}
        animationType="slide"
        onRequestClose={() => setPrivacy(false)}
      >
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.content}>
            <Button
              title="閉じる"
              secondary
              onPress={() => setPrivacy(false)}
            />
            <Panel title="プライバシー・データの取り扱い">
              <Text style={s.body}>
                計画、自己ベスト、入力した大会情報は端末内に保存します。アプリから運営者への送信、位置情報の取得、広告、解析SDK、アカウント登録はありません。
              </Text>
              <Text style={s.body}>
                Web版の配信にはGitHub
                Pagesを使用し、配信事業者がアクセス時のIPアドレスなどを処理する場合があります。外部サイトを開くと、そのサイトの方針が適用されます。
              </Text>
              <Text style={s.body}>
                バックアップ、印刷、共有は利用者が操作したときに行います。共有先・保管先は利用者が選択します。削除済みの計画、復元前のコピー、旧版データも端末に残ります。完全に消去するには、このサイトの保存データをブラウザ設定から消去するか、iOSアプリを削除してください。外部に保存したファイルは別途削除してください。
              </Text>
              <Text style={s.body}>
                お問い合わせ：GitHubのプロジェクト「T-Makishi/marathon-finish-planner」のIssues。個人情報を含む内容は公開投稿しないでください。
              </Text>
              <Text style={s.hint}>2026年9月12日 / PCSAPO / マキシ企画</Text>
            </Panel>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
export default function PlannerApp() {
  return (
    <SafeAreaProvider>
      <Planner />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f6f1" },
  top: {
    paddingHorizontal: 20,
    paddingVertical: 17,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  brand: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#164d3c",
  },
  saved: { fontSize: 11, color: "#53695e", maxWidth: 86 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#dae2d9",
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderBottomWidth: 3,
    borderColor: "transparent",
  },
  activeTab: { borderColor: "#164d3c" },
  tabText: { fontSize: 15, fontWeight: "700", color: "#78847a" },
  content: {
    padding: 18,
    gap: 16,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingBottom: 60,
  },
  titleRow: { paddingVertical: 8 },
  eyebrow: { fontSize: 12, color: "#637a6a", marginBottom: 6 },
  pageTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#153d30",
    marginBottom: 8,
  },
  panel: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e6dc",
    gap: 15,
  },
  heading: { fontSize: 18, fontWeight: "700", color: "#193e30" },
  body: { fontSize: 14, lineHeight: 23, color: "#354d40" },
  hint: { fontSize: 12, lineHeight: 19, color: "#65746a" },
  field: { gap: 7 },
  label: { fontSize: 14, lineHeight: 21, fontWeight: "600", color: "#294938" },
  input: {
    minHeight: 47,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#cbd7ce",
    borderRadius: 9,
    fontSize: 17,
    color: "#133b2c",
    backgroundColor: "#fcfdfa",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: {
    minHeight: 46,
    paddingVertical: 13,
    paddingHorizontal: 17,
    backgroundColor: "#164d3c",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "#eef3eb",
    borderWidth: 1,
    borderColor: "#d2dfd1",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  choice: {
    borderWidth: 1,
    borderColor: "#cad8ca",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f9fbf6",
    minHeight: 44,
  },
  choiceText: { fontSize: 13, color: "#35513e", fontWeight: "600" },
  selected: { backgroundColor: "#164d3c", borderColor: "#164d3c" },
  selectedText: { color: "#fff" },
  paceChoice: {
    flexGrow: 1,
    flexBasis: "44%",
    gap: 5,
    borderWidth: 1,
    borderColor: "#d0dbd0",
    padding: 15,
    borderRadius: 12,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 5,
  },
  hero: { backgroundColor: "#164d3c", padding: 23, borderRadius: 20, gap: 12 },
  heroLabel: { color: "#d4e8cb", fontSize: 13 },
  bigTime: {
    color: "#f1ffc6",
    fontSize: 49,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  heroSmall: { color: "#e0efd9", fontSize: 13 },
  message: {
    padding: 16,
    backgroundColor: "#fff6d9",
    borderRadius: 12,
    gap: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#e0e7dc",
    paddingVertical: 13,
    gap: 5,
    alignItems: "center",
  },
  cell: { flex: 1, minWidth: 65, fontSize: 13, color: "#3d5945" },
  numeric: {
    flex: 1,
    minWidth: 82,
    fontSize: 15,
    textAlign: "right",
    color: "#164d3c",
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  editRow: {
    padding: 15,
    backgroundColor: "#f5f8f1",
    borderRadius: 12,
    gap: 12,
  },
  footer: {
    color: "#82927d",
    textAlign: "center",
    fontSize: 10,
    letterSpacing: 2,
    paddingTop: 24,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#10271e88",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 460,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 20,
    gap: 20,
  },
});
