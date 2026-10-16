# Change: 英文下单直接用英文生成解读

## Why
英文结果目前先用中文写、再翻译。英文用户要多等一段，等待期间只能看到占位；译文还要再过一轮核对，每卦也多出 4 次模型调用。边写边翻能缩短等待，但没有根治。用户要求英文占卜从根本上用英文生成。

## What Changes
- 英文下单（`lang: "en"`）时，三家、总述、起名的三个流派与合参直接用英文写成，结果页不再翻译、不再等待。
- 防编造的核对强度保持不变：`evidence[].claim` 仍用中文写，沿用现有逐条核对；英文页面本来就不展示 evidence。英文展示字段另做英文核对：
  - 不得含汉字；
  - 干支对、十神、六亲组合须为本盘实有；
  - 英文禁用词；
  - 结构规则复用；
  - 英文长度上限；
  - 缺时柱时须写明限制；
  - 删错留对按英文句子处理。
- 新增四类结果的英文系统提示与共用的「英文输出约定」；用户提示附本盘术语英文对照和古文固定英译。
- 存档与公开 reading 带 `lang`。翻译服务跳过英文解读；中文下单、在英文界面查看的解读，仍走现有翻译路径。
- 前端：英文界面直接渲染英文解读；中文界面打开英文解读时给出提示。
- **BREAKING（行为）**：问题是英文、下单语言为中文时，仍用中文作答；输出语言改为由下单语言决定，不再由问题语言决定。

## Impact
- Affected specs: english-generation（新增）、reading-translation、birth-timezone
- Affected code:
  - 服务端：`src/sanyi/` 下的 schools、school-runner、bazi-school-runner、summary、schema、bazi-schema、audit、bazi-audit、repair、language-guard、naming（runner、audit、schema、families）、三类服务、api、store、translation/service
  - 前端：`web/pages/Reading.tsx`、各结果组件、`web/lib/api.ts`
  - 文档：`web/llms.txt`
- 设计：`docs/plans/2026-10-17-native-english-design.md`
