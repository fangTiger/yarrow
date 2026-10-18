import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { getZhouyiEnglish } from "../src/agent/zhouyi-en.js";
import {
  HEXAGRAM_GUIDES,
  validateHexagramGuides,
} from "../src/content/hexagram-guides.js";
import { buildHexagramPages, SITE_ORIGIN } from "../scripts/build-hexagram-pages.js";
import { createFrontendHandler, resolveStaticPath } from "../src/frontend/server.js";
import { hexagramPath } from "../web/lib/hexagram-path.js";

function withoutChineseDetails(html: string): string {
  return html.replace(/<details class="original"[\s\S]*?<\/details>/gu, "");
}

test("64 条英文导读齐全并通过字数、汉字与禁用词校验", () => {
  assert.equal(HEXAGRAM_GUIDES.length, 64);
  assert.deepEqual(validateHexagramGuides(HEXAGRAM_GUIDES), []);
  for (const [index, guide] of HEXAGRAM_GUIDES.entries()) {
    const words = guide.trim().split(/\s+/u);
    assert.ok(words.length >= 60 && words.length <= 100, `第 ${index + 1} 卦为 ${words.length} 词`);
  }
});

test("导读校验报告缺项、字数、汉字与禁用词", () => {
  const invalid = [...HEXAGRAM_GUIDES.slice(0, 63)];
  invalid[0] = "too short";
  invalid[1] = `${"plain ".repeat(60)}改运`;
  invalid[2] = `${"plain ".repeat(60)}improve your luck`;
  const errors = validateHexagramGuides(invalid);
  assert.ok(errors.some((error) => error.includes("64")));
  assert.ok(errors.some((error) => error.includes("第 1 卦") && error.includes("字数")));
  assert.ok(errors.some((error) => error.includes("第 2 卦") && error.includes("汉字")));
  assert.ok(errors.some((error) => error.includes("第 3 卦") && error.includes("禁用词")));
});

test("生成器在临时目录产出 64 个完整卦页、索引、站点地图、robots 与 CSS", async () => {
  const root = await mkdtemp(join(tmpdir(), "hexagram-pages-"));
  try {
    await buildHexagramPages(root);
    const hexagramDir = join(root, "hexagram");
    const entries = await readdir(hexagramDir, { withFileTypes: true });
    const pageDirs = entries.filter((entry) => entry.isDirectory());
    assert.equal(pageDirs.length, 64);
    for (let number = 1; number <= 64; number += 1) {
      const html = await readFile(join(root, hexagramPath(number), "index.html"), "utf8");
      const english = getZhouyiEnglish(number);
      assert.match(html, /<!doctype html>/iu);
      assert.match(html, /<html lang="en">/u);
      assert.ok(html.includes(english.judgement));
      for (const line of english.lines) assert.ok(html.includes(line));
      for (const extra of english.extras) assert.ok(html.includes(extra));
      assert.equal((html.match(/<meta name="description"/gu) ?? []).length, 1);
      assert.match(html, new RegExp(`<link rel="canonical" href="${SITE_ORIGIN}${hexagramPath(number)}"`, "u"));
      assert.match(html, /<details class="original">/u);
      assert.doesNotMatch(html, /<details class="original" open/u);
      assert.doesNotMatch(withoutChineseDetails(html), /\p{Script=Han}/u);
      assert.doesNotMatch(html, /<script\b/iu);
      const ordered = ["<h1>", "class=\"hexagram-svg\"", "class=\"trigrams\"",
        "Plain-language guide", ">Judgement<", ">Image<", ">Six lines<",
        "class=\"original\"", "class=\"page-nav\"", "class=\"cta\""];
      ordered.reduce((previous, marker) => {
        const current = html.indexOf(marker);
        assert.ok(current > previous, `第 ${number} 卦页面结构顺序：${marker}`);
        return current;
      }, -1);
    }
    const first = await readFile(join(root, hexagramPath(1), "index.html"), "utf8");
    const second = await readFile(join(root, hexagramPath(2), "index.html"), "utf8");
    const last = await readFile(join(root, hexagramPath(64), "index.html"), "utf8");
    assert.match(first, /<dt>Use of Nines<\/dt>/u);
    assert.match(second, /<dt>Use of Sixes<\/dt>/u);
    assert.doesNotMatch(first, /rel="prev"/u);
    assert.match(first, new RegExp(`href="${hexagramPath(2)}" rel="next"`, "u"));
    assert.match(last, new RegExp(`href="${hexagramPath(63)}" rel="prev"`, "u"));
    assert.doesNotMatch(last, /rel="next"/u);

    const index = await readFile(join(hexagramDir, "index.html"), "utf8");
    assert.equal((index.match(/class="hexagram-card"/gu) ?? []).length, 64);
    assert.doesNotMatch(index, /\p{Script=Han}/u);
    const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
    assert.equal((sitemap.match(/<url>/gu) ?? []).length, 66);
    assert.ok(sitemap.includes(`${SITE_ORIGIN}${hexagramPath(50)}`));
    assert.equal(await readFile(join(root, "robots.txt"), "utf8"),
      `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
    const css = await readFile(join(hexagramDir, "hexagram.css"), "utf8");
    assert.match(css, /@media\s*\(max-width:\s*520px\)/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("所有页面的 title、description 与 canonical 各自唯一", async () => {
  const root = await mkdtemp(join(tmpdir(), "hexagram-seo-"));
  try {
    await buildHexagramPages(root);
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const canonicals = new Set<string>();
    for (let number = 1; number <= 64; number += 1) {
      const html = await readFile(join(root, hexagramPath(number), "index.html"), "utf8");
      titles.add(html.match(/<title>([^<]+)<\/title>/u)?.[1] ?? "");
      descriptions.add(html.match(/<meta name="description" content="([^"]+)"/u)?.[1] ?? "");
      canonicals.add(html.match(/<link rel="canonical" href="([^"]+)"/u)?.[1] ?? "");
    }
    assert.equal(titles.size, 64);
    assert.equal(descriptions.size, 64);
    assert.equal(canonicals.size, 64);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("静态路径支持目录 index 且保持路径穿越防护", () => {
  assert.equal(resolveStaticPath("/srv/web", "/hexagram/50-ding/"),
    "/srv/web/hexagram/50-ding/index.html");
  assert.equal(resolveStaticPath("/srv/web", "/%2e%2e/package.json"), null);
  assert.equal(resolveStaticPath("/srv/web", "/hexagram/%2e%2e/%2e%2e/package.json"), null);
});

test("本机请求处理器返回卦页目录 index 并拒绝编码后的路径穿越", async () => {
  const root = await mkdtemp(join(tmpdir(), "hexagram-server-"));
  try {
    await buildHexagramPages(root);
    const dispatch = async (url: string) => {
      const request = Readable.from([]) as IncomingMessage;
      Object.assign(request, { method: "GET", url, headers: { host: "local.test" } });
      let status = 0;
      let body = "";
      const response = {
        writeHead(nextStatus: number) { status = nextStatus; return this; },
        end(chunk?: Uint8Array | string) { body = chunk?.toString() ?? ""; return this; },
      } as unknown as ServerResponse;
      await createFrontendHandler({ publicDir: root })(request, response);
      return { status, body };
    };
    const page = await dispatch("/hexagram/50-ding/");
    assert.equal(page.status, 200);
    assert.match(page.body, /Hexagram 50: Ding \(The Cauldron\)/u);
    assert.equal((await dispatch("/%2e%2e/package.json")).status, 403);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("前端构建生成卦页且 Vercel 收集全部静态入口", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(packageJson.scripts["frontend:build"] ?? "", /build-hexagram-pages\.ts/u);
  const vercel = await readFile(new URL("../scripts/build-vercel.ts", import.meta.url), "utf8");
  for (const entry of ["hexagram", "sitemap.xml", "robots.txt"]) {
    assert.match(vercel, new RegExp(`"${entry.replace(".", "\\.")}"`, "u"));
  }
  const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  for (const entry of ["web/hexagram/", "web/sitemap.xml", "web/robots.txt"]) {
    assert.ok(gitignore.includes(entry));
  }
});
