import { encodeAbiParameters, type Address } from "viem";

import { ARC_ADDRESSES, PYTH_ETH_USD_PRICE_ID, READONLY_TARGETS, REPORT_SOURCES } from "../src/addresses.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, createArcPublicClient } from "../src/arc.js";
import { probeReadonlyTarget, type ReadonlyClientLike } from "../src/readonly-probe.js";
import { classifyPythFreshness } from "../src/pyth.js";
import { buildReport, reportTimestamp, writeReport, type ProbeResult } from "../src/report.js";
import { errorMessage } from "../src/revert.js";

const pythPriceAbi = [
  {
    type: "function",
    name: "getPriceUnsafe",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      {
        name: "price",
        type: "tuple",
        components: [
          { name: "price", type: "int64" },
          { name: "conf", type: "uint64" },
          { name: "expo", type: "int32" },
          { name: "publishTime", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const pythFreshPriceAbi = [
  {
    type: "function",
    name: "getPriceNoOlderThan",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "age", type: "uint256" },
    ],
    outputs: pythPriceAbi[0].outputs,
  },
] as const;

const pythValidTimePeriodAbi = [
  {
    type: "function",
    name: "getValidTimePeriod",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "period", type: "uint256" }],
  },
] as const;

function asStringRecord(value: unknown): Record<string, bigint | number | string> {
  if (typeof value !== "object" || value === null) throw new Error("Pyth 返回值不是价格结构");
  return value as Record<string, bigint | number | string>;
}

async function probePythPrice(
  client: ReturnType<typeof createArcPublicClient>,
  latestBlockTimestamp: bigint,
): Promise<ProbeResult[]> {
  try {
    const [value, validTimePeriod] = await Promise.all([
      client.readContract({
        address: ARC_ADDRESSES.pythCore,
        abi: pythPriceAbi,
        functionName: "getPriceUnsafe",
        args: [PYTH_ETH_USD_PRICE_ID],
      }),
      client.readContract({
        address: ARC_ADDRESSES.pythCore,
        abi: pythValidTimePeriodAbi,
        functionName: "getValidTimePeriod",
      }),
    ]);
    const price = asStringRecord(value);
    const publishTime = BigInt(price.publishTime ?? 0);
    const freshness = classifyPythFreshness(latestBlockTimestamp, publishTime, validTimePeriod);
    const hasPrice = BigInt(price.price ?? 0) !== 0n && publishTime > 0n;
    const unsafeResult: ProbeResult = {
      id: "pyth-eth-usd-price",
      title: "Pyth ETH/USD 历史价格可读性",
      status: hasPrice ? "PASS" : "FAIL",
      expected: "官方 Pyth Core 地址能返回非零 ETH/USD 历史值",
      observed: hasPrice ? `getPriceUnsafe 可读取，价格年龄 ${freshness.ageSeconds} 秒` : "调用成功但价格或发布时间为零",
      details: { priceId: PYTH_ETH_USD_PRICE_ID, ...price, validTimePeriod, ...freshness },
    };

    try {
      const freshValue = await client.readContract({
        address: ARC_ADDRESSES.pythCore,
        abi: pythFreshPriceAbi,
        functionName: "getPriceNoOlderThan",
        args: [PYTH_ETH_USD_PRICE_ID, validTimePeriod],
      });
      return [
        unsafeResult,
        {
          id: "pyth-eth-usd-fresh-price",
          title: "Pyth ETH/USD 实时价格可用性",
          status: freshness.fresh ? "PASS" : "FAIL",
          expected: `价格年龄不超过合约有效期 ${validTimePeriod} 秒`,
          observed: freshness.fresh ? "getPriceNoOlderThan 调用成功且价格在有效期内" : "调用成功，但发布时间计算显示价格已过期",
          details: { priceId: PYTH_ETH_USD_PRICE_ID, price: freshValue, validTimePeriod, ...freshness },
        },
      ];
    } catch (error) {
      return [
        unsafeResult,
        {
          id: "pyth-eth-usd-fresh-price",
          title: "Pyth ETH/USD 实时价格可用性",
          status: "REVERT",
          expected: `价格年龄不超过合约有效期 ${validTimePeriod} 秒`,
          observed: "getPriceNoOlderThan 调用回滚；当前链上值不可作为实时价格直接消费",
          reason: errorMessage(error),
          details: { priceId: PYTH_ETH_USD_PRICE_ID, validTimePeriod, ...freshness },
        },
      ];
    }
  } catch (error) {
    return [
      {
        id: "pyth-eth-usd-price",
        title: "Pyth ETH/USD 历史价格可读性",
        status: "REVERT",
        expected: "官方 Pyth Core 地址能返回 ETH/USD 价格",
        observed: "getPriceUnsafe 调用回滚或无法解码",
        reason: errorMessage(error),
        details: { priceId: PYTH_ETH_USD_PRICE_ID, address: ARC_ADDRESSES.pythCore },
      },
      {
        id: "pyth-eth-usd-fresh-price",
        title: "Pyth ETH/USD 实时价格可用性",
        status: "SKIP",
        observed: "基础价格读取失败，未继续检查实时有效期",
      },
    ];
  }
}

async function probeHistoryContract(
  client: ReturnType<typeof createArcPublicClient>,
  blockNumber: bigint,
): Promise<ProbeResult> {
  if (blockNumber < 2n) {
    return {
      id: "eip2935-latest-hash",
      title: "EIP-2935 上一块哈希读取",
      status: "SKIP",
      observed: "链高度不足",
    };
  }
  const targetBlock = blockNumber - 1n;
  try {
    const response = await client.call({
      to: ARC_ADDRESSES.historyStorage,
      data: encodeAbiParameters([{ type: "uint256" }], [targetBlock]),
    });
    const hash = response.data ?? "0x";
    const hasExactLength = /^0x[0-9a-fA-F]{64}$/.test(hash);
    const nonZero = hasExactLength && !/^0x0+$/.test(hash);
    return {
      id: "eip2935-latest-hash",
      title: "EIP-2935 上一块哈希读取",
      status: nonZero ? "PASS" : "FAIL",
      expected: "返回非零 32 字节区块哈希",
      observed: nonZero ? `块 ${targetBlock} 返回 ${hash}` : `块 ${targetBlock} 返回零值、空值或非 32 字节响应`,
      details: { targetBlock, hash, hasExactLength },
    };
  } catch (error) {
    return {
      id: "eip2935-latest-hash",
      title: "EIP-2935 上一块哈希读取",
      status: "REVERT",
      observed: "只读调用回滚",
      reason: errorMessage(error),
      details: { targetBlock, address: ARC_ADDRESSES.historyStorage },
    };
  }
}

function summarizePythProPath(targetResults: ProbeResult[]): ProbeResult {
  const target = targetResults.find((result) => result.id === "pyth-pro");
  if (target?.status !== "PASS") {
    return {
      id: "pyth-pro-realtime-path",
      title: "Pyth Pro 实时价格端到端路径",
      status: "FAIL",
      expected: "官方 Arc Testnet Pyth Pro 验证合约已部署",
      observed: "Pyth Pro 合约存在性探测未通过",
      reason: target?.reason ?? "没有 Pyth Pro 探测结果",
    };
  }
  return {
    id: "pyth-pro-realtime-path",
    title: "Pyth Pro 实时价格端到端路径",
    status: "SKIP",
    expected: "取得 WebSocket 签名更新，并在 Arc 合约中完成 verifyUpdate 与价格解析",
    observed: "官方验证合约已部署；本次无 Pyth Pro 数据订阅凭据和签名 payload，未伪造端到端通过",
    reason: "Pyth Pro 需要链外订阅产生的签名更新数据，本只读 RPC 探针无法独立生成",
    details: {
      address: ARC_ADDRESSES.pythPro,
      integrationGuide: "https://docs.pyth.network/price-feeds/pro/integrate-as-consumer/evm",
    },
  };
}

async function main(): Promise<void> {
  console.log(`正在连接 Arc Testnet：${ARC_RPC_URL}`);
  const client = createArcPublicClient();
  const [chainId, blockNumber, latestBlock] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    client.getBlock({ blockTag: "latest" }),
  ]);
  if (chainId !== ARC_CHAIN_ID) throw new Error(`Chain ID 不匹配：期望 ${ARC_CHAIN_ID}，实际 ${chainId}`);
  console.log(`已连接 Chain ID ${chainId}，探测块高 ${blockNumber}`);

  const results: ProbeResult[] = [];
  for (const target of READONLY_TARGETS) {
    console.log(`正在探测：${target.title}`);
    results.push(await probeReadonlyTarget(client as unknown as ReadonlyClientLike, target));
  }
  results.push(summarizePythProPath(results));
  results.push(...(await probePythPrice(client, latestBlock.timestamp)));
  results.push(await probeHistoryContract(client, blockNumber));

  const generatedAt = new Date().toISOString();
  const report = buildReport({
    reportType: "readonly",
    generatedAt,
    network: { name: "Arc Testnet", chainId, rpcUrl: ARC_RPC_URL, blockNumber: blockNumber.toString() },
    results,
    sources: REPORT_SOURCES,
  });
  const paths = await writeReport(report, `arc-readonly-${reportTimestamp(new Date(generatedAt))}`);
  console.log(`只读探测完成：${paths.jsonPath}`);
  console.log(`Markdown 报告：${paths.markdownPath}`);
}

main().catch((error: unknown) => {
  console.error(`只读探测失败：${errorMessage(error)}`);
  process.exitCode = 1;
});
