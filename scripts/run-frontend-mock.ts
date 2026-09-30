import { DemoActionService } from "../src/demo/service.js";
import { MockDemoDriver } from "../src/demo/mock-driver.js";
import { createFrontendServer } from "../src/frontend/server.js";
import { classifyQuestion } from "../src/oracle/question-classifier.js";
import { mockQuestionFeeReceipt, type QuestionFeeProof } from "../src/oracle/fee-payment.js";
import { DeterministicQuestionInterpreter } from "../src/oracle/question-interpreter.js";
import { QuestionOracleService, type QuestionOracleResult } from "../src/oracle/question-oracle.js";

const port = Number(process.env.FRONTEND_PORT ?? "4173");
const mockDemoService = new DemoActionService(new MockDemoDriver());
const demoActions = {
  getSession: () => mockDemoService.getSession(),
  prepareRound: (input: Parameters<DemoActionService["prepareRound"]>[0]) => mockDemoService.prepareRound({ ...input, mode: "mock" }),
  confirmRound: (input: Parameters<DemoActionService["confirmRound"]>[0]) => mockDemoService.confirmRound(input),
  triggerPredictions: () => mockDemoService.triggerPredictions(),
  settleRound: (input?: Parameters<DemoActionService["settleRound"]>[0]) => mockDemoService.settleRound(input),
  abandonRound: () => mockDemoService.abandonRound(),
};
const questionOracle = new QuestionOracleService({
  blockSource: {
    latest: async () => ({ number: 61_234_567n, hash: `0x${"ab".repeat(32)}`, timestamp: 1_725_520_000n }),
  },
  interpreter: new DeterministicQuestionInterpreter(),
  paymentVerifier: { verify: async (proof) => mockQuestionFeeReceipt(proof) },
});
const server = createFrontendServer({
  demoActions,
  questionActions: {
    classify: async (input) => {
      const body = input as { question?: unknown };
      return classifyQuestion(typeof body.question === "string" ? body.question : "");
    },
    cast: async (input) => {
      const body = input as { question?: unknown; confirmedTrack?: unknown; confirmedSubject?: unknown; payment?: unknown; basisBlock?: unknown };
      return questionOracle.cast({
        question: typeof body.question === "string" ? body.question : "",
        confirmedTrack: body.confirmedTrack === "wager" ? "wager" : "question",
        confirmedSubject: body.confirmedSubject,
        payment: body.payment as QuestionFeeProof,
        ...(body.basisBlock === undefined ? {} : { basisBlock: body.basisBlock as QuestionOracleResult["block"] }),
      });
    },
  },
  getSnapshot: async () => ({
    chain: { name: "Arc Testnet・MOCK", latestBlock: "61234567" },
    history: {
      live: [{
        id: "human-settled-demo",
        source: "live",
        sourceLabel: "人层・已结算",
        question: "今天之内会不会收到那条消息？",
        statement: "今天之内会不会收到那条消息？",
        occurredAt: "2026-09-06 20:10",
        outcome: false,
        resolutionTier: "human",
        primary: { number: 24, name: "復" },
        derived: { number: 2, name: "坤" },
        predictions: [
          { divinerName: "高島易断", probabilityBps: 6_200, settlementDeltaUsdc6: "-18000" },
          { divinerName: "五行易（断易）", probabilityBps: 4_300, settlementDeltaUsdc6: "12000" },
          { divinerName: "梅花心易", probabilityBps: 5_500, settlementDeltaUsdc6: "-6000" },
        ],
      }],
      backtested: [{
        id: "heaven-backtested-demo",
        source: "backtested",
        sourceLabel: "天层・1000 回合 backtested",
        question: "Arc USDC 总量是否在观察窗口内增加？",
        statement: "USDC totalSupply 在截止块后首次观察值是否高于基准值",
        occurredAt: "1000 回合统计证据",
        outcome: true,
        resolutionTier: "heaven",
        primary: { number: 11, name: "泰" },
        derived: { number: 26, name: "大畜" },
        predictions: [
          { divinerName: "高島易断", probabilityBps: 5_800, settlementDeltaUsdc6: null },
          { divinerName: "五行易（断易）", probabilityBps: 5_200, settlementDeltaUsdc6: null },
          { divinerName: "梅花心易", probabilityBps: 5_600, settlementDeltaUsdc6: null },
        ],
      }],
    },
  }),
});
server.listen(port, "127.0.0.1", () => {
  console.log(`MOCK 前端验收服务已启动：http://127.0.0.1:${port}`);
  console.log("安全边界：不访问真实模型、不发送真实链上交易、不读取任何私钥");
});
