import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiItem,
  type PublicClient,
} from "viem";

import { ArcQuestionFeeVerifier } from "../src/oracle/arc-question-fee-verifier.js";
import {
  QuestionCastLedger,
  QuestionOracleService,
  deriveQuestionHexagram,
  type QuestionBlockSource,
  type QuestionFeeVerifier,
  type QuestionInterpreter,
} from "../src/oracle/question-oracle.js";
import {
  DIVINER_FEE_RECIPIENTS,
  mockQuestionFeeReceipt,
  splitOracleFee,
} from "../src/oracle/fee-payment.js";
import { USDC_ADDRESS } from "../src/yijing-deployment.js";

const BLOCK_HASH = `0x${"ab".repeat(32)}` as const;

test("给定区块哈希与输入时六爻和五卦均可复算", () => {
  const first = deriveQuestionHexagram({ blockHash: BLOCK_HASH, question: "我该不该辞职" });
  const second = deriveQuestionHexagram({ blockHash: BLOCK_HASH, question: "  我该不该辞职  " });

  assert.deepEqual(first, second);
  assert.equal(first.lines.length, 6);
  assert.ok(first.lines.every((line) => line >= 6 && line <= 9));
  assert.match(first.inputHash, /^0x[0-9a-f]{64}$/);
  assert.ok(first.primaryKingWenNumber >= 1 && first.primaryKingWenNumber <= 64);
  assert.ok(first.derivedKingWenNumber >= 1 && first.derivedKingWenNumber <= 64);
  assert.deepEqual(Object.keys(first.five), ["primary", "mutual", "derived", "opposite", "reversed"]);
  assert.deepEqual(
    Object.values(first.five).map((figure) => figure.label),
    ["本卦", "互卦", "变卦", "错卦", "综卦"],
  );
});

test("不同问题在同一区块仍进入输入承诺，避免共用同一卦", () => {
  const first = deriveQuestionHexagram({ blockHash: BLOCK_HASH, question: "我该不该辞职" });
  const second = deriveQuestionHexagram({ blockHash: BLOCK_HASH, question: "他到底怎么想" });
  assert.notEqual(first.inputHash, second.inputHash);
  assert.notDeepEqual(first.lines, second.lines);
});

test("不可判定问题先核验三库卦金，再只读区块并返回三家解读", async () => {
  let blockReads = 0;
  const source: QuestionBlockSource = {
    latest: async () => {
      blockReads += 1;
      return { number: 12_345n, hash: BLOCK_HASH, timestamp: 1_725_520_000n };
    },
  };
  const calls: string[] = [];
  const paymentCalls: string[] = [];
  const paymentVerifier: QuestionFeeVerifier = {
    verify: async (proof) => {
      paymentCalls.push(`payment:${proof.payer}:${proof.bundleId}`);
      return {
        feeUsdc6: "50000",
        walletConfirmationCount: 1,
        transactionHashes: [`0x${"cd".repeat(32)}`],
        shares: [
          { divinerKey: "takashima", divinerName: "高島易断", vault: "0xdb87cf872654707eb8cfc53b616ce7426980c98e", amountUsdc6: "16667" },
          { divinerKey: "wuxing", divinerName: "五行易（断易）", vault: "0x3499a17d4c5ba31d6d4c9ac29b4c8ab801b086b7", amountUsdc6: "16667" },
          { divinerKey: "meihua", divinerName: "梅花心易", vault: "0xe489b564a522b2b217dfd3ec5375bb1325d1f116", amountUsdc6: "16666" },
        ],
        gasUsdc6: "0",
      };
    },
  };
  const interpreter: QuestionInterpreter = {
    interpret: async (input) => {
      assert.equal(paymentCalls.length, 1, "付款必须先于任何易者解读");
      calls.push(input.divinerKey);
      return { interpretation: `${input.divinerName}只作主观解读。`, counsel: "把决定留给你自己。" };
    },
  };
  const service = new QuestionOracleService({ blockSource: source, interpreter, paymentVerifier });

  const result = await service.cast({
    question: "我该不该辞职",
    confirmedTrack: "question",
    confirmedSubject: "wealth",
    payment: { payer: "0x0000000000000000000000000000000000000011", bundleId: "mock-paid-bundle", transactionHashes: [`0x${"cd".repeat(32)}`] },
  });

  assert.equal(blockReads, 1);
  assert.deepEqual(paymentCalls, ["payment:0x0000000000000000000000000000000000000011:mock-paid-bundle"]);
  assert.deepEqual(calls, ["takashima", "wuxing", "meihua"]);
  assert.equal(result.track, "question");
  assert.equal(result.readings.length, 3);
  assert.deepEqual(result.block, { number: "12345", hash: BLOCK_HASH, timestamp: "1725520000" });
  assert.equal(result.chart.day.ganzhi, "壬申");
  assert.equal(result.chart.rows.length, 6);
  assert.equal(result.chart.palace.name.length, 1);
  assert.deepEqual(
    [result.subject.suggestedKey, result.subject.key, result.subject.useGod, result.subject.overridden],
    ["career", "wealth", "妻财", true],
  );
  assert.equal(result.chart.focus?.useGod, "妻财");
  assert.equal(result.question, "我该不该辞职", "改选事项不得改写原问题");
  assert.deepEqual(result.cost, {
    walletRequired: true,
    feeUsdc6: "50000",
    walletConfirmationCount: 1,
    transactionCount: 1,
    gasUsdc6: "0",
    recipients: 3,
  });
  assert.equal(result.transactions.length, 1);
  assert.equal(result.feeDistribution.length, 3);
  assert.equal(result.feeDistribution.reduce((sum, item) => sum + BigInt(item.amountUsdc6), 0n), 50_000n);
  assert.match(result.responsibilityNotice, /没有一个将来会揭晓的答案/);
  assert.match(result.responsibilityNotice, /包括刚刚收过你钱的我们/);
  assert.match(result.responsibilityNotice, /仍然可以为你解这一卦/);
});

test("問轨服务拒绝未知事项主题，不能由浏览器伪造用神", async () => {
  const service = new QuestionOracleService({
    blockSource: { latest: async () => ({ number: 1n, hash: BLOCK_HASH, timestamp: 1_725_520_000n }) },
    interpreter: { interpret: async () => ({ interpretation: "不应调用", counsel: "不应调用" }) },
    paymentVerifier: { verify: async () => { throw new Error("不应调用"); } },
  });
  await assert.rejects(
    service.cast({ question: "我该不该辞职", confirmedTrack: "question", confirmedSubject: "unknown", payment: {} }),
    /事项主题/,
  );
});

test("問轨服务拒绝把已确认的賭轨偷偷降级为免费起卦", async () => {
  const service = new QuestionOracleService({
    blockSource: { latest: async () => ({ number: 1n, hash: BLOCK_HASH, timestamp: 1_725_520_000n }) },
    interpreter: { interpret: async () => ({ interpretation: "不应调用", counsel: "不应调用" }) },
    paymentVerifier: { verify: async () => { throw new Error("不应调用"); } },
  });
  await assert.rejects(
    service.cast({ question: "今天之内会不会收到那条消息", confirmedTrack: "wager", payment: {} }),
    /只接受不可判定问题/,
  );
});

test("付款核验失败时不得读取区块或调用任何易者", async () => {
  let downstreamCalls = 0;
  const service = new QuestionOracleService({
    blockSource: { latest: async () => { downstreamCalls += 1; return { number: 1n, hash: BLOCK_HASH, timestamp: 1_725_520_000n }; } },
    interpreter: { interpret: async () => { downstreamCalls += 1; return { interpretation: "不应调用", counsel: "不应调用" }; } },
    paymentVerifier: { verify: async () => { throw new Error("三座金库付款凭证不完整"); } },
  });
  await assert.rejects(
    service.cast({ question: "我该不该辞职", confirmedTrack: "question", payment: { payer: "0x0" } }),
    /付款(?:钱包地址|凭证)/,
  );
  assert.equal(downstreamCalls, 0);
});

test("改选事项主题复用已付凭证与原起卦区块重新解释", async () => {
  let blockReads = 0;
  let paymentChecks = 0;
  const subjects: string[] = [];
  const service = new QuestionOracleService({
    blockSource: {
      latest: async () => {
        blockReads += 1;
        return { number: 88n, hash: `0x${"cd".repeat(32)}`, timestamp: 1_725_520_000n };
      },
    },
    interpreter: {
      interpret: async (input) => {
        subjects.push(input.subject?.key ?? "");
        return { interpretation: `${input.subject?.useGod}解读`, counsel: "行动" };
      },
    },
    paymentVerifier: {
      verify: async (proof) => {
        paymentChecks += 1;
        if (paymentChecks > 1) throw new Error("这组付款凭证已经用于另一卦");
        return mockQuestionFeeReceipt(proof);
      },
    },
  });
  const payment = {
    payer: `0x${"12".repeat(20)}`,
    bundleId: "bundle",
    transactionHashes: [`0x${"34".repeat(32)}`],
  };
  const first = await service.cast({ question: "我该不该辞职", confirmedTrack: "question", payment });
  const recalculated = await service.cast({
    question: first.question,
    confirmedTrack: "question",
    confirmedSubject: "wealth",
    payment,
    basisBlock: first.block,
  });

  assert.equal(blockReads, 1, "改选事项时不得读取新块改变本卦");
  assert.equal(paymentChecks, 1, "改选事项时应复用首次核验结果，不得重复消费付款哈希");
  assert.deepEqual(recalculated.block, first.block);
  assert.equal(recalculated.hexagram.inputHash, first.hexagram.inputHash);
  assert.equal(recalculated.subject.key, "wealth");
  assert.equal(recalculated.subject.useGod, "妻财");
  assert.deepEqual(subjects, ["career", "career", "career", "wealth", "wealth", "wealth"]);
});

test("真实付款核验器允许同问题同付款同区块改选事项，但拒绝借凭证另起一卦", async () => {
  const payer = `0x${"12".repeat(20)}` as const;
  const transactionHash = `0x${"56".repeat(32)}` as const;
  const payment = { payer, bundleId: "real-verifier-bundle", transactionHashes: [transactionHash] };
  const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
  let receiptReads = 0;
  const publicClient = {
    getTransactionReceipt: async () => {
      receiptReads += 1;
      return {
        status: "success",
        gasUsed: 0n,
        effectiveGasPrice: 0n,
        logs: splitOracleFee().map((share) => ({
          address: USDC_ADDRESS,
          topics: encodeEventTopics({
            abi: [transferEvent],
            eventName: "Transfer",
            args: { from: payer, to: share.vault },
          }),
          data: encodeAbiParameters([{ type: "uint256" }], [share.amountUsdc6]),
        })),
      };
    },
  } as unknown as PublicClient;
  let blockReads = 0;
  const castLedger = new QuestionCastLedger();
  const createService = () => new QuestionOracleService({
      blockSource: {
        latest: async () => {
          blockReads += 1;
          return { number: 88n, hash: `0x${"cd".repeat(32)}`, timestamp: 1_725_520_000n };
        },
      },
      interpreter: {
        interpret: async (input) => ({ interpretation: `${input.subject?.useGod}解读`, counsel: "行动" }),
      },
      paymentVerifier: new ArcQuestionFeeVerifier(publicClient),
      castLedger,
    });

  const first = await createService().cast({ question: "我该不该辞职", confirmedTrack: "question", payment });
  const recalculated = await createService().cast({
    question: first.question,
    confirmedTrack: "question",
    confirmedSubject: "wealth",
    payment,
    basisBlock: first.block,
  });

  assert.equal(receiptReads, 1, "真实回执只能在首次付款核验时读取一次");
  assert.equal(blockReads, 1);
  assert.equal(recalculated.subject.useGod, "妻财");
  assert.deepEqual(recalculated.block, first.block);
  assert.equal(recalculated.hexagram.inputHash, first.hexagram.inputHash);
  assert.deepEqual(
    recalculated.feeDistribution.map((share) => share.vault),
    DIVINER_FEE_RECIPIENTS.map((recipient) => recipient.vault),
  );

  await assert.rejects(
    createService().cast({
      question: "他到底怎么想",
      confirmedTrack: "question",
      confirmedSubject: "relationship",
      payment,
      basisBlock: first.block,
    }),
    /同一问题/,
  );
  assert.equal(receiptReads, 1, "拒绝借凭证改问时不得重新读取链上回执");
});
