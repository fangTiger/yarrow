import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import { scanFrontendSources } from "../src/demo/secret-scan.js";

const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".ts", ".tsx", ".txt"]);
const BINARY_EXTENSIONS = new Set([".woff", ".woff2", ".ttf", ".otf", ".png", ".jpg", ".webp"]);

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

const paths = (await walk("web")).filter((path) => {
  const extension = extname(path).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) return false;
  return TEXT_EXTENSIONS.has(extension);
});
const sources = await Promise.all(paths.map(async (path) => ({
  path,
  text: await readFile(path, "utf8"),
})));
const secrets = [
  { label: "Arc 签名秘密值", value: process.env.ARC_PRIVATE_KEY ?? "" },
  { label: "DeepSeek 凭据值", value: process.env.DEEPSEEK_API_KEY ?? "" },
];
const leaks = scanFrontendSources(sources, secrets);
if (leaks.length > 0) {
  for (const leak of leaks) {
    console.error(`前端秘密扫描失败：${leak.path}（${leak.reasons.join("、")}）`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `前端秘密扫描通过：${paths.length} 个浏览器源码或构建文件不含秘密值、` +
    "环境变量入口、助记词或账户派生入口",
  );
}
