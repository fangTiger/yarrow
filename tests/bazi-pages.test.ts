import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildHexagramPages, SITE_ORIGIN } from "../scripts/build-hexagram-pages.js";
import { DAY_MASTER_GUIDES_EN, TEN_GOD_GUIDES_EN } from "../src/content/bazi-guides.en.js";
import { hexagramPath } from "../web/lib/hexagram-path.js";

function metaValue(html: string, pattern: RegExp): string {
  return html.match(pattern)?.[1] ?? "";
}

test("生成器产出八字索引、20 个英文详情页、互链、CTA、信标与完整 sitemap", async () => {
  const root = await mkdtemp(join(tmpdir(), "bazi-pages-"));
  try {
    await buildHexagramPages(root);
    const dayMasterDirs = (await readdir(join(root, "bazi/day-master"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory());
    const tenGodDirs = (await readdir(join(root, "bazi/ten-gods"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory());
    assert.equal(dayMasterDirs.length, 10);
    assert.equal(tenGodDirs.length, 10);

    const paths = ["/bazi/", ...DAY_MASTER_GUIDES_EN.map((item) => `/bazi/day-master/${item.slug}/`),
      ...TEN_GOD_GUIDES_EN.map((item) => `/bazi/ten-gods/${item.slug}/`)];
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const canonicals = new Set<string>();
    for (const path of paths) {
      const html = await readFile(join(root, path, "index.html"), "utf8");
      assert.match(html, /<!doctype html>/iu);
      assert.match(html, /<html lang="en">/u);
      assert.match(html, /href="\/hexagram\/hexagram\.css"/u);
      assert.match(html, /Find your Day Master \(free\)/u);
      assert.match(html, /Get a full BaZi reading · 0\.05 USDC/u);
      assert.match(html, /bazi_page_view/u);
      assert.doesNotMatch(html, /\p{Script=Han}/u);
      const title = metaValue(html, /<title>([^<]+)<\/title>/u);
      const description = metaValue(html, /<meta name="description" content="([^"]+)"/u);
      const canonical = metaValue(html, /<link rel="canonical" href="([^"]+)"/u);
      assert.ok(title, `${path} 缺少 title`);
      assert.ok(description, `${path} 缺少 description`);
      assert.equal(canonical, `${SITE_ORIGIN}${path}`);
      assert.equal((html.match(/<title>/gu) ?? []).length, 1);
      assert.equal((html.match(/<meta name="description"/gu) ?? []).length, 1);
      assert.equal((html.match(/<link rel="canonical"/gu) ?? []).length, 1);
      for (const marker of [
        "og:title", "og:description", "og:url", "og:image",
        "twitter:card", "twitter:title", "twitter:description", "twitter:image",
      ]) {
        assert.equal((html.match(new RegExp(`(?:property|name)="${marker}"`, "gu")) ?? []).length, 1,
          `${path} 缺少或重复 ${marker}`);
      }
      titles.add(title);
      descriptions.add(description);
      canonicals.add(canonical);
    }
    assert.equal(titles.size, 21);
    assert.equal(descriptions.size, 21);
    assert.equal(canonicals.size, 21);

    const index = await readFile(join(root, "bazi/index.html"), "utf8");
    assert.equal((index.match(/class="bazi-card"/gu) ?? []).length, 20);
    const gui = await readFile(join(root, "bazi/day-master/gui-water/index.html"), "utf8");
    assert.match(gui, /href="\/bazi\/day-master\/ren-water\/"/u);
    assert.match(gui, /href="\/bazi\/ten-gods\//u);
    const officer = await readFile(join(root, "bazi/ten-gods/direct-officer/index.html"), "utf8");
    assert.match(officer, /href="\/bazi\/ten-gods\/seven-killings\/"/u);

    const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
    assert.equal((sitemap.match(/<url>/gu) ?? []).length, 87);
    for (const path of paths) assert.ok(sitemap.includes(`${SITE_ORIGIN}${path}`));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("专属 PNG 存在时写入绝对 OG 地址，不存在时回退默认图", async () => {
  const root = await mkdtemp(join(tmpdir(), "bazi-og-"));
  try {
    await mkdir(join(root, "brand/og/hexagram"), { recursive: true });
    await mkdir(join(root, "brand/og/bazi/day-master"), { recursive: true });
    await mkdir(join(root, "brand/og/bazi/ten-gods"), { recursive: true });
    await writeFile(join(root, "brand/og/hexagram/29.png"), "png");
    await writeFile(join(root, "brand/og/bazi/day-master/gui-water.png"), "png");
    await writeFile(join(root, "brand/og/bazi/ten-gods/direct-officer.png"), "png");
    await buildHexagramPages(root);

    const cases = [
      [hexagramPath(29), `${SITE_ORIGIN}/brand/og/hexagram/29.png`],
      ["/bazi/day-master/gui-water/", `${SITE_ORIGIN}/brand/og/bazi/day-master/gui-water.png`],
      ["/bazi/ten-gods/direct-officer/", `${SITE_ORIGIN}/brand/og/bazi/ten-gods/direct-officer.png`],
    ] as const;
    for (const [path, image] of cases) {
      const html = await readFile(join(root, path, "index.html"), "utf8");
      assert.match(html, new RegExp(`<meta property="og:image" content="${image}"`, "u"));
      assert.match(html, new RegExp(`<meta name="twitter:image" content="${image}"`, "u"));
    }
    const fallback = await readFile(join(root, "bazi/day-master/jia-wood/index.html"), "utf8");
    assert.match(fallback, new RegExp(`${SITE_ORIGIN}/brand/og\\.png`, "u"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("构建配置收集 bazi，生成物被忽略且 PNG 不被忽略", async () => {
  const vercel = await readFile(new URL("../scripts/build-vercel.ts", import.meta.url), "utf8");
  assert.match(vercel, /"bazi"/u);
  const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  assert.ok(gitignore.includes("web/bazi/"));
  assert.doesNotMatch(gitignore, /web\/brand\/og\/(?:\*\*|bazi|hexagram)/u);
});
