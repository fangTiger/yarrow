import { readFile } from "node:fs/promises";

import { scanFrontendSources } from "../src/demo/secret-scan.js";

const paths = [
  "web/index.html",
  "web/styles.css",
  "web/app.tsx",
  "web/main.tsx",
  "web/lib/wagmi.ts",
  "web/lib/secure-rainbow-config.ts",
  "web/providers/Providers.tsx",
  "web/dist/app.js",
  "web/dist/app.css",
];
const sources = await Promise.all(paths.map(async (path) => ({ path, text: await readFile(path, "utf8") })));
const secrets = [
  { label: "Arc 签名秘密值", value: process.env.ARC_PRIVATE_KEY ?? "" },
  { label: "DeepSeek 凭据值", value: process.env.DEEPSEEK_API_KEY ?? "" },
];
const leaks = scanFrontendSources(sources, secrets);
if (leaks.length > 0) {
  for (const leak of leaks) console.error(`前端秘密扫描失败：${leak.path}（${leak.reasons.join("、")}）`);
  process.exitCode = 1;
} else {
  console.log(`前端秘密扫描通过：${paths.length} 个浏览器文件不含秘密值、环境变量入口、助记词或账户派生入口`);
}
