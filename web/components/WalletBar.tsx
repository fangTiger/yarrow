import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { erc20WalletAbi } from "../../src/frontend/abis.js";
import { ARC_CHAIN_ID, ARC_FAUCET_URL, USDC_TOKEN_ADDRESS } from "../../src/frontend/wallet.js";
import { walletSummary } from "../lib/wallet-summary.js";
import { isMobileBrowser, metaMaskDeepLink } from "../lib/wallet-guide.js";
import { useState } from "react";
import { useT } from "../lib/i18n.js";

interface WalletRenderProps {
  account?: { address: string };
  chain?: { id: number };
  mounted: boolean;
  openConnectModal: () => void;
  openAccountModal: () => void;
}
export function WalletBar() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const { switchChain } = useSwitchChain();
  const { address, chainId } = useAccount();
  const { data: balance } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: erc20WalletAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: Boolean(address) && chainId === ARC_CHAIN_ID, refetchInterval: 10_000 },
  });
  return (
    <ConnectButton.Custom>
      {({
        account, chain, mounted, openConnectModal, openAccountModal,
      }: WalletRenderProps) => {
        const summary = walletSummary({
          ...(mounted && account ? { address: account.address } : {}),
          ...(chain ? { chainId: chain.id } : {}),
          ...(balance === undefined ? {} : { balanceUsdc6: balance }),
        }, t);
        const action = summary.state === "disconnected" ? openConnectModal
          : summary.state === "wrong-chain" ? () => switchChain({ chainId: ARC_CHAIN_ID }) : openAccountModal;
        const injected = typeof window !== "undefined" && "ethereum" in window;
        const mobile = typeof navigator !== "undefined" && isMobileBrowser(navigator.userAgent);
        const pageUrl = typeof location === "undefined" ? "https://yarrow.example/" : location.href;
        return (
          <div className="wallet-bar">
            <button className="wallet-button" onClick={action} type="button">
              <span>{summary.label}</span>
              {summary.state === "connected" ? (
                <span className="wallet-details">{summary.balance} · {summary.network}</span>
              ) : null}
            </button>
            {summary.state === "disconnected" && !injected ? (
              <div className="wallet-guide">
                <span>{t(mobile ? "wallet.mobile" : "wallet.install")}</span>
                <a
                  href={mobile ? metaMaskDeepLink(pageUrl) : "https://metamask.io/download/"}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t(mobile ? "wallet.mobileLink" : "wallet.installLink")}
                </a>
              </div>
            ) : null}
            {summary.state === "wrong-chain" ? (
              <div className="wallet-guide"><span>{t("wallet.switchHelp")}</span></div>
            ) : null}
            {summary.showFaucet ? (
              <div className="wallet-guide wallet-zero">
                <span>{t("wallet.testnetNotice")}</span>
                <span>{t("wallet.faucetHelp")}</span>
                <button onClick={() => {
                  void navigator.clipboard?.writeText(account?.address ?? address ?? "");
                  setCopied(true);
                }} type="button">{t(copied ? "wallet.copied" : "wallet.copyAddress")}</button>
                <a className="wallet-faucet" href={ARC_FAUCET_URL} rel="noreferrer" target="_blank">
                  {t("wallet.faucet")}
                </a>
              </div>
            ) : null}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
