# Cadence

把 CPU 的「上下文切换 + 自适应退避轮询」搬到人的多任务管理上。

单核 CPU 在等待某个任务（I/O、计时器）时会把它挂起（`yield()`），去做别的事，并周期性回来检查它是否就绪。人也一样：你启动了一次模型训练、或把某件事交给了某个人/agent，需要过一阵才有结果。Cadence 让你把这件事「挂起」，然后按一个自适应的回访节奏（cadence）回来提醒你确认，而不是一直占着你的注意力。

## 核心机制：自适应退避

每个挂起任务带一个预计时长 ETA，第一次提醒正好落在 ETA。到点后你可以回答四种情况，对应不同的调度动作：

- 已完成 / 收工 -> 任务出队
- 看了，还没好 -> 走退避序列，稍后再提醒
- 现在没空看 -> 短「小睡」，很快再来问（不消耗退避序列，类比 CPU 无空闲周期）
- 重估还要多久 -> 回到等待态，按新 ETA 重新计时

两种退避策略按任务类型选：

- 收敛式（默认，适合有可靠 ETA 的，如模型训练）：过了 ETA 说明大概率快好了，所以间隔越来越短，快速收敛到「确认完成」。首个间隔 = `ETA × 1/4`，之后每次 `× 0.6`，floor 到 `minInterval`（默认 5m）。例 ETA=1h：1h 后首提醒 -> +15m -> +9m -> +5m -> +5m…
- 指数式（适合等人/等 agent，ETA 不可靠）：间隔翻倍，`5m -> 10m -> 20m -> 40m…`，cap 到 `maxInterval`（默认 4h），越等越不打扰你。

护栏：`minInterval` 防刷屏、`maxInterval` 封顶、±10% jitter 避免多任务提醒撞车、过期加速（远超 ETA 时收敛更快）。

调度引擎是纯函数，见 [`src/scheduler/backoff.ts`](src/scheduler/backoff.ts)，测试见 [`src/scheduler/backoff.test.ts`](src/scheduler/backoff.test.ts)。

## 技术栈

- React + Vite + TypeScript，纯前端，部署到 GitHub Pages
- 提醒：浏览器 Web Notification + Web Audio 铃声（网页开着时生效）
- 跨设备同步：Supabase（Auth + Postgres + Realtime），离线优先，未登录时退化为纯本地 localStorage
- 通知通道做了抽象（[`src/notify/index.ts`](src/notify/index.ts)），未来可加微信 / 邮件 / Web Push

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入 Supabase URL 和 anon key（可留空跑本地模式）
npm run dev
npm test                     # 运行调度引擎单测
```

## 配置 Supabase

1. 在 [supabase.com](https://supabase.com) 建一个免费项目。
2. 打开 SQL Editor，运行 [`supabase/schema.sql`](supabase/schema.sql) 建表、开 RLS 和 Realtime。
3. 在 `Settings → API` 拿到 `Project URL` 和 `anon/publishable key`，填进 `.env.local`。

两个值都可安全放进浏览器（靠 RLS 行级权限保护），但不要暴露 `service_role` / `secret` key。

## 部署到 GitHub Pages

1. 推到 GitHub 仓库（默认 base 路径为 `/cadence/`，若仓库名不同，CI 会用仓库名自动设置）。
2. 仓库 `Settings → Secrets and variables → Actions` 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
3. 仓库 `Settings → Pages` 的 Source 选 `GitHub Actions`。
4. 推到 `main` 即自动构建部署，见 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)。

## 局限与后续

- Web Notification 只在标签页开着时触发。关页/手机后台推送需 Service Worker + Web Push（已在 notify 层预留通道抽象）。
- 同步为 last-write-wins，按 `updatedAt` 合并，适合单人多设备。
