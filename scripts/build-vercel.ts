// scripts/build-vercel.ts
/**
 * 生成 Vercel Build Output API 产物（.vercel/output）：
 * - static/：页面、前端包、字体、图标与示例，不含源码；
 * - functions/api.func/：打包后的 /api/* 函数，后台任务经 waitUntil 保活，最长 300 秒。
 * 先运行 frontend:build 生成 web/dist。
 */
import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const rootDir = process.cwd();
const outputDir = resolve(rootDir, ".vercel/output");
const staticDir = resolve(outputDir, "static");
const functionDir = resolve(outputDir, "functions/api.func");

await stat(resolve(rootDir, "web/dist/app.js")).catch(() => {
  throw new Error("缺少 web/dist/app.js，请先运行 npm run frontend:build");
});
await rm(outputDir, { recursive: true, force: true });
await mkdir(staticDir, { recursive: true });
await mkdir(functionDir, { recursive: true });

const STATIC_ENTRIES = [
  "index.html", "favicon.ico", "favicon.svg", "apple-touch-icon.png", "llms.txt",
  "dist", "brand", "samples", "hexagram", "bazi", "sitemap.xml", "robots.txt",
  "fonts/mashanzheng-subset.woff2", "fonts/OFL.txt",
];
for (const entry of STATIC_ENTRIES) {
  await cp(resolve(rootDir, "web", entry), resolve(staticDir, entry), { recursive: true });
}

await build({
  entryPoints: [resolve(rootDir, "src/vercel/api.ts")],
  outfile: resolve(functionDir, "index.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node22"],
  minify: false,
  sourcemap: false,
  legalComments: "none",
  // 部分依赖是 CommonJS，打成 ESM 后需要 require 才能加载 Node 内置模块。
  banner: { js: "import { createRequire as __sanyiCreateRequire } from \"node:module\";\nconst require = __sanyiCreateRequire(import.meta.url);" },
});
// 穷通宝鉴数据按 import.meta.url 相对路径读取，随函数一起放在 data/ 下。
await cp(resolve(rootDir, "src/calendar/data/qiongtong.json"), resolve(functionDir, "data/qiongtong.json"));
await writeFile(resolve(functionDir, ".vc-config.json"), `${JSON.stringify({
  runtime: "nodejs22.x",
  handler: "index.mjs",
  launcherType: "Nodejs",
  shouldAddHelpers: false,
  maxDuration: 300,
}, null, 2)}\n`);
await writeFile(resolve(outputDir, "config.json"), `${JSON.stringify({
  version: 3,
  routes: [
    { handle: "filesystem" },
    { src: "^/api/(.*)$", dest: "/api" },
  ],
}, null, 2)}\n`);
console.log("Vercel 产物已生成：.vercel/output");
