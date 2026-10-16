# reading-translation 技术设计

## 概览

英文结果不是直接要求三家用英文生成，而是在中文输出完成并核对后，按“总述 + 各家”拆成独立翻译单元。每个单元按源文、提示词版本和术语表版本计算哈希，支持缓存、局部失效、局部补译和独立失败。

英文下单的解读直接用英文生成，不走翻译，见 `english-generation`。翻译只服务于中文生成的解读：
- 中文下单、事后切到英文查看：整卦完成后由页面触发整卦翻译。
- 旧存档中带 `translateTo: "en"` 的解读：每个单元一到终态，服务端就在后台翻译这一单元。

## 模块与文件

- `src/sanyi/translation/units.ts`：`extractUnits` 按 reading 类型提取稳定路径和文本条目。
- `src/sanyi/translation/service.ts`
  - `TranslationService` 管理终态检查、并发、预算、后台任务与单元状态。
  - `startUnit(id, unitKey)` 是按单元启动的入口，由三类结果服务通过 `onUnitSettled` 通知调用，在 `src/frontend/runtime.ts` 接线。
  - `trigger` / `translate` 是整卦路径。两条路径共用同一套逻辑：准备单元（同一解读排队执行，原子写入）；认领单元（按「单元 + sourceHash」去重）；扣每日预算。
  - `sourceHash` 计算条目、`PROMPT_VERSION`、`GLOSSARY_VERSION` 的 SHA-256。
  - `NotReadyError`、`TranslationBudgetError` 映射等待与额度错误。
- `src/sanyi/translation/prompt.ts`：`buildTranslationPrompt`、`TRANSLATION_SYSTEM_PROMPT` 与 `PROMPT_VERSION`。
- `src/sanyi/translation/check.ts`：`checkTranslation` 核对条数、汉字、数字、术语和古文要求。
- `src/sanyi/translation/store.ts`：`TranslationStore` 独立保存 `translations/<id>.en` 文档。
- `src/sanyi/i18n/glossary.ts`：`GLOSSARY_VERSION` 及五行、卦名、干支、十神、六亲等固定译名。
- `src/agent/zhouyi-en.ts`、`zhouyi-en.json`：卦辞、爻辞与大象的离线固定英译。
- `src/sanyi/api.ts`、`src/frontend/server.ts`：触发翻译与读取带译文的公开 reading。
- `web/lib/reading-translation.ts`
  - `applyReadingTranslation` 生成英文视图：完成单元按相同路径回填译文；中文已到终态而译文未到的单元，清空中文正文、显示为占位（状态记为 writing，并标 `translationPending`）。
  - `translationViewState` 把「已到终态却没有翻译状态」的单元视为 pending，确保页面会触发补救。
- `web/pages/Reading.tsx`：英文模式自动触发、轮询、失败提示与免费重试。

## 数据流

1. 英文下单：各家（起名为各流派）或总述写入终态后，服务调用 `onUnitSettled`；`startUnit` 确认 `translateTo: "en"` 且该单元已到终态，准备并认领这一单元，在后台翻译。
2. 中文下单：英文结果页在整卦到终态后调用 `POST /api/readings/:id/translate`，API 只触发后台任务并返回当前翻译状态。
3. `extractUnits` 为问事、八字或起名建立总述和各家单元，每个条目带公开对象路径。
4. `prepare` 比较 `sourceHash`：未变化的完成单元复用，变化的单元重置为 `pending`。
5. 整卦路径先处理总述，再并行处理其他单元；按单元路径各自独立。全局 semaphore 默认最多三个 provider 调用同时进行。
6. 首次译文经 `checkTranslation` 核对：
   - 只有软性警告时立即以 done 保存并显示，再在后台对警告条目补译一次，补译更好且无硬伤才替换；
   - 有硬性问题时在显示前只补译缺项或错项。
7. 仍不可接受时整单元再译一次；失败写入计数，连续三次失败进入十分钟冷却。
8. 前端轮询完成单元，用 `applyReadingTranslation` 按路径替换文本；确定性图表文字由浏览器术语表翻译。

## 关键决策

- 中文先生成、先审计，避免英文生成绕过盘面核对规则。
- 单元哈希包含提示词和术语表版本，规则变更会精确失效旧缓存。
- 英文下单边写边翻：中文写作与翻译重叠，整卦写完后只需再等最后一个单元（通常是总述）译完。
- 英文页绝不回退显示中文正文：未译单元显示占位，失败单元显示英文提示与免费重试。
- 软性警告不阻塞显示：术语与古文一致性由后台补译改进，不让用户多等一次模型往返。
- 术语核对接受拼音、完整译名、释义首个短语，并容忍单复数与英式拼写，减少无谓补译。
- 古文不交给模型自由翻译，而使用入库的唯一英译并在提示中约束。
- 起名允许本单元关联的姓名汉字，其余英文结果按汉字白名单检查。

## 约束与已知限制

- 每日单元额度默认 500，可由 `TRANSLATION_DAILY_UNITS` 配置；当前计数保存在进程内，不跨 Vercel 实例共享。
- 同一进程的并发默认 3，也不是跨实例全局信号量。
- 单元去重与准备队列在进程内；在 Vercel 上，按单元翻译跑在创建解读的那个实例的后台任务里。另一个实例同时触发整卦路径时，可能重复翻译同一单元，但结果按 sourceHash 原子写入，不会错位。
- 后台补译会在译文显示后替换个别条目，用户刷新时可能看到术语写法变得更统一。
- 软性术语或数字警告可以随完成译文保存；硬性错误才阻止展示。
- 专家盘中的部分确定性中文内容在英文页隐藏或折叠，而不是全部逐字段翻译。

## 测试

- `tests/translation-units.test.ts`：三类 reading 的单元与路径顺序。
- `tests/translation-check.test.ts`、`tests/translation-classics.test.ts`：硬性核对、术语和古文。
- `tests/translation-service.test.ts`：哈希失效、并发、预算、冷却、幂等、按单元启动、新旧通知竞态与后台补译。
- `tests/translation-api.test.ts`：触发与公开读取。
- `tests/frontend-result-translation.test.ts`、`tests/frontend-result-pages-en.test.ts`：自动触发、回填和英文结果页。
