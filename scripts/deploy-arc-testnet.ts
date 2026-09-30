import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createWalletClient,
  http,
  keccak256,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact, type ProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";
import {
  DIVINER_PROFILES,
  IDENTITY_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ADDRESS,
  USDC_ADDRESS,
  VALIDATION_REGISTRY_ADDRESS,
  YIJING_PARAMETERS,
  deriveRolePrivateKey,
  deploymentDisposition,
  matchExistingAgentIdentities,
  type ContractDeployment,
} from "../src/yijing-deployment.js";
import { formatUsdc6 } from "../src/yijing-report.js";

const DEPLOYMENT_PATH = "deployments/arc-testnet.json";
const IDENTITY_SOURCE_PATH = "deployments/arc-testnet-agent.json";
const SUPPLY_PREDICATE_ID = keccak256(stringToHex("USDC_TOTAL_SUPPLY_ABOVE"));
const MUTUAL_PREDICATE_ID = keccak256(stringToHex("MUTUAL_OUTCOME"));
const ATTESTED_PREDICATE_ID = keccak256(stringToHex("ATTESTED_OUTCOME"));
const AGENT_COUNT_PREDICATE_ID = keccak256(stringToHex("AGENT_COUNT_ABOVE"));
const SUPPLY_SCHEMA_HASH = keccak256(stringToHex("abi.encode(uint256 threshold)"));
const MUTUAL_SCHEMA_HASH = keccak256(stringToHex("abi.encode(bytes32 caseId)"));
const ATTESTED_SCHEMA_HASH = keccak256(stringToHex("abi.encode(bytes32 requestHash,uint256 agentId)"));
const AGENT_COUNT_SCHEMA_HASH = keccak256(stringToHex("abi.encode(uint256 threshold)"));
const IDENTITY_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
] as const;
const VALIDATION_ABI = [
  { type: "function", name: "getIdentityRegistry", stateMutability: "view", inputs: [], outputs: [{ name: "identityRegistry", type: "address" }] },
  { type: "function", name: "getVersion", stateMutability: "pure", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

interface TransactionRecord {
  transactionHash: Hex;
  blockNumber: string;
  gasUsed: string;
  gasCostWei: string;
  gasCostUsdc: string;
}

interface AgentRecord {
  name: string;
  address: Address;
  agentId: string;
  transactionHash: Hex;
  metadataUri: string;
}

interface DeploymentManifest {
  schemaVersion: "1.0";
  updatedAt: string;
  network: { name: "Arc Testnet"; chainId: number; rpcUrl: string };
  parameters: {
    waitBlocks: string;
    revealWindow: string;
    maxResolutionDelay: string;
    mMin: number;
    mMax: number;
    feeUsdc: string;
    bondUsdc: string;
    vaultFundingEachUsdc: string;
    rationale: string[];
  };
  accounts: {
    deployer: Address;
    treasury: Address;
    querent: Address;
    thirdParty: Address;
    diviners: Array<{ key: string; name: string; address: Address }>;
  };
  contracts: Record<string, ContractDeployment>;
  externalContracts: {
    ValidationRegistry: { address: Address; identityRegistry: Address; version: string };
  };
  transactions: Record<string, TransactionRecord>;
  vaultFunding: Record<string, { amount: string; approve: TransactionRecord; deposit: TransactionRecord }>;
  agents: AgentRecord[];
  runs: Array<{ reportPath: string; generatedAt: string; status: string }>;
}

const publicClient = createArcPublicClient();

function gasCost(receipt: TransactionReceipt): bigint {
  return receipt.gasUsed * receipt.effectiveGasPrice;
}

function nativeCost(receipt: TransactionReceipt): string {
  const value = gasCost(receipt);
  const integer = value / 1_000_000_000_000_000_000n;
  const fraction = (value % 1_000_000_000_000_000_000n).toString().padStart(18, "0").slice(0, 6);
  return `${integer}.${fraction}`;
}

function transactionRecord(receipt: TransactionReceipt, hash: Hex): TransactionRecord {
  return {
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    gasCostWei: gasCost(receipt).toString(),
    gasCostUsdc: nativeCost(receipt),
  };
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item), 2);
}

async function saveManifest(manifest: DeploymentManifest): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  await mkdir(path.dirname(DEPLOYMENT_PATH), { recursive: true });
  const temporaryPath = `${DEPLOYMENT_PATH}.tmp`;
  await writeFile(temporaryPath, `${stringify(manifest)}\n`, "utf8");
  await rename(temporaryPath, DEPLOYMENT_PATH);
}

async function loadManifest(deployer: Address): Promise<DeploymentManifest> {
  try {
    if (process.argv.includes("--fresh")) {
      try {
        await copyFile(DEPLOYMENT_PATH, "deployments/arc-testnet-pre-deepseek.json", fsConstants.COPYFILE_EXCL);
      } catch (error) {
        if (!((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "EEXIST")) {
          throw error;
        }
      }
      throw Object.assign(new Error("fresh"), { code: "ENOENT" });
    }
    const parsed = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as DeploymentManifest;
    if (parsed.network.chainId !== ARC_CHAIN_ID) throw new Error("部署清单 Chain ID 与 Arc Testnet 不一致");
    if (parsed.accounts.deployer.toLowerCase() !== deployer.toLowerCase()) {
      throw new Error("部署清单的部署者与当前 ARC_PRIVATE_KEY 不一致");
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }

  const querent = privateKeyToAccount(deriveRolePrivateKey(requireArcPrivateKey(process.env), "querent"));
  const thirdParty = privateKeyToAccount(deriveRolePrivateKey(requireArcPrivateKey(process.env), "third-party"));
  const diviners = DIVINER_PROFILES.map((profile) => ({
    key: profile.key,
    name: profile.name,
    address: privateKeyToAccount(deriveRolePrivateKey(requireArcPrivateKey(process.env), `diviner/${profile.key}`)).address,
  }));
  return {
    schemaVersion: "1.0",
    updatedAt: new Date().toISOString(),
    network: { name: "Arc Testnet", chainId: ARC_CHAIN_ID, rpcUrl: ARC_RPC_URL },
    parameters: {
      waitBlocks: YIJING_PARAMETERS.waitBlocks.toString(),
      revealWindow: YIJING_PARAMETERS.revealWindow.toString(),
      maxResolutionDelay: YIJING_PARAMETERS.maxResolutionDelay.toString(),
      mMin: YIJING_PARAMETERS.mMin,
      mMax: YIJING_PARAMETERS.mMax,
      feeUsdc: formatUsdc6(YIJING_PARAMETERS.fee),
      bondUsdc: formatUsdc6(YIJING_PARAMETERS.bond),
      vaultFundingEachUsdc: formatUsdc6(YIJING_PARAMETERS.vaultFunding),
      rationale: [
        "waitBlocks=8 约为四秒，足以形成可观察的提交后等待，同时远小于 8191 块历史窗口。",
        "m_min=1 让无历史易者只承担基础风险，m_max=3 限制演示期单次尾部损失。",
        "F=0.05 USDC 保留真实资金约束；每库 0.20 USDC 足以覆盖无历史时 m_min=1 的两轮演示。",
        "D=0.50 USDC 覆盖三位易者在 m_max=3 时的合计 S=0.45 USDC，D/S≈1.11。",
      ],
    },
    accounts: { deployer, treasury: deployer, querent: querent.address, thirdParty: thirdParty.address, diviners },
    contracts: {},
    externalContracts: {
      ValidationRegistry: {
        address: VALIDATION_REGISTRY_ADDRESS,
        identityRegistry: IDENTITY_REGISTRY_ADDRESS,
        version: "待链上核验",
      },
    },
    transactions: {},
    vaultFunding: {},
    agents: [],
    runs: [],
  };
}

async function loadExistingAgentIdentities(
  profiles: readonly { name: string; address: Address }[],
): Promise<ReturnType<typeof matchExistingAgentIdentities>> {
  const source = JSON.parse(await readFile(IDENTITY_SOURCE_PATH, "utf8")) as Pick<DeploymentManifest, "network" | "agents">;
  if (source.network.chainId !== ARC_CHAIN_ID) throw new Error("ERC-8004 身份源清单 Chain ID 不匹配");
  return matchExistingAgentIdentities(profiles, source.agents);
}

async function artifact(contractName: string): Promise<ProbeArtifact> {
  return loadProbeArtifact(`contracts/out/${contractName}.sol/${contractName}.json`);
}

async function deployContract(
  manifest: DeploymentManifest,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  name: string,
  artifactValue: ProbeArtifact,
  args: readonly unknown[],
): Promise<Address> {
  const existing = manifest.contracts[name];
  if (deploymentDisposition(existing) === "reuse" && existing) {
    const code = await publicClient.getBytecode({ address: existing.address });
    if (!code || code === "0x") throw new Error(`${name} 清单地址没有链上代码，拒绝自动重部署`);
    console.log(`复用 ${name}：${existing.address}`);
    return existing.address;
  }

  console.log(`正在部署 ${name}`);
  const hash = await walletClient.deployContract({
    account,
    abi: artifactValue.abi,
    bytecode: artifactValue.bytecode,
    args,
  } as never);
  console.log(`${name} 部署交易：${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`${name} 部署交易回滚：${hash}`);
  }
  manifest.contracts[name] = {
    address: receipt.contractAddress,
    blockNumber: receipt.blockNumber.toString(),
    transactionHash: hash,
    constructorArgs: [...args],
    gasUsed: receipt.gasUsed.toString(),
    gasCostWei: gasCost(receipt).toString(),
    gasCostUsdc: nativeCost(receipt),
  };
  await saveManifest(manifest);
  console.log(`${name} 已部署：${receipt.contractAddress}`);
  return receipt.contractAddress;
}

async function writeConfiguration(
  manifest: DeploymentManifest,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  id: string,
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): Promise<void> {
  if (manifest.transactions[id]) {
    console.log(`复用配置记录 ${id}：${manifest.transactions[id].transactionHash}`);
    return;
  }
  const simulation = await publicClient.simulateContract({ account, address, abi, functionName, args } as never);
  const hash = await walletClient.writeContract({ ...simulation.request, account } as never);
  console.log(`${id} 交易：${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${id} 配置交易回滚：${hash}`);
  manifest.transactions[id] = transactionRecord(receipt, hash);
  await saveManifest(manifest);
}

async function main(): Promise<void> {
  const privateKey = requireArcPrivateKey(process.env);
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
  const actualChainId = await publicClient.getChainId();
  if (actualChainId !== ARC_CHAIN_ID) throw new Error(`Chain ID 不匹配：${actualChainId}`);
  const manifest = await loadManifest(account.address);
  const [validationIdentity, validationVersion] = await Promise.all([
    publicClient.readContract({ address: VALIDATION_REGISTRY_ADDRESS, abi: VALIDATION_ABI, functionName: "getIdentityRegistry" }) as Promise<Address>,
    publicClient.readContract({ address: VALIDATION_REGISTRY_ADDRESS, abi: VALIDATION_ABI, functionName: "getVersion" }) as Promise<string>,
  ]);
  if (validationIdentity.toLowerCase() !== IDENTITY_REGISTRY_ADDRESS.toLowerCase()) {
    throw new Error(`ValidationRegistry 绑定了意外的 IdentityRegistry：${validationIdentity}`);
  }
  manifest.externalContracts = {
    ValidationRegistry: { address: VALIDATION_REGISTRY_ADDRESS, identityRegistry: validationIdentity, version: validationVersion },
  };
  await saveManifest(manifest);

  const [predicateArtifact, scoreArtifact, roundArtifact, bookArtifact, vaultArtifact, mutualArtifact, supplyArtifact, attestedArtifact, agentCountArtifact] =
    await Promise.all([
      artifact("PredicateRegistry"),
      artifact("ScoreBook"),
      artifact("DivinationRegistry"),
      artifact("PredictionBook"),
      artifact("DivinerVault"),
      artifact("MutualResolver"),
      artifact("UsdcSupplyResolver"),
      artifact("AttestedResolver"),
      artifact("AgentCountResolver"),
    ]);

  const predicateRegistry = await deployContract(manifest, walletClient, account, "PredicateRegistry", predicateArtifact, []);
  const scoreBook = await deployContract(manifest, walletClient, account, "ScoreBook", scoreArtifact, [REPUTATION_REGISTRY_ADDRESS]);
  const roundRegistry = await deployContract(manifest, walletClient, account, "DivinationRegistry", roundArtifact, [
    USDC_ADDRESS,
    account.address,
    YIJING_PARAMETERS.waitBlocks,
    YIJING_PARAMETERS.revealWindow,
  ]);
  const predictionBook = await deployContract(manifest, walletClient, account, "PredictionBook", bookArtifact, [
    USDC_ADDRESS,
    roundRegistry,
    predicateRegistry,
    scoreBook,
  ]);

  const vaults: Array<{ key: string; name: string; diviner: Address; address: Address }> = [];
  for (const profile of manifest.accounts.diviners) {
    const contractKey = `DivinerVault_${profile.key}`;
    const vaultAddress = await deployContract(manifest, walletClient, account, contractKey, vaultArtifact, [
      USDC_ADDRESS,
      predictionBook,
      profile.address,
      YIJING_PARAMETERS.mMin,
      YIJING_PARAMETERS.mMax,
    ]);
    vaults.push({ key: profile.key, name: profile.name, diviner: profile.address, address: vaultAddress });
  }
  const mutualResolver = await deployContract(manifest, walletClient, account, "MutualResolver", mutualArtifact, [account.address]);
  const supplyResolver = await deployContract(manifest, walletClient, account, "UsdcSupplyResolver", supplyArtifact, [
    USDC_ADDRESS,
    YIJING_PARAMETERS.maxResolutionDelay,
  ]);
  const attestedResolver = await deployContract(manifest, walletClient, account, "AttestedResolver", attestedArtifact, [
    VALIDATION_REGISTRY_ADDRESS,
    account.address,
  ]);
  const agentCountResolver = await deployContract(manifest, walletClient, account, "AgentCountResolver", agentCountArtifact, [
    IDENTITY_REGISTRY_ADDRESS,
    YIJING_PARAMETERS.maxResolutionDelay,
  ]);

  const currentOperator = (await publicClient.readContract({
    address: roundRegistry,
    abi: roundArtifact.abi,
    functionName: "escrowOperator",
  })) as Address;
  if (currentOperator === "0x0000000000000000000000000000000000000000") {
    await writeConfiguration(manifest, walletClient, account, "设置托管操作员", roundRegistry, roundArtifact.abi, "setEscrowOperator", [predictionBook]);
  } else if (currentOperator.toLowerCase() !== predictionBook.toLowerCase()) {
    throw new Error(`DivinationRegistry 已绑定其他托管操作员：${currentOperator}`);
  }

  const currentRecorder = (await publicClient.readContract({
    address: scoreBook,
    abi: scoreArtifact.abi,
    functionName: "recorder",
  })) as Address;
  if (currentRecorder === "0x0000000000000000000000000000000000000000") {
    await writeConfiguration(manifest, walletClient, account, "设置计分记录者", scoreBook, scoreArtifact.abi, "setRecorder", [predictionBook]);
  } else if (currentRecorder.toLowerCase() !== predictionBook.toLowerCase()) {
    throw new Error(`ScoreBook 已绑定其他记录者：${currentRecorder}`);
  }

  const currentReplayRecorder = (await publicClient.readContract({
    address: scoreBook,
    abi: scoreArtifact.abi,
    functionName: "replayRecorder",
  })) as Address;
  if (currentReplayRecorder === "0x0000000000000000000000000000000000000000") {
    await writeConfiguration(manifest, walletClient, account, "设置回放记录者", scoreBook, scoreArtifact.abi, "setReplayRecorder", [account.address]);
  } else if (currentReplayRecorder.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`ScoreBook 已绑定其他回放记录者：${currentReplayRecorder}`);
  }

  for (const vault of vaults) {
    const currentVault = (await publicClient.readContract({
      address: predictionBook,
      abi: bookArtifact.abi,
      functionName: "vaultOf",
      args: [vault.diviner],
    })) as Address;
    if (currentVault === "0x0000000000000000000000000000000000000000") {
      await writeConfiguration(
        manifest,
        walletClient,
        account,
        `注册易者_${vault.key}`,
        predictionBook,
        bookArtifact.abi,
        "registerDiviner",
        [vault.diviner, vault.address],
      );
    } else if (currentVault.toLowerCase() !== vault.address.toLowerCase()) {
      throw new Error(`${vault.name} 已绑定其他金库：${currentVault}`);
    }
  }

  const existingIdentities = await loadExistingAgentIdentities(manifest.accounts.diviners);
  for (const identity of existingIdentities) {
    const owner = await publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: IDENTITY_ABI,
      functionName: "ownerOf",
      args: [identity.agentIdValue],
    }) as Address;
    if (owner.toLowerCase() !== identity.address.toLowerCase()) {
      throw new Error(`${identity.name} 的 ERC-8004 agentId 所有者与易者地址不一致`);
    }
    const linked = await publicClient.readContract({
      address: scoreBook,
      abi: scoreArtifact.abi,
      functionName: "hasAgentId",
      args: [identity.address],
    }) as boolean;
    if (!linked) {
      const profile = manifest.accounts.diviners.find((candidate) => candidate.name === identity.name)!;
      await writeConfiguration(
        manifest,
        walletClient,
        account,
        `关联ERC8004身份_${profile.key}`,
        scoreBook,
        scoreArtifact.abi,
        "setAgentId",
        [identity.address, identity.agentIdValue],
      );
    } else {
      const linkedId = await publicClient.readContract({
        address: scoreBook,
        abi: scoreArtifact.abi,
        functionName: "agentIdOf",
        args: [identity.address],
      }) as bigint;
      if (linkedId !== identity.agentIdValue) throw new Error(`${identity.name} 已关联其他 agentId：${linkedId}`);
    }
  }
  manifest.agents = existingIdentities.map(({ agentIdValue: _agentIdValue, ...identity }) => identity);
  await saveManifest(manifest);

  await writeConfiguration(
    manifest,
    walletClient,
    account,
    "登记天层_USDC总量",
    predicateRegistry,
    predicateArtifact.abi,
    "setPredicate",
    [SUPPLY_PREDICATE_ID, supplyResolver, SUPPLY_SCHEMA_HASH, false, 0, true],
  );
  await writeConfiguration(
    manifest,
    walletClient,
    account,
    "登记天层_ERC8004注册计数",
    predicateRegistry,
    predicateArtifact.abi,
    "setPredicate",
    [AGENT_COUNT_PREDICATE_ID, agentCountResolver, AGENT_COUNT_SCHEMA_HASH, false, 0, true],
  );
  await writeConfiguration(
    manifest,
    walletClient,
    account,
    "登记人层_双边确认",
    predicateRegistry,
    predicateArtifact.abi,
    "setPredicate",
    [MUTUAL_PREDICATE_ID, mutualResolver, MUTUAL_SCHEMA_HASH, false, 1, true],
  );
  await writeConfiguration(
    manifest,
    walletClient,
    account,
    "登记人层_ERC8004验证",
    predicateRegistry,
    predicateArtifact.abi,
    "setPredicate",
    [ATTESTED_PREDICATE_ID, attestedResolver, ATTESTED_SCHEMA_HASH, false, 1, true],
  );

  const erc20Artifact = await artifact("IERC20");
  for (const vault of vaults) {
    const existingFunding = manifest.vaultFunding[vault.key];
    if (existingFunding) {
      console.log(`复用 ${vault.name} 注资记录：${existingFunding.deposit.transactionHash}`);
      continue;
    }
    const currentBalance = (await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Artifact.abi,
      functionName: "balanceOf",
      args: [vault.address],
    })) as bigint;
    const amount = currentBalance >= YIJING_PARAMETERS.vaultFunding ? 0n : YIJING_PARAMETERS.vaultFunding - currentBalance;
    if (amount === 0n) throw new Error(`${vault.name} 已有足额资金但缺少注资交易记录，拒绝猜测交易哈希`);

    const approveSimulation = await publicClient.simulateContract({
      account,
      address: USDC_ADDRESS,
      abi: erc20Artifact.abi,
      functionName: "approve",
      args: [vault.address, amount],
    });
    const approveHash = await walletClient.writeContract(approveSimulation.request);
    console.log(`${vault.name} 授权交易：${approveHash}`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== "success") throw new Error(`${vault.name} 授权交易回滚：${approveHash}`);

    const depositSimulation = await publicClient.simulateContract({
      account,
      address: vault.address,
      abi: vaultArtifact.abi,
      functionName: "deposit",
      args: [amount],
    });
    const depositHash = await walletClient.writeContract(depositSimulation.request);
    console.log(`${vault.name} 注资交易：${depositHash}`);
    const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
    if (depositReceipt.status !== "success") throw new Error(`${vault.name} 注资交易回滚：${depositHash}`);
    manifest.vaultFunding[vault.key] = {
      amount: amount.toString(),
      approve: transactionRecord(approveReceipt, approveHash),
      deposit: transactionRecord(depositReceipt, depositHash),
    };
    await saveManifest(manifest);
  }

  console.log(`部署与配置完成，清单：${DEPLOYMENT_PATH}`);
  console.log(`三库注资合计：${formatUsdc6(YIJING_PARAMETERS.vaultFunding * 3n)} USDC`);
  console.log(`已复用并关联三个 ERC-8004 身份：${IDENTITY_REGISTRY_ADDRESS}`);
  console.log(`ValidationRegistry ${validationVersion} 已核验：${VALIDATION_REGISTRY_ADDRESS}`);
}

main().catch((error: unknown) => {
  console.error(`部署失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
