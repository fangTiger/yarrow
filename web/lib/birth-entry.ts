// web/lib/birth-entry.ts
import { ApiError } from "./api.js";
import type { BirthProfileInput } from "./birth-profile.js";
export function needsBirth(kind: string, birth: BirthProfileInput | null): boolean {
    return (kind === "destiny" || kind === "fortune") && birth === null;
}
export function isMissingBirth(error: unknown): boolean {
    return error instanceof ApiError && error.status === 400 && error.message === "请先填写生辰";
}
export function entryHorizon(horizon?: string): string {
    const value = horizon ?? "year";
    return value.startsWith("year:") ? "custom" : value;
}
