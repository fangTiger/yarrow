# Change: 英文解读边写边翻、英文页不露中文、减少补译

## Why
英文用户付款后要等两段时间：先等中文三家与总述全部写完（一两分钟），页面开着英文时浏览器才请求翻译，再等总述与三家依次译完。等待期间已写完的一家直接显示中文。日志显示约半数单元第一遍没过核对，几乎都是「术语、古文」这类软性警告，又多一次模型往返。

## What Changes
- **边写边翻**：下单时带上界面语言 `lang`。英文下单的解读记为需要英文（`translateTo: "en"`），每家、每个起名流派、总述一到终态，服务端立即在后台翻译这一单元，不等整卦完成，也不依赖页面开着。中文下单、事后切到英文的旧路径保持不变。
- **英文页不露中文**：英文模式下，中文已写完、译文未到的单元按「正在落笔／翻译中」的占位显示，不显示中文正文。译文失败的单元显示英文提示与免费重试，不回退到中文。排盘图表照常即时显示。
- **减少补译**：
  - 术语核对放宽：术语释义的首个短语（如 `Day Master`）、单复数与英式拼写都算合格。
  - 只有硬性问题（缺译、条数、汉字、四位年份）在显示前补译；只有软性警告时，第一遍译文立即采用并显示，再在后台补译一次，补译更好才替换。
- `llms.txt` 与 `scripts/agent-reading.ts` 说明 `lang: "en"`。

## Impact
- Affected specs: reading-translation
- Affected code:
  - 服务端：`src/sanyi/translation/{service,check,prompt}.ts`，三类结果服务（`reading-service.ts`、`bazi-reading-service.ts`、`naming/service.ts`），`api.ts`、`store.ts`，`src/frontend/runtime.ts`
  - 前端：`web/lib/reading-translation.ts`、`web/pages/Reading.tsx` 及各结果组件，`web/components/PaymentButton.tsx`、`web/lib/api.ts`
  - 文档与脚本：`web/llms.txt`、`scripts/agent-reading.ts`
