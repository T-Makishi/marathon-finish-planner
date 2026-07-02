import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src/data/races/mcc-url-race-templates.ts");
const outputDir = path.join(root, "output");

const source = await fs.readFile(sourcePath, "utf8");
const rows = [...source.matchAll(/\{\s*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)",[\s\S]*?url:\s*"([^"]+)",\s*mccCategory:\s*"([^"]+)"/g)]
  .map((match) => ({ slug: match[1], name: match[2], url: match[3], mccCategory: match[4] }));

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(row) {
  const result = {
    ...row,
    checkedAt: new Date().toISOString().slice(0, 10),
    status: "閉鎖・到達不能",
    httpStatus: null,
    finalUrl: row.url,
    redirectLocation: "",
    robotsTxt: "未確認",
    robotsStatus: null,
    notes: []
  };

  try {
    let response = await fetchWithTimeout(row.url, { method: "HEAD" });
    if (response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(row.url, { method: "GET" });
    }
    result.httpStatus = response.status;
    const location = response.headers.get("location") ?? "";
    result.redirectLocation = location;
    if (response.status >= 300 && response.status < 400 && location) {
      result.status = "リダイレクトあり";
      result.finalUrl = new URL(location, row.url).toString();
    } else if (response.ok) {
      result.status = "有効";
    } else {
      result.status = "閉鎖・到達不能";
      result.notes.push(`HTTP ${response.status}`);
    }
  } catch (error) {
    result.status = "閉鎖・到達不能";
    result.notes.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const robotsUrl = new URL("/robots.txt", row.url).toString();
    const robotsResponse = await fetchWithTimeout(robotsUrl, { method: "GET" });
    result.robotsStatus = robotsResponse.status;
    if (robotsResponse.ok) {
      const text = await robotsResponse.text();
      result.robotsTxt = /disallow:\s*\//i.test(text) ? "利用規約確認が必要" : "確認済み";
    } else {
      result.robotsTxt = "robots.txtなしまたは未取得";
    }
  } catch {
    result.robotsTxt = "robots.txt未取得";
  }

  if (result.robotsTxt === "利用規約確認が必要") {
    result.notes.push("robots.txtに広いDisallowがあるため手入力推奨");
  }
  if (result.status !== "有効") {
    result.notes.push("詳細抽出前に人の確認が必要");
  }
  result.intakeDecision = result.status === "有効" && result.robotsTxt !== "利用規約確認が必要"
    ? "公式URLのみ登録。詳細抽出は人が確認後"
    : "公式URLのみ登録。手入力推奨";
  return result;
}

const results = [];
for (const row of rows) {
  results.push(await checkUrl(row));
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "race-url-reachability.json"), JSON.stringify(results, null, 2));
const csvHeader = "大会名,区分,URL,状態,HTTP,リダイレクト先,robots,判断,メモ\n";
const csvRows = results.map((row) => [
  row.name,
  row.mccCategory,
  row.url,
  row.status,
  row.httpStatus ?? "",
  row.redirectLocation,
  row.robotsTxt,
  row.intakeDecision,
  row.notes.join(" / ")
].map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","));
await fs.writeFile(path.join(outputDir, "race-url-reachability.csv"), csvHeader + csvRows.join("\n"));

console.log(`Checked ${results.length} URLs`);
console.log(`Output: ${path.join(outputDir, "race-url-reachability.csv")}`);
