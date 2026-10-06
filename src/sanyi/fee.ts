import {
  decodeEventLog, getAddress, isAddress, parseAbi, type Address, type Hex, type TransactionReceipt,
} from "viem";
import { USDC_TOKEN_ADDRESS } from "../frontend/wallet.js";

export const FEE_USDC6 = 50_000n;
const DEFAULT_RECIPIENT = "0x737301a6A40ea453A877627c409EF5756a395DB9";
const transferAbi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);
export interface SanyiFeeProof {
  payer: Address;
  transactionHash: Hex;
}
export interface SanyiFeeReceipt extends SanyiFeeProof {
  recipient: Address;
  feeUsdc6: string;
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
  const transfers = receipt.logs.flatMap((log) => {
    if (log.address.toLowerCase() !== USDC_TOKEN_ADDRESS.toLowerCase()) {
      return [];
    }
    try {
      const decoded = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics });
      return [decoded.args];
    } catch {
      return [];
    }
  });
  if (!transfers.length) {
    throw new FeePaymentError("未找到卦金转账，请核对付款交易");
  }
  const paidBy = transfers.filter((event) => event.from.toLowerCase() === payer.toLowerCase());
  if (!paidBy.length) {
    throw new FeePaymentError("卦金付款人不符，请使用付款钱包");
  }
  const received = paidBy.filter((event) => event.to.toLowerCase() === recipient.toLowerCase());
  if (!received.length) {
    throw new FeePaymentError("卦金收款地址不符，请核对三易收款地址");
  }
  if (!received.some((event) => event.value === amountUsdc6)) {
    throw new FeePaymentError("卦金金额不符，须转账 0.05 USDC");
  }
  return {
    payer, recipient, feeUsdc6: amountUsdc6.toString(),
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
