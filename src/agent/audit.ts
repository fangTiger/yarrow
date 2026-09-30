import { keccak256, stringToHex, type Hex } from "viem";

function normalize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("规范 JSON 不接受非有限数值");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(normalize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record).sort().map((key) => {
      const item = record[key];
      if (item === undefined) throw new Error(`规范 JSON 不接受 undefined：${key}`);
      return `${JSON.stringify(key)}:${normalize(item)}`;
    });
    return `{${entries.join(",")}}`;
  }
  throw new Error(`规范 JSON 不支持 ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return normalize(value);
}

export function hashText(value: string): Hex {
  return keccak256(stringToHex(value));
}

export function hashJson(value: unknown): Hex {
  return hashText(canonicalJson(value));
}
