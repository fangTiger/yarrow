import { ZHOUYI_CORPUS } from "../src/agent/zhouyi-corpus.js";
import assert from "node:assert/strict";
import test from "node:test";
import { selectPrimaryOracleText } from "../src/calendar/bianzhan.js";
import { deriveMeihua } from "../src/calendar/meihua.js";
import { buildLiuyaoChart, deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { auditOutput, tokenizeClaim } from "../src/sanyi/audit.js";
import { buildQuestionFacts } from "../src/sanyi/facts.js";
import { baseOutput } from "./helpers/sample-question.js";

const lines = [8, 9, 8, 8, 8, 7];
const timestamp = 1791288000n;
const chart = buildLiuyaoChart({
  lines,
  timestamp,
  focus: { subjectKey: "daily", subjectLabel: "运势", useGod: "兄弟", overridden: false },
});
const five = deriveFiveHexagrams(lines);
const main = selectPrimaryOracleText(lines);
const facts = buildQuestionFacts(chart, five, deriveMeihua(lines, timestamp), main);

function check(ref: string, claim: string) {
  return auditOutput({ ...baseOutput, evidence: [{ ref, claim }] }, facts);
}

test("复现山水蒙之山地剥的真实盘面", () => {
  assert.equal(five.primary.name, "山水蒙");
  assert.equal(five.derived.name, "山地剥");
  assert.equal(five.mutual.name, "地雷复");
  assert.equal(main.primary.label, "九二");
  assert.ok(main.primary.text.includes("子"));
  assert.equal(chart.day.ganzhi, "癸丑");
  assert.equal(chart.month.branch, "酉");
  assert.equal(chart.rows[2]?.primary.stemBranch, "戊午");
  assert.equal(chart.rows[2]?.primary.strength, "囚");
  assert.ok(chart.focus?.useGodPositions.includes(3));
});

const passing = [
  ["main-text", "九二：包蒙吉，纳妇吉，子克家。"],
  ["hexagram:primary", `山水蒙 卦辞：${five.primary.judgement}`],
  ["hexagram:primary", "本卦山水蒙，主未明待启。"],
  ["line:3", "3爻戊午火兄弟，朱雀，囚，用神兄弟处囚地。"],
  ["day", "日辰癸丑，旬空寅卯。"],
  ["本卦 山水蒙 卦辞", `山水蒙：${five.primary.judgement}`],
  ["之卦 山地剥 卦辞", `山地剥：${five.derived.judgement}`],
  ["主占之辞 九二", "九二：包蒙吉，纳妇吉，子克家。"],
  ["month：月建酉", "月建酉"],
  ["body-use：艮为体，坎为用", "艮为体，坎为用"],
  ["hexagram:primary：山水蒙", "山水蒙"],
  ["hexagram:mutual：地雷复", "地雷复"],
  ["3爻", "戊午火兄弟"],
  ["初爻", chart.rows[0]!.primary.stemBranch],
  ["上爻", chart.rows[5]!.primary.stemBranch],
  ["月建", "月建酉，日辰癸丑，自己辛苦申请，孩子未来未定未成未必尚未"],
  ["body-use", "艮土为体，坎水为用"],
];
for (const [ref, claim] of passing) {
  test(`真实引证通过：${ref} | ${claim}`, () => {
    const result = check(ref!, claim!);
    assert.equal(result.ok, true, result.errors.join("；"));
  });
}

for (const [ref, claim, error] of [
  ["line:3", "3爻甲子水妻财", "不支持关键词"],
  ["month", "山地剥", "引证与所引事实无关"],
  ["foo:9", "山水蒙", "事实编号不存在"],
]) {
  test(`拒绝错误引证：${ref} | ${claim}`, () => {
    const result = check(ref!, claim!);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((message) => message.includes(error!)), result.errors.join("；"));
  });
}

test("正文仍拒绝不存在的寅木官鬼组合", () => {
  const result = auditOutput({ ...baseOutput, evidence: [], reason: "寅木官鬼" }, facts);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("盘面组合")));
});

test("所供原文中的连续片段免于核对，原文外虚构组合仍被拒绝", () => {
  assert.equal(check("main-text", "包蒙吉，纳妇吉，子克家。").ok, true);
  assert.equal(check("main-text", "子克家。").ok, true);
  const result = auditOutput({ ...baseOutput, evidence: [], reason: `${main.primary.text} 寅木官鬼` }, facts);
  assert.equal(result.ok, false);
});

test("六十四卦及八卦复合名整体分词", () => {
  assert.equal(ZHOUYI_CORPUS.length, 64);
  for (const hexagram of ZHOUYI_CORPUS) {
    assert.deepEqual(tokenizeClaim(hexagram.name), [hexagram.name]);
  }
  assert.deepEqual(tokenizeClaim("山水蒙地雷复水火既济坎水艮土日辰月建"),
    ["山水蒙", "地雷复", "水火既济", "坎水", "艮土", "日辰", "月建"]);
});

test("用原忌仇神按本爻与伏神六亲补入事实", () => {
  for (const useGod of ["兄弟", "妻财"]) {
    const focused = buildLiuyaoChart({ lines, timestamp,
      focus: { subjectKey: "daily", subjectLabel: "运势", useGod, overridden: false } });
    const table = buildQuestionFacts(focused, five, deriveMeihua(lines, timestamp), main);
    for (const row of focused.rows) {
      for (const [word, relation] of [
        ["用神", focused.focus!.useGod], ["原神", focused.focus!.originalGod],
        ["忌神", focused.focus!.tabooGod], ["仇神", focused.focus!.enemyGod],
      ]) {
        assert.equal(table.get(`line:${row.position}`)!.tokens.has(word!),
          row.primary.relation === relation || row.hidden?.relation === relation);
      }
    }
    if (useGod === "妻财") {
      assert.ok(focused.focus!.hiddenUseGodPositions.length > 0);
    }
  }
});

test("月建本气当月必旺，「月建酉金旺」通过；爻上虚称旺仍按全盘核对", () => {
  assert.deepEqual(check("month", "月建酉金旺，泄艮体之气").errors, []);
  assert.equal(check("month", "月建酉金，寅木官鬼").ok, false);
});
