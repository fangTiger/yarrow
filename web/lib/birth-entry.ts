// web/lib/birth-entry.ts
import { ApiError } from "./api.js";
export function isMissingBirth(error: unknown): boolean {
    return error instanceof ApiError && error.status === 400 && error.message === "请先填写生辰";
}
/** 分类返回的时间范围直接作为首页时间范围标签的值，缺省为今年。 */
export function entryHorizon(horizon?: string): string {
    return horizon ?? "year";
}
