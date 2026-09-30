import type { Address, Hex, PublicClient } from "viem";

import { plannedDeadline, type DeadlineBudgetInput } from "../yijing-deployment.js";
import type { ProviderAttemptAudit, StructuredOutputProvider } from "./provider.js";
import type { StructuredOutputRequest } from "./provider.js";
import { PROPOSITION_OUTPUT_SCHEMA, type PropositionSelectionOutput } from "./schemas.js";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface PredicateRegistryConfig {
  resolver: Address;
  schemaHash: Hex;
  querentControllable: boolean;
  tier: 0 | 1 | 2;
  enabled: boolean;
}

export interface PredicateRegistryReader {
  getPredicate(predicateId: Hex): Promise<PredicateRegistryConfig>;
}

export interface PredicateDefinition {
  predicateId: Hex;
  name: string;
  description: string;
  paramsEncoding: string;
  schemaHash: Hex;
  validateParams: (params: Hex) => void;
  renderStatement: (params: Hex) => string;
  calibrateParams: (context: PredicateCalibrationContext) => Promise<PredicateCalibrationResult>;
}

export interface PredicateCalibrationContext {
  cutoffBlock: bigint;
  deadlineBlock: bigint;
}

export interface SuitablePredicateCalibration {
  suitable: true;
  params: Hex;
  method: string;
  sampleCount: number;
  yesCount: number;
  empiricalBaseRateBps: number;
  historyStartBlock: bigint;
  historyEndBlock: bigint;
  horizonBlocks: bigint;
}

export interface UnsuitablePredicateCalibration {
  suitable: false;
  reason: string;
  sampleCount: number;
  closestBaseRateBps: number;
}

export type PredicateCalibrationResult = SuitablePredicateCalibration | UnsuitablePredicateCalibration;
export type PredicateCalibrationEvidence = Omit<SuitablePredicateCalibration, "suitable" | "params">;

export interface CompiledProposition {
  predicateId: Hex;
  params: Hex;
  deadlineBlock: bigint;
  statement: string;
  reasoning: string;
  calibration: PredicateCalibrationEvidence;
}

export type DeadlinePolicy = Omit<DeadlineBudgetInput, "currentBlock">;

export interface PropositionCompilerOptions {
  provider: StructuredOutputProvider;
  registry: PredicateRegistryReader;
  definitions: readonly PredicateDefinition[];
  currentBlock: () => Promise<bigint>;
  deadlinePolicy: DeadlinePolicy;
}

export interface PropositionCompilationAudit {
  modelId: string;
  request: StructuredOutputRequest;
  output: PropositionSelectionOutput;
}

export type PropositionAuditRecorder = (audit: PropositionCompilationAudit) => Promise<void>;
export type ProviderAttemptRecorder = (audit: ProviderAttemptAudit) => Promise<void>;

const SYSTEM_PROMPT = `你是中立的链上命题编译器，不是易者。你只负责把提问映射到给定白名单中的一个可证伪谓词。不得阅读、解释或使用卦象，不得估计概率，不得考虑哪一个命题更容易获胜。predicateId 与 params 必须逐字取自同一个候选；params 已由截止块之前的历史数据完成难度校准，你不得生成或改写参数。只输出结构化结果。`;

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isEligible(config: PredicateRegistryConfig, definition: PredicateDefinition): boolean {
  return config.enabled
    && config.tier !== 2
    && !config.querentControllable
    && !sameHex(config.resolver, ZERO_ADDRESS)
    && sameHex(config.schemaHash, definition.schemaHash);
}

export class PropositionCompiler {
  constructor(private readonly options: PropositionCompilerOptions) {}

  async compile(
    question: string,
    recordAudit: PropositionAuditRecorder,
    recordProviderAttempt?: ProviderAttemptRecorder,
  ): Promise<CompiledProposition> {
    if (!question.trim()) throw new Error("提问不能为空");
    const checked = await Promise.all(this.options.definitions.map(async (definition) => ({
      definition,
      config: await this.options.registry.getPredicate(definition.predicateId),
    })));
    const eligible = checked.filter(({ config, definition }) => isEligible(config, definition));
    if (eligible.length === 0) throw new Error("PredicateRegistry 没有可进入押注层的谓词");

    const currentBlock = await this.options.currentBlock();
    const deadlineBlock = plannedDeadline({ currentBlock, ...this.options.deadlinePolicy });
    const calibrated = await Promise.all(eligible.map(async ({ definition, config }) => ({
      definition,
      config,
      calibration: await definition.calibrateParams({ cutoffBlock: currentBlock, deadlineBlock }),
    })));
    const measurable = calibrated.filter((item): item is typeof item & { calibration: SuitablePredicateCalibration } =>
      item.calibration.suitable);
    if (measurable.length === 0) {
      const reasons = calibrated.map(({ definition, calibration }) => calibration.suitable
        ? `${definition.name}：未知原因`
        : `${definition.name}：${calibration.reason}`).join("；");
      throw new Error(`PredicateRegistry 的链上合格谓词均不适合用于测量：${reasons}`);
    }

    const candidates = measurable.map(({ definition, calibration }) => ({
      predicateId: definition.predicateId,
      name: definition.name,
      description: definition.description,
      paramsEncoding: definition.paramsEncoding,
      params: calibration.params,
      difficultyCalibration: {
        method: calibration.method,
        sampleCount: calibration.sampleCount,
        yesCount: calibration.yesCount,
        empiricalBaseRateBps: calibration.empiricalBaseRateBps,
        historyStartBlock: calibration.historyStartBlock.toString(),
        historyEndBlock: calibration.historyEndBlock.toString(),
        horizonBlocks: calibration.horizonBlocks.toString(),
      },
    }));
    const providerRequest: StructuredOutputRequest = {
      taskId: "proposition-compiler",
      systemPrompt: SYSTEM_PROMPT,
      cacheSystemPrompt: false,
      userPrompt: `提问：${question}\n\n链上已核验、难度已校准且可进入押注层的候选谓词：\n${JSON.stringify(candidates, null, 2)}`,
      schema: PROPOSITION_OUTPUT_SCHEMA,
      effort: "high",
      ...(recordProviderAttempt ? { recordAttempt: recordProviderAttempt } : {}),
    };
    const selection = await this.options.provider.generateStructured<PropositionSelectionOutput>(providerRequest);
    // 在任何截止块计算或易者调用前，持久化唯一一次编译输出。
    await recordAudit({ modelId: this.options.provider.modelId, request: providerRequest, output: selection });
    const selected = measurable.find(({ definition }) => sameHex(definition.predicateId, selection.predicateId));
    if (!selected) throw new Error("编译器返回的 predicateId 不在已核验的可押注白名单，本轮不会自动重跑");
    if (!sameHex(selected.calibration.params, selection.params)) {
      throw new Error("编译器改写已冻结的难度校准参数，本轮不会自动重跑");
    }
    selected.definition.validateParams(selection.params);
    const { suitable: _suitable, params: _params, ...calibration } = selected.calibration;
    return {
      predicateId: selected.definition.predicateId,
      params: selection.params,
      deadlineBlock,
      statement: selected.definition.renderStatement(selection.params),
      reasoning: selection.reasoning,
      calibration,
    };
  }
}

const PREDICATE_REGISTRY_ABI = [
  {
    type: "function",
    name: "getPredicate",
    stateMutability: "view",
    inputs: [{ name: "predicateId", type: "bytes32" }],
    outputs: [
      {
        name: "config",
        type: "tuple",
        components: [
          { name: "resolver", type: "address" },
          { name: "schemaHash", type: "bytes32" },
          { name: "querentControllable", type: "bool" },
          { name: "tier", type: "uint8" },
          { name: "enabled", type: "bool" },
        ],
      },
    ],
  },
] as const;

interface PredicateTupleObject {
  resolver: Address;
  schemaHash: Hex;
  querentControllable: boolean;
  tier: number;
  enabled: boolean;
}

export class ViemPredicateRegistryReader implements PredicateRegistryReader {
  constructor(
    private readonly client: PublicClient,
    private readonly registryAddress: Address,
  ) {}

  async getPredicate(predicateId: Hex): Promise<PredicateRegistryConfig> {
    const result = await this.client.readContract({
      address: this.registryAddress,
      abi: PREDICATE_REGISTRY_ABI,
      functionName: "getPredicate",
      args: [predicateId],
    }) as PredicateTupleObject;
    if (result.tier !== 0 && result.tier !== 1 && result.tier !== 2) {
      throw new Error(`PredicateRegistry 返回未知判定层：${result.tier}`);
    }
    return {
      resolver: result.resolver,
      schemaHash: result.schemaHash,
      querentControllable: result.querentControllable,
      tier: result.tier,
      enabled: result.enabled,
    };
  }
}
