# Cadence

把 CPU 的「上下文切换 + 自适应退避轮询」搬到人的多任务管理上。

单核 CPU 在等待某个任务（I/O、计时器）时会把它挂起（`yield()`），去做别的事，并周期性回来检查它是否就绪。人也一样：你启动了一次模型训练、或把某件事交给了某个人/agent，需要过一阵才有结果。Cadence 让你把这件事「挂起」，然后按一个自适应的回访节奏（cadence）回来提醒你确认，而不是一直占着你的注意力。

**在线演示：[caseclose.github.io/cadence](https://caseclose.github.io/cadence/)**

## 核心机制：自适应退避

每个挂起任务带一个预计时长 ETA，第一次提醒正好落在 ETA。到点后你四选一，对应不同的调度动作（已完成 / 还没好 / 没空看 / 重估时长）。间隔按两种策略自适应：

- **收敛式**（默认，适合有可靠 ETA 的，如模型训练）：过了 ETA 大概率快好了，间隔越来越短，快速收敛到确认完成。
- **指数式**（适合等人 / 等 agent，ETA 不可靠）：间隔翻倍，越等越少打扰。

护栏：最小间隔防刷屏、最大间隔封顶、±10% jitter 避免多任务撞车、过期加速。完整原理与调度动作见 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

## 技术栈

- React + Vite + TypeScript，纯静态前端
- 提醒：浏览器 Web Notification + Web Audio 铃声（网页开着时生效）
- 跨设备同步（可选）：Supabase（Auth + Postgres + Realtime）；未配置时退化为纯本地 localStorage
- 登录用户任务内容**端到端加密**后再上云，云端只存密文

## 快速开始

```bash
git clone https://github.com/caseclose/cadence.git
cd cadence
npm install
npm run dev          # http://localhost:5173/
```

不配置任何后端即可使用（纯本地模式，数据存浏览器）。需要用户名登录、多设备同步、或部署上线，见下方文档。

## 文档

| 文档 | 内容 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 目录结构、数据流、调度引擎原理 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 本地开发 / 本地部署 / GitHub Pages / Supabase 配置 |
| [docs/PRIVACY-E2EE.md](docs/PRIVACY-E2EE.md) | 端到端加密机制（可转发给关心隐私的用户） |
| [docs/PUSH.md](docs/PUSH.md) | 手机后台推送（Web Push + PWA） |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 开发约定与贡献流程 |

## 许可证

[MIT](LICENSE)
