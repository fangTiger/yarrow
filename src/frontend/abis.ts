import { parseAbi } from "viem";

export const divinationRegistryAbi = parseAbi([
  "function nextRoundId() view returns (uint256)",
  "function computeCommitment(string question,bytes32 salt,address sender,uint256 roundId) view returns (bytes32)",
  "function commit(bytes32 commitment,uint256 fee,uint256 bond,uint256 expectedRoundId) returns (uint256)",
  "function reveal(uint256 roundId,string question,bytes32 salt)",
  "function getRound(uint256 roundId) view returns ((bytes32 commitment,address querent,uint64 commitBlock,uint64 revealDeadline,uint256 fee,uint256 bond,bytes32 seed,uint8[6] lines,uint8 primaryHex,uint8 derivedHex,uint8 state))",
  "function kingWenNumber(uint8 binaryIndex) pure returns (uint8)",
  "event Revealed(uint256 indexed roundId, bytes32 seed, string question)",
]);

export const predictionBookAbi = parseAbi([
  "function getPrediction(uint256 predictionId) view returns ((uint256 roundId,address diviner,bool direction,uint16 probabilityBps,uint16 multiplier,uint256 reserved,bytes32 predicateId,bytes params,uint64 deadline,bytes32 modelId,bytes32 promptHash,bytes32 schemaHash,bytes32 providerConfigHash,uint16 attemptCount))",
  "function stateOf(uint256 predictionId) view returns (uint8)",
  "function settle(uint256 predictionId) returns (int256 delta)",
  "event PredictionSubmitted(uint256 indexed predictionId, uint256 indexed roundId, address indexed diviner)",
  "event PredictionSettled(uint256 indexed predictionId, bool outcome, int256 delta)",
]);

export const erc20WalletAbi = parseAbi([
  "function transfer(address to,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const scoreBookAbi = parseAbi([
  "function getStats(address diviner) view returns ((uint64 sampleCount,uint64 correctCount,uint64 unresolvedCount,uint256 totalBrier))",
  "function wilson95(address diviner) view returns (uint16 lowerBps, uint16 upperBps)",
  "function historyCount(address diviner) view returns (uint256)",
  "function getHistory(address diviner,uint256 index) view returns ((uint256 predictionId,uint256 roundId,uint16 probabilityBps,uint256 brier,bool outcome,bool correct,bool unresolved))",
  "function getBacktestStats(address diviner) view returns ((uint64 sampleCount,uint64 correctCount,uint64 unresolvedCount,uint256 totalBrier))",
  "function backtestWilson95(address diviner) view returns (uint16 lowerBps, uint16 upperBps)",
  "function brierSkill(address diviner) view returns (uint16 empiricalBaseRateBps,uint256 constantBaselineBrier,int256 bss,bool isDefined)",
  "function backtestBrierSkill(address diviner) view returns (uint16 empiricalBaseRateBps,uint256 constantBaselineBrier,int256 bss,bool isDefined)",
]);

export const divinerVaultAbi = parseAbi([
  "function deposit(uint256 amount)",
  "function totalAssets() view returns (uint256)",
  "function availableBalance() view returns (uint256)",
  "function state() view returns (uint8)",
]);
