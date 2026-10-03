// tests/frontend-api.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApiClient } from "../web/lib/api.js";
test("非 2xx 保留中文错误、状态与冲突 readingId", async () => {
  const fakeFetch: typeof fetch = async () => new Response(
    JSON.stringify({ error: "付款凭证已用于这一卦", readingId: "reading-1" }),
    { status: 409, headers: { "content-type": "application/json" } },
  );
  const api = createApiClient(fakeFetch);
  await assert.rejects(api.createReading({} as never), (error: unknown) => {
    return error instanceof ApiError
      && error.status === 409
      && error.message === "付款凭证已用于这一卦"
      && error.readingId === "reading-1";
  });
});
test("非 JSON 错误仍给中文消息", async () => {
  const api = createApiClient(async () => new Response("bad", { status: 503 }));
  await assert.rejects(api.getNow(), (error: unknown) => {
    return error instanceof ApiError && error.status === 503 && error.message === "请求未能完成";
  });
});
