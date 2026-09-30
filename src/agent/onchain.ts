import type { Account, Address, Chain, Hex, PublicClient, Transport, WalletClient } from "viem";

import type {
  PredictionSubmission,
  PredictionSubmitter,
  SubmissionReceipt,
} from "./orchestrator.js";
import type { DivinerKey } from "./diviners.js";

const PREDICTION_BOOK_ABI = [
  {
    type: "function",
    name: "submitPrediction",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "roundId", type: "uint256" },
          { name: "direction", type: "bool" },
          { name: "probabilityBps", type: "uint16" },
          { name: "predicateId", type: "bytes32" },
          { name: "params", type: "bytes" },
          { name: "deadline", type: "uint64" },
          { name: "modelId", type: "bytes32" },
          { name: "promptHash", type: "bytes32" },
          { name: "schemaHash", type: "bytes32" },
          { name: "providerConfigHash", type: "bytes32" },
          { name: "attemptCount", type: "uint16" },
        ],
      },
    ],
    outputs: [
      { name: "predictionId", type: "uint256" },
      { name: "accepted", type: "bool" },
    ],
  },
] as const;

export interface DivinerSigner {
  account: Account;
  wallet: WalletClient<Transport, Chain, Account>;
}

export interface ViemPredictionSubmitterOptions {
  publicClient: PublicClient;
  predictionBook: Address;
  signers: Readonly<Record<DivinerKey, DivinerSigner>>;
  beforeSend?: (input: {
    estimatedGas: bigint;
    gasPriceWei: bigint;
    signerBalanceWei: bigint;
  }) => void;
  onConfirmedGasCost?: (gasCostWei: bigint) => void;
}

export class ViemPredictionSubmitter implements PredictionSubmitter {
  constructor(private readonly options: ViemPredictionSubmitterOptions) {}

  async submit(submission: PredictionSubmission): Promise<SubmissionReceipt> {
    const signer = this.options.signers[submission.divinerKey];
    const simulation = await this.options.publicClient.simulateContract({
      account: signer.account,
      address: this.options.predictionBook,
      abi: PREDICTION_BOOK_ABI,
      functionName: "submitPrediction",
      args: [{
        roundId: submission.roundId,
        direction: submission.direction,
        probabilityBps: submission.probabilityBps,
        predicateId: submission.predicateId,
        params: submission.params,
        deadline: submission.deadline,
        modelId: submission.modelId,
        promptHash: submission.promptHash,
        schemaHash: submission.schemaHash,
        providerConfigHash: submission.providerConfigHash,
        attemptCount: submission.attemptCount,
      }],
    });
    const [predictionId, accepted] = simulation.result;
    if (!accepted) throw new Error(`${submission.divinerKey} 的金库拒绝应卦，本轮不会重新推理`);
    if (this.options.beforeSend) {
      const [estimatedGas, gasPriceWei, signerBalanceWei] = await Promise.all([
        this.options.publicClient.estimateContractGas({
          ...simulation.request,
          account: signer.account,
        }),
        this.options.publicClient.getGasPrice(),
        this.options.publicClient.getBalance({ address: signer.account.address }),
      ]);
      this.options.beforeSend({ estimatedGas, gasPriceWei, signerBalanceWei });
    }
    const transactionHash = await signer.wallet.writeContract({
      ...simulation.request,
      account: signer.account,
    });
    const receipt = await this.options.publicClient.waitForTransactionReceipt({ hash: transactionHash });
    if (receipt.status !== "success") throw new Error(`${submission.divinerKey} 的预测提交交易回滚`);
    const gasCostWei = receipt.gasUsed * receipt.effectiveGasPrice;
    this.options.onConfirmedGasCost?.(gasCostWei);
    return {
      transactionHash,
      blockNumber: receipt.blockNumber,
      predictionId,
      gasUsed: receipt.gasUsed,
      gasCostWei,
    };
  }
}

export { PREDICTION_BOOK_ABI };
