import { createDefaultProvider } from "../src/agent/default-provider.js";

try {
  const provider = createDefaultProvider();
  console.log(`默认 provider 配置检查通过，模型：${provider.modelId}，配置哈希：${provider.providerConfigHash}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "DeepSeek provider 启动失败");
  process.exitCode = 1;
}
