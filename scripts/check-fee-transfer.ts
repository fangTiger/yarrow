import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getAddress, isAddress, type Hex } from "viem";
import { createArcPublicClient } from "../src/arc.js";
import { verifySingleFeeTransfer } from "../src/sanyi/fee.js";

export function parseFeeTransferArgs(args: readonly string[]) {
  const values = new Map<string, string>();
  const flags = new Set(["--tx", "--payer", "--recipient", "--amount"]);
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag || !flags.has(flag) || !value || values.has(flag)) {
      throw new Error("参数无效，请提供 --tx --payer --recipient --amount");
    }
    values.set(flag, value);
  }
  const hash = values.get("--tx") ?? "";
  const payer = values.get("--payer") ?? "";
  const recipient = values.get("--recipient") ?? "";
  const amount = values.get("--amount") ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/u.test(hash) || !isAddress(payer) || !isAddress(recipient)
    || !/^\d+$/u.test(amount)) {
    throw new Error("参数无效：需要完整交易哈希、有效地址与最小单位整数金额");
  }
  return { transactionHash: hash as Hex, payer: getAddress(payer),
    recipient: getAddress(recipient), amountUsdc6: BigInt(amount) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const input = parseFeeTransferArgs(process.argv.slice(2));
    const receipt = await createArcPublicClient().getTransactionReceipt({ hash: input.transactionHash });
    const verified = verifySingleFeeTransfer({ receipt, ...input });
    console.log(`卦金转账核验通过：付款人 ${verified.payer}，收款地址 ${verified.recipient}`);
    console.log(`金额 ${verified.feeUsdc6} 最小单位，区块 ${verified.blockNumber}`);
    console.log(`交易哈希：${verified.transactionHash}`);
  } catch (error) {
    console.error(`卦金转账核验失败：${error instanceof Error ? error.message : "读取回执失败"}`);
    process.exitCode = 1;
  }
}
