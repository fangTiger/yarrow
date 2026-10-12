import assert from "node:assert/strict";
import test from "node:test";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { checkTranslation } from "../src/sanyi/translation/check.js";
import { buildTranslationPrompt, TRANSLATION_SYSTEM_PROMPT } from "../src/sanyi/translation/prompt.js";
import type { TranslationUnit } from "../src/sanyi/translation/units.js";

test("MockSchoolsProvider 为翻译任务返回一次通过核对的确定性英文", async () => {
  const unit: TranslationUnit = {
    key: "summary",
    kind: "question",
    allowedHan: [],
    entries: [{
      path: "summary.output.conclusion",
      text: "2026 年到 2026 年，用神为木，初九潜龙勿用，分 3 步行动。",
    }],
  };
  const provider = new MockSchoolsProvider();
  const request = {
    taskId: "sanyi/translate/question/summary",
    systemPrompt: TRANSLATION_SYSTEM_PROMPT,
    cacheSystemPrompt: true,
    userPrompt: buildTranslationPrompt(unit),
    schema: { type: "object" as const },
    effort: "medium" as const,
  };
  const first = await provider.generateStructured<{ texts: string[] }>(request);
  const second = await provider.generateStructured<{ texts: string[] }>(request);
  assert.deepEqual(second, first);
  assert.equal(checkTranslation(unit, first).ok, true);
  assert.doesNotMatch(first.texts[0]!, /\p{Script=Han}/u);
});
