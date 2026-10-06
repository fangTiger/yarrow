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
import type { QuestionSchoolKey } from "./schools/index.js";
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
