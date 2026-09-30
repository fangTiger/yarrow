import assert from "node:assert/strict";
import test from "node:test";

import { privateKeyToAccount } from "viem/accounts";

import {
  DIVINER_PROFILES,
  VALIDATION_REGISTRY_ADDRESS,
  YIJING_PARAMETERS,
  budgetUseUsdc6,
  buildAgentRegistration,
  deriveRolePrivateKey,
  deploymentDisposition,
  extractAgentIdFromTransfer,
  matchExistingAgentIdentities,
  plannedDeadline,
  totalVaultFunding,
} from "../src/yijing-deployment.js";

const baseKey = `0x${"11".repeat(32)}` as const;

test("部署参数保持在历史窗口和总预算内", () => {
  assert.equal(YIJING_PARAMETERS.waitBlocks, 8n);
  assert.ok(YIJING_PARAMETERS.waitBlocks + YIJING_PARAMETERS.revealWindow < 8_191n);
  assert.equal(YIJING_PARAMETERS.fee, 50_000n);
  assert.equal(YIJING_PARAMETERS.bond, 500_000n);
  assert.equal(YIJING_PARAMETERS.mMin, 1);
  assert.equal(YIJING_PARAMETERS.mMax, 3);
  assert.equal(totalVaultFunding(), 600_000n);

  const maximumQuerentStake =
    BigInt(DIVINER_PROFILES.length) * BigInt(YIJING_PARAMETERS.mMax) * YIJING_PARAMETERS.fee;
  assert.ok(YIJING_PARAMETERS.bond >= maximumQuerentStake, "保证金必须覆盖三位易者的最大合计押注");
  assert.equal(VALIDATION_REGISTRY_ADDRESS, "0x8004Cb1BF31DAf7788923b405b754f57acEB4272");
});

test("角色私钥确定性派生且不同角色得到不同地址", () => {
  const first = deriveRolePrivateKey(baseKey, "querent");
  const repeated = deriveRolePrivateKey(baseKey, "querent");
  const thirdParty = deriveRolePrivateKey(baseKey, "third-party");

  assert.equal(first, repeated);
  assert.notEqual(first, thirdParty);
  assert.notEqual(privateKeyToAccount(first).address, privateKeyToAccount(thirdParty).address);
});

test("已有部署只能复用，缺失部署才允许创建", () => {
  assert.equal(deploymentDisposition(undefined), "deploy");
  assert.equal(
    deploymentDisposition({
      address: "0x1111111111111111111111111111111111111111",
      blockNumber: "1",
      transactionHash: `0x${"ab".repeat(32)}`,
      constructorArgs: [],
    }),
    "reuse",
  );
});

test("ERC-8004 registration-v1 文件包含完整链上反向引用", () => {
  const registration = buildAgentRegistration({
    name: "高島易断",
    description: "重时势与实务决断的链上易者。",
    agentId: 42n,
    chainId: 5_042_002,
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  });

  assert.equal(registration.type, "https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
  assert.equal(registration.name, "高島易断");
  assert.equal(registration.x402Support, false);
  assert.equal(registration.active, true);
  assert.deepEqual(registration.services, []);
  assert.deepEqual(registration.registrations, [
    {
      agentId: 42,
      agentRegistry: "eip155:5042002:0x8004A818BFB912233c491871b3d84c89A494BD9e",
    },
  ]);
  assert.deepEqual(registration.supportedTrust, ["reputation", "crypto-economic"]);
});

test("agentId 只从 IdentityRegistry 的铸造 Transfer 事件提取", () => {
  const identity = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
  const owner = "0x1111111111111111111111111111111111111111" as const;
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const;
  const zeroTopic = `0x${"00".repeat(32)}` as const;
  const ownerTopic = `0x${"00".repeat(12)}${owner.slice(2)}` as const;
  const tokenTopic = `0x${42n.toString(16).padStart(64, "0")}` as const;

  assert.equal(
    extractAgentIdFromTransfer(
      [{ address: identity, topics: [transferTopic, zeroTopic, ownerTopic, tokenTopic] }],
      identity,
      owner,
    ),
    42n,
  );
  assert.throws(
    () => extractAgentIdFromTransfer([], identity, owner),
    /Transfer 铸造事件/,
  );
});

test("新合约栈只能复用地址完全匹配的既有 ERC-8004 身份", () => {
  const profiles = [
    { name: "高島易断", address: "0x1111111111111111111111111111111111111111" },
    { name: "五行易（断易）", address: "0x2222222222222222222222222222222222222222" },
  ] as const;
  const identities = [
    { name: "五行易（断易）", address: profiles[1].address, agentId: "891441", transactionHash: `0x${"ab".repeat(32)}`, metadataUri: "data:application/json;base64,e30=" },
    { name: "高島易断", address: profiles[0].address, agentId: "891440", transactionHash: `0x${"cd".repeat(32)}`, metadataUri: "data:application/json;base64,e30=" },
  ] as const;

  assert.deepEqual(matchExistingAgentIdentities(profiles, identities).map((entry) => entry.agentIdValue), [891440n, 891441n]);
  assert.throws(
    () => matchExistingAgentIdentities(profiles, [{ ...identities[0], address: profiles[0].address }]),
    /缺少与地址一致/,
  );
});

test("链上截止块为计划中的顺序交易保留打包预算", () => {
  assert.equal(
    plannedDeadline({
      currentBlock: 1_000n,
      plannedSequentialWrites: 3,
      blocksPerWriteBudget: 12,
      llmInferenceMilliseconds: 30_000,
      blockTimeMilliseconds: 510,
      safetyBlocks: 24,
    }),
    1_119n,
  );
  assert.equal(
    plannedDeadline({
      currentBlock: 1_000n,
      plannedSequentialWrites: 6,
      blocksPerWriteBudget: 12,
      llmInferenceMilliseconds: 10_000,
      blockTimeMilliseconds: 510,
      safetyBlocks: 24,
    }),
    1_116n,
  );
  assert.throws(
    () => plannedDeadline({
      currentBlock: 1_000n,
      plannedSequentialWrites: 0,
      blocksPerWriteBudget: 12,
      llmInferenceMilliseconds: 10_000,
      blockTimeMilliseconds: 510,
      safetyBlocks: 24,
    }),
    /交易数/,
  );
  assert.throws(
    () => plannedDeadline({
      currentBlock: 1_000n,
      plannedSequentialWrites: 3,
      blocksPerWriteBudget: 12,
      llmInferenceMilliseconds: -1,
      blockTimeMilliseconds: 510,
      safetyBlocks: 24,
    }),
    /推理延迟/,
  );
  assert.equal(
    plannedDeadline({
      currentBlock: 1_000n,
      plannedSequentialWrites: Number.MAX_SAFE_INTEGER,
      blocksPerWriteBudget: 2,
      llmInferenceMilliseconds: 10_000,
      blockTimeMilliseconds: 510,
      safetyBlocks: 24,
    }),
    1_000n + BigInt(Number.MAX_SAFE_INTEGER) * 2n + 20n + 24n,
  );
});

test("预算占用不重复计算已经包含在金库注资内的易者预留", () => {
  const gasWei = 452_570_000_000_000_000n;
  assert.equal(budgetUseUsdc6(2_250_000n, 550_000n, 550_000n, gasWei), 3_802_570n);
});

test("Agent 新栈按最坏未决锁定和保守 gas 仍低于三 USDC", () => {
  const conservativeGasWei = 700_000_000_000_000_000n;
  const projected = budgetUseUsdc6(totalVaultFunding(), 0n, 1_000_000n, conservativeGasWei);
  assert.equal(projected, 2_300_000n);
  assert.ok(projected < 3_000_000n);
});
