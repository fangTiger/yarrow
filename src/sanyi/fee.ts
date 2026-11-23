import {
  decodeEventLog, getAddress, isAddress, parseAbi, type Address, type Hex, type TransactionReceipt,
} from "viem";
import { USDC_TOKEN_ADDRESS } from "../frontend/wallet.js";

export const FEE_USDC6 = 50_000n;
/** EIP-7708 系统地址：记录所有原生 USDC 移动（18 位小数），ERC-20 转账也会在此留一条镜像。 */
export const NATIVE_USDC_EMITTER = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE";
/** 6 位小数换算到原生 18 位小数的倍数。 */
const NATIVE_PER_USDC6 = 10n ** 12n;
const DEFAULT_RECIPIENT = "0x737301a6A40ea453A877627c409EF5756a395DB9";
const transferAbi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);
export interface SanyiFeeProof {
  payer: Address;
  transactionHash: Hex;
}
export type FeePaymentKind = "erc20" | "native";
export interface SanyiFeeReceipt extends SanyiFeeProof {
  recipient: Address;
  feeUsdc6: string;
  /** 卦金付款方式：ERC-20 `transfer` 或原生 USDC 转账。 */
  feePaymentKind: FeePaymentKind;
  blockNumber: bigint;
}
export interface SanyiFeeVerifier {
  verify(proof: SanyiFeeProof): Promise<SanyiFeeReceipt>;
}
export type FeeTransactionReceipt = Pick<TransactionReceipt, "status" | "blockNumber" | "transactionHash"> & {
  logs: readonly Pick<TransactionReceipt["logs"][number], "address" | "data" | "topics">[];
};
export class FeePaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeePaymentError";
  }
}
export function feeRecipientFromEnv(env: { SANYI_FEE_RECIPIENT?: string }): Address {
  const value = env.SANYI_FEE_RECIPIENT ?? DEFAULT_RECIPIENT;
  if (!isAddress(value)) {
    throw new Error("三易收款地址无效，请检查 SANYI_FEE_RECIPIENT");
  }
  return getAddress(value);
}
export function verifySingleFeeTransfer(input: {
  receipt: FeeTransactionReceipt;
  payer: Address;
  recipient: Address;
  amountUsdc6: bigint;
}): SanyiFeeReceipt {
  const { receipt, payer, recipient, amountUsdc6 } = input;
  if (receipt.status !== "success") {
    throw new FeePaymentError("卦金交易失败，请重新付款");
  }
  const erc20 = USDC_TOKEN_ADDRESS.toLowerCase();
  const native = NATIVE_USDC_EMITTER.toLowerCase();
  // 只解析两个可信发射地址的 Transfer；其它合约发出的同名事件一律忽略。
  const transfers = receipt.logs.flatMap((log) => {
    const emitter = log.address.toLowerCase();
    const kind: FeePaymentKind | undefined = emitter === erc20 ? "erc20" : emitter === native ? "native" : undefined;
    if (!kind) {
      return [];
    }
    try {
      const decoded = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics });
      return [{ kind, ...decoded.args }];
    } catch {
      return [];
    }
  });
  if (!transfers.length) {
    throw new FeePaymentError("未找到卦金转账，请核对付款交易");
  }
  // 以日志里的 from 判断付款人：ERC-4337 时交易发送者是 bundler，不是付款人。
  const paidBy = transfers.filter((event) => event.from.toLowerCase() === payer.toLowerCase());
  if (!paidBy.length) {
    throw new FeePaymentError("卦金付款人不符，请使用付款钱包");
  }
  const received = paidBy.filter((event) => event.to.toLowerCase() === recipient.toLowerCase());
  if (!received.length) {
    throw new FeePaymentError("卦金收款地址不符，请核对三易收款地址");
  }
  // 先认 ERC-20，再认原生；只接受一条金额恰好相等的转账，不累加，
  // 因此 ERC-20 付款在 0xfffe 的镜像不会被再算一次。
  const expected: Record<FeePaymentKind, bigint> = {
    erc20: amountUsdc6,
    native: amountUsdc6 * NATIVE_PER_USDC6,
  };
  const matched = (["erc20", "native"] as const)
    .map((kind) => received.find((event) => event.kind === kind && event.value === expected[kind]))
    .find((event) => event !== undefined);
  if (!matched) {
    throw new FeePaymentError("卦金金额不符，须转账 0.05 USDC");
  }
  return {
    payer, recipient, feeUsdc6: amountUsdc6.toString(), feePaymentKind: matched.kind,
    transactionHash: receipt.transactionHash, blockNumber: receipt.blockNumber,
  };
}
interface FeePublicClient {
  waitForTransactionReceipt(input: { hash: Hex; timeout: number }): Promise<FeeTransactionReceipt>;
}
export class ArcFeeVerifier implements SanyiFeeVerifier {
  constructor(private readonly client: FeePublicClient, private readonly recipient: Address) {}
  async verify(proof: SanyiFeeProof): Promise<SanyiFeeReceipt> {
    const receipt = await this.client.waitForTransactionReceipt({
      hash: proof.transactionHash, timeout: 60_000,
    });
    return verifySingleFeeTransfer({ receipt, payer: proof.payer,
      recipient: this.recipient, amountUsdc6: FEE_USDC6 });
  }
}
