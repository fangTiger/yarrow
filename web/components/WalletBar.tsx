import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { erc20WalletAbi } from "../../src/frontend/abis.js";
import { ARC_CHAIN_ID, ARC_FAUCET_URL, USDC_TOKEN_ADDRESS } from "../../src/frontend/wallet.js";
import { walletSummary } from "../lib/wallet-summary.js";

interface WalletRenderProps {
  account?: { address: string };
  chain?: { id: number };
  mounted: boolean;
  openConnectModal: () => void;
  openChainModal: () => void;
  openAccountModal: () => void;
}
export function WalletBar() {
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
        account, chain, mounted, openConnectModal, openChainModal, openAccountModal,
      }: WalletRenderProps) => {
        const summary = walletSummary({
          ...(mounted && account ? { address: account.address } : {}),
          ...(chain ? { chainId: chain.id } : {}),
          ...(balance === undefined ? {} : { balanceUsdc6: balance }),
        });
        const action = summary.state === "disconnected" ? openConnectModal
          : summary.state === "wrong-chain" ? openChainModal : openAccountModal;
        return (
          <div className="wallet-bar">
            <button className="wallet-button" onClick={action} type="button">
              <span>{summary.label}</span>
              {summary.state === "connected" ? (
                <span className="wallet-details">{summary.balance} · {summary.network}</span>
              ) : null}
            </button>
            {summary.showFaucet ? (
              <a className="wallet-faucet" href={ARC_FAUCET_URL} rel="noreferrer" target="_blank">
                领取测试币
              </a>
            ) : null}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
