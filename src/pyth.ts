export interface PythFreshness {
  fresh: boolean;
  ageSeconds: bigint;
}

export function classifyPythFreshness(
  blockTimestamp: bigint,
  publishTime: bigint,
  validTimePeriod: bigint,
): PythFreshness {
  const isFutureTimestamp = publishTime > blockTimestamp;
  const ageSeconds = isFutureTimestamp ? 0n : blockTimestamp - publishTime;
  return { fresh: publishTime > 0n && !isFutureTimestamp && ageSeconds <= validTimePeriod, ageSeconds };
}
