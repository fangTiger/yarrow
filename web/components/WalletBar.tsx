import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useSwitchChain } from "wagmi";
import { erc20WalletAbi } from "../../src/frontend/abis.js";
import { ARC_CHAIN_ID, USDC_TOKEN_ADDRESS } from "../../src/frontend/wallet.js";
import { walletSummary } from "../lib/wallet-summary.js";
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
        return (
          <div className="wallet-bar">
            <button className="wallet-button" onClick={action} type="button">
              <span>{summary.label}</span>
              {summary.state === "connected" ? (
                <span className="wallet-details">{summary.balance} · {summary.network}</span>
              ) : null}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
