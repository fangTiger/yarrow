// src/sanyi/api.ts
import { almanacAt } from "../calendar/almanac.js";
import { QUESTION_SUBJECTS } from "../oracle/question-classifier.js";
import { isAddress, getAddress, type Address } from "viem";
import { ARC_CHAIN_ID, USDC_TOKEN_ADDRESS } from "../frontend/wallet.js";
import { feeRecipientFromEnv, FEE_USDC6, type SanyiFeeProof } from "./fee.js";
import { classifyQuestion } from "./classify.js";
import { NotFoundError, PaymentRequiredError, SanyiInputError, type PaymentRequirements } from "./http-errors.js";
import type { ReadingService } from "./reading-service.js";
import type { QuestionSchoolKey } from "./schools/index.js";
import type { StoredQuestionReading as StoredReading } from "./store.js";
import type { StoredReading as AnyStoredReading } from "./store.js";
import { normalizeBirthProfile } from "./birth-profile.js";
import { overrideClassification, type FortuneHorizon, type QuestionKind } from "./classify.js";
import type { BaziReadingService } from "./bazi-reading-service.js";
import { publicBaziReading, type PublicBaziReading } from "./bazi-public.js";
import type { BaziSchoolKey } from "./schools/bazi-shared.js";
import type { NamingReadingService } from "./naming/service.js";
import { publicNamingReading, type PublicNamingReading } from "./naming/public.js";
import type { NamingFamilyKey } from "./naming/schema.js";
import { isSurname } from "./naming/lexicon.js";
import type { TranslationService } from "./translation/service.js";
import type { StoredTranslation } from "./translation/store.js";
type ServiceBoundary = Pick<
  ReadingService,
  "createQuestionReading" | "continueCasting" | "getReading" | "retrySchool" | "changeSubject" | "retrySummary"
>;
type SubjectKey = StoredReading["subject"]["finalKey"];
export interface PublicQuestionReading extends Omit<
  StoredReading,
  "payment" | "schools" | "summary" | "castProgressAt"
> {
  payment: { firstHash: StoredReading["payment"]["transactionHash"] };
  schools: Record<
    QuestionSchoolKey,
    Omit<StoredReading["schools"][QuestionSchoolKey], "attempts" | "startedAt">
  >;
  summary?: Omit<NonNullable<StoredReading["summary"]>, "startedAt">;
}
export type PublicReading = PublicQuestionReading | PublicBaziReading | PublicNamingReading;
export type PublicReadingResponse = PublicReading & { translation?: StoredTranslation };
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
  getReading(id: string, lang?: string): Promise<PublicReadingResponse>;
  /** 免费触发英文翻译；实际生成在后台继续。 */
  translateReading(id: string, input: unknown): Promise<StoredTranslation>;
  retrySchool(id: string, key: QuestionSchoolKey | BaziSchoolKey | NamingFamilyKey): Promise<PublicReading>;
  changeSubject(id: string, input: unknown): Promise<PublicReading>;
  changeDayBoundary(id: string, input: unknown): Promise<PublicReading>;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SanyiInputError("请求体必须是 JSON 对象", "invalid-body");
  }
  return value as Record<string, unknown>;
}
function questionFrom(input: unknown): string {
  const question = record(input).question;
  if (typeof question !== "string") {
    throw new SanyiInputError("问题必须是字符串", "invalid-question");
  }
  try {
    return classifyQuestion(question).question;
  } catch (error) {
    throw new SanyiInputError(error instanceof Error ? error.message : "问题无效", "invalid-question");
  }
}
function subjectFrom(value: unknown): SubjectKey | undefined {
  if (value === undefined) {
    return undefined;
  }
  const option = QUESTION_SUBJECTS.find((item) => item.key === value);
  if (!option) {
    throw new SanyiInputError("事项类型无效", "invalid-subject");
  }
  return option.key;
}
function feeProofFrom(value: unknown, requirements: PaymentRequirements): SanyiFeeProof {
  // 完全没带付款凭证：请求其余部分已校验通过，以 402 告知价格与收款方；带了但格式不对仍是 400。
  if (value === undefined || value === null) {
    throw new PaymentRequiredError(requirements);
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new SanyiInputError("缺少卦金付款凭证", "payment-proof-required");
  }
  const proof = value as Record<string, unknown>;
  if (typeof proof.payer !== "string" || !isAddress(proof.payer)) {
    throw new SanyiInputError("付款人地址无效", "payment-proof-invalid");
  }
  if (typeof proof.transactionHash !== "string" || !/^0x[0-9a-fA-F]{64}$/u.test(proof.transactionHash)) {
    throw new SanyiInputError("付款交易哈希无效", "payment-proof-invalid");
  }
  return { payer: getAddress(proof.payer), transactionHash: proof.transactionHash as `0x${string}` };
}
function publicReading(reading: StoredReading): PublicQuestionReading {
  const school = (key: QuestionSchoolKey) => {
    const { attempts: _attempts, startedAt: _startedAt, ...visible } = reading.schools[key];
    return visible;
  };
  const {
    castProgressAt: _castProgressAt,
    summary,
    ...visibleReading
  } = reading;
  const visibleSummary = summary ? (() => {
    const { startedAt: _startedAt, ...visible } = summary;
    return visible;
  })() : undefined;
  return {
    ...visibleReading,
    payment: { firstHash: reading.payment.transactionHash },
    schools: {
      chengyi: school("chengyi"),
      jingfang: school("jingfang"),
      shaoyong: school("shaoyong"),
    },
    ...(visibleSummary ? { summary: visibleSummary } : {}),
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
  options: {
    now?: () => Date;
    recipient?: Address;
    /** 收费所在链；缺省测试网。 */
    chainId?: number;
    bazi?: BaziReadingService;
    naming?: NamingReadingService;
    translation?: Pick<TranslationService, "trigger" | "read">;
  } = {},
): SanyiApi {
  const clock = options.now ?? (() => new Date());
  let cache: { createdAt: number; value: ReturnType<typeof almanacAt> } | undefined;
  const paymentRequirements = (): PaymentRequirements => ({
    recipient: options.recipient ?? feeRecipientFromEnv({}), amountUsdc6: FEE_USDC6.toString(),
    token: USDC_TOKEN_ADDRESS, chainId: options.chainId ?? ARC_CHAIN_ID,
  });
  return {
    async payment() {
      return paymentRequirements();
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
      const createNaming = async (suggestedTarget?: "person" | "business") => {
        if (!options.naming) throw new Error("起名服务尚未配置");
        if (typeof body.question !== "string") throw new SanyiInputError("起名期望必须是字符串");
        const question = body.question.trim().replace(/\s+/gu, " ");
        if ([...question].length > 280) throw new SanyiInputError("起名期望须为 0–280 个字符");
        const target = body.target ?? suggestedTarget;
        if (target !== "person" && target !== "business") throw new SanyiInputError("起名对象无效");
        if (body.gender !== "male" && body.gender !== "female" && body.gender !== "any") {
          throw new SanyiInputError("性别无效");
        }
        if (typeof body.unborn !== "boolean") throw new SanyiInputError("未出生标记无效");
        if (target === "person") {
          if (typeof body.surname !== "string" || !body.surname) {
            throw new SanyiInputError("请先填写姓氏");
          }
          if (!isSurname(body.surname)) throw new SanyiInputError("这个姓暂不支持，请联系我们");
          if (body.length !== 1 && body.length !== 2) {
            throw new SanyiInputError("人名须选择单名或双名");
          }
          if (body.birth === undefined || body.birth === null) {
            throw new SanyiInputError("请先填写生辰", "birth-required");
          }
        } else {
          if (body.length !== 2 && body.length !== 3 && body.length !== 4) {
            throw new SanyiInputError("商号字数须为 2–4 字");
          }
          if ([...question].length < 2) {
            throw new SanyiInputError("商号行业与期望至少填写 2 个字符");
          }
          if (body.unborn) throw new SanyiInputError("商号不支持未出生标记");
        }
        if (body.birth !== undefined && body.birth !== null) {
          try {
            normalizeBirthProfile(body.birth);
          } catch {
            throw new SanyiInputError("生辰格式无效，请检查填写内容", "birth-invalid");
          }
        }
        const length = body.length as 1 | 2 | 3 | 4;
        const gender = body.gender as "male" | "female" | "any";
        return publicNamingReading(await options.naming.create({
          target,
          question,
          ...(target === "person" ? { surname: body.surname as string } : {}),
          gender,
          length,
          unborn: body.unborn,
          ...(body.birth === undefined || body.birth === null ? {} : { birth: body.birth }),
          feeProof: feeProofFrom(body.feeProof, paymentRequirements()),
        }));
      };
      if (body.kind === "naming") return createNaming();
      let classification = classifyQuestion(questionFrom(body));
      try {
        classification = overrideClassification(classification, {
          ...(body.kind === undefined ? {} : { kind: body.kind as QuestionKind }),
          ...(body.horizon === undefined ? {} : { horizon: body.horizon as FortuneHorizon }),
        });
      } catch {
        throw new SanyiInputError("问题类型或时间范围无效", "invalid-question-kind");
      }
      if (classification.kind === "naming") return createNaming(classification.target);
      if (classification.kind === "destiny" || classification.kind === "fortune") {
        if (body.birth === undefined || body.birth === null) {
          throw new SanyiInputError("请先填写生辰", "birth-required");
        }
        try {
          normalizeBirthProfile(body.birth);
        } catch {
          throw new SanyiInputError("生辰格式无效，请检查填写内容", "birth-invalid");
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
          horizon: classification.horizon ?? "year", feeProof: feeProofFrom(body.feeProof, paymentRequirements()) }));
      }
      if (classification.kind !== "question") {
        throw new SanyiInputError(classification.suggestion ?? "请改为一件具体的事来问");
      }
      const subjectKey = subjectFrom(body.subjectKey);
      const reading = await service.createQuestionReading({
        question: classification.question,
        ...(body.kind === "question" ? { kind: "question" as const } : {}),
        feeProof: feeProofFrom(body.feeProof, paymentRequirements()),
        ...(subjectKey === undefined ? {} : { subjectKey }),
      });
      return publicReading(reading);
    },
    async continueCasting(id) {
      return publicReading(await notFound(() => service.continueCasting(id)));
    },
    async retrySummary(id) {
      const reading = await notFound(async (): Promise<AnyStoredReading> => {
        if (options.naming) return options.naming.readAny(id);
        return options.bazi ? options.bazi.readAny(id) : service.getReading(id);
      });
      if (reading.kind === "question") {
        return publicReading(await notFound(() => service.retrySummary(id)));
      }
      if (reading.kind === "naming") {
        if (!options.naming) throw new SanyiInputError("起名服务尚未配置");
        return publicNamingReading(await notFound(() => options.naming!.retrySummary(id)));
      }
      if (!options.bazi) throw new SanyiInputError("八字服务尚未配置");
      const bazi = options.bazi;
      return publicBaziReading(await notFound(() => bazi.retrySummary(id)));
    },
    async getReading(id, lang) {
      const reading = await notFound(async (): Promise<AnyStoredReading> => {
        if (options.naming) return options.naming.readAny(id);
        if (options.bazi) {
          // 共用 store 读取判别，问事仍走原服务，不重新排盘或调用模型。
          return options.bazi.readAny(id);
        }
        return service.getReading(id);
      });
      const visible = reading.kind === "question"
        ? publicReading(reading)
        : reading.kind === "naming" ? publicNamingReading(reading) : publicBaziReading(reading);
      if (lang !== "en" || !options.translation) return visible;
      const translation = await options.translation.read(id);
      return translation ? { ...visible, translation } : visible;
    },
    async translateReading(id, input) {
      const body = record(input);
      if (body.lang !== "en") {
        throw new SanyiInputError("目前只支持英文翻译", "invalid-language");
      }
      if (!options.translation) throw new Error("翻译服务尚未配置");
      return notFound(() => options.translation!.trigger(id));
    },
    async retrySchool(id, key) {
      if (key === "wuxing" || key === "shiwen" || key === "yinyi") {
        if (!options.naming) throw new SanyiInputError("起名服务尚未配置");
        return publicNamingReading(await notFound(() => options.naming!.retryFamily(id, key)));
      }
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
        throw new SanyiInputError("请先填写生辰", "birth-required");
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
