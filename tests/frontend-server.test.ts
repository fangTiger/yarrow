// tests/frontend-server.test.ts
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { SanyiApi } from "../src/sanyi/api.js";
import { PaymentAlreadyUsedError } from "../src/sanyi/reading-service.js";
import { ArcUnavailableError } from "../src/sanyi/throws.js";
import { createFrontendServer } from "../src/frontend/server.js";
function fakeApi(overrides: Partial<SanyiApi> = {}): SanyiApi {
  const reading = { id: "abcdefghijklmnopqrstuvwxyz", status: "awaiting-throws" };
  return {
    payment: async () => ({ recipient: `0x${"11".repeat(20)}`, amountUsdc6: "50000",
      token: "0x3600000000000000000000000000000000000000", chainId: 5042002 }),
    now: async () => ({ solar: { text: "2026-09-30 20:15:00" } }) as never,
    classify: async () => ({ kind: "question" }) as never,
    createReading: async () => reading as never,
    continueCasting: async () => reading as never,
    getReading: async () => reading as never,
    retrySchool: async () => reading as never,
    changeSubject: async () => reading as never,
    changeDayBoundary: async () => reading as never,
    ...overrides,
  };
}
async function fixture(api: SanyiApi = fakeApi()) {
  const root = await mkdtemp(join(tmpdir(), "sanyi-http-"));
  const publicDir = join(root, "web");
  await mkdir(publicDir);
  await writeFile(join(publicDir, "index.html"), "三易", "utf8");
  await writeFile(join(publicDir, "font.woff2"), "font", "utf8");
  const server = createFrontendServer({ publicDir, api });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  return { root, server, base };
}
async function close(item: { root: string; server: Server }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    item.server.close((error) => error ? reject(error) : resolve());
  });
  await rm(item.root, { recursive: true, force: true });
}
function post(base: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
test("七条新路由返回成功状态", async () => {
  const item = await fixture();
  try {
    const id = "abcdefghijklmnopqrstuvwxyz";
    const routes: Array<[string, string, unknown?]> = [
      ["GET", "/api/now"],
      ["POST", "/api/classify", { question: "这件事会怎样" }],
      ["POST", "/api/readings", { question: "这件事会怎样" }],
      ["POST", `/api/readings/${id}/cast`, {}],
      ["GET", `/api/readings/${id}`],
      ["POST", `/api/readings/${id}/schools/chengyi/retry`, {}],
      ["POST", `/api/readings/${id}/subject`, { subjectKey: "career" }],
    ];
    for (const [method, path, body] of routes) {
      const response = method === "GET"
        ? await fetch(`${item.base}${path}`)
        : await post(item.base, path, body);
      assert.equal(response.status, 200, `${method} ${path}`);
    }
  } finally {
    await close(item);
  }
});
test("写接口拒绝缺失或错误 Origin", async () => {
  const item = await fixture();
  try {
    const missing = await fetch(`${item.base}/api/classify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const wrong = await post(item.base, "/api/classify", {}, { origin: "https://evil.example" });
    assert.equal(missing.status, 403);
    assert.equal(wrong.status, 403);
  } finally {
    await close(item);
  }
});
test("写接口拒绝非 JSON 与超过 8 KiB 的请求体", async () => {
  const item = await fixture();
  try {
    const wrongType = await fetch(`${item.base}/api/classify`, {
      method: "POST",
      headers: { origin: item.base },
      body: "{}",
    });
    const tooLarge = await post(item.base, "/api/classify", "x".repeat(9 * 1_024));
    assert.equal(wrongType.status, 415);
    assert.equal(tooLarge.status, 413);
  } finally {
    await close(item);
  }
});
test("非法 id、非法三家键和四类旧接口均为 404", async () => {
  const item = await fixture();
  try {
    const paths = [
      "/api/readings/bad",
      "/api/readings/abcdefghijklmnopqrstuvwxyz/schools/bad/retry",
      "/api/oracle",
      "/api/demo",
      "/api/demo/round/prepare",
      "/api/question/classify",
    ];
    for (const path of paths) {
      assert.equal((await fetch(`${item.base}${path}`)).status, 404, path);
    }
  } finally {
    await close(item);
  }
});
test("已知领域错误按错误类映射", async () => {
  const id = "abcdefghijklmnopqrstuvwxyz";
  const conflict = await fixture(fakeApi({
    createReading: async () => { throw new PaymentAlreadyUsedError(id); },
  }));
  try {
    const response = await post(conflict.base, "/api/readings", {});
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: `付款凭证已用于 reading：${id}`,
      readingId: id,
    });
  } finally {
    await close(conflict);
  }
  const unavailable = await fixture(fakeApi({
    continueCasting: async () => { throw new ArcUnavailableError(); },
  }));
  try {
    const response = await post(unavailable.base, `/api/readings/${id}/cast`, {});
    assert.equal(response.status, 503);
    // 单掷接口已下线
    assert.equal((await post(unavailable.base, `/api/readings/${id}/throws`, { index: 1 })).status, 404);
  } finally {
    await close(unavailable);
  }
});
test("未知错误为 500 且不泄露堆栈", async () => {
  const item = await fixture(fakeApi({
    now: async () => { throw new Error("boom"); },
  }));
  try {
    const response = await fetch(`${item.base}/api/now`);
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /at /);
  } finally {
    await close(item);
  }
});
test("woff2 使用正确类型且原始路径穿越返回 403", async () => {
  const item = await fixture();
  try {
    const font = await fetch(`${item.base}/font.woff2`);
    assert.equal(font.headers.get("content-type"), "font/woff2");
    const address = item.server.address();
    assert.ok(address && typeof address === "object");
    const status = await new Promise<number>((resolve, reject) => {
      const call = request({
        host: "127.0.0.1",
        port: address.port,
        path: "/%2e%2e/package.json",
      }, (response) => resolve(response.statusCode ?? 0));
      call.on("error", reject);
      call.end();
    });
    assert.equal(status, 403);
  } finally {
    await close(item);
  }
});

test("付款配置 GET 无需同源校验", async () => {
  const item = await fixture();
  try {
    const response = await fetch(`${item.base}/api/payment`, {
      headers: { origin: "https://other.example" },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { amountUsdc6: string }).amountUsdc6, "50000");
  } finally {
    await close(item);
  }
});

test("换日与八字重试路由沿用 Origin、JSON、8 KiB 和 id 边界", async () => {
  const item = await fixture();
  try {
    const id = "abcdefghijklmnopqrstuvwxyz";
    for (const path of [`/api/readings/${id}/day-boundary`, `/api/readings/${id}/schools/yuchuntai/retry`]) {
      assert.equal((await post(item.base, path, {})).status, 200);
      assert.equal((await fetch(`${item.base}${path}`, { method: "POST",
        headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
      assert.equal((await post(item.base, path, {}, { origin: "https://evil.example" })).status, 403);
      assert.equal((await post(item.base, path, {}, { "content-type": "text/plain" })).status, 415);
      assert.equal((await post(item.base, path, "{")).status, 400);
      assert.equal((await post(item.base, path, "x".repeat(9 * 1_024))).status, 413);
      assert.equal((await post(item.base, path.replace(id, "bad"), {})).status, 404);
    }
  } finally {
    await close(item);
  }
});
test("换日与八字重试中文错误沿用 400 与 409 映射", async () => {
  const { SanyiInputError } = await import("../src/sanyi/http-errors.js");
  const { LimitExceededError } = await import("../src/sanyi/reading-service.js");
  const item = await fixture(fakeApi({
    changeDayBoundary: async () => {
      throw new SanyiInputError("生辰与本卦命盘不符");
    },
    retrySchool: async () => {
      throw new LimitExceededError("此家重试次数已用尽");
    },
  }));
  try {
    const base = "/api/readings/abcdefghijklmnopqrstuvwxyz";
    const wrong = await post(item.base, `${base}/day-boundary`, {});
    assert.equal(wrong.status, 400);
    assert.deepEqual(await wrong.json(), { error: "生辰与本卦命盘不符" });
    const limit = await post(item.base, `${base}/schools/yuchuntai/retry`, {});
    assert.equal(limit.status, 409);
    assert.deepEqual(await limit.json(), { error: "此家重试次数已用尽" });
  } finally {
    await close(item);
  }
});
