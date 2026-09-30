import { AnthropicProvider } from "../src/agent/anthropic-provider.js";

try {
  const provider = new AnthropicProvider();
  console.log(`Anthropic provider 启动检查通过，模型：${provider.modelId}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Anthropic provider 启动失败");
  process.exitCode = 1;
}
