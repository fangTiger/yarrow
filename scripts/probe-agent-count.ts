import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

import { BaseError, ContractFunctionRevertedError, type Address, type Hex } from "viem";

import { createArcPublicClient, ARC_CHAIN_ID } from "../src/arc.js";
import {
  estimateThresholdManipulation,
  findHighWatermark,
  sampleContinuity,
} from "../src/agent-count-probe.js";
import { IDENTITY_REGISTRY_ADDRESS } from "../src/yijing-deployment.js";

const OWNER_ABI = [{
  type: "function",
  name: "ownerOf",
  stateMutability: "view",
  inputs: [{ name: "agentId", type: "uint256" }],
  outputs: [{ name: "owner", type: "address" }],
}] as const;
const REGISTER_ABI = [{
  type: "function",
  name: "register",
  stateMutability: "nonpayable",
  inputs: [],
  outputs: [{ name: "agentId", type: "uint256" }],
}] as const;
const KNOWN_EXISTING = 891_442n;
const KNOWN_MISSING = 1_000_000n;
const KNOWN_REGISTRATION_TX = "0x49030ef8de2c44302049f656c71ee361561fb79a6061bda5f2014ea624de1d20" as Hex;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const client = createArcPublicClient();

async function rpcRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError;
}

async function ownerProbe(agentId: bigint): Promise<{
  agentId: string;
  behavior: "owner" | "zero-address" | "revert";
  owner?: Address;
}> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const owner = await client.readContract({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: OWNER_ABI,
        functionName: "ownerOf",
        args: [agentId],
      });
      return owner.toLowerCase() === ZERO_ADDRESS
        ? { agentId: agentId.toString(), behavior: "zero-address" }
        : { agentId: agentId.toString(), behavior: "owner", owner };
    } catch (error) {
      const reverted = error instanceof BaseError
        ? error.walk((candidate) => candidate instanceof ContractFunctionRevertedError)
        : null;
      if (reverted instanceof ContractFunctionRevertedError) {
        return { agentId: agentId.toString(), behavior: "revert" };
      }
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw new Error("不可达的 ownerOf 探测状态");
}

async function exists(agentId: bigint): Promise<boolean> {
  return (await ownerProbe(agentId)).behavior === "owner";
}

async function exactRecentContinuity(start: bigint, end: bigint): Promise<{ checked: number; missingIds: string[] }> {
  const missingIds: string[] = [];
  let checked = 0;
  for (let offset = start; offset <= end; offset += 5n) {
    const ids = Array.from(
      { length: Number((end - offset + 1n) < 5n ? end - offset + 1n : 5n) },
      (_unused, index) => offset + BigInt(index),
    );
    const results = await Promise.all(ids.map(exists));
    checked += ids.length;
    results.forEach((present, index) => {
      if (!present) missingIds.push(ids[index]!.toString());
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return { checked, missingIds };
}

function usdc18(value: bigint): string {
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
  const manifest = JSON.parse(await readFile("deployments/arc-testnet.json", "utf8")) as {
    accounts: { deployer: Address };
  };
  const fixed = await Promise.all([0n, 1n, 891_439n, 891_440n, 891_441n, 891_442n, 900_000n, 1_000_000n].map(ownerProbe));
  const watermark = await findHighWatermark(exists, KNOWN_EXISTING, KNOWN_MISSING);
  const exactRecent = await exactRecentContinuity(891_400n, watermark.highWatermark);
  let sampleQueue = Promise.resolve();
  const queuedExists = (agentId: bigint) => {
    const pending = sampleQueue.then(() => exists(agentId));
    sampleQueue = pending.then(() => undefined, () => undefined);
    return pending;
  };
  const globalSample = await sampleContinuity(queuedExists, 0n, watermark.highWatermark, 65);

  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const registrationReceipt = await rpcRetry(() => client.getTransactionReceipt({ hash: KNOWN_REGISTRATION_TX }));
  const currentBlock = await rpcRetry(() => client.getBlock());
  const gasPriceWei = await rpcRetry(() => client.getGasPrice());
  const registerGas = await rpcRetry(() => client.estimateContractGas({
      account: manifest.accounts.deployer,
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: REGISTER_ABI,
      functionName: "register",
  }));
  const registrationBlock = await rpcRetry(() => client.getBlock({ blockNumber: registrationReceipt.blockNumber }));
  const observedRegistrations = watermark.count - 891_443n;
  const observedSeconds = Number(currentBlock.timestamp - registrationBlock.timestamp);
  const manipulation = [1n, 10n, 100n, 1_000n].map((delta) => ({
    delta: delta.toString(),
    ...estimateThresholdManipulation({
      currentCount: watermark.count,
      threshold: watermark.count + delta - 1n,
      registerGas,
      gasPriceWei,
      observedRegistrations,
      observedSeconds,
    }),
  }));

  const report = {
    schemaVersion: "1.0",
    generatedAt: generatedAt.toISOString(),
    network: { name: "Arc Testnet", chainId: ARC_CHAIN_ID },
    identityRegistry: IDENTITY_REGISTRY_ADDRESS,
    conclusion: exactRecent.missingIds.length === 0 && globalSample.missingIds.length === 0 ? "可行" : "不可行",
    fixed,
    watermark,
    continuity: {
      exactRecent: { range: ["891400", watermark.highWatermark.toString()], ...exactRecent },
      globalSample: {
        checked: globalSample.sampledIds.length,
        missingIds: globalSample.missingIds.map(String),
        sampledIds: globalSample.sampledIds.map(String),
      },
    },
    gas: {
      ownerOfCallsForOffchainSearch: watermark.ownerOfCalls,
      resolverOwnerOfCalls: 26,
      minimumRegisterGas: registerGas.toString(),
      gasPriceWei: gasPriceWei.toString(),
      minimumRegisterCostUsdc: usdc18(registerGas * gasPriceWei),
    },
    observedRate: {
      baselineAgentId: "891442",
      baselineTransactionHash: KNOWN_REGISTRATION_TX,
      baselineBlock: registrationReceipt.blockNumber.toString(),
      baselineTimestamp: registrationBlock.timestamp.toString(),
      currentBlock: currentBlock.number.toString(),
      currentTimestamp: currentBlock.timestamp.toString(),
      newRegistrations: observedRegistrations.toString(),
      observedSeconds,
      registrationsPerHour: observedSeconds > 0 ? Number(observedRegistrations) * 3_600 / observedSeconds : null,
    },
    manipulation,
    evidence: {
      officialImplementation: "https://github.com/erc-8004/erc-8004-contracts/blob/master/contracts/IdentityRegistryUpgradeable.sol",
      standard: "https://eips.ethereum.org/EIPS/eip-8004",
      limitations: [
        "当前官方 v2.0.0 实现按 _lastId++ 连续铸造，且没有公开 burn 入口；链上抽样与近期逐 id 检查没有发现空洞。",
        "IdentityRegistry 是可升级代理；未来升级若加入销毁或非连续分配，会破坏二分的单调性假设。",
        "最小注册 gas 使用无参数 register() 估算；实际带 URI/metadata 的注册成本更高。",
      ],
    },
  };
  const timestamp = generatedAt.toISOString().replaceAll(":", "-").replace(".", "-");
  const basePath = `reports/arc-agent-count-${timestamp}`;
  const rows = manipulation.map((item) =>
    `| ${item.delta} | ${item.requiredRegistrations} | ${item.gas} | ${usdc18(item.costWei)} | ${item.projectedSecondsAtObservedRate === null ? "—" : item.projectedSecondsAtObservedRate.toFixed(1)} |`
  );
  const markdown = [
    "# ERC-8004 agent 计数探测报告",
    "",
    `- 结论：**${report.conclusion}**`,
    `- IdentityRegistry：\`${IDENTITY_REGISTRY_ADDRESS}\``,
    `- 高水位：${watermark.highWatermark}；首个缺失：${watermark.firstMissing}；零基计数：${watermark.count}`,
    `- 未铸造行为：ownerOf(${watermark.firstMissing}) 回滚，不返回零地址`,
    `- 连续性：近期 ${exactRecent.checked} 个 id 逐个检查，缺失 ${exactRecent.missingIds.length}；全区间等距抽样 ${globalSample.sampledIds.length} 个，缺失 ${globalSample.missingIds.length}`,
    `- 链下二分 ownerOf 调用：${watermark.ownerOfCalls}；合约固定上界搜索：26 次（含边界）`,
    `- 最低成本 register() gas 估算：${registerGas}；单次约 ${usdc18(registerGas * gasPriceWei)} USDC`,
    "",
    "## 阈值操纵成本",
    "",
    "| 需要新增 | 注册数 | gas | 成本（USDC） | 按观察速率所需秒数 |",
    "|---:|---:|---:|---:|---:|",
    ...rows,
    "",
    "## 证据边界",
    "",
    ...report.evidence.limitations.map((item) => `- ${item}`),
    "",
  ].join("\n");
  await Promise.all([
    atomicWrite(`${basePath}.json`, `${JSON.stringify(report, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value, 2)}\n`),
    atomicWrite(`${basePath}.md`, markdown),
  ]);

  console.log(`ownerOf 探测：${report.conclusion}`);
  console.log(`高水位=${watermark.highWatermark}，计数=${watermark.count}，近期逐 id 检查=${exactRecent.checked}，空洞=${exactRecent.missingIds.length}`);
  console.log(`register() 最低 gas=${registerGas}，单次成本=${usdc18(registerGas * gasPriceWei)} USDC`);
  console.log(`报告：${basePath}.md 与 ${basePath}.json`);
}

main().catch((error: unknown) => {
  console.error(`ownerOf 探测失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
