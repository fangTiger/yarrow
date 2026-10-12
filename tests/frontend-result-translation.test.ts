import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import type { StoredTranslation } from "../src/sanyi/translation/store.js";
import {
  applyReadingTranslation,
  translationViewState,
} from "../web/lib/reading-translation.js";
import { shouldPollTranslation } from "../web/lib/reading-state.js";
import { TranslationStatusPanel } from "../web/pages/Reading.js";
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

test("英文译文按总述清单顺序覆盖，未完成单元保留中文", () => {
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
  assert.equal(pending.summary.output.conclusion, "中文结论");
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

test("翻译状态面板显示中文回退、翻译中与失败免费重试", () => {
  assert.match(renderIn("en", createElement(TranslationStatusPanel, {
    translation: undefined, busy: false, onRetry() {},
  })), /Translating….*Chinese is shown for now/su);
  assert.match(renderIn("en", createElement(TranslationStatusPanel, {
    translation: translation("writing"), busy: false, onRetry() {},
  })), /Translating…/u);
  assert.match(renderIn("en", createElement(TranslationStatusPanel, {
    translation: translation("failed"), busy: false, onRetry() {},
  })), /Part of the English translation is unavailable.*Retry translation \(free\)/su);
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
  assert.match(source, /shouldPollTranslation\(reading\.translation\)/u);
  assert.match(source, /applyReadingTranslation\(reading\)/u);
});
