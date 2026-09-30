import type { Hex } from "viem";

import { hashJson, hashText } from "./audit.js";
import {
  DIVINER_SYSTEM_PROMPTS,
  buildDivinerUserPrompt,
  interpretWithDiviner,
  type DivinerHistory,
  type DivinerInput,
  type DivinerKey,
} from "./diviners.js";
import type { ProviderAttemptAudit, StructuredOutputProvider } from "./provider.js";
import type { CompiledProposition, PropositionAuditRecorder } from "./proposition-compiler.js";
import { PREDICTION_OUTPUT_SCHEMA, type DivinerOutput } from "./schemas.js";
import { PROPOSITION_OUTPUT_SCHEMA } from "./schemas.js";
import type { AgentRunJournal, AgentRunScope } from "./run-journal.js";

export interface PropositionCompilerLike {
  compile(
    question: string,
    recordAudit: PropositionAuditRecorder,
    recordProviderAttempt?: (attempt: ProviderAttemptAudit) => Promise<void>,
  ): Promise<CompiledProposition>;
}

export interface PredictionSubmission {
  divinerKey: DivinerKey;
  roundId: bigint;
  direction: boolean;
  probabilityBps: number;
  predicateId: Hex;
  params: Hex;
  deadline: bigint;
  modelId: Hex;
  promptHash: Hex;
  schemaHash: Hex;
  providerConfigHash: Hex;
  attemptCount: number;
  reasoning: string;
}

export interface SubmissionReceipt {
  transactionHash: Hex;
  blockNumber: bigint;
  predictionId?: bigint;
  gasUsed?: bigint;
  gasCostWei?: bigint;
}

export interface PredictionSubmitter {
  submit(submission: PredictionSubmission): Promise<SubmissionReceipt>;
}

export interface AgentRunRequest {
  roundId: bigint;
  question: string;
  hexagram: DivinerInput["hexagram"];
  histories: Readonly<Record<DivinerKey, DivinerHistory>>;
}

export interface AuditedPrediction {
  divinerKey: DivinerKey;
  output: DivinerOutput;
  submission: PredictionSubmission;
  receipt: SubmissionReceipt;
}

export interface AgentRunResult {
  proposition: CompiledProposition;
  predictions: readonly AuditedPrediction[];
}

export interface AgentOrchestratorOptions {
  compiler: PropositionCompilerLike;
  provider: StructuredOutputProvider;
  submitter: PredictionSubmitter;
  journal: AgentRunJournal;
  scope: AgentRunScope;
  onPropositionCompiled?: (proposition: CompiledProposition) => Promise<void>;
}

interface StagedPrediction {
  output: DivinerOutput;
  submission: PredictionSubmission;
  receipt?: SubmissionReceipt;
  receiptRecorded: boolean;
}

interface ResumableAgentRun {
  requestHash: Hex;
  journal: Awaited<ReturnType<AgentRunJournal["claim"]>>;
  proposition?: CompiledProposition;
  predictions: Map<DivinerKey, StagedPrediction>;
}

export class AgentOrchestrator {
  private static readonly DIVINER_KEYS: readonly DivinerKey[] = ["takashima", "wuxing", "meihua"];
  private readonly runs = new Map<string, ResumableAgentRun>();

  constructor(private readonly options: AgentOrchestratorOptions) {}

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    const runKey = request.roundId.toString();
    const requestHash = hashJson({
      roundId: runKey,
      question: request.question,
      hexagram: request.hexagram,
    });
    let state = this.runs.get(runKey);
    if (state && state.requestHash !== requestHash) {
      throw new Error(`轮次 ${request.roundId} 的重试输入与首次请求不一致`);
    }
    if (!state) {
      state = {
        requestHash,
        journal: await this.options.journal.claim(this.options.scope, request.roundId),
        predictions: new Map(),
      };
      this.runs.set(runKey, state);
    }
    const run = state.journal;

    if (!state.proposition) {
      let compilerOutputRecorded = false;
      const proposition = await this.options.compiler.compile(request.question, async (audit) => {
        compilerOutputRecorded = true;
        // recordAttempt 是进程内回调，必须从可持久化的审计请求中剔除。
        const { recordAttempt: _recordAttempt, ...serializableRequest } = audit.request;
        await run.record({
          type: "proposition-output",
          payload: {
            ...audit,
            request: serializableRequest,
            inputHash: hashJson({ systemPrompt: audit.request.systemPrompt, userPrompt: audit.request.userPrompt }),
            outputHash: hashJson(audit.output),
            schemaHash: hashJson(audit.request.schema),
          },
        });
      }, async (attempt) => this.recordAttempt(run, "proposition-compiler", attempt));
      if (!compilerOutputRecorded) throw new Error("命题编译输出未持久化，本轮已闭锁且禁止重跑");
      await run.record({
        type: "proposition-compiled",
        payload: {
          modelId: this.options.provider.modelId,
          question: request.question,
          schemaHash: hashJson(PROPOSITION_OUTPUT_SCHEMA),
          output: proposition,
          compilerOutputRecorded,
        },
      });
      state.proposition = proposition;
    }
    const proposition = state.proposition;
    await this.options.onPropositionCompiled?.(proposition);
    const predictions: AuditedPrediction[] = [];
    for (const divinerKey of AgentOrchestrator.DIVINER_KEYS) {
      let staged = state.predictions.get(divinerKey);
      if (!staged) {
        const divinerInput = {
          question: request.question,
          hexagram: request.hexagram,
          proposition,
          history: request.histories[divinerKey],
        };
        const userPrompt = buildDivinerUserPrompt(divinerInput);
        let attemptCount = 0;
        const output = await interpretWithDiviner(this.options.provider, divinerKey, {
          ...divinerInput,
        }, async (attempt) => {
          attemptCount += 1;
          await this.recordAttempt(run, `diviner/${divinerKey}`, attempt, divinerKey);
        });
        if (attemptCount === 0) throw new Error(`${divinerKey} provider 未记录生成尝试，本轮不得提交`);
        // 链上 promptHash 是固定 system prompt 版本；动态输入与完整输出另由持久日志绑定。
        const promptHash = hashText(DIVINER_SYSTEM_PROMPTS[divinerKey]);
        const submission: PredictionSubmission = {
          divinerKey,
          roundId: request.roundId,
          direction: output.direction === "YES",
          probabilityBps: output.probabilityBps,
          predicateId: proposition.predicateId,
          params: proposition.params,
          deadline: proposition.deadlineBlock,
          modelId: hashText(this.options.provider.modelId),
          promptHash,
          schemaHash: hashJson(PREDICTION_OUTPUT_SCHEMA),
          providerConfigHash: this.options.provider.providerConfigHash,
          attemptCount,
          reasoning: output.reasoning,
        };
        // 唯一输出先持久化并缓存；提交失败时只重试这份输出，不重新推理。
        await run.record({
          type: "diviner-output",
          payload: {
            divinerKey,
            modelId: this.options.provider.modelId,
            request: {
              systemPrompt: DIVINER_SYSTEM_PROMPTS[divinerKey],
              userPrompt,
              schema: PREDICTION_OUTPUT_SCHEMA,
            },
            promptHash,
            inputHash: hashJson({ systemPrompt: DIVINER_SYSTEM_PROMPTS[divinerKey], userPrompt }),
            outputHash: hashJson(output),
            schemaHash: submission.schemaHash,
            providerConfigHash: submission.providerConfigHash,
            attemptCount,
            output,
          },
        });
        staged = { output, submission, receiptRecorded: false };
        state.predictions.set(divinerKey, staged);
      }
      if (!staged.receipt) staged.receipt = await this.options.submitter.submit(staged.submission);
      if (!staged.receiptRecorded) {
        await run.record({
          type: "prediction-submitted",
          payload: { divinerKey, submission: staged.submission, receipt: staged.receipt },
        });
        staged.receiptRecorded = true;
      }
      predictions.push({
        divinerKey,
        output: staged.output,
        submission: staged.submission,
        receipt: staged.receipt,
      });
    }
    return { proposition, predictions };
  }

  private async recordAttempt(
    run: Awaited<ReturnType<AgentRunJournal["claim"]>>,
    taskId: string,
    attempt: ProviderAttemptAudit,
    divinerKey?: DivinerKey,
  ): Promise<void> {
    const { rawOutput: _rawOutput, ...audit } = attempt;
    await run.record({
      type: "provider-attempt",
      payload: {
        taskId,
        ...(divinerKey ? { divinerKey } : {}),
        modelId: this.options.provider.modelId,
        providerConfigHash: this.options.provider.providerConfigHash,
        ...audit,
      },
    });
  }
}
