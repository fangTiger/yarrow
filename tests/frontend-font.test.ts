// tests/frontend-font.test.ts
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import test from "node:test";
import { buildFontCharset } from "../scripts/font-charset.js";
async function webSources(root = "web"): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return webSources(path);
    return [path];
  }));
  return nested.flat().filter((path) => [".css", ".html", ".ts", ".tsx"].includes(extname(path)));
}
test("毛笔体字表确定、有关键字且没有假名", () => {
  const charset = buildFontCharset();
  assert.equal(charset, [...charset].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!).join(""));
  for (const value of ["泰", "巽", "螣", "勾", "程", "世", "应"]) {
    assert.match(charset, new RegExp(value));
  }
  assert.doesNotMatch(charset, /[\u3040-\u30ff]/u);
});
test("字体只从站内 woff2 提供", async () => {
  const css = await readFile("web/styles/tokens.css", "utf8");
  assert.match(css, /url\(["']?\/fonts\/mashanzheng-subset\.woff2["']?\)/u);
  assert.match(css, /--brush:[^;]*"Ma Shan Zheng Subset"[^;]*"Kaiti SC"/u);
  const text = (await Promise.all((await webSources()).map((path) => readFile(path, "utf8")))).join("\n");
  assert.doesNotMatch(text, /fonts\.(?:googleapis|gstatic)\.com/u);
});
test("入口使用水墨夜样式且构建保留站内字体 URL", async () => {
  const main = await readFile("web/main.tsx", "utf8");
  const build = await readFile("scripts/build-frontend.ts", "utf8");
  const html = await readFile("web/index.html", "utf8");
  assert.match(main, /styles\/tokens\.css/u);
  assert.doesNotMatch(main, /\.\/styles\.css/u);
  assert.match(build, /external:\s*\["\/fonts\/\*"\]/u);
  assert.match(html, /<title>三易<\/title>/u);
  assert.match(html, /name="theme-color" content="#0F1110"/u);
});
