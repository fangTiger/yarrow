import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import type { StoredTranslation } from "../src/sanyi/translation/store.js";
import { extractUnits } from "../src/sanyi/translation/units.js";
import {
  applyReadingTranslation,
  isNativeEnglishReading,
  readingForLanguage,
  translationViewState,
  usesTranslationPipeline,
} from "../web/lib/reading-translation.js";
import { shouldPollTranslation } from "../web/lib/reading-state.js";
import { NativeEnglishNotice, TranslationStatusPanel } from "../web/pages/Reading.js";
import { createApiClient } from "../web/lib/api.js";
import { renderIn } from "./helpers/render-in.js";

const translation = (status: "pending" | "writing" | "done" | "failed", texts?: string[]) => ({
  lang: "en" as const,
  units: {
    summary: {
      status,
      sourceHash: "summary-hash",
      attempts: status === "pending" ? 0 : 1,
      failures: status === "failed" ? 1 : 0,
      ...(texts ? { texts } : {}),
    },
  },
}) satisfies StoredTranslation;

function valueAt(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, part) => {
    if (!value || typeof value !== "object") return undefined;
    return Array.isArray(value)
      ? value[Number(part)]
      : (value as Record<string, unknown>)[part];
  }, root);
}

function baziReading(kind: "destiny" | "fortune") {
  const school = kind === "destiny" ? {
    useGod: "以木为用神", headline: "稳步积累", reason: "日主得助",
    sections: [{ title: "性格", text: "做事稳妥" }], advice: ["先打基础"], evidence: [],
    periods: [
      { index: 1, verdict: "吉", confidenceTenths: 7, note: "木旺得助" },
      { index: 2, verdict: "凶", confidenceTenths: 3, note: "" },
    ],
  } : {
    useGod: "以木为用神", headline: "稳中有升", reason: "日主得助",
    sections: [{ title: "事业", text: "宜稳步推进" }],
    timing: { window: "春季", condition: "准备完成" },
    advice: ["先打基础"], evidence: [], verdict: "吉", confidenceTenths: 7,
    years: [{ year: 2026, verdict: "吉", confidenceTenths: 7, note: "机会增加" }],
  };
  return {
    id: "abcdefghijklmnopqrstuvwxyz", kind, status: "done",
    schools: Object.fromEntries(["shenxiaozhan", "yuchuntai", "rentieqiao"].map((key) => (
      [key, { status: "done", output: school, attempts: 1, retries: 0 }]
    ))),
    summary: {
      status: "done", basis: 3, attempts: 1, retries: 0,
      output: {
        conclusion: "稳步向前", agreement: "三家看法接近",
        explanation: ["先稳后进", "量力而行"],
        remedy: {
          principle: "稳住节奏", plan: [{ action: "先做准备", basis: "三家意见" }],
          avoid: ["不要急进"],
        },
        ...(kind === "destiny" ? {
          portrait: {
            traits: ["重情义", "求稳", "有担当"],
            strengths: ["做事稳妥", "愿意担当"],
            blindSpots: ["有时多虑", "偶尔固执"],
            summary: "稳中有韧，重视承诺。",
          },
          outlook: "早年宜守，中年渐顺",
        } : { tone: "顺", outlook: "前低后高" }),
      },
    },
  };
}

test("英文译文按总述清单顺序覆盖，未完成单元改为翻译占位且不保留中文", () => {
  const reading = {
    id: "abcdefghijklmnopqrstuvwxyz",
    kind: "question",
    summary: {
      status: "done",
      output: {
        conclusion: "中文结论",
        agreement: "中文共识",
        difference: "中文分歧",
        explanation: ["中文解释"],
        advice: ["中文建议"],
        outlook: "中文走势",
      },
    },
    translation: translation("done", [
      "English conclusion", "English agreement", "English difference",
      "English explanation", "English advice", "English outlook",
    ]),
  };

  const translated = applyReadingTranslation(reading as never) as unknown as typeof reading;
  assert.equal(translated.summary.output.conclusion, "English conclusion");
  assert.equal(translated.summary.output.explanation[0], "English explanation");
  assert.equal(translated.summary.output.outlook, "English outlook");

  const pending = applyReadingTranslation({
    ...reading,
    translation: translation("writing"),
  } as never) as unknown as typeof reading;
  assert.equal(pending.summary.status, "writing");
  assert.equal(pending.summary.output, undefined);
  assert.doesNotMatch(JSON.stringify(pending), /中文结论|中文解释/u);

  const failed = applyReadingTranslation({
    ...reading,
    translation: translation("failed"),
  } as never) as unknown as typeof reading;
  assert.equal(failed.summary.output, undefined);
  assert.doesNotMatch(JSON.stringify(failed.summary), /中文结论|中文解释/u);
});

test("服务端抽取与前端回填在命理、运势夹具上路径和顺序逐条一致", () => {
  for (const kind of ["destiny", "fortune"] as const) {
    const reading = baziReading(kind);
    const units = extractUnits(reading as never);
    const unitsTranslation = Object.fromEntries(units.map((unit) => [unit.key, {
      status: "done" as const,
      sourceHash: `${unit.key}-hash`, attempts: 1, failures: 0,
      // 条数与服务端完全相同：前端路径多或少都会因条数防护整单元跳过，顺序不同则填错位置，下面逐条断言即可发现。
      texts: unit.entries.map((entry) => `EN:${entry.path}`),
    }]));
    const translated = applyReadingTranslation({
      ...reading, translation: { lang: "en", units: unitsTranslation },
    } as never) as unknown;
    for (const unit of units) {
      for (const entry of unit.entries) {
        assert.equal(valueAt(translated, entry.path), `EN:${entry.path}`, `${kind} ${entry.path}`);
      }
    }
  }
});

test("英文回填覆盖命理画像与运势应期", () => {
  for (const kind of ["destiny", "fortune"] as const) {
    const reading = baziReading(kind);
    const units = extractUnits(reading as never);
    const translated = applyReadingTranslation({
      ...reading,
      translation: {
        lang: "en",
        units: Object.fromEntries(units.map((unit) => [unit.key, {
          status: "done", sourceHash: `${unit.key}-hash`, attempts: 1, failures: 0,
          texts: unit.entries.map((entry) => `EN:${entry.path}`),
        }])),
      },
    } as never) as unknown;
    if (kind === "destiny") {
      assert.equal(valueAt(translated, "summary.output.portrait.traits.0"),
        "EN:summary.output.portrait.traits.0");
      assert.equal(valueAt(translated, "summary.output.portrait.summary"),
        "EN:summary.output.portrait.summary");
    } else {
      assert.equal(valueAt(translated, "schools.shenxiaozhan.output.timing.window"),
        "EN:schools.shenxiaozhan.output.timing.window");
      assert.equal(valueAt(translated, "schools.shenxiaozhan.output.timing.condition"),
        "EN:schools.shenxiaozhan.output.timing.condition");
    }
  }
});

test("翻译状态覆盖未就绪、翻译中、完成与失败可重试", () => {
  assert.deepEqual(translationViewState(undefined), { kind: "pending" });
  assert.deepEqual(translationViewState(translation("pending")), { kind: "pending" });
  assert.deepEqual(translationViewState(translation("writing")), { kind: "writing" });
  assert.deepEqual(translationViewState(translation("done", [])), { kind: "done" });
  assert.deepEqual(translationViewState(translation("failed")), {
    kind: "failed", failedUnits: ["summary"],
  });
  assert.equal(shouldPollTranslation(undefined), true);
  assert.equal(shouldPollTranslation(translation("pending")), true);
  assert.equal(shouldPollTranslation(translation("writing")), true);
  assert.equal(shouldPollTranslation(translation("done", [])), false);
  assert.equal(shouldPollTranslation(translation("failed")), false);
});

test("中文终态单元在翻译存档中缺失时仍视为 pending 并继续轮询", () => {
  const reading = {
    kind: "question",
    schools: {
      chengyi: { status: "done" }, jingfang: { status: "writing" }, shaoyong: { status: "writing" },
    },
    summary: { status: "writing" },
  } as never;
  const partial = translation("done", []);
  assert.deepEqual(translationViewState(partial, reading), { kind: "pending" });
  assert.equal(shouldPollTranslation(partial, reading), true);
});

test("翻译状态面板显示翻译占位与失败免费重试，不承诺回退中文", () => {
  assert.match(renderIn("en", createElement(TranslationStatusPanel, {
    translation: undefined, busy: false, onRetry() {},
  })), /Translating…/u);
  assert.doesNotMatch(renderIn("en", createElement(TranslationStatusPanel, {
    translation: undefined, busy: false, onRetry() {},
  })), /Chinese is shown/u);
  assert.match(renderIn("en", createElement(TranslationStatusPanel, {
    translation: translation("writing"), busy: false, onRetry() {},
  })), /Translating…/u);
  assert.match(renderIn("en", createElement(TranslationStatusPanel, {
    translation: translation("failed"), busy: false, onRetry() {},
  })), /Part of the English translation is unavailable.*Plain-language summary.*Retry translation \(free\)/su);
  assert.match(renderIn("en", createElement(TranslationStatusPanel, {
    translation: { lang: "en", units: {
      summary: translation("failed").units.summary!,
      chengyi: { status: "writing", sourceHash: "school-hash", attempts: 1, failures: 0 },
    } },
    busy: false, onRetry() {},
  })), /Part of the English translation is unavailable.*Plain-language summary.*Retry translation \(free\)/su);
  assert.match(renderIn("en", createElement(TranslationStatusPanel, {
    translation: undefined, requestFailed: true, busy: false, onRetry() {},
  })), /Part of the English translation is unavailable.*Retry translation \(free\)/su);
  assert.equal(renderIn("en", createElement(TranslationStatusPanel, {
    translation: translation("done", []), busy: false, onRetry() {},
  })), "");
});

test("英文结果 API 使用 lang=en 并提供免费翻译触发", async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const client = createApiClient(async (input, init) => {
    calls.push({ url: String(input), method: init?.method ?? "GET",
      ...(typeof init?.body === "string" ? { body: init.body } : {}) });
    return new Response(JSON.stringify({ kind: "question" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  });
  await client.getReading("abcdefghijklmnopqrstuvwxyz", "en");
  await client.translateReading("abcdefghijklmnopqrstuvwxyz");
  assert.deepEqual(calls, [
    { url: "/api/readings/abcdefghijklmnopqrstuvwxyz?lang=en", method: "GET" },
    { url: "/api/readings/abcdefghijklmnopqrstuvwxyz/translate", method: "POST",
      body: JSON.stringify({ lang: "en" }) },
  ]);
});

test("结果页英文数据流自动触发翻译并在翻译期间轮询", () => {
  const source = readFileSync(new URL("../web/pages/Reading.tsx", import.meta.url), "utf8");
  assert.match(source, /api\.getReading\(id, lang\)/u);
  assert.match(source, /api\.translateReading\(id\)/u);
  assert.match(source, /shouldPollTranslation\(reading\.translation, reading\)/u);
  assert.match(source, /readingForLanguage\(reading, lang\)/u);
  assert.match(source, /isNativeEnglishReading\(reading\)/u);
  assert.match(source, /usesTranslationPipeline\(reading, lang\).*shouldPollTranslation/su);
  assert.match(source, /usesTranslationPipeline\(reading, lang\).*translationReady/su);
});

test("原生英文问事在英文界面直接用原 reading，中文界面显示切换提示", () => {
  const reading = { kind: "question", lang: "en" } as never;
  assert.equal(isNativeEnglishReading(reading), true);
  assert.equal(isNativeEnglishReading({ kind: "question" } as never), false);
  assert.equal(isNativeEnglishReading({ kind: "fortune", lang: "en" } as never), false,
    "N2 前命理与运势仍走翻译兼容路径");
  assert.equal(usesTranslationPipeline(reading, "en"), false);
  assert.equal(usesTranslationPipeline(reading, "zh"), false);
  assert.strictEqual(readingForLanguage(reading, "en"), reading,
    "原生英文不得克隆或套用旁路译文");
  assert.equal(usesTranslationPipeline({ kind: "question" } as never, "en"), true,
    "中文问事在英文界面的旧翻译路径保持不变");
  const html = renderIn("zh", createElement(NativeEnglishNotice));
  assert.match(html, /本卦以英文生成/u);
  assert.match(html, /切换到英文界面/u);
});

test("付款按钮的普通请求与起名请求都携带当前界面语言", () => {
  const source = readFileSync(new URL("../web/components/PaymentButton.tsx", import.meta.url), "utf8");
  assert.match(source, /const \{ lang \} = useLang\(\)/u);
  assert.match(source, /\{ \.\.\.props\.naming, feeProof, lang \}/u);
  assert.match(source, /feeProof,\s*lang,/u);
});

test("译文条数与当前路径对不上时整单元显示占位，既不错位也不露中文", () => {
  // 旧译文缺了后来加入翻译范围的应期两条：按位置回填会把建议译文填进应期。
  const reading = JSON.parse(readFileSync(new URL("../web/samples/fortune.en.json", import.meta.url), "utf8"));
  const unit = reading.translation.units.shenxiaozhan;
  const shortened = { ...reading, translation: { ...reading.translation, units: {
    ...reading.translation.units, shenxiaozhan: { ...unit, texts: unit.texts.slice(0, -2) },
  } } };
  const applied = applyReadingTranslation(shortened);
  const output = applied.schools.shenxiaozhan.output;
  assert.equal(output, undefined);
  assert.equal(applied.schools.shenxiaozhan.status, "writing");
  assert.doesNotMatch(JSON.stringify(applied.schools.shenxiaozhan), /春|建议|宜/u);
});
