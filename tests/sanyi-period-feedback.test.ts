import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "../web/lib/api.js";
import { BaziReadingService } from "../src/sanyi/bazi-reading-service.js";
import { statusForError } from "../src/sanyi/http-errors.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { ReadingStore } from "../src/sanyi/store.js";
import type {
  StoredBaziReading,
  StoredQuestionReading,
  StoredReading,
} from "../src/sanyi/store.js";
import { baziFixture, birth, proof } from "./helpers/bazi-service.js";

async function createDestiny(fixture: Awaited<ReturnType<typeof baziFixture>>) {
  const reading = await fixture.bazi.create({
    kind: "destiny",
    question: "看看我的八字",
    birth,
    sect: 1,
    horizon: "year",
    feeProof: proof(),
  });
  await fixture.bazi.whenSettled(reading.id);
  return fixture.bazi.getReading(reading.id);
}

function errorIs400(error: unknown): boolean {
  return error instanceof Error && statusForError(error) === 400;
}

function baziService(store: ReadingStore, clock: () => Date) {
  return new BaziReadingService({
    store,
    clock,
    provider: new MockSchoolsProvider(),
    logger: { write: async () => {} },
    feeVerifier: { verify: async () => { throw new Error("不应重新核验付款"); } },
  });
}

class PausingReadingStore extends ReadingStore {
  private paused = false;

  constructor(
    root: string,
    private readonly afterRead: () => void,
    private readonly resume: Promise<void>,
  ) {
    super(root);
  }

  override async readRecovering<T extends StoredReading = StoredQuestionReading>(
    id: string,
    now: Date,
  ): Promise<T> {
    const reading = await super.readRecovering<T>(id, now);
    if (!this.paused) {
      this.paused = true;
      this.afterRead();
      await this.resume;
    }
    return reading;
  }
}

test("命理大运标注可新增、改选和取消，公开视图只带票值", async () => {
  const fixture = await baziFixture();
  try {
    const reading = await createDestiny(fixture);
    const periodIndex = reading.chart.luck?.cycles.find((cycle) => cycle.startYear <= 2026)?.index;
    assert.ok(periodIndex !== undefined);
    const periodsBefore = (await fixture.api.getReading(reading.id) as { periods: unknown }).periods;

    const accurate = await fixture.bazi.setPeriodFeedback(reading.id, periodIndex, "accurate");
    assert.deepEqual(accurate.feedback?.periods[String(periodIndex)], {
      vote: "accurate",
      at: "2026-10-06T13:00:00.000Z",
    });
    const firstPublic = await fixture.api.getReading(reading.id);
    assert.deepEqual("feedback" in firstPublic ? firstPublic.feedback : undefined, {
      periods: { [periodIndex]: "accurate" },
    });
    assert.doesNotMatch(
      JSON.stringify("feedback" in firstPublic ? firstPublic.feedback : undefined),
      /2026-10-06T13:00:00\.000Z/u,
    );
    assert.deepEqual((firstPublic as { periods: unknown }).periods, periodsBefore);

    const inaccurate = await fixture.api.setPeriodFeedback(reading.id, {
      periodIndex,
      vote: "inaccurate",
    });
    assert.deepEqual("feedback" in inaccurate ? inaccurate.feedback : undefined, {
      periods: { [periodIndex]: "inaccurate" },
    });
    assert.equal((await fixture.store.read<StoredBaziReading>(reading.id))
      .feedback?.periods[String(periodIndex)]?.vote, "inaccurate");

    const cancelled = await fixture.api.setPeriodFeedback(reading.id, { periodIndex, vote: null });
    assert.equal("feedback" in cancelled, false);
    assert.deepEqual((await fixture.store.read<StoredBaziReading>(reading.id)).feedback?.periods, {});
  } finally {
    await fixture.close();
  }
});

test("未来、不存在的大运以及运势卦和问事卦均拒绝标注", async () => {
  const fixture = await baziFixture();
  try {
    const destiny = await createDestiny(fixture);
    const future = destiny.chart.luck?.cycles.find((cycle) => cycle.startYear > 2026)?.index;
    assert.ok(future !== undefined);
    await assert.rejects(
      fixture.bazi.setPeriodFeedback(destiny.id, future, "accurate"),
      errorIs400,
    );
    await assert.rejects(
      fixture.bazi.setPeriodFeedback(destiny.id, 999, "accurate"),
      errorIs400,
    );

    const fortune: StoredBaziReading = {
      ...destiny,
      id: "f".repeat(26),
      kind: "fortune",
    };
    await fixture.store.write(fortune);
    await assert.rejects(
      fixture.bazi.setPeriodFeedback(fortune.id, future, "accurate"),
      errorIs400,
    );

    const question: StoredQuestionReading = {
      id: "q".repeat(26),
      kind: "question",
      createdAt: destiny.createdAt,
      question: "这次面试能过吗",
      subject: { suggestedKey: "career", finalKey: "career", overridden: false, changes: 0 },
      payment: destiny.payment,
      throws: [],
      schools: {
        chengyi: { status: "pending", attempts: 0, retries: 0 },
        jingfang: { status: "pending", attempts: 0, retries: 0 },
        shaoyong: { status: "pending", attempts: 0, retries: 0 },
      },
      status: "awaiting-throws",
    };
    await fixture.store.write(question);
    await assert.rejects(
      fixture.bazi.setPeriodFeedback(question.id, 1, "accurate"),
      errorIs400,
    );
  } finally {
    await fixture.close();
  }
});

test("反馈 API 校验请求体，并沿中断恢复路径读取存档", async () => {
  const fixture = await baziFixture();
  try {
    const reading = await createDestiny(fixture);
    const periodIndex = reading.chart.luck?.cycles.find((cycle) => cycle.startYear <= 2026)?.index;
    assert.ok(periodIndex !== undefined);
    for (const body of [null, [], {}, { periodIndex: 1.5, vote: "accurate" },
      { periodIndex, vote: "yes" }]) {
      await assert.rejects(fixture.api.setPeriodFeedback(reading.id, body), errorIs400);
    }

    await fixture.store.update<StoredBaziReading>(reading.id, (current) => ({
      ...current,
      status: "writing",
      schools: {
        ...current.schools,
        yuchuntai: {
          status: "writing",
          startedAt: "2020-01-01T00:00:00.000Z",
          attempts: current.schools.yuchuntai.attempts,
          retries: current.schools.yuchuntai.retries,
        },
      },
    }));
    const visible = await fixture.api.setPeriodFeedback(reading.id, { periodIndex, vote: "accurate" });
    assert.equal(visible.kind, "destiny");
    if (visible.kind !== "destiny") {
      throw new Error("反馈后应返回命理公开视图");
    }
    assert.equal(visible.schools.yuchuntai.status, "failed");
    assert.deepEqual("feedback" in visible ? visible.feedback : undefined, {
      periods: { [periodIndex]: "accurate" },
    });
  } finally {
    await fixture.close();
  }
});

test("换日重算与另一实例的反馈并发时不丢标注", async () => {
  const fixture = await baziFixture();
  let readDone!: () => void;
  const afterRead = new Promise<void>((resolve) => { readDone = resolve; });
  let resume!: () => void;
  const resumeRead = new Promise<void>((resolve) => { resume = resolve; });
  try {
    const reading = await createDestiny(fixture);
    const periodIndex = reading.chart.luck?.cycles.find((cycle) => cycle.startYear <= 2026)?.index;
    assert.ok(periodIndex !== undefined);
    const changeStore = new PausingReadingStore(fixture.root, readDone, resumeRead);
    const changer = baziService(changeStore, () => new Date("2026-10-06T13:00:00.000Z"));
    const changing = changer.changeDayBoundary(reading.id, birth, 2);
    await afterRead;
    await fixture.bazi.setPeriodFeedback(reading.id, periodIndex, "accurate");
    resume();
    const changed = await changing;
    await changer.whenSettled(reading.id);
    assert.equal(changed.feedback?.periods[String(periodIndex)]?.vote, "accurate");
    assert.equal((await fixture.store.read<StoredBaziReading>(reading.id))
      .feedback?.periods[String(periodIndex)]?.vote, "accurate");
  } finally {
    resume?.();
    await fixture.close();
  }
});

test("UTC 宿主按北京时间年份判断大运是否开始", async () => {
  const fixture = await baziFixture();
  try {
    const reading = await createDestiny(fixture);
    const nextYear = reading.chart.luck?.cycles.find((cycle) => cycle.startYear === 2027)?.index;
    assert.ok(nextYear !== undefined);
    class UtcHostDate extends Date {
      override getFullYear(): number {
        return this.getUTCFullYear();
      }
    }
    const edge = new UtcHostDate("2026-12-31T16:30:00.000Z");
    const service = baziService(fixture.store, () => edge);
    const updated = await service.setPeriodFeedback(reading.id, nextYear, "accurate");
    assert.equal(updated.feedback?.periods[String(nextYear)]?.vote, "accurate");
  } finally {
    await fixture.close();
  }
});

test("网页客户端按约定提交大运标注", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ path: String(input), ...(init ? { init } : {}) });
    return new Response(JSON.stringify({ kind: "destiny" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const client = createApiClient(fetcher);
  await client.setPeriodFeedback("abcdefghijklmnopqrstuvwxyz", 3, "inaccurate");
  assert.equal(calls[0]?.path, "/api/readings/abcdefghijklmnopqrstuvwxyz/feedback");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ periodIndex: 3, vote: "inaccurate" }));
});
