import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import { buildBirthChart } from "../src/sanyi/birth-chart.js";
import { createSanyiApi } from "../src/sanyi/api.js";
import {
  DAY_MASTERS,
  dayMasterByStem,
  validateDayMasters,
  type DayMasterProfile,
} from "../src/content/day-masters.js";
import { SanyiInputError } from "../src/sanyi/http-errors.js";
import { createFrontendHandler } from "../src/frontend/server.js";

const births = [
  {
    birth: {
      calendar: "solar", isLeapMonth: false, year: 1990, month: 5, day: 15,
      time: { hour: 23, minute: 30 }, gender: "male", timeZone: "Asia/Shanghai",
    },
    sect: undefined,
  },
  {
    birth: {
      calendar: "solar", isLeapMonth: false, year: 1991, month: 11, day: 3,
      time: { hour: 1, minute: 30 }, gender: "female", timeZone: "America/New_York",
    },
    sect: 2 as const,
  },
  {
    birth: {
      calendar: "solar", isLeapMonth: false, year: 1988, month: 8, day: 8,
      time: null, gender: "male", timeZone: "Asia/Tokyo",
    },
    sect: 1 as const,
  },
] as const;

function serviceBoundary() {
  let calls = 0;
  const fail = async () => {
    calls += 1;
    throw new Error("日主查询不应调用解读服务或模型 provider");
  };
  return {
    service: {
      createQuestionReading: fail,
      continueCasting: fail,
      getReading: fail,
      retrySchool: fail,
      changeSubject: fail,
      retrySummary: fail,
    },
    calls: () => calls,
  };
}

test("日主接口与付费命理共用排盘结果，覆盖子时、海外时区和未知时辰", async () => {
  const boundary = serviceBoundary();
  const api = createSanyiApi(boundary.service as never, {
    now: () => new Date("2026-10-20T08:00:00.000Z"),
    bazi: new Proxy({}, { get() { throw new Error("不得调用八字解读服务"); } }) as never,
  });

  for (const item of births) {
    const sect = item.sect ?? 1;
    const expected = buildBirthChart(item.birth, sect, 2026).chart.dayMaster;
    const actual = await api.dayMaster({
      birth: item.birth,
      ...(item.sect === undefined ? {} : { sect: item.sect }),
    });
    const content = dayMasterByStem(expected);
    assert.deepEqual(actual, {
      stem: expected,
      element: content.element,
      yinYang: content.yinYang,
      slug: content.slug,
    });
    const serialized = JSON.stringify(actual);
    assert.doesNotMatch(serialized, /1990|1991|1988|23:30|America\/New_York|Asia\/Tokyo/u);
  }
  assert.equal(boundary.calls(), 0);
});

test("日主接口沿用生辰错误码，并校验 sect", async () => {
  const api = createSanyiApi(serviceBoundary().service as never);
  await assert.rejects(api.dayMaster({ birth: { year: 1990 } }), (error: unknown) => (
    error instanceof SanyiInputError && error.code === "birth-invalid"
  ));
  await assert.rejects(api.dayMaster({ birth: births[0].birth, sect: 3 }), SanyiInputError);
});

test("十个日主中英短介绍齐全、字数合规且通过英文审计", () => {
  assert.equal(DAY_MASTERS.length, 10);
  assert.deepEqual(validateDayMasters(DAY_MASTERS), []);
  assert.deepEqual(DAY_MASTERS.map((item) => item.stem), [..."甲乙丙丁戊己庚辛壬癸"]);
  for (const item of DAY_MASTERS) {
    assert.ok([...item.zh.summary].length >= 60 && [...item.zh.summary].length <= 90, item.stem);
    const words = item.en.summary.trim().split(/\s+/u);
    assert.ok(words.length >= 40 && words.length <= 70, `${item.stem}: ${words.length}`);
    assert.equal(item.zh.keywords.length, 3);
    assert.equal(item.en.keywords.length, 3);
    assert.equal(item.zh.strengths.length, 2);
    assert.equal(item.en.strengths.length, 2);
    assert.equal(item.zh.watch.length, 2);
    assert.equal(item.en.watch.length, 2);
  }
});

test("日主资料校验能报告缺项、字数、汉字与禁用词", () => {
  const invalid = structuredClone(DAY_MASTERS) as DayMasterProfile[];
  invalid.pop();
  invalid[0]!.zh.summary = "太短";
  invalid[1]!.en.summary = `${"plain ".repeat(40)}改运`;
  invalid[2]!.en.summary = `${"plain ".repeat(40)}improve your luck`;
  const errors = validateDayMasters(invalid);
  assert.ok(errors.some((error) => error.includes("10 条")));
  assert.ok(errors.some((error) => error.includes("缺少 癸")));
  assert.ok(errors.some((error) => error.includes("甲日主") && error.includes("60–90")));
  assert.ok(errors.some((error) => error.includes("乙日主") && error.includes("汉字")));
  assert.ok(errors.some((error) => error.includes("丙日主") && error.includes("禁用词")));
});

async function dispatch(api: ReturnType<typeof createSanyiApi>, input: {
  body: unknown;
  origin?: string;
  contentType?: string;
}) {
  const text = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
  const request = Readable.from([Buffer.from(text)]) as IncomingMessage;
  Object.assign(request, {
    method: "POST",
    url: "/api/day-master",
    headers: {
      host: "local.test",
      origin: input.origin ?? "http://local.test",
      "content-type": input.contentType ?? "application/json",
    },
  });
  let status = 0;
  let payload = "";
  const response = {
    writeHead(nextStatus: number) { status = nextStatus; return this; },
    end(chunk?: string) { payload = chunk ?? ""; return this; },
  } as unknown as ServerResponse;
  await createFrontendHandler({ api })(request, response);
  return { status, json: payload ? JSON.parse(payload) as unknown : undefined };
}

test("POST /api/day-master 沿用同源、JSON 与 8 KiB 边界", async () => {
  const api = createSanyiApi(serviceBoundary().service as never, {
    now: () => new Date("2026-10-20T08:00:00.000Z"),
  });
  const ok = await dispatch(api, { body: { birth: births[0].birth } });
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(ok.json as object).sort(), ["element", "slug", "stem", "yinYang"]);
  assert.equal((await dispatch(api, {
    body: { birth: births[0].birth }, origin: "https://evil.example",
  })).status, 403);
  assert.equal((await dispatch(api, {
    body: { birth: births[0].birth }, contentType: "text/plain",
  })).status, 415);
  assert.equal((await dispatch(api, { body: "x".repeat(9 * 1_024) })).status, 413);
  const invalid = await dispatch(api, { body: { birth: { year: 1990 } } });
  assert.equal(invalid.status, 400);
  assert.equal((invalid.json as { code: string }).code, "birth-invalid");
});
