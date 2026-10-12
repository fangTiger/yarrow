// src/sanyi/http-errors.ts
import { FeePaymentError } from "./fee.js";
import {
  LimitExceededError,
  PaymentAlreadyUsedError,
  StateConflictError,
} from "./reading-service.js";
import { ArcUnavailableError } from "./throws.js";
class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class SanyiInputError extends HttpError {
  constructor(message: string, code = "invalid-input") { super(message, 400, code); }
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
  if (error instanceof PaymentAlreadyUsedError) return "payment-already-used";
  if (error instanceof FeePaymentError) return "payment-invalid";
  return undefined;
}
