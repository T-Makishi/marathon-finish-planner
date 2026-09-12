const fs = require("fs");
const path = require("path");

const htmlPath = path.join(process.cwd(), "dist", "index.html");
const repoBase = "/marathon-finish-planner";

let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace('<html lang="en">', '<html lang="ja">');
html = html.replace('You need to enable JavaScript to run this app.', 'このアプリを使うにはJavaScriptを有効にしてください。');
html = html.replace('</head>', '<meta name="description" content="大会前のペース計画と早見カード。目標・配分・関門・補給を確認して、当日の一枚を作ります。"></head>');
html = html.replace(/src="\/_expo\//g, `src="${repoBase}/_expo/`);
html = html.replace(/href="\/_expo\//g, `href="${repoBase}/_expo/`);
html = html.replace(/href="\/favicon\.ico"/g, `href="${repoBase}/favicon.ico"`);
fs.writeFileSync(htmlPath, html);
fs.writeFileSync(path.join(process.cwd(), "dist", "release.json"), JSON.stringify({
  version: require("../package.json").version,
  commit: process.env.GITHUB_SHA || null
}, null, 2));

const jsDir = path.join(process.cwd(), "dist", "_expo", "static", "js", "web");
for (const file of fs.readdirSync(jsDir)) {
  if (!file.endsWith(".js")) continue;
  const jsPath = path.join(jsDir, file);
  let js = fs.readFileSync(jsPath, "utf8");
  js = js.replace(/uri:"\/assets\//g, `uri:"${repoBase}/assets/`);
  fs.writeFileSync(jsPath, js);
}
