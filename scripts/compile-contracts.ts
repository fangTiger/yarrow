import { mkdir, readFile, writeFile } from "node:fs/promises";

import solc from "solc";

import { stringifyJson } from "../src/report.js";

interface SolcError {
  severity: "error" | "warning";
  formattedMessage: string;
}

interface SolcOutput {
  contracts?: Record<string, Record<string, {
    abi: unknown[];
    evm: {
      bytecode: { object: string };
      deployedBytecode: { object: string };
    };
    metadata: string;
  }>>;
  errors?: SolcError[];
}

async function main(): Promise<void> {
  const sourcePath = "contracts/src/ProbeVault.sol";
  const source = await readFile(sourcePath, "utf8");
  const input = {
    language: "Solidity",
    sources: { "ProbeVault.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "prague",
      outputSelection: {
        "*": { "*": ["abi", "metadata", "evm.bytecode.object", "evm.deployedBytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  const errors = output.errors ?? [];
  for (const warning of errors.filter((item) => item.severity === "warning")) {
    console.warn(`Solidity 警告：${warning.formattedMessage}`);
  }
  const failures = errors.filter((item) => item.severity === "error");
  if (failures.length > 0) throw new Error(failures.map((item) => item.formattedMessage).join("\n"));

  const contract = output.contracts?.["ProbeVault.sol"]?.ProbeVault;
  if (!contract) throw new Error("solc 输出中没有 ProbeVault");
  const artifact = {
    abi: contract.abi,
    bytecode: { object: `0x${contract.evm.bytecode.object}` },
    deployedBytecode: { object: `0x${contract.evm.deployedBytecode.object}` },
    metadata: contract.metadata,
    compiler: { name: "solc-js", version: solc.version() },
  };
  const outDirectory = "contracts/out/ProbeVault.sol";
  const outPath = `${outDirectory}/ProbeVault.json`;
  await mkdir(outDirectory, { recursive: true });
  await writeFile(outPath, `${stringifyJson(artifact)}\n`, "utf8");
  console.log(`合约编译完成（${solc.version()}）：${outPath}`);
}

main().catch((error: unknown) => {
  console.error(`合约编译失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

