import { encodePacked, getAddress, keccak256, type Address, type Hex } from "viem";

import { decodeRevertData, errorMessage } from "./revert.js";
import type { ProbeResult, ProbeStatus } from "./report.js";

export type ArcPrivateKey = `0x${string}`;

export const EIP2935_DOCUMENTED_WINDOW = 8_191;
const EIP2935_PROBE_CEILING = 16_384;
const ZERO_HASH = `0x${"00".repeat(32)}` as Hex;

export function requireArcPrivateKey(environment: NodeJS.ProcessEnv | Record<string, string | undefined>): ArcPrivateKey {
  const value = environment.ARC_PRIVATE_KEY;
  if (!value) throw new Error("未设置 ARC_PRIVATE_KEY；已在任何链上交易前终止");
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("ARC_PRIVATE_KEY 格式无效：必须是 0x 开头的 64 个十六进制字符");
  }
  return value as ArcPrivateKey;
}

export function deriveFreshAddress(deploymentTransactionHash: Hex): Address {
  const digest = keccak256(encodePacked(["bytes32", "string"], [deploymentTransactionHash, "ARC_PROBE_FRESH"]));
  return getAddress(`0x${digest.slice(-40)}`);
}

export interface FreshAddressClient {
  getBytecode(args: { address: Address }): Promise<Hex | undefined>;
  getBalance(args: { address: Address }): Promise<bigint>;
  getTransactionCount(args: { address: Address }): Promise<number>;
}

export interface FreshAddressValidation {
  isFresh: boolean;
  balance: bigint;
  nonce: number;
  codeBytes: number;
  reason: string;
}

export async function validateFreshAddress(
  client: FreshAddressClient,
  address: Address,
): Promise<FreshAddressValidation> {
  const [bytecode, balance, nonce] = await Promise.all([
    client.getBytecode({ address }),
    client.getBalance({ address }),
    client.getTransactionCount({ address }),
  ]);
  const codeBytes = !bytecode || bytecode === "0x" ? 0 : (bytecode.length - 2) / 2;
  const isFresh = balance === 0n && nonce === 0 && codeBytes === 0;
  return {
    isFresh,
    balance,
    nonce,
    codeBytes,
    reason: isFresh ? "零余额、零 nonce、无代码" : `前置条件不满足：余额 ${balance}，nonce ${nonce}，代码 ${codeBytes} 字节`,
  };
}

export function classifyInnerCall(success: boolean, returnData: Hex): { status: ProbeStatus; reason: string | undefined } {
  return success
    ? { status: "PASS", reason: undefined }
    : { status: "REVERT", reason: decodeRevertData(returnData) };
}

export function classifyProbeError(error: unknown): ProbeStatus {
  return /revert|回滚/i.test(errorMessage(error)) ? "REVERT" : "FAIL";
}

export function classifyReceiptStatus(
  status: "success" | "reverted",
  revertReason?: string,
): { status: ProbeStatus; reason: string | undefined } {
  return status === "success"
    ? { status: "PASS", reason: undefined }
    : { status: "REVERT", reason: revertReason ?? "交易 receipt 显示回滚，但未能重放取得原因" };
}

export function requireHistoryHash(readSuccess: boolean, hash: Hex, returnData: Hex): Hex {
  if (!readSuccess) {
    throw new Error(`EIP-2935 内部调用回滚：${decodeRevertData(returnData)}；原始返回数据 ${returnData}`);
  }
  return hash;
}

export function historyProbeCeiling(currentBlock: bigint): number {
  if (currentBlock <= 1n) throw new Error("当前块高不足，无法探测 EIP-2935 历史窗口");
  return Number(currentBlock - 1n > BigInt(EIP2935_PROBE_CEILING) ? EIP2935_PROBE_CEILING : currentBlock - 1n);
}

export function historyHashForWindowSearch(readSuccess: boolean, hash: Hex): Hex {
  return readSuccess ? hash : ZERO_HASH;
}

export function calculateRequiredBalance(
  fundingAmount: bigint,
  fundingEntries: number,
  gasPrice: bigint,
  gasUnits: bigint,
): bigint {
  return fundingAmount * BigInt(fundingEntries) + gasPrice * gasUnits;
}

export interface PrevRandaoSample {
  blockNumber: bigint;
  value: bigint;
}

export function classifyPrevRandaoSamples(
  samples: PrevRandaoSample[],
  minimumSamples = 5,
): { passed: boolean; reason: string } {
  const distinctBlocks = new Set(samples.map((sample) => sample.blockNumber.toString()));
  if (samples.length < minimumSamples || distinctBlocks.size < minimumSamples) {
    return { passed: false, reason: `仅取得 ${distinctBlocks.size} 个不同块高样本，至少需要 ${minimumSamples} 个` };
  }
  const nonZero = samples.filter((sample) => sample.value !== 0n);
  return nonZero.length === 0
    ? { passed: true, reason: `${distinctBlocks.size} 个不同块高样本均为 0` }
    : { passed: false, reason: `${nonZero.length} 个样本返回非零值` };
}

const TRANSACTION_PROBE_SPECS = [
  ["1-native-receive", "receive/fallback 接收原生 USDC", "两个入口均成功，合约余额增加两笔 msg.value"],
  ["2-transfer-existing", "向已有且有余额的 EOA 转账", "内部 call 成功"],
  ["3-transfer-fresh", "向全新零状态地址转账", "Arc 可能拒绝；必须记录真实结果"],
  ["4-drain", "完全清空合约余额", "Arc 可能拒绝；必须记录真实结果"],
  ["5-balance-scale", "原生余额与 ERC-20 余额换算", "address(this).balance == balanceOf(this) * 1e12"],
  ["6-eip2935-window", "EIP-2935 历史哈希有效窗口", "二分实测最大非零历史哈希距离"],
  ["7-prevrandao", "PREVRANDAO 多块零值验证", "至少五个不同块高样本均为 0"],
  ["8-blockhash-comparison", "上一块 BLOCKHASH 与 EIP-2935 对比", "两个来源返回同一个非零上一块哈希"],
] as const;

export function completeTransactionResults(results: ProbeResult[], interruptionReason: string): ProbeResult[] {
  const byId = new Map(results.map((result) => [result.id, result]));
  return TRANSACTION_PROBE_SPECS.map(([id, title, expected]) =>
    byId.get(id) ?? {
      id,
      title,
      status: "FAIL",
      expected,
      observed: "上游流程中断，本项未执行",
      reason: interruptionReason,
    },
  );
}

export function finalizeDrainResult(result: ProbeResult, remainingBalance: bigint): ProbeResult {
  const finalized = { ...result, details: { ...result.details, remainingBalance } };
  if (result.status === "PASS" && remainingBalance !== 0n) {
    return {
      ...finalized,
      status: "FAIL",
      observed: `内部 call 成功，但合约仍有余额 ${remainingBalance}`,
    };
  }
  return finalized;
}
