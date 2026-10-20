import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  dayMasterCardHtml,
  hexagramCardHtml,
  tenGodCardHtml,
} from "../scripts/render-og-images.js";
import { DAY_MASTER_GUIDES_EN, TEN_GOD_GUIDES_EN } from "../src/content/bazi-guides.en.js";

function assertBaseCard(html: string): void {
  assert.match(html, /width:\s*1200px/u);
  assert.match(html, /height:\s*630px/u);
  assert.match(html, /Yarrow · yarrow-six\.vercel\.app/u);
  assert.match(html, /#c9a866/ui);
  assert.doesNotMatch(html, /@font-face|https?:\/\//u);
}

test("卦象卡片包含六爻、序号、拼音与英文名", () => {
  const html = hexagramCardHtml(29);
  assertBaseCard(html);
  assert.match(html, /Hexagram 29/u);
  assert.match(html, /Kan/u);
  assert.match(html, /The Abyss/u);
  assert.equal((html.match(/class="yao/gu) ?? []).length, 6);
});

test("日主与十神卡片包含页面专属标题和一句释义", () => {
  const gui = DAY_MASTER_GUIDES_EN.find((item) => item.slug === "gui-water")!;
  const officer = TEN_GOD_GUIDES_EN.find((item) => item.slug === "direct-officer")!;
  const dayMaster = dayMasterCardHtml(gui);
  const tenGod = tenGodCardHtml(officer);
  assertBaseCard(dayMaster);
  assertBaseCard(tenGod);
  assert.match(dayMaster, /Gui Water Day Master/u);
  assert.ok(dayMaster.includes(gui.tagline));
  assert.match(tenGod, /Direct Officer · Ten Gods/u);
  assert.ok(tenGod.includes(officer.tagline));
});

test("package.json 提供本机 OG 渲染命令", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.match(packageJson.scripts["og:render"] ?? "", /render-og-images\.ts/u);
});
