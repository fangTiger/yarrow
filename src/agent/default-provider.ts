import { DeepSeekProvider, type DeepSeekProviderOptions } from "./deepseek-provider.js";
import type { StructuredOutputProvider } from "./provider.js";

/** 生产默认值固定为 DeepSeek；测试 mock 必须由调用方显式构造。 */
export function createDefaultProvider(options: DeepSeekProviderOptions = {}): StructuredOutputProvider {
  return new DeepSeekProvider(options);
}
