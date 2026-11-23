// web/lib/arc-verify.ts
import { encodePacked, keccak256, type Hex } from "viem";
import { deriveDailyLines, type DailyHexagram } from "../../src/sanyi/daily-hexagram.js";

/** Arc 上 USDC 的 ERC-20 接口地址（主网与测试网相同）。 */
export const ARC_USDC = "0x3600000000000000000000000000000000000000";
/** EIP-7708 系统地址：原生 USDC 转账的 Transfer 由它发出（18 位小数）。 */
export const ARC_NATIVE_USDC = "0xfffffffffffffffffffffffffffffffffffffffe";
/** 每卦卦金 0.05 USDC（6 位小数）。 */
export const FEE_USDC6 = 50_000n;
/** 同一卦金按原生 18 位小数表示。 */
export const FEE_NATIVE18 = FEE_USDC6 * 10n ** 12n;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_HASH = /^0x0*$/u;

export type Coin = 0 | 1;

export interface ThrowEvidence {
  index: number;
  blockNumber: string;
  blockHash: string;
  coins: readonly Coin[];
}

/** 浏览器端读取链上数据所需的最小接口，测试时可替换为假实现。 */
export interface ArcReader {
  getTransactionReceipt(hash: Hex): Promise<{
    status: "success" | "reverted";
    blockNumber: bigint;
    logs: ReadonlyArray<{ address: string; topics: readonly string[]; data: string }>;
  }>;
  getBlock(blockNumber: bigint): Promise<{ hash: string | null; timestamp: bigint }>;
}

export interface DailyBlockReader {
  getBlock(blockNumber: bigint): Promise<{ hash: string | null; timestamp: bigint }>;
}

export interface DailyHexagramCheck {
  ok: boolean;
  hashOk: boolean;
  lines: readonly number[];
}

export interface PaymentCheck {
  ok: boolean;
  blockNumber?: bigint;
  timestamp?: bigint;
  from?: string;
  to?: string;
  /** 换算到 6 位小数后的金额，供页面显示；原生付款的 18 位尾数在此截去。 */
  amountUsdc6?: bigint;
  /** 付款方式：ERC-20 `transfer` 或原生 USDC 转账。 */
  kind?: "erc20" | "native";
  reason?: "not-found" | "reverted" | "no-transfer" | "wrong-recipient" | "wrong-amount";
}

export interface ThrowCheck {
  index: number;
  blockNumber: string;
  ok: boolean;
  /** 链上区块哈希与存档一致。 */
  hashOk: boolean;
  /** 起卦区块晚于付款区块。 */
  afterPayment: boolean;
  /** 用链上哈希复算的三枚铜钱与存档一致。 */
  coinsOk: boolean;
  recomputed?: readonly Coin[];
}

export interface VerifyResult {
  ok: boolean;
  payment: PaymentCheck;
  throws: ThrowCheck[];
}

/** 示例的付款哈希已抹为全零，无法上链验证。 */
export function isVerifiablePayment(hash: string | undefined): hash is Hex {
  return typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/u.test(hash) && !ZERO_HASH.test(hash);
}

/** 与服务端 normalizeQuestion 相同的规范化：去首尾空白、连续空白并为一个空格。 */
export function normalizeCastQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** 与服务端 deriveThrow 同一公式：keccak256(encodePacked(...)) 取最低三位，1 为背、0 为字。 */
export function recomputeCoins(paymentTxHash: Hex, blockHash: Hex, question: string, index: number): Coin[] {
  const hash = keccak256(encodePacked(
    ["string", "bytes32", "bytes32", "string", "uint8"],
    ["sanyi-throw-v1", paymentTxHash, blockHash, normalizeCastQuestion(question), index],
  ));
  const bits = Number(BigInt(hash) & 7n);
  return [(bits & 1) as Coin, ((bits >> 1) & 1) as Coin, ((bits >> 2) & 1) as Coin];
}

function topicAddress(topic: string | undefined): string {
  return topic ? `0x${topic.slice(-40)}`.toLowerCase() : "";
}

/** 核对付款：回执成功，且含一笔转给收款方、金额恰为卦金的 USDC Transfer（ERC-20 或原生）。 */
export async function checkPayment(reader: ArcReader, hash: Hex, recipient?: string): Promise<PaymentCheck> {
  let receipt: Awaited<ReturnType<ArcReader["getTransactionReceipt"]>>;
  try {
    receipt = await reader.getTransactionReceipt(hash);
  } catch {
    return { ok: false, reason: "not-found" };
  }
  if (receipt.status !== "success") return { ok: false, blockNumber: receipt.blockNumber, reason: "reverted" };
  // 先列 ERC-20，再列原生：ERC-20 付款在 0xfffe 的镜像排在后面，不会抢先被认。
  const transfers = (["erc20", "native"] as const).flatMap((kind) => receipt.logs
    .filter((log) => log.address.toLowerCase() === (kind === "erc20" ? ARC_USDC : ARC_NATIVE_USDC)
      && log.topics[0]?.toLowerCase() === TRANSFER_TOPIC)
    .map((log) => ({
      kind, from: topicAddress(log.topics[1]), to: topicAddress(log.topics[2]), value: BigInt(log.data),
    })));
  if (transfers.length === 0) return { ok: false, blockNumber: receipt.blockNumber, reason: "no-transfer" };
  const wanted = recipient?.toLowerCase();
  const exact = (item: typeof transfers[number]) => item.value === (item.kind === "erc20" ? FEE_USDC6 : FEE_NATIVE18);
  const toWanted = transfers.filter((item) => !wanted || item.to === wanted);
  const transfer = toWanted.find(exact) ?? toWanted[0] ?? transfers[0]!;
  const block = await reader.getBlock(receipt.blockNumber);
  const base = {
    blockNumber: receipt.blockNumber, timestamp: block.timestamp, from: transfer.from, to: transfer.to,
    kind: transfer.kind,
    amountUsdc6: transfer.kind === "erc20" ? transfer.value : transfer.value / 10n ** 12n,
  };
  if (wanted && transfer.to !== wanted) return { ...base, ok: false, reason: "wrong-recipient" };
  if (!exact(transfer)) return { ...base, ok: false, reason: "wrong-amount" };
  return { ...base, ok: true };
}

/** 逐掷取链上区块，核对哈希、先后顺序，并复算三枚铜钱。 */
export async function checkThrows(
  reader: ArcReader,
  paymentTxHash: Hex,
  paymentBlock: bigint | undefined,
  question: string,
  throws: readonly ThrowEvidence[],
): Promise<ThrowCheck[]> {
  const checks: ThrowCheck[] = [];
  for (const item of throws) {
    const number = BigInt(item.blockNumber);
    const block = await reader.getBlock(number).catch(() => undefined);
    const chainHash = block?.hash?.toLowerCase();
    const hashOk = Boolean(chainHash) && chainHash === item.blockHash.toLowerCase();
    const afterPayment = paymentBlock !== undefined && number > paymentBlock;
    const recomputed = chainHash ? recomputeCoins(paymentTxHash, chainHash as Hex, question, item.index) : undefined;
    const coinsOk = Boolean(recomputed) && recomputed!.every((coin, position) => coin === item.coins[position]);
    checks.push({
      index: item.index, blockNumber: item.blockNumber, hashOk, afterPayment, coinsOk,
      ok: hashOk && afterPayment && coinsOk, ...(recomputed ? { recomputed } : {}),
    });
  }
  return checks;
}

/** 全部核对：付款通过，且每一掷都通过（八字与起名没有起卦，只看付款）。 */
export async function verifyOnArc(reader: ArcReader, input: {
  paymentTxHash: Hex;
  recipient?: string;
  question?: string;
  throws?: readonly ThrowEvidence[];
}): Promise<VerifyResult> {
  const payment = await checkPayment(reader, input.paymentTxHash, input.recipient);
  const throws = input.throws?.length && input.question !== undefined
    ? await checkThrows(reader, input.paymentTxHash, payment.blockNumber, input.question, input.throws)
    : [];
  return { ok: payment.ok && throws.every((item) => item.ok), payment, throws };
}

/** 浏览器直读每日卦区块，核对区块哈希后按公开公式复算六爻。 */
export async function verifyDailyHexagram(
  reader: DailyBlockReader,
  value: DailyHexagram,
): Promise<DailyHexagramCheck> {
  const block = await reader.getBlock(BigInt(value.block.number));
  const chainHash = block.hash?.toLowerCase();
  const hashOk = Boolean(chainHash) && chainHash === value.block.hash.toLowerCase();
  const lines = chainHash ? deriveDailyLines(chainHash as Hex, value.date) : [];
  const linesOk = lines.length === value.lines.length
    && lines.every((line, index) => line === value.lines[index]);
  return { ok: hashOk && linesOk, hashOk, lines };
}
