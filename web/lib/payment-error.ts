import { ApiError, apiErrorMessage } from "./api.js";
import { isMissingBirth } from "./birth-entry.js";
import type { TFunction } from "./i18n.js";

export interface PaymentFailure {
  message: string;
  readingId?: string;
  missingBirth: boolean;
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
