import assert from "node:assert/strict";
import test from "node:test";
import { checkTranslation } from "../src/sanyi/translation/check.js";
import type { TranslationUnit } from "../src/sanyi/translation/units.js";

function unit(text = "2026 年用神为木，计划分 3 步") : TranslationUnit {
  return {
    key: "summary",
    kind: "fortune",
    entries: [{ path: "summary.output.conclusion", text }],
    allowedHan: [],
  };
}

test("核对器接受条数、汉字、数字、术语与古文均合格的译文", () => {
  const result = checkTranslation(unit(), {
    texts: [
      "In 2026, Yong Shen (the key element for the question) is Wood; the plan has 3 steps.",
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.invalidIndexes, []);
});

test("核对器逐项报告条数不一致与缺项", () => {
  const value = { ...unit(), entries: [
    { path: "a", text: "第一段" }, { path: "b", text: "第二段" },
  ] };
  const result = checkTranslation(value, { texts: ["First"] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.invalidIndexes, [1]);
  assert.ok(result.errors.some((error) => error.includes("条数")));
});

test("核对器拒绝非白名单汉字并允许显式列出的名字", () => {
  const rejected = checkTranslation(unit("结论"), { texts: ["Conclusion 结论"] });
  assert.ok(rejected.errors.some((error) => error.includes("汉字")));
  const named = { ...unit("名字寓意清朗"), allowedHan: ["林清和"] };
  assert.equal(checkTranslation(named, { texts: ["林清和 (Lin Qinghe) means clarity."] }).ok, true);
});

test("姓名里的干支字不误当术语", () => {
  const named = { ...unit("名字子涵寓意开阔"), allowedHan: ["子涵", "子", "涵"] };
  const result = checkTranslation(named, { texts: ["子涵 (the name) suggests an open mind."] });
  assert.equal(result.ok, true);
});

test("核对器拒绝遗漏数字或四位年份", () => {
  const result = checkTranslation(unit(), {
    texts: ["Yong Shen (the key element) is Wood; the plan has three steps."],
  });
  assert.ok(result.errors.some((error) => error.includes("2026")));
  assert.ok(result.errors.some((error) => error.includes("3")));
});

test("核对器拒绝未使用两字以上专业术语的规定译名", () => {
  const result = checkTranslation(unit("用神为木"), { texts: ["The useful factor is timber."] });
  assert.ok(result.errors.some((error) => error.includes("Yong Shen")));
  // 单字五行只作参考，不强制。
  assert.ok(!result.errors.some((error) => error.includes("Wood")));
});

test("专业术语写出拼音即通过，不分大小写，不要求每次带括注", () => {
  assert.equal(checkTranslation(unit("用神得力"), { texts: ["Yong Shen is effective."] }).ok, true);
  assert.equal(checkTranslation(unit("用神得力"), { texts: ["The yong shen is effective."] }).ok, true);
});

test("日常用词里的单字术语、六亲与吉凶不强制译名", () => {
  const everyday = unit("孩子的金钱运势平稳，兄弟和睦，离开前心情愉快，吉祥如意");
  const result = checkTranslation(everyday, {
    texts: ["The child's money luck is steady; brothers get along; spirits are high before leaving; all is well."],
  });
  assert.equal(result.ok, true, result.errors.join("；"));
});

test("多余译文不把已有正确项标成错项", () => {
  const value = { ...unit("普通结论"), entries: [{ path: "a", text: "普通结论" }] };
  const result = checkTranslation(value, { texts: ["Conclusion.", "Extra."] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.invalidIndexes, []);
});

test("核对器要求正文引用的古文使用离线固定译文", () => {
  const result = checkTranslation(unit("乾卦初九说潜龙勿用。"), {
    texts: ["Qian says that a hidden dragon should wait."],
  });
  assert.ok(result.errors.some((error) => error.includes("A hidden dragon does not act.")));
});

test("提示词只列专业术语与五行，不列会误导的单字（如「平」→ Mixed）；写明名字与古文的译法", async () => {
  const { buildTranslationPrompt, TRANSLATION_SYSTEM_PROMPT } = await import("../src/sanyi/translation/prompt.js");
  const prompt = buildTranslationPrompt(unit("张姓阴平，用神为木，子时出生"));
  assert.doesNotMatch(prompt, /Mixed/u);
  assert.doesNotMatch(prompt, /"source":"子"/u);
  assert.match(prompt, /Yong Shen/u);
  assert.match(prompt, /Wood/u);
  assert.match(TRANSLATION_SYSTEM_PROMPT, /书灵 \(Shu Ling\)/u);
  assert.match(TRANSLATION_SYSTEM_PROMPT, /古文、诗句/u);
});

test("硬性与软性问题分开：条数、汉字、四位年份为硬性；其他数字、术语、古文为软性", () => {
  const soft = checkTranslation(unit("2026 年用神为木，凶 4 成"), {
    texts: ["In 2026 the key factor is Wood; unfavorable."],
  });
  assert.equal(soft.ok, false);
  assert.equal(soft.acceptable, true);
  assert.ok(soft.warnings.some((item) => item.includes("4")));
  const hard = checkTranslation(unit("2026 年用神为木"), { texts: ["The key factor is Wood 木."] });
  assert.equal(hard.acceptable, false);
  assert.ok(hard.hardErrors.some((item) => item.includes("汉字")));
  assert.ok(hard.hardErrors.some((item) => item.includes("2026")));
});

test("几成写成 4 in 10 或 40% 都算保留数字；术语写出英文释义也算", () => {
  assert.equal(checkTranslation(unit("凶 4 成"), { texts: ["Unfavorable, about 40%."] }).ok, true);
  assert.equal(checkTranslation(unit("凶 4 成"), { texts: ["Unfavorable, about 4 in 10."] }).ok, true);
  assert.equal(checkTranslation(unit("动爻在三爻"), { texts: ["The changing line is the third line."] }).ok, true);
});

test("以英文为主的译文里，原样引用本条中文原文的片段算引用，放行", () => {
  const quoted = unit("取「美目清兮」中清字");
  const ok = checkTranslation(quoted, { texts: ["Takes 清 from the line 美目清兮 (her beautiful eyes are clear)."] });
  assert.equal(ok.acceptable, true, ok.hardErrors.join("；"));
  // 原文里没有的汉字，或几乎没翻译，仍算硬性问题。
  const lazy = checkTranslation(unit("事业旺盛"), { texts: ["事业旺盛"] });
  assert.equal(lazy.acceptable, false);
  const foreign = checkTranslation(unit("事业顺利"), { texts: ["Career is 旺盛 and smooth."] });
  assert.equal(foreign.acceptable, false);
});

test("提示词列出两字以上的参考术语（如官鬼 → Officer），并写明爻位与可读性要求", async () => {
  const { buildTranslationPrompt, TRANSLATION_SYSTEM_PROMPT } = await import("../src/sanyi/translation/prompt.js");
  const prompt = buildTranslationPrompt(unit("官鬼伏藏，体卦受克，上九发动"));
  assert.match(prompt, /Officer/u);
  assert.match(prompt, /self trigram/u);
  assert.match(TRANSLATION_SYSTEM_PROMPT, /the top line/u);
  assert.match(TRANSLATION_SYSTEM_PROMPT, /不懂易经/u);
});
