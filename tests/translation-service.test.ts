import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { hashJson } from "../src/agent/audit.js";
import type {
  StructuredOutputProvider,
  StructuredOutputRequest,
} from "../src/agent/provider.js";
import type { SanyiLogger } from "../src/sanyi/log.js";
import {
  ReadingStore,
  type StoredQuestionReading,
  type StoredReading as AnyStoredReading,
} from "../src/sanyi/store.js";
import {
  NotReadyError,
  sourceHash,
  TranslationBudgetError,
  TranslationService,
} from "../src/sanyi/translation/service.js";
import { TranslationStore } from "../src/sanyi/translation/store.js";
import { extractUnits } from "../src/sanyi/translation/units.js";

const ID = "abcdefghijklmnopqrstuvwxyz";
const SECOND_ID = "bcdefghijklmnopqrstuvwxyza";

function output(label: string) {
  return {
    verdict: "吉" as const,
    confidenceTenths: 7,
    headline: `${label}判断`,
    reason: `${label}理由`,
    sections: [{ title: `${label}小节`, text: `${label}正文` }],
    advice: [`${label}建议`],
    evidence: [{ ref: "e", claim: "内部依据" }],
  };
}

function terminalReading(id = ID): StoredQuestionReading {
  return {
    id,
    kind: "question" as const,
    createdAt: "2026-10-13T00:00:00.000Z",
    question: "测试问题",
    payment: {
      payer: `0x${"11".repeat(20)}` as `0x${string}`,
      recipient: `0x${"22".repeat(20)}` as `0x${string}`,
      transactionHash: `0x${"33".repeat(32)}` as `0x${string}`,
      feeUsdc6: "50000",
    },
    throws: [],
    status: "done" as const,
    subject: { suggestedKey: "career" as const, finalKey: "career" as const,
      overridden: false, changes: 0 },
    schools: {
      chengyi: { status: "done" as const, output: output("首家"), attempts: 1, retries: 0 },
      jingfang: { status: "done" as const, output: output("次家"), attempts: 1, retries: 0 },
      shaoyong: { status: "done" as const, output: output("末家"), attempts: 1, retries: 0 },
    },
    summary: {
      status: "done" as const, basis: 3, attempts: 1, retries: 0,
      output: {
        tone: "顺" as const,
        conclusion: "整体可行",
        agreement: "三家意见一致",
        explanation: ["准备充分", "时机合适"],
        remedy: {
          principle: "稳步推进",
          plan: [{ action: "先做准备", basis: "三家意见" }],
          avoid: ["避免仓促"],
        },
      },
    },
  };
}

function entriesFrom(prompt: string): Array<{ path: string; text: string }> {
  const line = prompt.split("\n").find((item) => item.startsWith("待翻译清单："));
  if (!line) throw new Error("测试 provider 未收到翻译清单");
  return JSON.parse(line.slice("待翻译清单：".length)) as Array<{ path: string; text: string }>;
}

class RecordingProvider implements StructuredOutputProvider {
  readonly modelId = "translation-test";
  readonly providerConfig = {};
  readonly providerConfigHash = hashJson({});
  readonly requests: StructuredOutputRequest[] = [];
  active = 0;
  maximumActive = 0;

  constructor(
    private readonly respond: (
      request: StructuredOutputRequest,
      callIndex: number,
    ) => Promise<{ texts: string[] }> | { texts: string[] } = (request) => ({
      texts: entriesFrom(request.userPrompt).map((_entry, index) => `English text ${index + 1}.`),
    }),
    private readonly delay = false,
  ) {}

  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    const index = this.requests.length;
    this.requests.push(request);
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    try {
      if (this.delay) await new Promise((resolve) => setTimeout(resolve, 10));
      return await this.respond(request, index) as T;
    } finally {
      this.active -= 1;
    }
  }
}

const silentLogger: SanyiLogger = { write: async () => {} };

async function fixture(input: {
  provider?: StructuredOutputProvider;
  now?: Date;
  concurrency?: number;
  dailyUnits?: number;
  logger?: SanyiLogger;
  makeStore?: (root: string) => ReadingStore;
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "sanyi-translation-"));
  const store = input.makeStore?.(root) ?? new ReadingStore(root);
  const translationStore = new TranslationStore(root);
  let now = input.now ?? new Date("2026-10-13T08:00:00.000Z");
  const provider = input.provider ?? new RecordingProvider();
  const service = new TranslationService({
    store,
    translationStore,
    provider,
    logger: input.logger ?? silentLogger,
    clock: () => now,
    ...(input.concurrency === undefined ? {} : { concurrency: input.concurrency }),
    ...(input.dailyUnits === undefined ? {} : { dailyUnits: input.dailyUnits }),
  });
  return {
    root, store, translationStore, service, provider,
    setNow(value: Date) { now = value; },
    async close() { await rm(root, { recursive: true, force: true }); },
  };
}

async function waitFor(check: () => Promise<boolean>): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("等待后台翻译超时");
}

test("漏译时只补译缺项一次并写入旁路文件", async () => {
  const provider = new RecordingProvider((request, index) => {
    const entries = entriesFrom(request.userPrompt);
    const texts = entries.map((_entry, itemIndex) => `English text ${itemIndex + 1}.`);
    if (index === 0) texts.pop();
    return { texts };
  });
  const f = await fixture({ provider });
  try {
    await f.store.write(terminalReading() as never);
    const result = await f.service.translate(ID);
    assert.equal(result.units.summary!.status, "done");
    assert.equal(provider.requests.length, 5);
    assert.equal(entriesFrom(provider.requests[1]!.userPrompt).length, 1);
    const stored = JSON.parse(await readFile(join(f.root, "translations", `${ID}.en.json`), "utf8"));
    assert.equal(stored.units.summary.status, "done");
    assert.equal(stored.units.summary.texts.length, 8);
  } finally {
    await f.close();
  }
});

test("provider 多回一项时直接丢弃多余项，不重译正确项", async () => {
  const provider = new RecordingProvider((request) => ({
    texts: [...entriesFrom(request.userPrompt).map(() => "English text."), "Extra text."],
  }));
  const f = await fixture({ provider });
  try {
    await f.store.write(terminalReading() as never);
    const result = await f.service.translate(ID);
    assert.equal(result.units.summary!.status, "done");
    assert.equal(provider.requests.length, 4);
  } finally {
    await f.close();
  }
});

test("sourceHash 改变时只让对应单元失效并重新翻译", async () => {
  const provider = new RecordingProvider();
  const f = await fixture({ provider });
  try {
    await f.store.write(terminalReading() as never);
    const first = await f.service.translate(ID);
    const oldHash = first.units.chengyi!.sourceHash;
    await f.store.update<StoredQuestionReading>(ID, (reading) => ({
      ...reading,
      schools: {
        ...reading.schools,
        chengyi: { ...reading.schools.chengyi,
          output: { ...reading.schools.chengyi.output!, headline: "首家判断已改变" } },
      },
    }));
    const before = provider.requests.length;
    const second = await f.service.translate(ID);
    assert.equal(provider.requests.length - before, 1);
    assert.notEqual(second.units.chengyi!.sourceHash, oldHash);
    assert.equal(second.units.jingfang!.sourceHash, first.units.jingfang!.sourceHash);
  } finally {
    await f.close();
  }
});

test("只读 GET 语义也会按当前 sourceHash 隐藏过期译文", async () => {
  const f = await fixture();
  try {
    await f.store.write(terminalReading() as never);
    const first = await f.service.translate(ID);
    assert.equal(first.units.chengyi!.status, "done");
    await f.store.update<StoredQuestionReading>(ID, (reading) => ({
      ...reading,
      schools: {
        ...reading.schools,
        chengyi: { ...reading.schools.chengyi,
          output: { ...reading.schools.chengyi.output!, headline: "GET 前原文已变化" } },
      },
    }));
    const visible = await f.service.read(ID);
    assert.equal(visible!.units.chengyi!.status, "pending");
    assert.equal(visible!.units.chengyi!.texts, undefined);
    assert.equal(visible!.units.jingfang!.status, "done");
  } finally {
    await f.close();
  }
});

test("provider 生成期间原文改变时不写回过期译文", async () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  let changed = false;
  const provider = new RecordingProvider(async (request) => {
    if (!changed && request.taskId.endsWith("/summary")) {
      changed = true;
      await f.store.update<StoredQuestionReading>(ID, (reading) => ({
        ...reading,
        summary: { ...reading.summary!, output: {
          ...reading.summary!.output!,
          conclusion: "源文已在生成期间改变",
        } },
      }));
    }
    return { texts: entriesFrom(request.userPrompt).map(() => "English text.") };
  });
  f = await fixture({ provider });
  try {
    await f.store.write(terminalReading() as never);
    const result = await f.service.translate(ID);
    assert.equal(result.units.summary!.status, "pending");
    assert.equal(result.units.summary!.texts, undefined);
  } finally {
    await f.close();
  }
});

test("并发请求按 reading 与单元去重", async () => {
  const provider = new RecordingProvider(undefined, true);
  const f = await fixture({ provider });
  try {
    await f.store.write(terminalReading() as never);
    await Promise.all([f.service.translate(ID), f.service.translate(ID), f.service.translate(ID)]);
    assert.equal(provider.requests.length, 4);
  } finally {
    await f.close();
  }
});

test("并发 trigger 在预检阶段也只占一次预算并按单元去重", async () => {
  const provider = new RecordingProvider(undefined, true);
  const f = await fixture({ provider, dailyUnits: 4 });
  try {
    await f.store.write(terminalReading() as never);
    await Promise.all([f.service.trigger(ID), f.service.trigger(ID), f.service.trigger(ID)]);
    await f.service.translate(ID);
    assert.equal(provider.requests.length, 4);
  } finally {
    await f.close();
  }
});

test("单元未终态或总述仍在 writing 时拒绝翻译", async () => {
  const f = await fixture();
  try {
    const reading = terminalReading();
    await f.store.write({ ...reading, summary: { ...reading.summary, status: "writing" } } as never);
    await assert.rejects(() => f.service.translate(ID), (error: unknown) => (
      error instanceof NotReadyError && error.code === "not-ready"
    ));
  } finally {
    await f.close();
  }
});

test("全局信号量限制不同解读的 provider 并发", async () => {
  const provider = new RecordingProvider(undefined, true);
  const f = await fixture({ provider, concurrency: 1 });
  try {
    await f.store.write(terminalReading(ID) as never);
    await f.store.write(terminalReading(SECOND_ID) as never);
    await Promise.all([f.service.translate(ID), f.service.translate(SECOND_ID)]);
    assert.equal(provider.maximumActive, 1);
  } finally {
    await f.close();
  }
});

test("连续失败三次后冷却十分钟", async () => {
  const provider = new RecordingProvider((request) => ({
    texts: entriesFrom(request.userPrompt).map(() => "仍有汉字"),
  }));
  const f = await fixture({ provider });
  try {
    const reading = terminalReading();
    await f.store.write({
      ...reading,
      schools: Object.fromEntries(Object.keys(reading.schools).map((key) => (
        [key, { status: "failed", attempts: 1, retries: 0 }]
      ))),
    } as never);
    await f.service.translate(ID);
    await f.service.translate(ID);
    const third = await f.service.translate(ID);
    assert.equal(third.units.summary!.failures, 3);
    assert.equal(third.units.summary!.cooldownUntil, "2026-10-13T08:10:00.000Z");
    const calls = provider.requests.length;
    await f.service.translate(ID);
    assert.equal(provider.requests.length, calls);
    f.setNow(new Date("2026-10-13T08:10:00.001Z"));
    await f.service.translate(ID);
    // 冷却结束后：首译、补译、整单元重试各一次。
    assert.equal(provider.requests.length, calls + 3);
  } finally {
    await f.close();
  }
});

test("每日单元额度耗尽后抛出 translation-budget", async () => {
  const provider = new RecordingProvider();
  const f = await fixture({ provider, dailyUnits: 1 });
  try {
    const reading = terminalReading();
    await f.store.write({
      ...reading,
      schools: Object.fromEntries(Object.keys(reading.schools).map((key) => (
        [key, { status: "failed", attempts: 1, retries: 0 }]
      ))),
    } as never);
    await f.store.write({ ...reading, id: SECOND_ID,
      schools: Object.fromEntries(Object.keys(reading.schools).map((key) => (
        [key, { status: "failed", attempts: 1, retries: 0 }]
      ))) } as never);
    await f.service.translate(ID);
    await assert.rejects(() => f.service.translate(SECOND_ID), (error: unknown) => (
      error instanceof TranslationBudgetError && error.code === "translation-budget"
    ));
  } finally {
    await f.close();
  }
});

test("英文下单只在单元终态后启动翻译，中文下单不翻译", async () => {
  const provider = new RecordingProvider();
  const f = await fixture({ provider });
  try {
    const english = { ...terminalReading(), translateTo: "en" as const };
    await f.store.write({ ...english, schools: { ...english.schools,
      chengyi: { ...english.schools.chengyi, status: "writing" as const } } } as never);
    await f.service.startUnit(ID, "chengyi");
    assert.equal(provider.requests.length, 0);

    await f.store.write(english as never);
    await f.service.startUnit(ID, "chengyi");
    await waitFor(async () => (await f.translationStore.read(ID))?.units.chengyi?.status === "done");
    assert.equal(provider.requests.length, 1);

    await f.store.write({ ...terminalReading(SECOND_ID), translateTo: undefined } as never);
    await f.service.startUnit(SECOND_ID, "chengyi");
    assert.equal(provider.requests.length, 1);
  } finally {
    await f.close();
  }
});

test("四类原生英文不建立翻译单元，trigger、translate 与 startUnit 均不调用模型", async () => {
  const provider = new RecordingProvider();
  const f = await fixture({ provider, dailyUnits: 0 });
  try {
    for (const kind of ["question", "destiny", "fortune", "naming"] as const) {
      await f.store.write({ ...terminalReading(), kind, lang: "en", translateTo: undefined } as never);
      assert.deepEqual(await f.service.trigger(ID), { lang: "en", units: {} }, kind);
      assert.deepEqual(await f.service.translate(ID), { lang: "en", units: {} }, kind);
      await f.service.startUnit(ID, kind === "naming" ? "wuxing"
        : kind === "question" ? "chengyi" : "shenxiaozhan");
    }
    assert.equal(provider.requests.length, 0);
    assert.equal(await f.translationStore.read(ID), undefined);
  } finally {
    await f.close();
  }
});

test("两个单元并发准备时不会互相覆盖", async () => {
  const provider = new RecordingProvider(undefined, true);
  const f = await fixture({ provider });
  try {
    await f.store.write({ ...terminalReading(), translateTo: "en" } as never);
    await Promise.all([
      f.service.startUnit(ID, "chengyi"),
      f.service.startUnit(ID, "jingfang"),
    ]);
    const prepared = await f.translationStore.read(ID);
    assert.ok(prepared?.units.chengyi);
    assert.ok(prepared?.units.jingfang);
    await waitFor(async () => {
      const stored = await f.translationStore.read(ID);
      return stored?.units.chengyi?.status === "done" && stored.units.jingfang?.status === "done";
    });
  } finally {
    await f.close();
  }
});

test("同一单元并发通知只启动一次且只扣一次预算", async () => {
  const messages: string[] = [];
  const provider = new RecordingProvider(undefined, true);
  const f = await fixture({ provider, dailyUnits: 1, logger: {
    write: async (message) => { messages.push(message); },
  } });
  try {
    await f.store.write({ ...terminalReading(), translateTo: "en" } as never);
    await Promise.all([
      f.service.startUnit(ID, "chengyi"),
      f.service.startUnit(ID, "chengyi"),
      f.service.startUnit(ID, "chengyi"),
    ]);
    await waitFor(async () => (await f.translationStore.read(ID))?.units.chengyi?.status === "done");
    assert.equal(provider.requests.length, 1);
    assert.ok(!messages.some((message) => message.includes("额度")));
  } finally {
    await f.close();
  }
});

test("翻译中原文变更时为新 sourceHash 排队并最终写入新译文", async () => {
  let releaseFirst!: () => void;
  let markFirstStarted!: () => void;
  const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve; });
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let chengyiCalls = 0;
  const provider = new RecordingProvider(async (request) => {
    const entries = entriesFrom(request.userPrompt);
    if (!request.taskId.endsWith("/chengyi")) {
      return { texts: entries.map(() => "English text.") };
    }
    chengyiCalls += 1;
    if (chengyiCalls === 1) {
      markFirstStarted();
      await firstGate;
      return { texts: entries.map(() => "Old English text.") };
    }
    return { texts: entries.map(() => "New English text.") };
  });
  const f = await fixture({ provider });
  try {
    await f.store.write({ ...terminalReading(), translateTo: "en" } as never);
    await f.service.startUnit(ID, "chengyi");
    await firstStarted;
    await f.store.update<StoredQuestionReading>(ID, (reading) => ({
      ...reading,
      schools: { ...reading.schools, chengyi: {
        ...reading.schools.chengyi,
        output: { ...reading.schools.chengyi.output!, headline: "重试后的新判断" },
      } },
    }));
    await f.service.startUnit(ID, "chengyi");
    releaseFirst();
    await waitFor(async () => chengyiCalls === 2
      && (await f.translationStore.read(ID))?.units.chengyi?.status === "done");
    const current = await f.store.read<StoredQuestionReading>(ID);
    const currentUnit = extractUnits(current).find((unit) => unit.key === "chengyi")!;
    const translated = (await f.translationStore.read(ID))!.units.chengyi!;
    assert.equal(translated.sourceHash, sourceHash(currentUnit));
    assert.ok(translated.texts?.every((text) => text === "New English text."));
  } finally {
    releaseFirst();
    await f.close();
  }
});

test("旧通知在 prepare 前被新原文超车时不会把 sourceHash 倒退", async () => {
  let releaseFirstRead!: () => void;
  let markFirstRead!: () => void;
  const firstRead = new Promise<void>((resolve) => { markFirstRead = resolve; });
  const readGate = new Promise<void>((resolve) => { releaseFirstRead = resolve; });
  class DelayedFirstReadStore extends ReadingStore {
    private delayed = false;
    override async read<T extends AnyStoredReading = StoredQuestionReading>(id: string): Promise<T> {
      const value = await super.read<T>(id);
      if (!this.delayed) {
        this.delayed = true;
        markFirstRead();
        await readGate;
      }
      return value;
    }
  }
  const provider = new RecordingProvider(undefined, true);
  const messages: string[] = [];
  const f = await fixture({ provider, dailyUnits: 1,
    logger: { write: async (message) => { messages.push(message); } },
    makeStore: (root) => new DelayedFirstReadStore(root) });
  try {
    await f.store.write({ ...terminalReading(), translateTo: "en" } as never);
    const older = f.service.startUnit(ID, "chengyi");
    await firstRead;
    await f.store.update<StoredQuestionReading>(ID, (reading) => ({
      ...reading,
      schools: { ...reading.schools, chengyi: {
        ...reading.schools.chengyi,
        output: { ...reading.schools.chengyi.output!, headline: "更新后的判断" },
      } },
    }));
    const newer = f.service.startUnit(ID, "chengyi");
    releaseFirstRead();
    await Promise.all([older, newer]);
    await waitFor(async () => (await f.translationStore.read(ID))?.units.chengyi?.status === "done");
    const current = await f.store.read<StoredQuestionReading>(ID);
    const unit = extractUnits(current).find((item) => item.key === "chengyi")!;
    assert.equal((await f.translationStore.read(ID))?.units.chengyi?.sourceHash, sourceHash(unit));
    assert.equal(provider.requests.length, 1);
    assert.ok(!messages.some((message) => message.includes("额度")));
  } finally {
    releaseFirstRead();
    await f.close();
  }
});

test("整卦触发读取旧快照时由新单元通知收敛到最新 sourceHash", async () => {
  let releaseFirstRead!: () => void;
  let markFirstRead!: () => void;
  const firstRead = new Promise<void>((resolve) => { markFirstRead = resolve; });
  const readGate = new Promise<void>((resolve) => { releaseFirstRead = resolve; });
  class DelayedFirstReadStore extends ReadingStore {
    private delayed = false;
    override async read<T extends AnyStoredReading = StoredQuestionReading>(id: string): Promise<T> {
      const value = await super.read<T>(id);
      if (!this.delayed) {
        this.delayed = true;
        markFirstRead();
        await readGate;
      }
      return value;
    }
  }
  const provider = new RecordingProvider(undefined, true);
  const f = await fixture({ provider, dailyUnits: 4,
    makeStore: (root) => new DelayedFirstReadStore(root) });
  try {
    await f.store.write({ ...terminalReading(), translateTo: "en" } as never);
    const whole = f.service.trigger(ID);
    await firstRead;
    await f.store.update<StoredQuestionReading>(ID, (reading) => ({
      ...reading,
      schools: { ...reading.schools, chengyi: {
        ...reading.schools.chengyi,
        output: { ...reading.schools.chengyi.output!, headline: "整卦竞态后的新判断" },
      } },
    }));
    const eager = f.service.startUnit(ID, "chengyi");
    releaseFirstRead();
    await Promise.all([whole, eager]);
    await f.service.translate(ID);
    const current = await f.store.read<StoredQuestionReading>(ID);
    const unit = extractUnits(current).find((item) => item.key === "chengyi")!;
    const translated = (await f.translationStore.read(ID))!.units.chengyi!;
    assert.equal(translated.status, "done");
    assert.equal(translated.sourceHash, sourceHash(unit));
    assert.equal(provider.requests.length, 4);
  } finally {
    releaseFirstRead();
    await f.close();
  }
});

test("按单元启动遇到每日预算超额只记日志", async () => {
  const messages: string[] = [];
  const f = await fixture({ dailyUnits: 0, logger: {
    write: async (message) => { messages.push(message); },
  } });
  try {
    await f.store.write({ ...terminalReading(), translateTo: "en" } as never);
    await f.service.startUnit(ID, "chengyi");
    assert.equal((f.provider as RecordingProvider).requests.length, 0);
    assert.ok(messages.some((message) => message.includes("额度")));
  } finally {
    await f.close();
  }
});

test("只有软性警告时先写 done，再后台补译且仅在警告变少时替换", async () => {
  let releaseRepair!: () => void;
  let repairStarted!: () => void;
  const repairing = new Promise<void>((resolve) => { repairStarted = resolve; });
  const gate = new Promise<void>((resolve) => { releaseRepair = resolve; });
  const provider = new RecordingProvider(async (request) => {
    const entries = entriesFrom(request.userPrompt);
    if (request.taskId.endsWith("summary")) {
      return { texts: entries.map(() => "The key factor is strong.") };
    }
    if (request.taskId.endsWith("summary/repair")) {
      repairStarted();
      await gate;
      return { texts: entries.map(() => "Yong Shen is strong.") };
    }
    return { texts: entries.map(() => "English text.") };
  });
  const f = await fixture({ provider });
  try {
    const reading = terminalReading();
    reading.summary!.output!.conclusion = "用神得力";
    await f.store.write(reading as never);
    const translating = f.service.translate(ID);
    await repairing;
    const immediate = await f.translationStore.read(ID);
    assert.equal(immediate?.units.summary?.status, "done");
    assert.deepEqual(immediate?.units.summary?.texts, ["The key factor is strong.",
      ...immediate.units.summary.texts!.slice(1)]);
    assert.ok((immediate?.units.summary?.warnings?.length ?? 0) > 0);
    releaseRepair();
    await translating;
    await waitFor(async () => (await f.translationStore.read(ID))?.units.summary?.warnings === undefined);
    assert.equal((await f.translationStore.read(ID))?.units.summary?.texts?.[0], "Yong Shen is strong.");
  } finally {
    releaseRepair();
    await f.close();
  }
});

test("补译后只剩软性问题时单元仍记为 done 并留警告；硬性问题才失败", async () => {
  const { checkTranslation } = await import("../src/sanyi/translation/check.js");
  const unitValue = {
    key: "summary" as const, kind: "question" as const, allowedHan: [] as string[],
    entries: [{ path: "summary.output.conclusion", text: "用神旺，凶 4 成" }],
  };
  const result = checkTranslation(unitValue, { texts: ["The key line is strong; unfavorable."] });
  assert.equal(result.acceptable, true);
  assert.ok(result.warnings.length > 0);
});
