// src/sanyi/throws.ts
import { encodePacked, keccak256, type Hex } from "viem";
import type { QuestionBlockSource } from "../oracle/question-oracle.js";
import { normalizeQuestion } from "./classify.js";
import { throwFromHash, type ThrowResult } from "./coins.js";
export type { Coin, ThrowResult } from "./coins.js";
export interface RecordedThrow extends ThrowResult {
  blockNumber: string;
  blockHash: Hex;
  blockTimestamp: string;
}
export class ArcUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super("未能取得天时（Arc 网络无响应），稍后可继续", options);
    this.name = "ArcUnavailableError";
  }
}
export interface DeriveThrowInput {
  paymentTxHash: Hex;
  blockHash: Hex;
  question: string;
  index: number;
}
export function deriveThrow(input: DeriveThrowInput): ThrowResult {
  const hash = keccak256(encodePacked(
    ["string", "bytes32", "bytes32", "string", "uint8"],
    ["sanyi-throw-v1", input.paymentTxHash, input.blockHash, normalizeQuestion(input.question), input.index],
  ));
  return throwFromHash(hash, input.index);
}
export function assertNextThrow(recorded: readonly Pick<RecordedThrow, "index">[], index: number): void {
  if (index > 6 || recorded.length >= 6) throw new Error("六掷已经完成，不能进行第七掷");
  const expected = recorded.length + 1;
  if (index !== expected) throw new Error(`需先完成第 ${expected} 掷`);
}
export async function waitForBlockAfter(
  source: QuestionBlockSource,
  minExclusive: bigint,
  options: {
    timeoutMs?: number;
    pollMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<Awaited<ReturnType<QuestionBlockSource["latest"]>>> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const pollMs = options.pollMs ?? 250;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const started = now();
  try {
    while (now() - started < timeoutMs) {
      const block = await source.latest();
      if (block.number > minExclusive) return block;
      await sleep(pollMs);
    }
  } catch (error) {
    throw new ArcUnavailableError({ cause: error });
  }
  throw new ArcUnavailableError();
}
