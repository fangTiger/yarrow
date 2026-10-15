# reading-translation 技术设计

## 概览

英文结果不是直接要求三家用英文生成，而是在中文输出完成并核对后，按“总述 + 各家”拆成独立翻译单元。每个单元按源文、提示词版本和术语表版本计算哈希，支持缓存、局部失效、局部补译和独立失败。

## 模块与文件

- `src/sanyi/translation/units.ts`：`extractUnits` 按 reading 类型提取稳定路径和文本条目。
- `src/sanyi/translation/service.ts`
  - `TranslationService` 管理终态检查、并发、预算、后台任务与单元状态。
  - `sourceHash` 计算条目、`PROMPT_VERSION`、`GLOSSARY_VERSION` 的 SHA-256。
  - `NotReadyError`、`TranslationBudgetError` 映射等待与额度错误。
- `src/sanyi/translation/prompt.ts`：`buildTranslationPrompt`、`TRANSLATION_SYSTEM_PROMPT` 与 `PROMPT_VERSION`。
- `src/sanyi/translation/check.ts`：`checkTranslation` 核对条数、汉字、数字、术语和古文要求。
- `src/sanyi/translation/store.ts`：`TranslationStore` 独立保存 `translations/<id>.en` 文档。
- `src/sanyi/i18n/glossary.ts`：`GLOSSARY_VERSION` 及五行、卦名、干支、十神、六亲等固定译名。
- `src/agent/zhouyi-en.ts`、`zhouyi-en.json`：卦辞、爻辞与大象的离线固定英译。
- `src/sanyi/api.ts`、`src/frontend/server.ts`：触发翻译与读取带译文的公开 reading。
- `web/lib/reading-translation.ts`：`applyReadingTranslation` 按相同路径把完成单元回填到公开结果副本。
- `web/pages/Reading.tsx`：英文模式自动触发、轮询、失败提示与免费重试。

## 数据流

1. 英文结果页先读取中文公开 reading；各家和总述未到终态时继续等待。
2. 前端调用 `POST /api/readings/:id/translate`，API 只触发后台任务并返回当前翻译状态。
3. `extractUnits` 为问事、八字或起名建立总述和各家单元，每个条目带公开对象路径。
4. `prepare` 比较 `sourceHash`：未变化的完成单元复用，变化的单元重置为 `pending`。
5. 服务先处理总述，再并行处理其他单元；全局 semaphore 默认最多三个 provider 调用同时进行。
6. 首次译文经 `checkTranslation` 核对；错误索引组成补译单元，只重译缺项或错项。
7. 仍不可接受时整单元再译一次；失败写入计数，连续三次失败进入十分钟冷却。
8. 前端轮询完成单元，用 `applyReadingTranslation` 按路径替换文本；确定性图表文字由浏览器术语表翻译。

## 关键决策

- 中文先生成、先审计，避免英文生成绕过盘面核对规则。
- 单元哈希包含提示词和术语表版本，规则变更会精确失效旧缓存。
- 总述优先翻译，让用户先看到结论；各家随后并行完成。
- 古文不交给模型自由翻译，而使用入库的唯一英译并在提示中约束。
- 起名允许本单元关联的姓名汉字，其余英文结果按汉字白名单检查。

## 约束与已知限制

- 每日单元额度默认 500，可由 `TRANSLATION_DAILY_UNITS` 配置；当前计数保存在进程内，不跨 Vercel 实例共享。
- 同一进程的并发默认 3，也不是跨实例全局信号量。
- 软性术语或数字警告可以随完成译文保存；硬性错误才阻止展示。
- 专家盘中的部分确定性中文内容在英文页隐藏或折叠，而不是全部逐字段翻译。

## 测试

- `tests/translation-units.test.ts`：三类 reading 的单元与路径顺序。
- `tests/translation-check.test.ts`、`tests/translation-classics.test.ts`：硬性核对、术语和古文。
- `tests/translation-service.test.ts`：哈希失效、并发、预算、冷却和幂等。
- `tests/translation-api.test.ts`：触发与公开读取。
- `tests/frontend-result-translation.test.ts`、`tests/frontend-result-pages-en.test.ts`：自动触发、回填和英文结果页。
