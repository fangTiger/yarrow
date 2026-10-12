import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { PaymentAlreadyUsedError } from "../src/sanyi/reading-service.js";
import { SanyiInputError, errorCodeForError } from "../src/sanyi/http-errors.js";
import { BirthFields } from "../web/components/BirthFields.js";
import { HistoryMenu } from "../web/components/HistoryMenu.js";
import { HorizonChips } from "../web/components/HorizonChips.js";
import { KindOptions } from "../web/components/KindOptions.js";
import { NamingFields } from "../web/components/NamingFields.js";
import { SubjectSelect } from "../web/components/SubjectSelect.js";
import { en } from "../web/i18n/en.js";
import { zh } from "../web/i18n/zh.js";
import { I18nError, createT, detectLang, zhT } from "../web/lib/i18n.js";
import { paymentFailure } from "../web/lib/payment-error.js";
import { ApiError } from "../web/lib/api.js";
import { EMPTY_BIRTH } from "../web/lib/birth-profile.js";
import { DEFAULT_NAMING_FORM } from "../web/lib/home-entry.js";
import { metaMaskDeepLink } from "../web/lib/wallet-guide.js";
import { walletErrorMessage } from "../web/lib/wallet-errors.js";
import { walletSummary } from "../web/lib/wallet-summary.js";
import { COMMON_SURNAMES } from "../web/lib/surnames.js";
import { renderIn } from "./helpers/render-in.js";

const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/gu)].map((match) => match[1]).sort();
const EN_HAN_WHITELIST = new Set<keyof typeof zh>([
  "brand.seal", "lang.toggle", "sample.banner",
]);

test("中英字典键和占位符完全一致，英文值不含汉字", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const key of Object.keys(zh) as Array<keyof typeof zh>) {
    assert.deepEqual(placeholders(en[key]), placeholders(zh[key]), key);
    if (!EN_HAN_WHITELIST.has(key)) assert.doesNotMatch(en[key], /[\u3400-\u9fff]/u, key);
  }
});

test("翻译函数替换变量，I18nError 保留键与参数且默认中文", () => {
  assert.equal(zhT("history.label", { count: 3 }), "卦历（3 条）");
  const error = new I18nError("errors.birthRequired", { field: "date" });
  assert.equal(error.key, "errors.birthRequired");
  assert.deepEqual(error.params, { field: "date" });
  assert.match(error.message, /出生日期/u);
});

test("首次语言按存储优先、浏览器语言兜底，存储异常不阻断", () => {
  assert.equal(detectLang({ storage: { getItem: () => "zh" }, navigatorLanguage: "en-US" }), "zh");
  assert.equal(detectLang({ storage: { getItem: () => null }, navigatorLanguage: "zh-TW" }), "zh");
  assert.equal(detectLang({ storage: { getItem: () => null }, navigatorLanguage: "fr-FR" }), "en");
  assert.equal(detectLang({
    storage: { getItem: () => { throw new Error("blocked"); } }, navigatorLanguage: "en-GB",
  }), "en");
});

test("英文首页链路组件不泄漏中文，并使用首批用户措辞", async () => {
  Object.assign(globalThis, {
    __ARC_CHAIN_ID__: "5042002", __ARC_RPC_URL__: "https://rpc.testnet.arc.io",
    __ARC_EXPLORER__: "https://testnet.arcscan.app", __WALLETCONNECT_PROJECT_ID__: "0".repeat(32),
  });
  const { QuestionForm } = await import("../web/components/QuestionForm.js");
  const noop = () => {};
  const fragments = [
    renderIn("en", createElement(QuestionForm)),
    renderIn("en", createElement(KindOptions, { value: "question", onChange: noop })),
    renderIn("en", createElement(SubjectSelect, { value: "", detected: "", onChange: noop })),
    renderIn("en", createElement(HorizonChips, { value: "year", onChange: noop })),
    renderIn("en", createElement(BirthFields, {
      values: { ...EMPTY_BIRTH, calendar: "lunar", timeZone: "America/New_York" },
      problem: null, onChange: noop,
    })),
    renderIn("en", createElement(NamingFields, {
      value: DEFAULT_NAMING_FORM, birthProblem: null, onChange: noop,
    })),
    renderIn("en", createElement(HistoryMenu, { readings: [], defaultOpen: true })),
  ];
  const html = fragments.join("\n");
  assert.match(html, /What do you seek\?/u);
  assert.match(html, /e\.g\. Will I get this job\?/u);
  for (const label of ["Ask", "Fortune", "Destiny", "Naming", "History", "Birth time zone"]) {
    assert.match(html, new RegExp(label, "u"));
  }
  const withoutSurnameOptions = COMMON_SURNAMES.reduce(
    (text, { char }) => text.replaceAll(char, ""), html,
  );
  assert.doesNotMatch(withoutSurnameOptions, /[\u3400-\u9fff]/u);
});

test("钱包摘要、错误与 MetaMask 手机深链可本地化", () => {
  const t = createT(en);
  assert.equal(walletSummary({}, t).label, "Connect wallet");
  assert.equal(walletSummary({ address: `0x${"11".repeat(20)}`, chainId: 1 }, t).label,
    "Switch to Arc Testnet");
  assert.equal(walletErrorMessage({ code: 4001 }, t), "Payment cancelled — your funds are unchanged.");
  assert.equal(t("wallet.faucetHelp"), "At Circle's faucet, choose Arc Testnet.");
  const serverError = walletErrorMessage(new ApiError("服务暂时不可用", 500), t);
  assert.equal(serverError, "Yarrow is temporarily unavailable. Please try again later.");
  assert.doesNotMatch(serverError, /[\u3400-\u9fff]/u);
  assert.equal(metaMaskDeepLink("https://yarrow.example/path?q=1"),
    "https://metamask.app.link/dapp/yarrow.example/path?q=1");
});

test("付款、生辰和输入错误都有稳定 code", () => {
  assert.equal(errorCodeForError(new PaymentAlreadyUsedError("abcdefghijklmnopqrstuvwxyz")),
    "payment-already-used");
  assert.equal(errorCodeForError(new SanyiInputError("请先填写生辰", "birth-required")),
    "birth-required");
  assert.equal(errorCodeForError(new SanyiInputError("事项类型无效", "invalid-subject")),
    "invalid-subject");
});

test("英文付款凭证复用显示英文错误并保留已有卦入口", () => {
  const failure = paymentFailure(new ApiError(
    "付款凭证已用于这一卦",
    409,
    "abcdefghijklmnopqrstuvwxyz",
    "payment-already-used",
  ), createT(en));
  assert.deepEqual(failure, {
    message: "This payment has already been used for another reading.",
    readingId: "abcdefghijklmnopqrstuvwxyz",
    missingBirth: false,
  });
});
