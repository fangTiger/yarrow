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
