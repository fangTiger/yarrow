import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAccount, getWalletClient, watchAccount } from "@wagmi/core";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { useConfig, usePublicClient, useSwitchChain } from "wagmi";
import { erc20WalletAbi } from "../../src/frontend/abis.js";
import type { SanyiFeeProof } from "../../src/sanyi/fee.js";
import { api, type PaymentConfiguration } from "./api.js";
import { planFeePayment, PREFLIGHT_GAS_UNITS } from "./fee-plan.js";
import { walletErrorMessage } from "./wallet-errors.js";
import { ARC_CHAIN_ID, arcTestnet } from "./wagmi.js";

export function useFeePayment() {
  const config = useConfig();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID });
  const [payment, setPayment] = useState<PaymentConfiguration>();
  const [estimatedGasWei18, setEstimatedGasWei18] = useState<bigint>();
  const [connectionMessage, setConnectionMessage] = useState("");
  useEffect(() => {
    let active = true;
    void api.getPayment().then((value) => {
      if (active) {
        setPayment(value);
      }
    }).catch(() => {});
    if (publicClient) {
      void publicClient.getGasPrice().then((price) => {
        if (active) {
          setEstimatedGasWei18(price * PREFLIGHT_GAS_UNITS);
        }
      }).catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [publicClient]);
  const pay = useCallback(async (): Promise<SanyiFeeProof> => {
    try {
      let payer = getAccount(config).address;
      if (!payer) {
        if (!openConnectModal) {
          throw new Error("钱包连接界面尚未准备好");
        }
        setConnectionMessage("请连接钱包，连接后将继续付款");
        // 订阅连接结果，继续本次问卦，避免要求用户再点击付款。
        payer = await new Promise<Address>((resolve, reject) => {
          const timeout = setTimeout(() => {
            unsubscribe();
            reject(new Error("钱包连接超时，请重试"));
          }, 60_000);
          const unsubscribe = watchAccount(config, {
            onChange(account) {
              if (account.address && account.status === "connected") {
                clearTimeout(timeout);
                unsubscribe();
                resolve(account.address);
              }
            },
          });
          openConnectModal();
        });
      }
      setConnectionMessage("");
      if (getAccount(config).chainId !== ARC_CHAIN_ID) {
        await switchChainAsync({ chainId: ARC_CHAIN_ID });
      }
      if (!publicClient) {
        throw new Error("钱包尚未准备好，请稍后重试");
      }
      const info = await api.getPayment();
      setPayment(info);
      const [erc20Balance, nativeBalance, gasPrice] = await Promise.all([
        publicClient.readContract({ address: info.token, abi: erc20WalletAbi,
          functionName: "balanceOf", args: [payer] }),
        publicClient.getBalance({ address: payer }),
        publicClient.getGasPrice(),
      ]);
      setEstimatedGasWei18(gasPrice * PREFLIGHT_GAS_UNITS);
      const planned = planFeePayment({ erc20Balance, nativeBalance, gasPrice });
      if (planned.shortfall.missingErc20Usdc6 || planned.shortfall.missingNativeWei18) {
        throw new Error("余额不足");
      }
      // 切网和连接完成后重新取得钱包，避免使用旧网络的客户端。
      const walletClient = await getWalletClient(config, { chainId: ARC_CHAIN_ID });
      const transactionHash = await walletClient.writeContract({
        account: payer, chain: arcTestnet, address: info.token, abi: erc20WalletAbi,
        functionName: "transfer", args: [info.recipient, BigInt(info.amountUsdc6)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash, timeout: 60_000,
      });
      if (receipt.status !== "success") {
        throw new Error("卦金交易失败");
      }
      return { payer, transactionHash: receipt.transactionHash };
    } catch (error) {
      setConnectionMessage("");
      throw new Error(walletErrorMessage(error), { cause: error });
    }
  }, [config, openConnectModal, publicClient, switchChainAsync]);
  return { pay, payment, estimatedGasWei18, connectionMessage };
}
