import type { Hex } from "viem";

export type Coin = 0 | 1;

export interface ThrowResult {
  index: number;
  coins: readonly [Coin, Coin, Coin];
  backs: number;
  value: number;
  name: "交" | "单" | "拆" | "重";
  moving: boolean;
}

/** 取哈希最低三位为三枚铜钱；1 为背，背数加六即爻值。 */
export function throwFromHash(hash: Hex, index: number): ThrowResult {
  if (!Number.isInteger(index) || index < 1 || index > 6) {
    throw new Error("掷序必须为 1–6");
  }
  const bits = Number(BigInt(hash) & 7n);
  const coins: [Coin, Coin, Coin] = [
    (bits & 1) as Coin,
    ((bits >> 1) & 1) as Coin,
    ((bits >> 2) & 1) as Coin,
  ];
  const backs = coins.reduce<number>((sum, coin) => sum + coin, 0);
  const value = 6 + backs;
  const names: readonly ThrowResult["name"][] = ["交", "单", "拆", "重"];
  const name = names[backs];
  if (!name) throw new Error("铜钱背面数量无效");
  return { index, coins, backs, value, name, moving: value === 6 || value === 9 };
}
