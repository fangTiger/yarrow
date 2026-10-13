// src/frontend/runtime.ts
import { resolveArcNetwork } from "../arc-network.js";
import { createDefaultProvider } from "../agent/default-provider.js";
import { createSanyiApi } from "../sanyi/api.js";
import { createSanyiPublicClient } from "../sanyi/arc-client.js";
import { BaziReadingService } from "../sanyi/bazi-reading-service.js";
import { ArcFeeVerifier, feeRecipientFromEnv } from "../sanyi/fee.js";
import type { SanyiLogger } from "../sanyi/log.js";
import { NamingReadingService } from "../sanyi/naming/service.js";
import { ReadingService } from "../sanyi/reading-service.js";
import type { DocumentBackend } from "../sanyi/storage.js";
import { ReadingStore } from "../sanyi/store.js";
import { TranslationService } from "../sanyi/translation/service.js";
import { TranslationStore } from "../sanyi/translation/store.js";

export interface SanyiRuntimeOptions {
  backend: DocumentBackend;
  logger: SanyiLogger;
  clock?: () => Date;
  env?: Record<string, string | undefined>;
}

/** 组装三易服务：常驻进程与 Vercel 函数共用，存储与日志由调用方按部署环境传入。 */
export function createSanyiRuntime(options: SanyiRuntimeOptions) {
  const env = options.env ?? process.env;
  const clock = options.clock ?? (() => new Date());
  const network = resolveArcNetwork(env);
  if (network.mainnet && !env.SANYI_FEE_RECIPIENT?.trim()) {
    // 主网收的是真钱，收款地址必须显式配置，不能落到代码里的默认地址。
    throw new Error("主网部署必须设置 SANYI_FEE_RECIPIENT");
  }
  const recipient = feeRecipientFromEnv(env);
  const publicClient = createSanyiPublicClient(network);
  const { backend, logger } = options;
  const store = new ReadingStore(backend);
  const feeVerifier = new ArcFeeVerifier(publicClient, recipient);
  const longProvider = createDefaultProvider({ maxTokens: 8_192, timeoutMilliseconds: 90_000 });
  const translation = new TranslationService({
    store,
    translationStore: new TranslationStore(backend),
    provider: longProvider,
    logger,
    clock,
  });
  const bazi = new BaziReadingService({ store, logger, feeVerifier,
    // 八字运势含十年逐年断语，输出较长，放宽输出上限与单次超时。
    provider: longProvider, clock });
  const naming = new NamingReadingService({ store, logger, feeVerifier,
    provider: longProvider, clock });
  const service = new ReadingService({
    feeVerifier,
    blockSource: {
      latest: async () => {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        if (!block.hash) {
          throw new Error("最新区块没有可复算哈希");
        }
        return { number: block.number, hash: block.hash, timestamp: block.timestamp };
      },
    },
    // 白话总述同次写解法，输出较长，放宽上限以免截断。
    provider: createDefaultProvider({ maxTokens: 4_096 }),
    store,
    logger,
  });
  const api = createSanyiApi(service, { recipient, chainId: network.chainId, bazi, naming, translation });
  return { api, service, network, recipient };
}
