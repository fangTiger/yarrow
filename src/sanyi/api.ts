// src/sanyi/api.ts
import { almanacAt } from "../calendar/almanac.js";
import { QUESTION_SUBJECTS } from "../oracle/question-classifier.js";
import { isAddress, getAddress, type Address } from "viem";
import { ARC_CHAIN_ID, USDC_TOKEN_ADDRESS } from "../frontend/wallet.js";
import { feeRecipientFromEnv, FEE_USDC6, type SanyiFeeProof } from "./fee.js";
import { classifyQuestion } from "./classify.js";
import { NotFoundError, SanyiInputError } from "./http-errors.js";
import type { ReadingService } from "./reading-service.js";
import type { QuestionSchoolKey } from "./schools/index.js";
import type { StoredQuestionReading as StoredReading } from "./store.js";
import type { StoredReading as AnyStoredReading } from "./store.js";
import { normalizeBirthProfile } from "./birth-profile.js";
import { overrideClassification, type FortuneHorizon, type QuestionKind } from "./classify.js";
import type { BaziReadingService } from "./bazi-reading-service.js";
import { publicBaziReading, type PublicBaziReading } from "./bazi-public.js";
import type { BaziSchoolKey } from "./schools/bazi-shared.js";
type ServiceBoundary = Pick<
  ReadingService,
  "createQuestionReading" | "continueCasting" | "getReading" | "retrySchool" | "changeSubject" | "retrySummary"
>;
type SubjectKey = StoredReading["subject"]["finalKey"];
export interface PublicQuestionReading extends Omit<StoredReading, "payment" | "schools"> {
  payment: { firstHash: StoredReading["payment"]["transactionHash"] };
  schools: Record<QuestionSchoolKey, Omit<StoredReading["schools"][QuestionSchoolKey], "attempts">>;
}
export type PublicReading = PublicQuestionReading | PublicBaziReading;
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
  /** 起卦因 Arc 网络暂停后继续；六掷本身由服务端在付款后自动完成。 */
  continueCasting(id: string): Promise<PublicReading>;
  /** 白话总述暂未生成时免费重试。 */
  retrySummary(id: string): Promise<PublicReading>;
  getReading(id: string): Promise<PublicReading>;
  retrySchool(id: string, key: QuestionSchoolKey | BaziSchoolKey): Promise<PublicReading>;
  changeSubject(id: string, input: unknown): Promise<PublicReading>;
  changeDayBoundary(id: string, input: unknown): Promise<PublicReading>;
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
function publicReading(reading: StoredReading): PublicQuestionReading {
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
  options: { now?: () => Date; recipient?: Address; bazi?: BaziReadingService } = {},
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
      let classification = classifyQuestion(questionFrom(body));
      try {
        classification = overrideClassification(classification, {
          ...(body.kind === undefined ? {} : { kind: body.kind as QuestionKind }),
          ...(body.horizon === undefined ? {} : { horizon: body.horizon as FortuneHorizon }),
        });
      } catch {
        throw new SanyiInputError("问题类型或时间范围无效");
      }
      if (classification.kind === "destiny" || classification.kind === "fortune") {
        if (body.birth === undefined || body.birth === null) {
          throw new SanyiInputError("请先填写生辰");
        }
        try {
          normalizeBirthProfile(body.birth);
        } catch {
          throw new SanyiInputError("生辰格式无效，请检查填写内容");
        }
        const sect = body.sect ?? 1;
        if (sect !== 1 && sect !== 2) {
          throw new SanyiInputError("换日口径须为 1 或 2");
        }
        if (!options.bazi) {
          throw new Error("八字服务尚未配置");
        }
        return publicBaziReading(await options.bazi.create({ kind: classification.kind,
          question: classification.question, birth: body.birth, sect,
          horizon: classification.horizon ?? "year", feeProof: feeProofFrom(body.feeProof) }));
      }
      if (classification.kind !== "question") {
        throw new SanyiInputError(classification.suggestion ?? "请改为一件具体的事来问");
      }
      const subjectKey = subjectFrom(body.subjectKey);
      const reading = await service.createQuestionReading({
        question: classification.question,
        ...(body.kind === "question" ? { kind: "question" as const } : {}),
        feeProof: feeProofFrom(body.feeProof),
        ...(subjectKey === undefined ? {} : { subjectKey }),
      });
      return publicReading(reading);
    },
    async continueCasting(id) {
      return publicReading(await notFound(() => service.continueCasting(id)));
    },
    async retrySummary(id) {
      const reading = await notFound(async (): Promise<AnyStoredReading> => {
        return options.bazi ? options.bazi.readAny(id) : service.getReading(id);
      });
      if (reading.kind === "question" || !options.bazi) {
        return publicReading(await notFound(() => service.retrySummary(id)));
      }
      const bazi = options.bazi;
      return publicBaziReading(await notFound(() => bazi.retrySummary(id)));
    },
    async getReading(id) {
      const reading = await notFound(async (): Promise<AnyStoredReading> => {
        if (options.bazi) {
          // 共用 store 读取判别，问事仍走原服务，不重新排盘或调用模型。
          return options.bazi.readAny(id);
        }
        return service.getReading(id);
      });
      return reading.kind === "question" ? publicReading(reading) : publicBaziReading(reading);
    },
    async retrySchool(id, key) {
      if (key === "shenxiaozhan" || key === "yuchuntai" || key === "rentieqiao") {
        if (!options.bazi) {
          throw new SanyiInputError("八字服务尚未配置");
        }
        return publicBaziReading(await notFound(() => options.bazi!.retrySchool(id, key)));
      }
      return publicReading(await notFound(() => service.retrySchool(id, key)));
    },
    async changeDayBoundary(id, input) {
      const body = record(input);
      if (body.birth === undefined || body.birth === null) {
        throw new SanyiInputError("请先填写生辰");
      }
      if (body.sect !== 1 && body.sect !== 2) {
        throw new SanyiInputError("换日口径须为 1 或 2");
      }
      if (!options.bazi) {
        throw new SanyiInputError("八字服务尚未配置");
      }
      const changed = await notFound(() => {
        return options.bazi!.changeDayBoundary(id, body.birth, body.sect as 1 | 2);
      });
      return publicBaziReading(changed);
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
