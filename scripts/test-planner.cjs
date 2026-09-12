const fs = require("node:fs");
const ts = require("typescript");
const assert = require("node:assert/strict");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    filename,
  );
const { newPlan, newStore } = require("../src/planner/model.ts");
const {
  calculate,
  elapsed,
  paceText,
  cardPoints,
  duration,
  clockText,
} = require("../src/planner/engine.ts");
const {
  buildCardHtml,
  buildPrintLayout,
  printedTotal,
  cardTime,
  comparisonResults,
  exportProblems,
  displayPoints,
} = require("../src/planner/cards.ts");
const {
  createRepository,
  parseStore,
  parseBackup,
  migrateLegacy,
  LEGACY_KEY,
} = require("../src/planner/storage.ts");
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const close = (a, b, tolerance = 1e-5) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const plan = (extra) => ({ ...newPlan(), ...extra });
const gate = (km, time, kind = "official", id = String(km)) => ({
  id,
  name: `関門${id}`,
  km: String(km),
  time,
  day: "0",
  kind,
});
const stop = (km, seconds, afterGate = false) => ({
  id: `${km}-${afterGate}`,
  km: String(km),
  seconds: String(seconds),
  afterGate,
  memo: "補給",
});
const terrain = {
  id: "t",
  start: "0",
  end: "5",
  adjustment: "20",
  memo: "上り",
};
const manual = { id: "m", start: "0", end: "5", pace: "5:30" };
const kv = () => {
  const map = new Map();
  return {
    map,
    getItem: async (k) => map.get(k) ?? null,
    removeItem: async (k) => { map.delete(k); },
    setItem: async (k, v) => {
      map.set(k, v);
    },
  };
};
test("first use seeds one valid four-hour sample and persists it", async () => {
  const db = kv();
  const first = (await createRepository(db).load()).store;
  assert.equal(first.plans.length, 1);
  const p = first.plans[0];
  assert.equal(p.raceName, "使い方サンプル｜フルマラソン");
  assert.deepEqual(p.comparison, ["03:55:00", "04:00:00", "04:05:00"]);
  assert.equal(p.style, "even");
  assert.equal(p.gates.length + p.stops.length + p.terrain.length, 0);
  assert.equal(calculate(p).errors.length, 0);
  close(calculate(p).actualNet, 14400);
  assert.equal(exportProblems(p).length, 0);
  assert.equal((await createRepository(db).load()).store.selectedId, p.id);
});
test("existing plans are never supplemented with a sample", async () => {
  const db = kv(), existing = newStore();
  await createRepository(db).save(existing);
  assert.deepEqual((await createRepository(db).load()).store.plans, existing.plans);
});
test("sample stays deleted after permanent removal and reload", async () => {
  const db = kv(), repo = createRepository(db);
  const store = (await repo.load()).store;
  const sample = store.plans[0], replacement = newPlan();
  store.plans = [replacement]; store.selectedId = replacement.id; store.trash = [sample];
  await repo.save(store);
  await repo.purgeTrash(store, [sample.id]);
  const loaded = (await createRepository(db).load()).store;
  assert.deepEqual(loaded.plans, [replacement]);
  assert.equal(loaded.trash.length, 0);
});
test("zero plans survive purge, reload, backup and new race registration", async () => {
  const db = kv(), repo = createRepository(db);
  const initial = (await repo.load()).store;
  const sample = initial.plans[0];
  await repo.preserveBeforeRestore(initial);
  const empty = { ...initial, plans: [], selectedId: "", trash: [sample] };
  await repo.save(empty);
  await repo.purgeTrash(empty, [sample.id]);
  const loaded = (await createRepository(db).load()).store;
  assert.equal(loaded.plans.length, 0);
  assert.equal(loaded.trash.length, 0);
  assert.equal(parseBackup(JSON.stringify(loaded)).plans.length, 0);
  const recovery = await repo.previousRestore();
  assert.equal(recovery.plans.length, 0);
  assert.equal(recovery.selectedId, "");
  const { applyRaceForm, emptyRaceForm } = require('../src/planner/raceForm.ts');
  const draft = { ...emptyRaceForm(), raceName: '登録確認', name: 'プランA', distance: '42.195', startTime: '09:00' };
  const next = applyRaceForm(loaded, draft, null);
  await repo.save(next);
  assert.equal((await createRepository(db).load()).store.plans[0].raceName, '登録確認');
});
test("full marathon finish is exactly target", () => {
  const r = calculate(plan());
  close(r.actualNet, 12600);
  assert.equal(elapsed(r.actualNet), "3:30:00");
  assert.equal(r.errors.length, 0);
});
test("standard card has 11 points, half and finish exactly once", () => {
  const p = cardPoints(42.195);
  assert.equal(p.length, 11);
  assert.ok(p.includes(21097500));
  assert.equal(p.at(-1), 42195000);
});
test("invalid distance never crashes preview", () => {
  for (const n of [NaN, Infinity, -1, 1e12, 0])
    assert.deepEqual(cardPoints(n), []);
  for (const distance of ["", "NaN", "0", "0.0000001", "1001"])
    assert.ok(calculate(plan({ distance })).errors.length);
});
for (const [style, delta] of [
  ["negative-5", 300],
  ["negative-10", 600],
  ["positive-5", -300],
  ["positive-10", -600],
])
  test(`${style} exact half difference`, () => {
    const r = calculate(plan({ style }));
    close(r.firstHalf - r.secondHalf, delta);
    close(r.actualNet, 12600);
  });
test("custom seconds-level split", () => {
  const r = calculate(plan({ style: "custom", splitSeconds: "37" }));
  close(r.firstHalf - r.secondHalf, 37);
});
test("split budgets include stops on each side", () => {
  const r = calculate(
    plan({ style: "negative-5", stops: [stop(5, 40), stop(30, 70)] }),
  );
  close(r.firstHalf - r.secondHalf, 300);
  close(r.actualNet, 12600);
});
test("midpoint stop before versus after", () => {
  for (const afterGate of [true, false]) {
    const r = calculate(
      plan({ style: "negative-5", stops: [stop(21.0975, 60, afterGate)] }),
    );
    close(r.firstHalf - r.secondHalf, 300);
  }
});
test("net goal adds start delay to gun result", () => {
  const r = calculate(plan({ delayMinutes: "8" }));
  close(r.actualNet, 12600);
  close(r.actualGun, 13080);
});
test("gun goal subtracts wave and lineup delay", () => {
  const r = calculate(
    plan({ timeBasis: "gun", waveTime: "09:10", delayMinutes: "8" }),
  );
  close(r.actualGun, 12600);
  close(r.actualNet, 11520);
});
test("PB gun basis remains correct after pace input switch", () => {
  const r = calculate(
    plan({
      intent: "pb",
      inputKind: "pace",
      pb: "03:30:00",
      pbGainSeconds: "60",
      timeBasis: "gun",
      delayMinutes: "5",
    }),
  );
  close(r.actualGun, 12540);
});
test("pace input uses exact seconds and adds stops", () => {
  const r = calculate(
    plan({ inputKind: "pace", pace: "5:00", stops: [stop(20, 30)] }),
  );
  close(r.actualNet, 42.195 * 300 + 30);
});
test("display rounding does not change subsequent elapsed times", () => {
  const p = plan();
  const r = calculate(p);
  close(r.rows.find((x) => x.km === 40).pass, (12600 / 42.195) * 40);
  assert.equal(cardTime(p, r, 42195000), "3:30:00");
});
test("final partial interval pace is seconds per km", () => {
  const r = calculate(plan());
  close(r.rows.at(-1).pace, 12600 / 42.195);
  assert.equal(paceText(r.rows.at(-1).pace), "4:59");
});
test("two gates in one kilometre remain separate at exact distance", () => {
  const r = calculate(
    plan({ gates: [gate(10.1, "10:00"), gate(10.2, "10:02")] }),
  );
  assert.equal(r.gates.length, 2);
  close(r.gates[0].elapsed, (12600 / 42.195) * 10.1);
  close(r.gates[1].elapsed, (12600 / 42.195) * 10.2);
});
test("gate beyond course is rejected", () =>
  assert.ok(calculate(plan({ gates: [gate(43, "15:00")] })).errors.length));
test("out-of-course stop cannot silently consume budget", () =>
  assert.ok(calculate(plan({ stops: [stop(50, 120)] })).errors.length));
test("finish cutoff participates without intermediate gates", () => {
  const r = calculate(plan({ limit: "03:00:00", showGates: false }));
  assert.equal(r.canPrint, false);
  assert.ok(r.warnings.some((s) => s.includes("ゴール")));
});
test("hidden gate violation blocks card", () => {
  const p = plan({ gates: [gate(10, "09:30")], showGates: false });
  assert.equal(calculate(p).canPrint, false);
  assert.throws(() => buildCardHtml(p));
});
test("advisory deadline warns without acting as disqualification", () => {
  const r = calculate(plan({ gates: [gate(10, "09:30", "advisory")] }));
  assert.ok(r.canPrint);
  assert.ok(r.warnings.some((s) => s.includes("参考締切")));
});
test("exact deadline is not marked safe", () => {
  const r = calculate(plan({ limit: "03:30:00" }));
  assert.ok(r.boundary);
  assert.equal(r.canPrint, false);
});
test("finish mode leaves requested five-minute margin", () => {
  const r = calculate(
    plan({
      intent: "finish",
      limit: "06:00:00",
      delayMinutes: "10",
      bufferMinutes: "5",
    }),
  );
  close(r.actualGun, 21300);
  close(r.finishMargin, 300);
});
test("finish mode is constrained by an earlier official gate", () => {
  const r = calculate(
    plan({
      intent: "finish",
      limit: "06:00:00",
      gates: [gate(10, "10:00")],
      bufferMinutes: "5",
    }),
  );
  close(r.gates[0].margin, 300);
  assert.ok(r.finishMargin > 300);
});
test("zero requested buffer retains a second at finish", () => {
  const r = calculate(
    plan({ intent: "finish", limit: "06:00:00", bufferMinutes: "0" }),
  );
  close(r.finishMargin, 1);
  assert.ok(r.canPrint);
});
test("impossible finish constraints produce actionable error", () => {
  const r = calculate(
    plan({ intent: "finish", limit: "03:00:00", fastestPace: "5:00" }),
  );
  assert.ok(r.errors.length);
  assert.equal(r.canPrint, false);
});
test("stop location relative to gate changes gate margin", () => {
  const base = plan({
    inputKind: "pace",
    pace: "5:00",
    gates: [gate(10, "10:00")],
  });
  const before = calculate({ ...base, stops: [stop(10, 60)] });
  const after = calculate({ ...base, stops: [stop(10, 60, true)] });
  close(after.gates[0].margin - before.gates[0].margin, 60);
  close(before.actualNet, after.actualNet);
});
test("elevation toggle controls correction independently", () => {
  const a = calculate(plan({ terrain: [terrain], elevation: false }));
  const b = calculate(plan({ terrain: [terrain], elevation: true }));
  close(a.actualNet, b.actualNet);
  assert.ok(b.rows[0].pace > a.rows[0].pace);
  assert.equal(a.rows[0].adjustment, 0);
});
test("fixed baseline lets correction change arrival", () => {
  const r = calculate(
    plan({ terrain: [terrain], elevation: true, adjustmentMode: "fixed" }),
  );
  close(r.actualNet, 12700);
});
test("manual interval holds exact pace while others redistribute", () => {
  const r = calculate(plan({ style: "custom", overrides: [manual] }));
  close(r.rows[0].pace, 330);
  close(r.actualNet, 12600);
});
test("switching to a preset suspends manual override", () => {
  const r = calculate(plan({ style: "even", overrides: [manual] }));
  close(r.rows[0].pace, 12600 / 42.195);
});
test("manual full-course conflict fails instead of inventing result", () =>
  assert.ok(
    calculate(
      plan({ style: "custom", overrides: [{ ...manual, end: "42.195" }] }),
    ).errors.length,
  ));
test("overlapping intervals rejected", () =>
  assert.ok(
    calculate(plan({ terrain: [terrain, { ...terrain, id: "x", start: "4" }] }))
      .errors.length,
  ));
test("midnight checkpoint and clock display", () => {
  const r = calculate(
    plan({ startTime: "23:00", gates: [{ ...gate(20, "02:00"), day: "1" }] }),
  );
  assert.ok(r.canPrint);
  assert.ok(clockText(r.start + r.actualNet).startsWith("翌日"));
});
test("invalid numeric fields rejected", () => {
  for (const patch of [
    { target: "3:99:00" },
    { delayMinutes: "-1" },
    { waveTime: "08:00" },
    { bufferMinutes: "abc" },
    { style: "custom", splitSeconds: "NaN" },
  ])
    assert.ok(calculate(plan(patch)).errors.length);
});
test("HTML escapes untrusted titles", () => {
  const html = buildCardHtml(
    plan({ raceName: "<img src=x onerror=alert(1)>" }),
  );
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img"));
});
test("comparison recalculates every target using common engine", () => {
  const p = plan({ comparison: ["03:20:00", "03:30:00", "03:45:00"] });
  comparisonResults(p).forEach((r, i) =>
    close(r.actualNet, duration(p.comparison[i])),
  );
});
test("invalid comparison prevents printing", () =>
  assert.ok(
    exportProblems(
      plan({
        cardMode: "compare",
        comparison: ["bad", "03:30:00", "03:40:00"],
      }),
    ).length,
  ));
test("nearby gates appear in carry cards with pagination and supplemental details", () => {
  const p = plan({
    gates: [gate(10.1, "12:00"), gate(10.2, "12:00")],
    stops: [stop(12.3, 30)],
    cardGates: true,
  });
  const points = displayPoints(p);
  assert.equal(points.length, 13);
  assert.equal(buildPrintLayout(p).cardCount, 2);
  assert.equal(buildPrintLayout(p).detailCount, 1);
  const html = buildCardHtml(p);
  assert.ok(html.includes("関門10.1"));
  assert.ok(html.includes("関門10.2"));
  assert.ok(html.includes("12.3km"));
});
test("obsolete migration notice does not block printing", () =>
  assert.equal(exportProblems(plan({ migrationNotes: ["確認必要"] })).length, 0));
test("backup roundtrip preserves every setting", () => {
  const s = newStore();
  assert.deepEqual(parseBackup(JSON.stringify(s)), s);
});
test("invalid and future backup leaves current data untouched", () => {
  for (const value of [
    "{",
    "{}",
    JSON.stringify({ ...newStore(), schemaVersion: 99 }),
  ])
    assert.throws(() => parseBackup(value));
});
test("duplicate plan IDs rejected", () => {
  const s = newStore();
  s.plans.push(s.plans[0]);
  assert.throws(() => parseStore(JSON.stringify(s)));
});
test("legacy data original including training retained", () => {
  const raw = {
    races: [{ id: "r", name: "旧大会", distanceKm: "42.195" }],
    plans: [],
    trainingRecords: [{ memo: "keep me" }],
    manualLaps: [{ id: "lap", raceId: "r", pace: "30:00" }],
  };
  const s = migrateLegacy(raw);
  assert.deepEqual(s.legacyArchive, raw);
  assert.equal(s.plans[0].raceName, "旧大会");
  assert.equal(s.plans[0].overrides.length, 0);
  assert.equal(s.plans[0].migrationNotes.length, 2);
});
test("storage saves and verifies two generations", async () => {
  const db = kv(),
    repo = createRepository(db),
    s = newStore();
  await repo.save(s);
  s.plans[0].name = "new";
  await repo.save(s);
  assert.equal((await repo.load()).store.plans[0].name, "new");
  assert.equal(db.map.size, 2);
});
test("corrupted latest slot recovers previous generation", async () => {
  const db = kv(),
    repo = createRepository(db),
    s = newStore();
  await repo.save(s);
  s.plans[0].name = "new";
  await repo.save(s);
  db.map.set("run-finish-planner-v2-b", "{bad");
  const r = await repo.load();
  assert.equal(r.store.plans[0].name, "プランA");
  assert.ok(r.notice);
});
test("both corrupted slots never initialize silently", async () => {
  const db = kv();
  db.map.set("run-finish-planner-v2-a", "{bad");
  await assert.rejects(createRepository(db).load());
  assert.equal(db.map.get("run-finish-planner-v2-a"), "{bad");
});
test("write failure surfaced and earlier copy remains", async () => {
  const db = kv(),
    repo = createRepository(db),
    s = newStore();
  await repo.save(s);
  db.setItem = async () => {
    throw new Error("quota");
  };
  await assert.rejects(repo.save(s));
  assert.equal((await repo.load()).store.plans.length, 1);
});
test("queued saves freeze input and retain newest edit", async () => {
  const db = kv(),
    repo = createRepository(db),
    s = newStore();
  const a = repo.save(s);
  s.plans[0].name = "second";
  const b = repo.save(s);
  s.plans[0].name = "third";
  await Promise.all([a, b]);
  assert.equal((await repo.load()).store.plans[0].name, "second");
});
test("restore preimage is available independently", async () => {
  const repo = createRepository(kv()),
    old = newStore(),
    next = newStore();
  await repo.preserveBeforeRestore(old);
  await repo.save(next);
  assert.deepEqual(await repo.previousRestore(), old);
  assert.deepEqual((await repo.load()).store, next);
});
test("migration removes obsolete originals only after verified current copies", async () => {
  const db = kv();
  const original = JSON.stringify({
    races: [],
    plans: [],
    secretNote: "original",
  });
  db.map.set(LEGACY_KEY, original);
  const repo = createRepository(db);
  await repo.load();
  assert.equal(db.map.has(LEGACY_KEY), false);
  assert.equal(db.map.has("run-finish-planner-v2-legacy-original"), false);
  assert.equal((await repo.load()).store.legacyArchive, null);
  assert.ok(db.map.has("run-finish-planner-v2-a") && db.map.has("run-finish-planner-v2-b"));
});
test("stale second repository cannot overwrite a newer plan", async () => {
  const db = kv(),
    a = createRepository(db),
    b = createRepository(db),
    initial = newStore();
  await a.save(initial);
  const stale = (await b.load()).store;
  initial.plans[0].name = "new edit";
  await a.save(initial);
  await assert.rejects(b.save(stale));
  assert.equal((await a.load()).store.plans[0].name, "new edit");
});
test("comparison retains selected gate and stop notes", () => {
  const html = buildCardHtml(
    plan({
      cardMode: "compare",
      cardGates: true,
      gates: [gate(10, "12:00")],
      stops: [stop(15, 30)],
    }),
  );
  assert.ok(html.includes("関門10"));
  assert.ok(html.includes("補給") && html.includes("30秒"));
});
test("long labels fail explicitly rather than clipping print", () =>
  assert.ok(exportProblems(plan({ raceName: "大".repeat(61) })).length));
test("start closure at 0km checks lineup delay and prints correctly", () => {
  const p = plan({
    delayMinutes: "10",
    gates: [gate(0, "09:40")],
    cardGates: true,
    cardTerrain: true,
  });
  const r = calculate(p);
  assert.equal(r.errors.length, 0);
  close(r.gates[0].margin, 1800);
  assert.ok(buildCardHtml(p).includes("スタート"));
  assert.equal(cardTime(p, r, 0), "0:00:00");
  assert.equal(calculate({ ...p, delayMinutes: "45" }).canPrint, false);
});
test("manual intervals respect fastest allowed pace in finish mode", () => {
  const r = calculate(plan({ intent: "finish", style: "custom", limit: "06:00:00", fastestPace: "6:00", overrides: [manual] }));
  assert.ok(r.errors.some(s => s.includes("最速許容")));
});
test("finish-only pace constraint does not leak into target mode", () => {
  const r = calculate(plan({ fastestPace: "6:00" }));
  close(r.actualNet, 12600);
});
test("marathon carry cards keep all eleven points on one A4 page", () => {
  for (const cardFormat of ['pocket', 'wrist']) {
    const layout = buildPrintLayout(plan({ cardFormat, cardGates: false, cardNotes: false, cardTerrain: false }));
    assert.equal(layout.pages.length, 1);
    assert.equal(layout.pages[0].cards[0].points.length, 11);
    assert.equal(layout.width, cardFormat === 'wrist' ? 50 : 85);
  }
});
test("main and comparison have matching dimensions even for saved wrist setting", () => {
  const layout = buildPrintLayout(plan({ cardMode: 'both', cardFormat: 'wrist', cardGates: false, cardNotes: false, cardTerrain: false }));
  assert.equal(layout.pages.length, 1);
  assert.equal(layout.cardCount, 1);
  assert.ok(layout.pages[0].cards.every(c => c.width === 85 && c.height === 135 && c.points.length === 11));
});
test("gun heading matches finish row with fifteen minute start delay", () => {
  const p = plan({ target: '02:30:00', delayMinutes: '15', cardClock: 'gun', timeBasis: 'net' });
  close(printedTotal(p, calculate(p)), 9900);
  const html = buildCardHtml(p);
  assert.ok(html.includes('class="finish-time">2:45:00</strong>'));
  assert.equal(cardTime(p, calculate(p), 42195000), '2:45:00');
});
test("many checkpoint rows paginate without loss", () => {
  const p = plan({ cardGates: true, cardNotes: false, cardTerrain: false, gates: Array.from({length: 40}, (_, i) => gate(i + 1, '16:00')) });
  const layout = buildPrintLayout(p);
  assert.ok(layout.detailCount > 1);
  assert.equal(layout.pages.filter(p => p.kind === 'detail').flatMap(p => p.tables.flatMap(t => t.rows)).length, 40);
});
const { validOpeningImage, validSettings, MAX_IMAGE_BYTES } = require('../src/planner/settings.ts');
const { PREFECTURES, filterRaces, raceDataLabel } = require('../src/planner/catalog.ts');
const { planFromRace } = require('../src/planner/racePlan.ts');
const { OFFICIAL_RACE_DATA } = require('../src/data/raceData.ts');
const { domesticRaceData } = require('../src/data/races/domestic-20260912.ts');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('opening settings preserve old backups and survive repository round trip', async () => {
  const store = newStore();
  assert.equal(parseBackup(JSON.stringify(store)).settings, undefined);
  store.settings = { openingBackground: png };
  const memory = kv(), repo = createRepository(memory);
  await repo.load(); await repo.save(store);
  assert.equal((await repo.load()).store.settings.openingBackground, png);
  assert.equal(parseBackup(JSON.stringify(store)).settings.openingBackground, png);
  store.settings.openingBackground = null;
  await repo.save(store);
  assert.equal((await repo.load()).store.settings.openingBackground, null);
});
test('opening settings reject external URLs, unsupported images and oversized data', () => {
  assert.ok(validOpeningImage(png));
  for (const value of ['https://example.com/image.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', '', 'data:image/jpeg;base64,AAAA', png + '!', 'data:image/jpeg;base64,/9j/' + 'A'.repeat(MAX_IMAGE_BYTES * 2)]) assert.equal(validOpeningImage(value), false);
  for (const value of [null, [], {}, { openingBackground: 4 }, { openingBackground: 'file:///photo.jpg' }]) assert.equal(validSettings(value), false);
  const store = newStore(); store.settings = { openingBackground: 'https://example.com/x' };
  assert.throws(() => parseBackup(JSON.stringify(store)));
});
test('failed image persistence preserves previous settings', async () => {
  const memory = kv(), repo = createRepository(memory);
  const store = (await repo.load()).store;
  await repo.save(store);
  memory.setItem = async () => { throw new Error('quota'); };
  const failing = createRepository(memory); await failing.load();
  await assert.rejects(failing.save({ ...store, settings: { openingBackground: png } }));
  assert.equal((await repo.load()).store.settings, undefined);
});
test('47 unique prefectures and combined race filters', () => {
  assert.equal(PREFECTURES.length, 47); assert.equal(new Set(PREFECTURES).size, 47);
  const sample = domesticRaceData.find(r => r.slug === 'tango-100');
  assert.equal(filterRaces([sample], '京都府', 'ultra', '丹後１００').length, 1);
  assert.equal(filterRaces([sample], '東京都', 'ultra', '').length, 0);
  assert.equal(filterRaces([sample], '京都府', 'half', '').length, 0);
  assert.equal(filterRaces([{ ...sample, publicationAllowed: false }], '', '', '').length, 0);
  assert.equal(filterRaces([{ ...sample, prefecture: '京都府・兵庫県' }], '兵庫県', '', '').length, 1);
});
test('catalog has unique IDs and published race sources', () => {
  assert.equal(new Set(OFFICIAL_RACE_DATA.map(r => r.id)).size, OFFICIAL_RACE_DATA.length);
  assert.equal(new Set(OFFICIAL_RACE_DATA.map(r => r.slug)).size, OFFICIAL_RACE_DATA.length);
  for (const r of domesticRaceData) {
    assert.ok(r.distanceKm > 0 && r.distanceKm <= 1000);
    assert.ok(PREFECTURES.includes(r.prefecture));
    assert.equal(r.verifiedAt, '2026-09-12');
    assert.ok(r.sources.every(s => new URL(s.url).protocol === 'https:'));
    assert.ok(r.checkpoints.every(g => g.distanceKm > 0 && g.distanceKm < r.distanceKm));
    assert.equal(r.verificationStatus, 'partially-verified');
  }
});
test('race import requires wave selection and uses its actual start', () => {
  const r = domesticRaceData.find(r => r.slug === 'fuji-five-lakes-100');
  assert.throws(() => planFromRace(r)); assert.throws(() => planFromRace(r, 'invalid'));
  const p = planFromRace(r, '2');
  assert.equal(p.startTime, '05:00'); assert.equal(p.limit, '14:00:00');
  assert.equal(p.date, '2026-04-19');
});
test('unconfirmed race start stays empty and elapsed gates support next day', () => {
  const r = { ...domesticRaceData[0], startOptions: undefined, startTime: null, checkpoints: [] };
  assert.equal(planFromRace(r).startTime, '');
  r.startTime = '23:00'; r.checkpoints = [{ id: 'next', name: '関門', distanceKm: 20, elapsedLimitMinutes: 120 }];
  const p = planFromRace(r);
  assert.equal(p.gates[0].time, '01:00:00'); assert.equal(p.gates[0].day, '1');
});
test('updated course distance and strict half-marathon gates are imported', () => {
  assert.equal(planFromRace(domesticRaceData.find(r => r.slug === 'aga-103')).distance, '103');
  const p = planFromRace(domesticRaceData.find(r => r.slug === 'osaka-half-21.0975'));
  assert.equal(p.limit, '2:05:00'); assert.equal(p.gates.length, 7);
  assert.equal(p.gates[0].time, '12:18');
  assert.equal(calculate({ ...p, target: '1:30:00' }).errors.length, 0);
});
test('past events are labeled by edition instead of current verification', () => {
  assert.match(raceDataLabel(domesticRaceData[0], '2026-09-12'), /2026年.*開催済み/);
  assert.match(raceDataLabel(domesticRaceData.find(r => r.slug === 'osaka-half-21.0975'), '2026-09-12'), /基本情報/);
});
test('comparison goals have consistent labels and require ascending target times', () => {
  const p = plan({ cardMode: 'compare' });
  const html = buildCardHtml(p);
  for (const label of ['挑戦目標', '本命目標', '堅実目標', '<th>挑戦</th>', '<th>本命</th>', '<th>堅実</th>']) assert.ok(html.includes(label));
  assert.ok(!html.includes('比較A'));
  for (const comparison of [['3:35:00','3:30:00','3:25:00'], ['3:30:00','3:30:00','3:35:00']]) {
    assert.ok(exportProblems({ ...p, comparison }).some(e => e.includes('順にタイムを長く')));
  }
  assert.ok(!exportProblems(p).some(e => e.includes('順にタイムを長く')));
  assert.ok(!exportProblems({ ...p, cardMode: 'single', comparison: ['3:35:00','3:30:00','3:25:00'] }).some(e => e.includes('順にタイムを長く')));
});
test('folded cards pair matching sections and use one external cutting boundary', () => {
  const p = plan({ cardMode: 'both', cardGates: true, gates: [gate(20, '13:00')] });
  const layout = buildPrintLayout(p);
  assert.equal(layout.cardCount, 1);
  assert.equal(layout.pages[0].folded, true);
  assert.deepEqual(layout.pages[0].cards.map(c => c.kind), ['single', 'compare']);
  const html = buildCardHtml(p);
  assert.equal((html.match(/class="fold-card"/g) || []).length, 1);
  assert.equal((html.match(/class="fold-line"/g) || []).length, 1);
  assert.ok(html.includes('折り線・切らない'));
  assert.ok(html.includes('class="detail gate-table"'));
  for (const page of buildPrintLayout(plan({ cardMode: 'both', distance: '100' })).pages) {
    if (page.kind === 'cards') {
      assert.deepEqual(page.cards.map(c => c.kind), ['single','compare']);
      assert.deepEqual(page.cards[0].points, page.cards[1].points);
    }
  }
  assert.ok(!buildPrintLayout(plan({ cardMode: 'compare' })).pages[0].folded);
});
const { parseCalendarDate, calendarValue, calendarCells, shiftMonth } = require('../src/planner/calendar.ts');
test('calendar validates leap years and preserves ISO date values', () => {
  for (const value of ['2024-02-29', '2000-02-29', '2026-12-06', '0001-01-01']) {
    assert.equal(calendarValue(parseCalendarDate(value)), value);
  }
  for (const value of ['', '2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '0000-01-01', '2026-1-1']) {
    assert.equal(parseCalendarDate(value), null);
  }
});
test('calendar grid aligns weekdays and year boundaries', () => {
  const september = calendarCells(2026, 9);
  assert.deepEqual(september.slice(0, 4), [null, null, 1, 2]);
  assert.equal(september.filter(Boolean).length, 30);
  assert.equal(calendarCells(2024, 2).filter(Boolean).length, 29);
  assert.equal(calendarCells(2026, 8).length, 42);
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(1, 1, -12), { year: 1, month: 1 });
});
test('Shouhashi 2026 imports its actual distance and official deadlines', () => {
  const r = OFFICIAL_RACE_DATA.find(r => r.id === 'shouhashi-half-2026');
  assert.equal(r.category, 'half');
  const p = planFromRace(r);
  assert.equal(p.distance, '21.442');
  assert.equal(p.date, '2026-11-01');
  assert.equal(p.startTime, '09:00');
  assert.equal(p.limit, '3:15:00');
  assert.equal(p.gates.length, 1);
  assert.equal(p.gates[0].km, '13');
  assert.equal(p.gates[0].time, '11:00');
  assert.equal(p.sourceChecked, '2026-09-12');
  assert.equal(p.terrain.length, 0);
});
test('all 105 supplied workbook races remain available with their category and official URL', () => {
  const coverage = require('../docs/release/workbook-race-coverage-20260912.json');
  assert.equal(coverage.length, 105);
  assert.equal(new Set(coverage.map(row => row.raceId)).size, 105);
  const host = url => new URL(url).hostname.replace(/^www\./, '');
  for (const row of coverage) {
    const race = OFFICIAL_RACE_DATA.find(r => r.id === row.raceId);
    assert.ok(race && race.publicationAllowed !== false, row.name);
    assert.equal(race.category, row.category, row.name);
    assert.ok(race.sources.some(s => host(s.url) === host(row.url)), row.name);
  }
  const p = planFromRace(OFFICIAL_RACE_DATA.find(r => r.id === 'tsukuba-marathon-2026'));
  assert.equal(p.date, '2026-11-22');
  assert.equal(p.distance, '42.195');
  assert.equal(p.startTime, '08:50');
  assert.equal(p.limit, '');
  assert.equal(p.gates.length, 0);
});
test('both card footers use calculated averages and explicit course correction status', () => {
  const p = plan({ cardMode: 'both', style: 'positive-10', elevation: true, terrain: [terrain] });
  const html = buildCardHtml(p);
  assert.equal((html.match(/class="foot-style"/g) || []).length, 2);
  assert.equal((html.match(/コース補正：ON/g) || []).length, 2);
  for (const r of comparisonResults(p)) assert.ok(html.includes(`<b>${paceText(r.averagePace)}</b>`));
  assert.ok(html.includes(`移動平均 ${paceText(calculate(p).averagePace)}/km`));
  assert.ok(buildCardHtml({ ...p, elevation: false }).includes('コース補正：OFF'));
  assert.ok(buildCardHtml({ ...p, terrain: [] }).includes('コース補正：未設定'));
});
test('cleanup failure retains old source and usable current plans retain settings', async () => {
  const db = kv(); const raw = JSON.stringify({ races: [{ id: 'r', name: '大会', distanceKm: '21.442' }], plans: [] });
  db.map.set(LEGACY_KEY, raw);
  db.setItem = async () => { throw new Error('quota'); };
  await assert.rejects(createRepository(db).load());
  assert.equal(db.map.get(LEGACY_KEY), raw);
  const { compactStore } = require('../src/planner/storage.ts');
  const old = newStore(); old.legacyArchive = { trainingRecords: 'x'.repeat(10000) };
  old.snapshots = [{ id: 's', createdAt: '', plan: old.plans[0], html: 'x'.repeat(10000) }];
  old.plans[0].migrationNotes = ['旧案内'];
  const clean = compactStore(old);
  assert.equal(clean.plans[0].id, old.plans[0].id);
  assert.equal(clean.plans[0].target, old.plans[0].target);
  assert.equal(clean.snapshots.length, 0);
  assert.equal(clean.legacyArchive, null);
  assert.ok(JSON.stringify(clean).length < JSON.stringify(old).length / 5);
});
test('carry cards always show exact gate distances and deadlines on both faces', () => {
  const p = plan({ distance: '21.442', target: '2:50:00', timeBasis: 'gun', delayMinutes: '10', cardClock: 'gun', comparison: ['2:40:00','3:00:00','3:10:00'], cardMode: 'both', cardGates: false, gates: [gate(13,'11:00')] });
  const html = buildCardHtml(p);
  assert.equal((html.match(/class="gate-deadline">関門 11:00/g) || []).length, 2);
  assert.equal(displayPoints(p).filter(x => x === 13000000).length, 1);
  assert.ok(html.includes('ネット<br>2:40:00'));
  assert.ok(html.includes('class="finish-pair"'));
  const matching = { ...p, gates: [gate(10,'11:00')] };
  assert.equal(displayPoints(matching).filter(x => x === 10000000).length, 1);
});
test('existing v2 cleanup rewrites both copies, preserves opening image and clears source keys', async () => {
  const { digest } = require('../src/planner/storage.ts');
  const db = kv(), original = newStore();
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  original.legacyArchive = { settings: { openingBackgroundUri: image }, trainingRecords: ['unused'] };
  original.plans[0].name = '旧版からの移行';
  original.plans[0].migrationNotes = ['確認'];
  const payload = JSON.stringify(original);
  db.map.set('run-finish-planner-v2-a', JSON.stringify({ generation: 1, payload, digest: digest(payload) }));
  db.map.set('run-finish-planner-v2-legacy-original', 'old raw');
  db.map.set('run-finish-planner-v2-before-restore', payload);
  const repo = createRepository(db), loaded = await repo.load();
  assert.equal(loaded.notice, '');
  assert.equal(loaded.store.settings.openingBackground, image);
  assert.equal(loaded.store.plans[0].name, 'プランA');
  assert.equal(loaded.store.plans[0].migrationNotes.length, 0);
  for (const slot of ['a','b']) assert.equal(JSON.parse(JSON.parse(db.map.get(`run-finish-planner-v2-${slot}`)).payload).legacyArchive, null);
  assert.equal((await repo.previousRestore()).legacyArchive, null);
  assert.equal(db.map.has('run-finish-planner-v2-legacy-original'), false);
});
test('small selected supplementary tables share one sheet without missing sections', () => {
  const p = plan({ cardGates: true, cardNotes: true, cardTerrain: true, gates: [gate(13, '12:00')], stops: [stop(15, 30)], terrain: [terrain] });
  const layout = buildPrintLayout(p), details = layout.pages.filter(p => p.kind === 'detail');
  assert.equal(layout.detailCount, 1);
  assert.deepEqual(details[0].tables.map(t => t.title), ['関門・制限時間の確認表', '補給・停止の計画', 'コース補正の設定']);
  const html = buildCardHtml(p, '2026-09-12', { previewPage: layout.pages.length - 1, preview: true });
  assert.equal((html.match(/<section class="detail-section">/g) || []).length, 3);
  assert.ok(html.includes('gate-table'));
});
test('large mixed supplementary tables preserve every row in order and fit page budget', () => {
  const stops = Array.from({ length: 40 }, (_, i) => ({ ...stop(i + 1, 30), memo: `補給${i} ` + '長いメモ'.repeat(12) }));
  const p = plan({ cardGates: true, cardNotes: true, cardTerrain: true, gates: [gate(13, '16:00')], stops, terrain: [terrain] });
  const details = buildPrintLayout(p).pages.filter(p => p.kind === 'detail');
  assert.ok(details.length > 1);
  const tables = details.flatMap(p => p.tables);
  assert.deepEqual(tables.filter(t => t.title === '補給・停止の計画').flatMap(t => t.rows.map(r => r[0])), stops.map(s => `${s.km}km`));
  assert.ok(tables.some(t => t.continuation > 1));
  details.forEach(p => assert.ok(p.tables.reduce((n,t) => n + 36 + t.heights.reduce((a,b) => a+b,0), 0) <= 240));
  assert.equal(tables.at(-1).title, 'コース補正の設定');
});
test('unselected and empty supplementary sections do not create pages', () => {
  assert.equal(buildPrintLayout(plan({ cardGates: false, cardNotes: false, cardTerrain: false, gates: [gate(13, '16:00')], stops: [stop(15, 30)], terrain: [terrain] })).detailCount, 0);
  assert.equal(buildPrintLayout(plan({ cardGates: true, cardNotes: true, cardTerrain: true, gates: [], stops: [], terrain: [], limit: '' })).detailCount, 0);
});
const { normalizeTime, timeKind, timeParts, joinTime } = require('../src/planner/timeValues.ts');
test('time input normalizes full width numerals while preserving signs and fractions', () => {
  assert.equal(normalizeTime('０２：５０：００'), '02:50:00');
  assert.equal(normalizeTime('−１２．５'), '-12.5');
  assert.equal(joinTime(timeParts('２：３：４', 'duration'), 'duration'), '02:03:04');
  assert.equal(joinTime(['9','5'], 'clock'), '09:05');
  assert.equal(timeKind('ウェーブ号砲（任意）'), 'clock');
  assert.equal(timeKind('補正 秒/km'), 'seconds');
  assert.equal(timeKind('大会名'), undefined);
});
test('individual and bulk trash purge keep active plans and clean both recovery slots', async () => {
  const db = kv(), repo = createRepository(db), store = (await repo.load()).store;
  const a = newPlan(), b = newPlan(); store.trash = [a,b];
  await repo.save(store); await repo.preserveBeforeRestore({...store,plans:[a,...store.plans]});
  const first = await repo.purgeTrash(store,[a.id,store.plans[0].id]);
  assert.deepEqual(first.trash.map(p=>p.id),[b.id]);
  assert.deepEqual(first.plans,store.plans);
  assert.ok(!(await repo.previousRestore()).plans.some(p=>p.id===a.id));
  for (const slot of ['a','b']) assert.ok(!JSON.parse(JSON.parse(db.map.get(`run-finish-planner-v2-${slot}`)).payload).trash.some(p=>p.id===a.id));
  const final = await repo.purgeTrash(first,[b.id]);
  assert.equal(final.trash.length,0);
  assert.equal((await createRepository(db).load()).store.trash.length,0);
});
test('trash purge reports a failed write without claiming completion', async () => {
  const db=kv(), repo=createRepository(db), store=(await repo.load()).store;
  store.trash=[newPlan()]; await repo.save(store);
  db.setItem=async()=>{throw new Error('容量不足');};
  await assert.rejects(repo.purgeTrash(store,[store.trash[0].id]),/容量不足/);
  assert.equal((await createRepository(db).load()).store.trash.length,1);
});
const { emptyRaceForm, applyRaceForm, raceFields } = require('../src/planner/raceForm.ts');
test('race registration uses a blank draft and leaves existing plans unchanged', () => {
  const store=newStore(), draft=emptyRaceForm();
  raceFields.forEach(k=>assert.equal(draft[k],''));
  assert.throws(()=>applyRaceForm(store,draft,null),/大会名/);
  const entered={...draft,raceName:'検証大会',name:'本番',distance:'21.442',startTime:'09:00'};
  const next=applyRaceForm(store,entered,null);
  assert.equal(next.plans.length,store.plans.length+1);
  assert.deepEqual(next.plans[0],store.plans[0]);
  assert.equal(next.selectedId,draft.id);
  assert.equal(emptyRaceForm().raceName,'');
});
test('editing race basics preserves current pace and course settings', () => {
  const store=newStore(); const original=store.plans[0];
  const draft={...original,raceName:'変更後',name:'本番',distance:'42.195',startTime:'09:00'};
  store.plans[0]={...original,target:'04:10:00',stops:[stop(20,30)]};
  const next=applyRaceForm(store,draft,original.id);
  assert.equal(next.plans.length,store.plans.length);
  assert.equal(next.plans[0].target,'04:10:00');
  assert.deepEqual(next.plans[0].stops,store.plans[0].stops);
  assert.equal(next.plans[0].raceName,'変更後');
  assert.throws(()=>applyRaceForm(store,{...draft,startTime:'25:00'},original.id),/大会号砲/);
});
const { numericOptions, distanceParts, joinDistance } = require('../src/planner/timeValues.ts');
test('numeric selectors retain signed corrections and existing precise values',()=>{
  assert.ok(numericOptions('補正 秒/km','-7.5').some(o=>o.value==='-7.5'));
  assert.ok(numericOptions('補正 秒/km','0').some(o=>o.value==='-120'));
  assert.ok(numericOptions('停止時間 秒','20').some(o=>o.value==='20'));
  assert.ok(numericOptions('停止時間 秒','1234').some(o=>o.value==='1234'));
  for(const value of ['21.0975','42.195','21.442','13.123456','1000']) assert.equal(joinDistance(...distanceParts(value)),value);
  assert.deepEqual(distanceParts(''),['','']);
  assert.equal(joinDistance('5','200'),'5.2');
});
(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`PASS ${t.name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${t.name}\n${e.stack}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exitCode = failed ? 1 : 0;
})();
