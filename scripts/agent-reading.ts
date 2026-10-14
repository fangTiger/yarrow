// scripts/agent-reading.ts
// 示例：AI agent 在 Arc 上按次购买一卦问事——读 402 付款要求、链上付款、凭交易哈希认领、轮询结果。
// 用法：AGENT_PRIVATE_KEY=0x… node --import tsx scripts/agent-reading.ts [站点地址] [问题]
// 私钥只从环境变量读取，不打印、不落盘；脚本只会转出 402 响应里写明的 0.05 USDC。
import { createPublicClient, createWalletClient, defineChain, erc20Abi, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcNetworkFor } from "../src/arc-network.js";

interface PaymentRequirements {
  chainId: number;
  token: Address;
  recipient: Address;
  amountUsdc6: string;
}

const base = (process.argv[2] ?? "https://yarrow-six.vercel.app").replace(/\/$/u, "");
const question = process.argv[3] ?? "Will my new business partnership work out this year?";
const key = process.env.AGENT_PRIVATE_KEY ?? process.env.ARC_PRIVATE_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/u.test(key)) {
  throw new Error("请设置 AGENT_PRIVATE_KEY（付款钱包私钥，只从环境变量读取）");
}
const account = privateKeyToAccount(key as Hex);
const request = { kind: "question", question, subjectKey: "career" };
// 写接口有跨站请求防护：服务端之间调用须带站点 Origin 头。
const headers = { "content-type": "application/json", origin: base };
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function post(body: unknown): Promise<Response> {
  return fetch(`${base}/api/readings`, { method: "POST", headers, body: JSON.stringify(body) });
}

// 1. 不带付款提交：有效请求得到 402 与付款要求。
const quote = await post(request);
if (quote.status !== 402) {
  throw new Error(`预期 HTTP 402，实际 ${quote.status}：${await quote.text()}`);
}
const { payment } = await quote.json() as { payment: PaymentRequirements };
const network = arcNetworkFor(payment.chainId);
console.log(`402 付款要求：${Number(payment.amountUsdc6) / 1e6} USDC → ${payment.recipient}（${network.name}）`);

// 2. 在 Arc 上用 USDC 的 ERC-20 接口付款，gas 同样用 USDC。
const chain = defineChain({
  id: network.chainId, name: network.name,
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [network.rpcUrl] } },
});
const wallet = createWalletClient({ account, chain, transport: http() });
const reader = createPublicClient({ chain, transport: http() });
const hash = await wallet.writeContract({
  address: payment.token, abi: erc20Abi, functionName: "transfer",
  args: [payment.recipient, BigInt(payment.amountUsdc6)],
});
const receipt = await reader.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`付款交易失败：${hash}`);
console.log(`已付款：${hash}（区块 ${receipt.blockNumber}）`);

// 3. 带付款凭证再次提交，认领这一卦。
const claimed = await post({ ...request, feeProof: { payer: account.address, transactionHash: hash } });
if (!claimed.ok) throw new Error(`认领失败 ${claimed.status}：${await claimed.text()}`);
const { id } = await claimed.json() as { id: string };
console.log(`已认领：${base}/#/r/${id}`);

// 4. 轮询到完成（六掷起卦后三家落笔、写总述，通常一两分钟）。
for (let attempt = 0; attempt < 90; attempt += 1) {
  const reading = await (await fetch(`${base}/api/readings/${id}`)).json() as {
    status: string; summary?: { status: string; output?: { conclusion?: string } };
  };
  if (reading.status === "done" && reading.summary?.status !== "writing") {
    console.log(`完成：${reading.summary?.output?.conclusion ?? "（总述未生成，可在页面重试）"}`);
    process.exit(0);
  }
  if (reading.status === "failed") throw new Error("解读失败，可在页面重试");
  await sleep(4_000);
}
throw new Error("等待超时，可稍后打开页面查看");
