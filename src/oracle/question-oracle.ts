import { encodePacked, keccak256, type Hex } from "viem";

import { getHexagramText } from "../agent/zhouyi-corpus.js";
import {
  buildLiuyaoChart,
  deriveFiveHexagrams,
  type FiveHexagrams,
  type LiuyaoChart,
} from "./liuyao-chart.js";
import type { QuestionFeeProof, QuestionFeeReceipt } from "./fee-payment.js";
import {
  classifyQuestionSubject,
  confirmQuestionSubject,
  type ConfirmedQuestionSubject,
  type QuestionTrack,
} from "./question-classifier.js";

const QUESTION_DIVINERS = [
  { key: "takashima", name: "高島易断" },
  { key: "wuxing", name: "五行易（断易）" },
  { key: "meihua", name: "梅花心易" },
] as const;

export const QUESTION_RESPONSIBILITY_NOTICE = [
  "你刚刚已经支付卦金，钱分进了三位易者的金库。",
  "你问的这件事，没有一个将来会揭晓的答案。",
  "所以没有人能为它负责——包括刚刚收过你钱的我们。",
  "我们仍然可以为你解这一卦。",
].join("\n");

export interface QuestionHexagram {
  inputHash: Hex;
  lines: readonly number[];
  primaryKingWenNumber: number;
  primaryName: string;
  derivedKingWenNumber: number;
  derivedName: string;
  changingLinePositions: readonly number[];
  five: FiveHexagrams;
}

export interface QuestionBlockSource {
  latest(): Promise<{ number: bigint; hash: Hex; timestamp: bigint }>;
}

export interface QuestionInterpretationInput {
  question: string;
  divinerKey: string;
  divinerName: string;
  hexagram: QuestionHexagram;
  /** 由用户确认；保留可选以兼容直接调用解释器的旧接口。 */
  subject?: Pick<ConfirmedQuestionSubject, "suggestedKey" | "key" | "label" | "useGod" | "reason" | "overridden">;
}

export interface QuestionInterpretation {
  interpretation: string;
  counsel: string;
}

export interface QuestionInterpreter {
  interpret(input: QuestionInterpretationInput): Promise<QuestionInterpretation>;
}

export interface QuestionReading extends QuestionInterpretation {
  divinerKey: string;
  divinerName: string;
}

export interface QuestionOracleResult {
  track: "question";
  question: string;
  block: { number: string; hash: Hex; timestamp: string };
  hexagram: QuestionHexagram;
  subject: ConfirmedQuestionSubject;
  chart: LiuyaoChart;
  readings: QuestionReading[];
  responsibilityNotice: string;
  cost: {
    walletRequired: true;
    feeUsdc6: string;
    walletConfirmationCount: 1;
    transactionCount: number;
    gasUsdc6: string;
    recipients: 3;
  };
  feeDistribution: QuestionFeeReceipt["shares"];
  transactions: readonly Hex[];
}

export interface QuestionFeeVerifier {
  verify(proof: QuestionFeeProof): Promise<QuestionFeeReceipt>;
}

export interface QuestionOracleServiceOptions {
  blockSource: QuestionBlockSource;
  interpreter: QuestionInterpreter;
  paymentVerifier: QuestionFeeVerifier;
  castLedger?: QuestionCastLedger;
}

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ");
}

interface QuestionBasisBlock {
  number: bigint;
  hash: Hex;
  timestamp: bigint;
}

interface VerifiedQuestionCast {
  question: string;
  block: QuestionBasisBlock;
  payment: QuestionFeeReceipt;
}

/** 同一服务进程内保存已付问卦的最小复算边界，不保存私钥或随机材料。 */
export class QuestionCastLedger {
  private readonly entries = new Map<string, VerifiedQuestionCast>();

  get(claimKey: string): VerifiedQuestionCast | undefined {
    return this.entries.get(claimKey);
  }

  set(claimKey: string, value: VerifiedQuestionCast): void {
    this.entries.set(claimKey, value);
  }
}

function parseBasisBlock(value: unknown): QuestionBasisBlock {
  if (!value || typeof value !== "object") throw new Error("原起卦区块无效");
  const block = value as { number?: unknown; hash?: unknown; timestamp?: unknown };
  if (typeof block.number !== "string" || !/^\d+$/.test(block.number)) throw new Error("原起卦区块高度无效");
  if (typeof block.hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(block.hash)) throw new Error("原起卦区块哈希无效");
  if (typeof block.timestamp !== "string" || !/^\d+$/.test(block.timestamp)) throw new Error("原起卦区块时间无效");
  return { number: BigInt(block.number), hash: block.hash as Hex, timestamp: BigInt(block.timestamp) };
}

function paymentClaimKey(value: unknown): string {
  if (!value || typeof value !== "object") throw new Error("三座金库付款凭证不完整");
  const proof = value as Partial<QuestionFeeProof>;
  if (typeof proof.payer !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(proof.payer)) throw new Error("付款钱包地址无效");
  if (typeof proof.bundleId !== "string" || !proof.bundleId.trim()) throw new Error("三座金库付款凭证不完整");
  if (!Array.isArray(proof.transactionHashes) || !proof.transactionHashes.length || proof.transactionHashes.some((hash) => typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))) {
    throw new Error("三座金库付款交易哈希不完整");
  }
  return JSON.stringify({
    payer: proof.payer.toLowerCase(),
    bundleId: proof.bundleId,
    transactionHashes: proof.transactionHashes.map((hash) => hash.toLowerCase()),
  });
}

function sameBlock(left: QuestionBasisBlock, right: QuestionBasisBlock): boolean {
  return left.number === right.number
    && left.hash.toLowerCase() === right.hash.toLowerCase()
    && left.timestamp === right.timestamp;
}

/** 给定公开区块哈希与规范化问题即可在任何环境复算，不引入 salt 或私钥。 */
export function deriveQuestionHexagram(input: { blockHash: Hex; question: string }): QuestionHexagram {
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.blockHash)) throw new Error("区块哈希格式无效");
  const question = normalizeQuestion(input.question);
  if (!question) throw new Error("提问不能为空");
  const inputHash = keccak256(encodePacked(
    ["string", "bytes32", "string"],
    ["yijing-question-track-v1", input.blockHash, question],
  ));
  const bits = BigInt(inputHash);
  const lines: number[] = [];
  const changingLinePositions: number[] = [];
  for (let index = 0; index < 6; index += 1) {
    const coins = Number((bits >> BigInt(index * 3)) & 7n);
    const heads = (coins & 1) + ((coins >> 1) & 1) + ((coins >> 2) & 1);
    const line = 6 + heads;
    lines.push(line);
    const moving = line === 6 || line === 9;
    if (moving) changingLinePositions.push(index + 1);
  }
  const five = deriveFiveHexagrams(lines);
  const primaryKingWenNumber = five.primary.kingWenNumber;
  const derivedKingWenNumber = five.derived.kingWenNumber;
  return {
    inputHash,
    lines,
    primaryKingWenNumber,
    primaryName: getHexagramText(primaryKingWenNumber).name,
    derivedKingWenNumber,
    derivedName: getHexagramText(derivedKingWenNumber).name,
    changingLinePositions,
    five,
  };
}

/** 不可判定轨先核验三库卦金，再只读公开区块并行生成三份主观解读。 */
export class QuestionOracleService {
  private readonly castLedger: QuestionCastLedger;

  constructor(private readonly options: QuestionOracleServiceOptions) {
    this.castLedger = options.castLedger ?? new QuestionCastLedger();
  }

  async cast(input: {
    question: string;
    confirmedTrack: QuestionTrack;
    confirmedSubject?: unknown;
    payment: unknown;
    basisBlock?: QuestionOracleResult["block"];
  }): Promise<QuestionOracleResult> {
    if (input.confirmedTrack !== "question") throw new Error("付费解读服务只接受不可判定问题");
    const question = normalizeQuestion(input.question);
    if (question.length < 4 || question.length > 280) throw new Error("问题长度必须为 4–280 个字符");
    const suggestion = classifyQuestionSubject(question);
    const subject = confirmQuestionSubject(suggestion, input.confirmedSubject ?? suggestion.key);
    const claimKey = paymentClaimKey(input.payment);
    const requestedBasisBlock = input.basisBlock ? parseBasisBlock(input.basisBlock) : null;
    const prior = requestedBasisBlock ? this.castLedger.get(claimKey) : undefined;
    if (requestedBasisBlock && !prior) throw new Error("未找到原起卦记录，不能复用付款凭证");
    if (prior && prior.question !== question) throw new Error("付款凭证只能用于同一问题的事项重算");
    if (prior && !sameBlock(prior.block, requestedBasisBlock!)) throw new Error("事项重算必须沿用原起卦区块");
    const payment = prior?.payment ?? await this.options.paymentVerifier.verify(input.payment as QuestionFeeProof);
    if (payment.feeUsdc6 !== "50000" || payment.shares.length !== 3) {
      throw new Error("三座金库付款凭证不完整");
    }
    const block = prior?.block ?? await this.options.blockSource.latest();
    const hexagram = deriveQuestionHexagram({ blockHash: block.hash, question });
    const chart = buildLiuyaoChart({ lines: hexagram.lines, timestamp: block.timestamp, focus: {
      subjectKey: subject.key,
      subjectLabel: subject.label,
      useGod: subject.useGod,
      overridden: subject.overridden,
    } });
    const readings = await Promise.all(QUESTION_DIVINERS.map(async (diviner) => ({
      divinerKey: diviner.key,
      divinerName: diviner.name,
      ...await this.options.interpreter.interpret({
        question,
        divinerKey: diviner.key,
        divinerName: diviner.name,
        hexagram,
        subject,
      }),
    })));
    if (!prior) this.castLedger.set(claimKey, { question, block, payment });
    return {
      track: "question",
      question,
      block: { number: block.number.toString(), hash: block.hash, timestamp: block.timestamp.toString() },
      hexagram,
      subject,
      chart,
      readings,
      responsibilityNotice: QUESTION_RESPONSIBILITY_NOTICE,
      cost: {
        walletRequired: true,
        feeUsdc6: payment.feeUsdc6,
        walletConfirmationCount: payment.walletConfirmationCount,
        transactionCount: payment.transactionHashes.length,
        gasUsdc6: payment.gasUsdc6,
        recipients: 3,
      },
      feeDistribution: payment.shares,
      transactions: payment.transactionHashes,
    };
  }
}
