import { parseAbi, type Address, type Hex } from "viem";

import { errorMessage } from "./revert.js";
import type { ProbeResult } from "./report.js";

export interface InfoCall {
  key: string;
  functionName: string;
  outputType: "string" | "uint8" | "uint256" | "address" | "bytes32" | "bool";
}

export interface ReadonlyTarget {
  id: string;
  title: string;
  address: Address | null;
  sourceKind: "用户已确认" | "官方文档" | "非官方候选";
  sourceUrl: string;
  note?: string;
  infoCalls: InfoCall[];
}

export interface ReadonlyClientLike {
  getBytecode(args: { address: Address }): Promise<Hex | undefined>;
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
  }): Promise<unknown>;
}

function normalizeMetadata(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeMetadata);
  return value;
}

export async function probeReadonlyTarget(client: ReadonlyClientLike, target: ReadonlyTarget): Promise<ProbeResult> {
  if (target.address === null) {
    return {
      id: target.id,
      title: target.title,
      status: "NOT_FOUND",
      observed: "未找到可探测的 Arc Testnet 官方地址",
      reason: target.note ?? "地址来源未提供 Arc Testnet 条目",
      details: { sourceKind: target.sourceKind, sourceUrl: target.sourceUrl },
    };
  }

  try {
    const bytecode = await client.getBytecode({ address: target.address });
    if (!bytecode || bytecode === "0x") {
      return {
        id: target.id,
        title: target.title,
        status: "FAIL",
        observed: `${target.address} 未部署代码`,
        reason: "eth_getCode 返回 0x",
        details: { address: target.address, sourceKind: target.sourceKind, sourceUrl: target.sourceUrl },
      };
    }

    const metadata: Record<string, unknown> = {};
    const readErrors: Record<string, string> = {};
    for (const call of target.infoCalls) {
      try {
        const abi = parseAbi([`function ${call.functionName}() view returns (${call.outputType})`]);
        const value = await client.readContract({ address: target.address, abi, functionName: call.functionName });
        metadata[call.key] = normalizeMetadata(value);
      } catch (error) {
        readErrors[call.key] = errorMessage(error);
      }
    }

    const codeBytes = (bytecode.length - 2) / 2;
    return {
      id: target.id,
      title: target.title,
      status: "PASS",
      observed: `${target.address} 已部署 ${codeBytes} 字节代码`,
      details: {
        address: target.address,
        codeBytes,
        metadata,
        readErrors,
        sourceKind: target.sourceKind,
        sourceUrl: target.sourceUrl,
        ...(target.note ? { note: target.note } : {}),
      },
    };
  } catch (error) {
    return {
      id: target.id,
      title: target.title,
      status: "FAIL",
      observed: `${target.address} RPC 探测失败`,
      reason: errorMessage(error),
      details: { address: target.address, sourceKind: target.sourceKind, sourceUrl: target.sourceUrl },
    };
  }
}

