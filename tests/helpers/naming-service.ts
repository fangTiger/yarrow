import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StructuredOutputProvider } from "../../src/agent/provider.js";
import { createSanyiLogger } from "../../src/sanyi/log.js";
import { MockSchoolsProvider, mockSingleFeeReceipt } from "../../src/sanyi/mock-provider.js";
import { NamingReadingService } from "../../src/sanyi/naming/service.js";
import { ReadingStore } from "../../src/sanyi/store.js";

export const namingBirth = {
  calendar: "solar", isLeapMonth: false, year: 1990, month: 5, day: 15,
  time: { hour: 15, minute: 30 }, gender: "female",
};

export function namingProof(index = 1) {
  return {
    payer: `0x${"11".repeat(20)}` as `0x${string}`,
    transactionHash: `0x${index.toString(16).padStart(64, "0")}` as `0x${string}`,
  };
}

export async function namingFixture(
  provider: StructuredOutputProvider = new MockSchoolsProvider(),
  options: { onUnitSettled?: (id: string, unitKey: import("../../src/sanyi/naming/schema.js").NamingFamilyKey | "summary") => void | Promise<void> } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "sanyi-naming-"));
  const store = new ReadingStore(root);
  const calls = { payments: 0 };
  const clock = () => new Date("2026-10-09T21:00:00+08:00");
  const naming = new NamingReadingService({
    store,
    provider,
    clock,
    logger: createSanyiLogger(join(root, "log"), clock),
    feeVerifier: {
      verify: async (value: Parameters<typeof mockSingleFeeReceipt>[0]) => {
        calls.payments += 1;
        return mockSingleFeeReceipt(value);
      },
    },
    ...(options.onUnitSettled ? { onUnitSettled: options.onUnitSettled } : {}),
  });
  return {
    root, store, calls, clock, naming,
    close: async () => rm(root, { recursive: true, force: true }),
  };
}
