// src/sanyi/api.ts
import { almanacAt } from "../calendar/almanac.js";
import { QUESTION_SUBJECTS } from "../oracle/question-classifier.js";
import { isAddress, getAddress, type Address } from "viem";
import { ARC_CHAIN_ID, USDC_TOKEN_ADDRESS } from "../frontend/wallet.js";
import { feeRecipientFromEnv, FEE_USDC6, type SanyiFeeProof } from "./fee.js";
import { classifyQuestion } from "./classify.js";
import { NotFoundError, NotOpenYetError, SanyiInputError } from "./http-errors.js";
import type { ReadingService } from "./reading-service.js";
import type { QuestionSchoolKey } from "./schools/index.js";
import type { StoredReading } from "./store.js";
type ServiceBoundary = Pick<
  ReadingService,
  "createQuestionReading" | "throwCoin" | "getReading" | "retrySchool" | "changeSubject"
>;
type SubjectKey = StoredReading["subject"]["finalKey"];
export interface PublicReading extends Omit<StoredReading, "payment" | "schools"> {
  payment: { firstHash: StoredReading["payment"]["transactionHash"] };
  schools: Record<QuestionSchoolKey, Omit<StoredReading["schools"][QuestionSchoolKey], "attempts">>;
}
export interface PaymentConfiguration {
  recipient: Address;
  amountUsdc6: string;
  token: Address;
  chainId: number;
}
export interface SanyiApi {
  payment(): Promise<PaymentConfiguration>;
  now(): Promise<ReturnType<typeof almanacAt>>;
  classify(input: unknown): Promise<ReturnType<typeof classifyQuestion>>;
  createReading(input: unknown): Promise<PublicReading>;
  throwCoin(id: string, input: unknown): Promise<StoredReading["throws"][number]>;
  getReading(id: string): Promise<PublicReading>;
  retrySchool(id: string, key: QuestionSchoolKey): Promise<PublicReading>;
  changeSubject(id: string, input: unknown): Promise<PublicReading>;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SanyiInputError("请求体必须是 JSON 对象");
  }
  return value as Record<string, unknown>;
}
function questionFrom(input: unknown): string {
  const question = record(input).question;
  if (typeof question !== "string") {
    throw new SanyiInputError("问题必须是字符串");
  }
  try {
    return classifyQuestion(question).question;
  } catch (error) {
    throw new SanyiInputError(error instanceof Error ? error.message : "问题无效");
  }
}
function subjectFrom(value: unknown): SubjectKey | undefined {
  if (value === undefined) {
    return undefined;
  }
  const option = QUESTION_SUBJECTS.find((item) => item.key === value);
  if (!option) {
    throw new SanyiInputError("事项类型无效");
  }
  return option.key;
}
function feeProofFrom(value: unknown): SanyiFeeProof {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SanyiInputError("缺少卦金付款凭证");
  }
  const proof = value as Record<string, unknown>;
  if (typeof proof.payer !== "string" || !isAddress(proof.payer)) {
    throw new SanyiInputError("付款人地址无效");
  }
  if (typeof proof.transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/u.test(proof.transactionHash)) {
    throw new SanyiInputError("付款交易哈希无效");
  }
  return { payer: getAddress(proof.payer), transactionHash: proof.transactionHash as `0x${string}` };
}
function publicReading(reading: StoredReading): PublicReading {
  const school = (key: QuestionSchoolKey) => {
    const { attempts: _attempts, ...visible } = reading.schools[key];
    return visible;
  };
  return {
    ...reading,
    payment: { firstHash: reading.payment.transactionHash },
    schools: {
      chengyi: school("chengyi"),
      jingfang: school("jingfang"),
      shaoyong: school("shaoyong"),
    },
  };
}
async function notFound<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NotFoundError();
    }
    throw error;
  }
}
export function createSanyiApi(
  service: ServiceBoundary,
  options: { now?: () => Date; recipient?: Address } = {},
): SanyiApi {
  const clock = options.now ?? (() => new Date());
  let cache: { createdAt: number; value: ReturnType<typeof almanacAt> } | undefined;
  return {
    async payment() {
      return { recipient: options.recipient ?? feeRecipientFromEnv({}), amountUsdc6: FEE_USDC6.toString(),
        token: USDC_TOKEN_ADDRESS, chainId: ARC_CHAIN_ID };
    },
    async now() {
      const milliseconds = clock().getTime();
      if (cache && milliseconds - cache.createdAt < 30_000) {
        return cache.value;
      }
      const value = almanacAt(BigInt(Math.floor(milliseconds / 1_000)));
      cache = { createdAt: milliseconds, value };
      return value;
    },
    async classify(input) {
      return classifyQuestion(questionFrom(input));
    },
    async createReading(input) {
      const body = record(input);
      const classification = classifyQuestion(questionFrom(body));
      if (classification.kind === "destiny" || classification.kind === "fortune") {
        throw new NotOpenYetError("命理与运势将在下一阶段开放，可先改为问事");
      }
      if (classification.kind !== "question") {
        throw new SanyiInputError(classification.suggestion ?? "请改为一件具体的事来问");
      }
      const subjectKey = subjectFrom(body.subjectKey);
      const reading = await service.createQuestionReading({
        question: classification.question,
        feeProof: feeProofFrom(body.feeProof),
        ...(subjectKey === undefined ? {} : { subjectKey }),
      });
      return publicReading(reading);
    },
    async throwCoin(id, input) {
      const index = record(input).index;
      if (typeof index !== "number" || !Number.isInteger(index)) {
        throw new SanyiInputError("掷序必须是整数");
      }
      return notFound(() => service.throwCoin(id, index));
    },
    async getReading(id) {
      return publicReading(await notFound(() => service.getReading(id)));
    },
    async retrySchool(id, key) {
      return publicReading(await notFound(() => service.retrySchool(id, key)));
    },
    async changeSubject(id, input) {
      const subjectKey = subjectFrom(record(input).subjectKey);
      if (!subjectKey) {
        throw new SanyiInputError("缺少事项类型");
      }
      return publicReading(await notFound(() => service.changeSubject(id, subjectKey)));
    },
  };
}
