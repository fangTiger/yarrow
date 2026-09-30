import { readFile } from "node:fs/promises";

import { createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { requireArcPrivateKey } from "../src/transaction-probe.js";
import { deriveRolePrivateKey, USDC_ADDRESS } from "../src/yijing-deployment.js";

const RETURN_AMOUNT = 500_000n;
const DEPLOYMENT_PATH = "deployments/arc-testnet.json";

interface Manifest {
  network: { chainId: number };
  accounts: { deployer: Address; querent: Address };
}

async function main(): Promise<void> {
  const manifest = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Manifest;
  if (manifest.network.chainId !== ARC_CHAIN_ID) throw new Error("部署清单 Chain ID 不匹配");
  const basePrivateKey = requireArcPrivateKey(process.env);
  const deployer = privateKeyToAccount(basePrivateKey);
  const querent = privateKeyToAccount(deriveRolePrivateKey(basePrivateKey, "querent"));
  if (
    deployer.address.toLowerCase() !== manifest.accounts.deployer.toLowerCase()
    || querent.address.toLowerCase() !== manifest.accounts.querent.toLowerCase()
  ) throw new Error("部署清单角色与确定性派生账户不一致");

  const publicClient = createArcPublicClient();
  const erc20 = await loadProbeArtifact("contracts/out/IERC20.sol/IERC20.json");
  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20.abi,
    functionName: "balanceOf",
    args: [querent.address],
  }) as bigint;
  if (balance < RETURN_AMOUNT + 10_000n) throw new Error("测试提问者余额不足以归集且保留 gas 垫");
  const simulation = await publicClient.simulateContract({
    account: querent,
    address: USDC_ADDRESS,
    abi: erc20.abi,
    functionName: "transfer",
    args: [deployer.address, RETURN_AMOUNT],
  } as never);
  const wallet = createWalletClient({ account: querent, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });
  const hash = await wallet.writeContract({ ...simulation.request, account: querent } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("测试余额归集交易回滚");
  const deployerBalance = await publicClient.getBalance({ address: deployer.address });
  console.log(`测试退款余额归集：0.500000 USDC；交易=${hash}`);
  console.log(`部署者链上余额：${deployerBalance} wei（18 位原生 USDC）`);
}

await main();
