import type { Address, Hex } from "viem";

import type { ReadonlyTarget } from "./readonly-probe.js";
import type { ReportSource } from "./report.js";

export const ARC_ADDRESSES = {
  usdc: "0x3600000000000000000000000000000000000000",
  historyStorage: "0x0000F90827F1C53a10cb7A02335B175320002935",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  create2Factory: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
  gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
  pythCore: "0x2880aB155794e7179c9eE2e38200202908C17B43",
  pythPro: "0xACeA761c27A909d4D3895128EBe6370FDE2dF481",
  erc8004Identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  erc8183CommunityCandidate: "0x0747EEf0706327138c69792bF28Cd525089e4583",
} as const satisfies Record<string, Address>;

export const PYTH_ETH_USD_PRICE_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as Hex;

const ARC_CONTRACTS_URL = "https://docs.arc.io/arc/references/contract-addresses";
const PYTH_ADDRESSES_URL = "https://docs.pyth.network/price-feeds/core/contract-addresses/evm";
const PYTH_PRO_ADDRESSES_URL = "https://docs.pyth.network/price-feeds/pro/contract-addresses";
const PYTH_PRO_EVM_URL = "https://docs.pyth.network/price-feeds/pro/integrate-as-consumer/evm";
const CHAINLINK_ADDRESSES_URL = "https://docs.chain.link/data-feeds/price-feeds/addresses";
const ERC8004_URL = "https://docs.arc.io/arc/tutorials/register-your-first-ai-agent";
const ERC8183_REFERENCE_URL = "https://github.com/erc-8183/base-contracts";
const ERC8183_CANDIDATE_URL = "https://github.com/riyannode/ArcLayer";

export const REPORT_SOURCES: ReportSource[] = [
  { name: "用户提供的 Arc Testnet 已实测事实", url: ARC_CONTRACTS_URL, kind: "用户已确认" },
  { name: "Pyth Core EVM 合约地址", url: PYTH_ADDRESSES_URL, kind: "官方文档" },
  { name: "Pyth Pro EVM 合约地址", url: PYTH_PRO_ADDRESSES_URL, kind: "官方文档" },
  {
    name: "Pyth Pro EVM 消费流程",
    url: PYTH_PRO_EVM_URL,
    kind: "官方文档",
    note: "实时价格需要 WebSocket 签名更新、SDK 解析和链上 verifyUpdate",
  },
  {
    name: "Chainlink Data Feed 地址",
    url: CHAINLINK_ADDRESSES_URL,
    kind: "官方文档",
    note: "截至探测时官方地址页没有 Arc 网络条目",
  },
  { name: "Arc ERC-8004 教程", url: ERC8004_URL, kind: "官方文档" },
  {
    name: "ERC-8183 官方参考实现",
    url: ERC8183_REFERENCE_URL,
    kind: "官方文档",
    note: "官方仓库没有发布 Arc Testnet 部署地址",
  },
  {
    name: "ERC-8183 Arc 社区候选地址",
    url: ERC8183_CANDIDATE_URL,
    kind: "非官方候选",
    note: "只验证链上存在性，不代表官方或规范级部署",
  },
];

export const READONLY_TARGETS: ReadonlyTarget[] = [
  {
    id: "pyth-core",
    title: "Pyth Core",
    address: ARC_ADDRESSES.pythCore,
    sourceKind: "官方文档",
    sourceUrl: PYTH_ADDRESSES_URL,
    note: "Pyth 官方 EVM 地址页的 Arc Network Testnet 条目",
    infoCalls: [
      { key: "version", functionName: "version", outputType: "string" },
      { key: "validTimePeriod", functionName: "getValidTimePeriod", outputType: "uint256" },
    ],
  },
  {
    id: "pyth-pro",
    title: "Pyth Pro (Lazer)",
    address: ARC_ADDRESSES.pythPro,
    sourceKind: "官方文档",
    sourceUrl: PYTH_PRO_ADDRESSES_URL,
    note: "Pyth 官方地址页的 Arc Network Testnet 条目；存在性不等于签名更新端到端可用",
    infoCalls: [{ key: "verificationFee", functionName: "verification_fee", outputType: "uint256" }],
  },
  {
    id: "chainlink-data-feed",
    title: "Chainlink Data Feed",
    address: null,
    sourceKind: "官方文档",
    sourceUrl: CHAINLINK_ADDRESSES_URL,
    note: "Chainlink 官方 Data Feed 地址页未找到 Arc 或 Arc Testnet 条目，无法进行 eth_getCode",
    infoCalls: [],
  },
  {
    id: "erc8004-identity",
    title: "ERC-8004 IdentityRegistry",
    address: ARC_ADDRESSES.erc8004Identity,
    sourceKind: "官方文档",
    sourceUrl: ERC8004_URL,
    infoCalls: [
      { key: "name", functionName: "name", outputType: "string" },
      { key: "symbol", functionName: "symbol", outputType: "string" },
      { key: "owner", functionName: "owner", outputType: "address" },
    ],
  },
  {
    id: "erc8183-official",
    title: "ERC-8183 官方 Arc 部署",
    address: null,
    sourceKind: "官方文档",
    sourceUrl: ERC8183_REFERENCE_URL,
    note: "ERC-8183 官方规范与参考仓库未发布 Arc Testnet 地址",
    infoCalls: [],
  },
  {
    id: "erc8183-community-candidate",
    title: "ERC-8183 AgenticCommerce 社区候选",
    address: ARC_ADDRESSES.erc8183CommunityCandidate,
    sourceKind: "非官方候选",
    sourceUrl: ERC8183_CANDIDATE_URL,
    note: "社区项目声明为 Arc reference；只复核代码，不认定为官方部署",
    infoCalls: [
      { key: "owner", functionName: "owner", outputType: "address" },
      { key: "paymentToken", functionName: "paymentToken", outputType: "address" },
      { key: "treasury", functionName: "treasury", outputType: "address" },
      { key: "version", functionName: "version", outputType: "string" },
    ],
  },
  {
    id: "usdc-erc20",
    title: "USDC ERC-20 接口",
    address: ARC_ADDRESSES.usdc,
    sourceKind: "用户已确认",
    sourceUrl: ARC_CONTRACTS_URL,
    infoCalls: [
      { key: "name", functionName: "name", outputType: "string" },
      { key: "symbol", functionName: "symbol", outputType: "string" },
      { key: "decimals", functionName: "decimals", outputType: "uint8" },
      { key: "version", functionName: "version", outputType: "string" },
    ],
  },
  {
    id: "eip2935-history",
    title: "EIP-2935 历史区块哈希合约",
    address: ARC_ADDRESSES.historyStorage,
    sourceKind: "用户已确认",
    sourceUrl: ARC_CONTRACTS_URL,
    infoCalls: [],
  },
  {
    id: "multicall3",
    title: "Multicall3",
    address: ARC_ADDRESSES.multicall3,
    sourceKind: "用户已确认",
    sourceUrl: ARC_CONTRACTS_URL,
    infoCalls: [{ key: "currentBlockTimestamp", functionName: "getCurrentBlockTimestamp", outputType: "uint256" }],
  },
  {
    id: "permit2",
    title: "Permit2",
    address: ARC_ADDRESSES.permit2,
    sourceKind: "用户已确认",
    sourceUrl: ARC_CONTRACTS_URL,
    infoCalls: [{ key: "domainSeparator", functionName: "DOMAIN_SEPARATOR", outputType: "bytes32" }],
  },
  {
    id: "create2-factory",
    title: "CREATE2 Factory",
    address: ARC_ADDRESSES.create2Factory,
    sourceKind: "用户已确认",
    sourceUrl: ARC_CONTRACTS_URL,
    infoCalls: [],
  },
  {
    id: "gateway-wallet",
    title: "GatewayWallet",
    address: ARC_ADDRESSES.gatewayWallet,
    sourceKind: "用户已确认",
    sourceUrl: ARC_CONTRACTS_URL,
    infoCalls: [
      { key: "owner", functionName: "owner", outputType: "address" },
      { key: "paused", functionName: "paused", outputType: "bool" },
      { key: "version", functionName: "version", outputType: "string" },
    ],
  },
  {
    id: "gateway-minter",
    title: "GatewayMinter",
    address: ARC_ADDRESSES.gatewayMinter,
    sourceKind: "用户已确认",
    sourceUrl: ARC_CONTRACTS_URL,
    infoCalls: [
      { key: "owner", functionName: "owner", outputType: "address" },
      { key: "paused", functionName: "paused", outputType: "bool" },
      { key: "version", functionName: "version", outputType: "string" },
    ],
  },
];
