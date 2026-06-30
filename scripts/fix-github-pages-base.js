const fs = require("fs");
const path = require("path");

const htmlPath = path.join(process.cwd(), "dist", "index.html");
const repoBase = "/marathon-finish-planner";

let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace(/src="\/_expo\//g, `src="${repoBase}/_expo/`);
html = html.replace(/href="\/_expo\//g, `href="${repoBase}/_expo/`);
html = html.replace(/href="\/favicon\.ico"/g, `href="${repoBase}/favicon.ico"`);
fs.writeFileSync(htmlPath, html);

const jsDir = path.join(process.cwd(), "dist", "_expo", "static", "js", "web");
for (const file of fs.readdirSync(jsDir)) {
  if (!file.endsWith(".js")) continue;
  const jsPath = path.join(jsDir, file);
  let js = fs.readFileSync(jsPath, "utf8");
  js = js.replace(/uri:"\/assets\//g, `uri:"${repoBase}/assets/`);
  fs.writeFileSync(jsPath, js);
}
