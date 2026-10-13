import { useState } from "react";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { erc20WalletAbi } from "../../src/frontend/abis.js";
import { ARC_FAUCET_URL, USDC_TOKEN_ADDRESS } from "../../src/frontend/wallet.js";
import { ARC_CHAIN_ID, ARC_NETWORK } from "../lib/wagmi.js";
import { useT } from "../lib/i18n.js";
import { isMobileBrowser, metaMaskDeepLink } from "../lib/wallet-guide.js";
import { walletSummary } from "../lib/wallet-summary.js";

/** 钱包安装、切网与领测试币说明只放在付款区，避免挤占顶栏。 */
export function WalletPaymentGuide() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: erc20WalletAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: Boolean(address) && chainId === ARC_CHAIN_ID, refetchInterval: 10_000 },
  });
  const summary = walletSummary({
    ...(address ? { address } : {}), ...(chainId ? { chainId } : {}),
    ...(balance === undefined ? {} : { balanceUsdc6: balance }),
  }, t, ARC_NETWORK);
  const injected = typeof window !== "undefined" && "ethereum" in window;
  const mobile = typeof navigator !== "undefined" && isMobileBrowser(navigator.userAgent);
  const pageUrl = typeof location === "undefined" ? "https://yarrow.example/" : location.href;
  if (summary.state === "disconnected" && !injected) {
    return <div className="wallet-guide"><span>{t(mobile ? "wallet.mobile" : "wallet.install")}</span>
      <a href={mobile ? metaMaskDeepLink(pageUrl) : "https://metamask.io/download/"}
        rel="noreferrer" target="_blank">{t(mobile ? "wallet.mobileLink" : "wallet.installLink")}</a></div>;
  }
  if (summary.state === "wrong-chain") {
    return <div className="wallet-guide">
      <span>{t(ARC_NETWORK.mainnet ? "wallet.switchHelpMainnet" : "wallet.switchHelp")}</span>
      <button onClick={() => switchChain({ chainId: ARC_CHAIN_ID })} type="button">{summary.label}</button>
    </div>;
  }
  const copyAddress = <button onClick={() => {
    void navigator.clipboard?.writeText(address ?? "");
    setCopied(true);
  }} type="button">{t(copied ? "wallet.copied" : "wallet.copyAddress")}</button>;
  if (summary.showFunding) {
    // 主网没有水龙头：说明需要准备的 USDC，并方便复制地址去转账。
    return <div className="wallet-guide wallet-zero"><span>{t("wallet.fundNotice")}</span>{copyAddress}</div>;
  }
  if (!summary.showFaucet) return null;
  return <div className="wallet-guide wallet-zero"><span>{t("wallet.testnetNotice")}</span>
    <span>{t("wallet.faucetHelp")}</span>{copyAddress}
    <a className="wallet-faucet" href={ARC_FAUCET_URL} rel="noreferrer" target="_blank">
      {t("wallet.faucet")}</a></div>;
}
