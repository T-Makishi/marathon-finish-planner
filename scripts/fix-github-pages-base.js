const fs = require("fs");
const path = require("path");

const htmlPath = path.join(process.cwd(), "dist", "index.html");
const repoBase = "/marathon-finish-planner";

let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace(/src="\/_expo\//g, `src="${repoBase}/_expo/`);
html = html.replace(/href="\/_expo\//g, `href="${repoBase}/_expo/`);
fs.writeFileSync(htmlPath, html);
