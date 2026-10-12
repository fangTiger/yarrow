import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderIn } from "./helpers/render-in.js";
import { en } from "../web/i18n/en.js";
import { createT } from "../web/lib/i18n.js";
import {
  DEFAULT_ENTRY, applyClassification, deriveEntry, entryGate, type ClassificationView,
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

test("中英文首页渲染一句话、三步、示例入口与双处免责声明", () => {
  const zh = renderIn("zh", createElement(HomeContent));
  assert.match(zh, /古法起卦与八字排盘，三位古代流派各自解读，约半分钟给出白话结论。/u);
  assert.match(zh, /Arc 测试网，不花真钱/u);
  assert.match(zh, /看看示例结果/u);
  assert.equal((zh.match(/仅供参考与自我反思，不构成医疗、法律、投资建议/gu) ?? []).length, 2);

  const english = renderIn("en", createElement(HomeContent));
  assert.match(english, /Ancient Chinese divination — I Ching and BaZi/u);
  assert.match(english, /Arc testnet.*no real money/isu);
  assert.match(english, /See a sample reading/u);
  assert.equal((english.match(/For reference and self-reflection only/gu) ?? []).length, 2);
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

test("英文默认 Ask 但必须手选，分类关键词只提示而不自动改类型或事项", () => {
  const t = createT(en);
  assert.equal(deriveEntry(fortune, {}, t, "en").kind, "question");
  assert.equal(deriveEntry(fortune, {}, t, "en").manual, false);
  assert.equal(deriveEntry(career, { kind: "question" }, t, "en").subjectKey, "");
  assert.deepEqual(entryGate({
    questionLength: 20, classified: true,
    entry: deriveEntry(career, {}, t, "en"), birthProblem: null,
  }, t, { requireManualKind: true, requireQuestionSubject: true }), {
    ready: false, reason: "Choose a reading type.",
  });
  assert.deepEqual(entryGate({
    questionLength: 20, classified: true,
    entry: deriveEntry(career, { kind: "question" }, t, "en"), birthProblem: null,
  }, t, { requireManualKind: true, requireQuestionSubject: true }), {
    ready: false, reason: "Choose one of the seven subjects.",
  });
  assert.equal(deriveEntry(fortune, { kind: "destiny" }, t, "en").kind, "destiny");
  assert.equal(applyClassification(DEFAULT_ENTRY, fortune, t).kind, "fortune");
});

test("英文问事显示七项必选及感情事项口径", () => {
  const html = renderIn("en", createElement(SubjectSelect, {
    value: "", detected: "career", onChange: () => {}, required: true,
  }));
  assert.equal((html.match(/<option/gu) ?? []).length, 8);
  assert.match(html, /Suggested: Career.*choose one/u);
  assert.match(html, /Traditionally the Officer line is read for a partner; to ask about a wife or girlfriend, choose Wealth/u);
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
