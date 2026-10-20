# 八字英文知识页与预览图实施计划

> **执行要求：** 使用 `executing-plans` 技能逐项实施本计划。

**目标：** 完成 OpenSpec `share-bazi-pages` 的 S2.1、S2.2、S2.4，以及 S2.3 中由 Codex 负责的模板和渲染脚本，保留 PNG 本机渲染任务未勾选。

**架构：** 在 `src/content` 维护结构化英文导读及同步校验；扩展现有 `build-hexagram-pages.ts`，统一生成 64 卦、八字索引、20 个八字详情页和 sitemap，并按 PNG 是否存在选择专属图或默认图。独立 `render-og-images.ts` 只负责无外部依赖的 1200×630 卡片 HTML 与本机 Chrome 截图。

**技术栈：** TypeScript、Node.js 内置模块、React SSR 测试、Node test runner、OpenSpec。

---

### 任务 1：英文导读数据与校验

**文件：**
- 新增：`src/content/bazi-guides.en.ts`
- 新增：`tests/bazi-guides.test.ts`

1. 先写失败测试，覆盖 10 个日主、10 个十神、术语、字数、汉字和禁用词。
2. 运行 `node --import tsx --test tests/bazi-guides.test.ts`，确认因模块缺失而失败。
3. 写最小结构化数据和校验函数，复用 `STEMS_EN`、`ELEMENTS_EN`、`TEN_GODS_EN` 与 `englishForbiddenErrors`。
4. 重跑测试并确认通过。

### 任务 2：八字静态页与 SEO

**文件：**
- 修改：`scripts/build-hexagram-pages.ts`
- 修改：`scripts/build-vercel.ts`
- 修改：`.gitignore`
- 修改：`web/pages/Home.tsx`
- 新增：`tests/bazi-pages.test.ts`
- 修改：`tests/frontend-home-en.test.ts`

1. 先写失败测试，覆盖索引与 20 个页面、唯一 SEO、英文正文、互链、CTA、信标、sitemap、OG 回退、构建入口和首页语言条件。
2. 运行相关测试，确认缺少页面和链接导致预期失败。
3. 扩展生成器，复用 `/hexagram/hexagram.css`，按输出目录中的专属 PNG 是否存在写入绝对 OG 地址。
4. 更新 Vercel 静态入口、生成物忽略项和英文首页链接；重跑测试至通过。

### 任务 3：OG 卡片与本机渲染脚本

**文件：**
- 新增：`scripts/render-og-images.ts`
- 新增：`tests/render-og-images.test.ts`
- 修改：`package.json`

1. 先写失败测试，覆盖 64 卦、日主、十神卡片文字、尺寸、站点署名及无外部字体。
2. 运行测试确认模块缺失失败。
3. 实现可单测的 HTML 卡片函数、临时 HTML 生成和 Chrome `--headless=new` 截图流程，加入 `og:render`。
4. 重跑测试至通过；沙箱中不实际启动 Chrome。

### 任务 4：OpenSpec 状态与全量验证

**文件：**
- 修改：`openspec/changes/share-bazi-pages/tasks.md`

1. 勾选 2.1、2.2、2.4；2.3 保持未勾选并注明模板脚本已完成、84 张 PNG 待主管渲染提交。
2. 运行 `npx tsc --noEmit`。
3. 运行 `npm test`，仅接受已知 `tests/frontend-server.test.ts` 的 EPERM。
4. 运行 `npm run -s frontend:build`、`npm run -s vercel:build`、`npm run -s frontend:secrets`。
5. 运行 `openspec validate share-bazi-pages --strict`，核对任务状态与 spec。
