import assert from "node:assert/strict";
import test from "node:test";

import {
  SEAL_DEMO_PARAMETERS,
  matchesExpectedCustomError,
  normalizeSealDemoNotes,
  parseSealDemoReport,
  plannedSealTrajectory,
  renderSealDemoReport,
  serializeSealDemoReport,
  type SealDemoReport,
} from "../src/seal-demo.js";

test("续跑报告把 RPC 原始英文回滚说明规范为中文", () => {
  const notes = normalizeSealDemoNotes([
    '执行失败：预期 VaultSealed，模拟却得到：The contract function "submitPrediction" reverted with the following signature:\n0x00497160',
    '执行失败：预期 VaultSealed()，模拟却得到：The contract function "deposit" reverted.',
  ]);

  assert.deepEqual(notes, [
    "首次封存后应卦模拟仅返回自定义错误选择器 0x00497160；经合约 ABI 核对为 VaultSealed()。",
    "首次正式注资模拟仅报告合约回滚；随后发送的链上回滚交易与状态核验确认金库仍为 SEALED。",
  ]);
});

test("自定义回滚既可按错误名也可按四字节选择器确认", () => {
  assert.equal(matchesExpectedCustomError("execution reverted: VaultSealed()", "VaultSealed()"), true);
  assert.equal(matchesExpectedCustomError("reverted with signature: 0x00497160", "VaultSealed()"), true);
  assert.equal(matchesExpectedCustomError({ shortMessage: "reverted", cause: { data: "0x00497160" } }, "VaultSealed()"), true);
  assert.equal(matchesExpectedCustomError("reverted with signature: 0xc73dcc11", "VaultSealed()"), false);
});

test("一次正确预热后五次连续错误会使倍率收缩并自然穿越封存线", () => {
  const trajectory = plannedSealTrajectory();

  assert.equal(trajectory.length, 6);
  assert.deepEqual(trajectory.map((round) => round.outcome), [true, false, false, false, false, false]);
  assert.deepEqual(trajectory.map((round) => round.multiplier), [1, 5, 1, 1, 1, 1]);
  assert.deepEqual(trajectory.map((round) => round.brier), [10_000n, 98_010_000n, 98_010_000n, 98_010_000n, 98_010_000n, 98_010_000n]);
  assert.deepEqual(trajectory.map((round) => round.bankrollAfterUsdc6), [134_998n, 61_988n, 47_386n, 32_784n, 18_182n, 3_580n]);
  assert.equal(trajectory.at(-1)?.sealedAfter, true);
  assert.equal(trajectory.at(-2)?.sealedAfter, false);
  assert.equal(SEAL_DEMO_PARAMETERS.minimumSurvivalUsdc6, 15_000n);
});

test("封存报告逐笔保留哈希并以中文披露永久性验证", () => {
  const report: SealDemoReport = {
    schemaVersion: "1.0",
    generatedAt: "2026-09-05T00:00:00.000Z",
    network: { name: "Arc Testnet", chainId: 5_042_002 },
    status: "PASS",
    provider: { kind: "mock", modelId: "deterministic-seal-demo-mock-v1" },
    parameters: SEAL_DEMO_PARAMETERS,
    accounts: {
      deployer: "0x0000000000000000000000000000000000000001",
      querent: "0x0000000000000000000000000000000000000002",
      diviner: "0x0000000000000000000000000000000000000003",
      settler: "0x0000000000000000000000000000000000000004",
    },
    contracts: {},
    transactions: [{
      title: "首次错误结算",
      expected: "SUCCESS",
      status: "SUCCESS",
      transactionHash: `0x${"12".repeat(32)}`,
      blockNumber: 123n,
      gasUsed: 45_000n,
      gasCostWei: 1_125_000_000_000_000n,
    }],
    rounds: [],
    permanence: {
      resubmitReverted: true,
      depositReverted: true,
      forcedTransferDidNotRevive: true,
      finalState: "SEALED",
      finalAssetsUsdc6: 3_581n,
      historyCount: 6n,
      lastRoundId: 5n,
    },
    costs: {
      gasCostWei: 1_125_000_000_000_000n,
      gasCostUsdc6: 1_125n,
      vaultFundingUsdc6: 130_000n,
      conservativeBudgetUseUsdc6: 131_125n,
      deployerBalanceBeforeWei: 10_000_000_000_000_000_000n,
      deployerBalanceAfterWei: 9_998_875_000_000_000_000n,
      controlledBalanceAfterWei: 9_998_875_000_000_000_000n,
    },
    notes: ["测试报告"],
  };

  const json = serializeSealDemoReport(report);
  const markdown = renderSealDemoReport(report);

  assert.match(json, /"blockNumber": "123"/);
  assert.match(json, new RegExp(`0x${"12".repeat(32)}`));
  assert.match(markdown, /逐笔交易证据/);
  assert.match(markdown, /再次应卦回滚：PASS/);
  assert.match(markdown, /正式注资回滚：PASS/);
  assert.match(markdown, /强制转入不能复活：PASS/);
  assert.match(markdown, /确定性 mock/);
  assert.match(markdown, /部署者余额：10\.000000 → 9\.998875 USDC/);
  assert.match(markdown, /受控账户合计余额：9\.998875 USDC/);

  const restored = parseSealDemoReport(json);
  assert.equal(restored.transactions[0]?.blockNumber, 123n);
  assert.equal(restored.costs.gasCostWei, 1_125_000_000_000_000n);
});
