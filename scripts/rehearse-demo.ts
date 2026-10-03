// scripts/rehearse-demo.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mockQuestionFeeReceipt } from "../src/oracle/fee-payment.js";
import type { QuestionFeeProof } from "../src/oracle/fee-payment.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { createSanyiLogger } from "../src/sanyi/log.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { ReadingService } from "../src/sanyi/reading-service.js";
import { ReadingStore } from "../src/sanyi/store.js";
const SCHOOL_NAMES = { chengyi: "程颐", jingfang: "京房", shaoyong: "邵雍" } as const;
export interface RehearsalSummary {
  status: "done";
  primary: string;
  derived: string;
  lines: readonly number[];
  schools: ReadonlyArray<{
    name: string;
    status: "done";
    verdict: string;
    confidenceTenths: number;
  }>;
  consensusTenths: number;
}
export async function runRehearsal(): Promise<RehearsalSummary> {
  const root = await mkdtemp(join(tmpdir(), "sanyi-rehearsal-"));
  let height = 0n;
  try {
    const proof: QuestionFeeProof = {
      payer: `0x${"11".repeat(20)}`,
      bundleId: "rehearsal",
      transactionHashes: [`0x${"22".repeat(32)}`],
    };
    const service = new ReadingService({
      feeVerifier: { verify: async (value) => mockQuestionFeeReceipt(value) },
      blockSource: {
        latest: async () => {
          height += 1n;
          return {
            number: height,
            hash: `0x${height.toString(16).padStart(64, "0")}`,
            timestamp: 1_790_770_500n + height,
          };
        },
      },
      provider: new MockSchoolsProvider(),
      store: new ReadingStore(root),
      logger: createSanyiLogger(join(root, "log")),
      waitOptions: { pollMs: 1, timeoutMs: 100, sleep: async () => {} },
    });
    const created = await service.createQuestionReading({
      question: "这次面试能过吗",
      feeProof: proof,
    });
    for (let index = 1; index <= 6; index += 1) {
      await service.throwCoin(created.id, index);
    }
    await service.whenSettled(created.id);
    const reading = await service.getReading(created.id);
    if (reading.status !== "done" || !reading.lines || !reading.chart) {
      throw new Error(`排练未完成：${reading.status}`);
    }
    const five = deriveFiveHexagrams(reading.lines);
    const keys = ["chengyi", "jingfang", "shaoyong"] as const;
    const schools = keys.map((key) => {
      const state = reading.schools[key];
      if (state.status !== "done" || !state.output) {
        throw new Error(`${SCHOOL_NAMES[key]}未完成：${state.status}`);
      }
      return {
        name: SCHOOL_NAMES[key],
        status: "done" as const,
        verdict: state.output.verdict,
        confidenceTenths: state.output.confidenceTenths,
      };
    });
    return {
      status: "done",
      primary: five.primary.name,
      derived: five.derived.name,
      lines: reading.lines,
      schools,
      consensusTenths: schools.reduce((sum, item) => sum + item.confidenceTenths, 0) / 3,
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv.find((item) => item.startsWith("--mode="))?.slice(7) ?? "mock";
  if (mode !== "mock") {
    throw new Error("排练只支持 --mode=mock");
  }
  try {
    const summary = await runRehearsal();
    console.log(`本卦：${summary.primary}；之卦：${summary.derived}`);
    for (const school of summary.schools) {
      console.log(`${school.name}：${school.verdict}，${school.confidenceTenths}成`);
    }
    console.log(`合议平均：约${summary.consensusTenths.toFixed(1)}成`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
