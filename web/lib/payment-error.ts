import { ApiError, apiErrorMessage } from "./api.js";
import { isMissingBirth } from "./birth-entry.js";
import type { TFunction } from "./i18n.js";

export interface PaymentFailure {
  message: string;
  readingId?: string;
  missingBirth: boolean;
}

export type PaymentFailureKind = "rejected" | "insufficient" | "wrong-chain" | "claim" | "other";

/** 付款钩子对已知阶段加稳定标签，界面文案变化不会影响匿名统计。 */
export class PaymentFlowError extends Error {
  constructor(readonly kind: "insufficient" | "wrong-chain", options?: ErrorOptions) {
    super(kind === "insufficient" ? "余额不足或手续费不足" : "切换 Arc 网络失败", options);
    this.name = "PaymentFlowError";
  }
}

const FORM_VALIDATION_CODES = new Set([
  "birth-required", "birth-invalid", "invalid-input", "invalid-body",
  "invalid-subject", "invalid-question", "invalid-question-kind",
]);

export function isFormValidationFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400
    && Boolean(error.code && FORM_VALIDATION_CODES.has(error.code));
}

function errorChain(error: unknown): Array<Record<string, unknown>> {
  const chain: Array<Record<string, unknown>> = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const item = current as Record<string, unknown>;
    chain.push(item);
    current = item.cause;
  }
  return chain;
}

/** 仅返回固定类别，不包含地址、哈希、金额或错误原文。 */
export function paymentFailureKind(
  error: unknown,
  options: { hasPaymentProof?: boolean } = {},
): PaymentFailureKind {
  if (options.hasPaymentProof) return "claim";
  const chain = errorChain(error);
  const tagged = chain.find((item) => item.name === "PaymentFlowError") as PaymentFlowError | undefined;
  if (tagged?.kind) return tagged.kind;
  if (chain.some((item) => item.name === "UserRejectedRequestError" || item.code === 4001)) {
    return "rejected";
  }
  const names = chain.map((item) => String(item.name ?? "")).join(" ");
  const messages = chain.map((item) => String(item.message ?? "")).join(" ");
  if (/InsufficientFunds|insufficient funds|余额不足|gas required exceeds/iu.test(`${names} ${messages}`)) {
    return "insufficient";
  }
  if (/SwitchChain|switch chain|切换.*网络/iu.test(`${names} ${messages}`)) return "wrong-chain";
  return "other";
}

/** 将付款链路错误整理成当前语言的可显示状态，并保留可恢复的旧卦入口。 */
export function paymentFailure(error: unknown, t: TFunction): PaymentFailure {
  return {
    message: error instanceof ApiError
      ? apiErrorMessage(error, t)
      : error instanceof Error ? error.message : t("errors.paymentNotCharged"),
    ...(error instanceof ApiError && error.status === 409 && error.readingId
      ? { readingId: error.readingId }
      : {}),
    missingBirth: isMissingBirth(error),
  };
}
