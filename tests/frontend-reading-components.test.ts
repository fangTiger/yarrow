// tests/frontend-reading-components.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import type { QimenResult } from "../src/calendar/qimen.js";
import type { PublicReading } from "../web/lib/api.js";
import { ConsensusTrack } from "../web/components/ConsensusTrack.js";
import { FiveElementsDetail } from "../web/components/FiveElementsDetail.js";
import { FiveHexagrams } from "../web/components/FiveHexagrams.js";
import { LiuyaoTable } from "../web/components/LiuyaoTable.js";
import { QimenBoard } from "../web/components/QimenBoard.js";
import { SchoolCard } from "../web/components/SchoolCard.js";
import { TermDisclosure } from "../web/components/TermDisclosure.js";
import { almanacAt } from "../src/calendar/almanac.js";
import { qimenAt } from "../src/calendar/qimen.js";
import { deriveThrow } from "../src/sanyi/throws.js";
import { AlmanacPanel } from "../web/components/AlmanacPanel.js";
import { toView } from "../web/components/ShikongBar.js";
import { VerifyPanel } from "../web/components/VerifyPanel.js";
import { TIME, LINES, baseOutput, chart } from "./helpers/sample-question.js";
const forbidden = /易者|押钱|赔付|封存|・|[ぁ-ヿ]/u;
function school(status: string, confidenceTenths = 5) {
  return {
    status,
    retries: 0,
    output: { ...baseOutput, confidenceTenths },
  } as PublicReading["schools"]["chengyi"];
}
test("六爻表与五行详情锁定已核验第二爻", () => {
  const html = renderToStaticMarkup(createElement(
    "main",
    null,
    createElement(LiuyaoTable, { chart }),
    createElement(FiveElementsDetail, { chart }),
  ));
  assert.match(html, /官鬼/u);
  assert.match(html, /甲寅/u);
  assert.match(html, /旬空/u);
  assert.match(html, /克我/u);
  assert.match(html, /上卦 坤（土）· 下卦 乾（金）· 卦宫 坤（土）/u);
  assert.match(html, /强弱不单独等于吉凶/u);
  assert.doesNotMatch(html, forbidden);
});
test("真实五卦和术语说明完整渲染", () => {
  const html = renderToStaticMarkup(createElement(
    "main",
    null,
    createElement(FiveHexagrams, {
      figures: deriveFiveHexagrams(LINES),
      moving: [1],
    }),
    createElement(TermDisclosure, {
      term: "旬空",
      value: "寅卯",
      definition: "六十甲子的空支。",
      actual: "这一卦为寅卯空。",
    }),
  ));
  assert.match(html, /本卦 · 为体/u);
  assert.match(html, /互卦 · 探隐/u);
  assert.match(html, /变卦 · 测果/u);
  assert.match(html, /错卦 · 警变/u);
  assert.match(html, /综卦 · 观反/u);
  assert.match(html, /是什么/u);
  assert.match(html, /这一卦里/u);
  assert.doesNotMatch(html, forbidden);
});
test("奇门 fixture 按南上北下渲染关键宫", () => {
  const path = new URL("./fixtures/qimen/20260930-2015.json", import.meta.url);
  const fixture = JSON.parse(readFileSync(path, "utf8")) as QimenResult;
  const html = renderToStaticMarkup(createElement(QimenBoard, { value: fixture }));
  assert.match(html, /data-gua="巽"[\s\S]*死门/u);
  assert.match(html, /data-gua="坤"[\s\S]*值符/u);
  assert.match(html, /data-gua="兑"[\s\S]*九天/u);
  assert.match(html, /奇门按子时换日/u);
  assert.doesNotMatch(html, forbidden);
});
test("合议线保留三家原始位置并显示算术平均", () => {
  const schools = {
    chengyi: school("done", 6),
    jingfang: school("done", 3),
    shaoyong: school("done", 4),
  } as PublicReading["schools"];
  const html = renderToStaticMarkup(createElement(ConsensusTrack, { schools }));
  assert.match(html, /left:60%/u);
  assert.match(html, /left:30%/u);
  assert.match(html, /left:40%/u);
  assert.match(html, /合议 约4\.3成/u);
});
test("SchoolCard 覆盖完成、落笔、失败和拒绝四种状态", () => {
  const html = [
    school("done"),
    school("writing"),
    school("failed"),
    school("rejected"),
  ].map((value) => renderToStaticMarkup(createElement(SchoolCard, {
    schoolKey: "chengyi",
    school: value,
    onRetry() {},
  }))).join("");
  assert.match(html, /展开详断/u);
  assert.match(html, /落笔中/u);
  assert.match(html, /此家暂未落笔/u);
  assert.match(html, /此家断语未通过盘面核对，暂不展示/u);
  assert.match(html, /还可 2 次/u);
  assert.doesNotMatch(html, forbidden);
});

test("奇门展示真实日时柱与落中五寄宫", () => {
  const value = qimenAt(BigInt(Date.UTC(2026, 6, 23, 15) / 1000));
  const html = renderToStaticMarkup(createElement(QimenBoard, { value }));
  assert.ok(html.includes(`${value.dayPillar}日 · ${value.hourPillar}时`));
  const path = new URL("./fixtures/qimen/20260204-0301.json", import.meta.url);
  const fixture = JSON.parse(readFileSync(path, "utf8")) as QimenResult;
  assert.equal(fixture.chiefDoorPalace, "中五");
  const hosted = renderToStaticMarkup(createElement(QimenBoard, { value: fixture }));
  assert.ok(hosted.includes(`值使${fixture.chiefDoor}落中五（寄坤二）`));
});
test("黄历保留完整宜忌和校正后的二十八宿", () => {
  const value = almanacAt(TIME);
  const html = renderToStaticMarkup(createElement(AlmanacPanel, { value }));
  assert.ok(html.includes(value.almanac.suitable.join(" ")));
  assert.ok(html.includes(value.almanac.avoid.join(" ")));
  assert.match(html, /壁水貐/u);
  assert.doesNotMatch(html, forbidden);
});
test("黄历冲煞与时空栏使用相同格式", () => {
  const value = { ...almanacAt(TIME), clash: { description: "(甲辰)龙", direction: "北" } };
  const html = renderToStaticMarkup(createElement(AlmanacPanel, { value }));
  assert.ok(html.includes("冲龙（甲辰）煞北"));
  assert.ok(toView(value).duty.sub.includes("冲龙（甲辰）煞北"));
});
test("复算面板链接付款首笔与真实六掷区块", () => {
  Object.assign(globalThis, { __ARC_EXPLORER__: "https://testnet.arcscan.app/" });
  const firstHash = `0x${"1".repeat(64)}` as const;
  const throws = Array.from({ length: 6 }, (_, offset) => {
    const index = offset + 1;
    const blockHash = `0x${String(index).repeat(64)}` as const;
    return { ...deriveThrow({ paymentTxHash: firstHash, blockHash, question: "工作如何", index }),
      blockHash, blockNumber: String(100 + index), blockTimestamp: TIME.toString() };
  });
  const reading: PublicReading = {
    id: "sample", kind: "question", createdAt: TIME.toString(), status: "done",
    question: "工作如何", payment: { firstHash }, throws,
    subject: { suggestedKey: "career", finalKey: "career", overridden: false, changes: 0 },
    schools: { chengyi: school("done"), jingfang: school("done"), shaoyong: school("done") },
  };
  const html = renderToStaticMarkup(createElement(VerifyPanel, { reading }));
  assert.ok(html.includes(`href="https://testnet.arcscan.app/tx/${firstHash}"`));
  for (const item of throws) {
    assert.ok(html.includes(`第 ${item.index} 掷区块 #${item.blockNumber}`));
    assert.ok(html.includes(`href="https://testnet.arcscan.app/block/${item.blockNumber}"`));
  }
  assert.match(html, /sanyi-throw-v1/u);
  assert.doesNotMatch(html, forbidden);
});

test("结果页增量挂载面板并保留六掷轮询", () => {
  const source = readFileSync(new URL("../web/pages/Reading.tsx", import.meta.url), "utf8");
  for (const component of ["SubjectChange", "ConsensusTrack", "SchoolCard", "LiuyaoTable",
    "FiveElementsDetail", "QimenBoard", "AlmanacPanel", "VerifyPanel"]) {
    assert.ok(source.includes(`<${component}`), `缺少 ${component}`);
  }
  assert.match(source, /api\.retrySchool\(reading\.id, key\)/u);
  assert.match(source, /<AutoCast onReading=\{setReading\} reading=\{reading\}/u);
  assert.match(source, /shouldPollReading\(reading\)/u);
  assert.match(source, /setInterval\(\(\) => void refresh\(\), 1_000\)/u);
  assert.match(source, /toView\(reading\.almanac\)/u);
});
test("结果页样式覆盖九宫、断语、响应式与减少动态效果", () => {
  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  for (const selector of [".reading-secondary", ".qimen-board", ".school-card", ".chart-scroll",
    ".almanac-grid", ".verify-panel dl", "prefers-reduced-motion: reduce", "max-width: 620px"]) {
    assert.ok(css.includes(selector), `缺少 ${selector}`);
  }
});

test("奇门标题公开节气旬首六仪与日时空亡驿马", () => {
  const value = qimenAt(TIME);
  const html = renderToStaticMarkup(createElement(QimenBoard, { value }));
  for (const text of [value.solarTerm, `旬首${value.xunHead}遁${value.chiefStem}`,
    `日空${value.dayVoid}`, `时空${value.hourVoid}`, `驿马${value.horse}`]) {
    assert.ok(html.includes(text), `缺少 ${text}`);
  }
});

test("动阴爻仍用断线渐变，重试失败在页面内提示", () => {
  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  assert.match(css, /\.hexagram-figure \.yin\.moving\s*\{[^}]*linear-gradient/u);
  const source = readFileSync(new URL("../web/pages/Reading.tsx", import.meta.url), "utf8");
  assert.match(source, /catch \(caught\)[\s\S]*setRetryError/u);
  assert.match(source, /role="alert">\{retryError\}/u);
});
