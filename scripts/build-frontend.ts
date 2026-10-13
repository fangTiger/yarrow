// scripts/build-frontend.ts
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { resolveArcNetwork } from "../src/arc-network.js";

const rootDir = process.cwd();
const outputDir = resolve(rootDir, "web/dist");
await mkdir(outputDir, { recursive: true });

const walletConnectProjectId = process.env.WALLETCONNECT_PROJECT_ID ?? "";
if (!/^[0-9a-fA-F]{32}$/.test(walletConnectProjectId)) {
  throw new Error("WALLETCONNECT_PROJECT_ID 必须是 32 位十六进制公开项目标识");
}
// ARC_CHAIN_ID 决定主网或测试网；ARC_RPC_URL、ARC_EXPLORER 缺省取该网络的预设。
const network = resolveArcNetwork({
  ARC_CHAIN_ID: process.env.ARC_CHAIN_ID,
  ARC_RPC_URL: process.env.ARC_RPC_URL,
  ARC_EXPLORER: process.env.ARC_EXPLORER,
});
const publicConfig = {
  walletConnectProjectId,
  arcRpcUrl: network.rpcUrl,
  arcChainId: String(network.chainId),
  arcExplorer: network.explorerUrl,
};
await build({
  entryPoints: [resolve(rootDir, "web/main.tsx")],
  outfile: resolve(outputDir, "app.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  external: ["/fonts/*"],
  logOverride: {
    // 当前钱包清单未启用 MetaMask SDK 的可选动态入口。
    "empty-glob": "silent",
  },
  plugins: [{
    name: "rainbowkit-safe-defaults",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@rainbow-me\/rainbowkit$/ }, (args) => {
        if (!args.importer.endsWith("/web/lib/wagmi.ts")) {
          return undefined;
        }
        return { path: resolve(rootDir, "web/lib/secure-rainbow-config.ts") };
      });
      buildContext.onResolve({ filter: /^wagmi\/chains$/ }, (args) => {
        if (!args.importer.includes("/node_modules/@rainbow-me/rainbowkit/")) {
          return undefined;
        }
        return { path: resolve(rootDir, "web/lib/rainbowkit-mainnet.ts") };
      });
    },
  }],
  define: {
    // 浏览器只接收逐项列出的公开配置，不继承构建机环境。
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify("production"),
    __WALLETCONNECT_PROJECT_ID__: JSON.stringify(publicConfig.walletConnectProjectId),
    __ARC_RPC_URL__: JSON.stringify(publicConfig.arcRpcUrl),
    __ARC_CHAIN_ID__: JSON.stringify(publicConfig.arcChainId),
    __ARC_EXPLORER__: JSON.stringify(publicConfig.arcExplorer),
  },
});
console.log(`前端构建完成：web/dist/app.js（${network.name}）`);
