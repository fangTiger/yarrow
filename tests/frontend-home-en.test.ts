import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderIn } from "./helpers/render-in.js";
import { en } from "../web/i18n/en.js";
import { createT } from "../web/lib/i18n.js";
import {
  DEFAULT_ENTRY, applyClassification, deriveEntry, entryGate, exampleSubject, type ClassificationView,
} from "../web/lib/home-entry.js";
import { KindOptions } from "../web/components/KindOptions.js";
import { SubjectSelect } from "../web/components/SubjectSelect.js";
import { COMMON_SURNAMES, filterSurnames } from "../web/lib/surnames.js";
import { NamingFields } from "../web/components/NamingFields.js";
import { DEFAULT_NAMING_FORM } from "../web/lib/home-entry.js";
import { isSurname } from "../src/sanyi/naming/lexicon.js";

Object.assign(globalThis, {
  __ARC_CHAIN_ID__: "5042002", __ARC_RPC_URL__: "https://rpc.testnet.arc.io",
  __ARC_EXPLORER__: "https://testnet.arcscan.app", __WALLETCONNECT_PROJECT_ID__: "0".repeat(32),
});
const { HomeContent } = await import("../web/pages/Home.js");

const fortune: ClassificationView = {
  question: "How will this year go?", kind: "fortune", supported: true, horizon: "year",
};
const career: ClassificationView = {
  question: "Will I get this job?", kind: "question", supported: true,
  subjectKey: "career", subject: "工作／官职",
};

test("中英文首页渲染一句话、三步、示例入口且免责声明只出现一次", () => {
  const zh = renderIn("zh", createElement(HomeContent));
  assert.match(zh, /输入生辰，看你一生的大运起伏与性格底色/u);
  assert.match(zh, /Arc 测试网，不花真钱/u);
  assert.match(zh, /看看示例结果/u);
  assert.equal((zh.match(/仅供参考与自我反思，不构成医疗、法律、投资建议/gu) ?? []).length, 1);

  const english = renderIn("en", createElement(HomeContent));
  assert.match(english, /Enter your birth date to see the ten-year luck cycles of your life/u);
  assert.match(english, /Arc testnet.*no real money/isu);
  assert.match(english, /See a sample reading/u);
  assert.equal((english.match(/For reference and self-reflection only/gu) ?? []).length, 1);
  const visible = english.replace(/<[^>]+>/gu, " ").replaceAll("问", "");
  assert.doesNotMatch(visible, /[\p{Script=Han}]/u);
});

test("四类卡各有说明与可点击示例问题", () => {
  const html = renderIn("en", createElement(KindOptions, {
    value: "question", onChange: () => {}, onExample: () => {},
  }));
  for (const kind of ["question", "fortune", "destiny", "naming"]) {
    assert.match(html, new RegExp(`data-kind-card="${kind}"`, "u"));
    assert.ok((html.match(new RegExp(`data-example-kind="${kind}"`, "gu")) ?? []).length >= 2);
  }
  assert.match(html, /A specific decision or situation/u);
  assert.match(html, /Will I get this job\?/u);
});

test("手机类型卡保持 2×2 并只在卡片组下展示选中项详情", () => {
  const html = renderIn("en", createElement(KindOptions, {
    value: "fortune", onChange: () => {}, onExample: () => {},
  }));
  assert.match(html, /class="kind-selected-detail" data-selected-kind="fortune"/u);
  assert.match(html, /The overall pattern for today/u);

  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  assert.match(css,
    /@media\s*\(max-width:\s*560px\)[\s\S]*?\.kind-options\s*\{[^}]*grid-template-columns:\s*repeat\(2,/u);
  assert.match(css,
    /@media\s*\(max-width:\s*560px\)[\s\S]*?\.kind-card\s*>\s*p[^}]*display:\s*none/u);
  assert.match(css,
    /@media\s*\(max-width:\s*560px\)[\s\S]*?\.kind-card\s+\.kind-examples[^}]*display:\s*none/u);
  assert.match(css,
    /@media\s*\(max-width:\s*560px\)[\s\S]*?\.home-luopan[^}]*min\(140px,\s*40vw\)/u);
});

test("英文默认 Destiny；高亮的类型即所选，不跑中文关键词分类；问事必须手选事项", () => {
  const t = createT(en);
  const english = { autoClassify: false, requireQuestionSubject: true };
  assert.equal(deriveEntry(fortune, {}, t, "en").kind, "destiny");
  assert.equal(deriveEntry(career, { kind: "question" }, t, "en").subjectKey, "");
  // 用户没点类型卡、也没等分类：默认高亮的 Destiny 写了问题即可付款。
  assert.deepEqual(entryGate({
    questionLength: 24, classified: false,
    entry: deriveEntry(undefined, {}, t, "en"), birthProblem: null,
  }, t, english), { ready: true, reason: "" });
  assert.deepEqual(entryGate({
    questionLength: 20, classified: false,
    entry: deriveEntry(undefined, { kind: "question" }, t, "en"), birthProblem: null,
  }, t, english), { ready: false, reason: "Choose one of the seven subjects." });
  assert.deepEqual(entryGate({
    questionLength: 20, classified: false,
    entry: deriveEntry(undefined, { kind: "question", subjectKey: "career", subject: "" }, t, "en"),
    birthProblem: null,
  }, t, english), { ready: true, reason: "" });
  assert.equal(deriveEntry(fortune, { kind: "destiny" }, t, "en").kind, "destiny");
  assert.equal(applyClassification(DEFAULT_ENTRY, fortune, t).kind, "fortune");
});

test("英文问事未选事项时提示「Choose a subject」并高亮；示例问题一并选好事项", () => {
  const empty = renderIn("en", createElement(SubjectSelect, {
    value: "", detected: "", onChange: () => {}, required: true,
  }));
  assert.match(empty, /<option value="" selected="">Choose a subject<\/option>/u);
  assert.match(empty, /class="detail-row needs-choice"/u);
  assert.doesNotMatch(empty, /Suggested/u);
  const chosen = renderIn("en", createElement(SubjectSelect, {
    value: "career", detected: "", onChange: () => {}, required: true,
  }));
  assert.match(chosen, /class="detail-row"/u);
  const zh = renderIn("zh", createElement(SubjectSelect, {
    value: "", detected: "career", onChange: () => {},
  }));
  assert.match(zh, /自动识别（工作／官职）/u);
  assert.doesNotMatch(zh, /needs-choice/u);

  assert.equal(exampleSubject("question", 1), "career");
  assert.equal(exampleSubject("question", 2), "documents");
  assert.equal(exampleSubject("destiny", 1), undefined);
});

test("类型卡整卡可点，悬停有高亮反馈，选中卡金边", () => {
  const css = readFileSync(new URL("../web/styles/components.css", import.meta.url), "utf8");
  assert.match(css, /\.kind-card \{[^}]*cursor: pointer/u);
  assert.match(css, /@media \(hover: hover\) \{[\s\S]*?\.kind-card:hover \{[^}]*border-color/u);
  assert.match(css, /\.kind-card:has\(\.kind-option\[aria-checked="true"\]\) \{[^}]*border-color: var\(--gold\)/u);
});

test("中英文感情事项口径只在选中 relationship 时显示", () => {
  const career = renderIn("en", createElement(SubjectSelect, {
    value: "career", detected: "career", onChange: () => {}, required: true,
  }));
  assert.equal((career.match(/<option/gu) ?? []).length, 8);
  assert.doesNotMatch(career, /Traditionally the Officer line is read for a partner/u);

  const relationship = renderIn("en", createElement(SubjectSelect, {
    value: "relationship", detected: "", onChange: () => {}, required: true,
  }));
  assert.match(relationship,
    /Traditionally the Officer line is read for a partner; to ask about a wife or girlfriend, choose Wealth/u);

  const zhCareer = renderIn("zh", createElement(SubjectSelect, {
    value: "career", detected: "", onChange: () => {},
  }));
  const zhRelationship = renderIn("zh", createElement(SubjectSelect, {
    value: "relationship", detected: "", onChange: () => {},
  }));
  const zhDetectedRelationship = renderIn("zh", createElement(SubjectSelect, {
    value: "", detected: "relationship", onChange: () => {},
  }));
  const zhOverrideRelationship = renderIn("zh", createElement(SubjectSelect, {
    value: "career", detected: "relationship", onChange: () => {},
  }));
  assert.doesNotMatch(zhCareer, /传统上以官鬼为用神/u);
  assert.match(zhRelationship, /传统上以官鬼为用神；问妻子或女友请选择钱财/u);
  assert.match(zhDetectedRelationship, /传统上以官鬼为用神；问妻子或女友请选择钱财/u);
  assert.doesNotMatch(zhOverrideRelationship, /传统上以官鬼为用神/u);
});

test("首页移除页脚免责声明，正式与示例结果页保留页脚", () => {
  const home = readFileSync(new URL("../web/pages/Home.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../web/components/QuestionForm.tsx", import.meta.url), "utf8");
  const reading = readFileSync(new URL("../web/pages/Reading.tsx", import.meta.url), "utf8");
  const sample = readFileSync(new URL("../web/pages/SampleReading.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /home-footer|home\.disclaimer/u);
  assert.match(form, /payment-disclaimer[^\n]*home\.disclaimer/u);
  assert.equal((reading.match(/<DisclaimerFooter/gu) ?? []).length, 5);
  assert.equal((sample.match(/<DisclaimerFooter/gu) ?? []).length, 1);
});

test("姓氏选择器数据为 100 项，可按拼音首字母筛选并保留汉字直输", () => {
  assert.equal(COMMON_SURNAMES.length, 100);
  assert.ok(COMMON_SURNAMES.every(({ char }) => isSurname(char)));
  assert.ok(filterSurnames("l").some(({ char }) => char === "林"));
  assert.ok(filterSurnames("L").every(({ pinyin }) => pinyin.toLowerCase().startsWith("l")));
  const html = renderIn("en", createElement(NamingFields, {
    value: DEFAULT_NAMING_FORM, birthProblem: null, onChange: () => {},
  }));
  assert.match(html, /type="search"/u);
  assert.match(html, /林[\s\S]*Lín[\s\S]*forest/u);
  assert.match(html, /aria-label="Surname"[^>]*maxLength="2"/u);
});

test("钱包安装提示只由付款区承载，顶栏钱包组件只保留按钮", async () => {
  const { readFileSync } = await import("node:fs");
  const wallet = readFileSync(new URL("../web/components/WalletBar.tsx", import.meta.url), "utf8");
  const payment = readFileSync(new URL("../web/components/PaymentButton.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(wallet, /wallet\.install|wallet\.mobile|wallet-guide/u);
  assert.match(payment, /WalletPaymentGuide/u);
});
