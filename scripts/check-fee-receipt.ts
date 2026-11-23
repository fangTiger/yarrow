// 只读核对卦金收据：用服务端同一套核验逻辑检查主网交易，不发任何交易。
// 用法：node --import tsx scripts/check-fee-receipt.ts <交易哈希> [<交易哈希> ...]
import { createPublicClient, http, type Hex } from "viem";
import { FEE_USDC6, FeePaymentError, feeRecipientFromEnv, verifySingleFeeTransfer } from "../src/sanyi/fee.js";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function main(): Promise<void> {
  const hashes = process.argv.slice(2) as Hex[];
  if (!hashes.length) throw new Error("请至少提供一个交易哈希");
  const client = createPublicClient({ transport: http(process.env.ARC_RPC_URL ?? "https://rpc.mainnet.arc.io") });
  const recipient = feeRecipientFromEnv(process.env);
  for (const hash of hashes) {
    const receipt = await client.getTransactionReceipt({ hash });
    const transfers = receipt.logs.filter((log) => log.topics[0] === TRANSFER_TOPIC).map((log) => ({
      emitter: log.address, from: `0x${log.topics[1]!.slice(26)}`, to: `0x${log.topics[2]!.slice(26)}`,
      value: BigInt(log.data).toString(),
    }));
    // 付款人取付给收款地址的那条日志的 from，与 agent 提交 feeProof.payer 的方式一致。
    const payer = (transfers.find((item) => item.to.toLowerCase() === recipient.toLowerCase())?.from
      ?? receipt.from) as Hex;
    let result: unknown;
    try {
      const ok = verifySingleFeeTransfer({ receipt, payer, recipient, amountUsdc6: FEE_USDC6 });
      result = { accepted: true, feePaymentKind: ok.feePaymentKind, feeUsdc6: ok.feeUsdc6 };
    } catch (error) {
      if (!(error instanceof FeePaymentError)) throw error;
      result = { accepted: false, reason: error.message };
    }
    console.log(JSON.stringify({
      hash, blockNumber: receipt.blockNumber.toString(), txFrom: receipt.from, payer, transfers, result,
    }, null, 2));
  }
}

main().catch((error: unknown) => {
  console.error(`核对失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
