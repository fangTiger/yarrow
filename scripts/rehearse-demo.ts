// scripts/rehearse-demo.ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { BaziReadingService } from "../src/sanyi/bazi-reading-service.js";
import { publicBaziReading } from "../src/sanyi/bazi-public.js";
import type { SanyiFeeProof } from "../src/sanyi/fee.js";
import { deriveFiveHexagrams } from "../src/oracle/liuyao-chart.js";
import { createSanyiLogger } from "../src/sanyi/log.js";
import { MockSchoolsProvider, mockSingleFeeReceipt } from "../src/sanyi/mock-provider.js";
import { ReadingService } from "../src/sanyi/reading-service.js";
import { ReadingStore } from "../src/sanyi/store.js";
import { NamingReadingService } from "../src/sanyi/naming/service.js";
import { publicNamingReading } from "../src/sanyi/naming/public.js";
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
  /** 问事与运势两卦的白话总述结论。 */
  conclusions: { question: string; fortune: string };
  /** 两卦解法的步骤数。 */
  remedies: { question: number; fortune: number };
  payments: number;
  bazi: {
    pillars: (string | null)[];
    window: number[];
    schools: string[];
    years: number;
    sectAfterSwitch: number;
    changes: number;
  };
  naming: { person: string[]; business: string[] };
}
export async function runRehearsal(): Promise<RehearsalSummary> {
  const root = await mkdtemp(join(tmpdir(), "sanyi-rehearsal-"));
  let height = 0n;
  let payments = 0;
  try {
    const proof: SanyiFeeProof = {
      payer: `0x${"11".repeat(20)}`,
      transactionHash: `0x${"22".repeat(32)}`,
    };
    const store = new ReadingStore(root);
    const clock = () => new Date("2026-10-09T21:00:00+08:00");
    const logger = createSanyiLogger(join(root, "log"), clock);
    const provider = new MockSchoolsProvider();
    const feeVerifier = { verify: async (value: SanyiFeeProof) => {
      payments += 1;
      return mockSingleFeeReceipt(value);
    } };
    const service = new ReadingService({
      feeVerifier,
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
      provider,
      store,
      logger,
      waitOptions: { pollMs: 1, timeoutMs: 100, sleep: async () => {} },
    });
    const created = await service.createQuestionReading({
      question: "这次面试能过吗",
      feeProof: proof,
    });
    // 付款后服务端自动连掷六次，排练只等后台起卦、排盘与三家落笔完成。
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
    const baziService = new BaziReadingService({ store, provider, logger, feeVerifier,
      clock: () => new Date("2026-10-06T21:00:00+08:00") });
    const birth = { calendar: "solar", isLeapMonth: false, year: 1990, month: 5, day: 15,
      time: { hour: 15, minute: 30 }, gender: "male" };
    const fortune = await baziService.create({ kind: "fortune", question: "我今年运势如何",
      birth, sect: 1, horizon: "year", feeProof: { ...proof, transactionHash: `0x${"44".repeat(32)}` } });
    await baziService.whenSettled(fortune.id);
    const before = await baziService.getReading(fortune.id);
    const pillars = Object.values(before.chart.pillars).map((pillar) => pillar?.ganZhi ?? null);
    const window = [before.chart.liunian.years[0]!.year, before.chart.liunian.years.at(-1)!.year];
    assert.deepEqual(pillars, ["庚午", "辛巳", "庚辰", "癸未"]);
    assert.deepEqual(window, [2023, 2032]);
    assert.ok(Object.values(before.schools).every((state) => state.status === "done"));
    const publicBefore = publicBaziReading(before);
    assert.equal(publicBefore.kind, "fortune");
    if (publicBefore.kind !== "fortune") {
      throw new Error("排练类型不符");
    }
    assert.equal(publicBefore.years.length, 10);
    const paymentsBeforeSwitch = payments;
    await baziService.changeDayBoundary(fortune.id, birth, 2);
    await baziService.whenSettled(fortune.id);
    const after = await baziService.getReading(fortune.id);
    assert.equal(after.chart.sect, 2);
    assert.equal(after.changes, 1);
    assert.ok(Object.values(after.schools).every((state) => state.status === "done" && state.attempts === 2));
    assert.equal(payments, paymentsBeforeSwitch);
    // 两卦都要写出白话总述：问事依据三家，运势换日后重写。
    assert.equal(reading.summary?.status, "done");
    assert.equal(after.summary?.status, "done");
    assert.equal(after.summary?.basis, 3);
    const namingService = new NamingReadingService({ store, provider, logger, feeVerifier,
      clock });
    const person = await namingService.create({
      target: "person", surname: "张", gender: "female", length: 2, unborn: false,
      question: "温和有书卷气", birth: { ...birth, gender: "female" },
      feeProof: { ...proof, transactionHash: `0x${"55".repeat(32)}` },
    });
    const business = await namingService.create({
      target: "business", gender: "any", length: 2, unborn: false,
      question: "社区咖啡馆，温暖安静",
      feeProof: { ...proof, transactionHash: `0x${"66".repeat(32)}` },
    });
    await Promise.all([namingService.whenSettled(person.id), namingService.whenSettled(business.id)]);
    const personView = publicNamingReading(await namingService.getReading(person.id));
    const businessView = publicNamingReading(await namingService.getReading(business.id));
    const naming = {
      person: personView.summary?.output?.picks.map(({ full }) => full) ?? [],
      business: businessView.summary?.output?.picks.map(({ full }) => full) ?? [],
    };
    return {
      conclusions: {
        question: reading.summary?.output?.conclusion ?? "",
        fortune: after.summary?.output?.conclusion ?? "",
      },
      remedies: {
        question: reading.summary?.output?.remedy?.plan.length ?? 0,
        fortune: after.summary?.output?.remedy?.plan.length ?? 0,
      },
      payments,
      naming,
      bazi: { pillars, window, schools: Object.values(after.schools).map((state) => state.status),
        years: publicBefore.years.length, sectAfterSwitch: after.chart.sect, changes: after.changes },
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
    console.log(`问事白话总述：${summary.conclusions.question}`);
    console.log(`运势四柱：${summary.bazi.pillars.join(" ")}；窗口：${summary.bazi.window.join("–")}`);
    console.log(`三家已完成，逐年合议 ${summary.bazi.years} 项；免费换日后重跑完成`);
    console.log(`运势白话总述：${summary.conclusions.fortune}`);
    console.log(`人名合参：${summary.naming.person.join("、")}`);
    console.log(`商号合参：${summary.naming.business.join("、")}`);
    console.log(`付款共 ${summary.payments} 笔，换日未新增付款`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
