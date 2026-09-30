import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

import {
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";
import { deriveRolePrivateKey, VALIDATION_REGISTRY_ADDRESS } from "../src/yijing-deployment.js";

const DEPLOYMENT_PATH = "deployments/arc-testnet.json";
const VALIDATION_ABI = [
  {
    type: "function",
    name: "validationRequest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "requestURI", type: "string" },
      { name: "requestHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getValidationStatus",
    stateMutability: "view",
    inputs: [{ name: "requestHash", type: "bytes32" }],
    outputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "response", type: "uint8" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
      { name: "lastUpdate", type: "uint256" },
    ],
  },
] as const satisfies Abi;
const IDENTITY_ABI = [{
  type: "function",
  name: "ownerOf",
  stateMutability: "view",
  inputs: [{ name: "tokenId", type: "uint256" }],
  outputs: [{ name: "owner", type: "address" }],
}] as const satisfies Abi;

interface Manifest {
  network: { chainId: number };
  accounts: { deployer: Address; diviners: Array<{ key: string; address: Address }> };
  agents: Array<{ address: Address; agentId: string }>;
  contracts: Record<string, { address: Address }>;
  externalContracts: { ValidationRegistry: { address: Address; identityRegistry: Address; version: string } };
  runs: Array<{ reportPath: string; generatedAt: string; status: string }>;
}

interface TransactionEvidence {
  name: string;
  hash: Hex;
  blockNumber: string;
  gasUsed: string;
  gasCostWei: string;
}

const publicClient = createArcPublicClient();

function record(name: string, hash: Hex, receipt: TransactionReceipt): TransactionEvidence {
  return {
    name,
    hash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    gasCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
  };
}

function formatUsdc18(value: bigint): string {
  const whole = value / 1_000_000_000_000_000_000n;
  const fraction = (value % 1_000_000_000_000_000_000n).toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${fraction}`;
}

async function writeReport(baseName: string, report: Record<string, unknown>, markdown: string): Promise<void> {
  await mkdir("reports", { recursive: true });
  const jsonPath = `reports/${baseName}.json`;
  const markdownPath = `reports/${baseName}.md`;
  await Promise.all([
    writeFile(`${jsonPath}.tmp`, `${JSON.stringify(report, null, 2)}\n`, "utf8").then(() => rename(`${jsonPath}.tmp`, jsonPath)),
    writeFile(`${markdownPath}.tmp`, markdown, "utf8").then(() => rename(`${markdownPath}.tmp`, markdownPath)),
  ]);
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  const reportName = `arc-validation-e2e-${generatedAt.toISOString().replaceAll(":", "-").replace(".", "-")}`;
  const manifest = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Manifest;
  if (manifest.network.chainId !== ARC_CHAIN_ID) throw new Error("部署清单 Chain ID 不匹配");
  if (manifest.externalContracts.ValidationRegistry.address.toLowerCase() !== VALIDATION_REGISTRY_ADDRESS.toLowerCase()) {
    throw new Error("部署清单中的 ValidationRegistry 地址不匹配");
  }

  const basePrivateKey = requireArcPrivateKey(process.env);
  const deployer = privateKeyToAccount(basePrivateKey);
  const agentOwner = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "diviner/takashima"));
  if (deployer.address.toLowerCase() !== manifest.accounts.deployer.toLowerCase()) throw new Error("部署者账户不匹配");
  const agent = manifest.agents.find((candidate) => candidate.address.toLowerCase() === agentOwner.address.toLowerCase());
  if (!agent) throw new Error("找不到由测试易者实际持有的 ERC-8004 身份");
  const agentId = BigInt(agent.agentId);
  const identityOwner = await publicClient.readContract({
    address: manifest.externalContracts.ValidationRegistry.identityRegistry,
    abi: IDENTITY_ABI,
    functionName: "ownerOf",
    args: [agentId],
  });
  if (identityOwner.toLowerCase() !== agentOwner.address.toLowerCase()) throw new Error("agentId 的链上所有者不匹配");

  const attestedResolver = manifest.contracts.AttestedResolver?.address;
  if (!attestedResolver) throw new Error("部署清单缺少 AttestedResolver");
  const resolverArtifact = await loadProbeArtifact("contracts/out/AttestedResolver.sol/AttestedResolver.json");
  const ownerWallet = createWalletClient({ account: agentOwner, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
  const deployerWallet = createWalletClient({ account: deployer, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
  const requestHash = keccak256(stringToHex(`易经人层真实验证/${generatedAt.toISOString()}/${agentId}`));
  const responseHash = keccak256(stringToHex(`人类判定:YES/${requestHash}`));
  const requestURI = `data:application/json,{"kind":"yijing-outcome","requestHash":"${requestHash}"}`;
  const responseURI = `data:application/json,{"outcome":true,"requestHash":"${requestHash}"}`;
  const transactions: TransactionEvidence[] = [];

  const requestSimulation = await publicClient.simulateContract({
    account: agentOwner,
    address: VALIDATION_REGISTRY_ADDRESS,
    abi: VALIDATION_ABI,
    functionName: "validationRequest",
    args: [attestedResolver, agentId, requestURI, requestHash],
  });
  const requestTx = await ownerWallet.writeContract(requestSimulation.request);
  const requestReceipt = await publicClient.waitForTransactionReceipt({ hash: requestTx });
  if (requestReceipt.status !== "success") throw new Error("validationRequest 交易回滚");
  transactions.push(record("agent 所有者提交 validationRequest", requestTx, requestReceipt));

  const requestedStatus = await publicClient.readContract({
    address: VALIDATION_REGISTRY_ADDRESS,
    abi: VALIDATION_ABI,
    functionName: "getValidationStatus",
    args: [requestHash],
  });
  if (requestedStatus[0].toLowerCase() !== attestedResolver.toLowerCase() || requestedStatus[1] !== agentId) {
    throw new Error("Registry 未保存预期的验证者或 agentId");
  }

  const deadline = (await publicClient.getBlockNumber()) + 80n;
  const openSimulation = await publicClient.simulateContract({
    account: deployer,
    address: attestedResolver,
    abi: resolverArtifact.abi,
    functionName: "openCase",
    args: [requestHash, agentId, deadline],
  } as never);
  const openTx = await deployerWallet.writeContract({ ...openSimulation.request, account: deployer } as never);
  const openReceipt = await publicClient.waitForTransactionReceipt({ hash: openTx });
  if (openReceipt.status !== "success") throw new Error("openCase 交易回滚");
  transactions.push(record("登记人层案件", openTx, openReceipt));

  const responseSimulation = await publicClient.simulateContract({
    account: deployer,
    address: attestedResolver,
    abi: resolverArtifact.abi,
    functionName: "submitOutcome",
    args: [requestHash, true, responseURI, responseHash],
  } as never);
  const responseTx = await deployerWallet.writeContract({ ...responseSimulation.request, account: deployer } as never);
  const responseReceipt = await publicClient.waitForTransactionReceipt({ hash: responseTx });
  if (responseReceipt.status !== "success") throw new Error("validationResponse 交易回滚");
  transactions.push(record("人类判定者经 resolver 回写 validationResponse", responseTx, responseReceipt));

  const finalStatus = await publicClient.readContract({
    address: VALIDATION_REGISTRY_ADDRESS,
    abi: VALIDATION_ABI,
    functionName: "getValidationStatus",
    args: [requestHash],
  });
  if (
    finalStatus[0].toLowerCase() !== attestedResolver.toLowerCase()
    || finalStatus[1] !== agentId
    || finalStatus[2] !== 100
    || finalStatus[3] !== responseHash
    || finalStatus[4] !== "yijing-outcome-v1"
    || finalStatus[5] === 0n
  ) throw new Error("getValidationStatus 的最终状态不符合预期");

  while (await publicClient.getBlockNumber() <= deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const params = encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [requestHash, agentId]);
  const predicateId = await publicClient.readContract({
    address: attestedResolver,
    abi: resolverArtifact.abi,
    functionName: "PREDICATE_ID",
  }) as Hex;
  const resolved = await publicClient.readContract({
    address: attestedResolver,
    abi: resolverArtifact.abi,
    functionName: "resolve",
    args: [predicateId, params, deadline],
  }) as readonly [boolean, boolean];
  if (!resolved[0] || !resolved[1]) throw new Error("AttestedResolver 未把真实 Registry 响应解析为 YES/decided");

  const gasCostWei = transactions.reduce((sum, transaction) => sum + BigInt(transaction.gasCostWei), 0n);
  const report = {
    schemaVersion: "1.0",
    generatedAt: generatedAt.toISOString(),
    status: "PASS",
    chainId: ARC_CHAIN_ID,
    validationRegistry: VALIDATION_REGISTRY_ADDRESS,
    validationRegistryVersion: manifest.externalContracts.ValidationRegistry.version,
    identityRegistry: manifest.externalContracts.ValidationRegistry.identityRegistry,
    attestedResolver,
    agentId: agentId.toString(),
    agentOwner: agentOwner.address,
    requestHash,
    deadline: deadline.toString(),
    finalStatus: {
      validatorAddress: finalStatus[0],
      agentId: finalStatus[1].toString(),
      response: finalStatus[2],
      responseHash: finalStatus[3],
      tag: finalStatus[4],
      lastUpdate: finalStatus[5].toString(),
    },
    resolved: { outcome: resolved[0], decided: resolved[1] },
    transactions,
    gasCostWei: gasCostWei.toString(),
    gasCostUsdc: formatUsdc18(gasCostWei),
  };
  const markdown = `# ERC-8004 人层真实验证报告\n\n- 状态：PASS\n- ValidationRegistry：\`${VALIDATION_REGISTRY_ADDRESS}\`（版本 ${manifest.externalContracts.ValidationRegistry.version}）\n- AttestedResolver：\`${attestedResolver}\`\n- agentId：${agentId}（所有者已由 IdentityRegistry 核验）\n- requestHash：\`${requestHash}\`\n- Registry 响应：100；tag：\`yijing-outcome-v1\`；lastUpdate：${finalStatus[5]}\n- Resolver 结果：outcome=YES，decided=true\n- 交易数：${transactions.length}\n- gas 成本：${formatUsdc18(gasCostWei)} USDC\n\n验证链路为 agent 所有者直接请求标准 Registry，固定人类判定者只经 AttestedResolver 回写；未使用自建签名恢复通道。\n`;
  await writeReport(reportName, report, markdown);
  manifest.runs ??= [];
  manifest.runs.push({ reportPath: `reports/${reportName}.md`, generatedAt: generatedAt.toISOString(), status: "PASS" });
  await writeFile(`${DEPLOYMENT_PATH}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(`${DEPLOYMENT_PATH}.tmp`, DEPLOYMENT_PATH);
  console.log(`ERC-8004 ValidationRegistry 真实流程：PASS；requestHash=${requestHash}`);
  console.log(`Resolver 结果：YES/decided；gas=${formatUsdc18(gasCostWei)} USDC`);
  console.log(`报告：reports/${reportName}.md 与 reports/${reportName}.json`);
}

await main();
