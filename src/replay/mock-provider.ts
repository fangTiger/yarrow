import { encodePacked, keccak256 } from "viem";

import type { ReplayPredictionInput, ReplayPredictionOutput, ReplayPredictor } from "./engine.js";

/** 只使用截止块及此前统计的显式 mock；不读取环境凭据，也不能决定倍率或下注额。 */
export class DeterministicReplayMock implements ReplayPredictor {
  readonly modelId = "deterministic-replay-mock-v1";

  async predict(input: ReplayPredictionInput): Promise<ReplayPredictionOutput> {
    const digest = keccak256(encodePacked(
      ["bytes32", "string", "uint256", "uint256", "uint256"],
      [
        input.cutoff.blockHash,
        input.divinerKey,
        BigInt(input.performance.sampleCount),
        input.performance.totalBrier,
        input.cutoff.totalSupply,
      ],
    ));
    const probabilityBps = 2_500 + Number(BigInt(digest) % 5_001n);
    return {
      probabilityBps,
      reasoning: `确定性 mock：仅按截止块 ${input.cutoff.blockNumber} 的哈希、已知 USDC 总量、${input.divinerKey} 身份与此前 Brier 状态派生概率。`,
    };
  }
}
