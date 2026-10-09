import { encodeAbiParameters, encodeEventTopics, parseAbi, type Hex } from "viem";
import { USDC_TOKEN_ADDRESS } from "../frontend/wallet.js";
import { feeRecipientFromEnv, FEE_USDC6, verifySingleFeeTransfer, type SanyiFeeProof } from "./fee.js";
// src/sanyi/mock-provider.ts
import { hashJson } from "../agent/audit.js";
import type {
  StructuredOutputProvider,
  StructuredOutputRequest,
} from "../agent/provider.js";
import type { FactTable } from "./facts.js";
import { mockSchoolOutput } from "./mock-schools.js";
import { mockSummaryOutput } from "./mock-summary.js";
import type { QuestionSchoolKey } from "./schools/index.js";
import { mockBaziSchoolOutput } from "./mock-bazi-schools.js";
import type { BaziSchoolKey } from "./schools/bazi-shared.js";
import { mockNamingFamilyOutput, mockNamingSummaryOutput } from "./naming/mock.js";
import type { NamingFamilyKey } from "./naming/schema.js";
function baziFactsFromPrompt(prompt: string): FactTable {
  const line = prompt.split("\n").find((row) => row.startsWith("事实表 JSON："));
  if (!line) {
    throw new Error("八字 mock 请求缺少事实表");
  }
  const rows: unknown = JSON.parse(line.slice("事实表 JSON：".length));
  if (!Array.isArray(rows)) {
    throw new Error("八字 mock 事实表格式错误");
  }
  const facts: FactTable = new Map();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || typeof row.label !== "string"
      || !Array.isArray(row.tokens) || !row.tokens.every((token: unknown) => typeof token === "string")) {
      throw new Error("八字 mock 事实条目格式错误");
    }
    facts.set(row.id, { id: row.id, label: row.label, tokens: new Set<string>(row.tokens) });
  }
  return facts;
}
function factsFromPrompt(prompt: string): FactTable {
  const facts: FactTable = new Map();
  for (const line of prompt.split("\n")) {
    const match = line.match(/^([a-z-]+(?::\w+)?)[：](.+)$/u);
    if (match?.[1] && match[2]) {
      facts.set(match[1], {
        id: match[1],
        label: match[2],
        tokens: new Set<string>(),
      });
    }
  }
  return facts;
}
export class MockSchoolsProvider implements StructuredOutputProvider {
  readonly modelId = "sanyi-mock-schools";
  readonly providerConfig = Object.freeze({ kind: "sanyi-mock-schools" });
  readonly providerConfigHash = hashJson(this.providerConfig);
  async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
    if (request.taskId === "sanyi/naming/summary") {
      return mockNamingSummaryOutput(request.userPrompt) as T;
    }
    const naming = request.taskId.match(/^sanyi\/naming\/(wuxing|shiwen|yinyi)$/u);
    if (naming) {
      return mockNamingFamilyOutput(naming[1] as NamingFamilyKey, request.userPrompt) as T;
    }
    const summary = request.taskId.match(/^sanyi\/summary\/(question|fortune|destiny)$/u);
    if (summary) {
      return mockSummaryOutput(summary[1] as "question" | "fortune" | "destiny", request.userPrompt) as T;
    }
    const bazi = request.taskId.match(/^sanyi\/(destiny|fortune)\/(shenxiaozhan|yuchuntai|rentieqiao)$/u);
    if (bazi) {
      return mockBaziSchoolOutput(bazi[2] as BaziSchoolKey, baziFactsFromPrompt(request.userPrompt),
        bazi[1] as "destiny" | "fortune") as T;
    }
    const key = request.taskId.split("/").at(-1) as QuestionSchoolKey;
    if (!["chengyi", "jingfang", "shaoyong"].includes(key)) {
      throw new Error(`mock provider 不支持任务：${request.taskId}`);
    }
    return mockSchoolOutput(key, factsFromPrompt(request.userPrompt)) as T;
  }
}

/** 排练也使用标准转账日志，走与真实付款相同的纯函数核验。 */
export function mockSingleFeeReceipt(proof: SanyiFeeProof) {
  const recipient = feeRecipientFromEnv({});
  const abi = parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)"]);
  return verifySingleFeeTransfer({
    payer: proof.payer, recipient, amountUsdc6: FEE_USDC6,
    receipt: {
      status: "success", blockNumber: 1n, transactionHash: proof.transactionHash,
      logs: [{
        address: USDC_TOKEN_ADDRESS,
        topics: encodeEventTopics({
          abi, eventName: "Transfer", args: { from: proof.payer, to: recipient },
        }) as [Hex, ...Hex[]],
        data: encodeAbiParameters([{ type: "uint256" }], [FEE_USDC6]),
      }],
    },
  });
}
