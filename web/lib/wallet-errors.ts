import { I18nError, type TFunction, zhT } from "./i18n.js";
import { ApiError, apiErrorMessage } from "./api.js";

export function walletErrorMessage(error: unknown, t: TFunction = zhT): string {
  if (error instanceof I18nError) return t(error.key, error.params);
  if (error instanceof ApiError) return apiErrorMessage(error, t);
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  let rejected = false;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "string") {
      messages.push(current);
      break;
    }
    if (typeof current !== "object") {
      break;
    }
    const value = current as { name?: string; code?: number; message?: string; cause?: unknown };
    rejected ||= value.name === "UserRejectedRequestError" || value.code === 4001;
    if (value.message) {
      messages.push(value.message);
    }
    current = value.cause;
  }
  const reason = messages.join(" · ").replace(/\s+/gu, " ");
  if (rejected || /rejected|denied/iu.test(reason)) {
    return t("errors.paymentCancelled");
  }
  if (/insufficient|余额不足/iu.test(reason)) {
    return t("errors.walletBalance");
  }
  if (/chain|network mismatch|wrong network|网络不符|切换.*网络|切换.*Arc/iu.test(reason)) {
    return t("errors.walletNetwork");
  }
  const detail = reason.length > 100 ? `${reason.slice(0, 100)}…` : reason;
  if (t !== zhT) return t("errors.paymentGeneric");
  return detail ? t("errors.paymentReason", { reason: detail }) : t("errors.paymentGeneric");
}
