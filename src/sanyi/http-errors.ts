// src/sanyi/http-errors.ts
import {
  LimitExceededError,
  PaymentAlreadyUsedError,
  StateConflictError,
} from "./reading-service.js";
import { ArcUnavailableError } from "./throws.js";
class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = new.target.name;
  }
}
export class SanyiInputError extends HttpError {
  constructor(message: string) { super(message, 400); }
}
export class NotFoundError extends HttpError {
  constructor(message = "未找到解读") { super(message, 404); }
}
export class NotOpenYetError extends HttpError {
  constructor(message: string) { super(message, 501); }
}
export class UnsupportedMediaType extends HttpError {
  constructor(message = "写接口只接受 application/json") { super(message, 415); }
}
export class ForbiddenOrigin extends HttpError {
  constructor(message = "拒绝跨源操作") { super(message, 403); }
}
export class PayloadTooLarge extends HttpError {
  constructor(message = "请求体超过 8 KiB 限制") { super(message, 413); }
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
  if (error instanceof ArcUnavailableError) {
    return 503;
  }
  return 500;
}
