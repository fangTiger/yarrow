import {
  createWalletClient,
  decodeEventLog,
  http,
  type Abi,
  type Account,
  type Address,
  type Hex,
  type HttpTransport,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadProbeArtifact } from "../src/artifact.js";
import { ARC_CHAIN_ID, ARC_RPC_URL, arcTestnet, createArcPublicClient } from "../src/arc.js";
import { findMaxHistoryDistance } from "../src/history-window.js";
import { buildReport, reportTimestamp, writeReport, type ProbeResult } from "../src/report.js";
import { errorMessage } from "../src/revert.js";
import {
  calculateRequiredBalance,
  classifyInnerCall,
  classifyPrevRandaoSamples,
  classifyProbeError,
  classifyReceiptStatus,
  completeTransactionResults,
  deriveFreshAddress,
  EIP2935_DOCUMENTED_WINDOW,
  finalizeDrainResult,
  historyHashForWindowSearch,
  historyProbeCeiling,
  requireArcPrivateKey,
  validateFreshAddress,
} from "../src/transaction-probe.js";

const FUNDING_PER_ENTRY = 10_000_000_000_000n;
const TRANSFER_AMOUNT = 1_000_000_000_000n;
const CONSERVATIVE_GAS_UNITS = 2_000_000n;

interface TransferEventResult {
  success: boolean;
  returnData: Hex;
  amount: bigint;
  recipient: Address;
}

type ArcWalletClient = WalletClient<HttpTransport, typeof arcTestnet, Account>;

async function recoverReceiptRevertReason(
  publicClient: ReturnType<typeof createArcPublicClient>,
  hash: Hex,
  blockNumber: bigint,
): Promise<string> {
  try {
    const transaction = await publicClient.getTransaction({ hash });
    try {
      await publicClient.call({
        account: transaction.from,
        ...(transaction.to ? { to: transaction.to } : {}),
        data: transaction.input,
        value: transaction.value,
        blockNumber,
      });
      return "receipt 显示回滚，但同块 eth_call 重放未返回原因";
    } catch (error) {
      return errorMessage(error);
    }
  } catch (error) {
    return `无法读取并重放回滚交易：${errorMessage(error)}`;
  }
}

function decodeTransferEvent(receipt: TransactionReceipt, abi: Abi, contractAddress: Address): TransferEventResult | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true });
      if (decoded.eventName !== "TransferProbe") continue;
      const args = decoded.args as unknown as {
        recipient: Address;
        amount: bigint;
        success: boolean;
        returnData: Hex;
      };
      return { recipient: args.recipient, amount: args.amount, success: args.success, returnData: args.returnData };
    } catch {
      // 非目标事件无需作为失败处理。
    }
  }
  return null;
}

async function runReceiveProbe(
  publicClient: ReturnType<typeof createArcPublicClient>,
  walletClient: ArcWalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  contractAddress: Address,
): Promise<ProbeResult> {
  console.log("正在验证 1/8：receive 与 fallback 接收原生 USDC");
  try {
    const before = await publicClient.getBalance({ address: contractAddress });
    const receiveHash = await walletClient.sendTransaction({ account, to: contractAddress, value: FUNDING_PER_ENTRY });
    const receiveReceipt = await publicClient.waitForTransactionReceipt({ hash: receiveHash });
    const fallbackHash = await walletClient.sendTransaction({
      account,
      to: contractAddress,
      value: FUNDING_PER_ENTRY,
      data: "0xdeadbeef",
    });
    const fallbackReceipt = await publicClient.waitForTransactionReceipt({ hash: fallbackHash });
    const after = await publicClient.getBalance({ address: contractAddress });
    const expectedAfter = before + FUNDING_PER_ENTRY * 2n;
    const receiptReasons: string[] = [];
    if (receiveReceipt.status === "reverted") {
      receiptReasons.push(`receive：${await recoverReceiptRevertReason(publicClient, receiveHash, receiveReceipt.blockNumber)}`);
    }
    if (fallbackReceipt.status === "reverted") {
      receiptReasons.push(`fallback：${await recoverReceiptRevertReason(publicClient, fallbackHash, fallbackReceipt.blockNumber)}`);
    }
    const passed = receiveReceipt.status === "success" && fallbackReceipt.status === "success" && after === expectedAfter;
    const receiptClassification = classifyReceiptStatus(
      receiptReasons.length === 0 ? "success" : "reverted",
      receiptReasons.join("；"),
    );
    return {
      id: "1-native-receive",
      title: "receive/fallback 接收原生 USDC",
      status: passed ? "PASS" : receiptClassification.status === "REVERT" ? "REVERT" : "FAIL",
      expected: "两个入口均成功，合约余额增加两笔 msg.value",
      observed: passed ? "receive 与 fallback 均成功，余额增量精确" : receiptReasons.length > 0 ? "至少一个接收入口回滚" : "余额增量不符合预期",
      ...(!passed && receiptClassification.reason ? { reason: receiptClassification.reason } : {}),
      txHash: `${receiveHash}, ${fallbackHash}`,
      details: {
        receiveStatus: receiveReceipt.status,
        fallbackStatus: fallbackReceipt.status,
        before,
        after,
        expectedAfter,
        valuePerEntry: FUNDING_PER_ENTRY,
      },
    };
  } catch (error) {
    return {
      id: "1-native-receive",
      title: "receive/fallback 接收原生 USDC",
      status: classifyProbeError(error),
      observed: "接收探针未完成",
      reason: errorMessage(error),
    };
  }
}

async function runTransferProbe(
  publicClient: ReturnType<typeof createArcPublicClient>,
  walletClient: ArcWalletClient,
  account: ReturnType<typeof privateKeyToAccount>,
  abi: Abi,
  contractAddress: Address,
  functionName: "probeTransferExisting" | "probeTransferFresh" | "probeDrain",
  args: readonly unknown[],
  id: string,
  title: string,
  expected: string,
  extraDetails: Record<string, unknown> = {},
): Promise<ProbeResult> {
  try {
    const simulation = await publicClient.simulateContract({
      account,
      address: contractAddress,
      abi,
      functionName,
      args,
    });
    const hash = await walletClient.writeContract(simulation.request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      const reason = await recoverReceiptRevertReason(publicClient, hash, receipt.blockNumber);
      return { id, title, status: "REVERT", expected, observed: "外层交易回滚", reason, txHash: hash };
    }
    const event = decodeTransferEvent(receipt, abi, contractAddress);
    if (!event) {
      return { id, title, status: "FAIL", expected, observed: "交易成功但未找到 TransferProbe 事件", txHash: hash };
    }
    const classification = classifyInnerCall(event.success, event.returnData);
    return {
      id,
      title,
      status: classification.status,
      expected,
      observed: event.success ? `内部 call 成功，转出 ${event.amount} 原生最小单位` : "内部 call 被链拒绝并由合约捕获",
      ...(classification.reason ? { reason: classification.reason } : {}),
      txHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      details: { ...extraDetails, recipient: event.recipient, amount: event.amount, returnData: event.returnData },
    };
  } catch (error) {
    return { id, title, status: classifyProbeError(error), expected, observed: "探针调用未完成", reason: errorMessage(error) };
  }
}

async function runBalanceScaleProbe(
  publicClient: ReturnType<typeof createArcPublicClient>,
  abi: Abi,
  contractAddress: Address,
): Promise<ProbeResult> {
  console.log("正在验证 5/8：原生 18 位与 ERC-20 6 位余额换算");
  try {
    const value = (await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "probeBalanceScale",
    })) as unknown as readonly [boolean, bigint, bigint, bigint, boolean, Hex];
    const [readSuccess, nativeBalance, erc20Balance, scaledErc20Balance, exactMatch, returnData] = value;
    return {
      id: "5-balance-scale",
      title: "原生余额与 ERC-20 余额换算",
      status: !readSuccess ? "REVERT" : exactMatch ? "PASS" : "FAIL",
      expected: "address(this).balance == balanceOf(this) * 1e12",
      observed: !readSuccess ? "USDC ERC-20 balanceOf 调用回滚" : exactMatch ? "18 位与 6 位余额精确对应" : "余额换算不一致",
      ...(!readSuccess ? { reason: `ERC-20 返回数据：${returnData}` } : {}),
      details: { readSuccess, nativeBalance, erc20Balance, scaledErc20Balance, exactMatch, returnData },
    };
  } catch (error) {
    return {
      id: "5-balance-scale",
      title: "原生余额与 ERC-20 余额换算",
      status: classifyProbeError(error),
      observed: "余额对比调用未完成",
      reason: errorMessage(error),
    };
  }
}

async function runHistoryWindowProbe(
  publicClient: ReturnType<typeof createArcPublicClient>,
  abi: Abi,
  contractAddress: Address,
): Promise<ProbeResult> {
  console.log("正在验证 6/8：EIP-2935 历史窗口上界");
  try {
    const currentBlock = await publicClient.getBlockNumber();
    const maxDistance = historyProbeCeiling(currentBlock);
    const failedReads: Array<{ distance: number; returnData: Hex }> = [];
    const window = await findMaxHistoryDistance(maxDistance, async (distance) => {
      const value = (await publicClient.readContract({
        address: contractAddress,
        abi,
        functionName: "probeHistoryHash",
        args: [BigInt(distance)],
      })) as unknown as readonly [bigint, boolean, Hex, Hex];
      if (!value[1]) failedReads.push({ distance, returnData: value[3] });
      return historyHashForWindowSearch(value[1], value[2]);
    });
    const boundaryConfirmed =
      window.maxValidDistance === EIP2935_DOCUMENTED_WINDOW &&
      window.firstInvalidDistance === EIP2935_DOCUMENTED_WINDOW + 1;
    return {
      id: "6-eip2935-window",
      title: "EIP-2935 历史哈希有效窗口",
      status: boundaryConfirmed ? "PASS" : "FAIL",
      expected: `在距离 1 至 ${maxDistance} 内二分，确认 8191 有效且 8192 无效`,
      observed:
        window.maxValidDistance === null
          ? "距离 1 也没有非零哈希"
          : `最大有效距离 ${window.maxValidDistance}${window.firstInvalidDistance ? `，第一个无效距离 ${window.firstInvalidDistance}` : "，探测上界仍有效"}`,
      details: { currentBlock, ...window, failedReads },
    };
  } catch (error) {
    return {
      id: "6-eip2935-window",
      title: "EIP-2935 历史哈希有效窗口",
      status: classifyProbeError(error),
      observed: "历史窗口二分探测未完成",
      reason: errorMessage(error),
    };
  }
}

async function runPrevRandaoProbe(
  publicClient: ReturnType<typeof createArcPublicClient>,
  abi: Abi,
  contractAddress: Address,
  deploymentBlock: bigint,
): Promise<ProbeResult> {
  console.log("正在验证 7/8：跨五个块高采样 PREVRANDAO");
  try {
    const minimumSamples = 5;
    const deadline = Date.now() + 10_000;
    let latestBlock = await publicClient.getBlockNumber();
    while (latestBlock < deploymentBlock + BigInt(minimumSamples - 1) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      latestBlock = await publicClient.getBlockNumber();
    }
    const firstBlock = latestBlock >= deploymentBlock + 4n ? latestBlock - 4n : deploymentBlock;
    const blockNumbers = Array.from(
      { length: Number(latestBlock - firstBlock + 1n) },
      (_unused, index) => firstBlock + BigInt(index),
    );
    const samples = await Promise.all(
      blockNumbers.map(async (blockNumber) => ({
        blockNumber,
        value: (await publicClient.readContract({
          address: contractAddress,
          abi,
          functionName: "probePrevRandao",
          blockNumber,
        })) as bigint,
      })),
    );
    const classification = classifyPrevRandaoSamples(samples, minimumSamples);
    return {
      id: "7-prevrandao",
      title: "PREVRANDAO 多块零值验证",
      status: classification.passed ? "PASS" : "FAIL",
      expected: "至少五个不同块高的 block.prevrandao 均为 0",
      observed: classification.reason,
      details: { samples },
    };
  } catch (error) {
    return {
      id: "7-prevrandao",
      title: "PREVRANDAO 多块零值验证",
      status: classifyProbeError(error),
      observed: "PREVRANDAO 调用未完成",
      reason: errorMessage(error),
    };
  }
}

async function runBlockHashComparisonProbe(
  publicClient: ReturnType<typeof createArcPublicClient>,
  abi: Abi,
  contractAddress: Address,
): Promise<ProbeResult> {
  console.log("正在验证 8/8：BLOCKHASH 与 EIP-2935 对比");
  try {
    const value = (await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "probePreviousBlockHashComparison",
    })) as unknown as readonly [bigint, Hex, boolean, Hex, boolean, Hex];
    const [targetBlock, opcodeHash, historyReadSuccess, historyHash, matches, returnData] = value;
    return {
      id: "8-blockhash-comparison",
      title: "上一块 BLOCKHASH 与 EIP-2935 对比",
      status: !historyReadSuccess ? "REVERT" : matches ? "PASS" : "FAIL",
      expected: "两个来源均返回同一个非零上一块哈希",
      observed: !historyReadSuccess ? "EIP-2935 内部读取回滚" : matches ? "两个来源一致" : "两个来源不一致或返回零值",
      ...(!historyReadSuccess ? { reason: `历史合约返回数据：${returnData}` } : {}),
      details: { targetBlock, opcodeHash, historyReadSuccess, historyHash, matches, returnData },
    };
  } catch (error) {
    return {
      id: "8-blockhash-comparison",
      title: "上一块 BLOCKHASH 与 EIP-2935 对比",
      status: classifyProbeError(error),
      observed: "区块哈希对比未完成",
      reason: errorMessage(error),
    };
  }
}

async function main(): Promise<void> {
  const privateKey = requireArcPrivateKey(process.env);
  const account = privateKeyToAccount(privateKey);
  const artifact = await loadProbeArtifact();
  const publicClient = createArcPublicClient();
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(ARC_RPC_URL, { timeout: 20_000 }) });

  let chainId = ARC_CHAIN_ID;
  let lastKnownBlock: bigint | undefined;
  let interruptionReason: string | undefined;
  const deploymentResults: ProbeResult[] = [];
  const probeResults: ProbeResult[] = [];

  try {
    console.log(`正在连接 Arc Testnet：${ARC_RPC_URL}`);
    const [actualChainId, accountBalance, accountCode, gasPrice] = await Promise.all([
      publicClient.getChainId(),
      publicClient.getBalance({ address: account.address }),
      publicClient.getBytecode({ address: account.address }),
      publicClient.getGasPrice(),
    ]);
    chainId = actualChainId;
    if (chainId !== ARC_CHAIN_ID) throw new Error(`Chain ID 不匹配：期望 ${ARC_CHAIN_ID}，实际 ${chainId}`);
    if (accountCode && accountCode !== "0x") throw new Error("ARC_PRIVATE_KEY 对应地址不是 EOA，无法执行本验证流程");
    const requiredBalance = calculateRequiredBalance(FUNDING_PER_ENTRY, 2, gasPrice, CONSERVATIVE_GAS_UNITS);
    if (accountBalance < requiredBalance) {
      throw new Error(
        `账户原生 USDC 余额不足：实际 ${accountBalance}，至少需要 ${requiredBalance}（两笔注资 + ${CONSERVATIVE_GAS_UNITS} gas 单位保守预算，gasPrice ${gasPrice}）`,
      );
    }
    console.log(`交易账户 ${account.address} 已通过余额与 EOA 前置检查；不会输出私钥`);

    console.log("正在部署 ProbeVault");
    const deploymentHash = await walletClient.deployContract({ account, abi: artifact.abi, bytecode: artifact.bytecode });
    const deploymentReceipt = await publicClient.waitForTransactionReceipt({ hash: deploymentHash });
    lastKnownBlock = deploymentReceipt.blockNumber;
    const contractAddress = deploymentReceipt.contractAddress;
    if (deploymentReceipt.status !== "success" || !contractAddress) {
      const reason = await recoverReceiptRevertReason(publicClient, deploymentHash, deploymentReceipt.blockNumber);
      deploymentResults.push({
        id: "deployment",
        title: "部署 ProbeVault",
        status: "REVERT",
        observed: "部署交易回滚",
        reason,
        txHash: deploymentHash,
        blockNumber: deploymentReceipt.blockNumber.toString(),
      });
      throw new Error(`ProbeVault 部署回滚：${reason}`);
    }
    deploymentResults.push({
      id: "deployment",
      title: "部署 ProbeVault",
      status: "PASS",
      observed: `已部署到 ${contractAddress}`,
      txHash: deploymentHash,
      blockNumber: deploymentReceipt.blockNumber.toString(),
      details: { account: account.address, contractAddress, gasPrice, requiredBalance, conservativeGasUnits: CONSERVATIVE_GAS_UNITS },
    });
    console.log(`ProbeVault 已部署：${contractAddress}`);

    probeResults.push(await runReceiveProbe(publicClient, walletClient, account, contractAddress));

    console.log("正在验证 2/8：向已存在且有余额的 EOA 转账");
    const existingState = {
      balance: await publicClient.getBalance({ address: account.address }),
      nonce: await publicClient.getTransactionCount({ address: account.address }),
      bytecode: await publicClient.getBytecode({ address: account.address }),
    };
    if (existingState.balance === 0n || existingState.nonce === 0 || (existingState.bytecode && existingState.bytecode !== "0x")) {
      probeResults.push({
        id: "2-transfer-existing",
        title: "向已有且有余额的 EOA 转账",
        status: "FAIL",
        expected: "接收方已有 nonce、有余额且无代码",
        observed: "交易账户不满足已有 EOA 前置条件",
        details: existingState,
      });
    } else {
      probeResults.push(
        await runTransferProbe(
          publicClient,
          walletClient,
          account,
          artifact.abi,
          contractAddress,
          "probeTransferExisting",
          [account.address, TRANSFER_AMOUNT],
          "2-transfer-existing",
          "向已有且有余额的 EOA 转账",
          "内部 call 成功",
          existingState,
        ),
      );
    }

    console.log("正在验证 3/8：向全新零状态地址转账");
    const freshAddress = deriveFreshAddress(deploymentHash);
    const freshState = await validateFreshAddress(publicClient, freshAddress);
    if (!freshState.isFresh) {
      probeResults.push({
        id: "3-transfer-fresh",
        title: "向全新零状态地址转账",
        status: "FAIL",
        expected: "调用前地址必须是零余额、零 nonce、无代码",
        observed: "派生地址不满足 fresh 前置条件，未发交易",
        reason: freshState.reason,
        details: { freshAddress, ...freshState },
      });
    } else {
      probeResults.push(
        await runTransferProbe(
          publicClient,
          walletClient,
          account,
          artifact.abi,
          contractAddress,
          "probeTransferFresh",
          [freshAddress, TRANSFER_AMOUNT],
          "3-transfer-fresh",
          "向全新零状态地址转账",
          "Arc 可能拒绝；必须以 PASS 或 REVERT 记录真实结果",
          { freshAddress, ...freshState },
        ),
      );
    }

    probeResults.push(await runBalanceScaleProbe(publicClient, artifact.abi, contractAddress));
    probeResults.push(await runHistoryWindowProbe(publicClient, artifact.abi, contractAddress));
    probeResults.push(await runPrevRandaoProbe(publicClient, artifact.abi, contractAddress, deploymentReceipt.blockNumber));
    probeResults.push(await runBlockHashComparisonProbe(publicClient, artifact.abi, contractAddress));

    console.log("正在验证 4/8：完全清空 ProbeVault 余额");
    let drainResult = await runTransferProbe(
      publicClient,
      walletClient,
      account,
      artifact.abi,
      contractAddress,
      "probeDrain",
      [account.address],
      "4-drain",
      "完全清空合约余额",
      "Arc 可能拒绝；必须以 PASS 或 REVERT 记录真实结果",
    );
    if (drainResult.status === "PASS") {
      const remainingBalance = await publicClient.getBalance({ address: contractAddress });
      drainResult = finalizeDrainResult(drainResult, remainingBalance);
    }
    probeResults.push(drainResult);
  } catch (error) {
    interruptionReason = errorMessage(error);
    console.error(`交易探测流程中断，仍将写出八项报告：${interruptionReason}`);
    if (deploymentResults.length === 0) {
      deploymentResults.push({
        id: "deployment",
        title: "部署 ProbeVault",
        status: classifyProbeError(error),
        observed: "部署前置检查或部署 RPC 未完成",
        reason: interruptionReason,
        details: { account: account.address },
      });
    }
  } finally {
    try {
      lastKnownBlock = await publicClient.getBlockNumber();
    } catch (error) {
      console.error(`无法刷新最终块高，将使用最后已知块高：${errorMessage(error)}`);
    }
    const generatedAt = new Date().toISOString();
    const completedProbeResults = completeTransactionResults(
      probeResults,
      interruptionReason ?? "流程未生成该项结果",
    );
    const report = buildReport({
      reportType: "transaction",
      generatedAt,
      network: {
        name: "Arc Testnet",
        chainId,
        rpcUrl: ARC_RPC_URL,
        ...(lastKnownBlock !== undefined ? { blockNumber: lastKnownBlock.toString() } : {}),
      },
      results: [...deploymentResults, ...completedProbeResults],
      sources: [],
    });
    const paths = await writeReport(report, `arc-probe-${reportTimestamp(new Date(generatedAt))}`);
    console.log(`交易探测报告：${paths.jsonPath}`);
    console.log(`Markdown 报告：${paths.markdownPath}`);
  }

  if (interruptionReason) throw new Error(`交易探测未完整执行：${interruptionReason}`);
}

main().catch((error: unknown) => {
  console.error(`交易探测终止：${errorMessage(error)}`);
  process.exitCode = 1;
});
