// 只读：用结果页「在 Arc 上验证」同一套逻辑核对一篇线上解读。
// 用法：node --import tsx scripts/check-reading-on-arc.ts <解读 JSON 文件> <收款地址>
import { readFileSync } from "node:fs";
import { createPublicClient, http, type Hex } from "viem";
import { verifyOnArc, type ArcReader } from "../web/lib/arc-verify.js";

const [file, recipient] = process.argv.slice(2);
if (!file || !recipient) throw new Error("用法：<解读 JSON 文件> <收款地址>");
const reading = JSON.parse(readFileSync(file, "utf8"));
const client = createPublicClient({ transport: http(process.env.ARC_RPC_URL ?? "https://rpc.mainnet.arc.io") });
const reader: ArcReader = {
  getTransactionReceipt: (hash) => client.getTransactionReceipt({ hash }),
  getBlock: (blockNumber) => client.getBlock({ blockNumber }),
};
const result = await verifyOnArc(reader, {
  paymentTxHash: reading.payment.firstHash as Hex, recipient, question: reading.question,
  throws: reading.throws.map((item: { index: number; blockNumber: string; blockHash: string; coins: number[] }) => ({
    index: item.index, blockNumber: item.blockNumber, blockHash: item.blockHash, coins: item.coins,
  })),
});
console.log(JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2));
