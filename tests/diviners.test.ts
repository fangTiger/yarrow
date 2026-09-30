import assert from "node:assert/strict";
import test from "node:test";

import type { PublicClient } from "viem";

import { DeterministicMockProvider, type StructuredOutputRequest } from "../src/agent/provider.js";
import {
  DIVINER_SYSTEM_PROMPTS,
  buildDivinerUserPrompt,
  interpretWithDiviner,
  type DivinerInput,
  type DivinerKey,
} from "../src/agent/diviners.js";
import { ZHOUYI_CORPUS, getHexagramText } from "../src/agent/zhouyi-corpus.js";
import { readDivinerHistory } from "../src/agent/history.js";

test("六十四卦语料按文王序连续且每卦含卦辞与至少六条爻辞", () => {
  const labels = [/^初[六九]$/, /^[六九]二$/, /^[六九]三$/, /^[六九]四$/, /^[六九]五$/, /^上[六九]$/];
  assert.equal(ZHOUYI_CORPUS.length, 64);
  for (const [index, entry] of ZHOUYI_CORPUS.entries()) {
    assert.equal(entry.kingWenNumber, index + 1);
    assert.ok(entry.name.length > 0);
    assert.ok(entry.judgement.length > 0);
    assert.ok(entry.lines.length >= 6, `${entry.name} 的爻辞不足六条`);
    entry.lines.slice(0, 6).forEach((line, lineIndex) => {
      assert.match(line.label, labels[lineIndex]!, `${entry.name} 第 ${lineIndex + 1} 爻标签错位`);
    });
  }
  assert.equal(getHexagramText(1).name, "乾为天");
  assert.equal(getHexagramText(2).name, "坤为地");
  assert.equal(getHexagramText(64).name, "火水未济");
  assert.match(getHexagramText(1).extras.at(0)?.text ?? "", /群龙无首/);
  assert.match(getHexagramText(2).extras.at(0)?.text ?? "", /利永贞/);
  assert.equal(getHexagramText(15).lines[1]?.label, "六二");
  assert.match(getHexagramText(15).lines[1]?.text ?? "", /^鸣谦/);
  assert.equal(getHexagramText(47).judgement, "亨，贞，大人吉，无咎，有言不信。");
});

const input: DivinerInput = {
  question: "Arc Testnet 的 USDC 总量在截止后首次观察时是否超过阈值？",
  hexagram: {
    lines: [8, 6, 8, 9, 8, 7],
    primaryKingWenNumber: 35,
    derivedKingWenNumber: 4,
    changingLinePositions: [2, 4],
  },
  proposition: {
    predicateId: `0x${"12".repeat(32)}`,
    params: `0x${"00".repeat(31)}01`,
    deadlineBlock: 61_000_000n,
    statement: "首次观察到的 USDC 总量高于 1（六位精度）",
  },
  history: {
    sampleCount: 12,
    correctCount: 7,
    unresolvedCount: 1,
    averageBrier: 0.2145,
    recent: [
      { probabilityBps: 6_200, outcome: true, brier: 0.1444, unresolved: false },
      { probabilityBps: 5_500, outcome: null, brier: 1, unresolved: true },
    ],
  },
};

test("三位易者只在解释人格上不同，并读取同一完整卦象、固定命题与自身战绩", () => {
  const keys = Object.keys(DIVINER_SYSTEM_PROMPTS) as DivinerKey[];
  assert.deepEqual(keys.sort(), ["meihua", "takashima", "wuxing"]);
  assert.equal(new Set(Object.values(DIVINER_SYSTEM_PROMPTS)).size, 3);
  for (const prompt of Object.values(DIVINER_SYSTEM_PROMPTS)) {
    assert.match(prompt, /不得选择、替换或改写命题/);
    assert.match(prompt, /只输出方向、概率与解卦理由/);
  }

  const userPrompt = buildDivinerUserPrompt(input);
  assert.match(userPrompt, /六爻（自初爻至上爻）：8、6、8、9、8、7/);
  assert.match(userPrompt, /本卦：35 火地晋/);
  assert.match(userPrompt, /之卦：4 山水蒙/);
  assert.match(userPrompt, /变爻位置：2、4/);
  assert.match(userPrompt, /康侯用锡马蕃庶/);
  assert.match(userPrompt, /童蒙求我/);
  assert.match(userPrompt, /样本数：12/);
  assert.match(userPrompt, /未决数：1/);
  assert.match(userPrompt, /61000000/);
  assert.match(userPrompt, new RegExp(input.proposition.predicateId));
});

test("易者结构化输出不能携带命题字段且概率方向必须一致", async () => {
  let observedCache = false;
  const provider = new DeterministicMockProvider("mock-yijing-v1", {
    "diviner/takashima": (request: StructuredOutputRequest) => {
      observedCache = request.cacheSystemPrompt;
      return { direction: "YES", probabilityBps: 6_100, reasoning: "晋而之蒙，宜进而戒躁。" };
    },
  });

  const result = await interpretWithDiviner(provider, "takashima", input);
  assert.equal(observedCache, true);
  assert.equal(result.probabilityBps, 6_100);
  assert.equal(result.direction, "YES");
  assert.equal(provider.callCount("diviner/takashima"), 1);

  const inconsistent = new DeterministicMockProvider("mock-yijing-v1", {
    "diviner/wuxing": { direction: "NO", probabilityBps: 7_000, reasoning: "方向与概率冲突" },
  });
  await assert.rejects(interpretWithDiviner(inconsistent, "wuxing", input), /JSON Schema|方向与概率不一致/);

  const mutating = new DeterministicMockProvider("mock-yijing-v1", {
    "diviner/meihua": {
      direction: "YES",
      probabilityBps: 6_000,
      reasoning: "试图改题",
      predicateId: `0x${"34".repeat(32)}`,
    },
  });
  await assert.rejects(interpretWithDiviner(mutating, "meihua", input), /JSON Schema/);
});

test("易者历史从 ScoreBook 读取并把未决结果交给自我校准输入", async () => {
  const calls: string[] = [];
  const client = {
    readContract: async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
      calls.push(`${functionName}:${args?.at(-1) ?? ""}`);
      if (functionName === "getStats") {
        return { sampleCount: 2n, correctCount: 1n, unresolvedCount: 1n, totalBrier: 125_000_000n };
      }
      if (functionName === "historyCount") return 2n;
      if (functionName === "getHistory" && args?.at(-1) === 0n) {
        return { predictionId: 1n, roundId: 1n, probabilityBps: 5_000, brier: 25_000_000n, outcome: true, correct: true, unresolved: false };
      }
      return { predictionId: 2n, roundId: 2n, probabilityBps: 6_000, brier: 100_000_000n, outcome: false, correct: false, unresolved: true };
    },
  } as unknown as PublicClient;

  const result = await readDivinerHistory(
    client,
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    5,
  );

  assert.equal(result.sampleCount, 2);
  assert.equal(result.correctCount, 1);
  assert.equal(result.unresolvedCount, 1);
  assert.equal(result.averageBrier, 0.625);
  assert.deepEqual(result.recent.map((entry) => entry.outcome), [true, null]);
  assert.deepEqual(calls, ["getStats:0x2222222222222222222222222222222222222222", "historyCount:0x2222222222222222222222222222222222222222", "getHistory:0", "getHistory:1"]);
});
