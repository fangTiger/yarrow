import {
  decodeAbiParameters,
  encodeAbiParameters,
  keccak256,
  stringToHex,
  type Address,
  type PublicClient,
} from "viem";

import { calibrateThreshold } from "../difficulty-calibration.js";
import type { PredicateDefinition } from "../agent/proposition-compiler.js";
import { ArcReplaySource } from "../replay/arc-source.js";

export const SUPPLY_PREDICATE_ID = keccak256(stringToHex("USDC_TOTAL_SUPPLY_ABOVE"));
export const SUPPLY_SCHEMA_HASH = keccak256(stringToHex("abi.encode(uint256 threshold)"));

const CALIBRATION_SAMPLES = 64;
const CALIBRATION_STEP = 8n;

/** 现场命题只开放已部署、可历史校准且不由提问者控制的 USDC 总量谓词。 */
export function createSupplyPredicateDefinition(client: PublicClient, usdcAddress: Address): PredicateDefinition {
  return {
    predicateId: SUPPLY_PREDICATE_ID,
    name: "Arc USDC 总量首次观察值超过阈值",
    description: "截止块后由 resolver 首次读取 USDC.totalSupply()，并与历史校准阈值比较。",
    paramsEncoding: "abi.encode(uint256 thresholdUsdc6)",
    schemaHash: SUPPLY_SCHEMA_HASH,
    validateParams: (params) => { decodeAbiParameters([{ type: "uint256" }], params); },
    renderStatement: (params) => {
      const [threshold] = decodeAbiParameters([{ type: "uint256" }], params);
      return `截止块后首次观察到的 Arc USDC 总量高于 ${threshold}（六位精度）`;
    },
    calibrateParams: async ({ cutoffBlock, deadlineBlock }) => {
      const source = new ArcReplaySource(client, usdcAddress);
      const horizonBlocks = deadlineBlock - cutoffBlock + 1n;
      const [snapshot, history] = await Promise.all([
        source.readCutoffSnapshot(cutoffBlock, 1),
        source.readCalibrationHistory(cutoffBlock, horizonBlocks, CALIBRATION_SAMPLES, CALIBRATION_STEP),
      ]);
      const calibrated = calibrateThreshold({
        cutoffBlock,
        currentValue: snapshot.cutoff.totalSupply,
        horizonBlocks,
        history,
        minimumBaseRateBps: 3_500,
        maximumBaseRateBps: 6_500,
      });
      if (!calibrated.suitable) return calibrated;
      return {
        suitable: true as const,
        params: encodeAbiParameters([{ type: "uint256" }], [calibrated.threshold]),
        method: "historical-threshold-quantile-v1",
        sampleCount: calibrated.sampleCount,
        yesCount: calibrated.yesCount,
        empiricalBaseRateBps: calibrated.empiricalBaseRateBps,
        historyStartBlock: calibrated.historyStartBlock,
        historyEndBlock: calibrated.historyEndBlock,
        horizonBlocks: calibrated.horizonBlocks,
      };
    },
  };
}

