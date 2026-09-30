import { readFile } from "node:fs/promises";

import type { Abi, Hex } from "viem";

export interface ProbeArtifact {
  abi: Abi;
  bytecode: Hex;
  deployedBytecode: Hex;
}

interface ArtifactFile {
  abi?: unknown;
  bytecode?: { object?: string } | string;
  deployedBytecode?: { object?: string } | string;
}

function bytecodeObject(value: ArtifactFile["bytecode"]): Hex {
  const raw = typeof value === "string" ? value : value?.object;
  if (!raw) throw new Error("合约产物缺少 bytecode");
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
}

export async function loadProbeArtifact(
  artifactPath = "contracts/out/ProbeVault.sol/ProbeVault.json",
): Promise<ProbeArtifact> {
  const parsed = JSON.parse(await readFile(artifactPath, "utf8")) as ArtifactFile;
  if (!Array.isArray(parsed.abi)) throw new Error(`合约产物 ABI 无效：${artifactPath}`);
  return {
    abi: parsed.abi as Abi,
    bytecode: bytecodeObject(parsed.bytecode),
    deployedBytecode: bytecodeObject(parsed.deployedBytecode),
  };
}

