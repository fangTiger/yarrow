import { isAddress, isHex, type Address, type Hex } from "viem";

export interface DecodedPredicateConfig {
  resolver: Address;
  schemaHash: Hex;
  querentControllable: boolean;
  tier: number;
  enabled: boolean;
}

/** viem 对 Solidity 单个 struct 输出返回命名对象，而不是可迭代元组。 */
export function decodePredicateConfig(value: unknown): DecodedPredicateConfig {
  if (!value || typeof value !== "object") throw new Error("谓词配置返回值不是对象");
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.resolver !== "string" || !isAddress(candidate.resolver)
    || typeof candidate.schemaHash !== "string" || !isHex(candidate.schemaHash) || candidate.schemaHash.length !== 66
    || typeof candidate.querentControllable !== "boolean"
    || typeof candidate.tier !== "number" || !Number.isSafeInteger(candidate.tier)
    || typeof candidate.enabled !== "boolean"
  ) {
    throw new Error("谓词配置字段不完整或类型无效");
  }
  return candidate as unknown as DecodedPredicateConfig;
}
