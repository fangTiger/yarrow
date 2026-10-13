## 1. Implementation
- [x] 1.1 链配置由环境变量驱动（服务端、前端、构建注入），主网文案与水龙头处理
- [x] 1.2 修复 HTTPS 同源校验
- [x] 1.3 存储接口与 Upstash Redis 实现（解读、译文、付款凭证）
- [x] 1.4 后台任务 `keepAlive` 挂钩，Vercel 入口接 `waitUntil`
- [x] 1.5 Vercel 构建脚本（Build Output API）与 `vercel.json`
- [x] 1.6 测试：Redis 存储（含原子更新与去重）、同源校验、主网配置
- [x] 1.7 本地以构建产物模拟函数跑通一卦（mock 存储），类型检查与全量测试通过
- [ ] 1.8 推送 GitHub 公开仓库（先扫描密钥），部署 Vercel 主网并真钱验收一卦
