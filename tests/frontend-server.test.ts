import assert from "node:assert/strict";
import type { Server } from "node:http";
import test from "node:test";

interface FrontendServerModule {
  resolveStaticPath(publicDir: string, pathname: string): string | null;
  createLazyDemoActions(factory: () => Promise<{
    getSession(): unknown;
    prepareRound(input: unknown): Promise<unknown>;
    confirmRound(input: unknown): Promise<unknown>;
    triggerPredictions(): Promise<unknown>;
    settleRound(input?: unknown): Promise<unknown>;
    abandonRound(): Promise<unknown>;
  }>): {
    getSession(): unknown;
    prepareRound(input: unknown): Promise<unknown>;
  };
  createFrontendServer(options: {
    rootDir: string;
    publicDir: string;
    getSnapshot: () => Promise<unknown>;
    demoActions?: {
      getSession(): unknown;
      prepareRound(input: unknown): Promise<unknown>;
      confirmRound(input: unknown): Promise<unknown>;
      triggerPredictions(): Promise<unknown>;
      settleRound(): Promise<unknown>;
      abandonRound(): Promise<unknown>;
    };
    questionActions?: {
      classify(input: unknown): Promise<unknown>;
      cast(input: unknown): Promise<unknown>;
    };
  }): Server;
}

test("問轨启动与读取状态不会实例化需要签名能力的賭轨驱动", async () => {
  const { createLazyDemoActions } = await loadServerModule();
  let factoryCalls = 0;
  const lazy = createLazyDemoActions(async () => {
    factoryCalls += 1;
    return {
      getSession: () => ({ phase: "ready" }),
      prepareRound: async (input: unknown) => input,
      confirmRound: async () => ({}),
      triggerPredictions: async () => ({}),
      settleRound: async () => ({}),
      abandonRound: async () => ({}),
    };
  });

  assert.equal(lazy.getSession(), null);
  assert.equal(factoryCalls, 0, "問轨可用时不得提前初始化賭轨钱包驱动");
  assert.deepEqual(await lazy.prepareRound({ question: "今天会收到消息吗" }), { question: "今天会收到消息吗" });
  assert.equal(factoryCalls, 1);
  assert.deepEqual(lazy.getSession(), { phase: "ready" });
});

async function loadServerModule(): Promise<FrontendServerModule> {
  try {
    return (await import("../src/frontend/server.js")) as FrontendServerModule;
  } catch {
    assert.fail("前端服务模块尚未实现");
  }
}

test("静态路径限制在 web 目录内并拒绝目录穿越", async () => {
  const { resolveStaticPath } = await loadServerModule();
  const publicDir = "/workspace/web";

  assert.equal(resolveStaticPath(publicDir, "/"), "/workspace/web/index.html");
  assert.equal(resolveStaticPath(publicDir, "/styles.css"), "/workspace/web/styles.css");
  assert.equal(resolveStaticPath(publicDir, "/../deployments/arc-testnet.json"), null);
  assert.equal(resolveStaticPath(publicDir, "/%2e%2e/package.json"), null);
});

test("只读 API 返回 JSON 且不需要钱包或私钥", async (context) => {
  const { createFrontendServer } = await loadServerModule();
  const server = createFrontendServer({
    rootDir: process.cwd(),
    publicDir: `${process.cwd()}/web`,
    getSnapshot: async () => ({ chain: { chainId: 5_042_002, status: "LIVE" } }),
  });
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/oracle`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await response.json(), { chain: { chainId: 5_042_002, status: "LIVE" } });
});

test("链上尚无可展示历史时返回诚实空态而不是服务故障", async (context) => {
  const { createFrontendServer } = await loadServerModule();
  const server = createFrontendServer({
    rootDir: process.cwd(),
    publicDir: `${process.cwd()}/web`,
    getSnapshot: async () => { throw new Error("链上尚无已揭示且可展示的起卦轮次"); },
  });
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/oracle`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    empty: true,
    message: "链上尚无已揭示且可展示的起卦轮次",
  });
});

test("演示写接口只接受同源 JSON，并映射到用户交易准备与核验协议", async (context) => {
  const { createFrontendServer } = await loadServerModule();
  const calls: string[] = [];
  const demoActions = {
    getSession: () => ({ phase: "idle", mode: "mock" }),
    prepareRound: async (input: unknown) => { calls.push(`prepare:${JSON.stringify(input)}`); return { session: { phase: "committing" }, preparation: { roundId: "9" } }; },
    confirmRound: async (input: unknown) => { calls.push(`confirm:${JSON.stringify(input)}`); return { phase: "revealed" }; },
    triggerPredictions: async () => { calls.push("predictions"); return { phase: "predicted" }; },
    settleRound: async () => { calls.push("settlement"); return { phase: "settled" }; },
    abandonRound: async () => { calls.push("abandon"); return { session: null, recovery: { message: "已释放" } }; },
  };
  const server = createFrontendServer({
    rootDir: process.cwd(),
    publicDir: `${process.cwd()}/web`,
    getSnapshot: async () => ({}),
    demoActions,
  });
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  const status = await fetch(`${base}/api/demo`);
  assert.deepEqual(await status.json(), { phase: "idle", mode: "mock" });

  const wrongType = await fetch(`${base}/api/demo/round/prepare`, { method: "POST", headers: { origin: base }, body: "{}" });
  assert.equal(wrongType.status, 415);

  const crossOrigin = await fetch(`${base}/api/demo/round/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ question: "不应执行" }),
  });
  assert.equal(crossOrigin.status, 403);

  const missingOrigin = await fetch(`${base}/api/demo/round/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "不应执行" }),
  });
  assert.equal(missingOrigin.status, 403);

  const prepared = await fetch(`${base}/api/demo/round/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ question: "现场问题" }),
  });
  assert.equal(prepared.status, 200);
  assert.deepEqual(await prepared.json(), { session: { phase: "committing" }, preparation: { roundId: "9" } });

  const confirmed = await fetch(`${base}/api/demo/round/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ commitHash: "0xcommit" }),
  });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(await confirmed.json(), { phase: "revealed" });

  const predictions = await fetch(`${base}/api/demo/predictions`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: "{}",
  });
  const settlement = await fetch(`${base}/api/demo/settlement`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: "{}",
  });
  const abandon = await fetch(`${base}/api/demo/abandon`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: "{}",
  });
  assert.equal(predictions.status, 200);
  assert.equal(settlement.status, 200);
  assert.equal(abandon.status, 200);
  assert.deepEqual(calls, [
    "prepare:{\"question\":\"现场问题\"}",
    "confirm:{\"commitHash\":\"0xcommit\"}",
    "predictions",
    "settlement",
    "abandon",
  ]);
});

test("不可判定问题仍不触发押注驱动，但起卦请求必须携带钱包付款凭证", async (context) => {
  const { createFrontendServer } = await loadServerModule();
  let demoCalls = 0;
  const demoActions = {
    getSession: () => null,
    prepareRound: async () => { demoCalls += 1; throw new Error("不应触发"); },
    confirmRound: async () => { demoCalls += 1; throw new Error("不应触发"); },
    triggerPredictions: async () => { demoCalls += 1; throw new Error("不应触发"); },
    settleRound: async () => { demoCalls += 1; throw new Error("不应触发"); },
    abandonRound: async () => { demoCalls += 1; throw new Error("不应触发"); },
  };
  const questionActions = {
    classify: async (input: unknown) => ({ input, track: "question", reason: "没有唯一答案" }),
    cast: async (input: unknown) => {
      const body = input as { payment?: { payer?: string; transactionHashes?: unknown[] } };
      if (!body.payment?.payer || !body.payment.transactionHashes?.length) throw new Error("缺少三座金库付款凭证");
      return { input, track: "question", cost: { walletRequired: true, feeUsdc6: "50000", walletConfirmationCount: 1, transactionCount: 1, gasUsdc6: "0", recipients: 3 } };
    },
  };
  const server = createFrontendServer({
    rootDir: process.cwd(),
    publicDir: `${process.cwd()}/web`,
    getSnapshot: async () => ({}),
    demoActions,
    questionActions,
  });
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { "content-type": "application/json", origin: base };

  const classified = await fetch(`${base}/api/question/classify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question: "我该不该辞职" }),
  });
  assert.equal(classified.status, 200);
  assert.equal((await classified.json() as { track: string }).track, "question");

  const cast = await fetch(`${base}/api/question/cast`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      question: "我该不该辞职",
      confirmedTrack: "question",
      payment: { payer: "0x0000000000000000000000000000000000000011", bundleId: "bundle-1", transactionHashes: [`0x${"ab".repeat(32)}`] },
    }),
  });
  assert.equal(cast.status, 200);
  assert.deepEqual((await cast.json() as { cost: unknown }).cost, {
    walletRequired: true,
    feeUsdc6: "50000",
    walletConfirmationCount: 1,
    transactionCount: 1,
    gasUsdc6: "0",
    recipients: 3,
  });
  assert.equal(demoCalls, 0);
});
