import assert from "node:assert/strict";
import test from "node:test";

import { probeReadonlyTarget } from "../src/readonly-probe.js";
import { classifyPythFreshness } from "../src/pyth.js";

test("官方没有地址时返回 NOT_FOUND 且不访问 RPC", async () => {
  let touched = false;
  const client = {
    async getBytecode() {
      touched = true;
      return "0x" as const;
    },
    async readContract() {
      touched = true;
      return undefined;
    },
  };

  const result = await probeReadonlyTarget(client, {
    id: "chainlink",
    title: "Chainlink Data Feed",
    address: null,
    sourceKind: "官方文档",
    sourceUrl: "https://docs.chain.link/data-feeds/price-feeds/addresses",
    note: "官方地址页未找到 Arc 条目",
    infoCalls: [],
  });

  assert.equal(result.status, "NOT_FOUND");
  assert.equal(touched, false);
  assert.match(result.reason ?? "", /未找到/);
});

test("有代码时保留成功元数据和失败原因", async () => {
  const client = {
    async getBytecode() {
      return "0x60016000" as const;
    },
    async readContract(args: { functionName: string }) {
      if (args.functionName === "name") return "USD Coin";
      throw new Error("execution reverted");
    },
  };

  const result = await probeReadonlyTarget(client, {
    id: "usdc",
    title: "USDC ERC-20 接口",
    address: "0x3600000000000000000000000000000000000000",
    sourceKind: "用户已确认",
    sourceUrl: "https://docs.arc.io/arc/references/contract-addresses",
    infoCalls: [
      { key: "name", functionName: "name", outputType: "string" },
      { key: "version", functionName: "version", outputType: "string" },
    ],
  });

  assert.equal(result.status, "PASS");
  assert.equal(result.details?.codeBytes, 4);
  assert.deepEqual(result.details?.metadata, { name: "USD Coin" });
  assert.match(String((result.details?.readErrors as Record<string, string>).version), /reverted/);
});

test("无代码地址返回 FAIL", async () => {
  const client = {
    async getBytecode() {
      return "0x" as const;
    },
    async readContract() {
      return undefined;
    },
  };

  const result = await probeReadonlyTarget(client, {
    id: "missing",
    title: "空地址",
    address: "0x1111111111111111111111111111111111111111",
    sourceKind: "非官方候选",
    sourceUrl: "https://example.invalid",
    infoCalls: [],
  });

  assert.equal(result.status, "FAIL");
  assert.match(result.observed, /未部署代码/);
});

test("Pyth 价格超过有效期时不能算实时可用", () => {
  assert.deepEqual(classifyPythFreshness(1_000n, 950n, 60n), { fresh: true, ageSeconds: 50n });
  assert.deepEqual(classifyPythFreshness(1_000n, 900n, 60n), { fresh: false, ageSeconds: 100n });
  assert.deepEqual(classifyPythFreshness(1_000n, 1_001n, 60n), { fresh: false, ageSeconds: 0n });
});
