// tests/helpers/bazi-service.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReadingService } from "../../src/sanyi/reading-service.js";
import { BaziReadingService } from "../../src/sanyi/bazi-reading-service.js";
import { ReadingStore } from "../../src/sanyi/store.js";
import { createSanyiLogger } from "../../src/sanyi/log.js";
import { MockSchoolsProvider, mockSingleFeeReceipt } from "../../src/sanyi/mock-provider.js";
import { createSanyiApi } from "../../src/sanyi/api.js";
import type { StructuredOutputProvider } from "../../src/agent/provider.js";
export const birth = {
  calendar: "solar", isLeapMonth: false, year: 1990, month: 5, day: 15,
  time: { hour: 15, minute: 30 }, gender: "male",
};
export function proof(index = 1) {
  return { payer: `0x${"11".repeat(20)}` as `0x${string}`,
    transactionHash: `0x${index.toString(16).padStart(64, "0")}` as `0x${string}` };
}
export async function baziFixture(
  provider: StructuredOutputProvider = new MockSchoolsProvider(),
  options: { onUnitSettled?: (id: string, unitKey: import("../../src/sanyi/schools/bazi-shared.js").BaziSchoolKey | "summary") => void | Promise<void> } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "sanyi-b5-"));
  const store = new ReadingStore(root);
  const calls = { payments: 0 };
  const clock = () => new Date("2026-10-06T21:00:00+08:00");
  const deps = {
    store, provider, clock, logger: createSanyiLogger(join(root, "log"), clock),
    feeVerifier: { verify: async (value: Parameters<typeof mockSingleFeeReceipt>[0]) => {
      calls.payments += 1;
      return mockSingleFeeReceipt(value);
    } },
    blockSource: { latest: async () => {
      throw new Error("八字不得取摇卦区块");
    } },
  };
  const question = new ReadingService(deps);
  const bazi = new BaziReadingService({ ...deps,
    ...(options.onUnitSettled ? { onUnitSettled: options.onUnitSettled } : {}) });
  const api = createSanyiApi(question, { now: clock, bazi });
  return { root, store, calls, bazi, question, api,
    close: async () => rm(root, { recursive: true, force: true }) };
}
