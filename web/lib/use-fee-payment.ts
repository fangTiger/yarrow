// web/lib/use-fee-payment.ts
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useState } from "react";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { divinerVaultAbi, erc20WalletAbi } from "../../src/frontend/abis.js";
import { formatUsdc6, USDC_TOKEN_ADDRESS } from "../../src/frontend/wallet.js";
import {
  buildQuestionFeePlan,
  type QuestionFeeProof,
} from "../../src/oracle/fee-payment.js";
import { planFeePayment, PREFLIGHT_GAS_UNITS } from "./fee-plan.js";
import { ARC_CHAIN_ID, arcTestnet } from "./wagmi.js";

function atomicMessage(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/atomic|wallet_sendCalls|method.*(?:not found|support)|capabilit/iu.test(message)) {
    return new Error(
      "当前钱包不支持原子批量交易。为保证三易卦金账户要么全部收款、"
        + "要么全部不收，本次没有扣款。",
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error("付款未完成，本次没有扣款");
}
export function useFeePayment() {
  const { address, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID });
  const { data: walletClient, refetch } = useWalletClient({ chainId: ARC_CHAIN_ID });
  const [estimatedGasWei18, setEstimatedGasWei18] = useState<bigint>();
  const pay = useCallback(async (): Promise<QuestionFeeProof> => {
    if (!address) {
      openConnectModal?.();
      throw new Error("请先连接钱包，再支付卦金");
    }
    if (chainId !== ARC_CHAIN_ID) await switchChainAsync({ chainId: ARC_CHAIN_ID });
    const activeWallet = walletClient ?? (await refetch()).data;
    if (!activeWallet || !publicClient) throw new Error("钱包尚未准备好，请稍后重试");
    const base = buildQuestionFeePlan();
    const [erc20Balance, nativeBalance, gasPrice, ...allowances] = await Promise.all([
      publicClient.readContract({
        address: USDC_TOKEN_ADDRESS,
        abi: erc20WalletAbi,
        functionName: "balanceOf",
        args: [address],
      }),
      publicClient.getBalance({ address }),
      publicClient.getGasPrice(),
      ...base.approvals.map((share) => publicClient.readContract({
        address: USDC_TOKEN_ADDRESS,
        abi: erc20WalletAbi,
        functionName: "allowance",
        args: [address, share.vault],
      })),
    ]);
    setEstimatedGasWei18(gasPrice * PREFLIGHT_GAS_UNITS);
    const planned = planFeePayment({ erc20Balance, nativeBalance, gasPrice, allowances });
    if (planned.shortfall.missingErc20Usdc6 || planned.shortfall.missingNativeWei18) {
      const amount = formatUsdc6(base.feeUsdc6);
      throw new Error(`支付卦金需要 ${amount} USDC 及少量 gas；当前余额不足`);
    }
    const send = async (calls: ReadonlyArray<{ to: Address; data: Hex }>) => {
      try {
        const bundle = await activeWallet.sendCalls({
          account: address,
          chain: arcTestnet,
          calls,
          forceAtomic: true,
        });
        const status = await activeWallet.waitForCallsStatus({
          id: bundle.id,
          throwOnFailure: true,
          timeout: 90_000,
        });
        if (!status.atomic || status.status !== "success") {
          throw new Error("钱包没有原子确认整组交易");
        }
        const hashes = (status.receipts ?? []).map((item) => item.transactionHash).filter(
          (hash): hash is Hex => typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/u.test(hash),
        );
        if (!hashes.length) throw new Error("钱包未返回可核验的交易哈希");
        return { id: bundle.id, hashes };
      } catch (error) { throw atomicMessage(error); }
    };
    if (planned.missingApprovals.length) {
      await send(planned.missingApprovals.map((share) => ({
        to: USDC_TOKEN_ADDRESS,
        data: encodeFunctionData({
          abi: erc20WalletAbi,
          functionName: "approve",
          args: [share.vault, share.amountUsdc6],
        }),
      })));
    }
    const paid = await send(planned.depositCalls.map((call) => ({
      to: call.vault,
      data: encodeFunctionData({ abi: divinerVaultAbi, functionName: "deposit", args: [call.amount] }),
    })));
    return { payer: address, bundleId: paid.id, transactionHashes: paid.hashes };
  }, [address, chainId, openConnectModal, publicClient, refetch, switchChainAsync, walletClient]);
  return { pay, estimatedGasWei18 };
}
