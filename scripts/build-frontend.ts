import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const rootDir = process.cwd();
const outputDir = resolve(rootDir, "web/dist");
await mkdir(outputDir, { recursive: true });

const PUBLIC_DEFAULTS = {
  ARC_RPC_URL: "https://rpc.testnet.arc.io",
  ARC_CHAIN_ID: "5042002",
  ARC_EXPLORER: "https://testnet.arcscan.app",
} as const;

const walletConnectProjectId = process.env.WALLETCONNECT_PROJECT_ID ?? "";
if (!/^[0-9a-fA-F]{32}$/.test(walletConnectProjectId)) {
  throw new Error("WALLETCONNECT_PROJECT_ID 必须是 32 位十六进制公开项目标识");
}

const publicConfig = {
  walletConnectProjectId,
  arcRpcUrl: process.env.ARC_RPC_URL ?? PUBLIC_DEFAULTS.ARC_RPC_URL,
  arcChainId: process.env.ARC_CHAIN_ID ?? PUBLIC_DEFAULTS.ARC_CHAIN_ID,
  arcExplorer: process.env.ARC_EXPLORER ?? PUBLIC_DEFAULTS.ARC_EXPLORER,
};
if (!/^\d+$/.test(publicConfig.arcChainId)) throw new Error("ARC_CHAIN_ID 必须是十进制整数");

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
  logOverride: {
    // MetaMask SDK 的可选动态入口在打包时会产生空 glob 提示；当前钱包清单未启用该 SDK。
    "empty-glob": "silent",
  },
  plugins: [{
    name: "rainbowkit-safe-defaults",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@rainbow-me\/rainbowkit$/ }, (args) => {
        if (!args.importer.endsWith("/web/lib/wagmi.ts")) return undefined;
        return { path: resolve(rootDir, "web/lib/secure-rainbow-config.ts") };
      });
      buildContext.onResolve({ filter: /^wagmi\/chains$/ }, (args) => {
        if (!args.importer.includes("/node_modules/@rainbow-me/rainbowkit/")) return undefined;
        // RainbowKit 仅用 mainnet.id 判断 ENS；显式常量规避 esbuild 处理 wagmi 转导出时的初始化次序问题。
        return { path: resolve(rootDir, "web/lib/rainbowkit-mainnet.ts") };
      });
    },
  }],
  define: {
    // 浏览器不应继承构建机环境；各公开配置均通过下方白名单常量单独注入。
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify("production"),
    __WALLETCONNECT_PROJECT_ID__: JSON.stringify(publicConfig.walletConnectProjectId),
    __ARC_RPC_URL__: JSON.stringify(publicConfig.arcRpcUrl),
    __ARC_CHAIN_ID__: JSON.stringify(publicConfig.arcChainId),
    __ARC_EXPLORER__: JSON.stringify(publicConfig.arcExplorer),
  },
});

console.log("前端构建完成：web/dist/app.js");
