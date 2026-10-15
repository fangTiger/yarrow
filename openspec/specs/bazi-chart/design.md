# bazi-chart 技术设计

## 概览

八字排盘以 `lunar-javascript` 的四柱与大运结果为底层，再由项目代码补齐海外时区换算、十年流年窗口、合冲刑害、神煞、五行计数和调候表。服务端保存派生命盘，不保存原始出生日期和时间。

## 模块与文件

- `src/sanyi/birth-profile.ts`：`normalizeBirthProfile` 校验公历/农历、时间、性别和 IANA 时区输入。
- `src/calendar/birth-instant.ts`、`src/calendar/solar-time.ts`：把出生地钟面时间换成排盘所需绝对时刻与当地标准时。
- `src/sanyi/birth-chart.ts`：`buildBirthChart` 组合时区、夏令时、换日口径与 `buildBaziChart`。
- `src/calendar/bazi.ts`
  - `buildBaziChart` 生成四柱、十神、藏干、十二长生、纳音、胎元、命身宫、起运、大运、流年和流月。
  - `BaziChart` 是存档和后续分析的核心数据结构。
- `src/calendar/bazi-relations.ts`
  - `analyzeBazi` 汇总关系节点、合冲刑害、神煞和五行计数。
  - `makeNodes`、`findRelations`、`findShensha`、`countElements` 提供可单测的子步骤。
- `src/calendar/qiongtong.ts`：`lookupQiongtong` 从 `src/calendar/data/qiongtong.json` 查调候用神。
- `src/sanyi/bazi-public.ts`：`derivedChart`、`yearConsensus`、`periodConsensus` 构建公开视图派生数据。
- `web/components/BaziTable.tsx`、`BaziLuck.tsx`、`LifeLuckPanel.tsx`、`LiuNianPanel.tsx`、`BaziRelations.tsx`、`BaziElements.tsx`：结果页图表。

## 数据流

1. API 在付款前调用 `normalizeBirthProfile` 做输入校验。
2. 付款通过后，`buildBirthChart` 根据出生地时区解析绝对时刻，并得到日时柱使用的当地标准时。
3. `buildBaziChart` 依据 `sect` 选择 23:00 或 00:00 换日，生成三柱或四柱。
4. 年月柱与节气、大运和起运使用相应时刻；缺时辰时按正午估算并写入警告。
5. 流年窗口固定为目标年之前 3 年到之后 6 年，并裁剪在出生立春年与 2099 年之间。
6. `analyzeBazi` 叠加原局、当前大运和目标流年，生成关系、神煞与五行分布。
7. `lookupQiongtong` 按日干和月支取得调候条目，命盘与分析一并存档。
8. 公开视图补充逐年、逐运三家合议，前端绘制一生大运和十年流年图表。

## 关键决策

- 四柱与大运复用成熟历法库，项目只在明确缺口处增加确定性逻辑。
- 海外排盘区分“节气比较的绝对时刻”和“日时柱的当地标准时”，避免直接套北京时间。
- 缺时辰允许排三柱，但命身宫和精确起运等事实降级或标注近似。
- 合冲刑害和神煞只作为事实，不在排盘层直接给吉凶结论。
- 调候数据入库并校验 10 日干 × 12 月支条目，模型不自行查表。

## 约束与已知限制

- `targetYear` 只支持 1900–2099。
- 缺时辰且出生当日交节时，大运会暂停生成，等待更精确信息。
- 服务端存档只有派生四柱、校正摘要和分析；持有本机档案的浏览器才可显示完整校正过程。
- 换日口径改变会重新排盘并重跑三家，最多免费切换两次。

## 测试

- `tests/bazi.test.ts`、`tests/bazi-fixtures.test.ts`：四柱、起运、大运、流年与边界命例。
- `tests/birth-timezone.test.ts`、`tests/birth-profile.test.ts`：时区、夏令时和输入口径。
- `tests/bazi-relations.test.ts`、`tests/qiongtong.test.ts`：关系、神煞、五行与调候表。
- `tests/sanyi-bazi-facts.test.ts`、`tests/sanyi-bazi-periods.test.ts`：服务端事实和逐运数据。
- `tests/frontend-bazi-components.test.ts`、`tests/frontend-liunian-chart.test.ts`、`tests/frontend-destiny.test.ts`：图表和结果顺序。
