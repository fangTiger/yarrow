import type { Hex } from "viem";

const ZERO_HASH = `0x${"00".repeat(32)}`;

export interface HistoryWindowResult {
  maxCheckedDistance: number;
  maxValidDistance: number | null;
  firstInvalidDistance: number | null;
}

function isNonZeroHash(hash: Hex): boolean {
  return hash.toLowerCase() !== ZERO_HASH;
}

export async function findMaxHistoryDistance(
  maxDistance: number,
  readHash: (distance: number) => Promise<Hex>,
): Promise<HistoryWindowResult> {
  if (!Number.isSafeInteger(maxDistance) || maxDistance < 1) {
    throw new Error("最大探测距离必须是正整数");
  }

  if (isNonZeroHash(await readHash(maxDistance))) {
    return { maxCheckedDistance: maxDistance, maxValidDistance: maxDistance, firstInvalidDistance: null };
  }
  if (!isNonZeroHash(await readHash(1))) {
    return { maxCheckedDistance: maxDistance, maxValidDistance: null, firstInvalidDistance: 1 };
  }

  let low = 1;
  let high = maxDistance - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (isNonZeroHash(await readHash(middle))) low = middle;
    else high = middle - 1;
  }

  return { maxCheckedDistance: maxDistance, maxValidDistance: low, firstInvalidDistance: low + 1 };
}

