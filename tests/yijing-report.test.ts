import assert from "node:assert/strict";
import test from "node:test";

import { formatUsdc6, hexagramName, renderE2EReport, type E2EReport } from "../src/yijing-report.js";

test("USDC 六位精度与卦名按中文展示", () => {
  assert.equal(formatUsdc6(2_250_000n), "2.250000");
  assert.equal(formatUsdc6(-48_000n), "-0.048000");
  assert.equal(hexagramName(1), "乾为天");
  assert.equal(hexagramName(64), "火水未济");
});

test("端到端报告逐笔列出交易、gas、成本和三项额外验证", () => {
  const report: E2EReport = {
    schemaVersion: "1.0",
    generatedAt: "2026-09-05T00:00:00.000Z",
    network: { name: "Arc Testnet", chainId: 5_042_002 },
    deploymentFile: "deployments/arc-testnet.json",
    parameters: {
      waitBlocks: "8",
      revealWindow: "32",
      feeUsdc: "0.050000",
      bondUsdc: "0.500000",
      mMin: 1,
      mMax: 3,
    },
    steps: [
      {
        id: "normal-commit",
        title: "完整生命周期：commit",
        status: "PASS",
        actor: "提问者",
        transactionHash: `0x${"ab".repeat(32)}`,
        blockNumber: "123",
        gasUsed: "100000",
        gasCostUsdc: "0.002500",
        observed: "承诺已锁定",
      },
    ],
    checks: {
      fullLifecycle: "PASS",
      thirdPartyForfeit: "PASS",
      unresolvedLocks: "PASS",
      permissionlessSettlement: "PASS",
    },
    agents: [],
    totals: {
      gasCostUsdc: "0.002500",
      vaultFundingUsdc: "2.250000",
      forfeitedUsdc: "0.550000",
      permanentlyLockedUsdc: "0.550000",
      deployerRemainingUsdc: "16.000000",
    },
    notes: [],
  };

  const markdown = renderE2EReport(report);
  assert.match(markdown, /完整生命周期：commit/);
  assert.match(markdown, /0xabab/);
  assert.match(markdown, /gas/);
  assert.match(markdown, /第三方弃卦.*PASS/);
  assert.match(markdown, /未决永久锁定.*PASS/);
  assert.match(markdown, /无许可结算.*PASS/);
});
