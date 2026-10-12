import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { createFrontendServer } from "../src/frontend/server.js";
import { createSanyiApi, type SanyiApi } from "../src/sanyi/api.js";
import { errorCodeForError, statusForError } from "../src/sanyi/http-errors.js";
import {
  NotReadyError,
  TranslationBudgetError,
} from "../src/sanyi/translation/service.js";

const ID = "abcdefghijklmnopqrstuvwxyz";

function reading() {
  const output = {
    verdict: "吉" as const, confidenceTenths: 7, headline: "可行", reason: "理由充分",
    sections: [{ title: "结论", text: "可以推进" }], advice: ["稳步行动"],
    evidence: [{ ref: "e", claim: "依据" }],
  };
  return {
    id: ID, kind: "question" as const, createdAt: "2026-10-13T00:00:00.000Z",
    question: "能否推进", status: "done" as const, throws: [],
    payment: { payer: `0x${"11".repeat(20)}`, recipient: `0x${"22".repeat(20)}`,
      transactionHash: `0x${"33".repeat(32)}`, feeUsdc6: "50000" },
    subject: { suggestedKey: "career" as const, finalKey: "career" as const,
      overridden: false, changes: 0 },
    schools: {
      chengyi: { status: "done" as const, output, attempts: 1, retries: 0 },
      jingfang: { status: "done" as const, output, attempts: 1, retries: 0 },
      shaoyong: { status: "done" as const, output, attempts: 1, retries: 0 },
    },
  };
}

function serviceBoundary() {
  return {
    createQuestionReading: async () => reading(),
    continueCasting: async () => reading(),
    getReading: async () => reading(),
    retrySchool: async () => reading(),
    changeSubject: async () => reading(),
    retrySummary: async () => reading(),
  };
}

test("API 触发英文翻译，GET lang=en 才附带旁路译文", async () => {
  let triggers = 0;
  const translation = { lang: "en" as const, units: {
    summary: { status: "done" as const, sourceHash: "abc", texts: ["Ready"],
      attempts: 1, failures: 0 },
  } };
  const api = createSanyiApi(serviceBoundary() as never, {
    translation: {
      trigger: async () => { triggers += 1; return translation; },
      read: async () => translation,
    },
  });
  assert.deepEqual(await api.translateReading(ID, { lang: "en" }), translation);
  assert.equal(triggers, 1);
  assert.equal("translation" in await api.getReading(ID), false);
  assert.deepEqual((await api.getReading(ID, "en") as { translation: unknown }).translation, translation);
  await assert.rejects(() => api.translateReading(ID, { lang: "zh" }), /只支持英文翻译/);
});

function fakeApi(overrides: Partial<SanyiApi> = {}): SanyiApi {
  return {
    payment: async () => ({}) as never,
    now: async () => ({}) as never,
    classify: async () => ({}) as never,
    createReading: async () => reading() as never,
    continueCasting: async () => reading() as never,
    retrySummary: async () => reading() as never,
    getReading: async () => reading() as never,
    retrySchool: async () => reading() as never,
    changeSubject: async () => reading() as never,
    changeDayBoundary: async () => reading() as never,
    translateReading: async () => ({ lang: "en", units: {} }),
    ...overrides,
  };
}

test("HTTP 暴露 POST translate 与 GET lang=en", async () => {
  const root = await mkdtemp(join(tmpdir(), "sanyi-translation-api-"));
  const publicDir = join(root, "web");
  await mkdir(publicDir);
  await writeFile(join(publicDir, "index.html"), "三易", "utf8");
  const calls: string[] = [];
  const api = fakeApi({
    translateReading: async (_id, body) => {
      calls.push(`post:${JSON.stringify(body)}`);
      return { lang: "en", units: {} };
    },
    getReading: async (_id, lang) => {
      calls.push(`get:${lang}`);
      return reading() as never;
    },
  });
  const server = createFrontendServer({ publicDir, api });
  try {
    const invoke = async (method: string, url: string, body?: unknown) => {
      const request = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as IncomingMessage;
      Object.assign(request, {
        method,
        url,
        headers: {
          host: "local.test",
          ...(method === "POST" ? {
            origin: "http://local.test",
            "content-type": "application/json",
          } : {}),
        },
      });
      return new Promise<{ status: number; body: unknown }>((resolve) => {
        let status = 0;
        let text = "";
        const response = {
          writeHead(value: number) { status = value; return response; },
          end(value?: string | Buffer) {
            if (value) text += value.toString();
            resolve({ status, body: text ? JSON.parse(text) : undefined });
          },
        } as unknown as ServerResponse;
        server.emit("request", request, response);
      });
    };
    const posted = await invoke("POST", `/api/readings/${ID}/translate`, { lang: "en" });
    assert.equal(posted.status, 202);
    assert.equal((await invoke("GET", `/api/readings/${ID}?lang=en`)).status, 200);
    assert.deepEqual(calls, ['post:{"lang":"en"}', "get:en"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("翻译终态与额度错误映射为稳定 HTTP 状态和 code", () => {
  assert.equal(statusForError(new NotReadyError()), 409);
  assert.equal(errorCodeForError(new NotReadyError()), "not-ready");
  assert.equal(statusForError(new TranslationBudgetError()), 429);
  assert.equal(errorCodeForError(new TranslationBudgetError()), "translation-budget");
});
