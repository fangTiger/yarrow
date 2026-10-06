// tests/frontend-sanyi-content.test.ts
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html"]);
const CULTURE_FORBIDDEN = /[\u3040-\u30ff]|・|易者|身銭|筮竹|神社|高島|断易|問|賭/u;
const VISIBLE_FORBIDDEN = /押钱|赔付|封存/u;
const REMOTE_FONT = /fonts\.(?:googleapis|gstatic)\.com/u;

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

async function sourceFiles(): Promise<string[]> {
  const [webFiles, sanyiFiles] = await Promise.all([walk("web"), walk("src/sanyi")]);
  return [...webFiles, ...sanyiFiles].filter((path) =>
    TEXT_EXTENSIONS.has(extname(path)) && !path.startsWith("web/dist/"));
}

async function assertNoMatch(paths: string[], pattern: RegExp, label: string): Promise<void> {
  const failures: string[] = [];
  for (const path of paths) {
    const text = await readFile(path, "utf8");
    if (pattern.test(text)) failures.push(relative(process.cwd(), path));
  }
  assert.deepEqual(failures, [], `${label}：${failures.join("、")}`);
}

test("文化扫描要求先生成 app.js 与 app.css", async () => {
  for (const path of ["web/dist/app.js", "web/dist/app.css"]) {
    await assert.doesNotReject(
      access(path),
      `缺少 ${path}；请先运行 npm run frontend:build`,
    );
  }
});

test("构建产物与源码不含日式文化残留", async () => {
  const paths = ["web/dist/app.js", "web/dist/app.css", ...await sourceFiles()];
  await assertNoMatch(paths, CULTURE_FORBIDDEN, "发现日式文化残留");
});

test("用户可见源码不含旧押注与归档文案", async () => {
  const paths = ["web/dist/app.js", "web/dist/app.css", ...(await sourceFiles()).filter((path) =>
    !path.startsWith("src/sanyi/schools/"))];
  await assertNoMatch(paths, VISIBLE_FORBIDDEN, "发现旧产品文案");
});

test("构建产物与源码不加载 Google Fonts", async () => {
  const paths = ["web/dist/app.js", "web/dist/app.css", ...await sourceFiles()];
  await assertNoMatch(paths, REMOTE_FONT, "发现外部字体地址");
});

 test("八字新组件纳入文化守卫且没有外部字体", async () => {
  const paths = ["BirthForm", "BirthEntry", "BirthCorrection", "BaziTable", "BaziLuck", "BaziSchools", "BaziRelations", "BaziElements", "DayBoundaryChange", "LiuNianPanel"].map((name) => `web/components/${name}.tsx`);
  paths.push("web/pages/BaziReading.tsx");
  await assertNoMatch(paths, CULTURE_FORBIDDEN, "八字文化守卫");
  await assertNoMatch(paths, VISIBLE_FORBIDDEN, "八字可见文案");
  await assertNoMatch(paths, REMOTE_FONT, "八字字体守卫");
});
