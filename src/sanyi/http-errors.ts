// src/sanyi/http-errors.ts
import { FeePaymentError } from "./fee.js";
import {
  LimitExceededError,
  PaymentAlreadyUsedError,
  StateConflictError,
} from "./reading-service.js";
import { ArcUnavailableError } from "./throws.js";
import { TranslationHttpError } from "./translation/service.js";
class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class SanyiInputError extends HttpError {
  constructor(message: string, code = "invalid-input") { super(message, 400, code); }
}
/** 付款要求：与 GET /api/payment 相同，供 agent 从 402 响应中发现价格与收款方。 */
export interface PaymentRequirements {
  recipient: `0x${string}`;
  amountUsdc6: string;
  token: `0x${string}`;
  chainId: number;
}
/** 请求其余字段均有效、仅缺付款凭证：HTTP 402，响应体附付款要求；错误码沿用前端已有的映射。 */
export class PaymentRequiredError extends HttpError {
  constructor(readonly payment: PaymentRequirements,
    message = "需要先在 Arc 上支付卦金，再附上付款凭证重新提交") {
    super(message, 402, "payment-proof-required");
  }
}
export class NotFoundError extends HttpError {
  constructor(message = "未找到解读") { super(message, 404, "reading-not-found"); }
}
export class NotOpenYetError extends HttpError {
  constructor(message: string) { super(message, 501, "feature-not-open"); }
}
export class UnsupportedMediaType extends HttpError {
  constructor(message = "写接口只接受 application/json") {
    super(message, 415, "unsupported-media-type");
  }
}
export class ForbiddenOrigin extends HttpError {
  constructor(message = "拒绝跨源操作") { super(message, 403, "invalid-origin"); }
}
export class PayloadTooLarge extends HttpError {
  constructor(message = "请求体超过 8 KiB 限制") { super(message, 413, "payload-too-large"); }
}
export function statusForError(error: unknown): number {
  if (
    error instanceof SanyiInputError
    || error instanceof NotFoundError
    || error instanceof NotOpenYetError
    || error instanceof UnsupportedMediaType
    || error instanceof ForbiddenOrigin
    || error instanceof PayloadTooLarge
    || error instanceof PaymentRequiredError
    || error instanceof TranslationHttpError
  ) {
    return error.status;
  }
  if (
    error instanceof PaymentAlreadyUsedError
    || error instanceof LimitExceededError
    || error instanceof StateConflictError
  ) {
    return 409;
  }
  if (error instanceof FeePaymentError) {
    return 400;
  }
  if (error instanceof ArcUnavailableError) {
    return 503;
  }
  return 500;
}

/** 给浏览器的稳定错误码；消息保留中文供旧客户端显示。 */
export function errorCodeForError(error: unknown): string | undefined {
  if (error instanceof HttpError) return error.code;
  if (error instanceof TranslationHttpError) return error.code;
  if (error instanceof PaymentAlreadyUsedError) return "payment-already-used";
  if (error instanceof FeePaymentError) return "payment-invalid";
  return undefined;
}
