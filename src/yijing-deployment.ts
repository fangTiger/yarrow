import { encodePacked, keccak256, type Address, type Hex } from "viem";

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const REPUTATION_REGISTRY_ADDRESS = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const;
export const VALIDATION_REGISTRY_ADDRESS = "0x8004Cb1BF31DAf7788923b405b754f57acEB4272" as const;

export const YIJING_PARAMETERS = {
  waitBlocks: 8n,
  revealWindow: 32n,
  maxResolutionDelay: 64n,
  mMin: 1,
  mMax: 3,
  fee: 50_000n,
  bond: 500_000n,
  vaultFunding: 200_000n,
} as const;

export const DIVINER_PROFILES = [
  {
    key: "takashima",
    name: "高島易断",
    description: "重时势与实务决断的链上易者，以自身金库为概率预测背书。",
  },
  {
    key: "wuxing",
    name: "五行易（断易）",
    description: "重用神、世应与五行生克的链上易者，以自身金库为概率预测背书。",
  },
  {
    key: "meihua",
    name: "梅花心易",
    description: "重随机起卦与外应的链上易者，以自身金库为概率预测背书。",
  },
] as const;

export interface ContractDeployment {
  address: Address;
  blockNumber: string;
  transactionHash: Hex;
  constructorArgs: unknown[];
  gasUsed?: string;
  gasCostWei?: string;
  gasCostUsdc?: string;
}

interface TransferLog {
  address: Address;
  topics: readonly Hex[];
}

const TRANSFER_TOPIC = keccak256(encodePacked(["string"], ["Transfer(address,address,uint256)"]));
const ZERO_TOPIC = `0x${"00".repeat(32)}`;

export function extractAgentIdFromTransfer(logs: readonly TransferLog[], registry: Address, owner: Address): bigint {
  const ownerTopic = `0x${"00".repeat(12)}${owner.slice(2)}`.toLowerCase();
  for (const log of logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    const [signature, from, to, tokenId] = log.topics;
    if (
      signature?.toLowerCase() === TRANSFER_TOPIC.toLowerCase()
      && from?.toLowerCase() === ZERO_TOPIC
      && to?.toLowerCase() === ownerTopic
      && tokenId
    ) {
      return BigInt(tokenId);
    }
  }
  throw new Error("未找到 IdentityRegistry 的 Transfer 铸造事件");
}

export type DeploymentDisposition = "deploy" | "reuse";

export function deploymentDisposition(entry: ContractDeployment | undefined): DeploymentDisposition {
  return entry ? "reuse" : "deploy";
}

export function totalVaultFunding(): bigint {
  return BigInt(DIVINER_PROFILES.length) * YIJING_PARAMETERS.vaultFunding;
}

export interface DeadlineBudgetInput {
  currentBlock: bigint;
  plannedSequentialWrites: number;
  blocksPerWriteBudget: number;
  llmInferenceMilliseconds: number;
  blockTimeMilliseconds: number;
  safetyBlocks: number;
}

/**
 * C5 截止块预算：顺序交易打包预算 + LLM 最坏推理时间折算块数 + 安全余量。
 * Arc 实测平均出块间隔为 510ms；所有参数显式传入，避免把墙钟直觉藏成常量。
 */
export function plannedDeadline(input: DeadlineBudgetInput): bigint {
  if (!Number.isSafeInteger(input.plannedSequentialWrites) || input.plannedSequentialWrites <= 0) {
    throw new Error("计划交易数必须是正整数");
  }
  if (!Number.isSafeInteger(input.blocksPerWriteBudget) || input.blocksPerWriteBudget <= 0) {
    throw new Error("每笔交易块预算必须是正整数");
  }
  if (!Number.isFinite(input.llmInferenceMilliseconds) || input.llmInferenceMilliseconds < 0) {
    throw new Error("LLM 推理延迟必须是非负毫秒数");
  }
  if (!Number.isSafeInteger(input.blockTimeMilliseconds) || input.blockTimeMilliseconds <= 0) {
    throw new Error("出块间隔必须是正整数毫秒数");
  }
  if (!Number.isSafeInteger(input.safetyBlocks) || input.safetyBlocks < 0) {
    throw new Error("安全余量必须是非负整数块数");
  }

  const inferenceBlocks = Math.ceil(input.llmInferenceMilliseconds / input.blockTimeMilliseconds);
  return input.currentBlock
    + BigInt(input.plannedSequentialWrites) * BigInt(input.blocksPerWriteBudget)
    + BigInt(inferenceBlocks)
    + BigInt(input.safetyBlocks);
}

export interface ExistingAgentIdentity {
  name: string;
  address: Address;
  agentId: string;
  transactionHash: Hex;
  metadataUri: string;
}

/** 复用旧栈身份时必须同时匹配人格名与易者地址，不按顺序猜测。 */
export function matchExistingAgentIdentities(
  profiles: readonly { name: string; address: Address }[],
  identities: readonly ExistingAgentIdentity[],
): Array<ExistingAgentIdentity & { agentIdValue: bigint }> {
  return profiles.map((profile) => {
    const identity = identities.find((candidate) =>
      candidate.name === profile.name && candidate.address.toLowerCase() === profile.address.toLowerCase()
    );
    if (!identity) throw new Error(`${profile.name} 缺少与地址一致的既有 ERC-8004 身份`);
    if (!/^(0|[1-9][0-9]*)$/.test(identity.agentId)) throw new Error(`${profile.name} 的 agentId 格式无效`);
    return { ...identity, agentIdValue: BigInt(identity.agentId) };
  });
}

export function budgetUseUsdc6(
  vaultFunding: bigint,
  forfeited: bigint,
  querentLocked: bigint,
  gasCostWei: bigint,
): bigint {
  return vaultFunding + forfeited + querentLocked + gasCostWei / 1_000_000_000_000n;
}

export function deriveRolePrivateKey(basePrivateKey: Hex, role: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(basePrivateKey)) throw new Error("基础私钥格式无效");
  if (!role.trim()) throw new Error("角色名称不能为空");
  const derived = keccak256(
    encodePacked(["bytes32", "string"], [basePrivateKey, `身銭を切る易者/Arc-Testnet/${role}`]),
  );
  if (derived === `0x${"00".repeat(32)}`) throw new Error("派生私钥不能为零");
  return derived;
}

export interface AgentRegistrationInput {
  name: string;
  description: string;
  agentId: bigint;
  chainId: number;
  identityRegistry: Address;
}

export interface AgentRegistrationFile {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
  name: string;
  description: string;
  image: string;
  services: [];
  x402Support: false;
  active: true;
  registrations: Array<{ agentId: number; agentRegistry: string }>;
  supportedTrust: ["reputation", "crypto-economic"];
}

export function buildAgentRegistration(input: AgentRegistrationInput): AgentRegistrationFile {
  if (input.agentId > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("agentId 超出 JSON 安全整数范围");
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: input.name,
    description: input.description,
    image: `ipfs://bafybeigdyrzt-placeholder/${encodeURIComponent(input.name)}.png`,
    services: [],
    x402Support: false,
    active: true,
    registrations: [
      {
        agentId: Number(input.agentId),
        agentRegistry: `eip155:${input.chainId}:${input.identityRegistry}`,
      },
    ],
    supportedTrust: ["reputation", "crypto-economic"],
  };
}

export function registrationDataUri(registration: AgentRegistrationFile): string {
  return `data:application/json;base64,${Buffer.from(JSON.stringify(registration), "utf8").toString("base64")}`;
}
