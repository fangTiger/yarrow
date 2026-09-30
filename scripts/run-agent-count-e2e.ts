import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

import {
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { decodePredicateConfig } from "../src/predicate-config.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";

const DEPLOYMENT_PATH = "deployments/arc-testnet.json";
const PREDICATE_ID = keccak256(stringToHex("AGENT_COUNT_ABOVE"));

interface DeploymentManifest {
  network: { chainId: number };
  accounts: { deployer: Address };
  contracts: Record<string, { address: Address }>;
}

function formatUsdc18(value: bigint): string {
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = (value % 1_000_000_000_000_000_000n).toString().padStart(18, "0").slice(0, 9);
  return `${whole}.${fraction}`;
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir("reports", { recursive: true });
  await writeFile(`${filePath}.tmp`, content, "utf8");
  await rename(`${filePath}.tmp`, filePath);
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  const manifest = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as DeploymentManifest;
  if (manifest.network.chainId !== ARC_CHAIN_ID) throw new Error("部署清单 Chain ID 与 Arc Testnet 不一致");
  const resolver = manifest.contracts.AgentCountResolver?.address;
  const predicateRegistry = manifest.contracts.PredicateRegistry?.address;
  if (!resolver || !predicateRegistry) throw new Error("部署清单缺少计数 resolver 或谓词注册表");

  const privateKey = requireArcPrivateKey(process.env);
  const account = privateKeyToAccount(privateKey);
  if (account.address.toLowerCase() !== manifest.accounts.deployer.toLowerCase()) {
    throw new Error("部署清单的部署者与当前签名账户不一致");
  }
  const publicClient = createArcPublicClient();
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC_URL, { timeout: 30_000 }),
  });
  const resolverArtifact = await loadProbeArtifact("contracts/out/AgentCountResolver.sol/AgentCountResolver.json");
  const predicateArtifact = await loadProbeArtifact("contracts/out/PredicateRegistry.sol/PredicateRegistry.json");

  const [predicate, countResult, countGas, latestBlock, balanceBefore] = await Promise.all([
    publicClient.readContract({
      address: predicateRegistry,
      abi: predicateArtifact.abi,
      functionName: "getPredicate",
      args: [PREDICATE_ID],
    }),
    publicClient.readContract({
      address: resolver,
      abi: resolverArtifact.abi,
      functionName: "currentCount",
    }),
    publicClient.estimateContractGas({
      account,
      address: resolver,
      abi: resolverArtifact.abi,
      functionName: "currentCount",
    }),
    publicClient.getBlockNumber(),
    publicClient.getBalance({ address: account.address }),
  ]);
  const { resolver: predicateResolver, schemaHash, querentControllable, tier, enabled } = decodePredicateConfig(predicate);
  const [currentCount, reliable] = countResult as readonly [bigint, boolean];
  if (!reliable || currentCount === 0n) throw new Error("计数 resolver 未能可靠取得当前计数");
  if (!enabled || tier !== 0 || querentControllable || predicateResolver.toLowerCase() !== resolver.toLowerCase()) {
    throw new Error("AGENT_COUNT_ABOVE 未按天层、不可由提问者控制的配置注册");
  }

  const threshold = currentCount - 1n;
  const params = encodeAbiParameters([{ type: "uint256" }], [threshold]);
  const deadline = latestBlock - 1n;
  const simulation = await publicClient.simulateContract({
    account,
    address: resolver,
    abi: resolverArtifact.abi,
    functionName: "resolve",
    args: [PREDICATE_ID, params, deadline],
  });
  const resolveGasEstimate = await publicClient.estimateContractGas({
    account,
    address: resolver,
    abi: resolverArtifact.abi,
    functionName: "resolve",
    args: [PREDICATE_ID, params, deadline],
  });
  const transactionHash = await walletClient.writeContract({ ...simulation.request, account } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  if (receipt.status !== "success") throw new Error("AgentCountResolver 真实解析交易回滚");

  const [observationResult, cachedResult, balanceAfter] = await Promise.all([
    publicClient.readContract({
      address: resolver,
      abi: resolverArtifact.abi,
      functionName: "getObservation",
      args: [params, deadline],
    }),
    publicClient.readContract({
      address: resolver,
      abi: resolverArtifact.abi,
      functionName: "resolve",
      args: [PREDICATE_ID, params, deadline],
    }),
    publicClient.getBalance({ address: account.address }),
  ]);
  const [observedCount, observedBlock, observationExists] = observationResult as readonly [bigint, bigint, boolean];
  const [outcome, decided] = cachedResult as readonly [boolean, boolean];
  if (!observationExists || !outcome || !decided || observedCount < currentCount) {
    throw new Error("链上缓存观察与预期不一致");
  }

  const receiptCost = receipt.gasUsed * receipt.effectiveGasPrice;
  const balanceDelta = balanceBefore - balanceAfter;
  const report = {
    schemaVersion: "1.0",
    generatedAt: generatedAt.toISOString(),
    network: { name: "Arc Testnet", chainId: ARC_CHAIN_ID },
    predicate: {
      predicateId: PREDICATE_ID,
      resolver: predicateResolver,
      schemaHash,
      tier: "HEAVEN",
      querentControllable,
      enabled,
    },
    search: {
      ownerOfCalls: 26,
      currentCountBeforeTransaction: currentCount.toString(),
      reliable,
      currentCountGasEstimate: countGas.toString(),
    },
    resolution: {
      threshold: threshold.toString(),
      deadline: deadline.toString(),
      observedCount: observedCount.toString(),
      observedBlock: observedBlock.toString(),
      outcome,
      decided,
      cachedReadVerified: true,
      resolveGasEstimate: resolveGasEstimate.toString(),
      transactionHash,
      transactionGasUsed: receipt.gasUsed.toString(),
      receiptCostWei: receiptCost.toString(),
      receiptCostUsdc: formatUsdc18(receiptCost),
      accountBalanceDeltaWei: balanceDelta.toString(),
      accountBalanceAfterUsdc: formatUsdc18(balanceAfter),
    },
  };
  const stamp = generatedAt.toISOString().replaceAll(":", "-").replace(".", "-");
  const basePath = `reports/arc-agent-count-e2e-${stamp}`;
  const markdown = [
    "# AgentCountResolver 链上验收",
    "",
    "- 状态：PASS",
    `- 天层注册：enabled=${enabled}，querentControllable=${querentControllable}，resolver=\`${predicateResolver}\``,
    `- 二分查询：26 次 ownerOf；eth_estimateGas=${countGas}`,
    `- 解析：threshold=${threshold}，observedCount=${observedCount}，outcome=${outcome}，decided=${decided}`,
    `- 缓存：同参数回读得到 decided=true，观察块=${observedBlock}`,
    `- 交易：\`${transactionHash}\`；gasUsed=${receipt.gasUsed}；成本=${formatUsdc18(receiptCost)} USDC`,
    `- 验收后部署账户原生余额：${formatUsdc18(balanceAfter)} USDC`,
    "",
  ].join("\n");
  await Promise.all([
    atomicWrite(`${basePath}.json`, `${JSON.stringify(report, null, 2)}\n`),
    atomicWrite(`${basePath}.md`, markdown),
  ]);

  console.log(`AgentCountResolver 链上验收：PASS；count=${observedCount}；currentCount gas=${countGas}`);
  console.log(`resolve gas=${receipt.gasUsed}，成本=${formatUsdc18(receiptCost)} USDC；剩余=${formatUsdc18(balanceAfter)} USDC`);
  console.log(`报告：${basePath}.md 与 ${basePath}.json`);
}

main().catch((error: unknown) => {
  console.error(`AgentCountResolver 链上验收失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
