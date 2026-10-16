# Change: 英文问题自动识别类型与事项

## Why
问题分类只有中文关键词规则，英文问题一律落到「人际／同辈」低置信默认值，所以英文首页关掉了自动识别，改为手选类型和事项。结果英文用户切到 Ask 后常因没选事项而无法付款，体验与中文明显不一致。

## What Changes
- 分类规则增加常见英文关键词：类型（命理、运势、起名，以及暂未开放的择日、星座、合婚）、运势时间范围、问事七类事项、商号起名判断。仍是确定性规则，不调用模型。
- 识别不到事项时，中英文都默认「人际／同辈」（Peers），返回 `subject.fallback: true`；首页提示「没认出具体事项，暂按人际／同辈，可在上方改选」，按钮不再卡住。
- 英文首页与中文一致：输入问题后自动切换类型与细项，手点的类型优先；去掉英文专用的「Choose a subject」必选门槛。
- `llms.txt` 改写分类说明：服务端认得常见中英文关键词，但 agent 仍建议显式传 `kind` 与 `subjectKey`。

## Impact
- Affected specs: unified-question-entry, onboarding-home
- Affected code: `src/oracle/question-classifier.ts`、`src/sanyi/classify.ts`、`web/lib/home-entry.ts`、`web/components/QuestionForm.tsx`、`web/components/SubjectSelect.tsx`、`web/i18n/*`、`web/styles/components.css`、`web/llms.txt`
