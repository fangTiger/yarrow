import assert from "node:assert/strict";
import test from "node:test";

import { encodeAbiParameters, keccak256, stringToHex, type Address, type Hex } from "viem";

import { DeterministicMockProvider, type StructuredOutputRequest } from "../src/agent/provider.js";
import {
  PropositionCompiler,
  ZERO_ADDRESS,
  type PredicateDefinition,
  type PredicateRegistryConfig,
  type PredicateRegistryReader,
} from "../src/agent/proposition-compiler.js";

const allowedId = keccak256(stringToHex("USDC_TOTAL_SUPPLY_ABOVE"));
const controllableId = keccak256(stringToHex("QUERENT_ACTION"));
const disabledId = keccak256(stringToHex("DISABLED"));
const schemaHash = keccak256(stringToHex("abi.encode(uint256 threshold)"));
const resolver = "0x1111111111111111111111111111111111111111" as Address;

function definition(
  predicateId: Hex,
  name: string,
  calibratedParams = encodeAbiParameters([{ type: "uint256" }], [314_000_000_000_000n]),
  suitable = true,
): PredicateDefinition {
  return {
    predicateId,
    name,
    description: `${name} 的说明`,
    paramsEncoding: "abi.encode(uint256 thresholdUsdc6)",
    schemaHash,
    validateParams: (params) => { encodeAbiParameters([{ type: "bytes" }], [params]); },
    renderStatement: (params) => {
      const value = BigInt(params);
      return `${name} 高于 ${value}`;
    },
    calibrateParams: async ({ cutoffBlock, deadlineBlock }) => suitable ? {
      suitable: true,
      params: calibratedParams,
      method: "historical-threshold-quantile-v1",
      sampleCount: 64,
      yesCount: 32,
      empiricalBaseRateBps: 5_000,
      historyStartBlock: cutoffBlock - 512n,
      historyEndBlock: cutoffBlock - 1n,
      horizonBlocks: deadlineBlock - cutoffBlock + 1n,
    } : {
      suitable: false,
      reason: `${name} 的历史变化过于单调，任何阈值都无法达到 35%–65%`,
      sampleCount: 64,
      closestBaseRateBps: 500,
    },
  };
}

class RegistryStub implements PredicateRegistryReader {
  readonly reads: Hex[] = [];

  constructor(private readonly configs: Readonly<Record<Hex, PredicateRegistryConfig>>) {}

  async getPredicate(predicateId: Hex): Promise<PredicateRegistryConfig> {
    this.reads.push(predicateId);
    return this.configs[predicateId] ?? {
      resolver: ZERO_ADDRESS,
      schemaHash: `0x${"00".repeat(32)}`,
      querentControllable: false,
      tier: 2,
      enabled: false,
    };
  }
}

const allowedConfig: PredicateRegistryConfig = {
  resolver,
  schemaHash,
  querentControllable: false,
  tier: 0,
  enabled: true,
};

const deadlinePolicy = {
  plannedSequentialWrites: 3,
  blocksPerWriteBudget: 12,
  llmInferenceMilliseconds: 30_000,
  blockTimeMilliseconds: 510,
  safetyBlocks: 24,
} as const;

test("编译器逐项读取链上白名单，只向 provider 暴露可押注且 schema 一致的谓词", async () => {
  const registry = new RegistryStub({
    [allowedId]: allowedConfig,
    [controllableId]: { ...allowedConfig, querentControllable: true },
    [disabledId]: { ...allowedConfig, enabled: false },
  });
  let observedPrompt = "";
  let auditedPrompt = "";
  let auditedOutput: unknown;
  const params = encodeAbiParameters([{ type: "uint256" }], [314_000_000_000_000n]);
  const provider = new DeterministicMockProvider("mock-compiler-v1", {
    "proposition-compiler": (request: StructuredOutputRequest) => {
      observedPrompt = request.userPrompt;
      return { predicateId: allowedId, params, reasoning: "问题指向链上总量，采用唯一可押注谓词。" };
    },
  });
  const compiler = new PropositionCompiler({
    provider,
    registry,
    definitions: [definition(allowedId, "USDC 总量", params), definition(controllableId, "提问者动作"), definition(disabledId, "已禁用")],
    currentBlock: async () => 1_000n,
    deadlinePolicy,
  });

  const compiled = await compiler.compile("Arc 的 USDC 总量会增长吗？", async (audit) => {
    auditedPrompt = audit.request.userPrompt;
    auditedOutput = audit.output;
  });

  assert.deepEqual(registry.reads, [allowedId, controllableId, disabledId]);
  assert.match(observedPrompt, new RegExp(allowedId));
  assert.doesNotMatch(observedPrompt, new RegExp(controllableId));
  assert.doesNotMatch(observedPrompt, new RegExp(disabledId));
  assert.equal(compiled.predicateId, allowedId);
  assert.equal(compiled.params, params);
  assert.equal(compiled.deadlineBlock, 1_119n);
  assert.match(compiled.statement, /314000000000000/);
  assert.equal(compiled.calibration.empiricalBaseRateBps, 5_000);
  assert.match(observedPrompt, /historical-threshold-quantile-v1/);
  assert.match(observedPrompt, /"empiricalBaseRateBps": 5000/);
  assert.equal(auditedPrompt, observedPrompt);
  assert.deepEqual(auditedOutput, { predicateId: allowedId, params, reasoning: "问题指向链上总量，采用唯一可押注谓词。" });
});

test("provider 越权回传提问者可控谓词时必须拒绝且不再次读取截止块", async () => {
  const registry = new RegistryStub({
    [allowedId]: allowedConfig,
    [controllableId]: { ...allowedConfig, querentControllable: true },
  });
  let blockReads = 0;
  const provider = new DeterministicMockProvider("mock-compiler-v1", {
    "proposition-compiler": {
      predicateId: controllableId,
      params: encodeAbiParameters([{ type: "uint256" }], [1n]),
      reasoning: "恶意越权输出",
    },
  });
  const compiler = new PropositionCompiler({
    provider,
    registry,
    definitions: [definition(allowedId, "USDC 总量"), definition(controllableId, "提问者动作")],
    currentBlock: async () => {
      blockReads += 1;
      return 1_000n;
    },
    deadlinePolicy,
  });

  await assert.rejects(compiler.compile("测试", async () => {}), /不在已核验的可押注白名单/);
  assert.equal(blockReads, 1);
});

test("历史基础概率无法达到 35%–65% 的谓词不向 provider 暴露", async () => {
  let observedPrompt = "";
  const calibratedParams = encodeAbiParameters([{ type: "uint256" }], [123n]);
  const provider = new DeterministicMockProvider("mock-compiler-v1", {
    "proposition-compiler": (request: StructuredOutputRequest) => {
      observedPrompt = request.userPrompt;
      return { predicateId: allowedId, params: calibratedParams, reasoning: "只选择可测量谓词" };
    },
  });
  const compiler = new PropositionCompiler({
    provider,
    registry: new RegistryStub({ [allowedId]: allowedConfig, [disabledId]: allowedConfig }),
    definitions: [definition(allowedId, "可测量", calibratedParams), definition(disabledId, "单调谓词", undefined, false)],
    currentBlock: async () => 1_000n,
    deadlinePolicy,
  });

  await compiler.compile("测试", async () => {});

  assert.match(observedPrompt, /可测量/);
  assert.doesNotMatch(observedPrompt, /单调谓词/);
});

test("provider 改写已校准参数时拒绝首个合法输出且不重新生成", async () => {
  const calibratedParams = encodeAbiParameters([{ type: "uint256" }], [123n]);
  const provider = new DeterministicMockProvider("mock-compiler-v1", {
    "proposition-compiler": {
      predicateId: allowedId,
      params: encodeAbiParameters([{ type: "uint256" }], [456n]),
      reasoning: "试图改写难度",
    },
  });
  const compiler = new PropositionCompiler({
    provider,
    registry: new RegistryStub({ [allowedId]: allowedConfig }),
    definitions: [definition(allowedId, "可测量", calibratedParams)],
    currentBlock: async () => 1_000n,
    deadlinePolicy,
  });

  await assert.rejects(compiler.compile("测试", async () => {}), /改写已冻结的难度校准参数/);
  assert.equal(provider.callCount("proposition-compiler"), 1);
});

test("所有链上合格谓词均不适合测量时逐项报告原因且不调用 provider", async () => {
  const provider = new DeterministicMockProvider("mock-compiler-v1", {});
  const compiler = new PropositionCompiler({
    provider,
    registry: new RegistryStub({ [allowedId]: allowedConfig, [disabledId]: allowedConfig }),
    definitions: [definition(allowedId, "单调一", undefined, false), definition(disabledId, "单调二", undefined, false)],
    currentBlock: async () => 1_000n,
    deadlinePolicy,
  });

  await assert.rejects(compiler.compile("测试", async () => {}), /单调一.*单调二/);
  assert.equal(provider.callCount("proposition-compiler"), 0);
});

test("没有合格链上谓词时在调用 provider 前失败", async () => {
  const registry = new RegistryStub({
    [allowedId]: { ...allowedConfig, tier: 2 },
    [disabledId]: { ...allowedConfig, resolver: ZERO_ADDRESS },
  });
  const provider = new DeterministicMockProvider("mock-compiler-v1", {
    "proposition-compiler": { predicateId: allowedId, params: "0x", reasoning: "不应调用" },
  });
  const compiler = new PropositionCompiler({
    provider,
    registry,
    definitions: [definition(allowedId, "地层"), definition(disabledId, "零 resolver")],
    currentBlock: async () => 1_000n,
    deadlinePolicy,
  });

  await assert.rejects(compiler.compile("测试", async () => {}), /没有可进入押注层的谓词/);
  assert.equal(provider.callCount("proposition-compiler"), 0);
});

test("链上 schemaHash 与本地参数编码器不一致时拒绝候选", async () => {
  const registry = new RegistryStub({
    [allowedId]: { ...allowedConfig, schemaHash: keccak256(stringToHex("另一个 schema")) },
  });
  const provider = new DeterministicMockProvider("mock-compiler-v1", {});
  const compiler = new PropositionCompiler({
    provider,
    registry,
    definitions: [definition(allowedId, "USDC 总量")],
    currentBlock: async () => 1_000n,
    deadlinePolicy,
  });

  await assert.rejects(compiler.compile("测试", async () => {}), /没有可进入押注层的谓词/);
});
