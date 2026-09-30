import {
  decodeEventLog,
  getAddress,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import { USDC_ADDRESS } from "../yijing-deployment.js";
import {
  verifyQuestionFeeTransfers,
  type QuestionFeeProof,
  type QuestionFeeReceipt,
  type QuestionFeeTransfer,
} from "./fee-payment.js";

const USDC_TRANSFER_ABI = parseAbi([
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);
const USDC18_TO_USDC6 = 1_000_000_000_000n;

function gasWeiToUsdc6(value: bigint): bigint {
  return (value + USDC18_TO_USDC6 - 1n) / USDC18_TO_USDC6;
}

/**
 * 从 Arc 回执重建三笔 USDC 入库事实，并在进程生命周期内拒绝重复消费同一凭证。
 * 浏览器只提交公开交易哈希；私钥与起卦随机材料都不会进入此路径。
 */
export class ArcQuestionFeeVerifier {
  private readonly claimedHashes = new Set<string>();
  private readonly pendingHashes = new Set<string>();

  constructor(private readonly publicClient: PublicClient) {}

  async verify(proof: QuestionFeeProof): Promise<QuestionFeeReceipt> {
    if (!proof || !Array.isArray(proof.transactionHashes) || !proof.transactionHashes.length) {
      throw new Error("缺少三座金库付款凭证");
    }
    const keys = proof.transactionHashes.map((hash) => hash.toLowerCase());
    if (new Set(keys).size !== keys.length) throw new Error("付款凭证含重复交易哈希");
    if (keys.some((key) => this.claimedHashes.has(key) || this.pendingHashes.has(key))) {
      throw new Error("这组付款凭证已经用于另一卦");
    }
    keys.forEach((key) => this.pendingHashes.add(key));
    try {
      const transfers: QuestionFeeTransfer[] = [];
      let gasUsdc6 = 0n;
      for (const transactionHash of proof.transactionHashes) {
        const receipt = await this.publicClient.getTransactionReceipt({ hash: transactionHash });
        if (receipt.status !== "success") throw new Error(`卦金交易 ${transactionHash} 未成功`);
        gasUsdc6 += gasWeiToUsdc6(receipt.gasUsed * receipt.effectiveGasPrice);
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== USDC_ADDRESS.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({ abi: USDC_TRANSFER_ABI, data: log.data, topics: log.topics });
            const args = decoded.args as { from: Address; to: Address; value: bigint };
            transfers.push({
              from: getAddress(args.from),
              to: getAddress(args.to),
              amountUsdc6: args.value,
              transactionHash: transactionHash as Hex,
            });
          } catch {
            // 同一 USDC 合约的其他事件与本次分账无关。
          }
        }
      }
      const result = verifyQuestionFeeTransfers(proof, transfers, gasUsdc6);
      keys.forEach((key) => this.claimedHashes.add(key));
      return result;
    } finally {
      keys.forEach((key) => this.pendingHashes.delete(key));
    }
  }
}
