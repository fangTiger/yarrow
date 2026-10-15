# share-card 技术设计

## 概览

分享图完全在浏览器中由公开 reading 生成，不向服务端上传内容。纯函数先构建隐私裁剪后的卡片模型和固定尺寸布局，再用 Canvas 绘制 1080×1350 PNG，组件负责预览、系统分享和下载。

## 模块与文件

- `web/lib/share-card.ts`
  - `SHARE_CARD_WIDTH = 1080`、`SHARE_CARD_HEIGHT = 1350` 固定输出尺寸。
  - `buildShareCard` 从问事、命理或运势公开视图建立卡片模型。
  - `wrapText` 处理中英文换行、标点避头和省略。
  - `layoutShareCard` 计算文字、标签、趋势或卦画的坐标。
  - `drawShareCard` 把布局绘制到 Canvas 2D context。
  - `ShareCardUnavailableError` 表示译文或数据不足，入口应隐藏。
- `web/components/ShareCard.tsx`：等待字体、生成 Blob/File/Object URL、管理无障碍对话框及分享下载。
- `web/components/PlainSummaryPanel.tsx`、`EnglishReadingSections.tsx`：在总述完成后挂载入口。
- `web/lib/reading-translation.ts`、`web/lib/result-format.ts`：英文文本和确定性术语格式。
- `web/brand/yarrow-mark.svg`：绘图时优先使用的品牌印；加载失败回退为文字印。

## 数据流

1. `ShareCard` 仅在 `summary.status === "done"` 且有输出时尝试建模。
2. 英文模式先应用已完成翻译；若卡片正文仍含非白名单汉字，则拒绝生成。
3. `buildShareCard` 按类型取摘要：命理取画像与年龄段走势，问事取问题、五卦和三家判断，运势取十年结论与逐年走势。
4. 隐私检查从自由文本中移除或替换付款哈希、四柱、大运干支、出生相关词和命理年份。
5. 用户点击后等待 `document.fonts.ready`，创建 Canvas 并调用 `drawShareCard`。
6. Canvas 转为 PNG `Blob` 和 `File`，通过 Object URL 在模态框预览。
7. 浏览器支持 `navigator.canShare({ files })` 时显示系统分享；下载链接始终可用。
8. 关闭、模型变化或组件卸载时撤销 Object URL，避免长期占用内存。

## 关键决策

- 模型、布局、绘制三层分离，尺寸与越界可以在没有真实浏览器 Canvas 的情况下测试。
- 命理走势只显示年龄段和合议值，不显示公历年份或大运干支。
- 问事卡不复制付款哈希，但保留本卦、之卦、动爻和三家结论。
- 英文卡只允许用户原问题保留其原始文字，其他内容必须已完成英文翻译。
- 生成发生在用户设备上，服务端不保存分享图。

## 约束与已知限制

- 起名 reading 当前不支持分享卡。
- 总述未完成、命盘缺失或英文译文不完整时入口隐藏。
- 系统分享取决于浏览器文件分享能力；不支持时只能下载。
- 自由文本隐私过滤采用已知 token 和模式，新增敏感字段时必须同步更新过滤规则。

## 测试

- `tests/frontend-share-card.test.ts`：三类模型、隐私、英文、换行、布局、入口和内容收紧。
- `tests/frontend-plain-summary.test.ts`：总述完成后的结果页位置。
- `tests/frontend-result-translation.test.ts`：英文译文回填基础。
