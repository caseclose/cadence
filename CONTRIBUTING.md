# 贡献指南

欢迎 issue 和 PR。本项目是纯静态前端，本地开发无需任何后端即可跑起来。

## 环境准备

- Node.js 20+，npm 9+

```bash
git clone https://github.com/caseclose/cadence.git
cd cadence
npm install
npm run dev
```

不配置 Supabase 也能开发（纯本地模式）。需要联调登录/同步时，参考 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 配 `.env.local`。

## 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器（热更新） |
| `npm test` | 运行单测（Vitest） |
| `npm run test:watch` | 监听模式跑测试 |
| `npm run lint` | ESLint 检查 |
| `npm run build` | 类型检查 + 生产构建 |

## 代码约定

- **TypeScript strict**，避免 `any`。
- **调度逻辑保持纯函数**：`src/scheduler/` 内不做副作用，方便测试。
- **状态集中在 `src/store/useStore.ts`**：组件只读状态、派发 action，不各自持有业务状态。
- **组件无业务逻辑**：`src/components/` 只负责渲染与交互，逻辑下沉到 store / scheduler。
- 新增或改动调度、时间、加密、映射等纯逻辑时，**补充/更新对应的 `*.test.ts`**。

## 提交前检查

```bash
npm run lint && npm test && npm run build
```

三者都通过再提 PR。改了架构或目录结构，请同步更新 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 提交信息

推荐 [Conventional Commits](https://www.conventionalcommits.org/) 风格，例如：

```
feat: 增加飞书 webhook 通知通道
fix: 修复刷新后本地缓存损坏导致白屏
docs: 拆分部署文档
```
