# Cadence

把 CPU 的「上下文切换 + 自适应退避轮询」搬到人的多任务管理上。

单核 CPU 在等待某个任务（I/O、计时器）时会把它挂起（`yield()`），去做别的事，并周期性回来检查它是否就绪。人也一样：你启动了一次模型训练、或把某件事交给了某个人/agent，需要过一阵才有结果。Cadence 让你把这件事「挂起」，然后按一个自适应的回访节奏（cadence）回来提醒你确认，而不是一直占着你的注意力。

在线演示：[caseclose.github.io/cadence](https://caseclose.github.io/cadence/)

## 核心机制：自适应退避

每个挂起任务带一个预计时长 ETA，第一次提醒正好落在 ETA。到点后你可以回答四种情况，对应不同的调度动作：

- 已完成 / 收工 -> 任务出队
- 看了，还没好 -> 走退避序列，稍后再提醒
- 现在没空看 -> 短「小睡」，很快再来问（不消耗退避序列，类比 CPU 无空闲周期）
- 重估还要多久 -> 回到等待态，按新 ETA 重新计时

两种退避策略按任务类型选：

- **收敛式**（默认，适合有可靠 ETA 的，如模型训练）：过了 ETA 说明大概率快好了，所以间隔越来越短，快速收敛到「确认完成」。首个间隔 = `ETA × 1/4`，之后每次 `× 0.6`，floor 到 `minInterval`（默认 5m）。例 ETA=1h：1h 后首提醒 -> +15m -> +9m -> +5m -> +5m…
- **指数式**（适合等人/等 agent，ETA 不可靠）：间隔翻倍，`5m -> 10m -> 20m -> 40m…`，cap 到 `maxInterval`（默认 4h），越等越不打扰你。

护栏：`minInterval` 防刷屏、`maxInterval` 封顶、±10% jitter 避免多任务提醒撞车、过期加速（远超 ETA 时收敛更快）。

调度引擎是纯函数，见 [`src/scheduler/backoff.ts`](src/scheduler/backoff.ts)，测试见 [`src/scheduler/backoff.test.ts`](src/scheduler/backoff.test.ts)。

## 技术栈

- React + Vite + TypeScript，纯静态前端
- 提醒：浏览器 Web Notification + Web Audio 铃声（网页开着时生效）
- 跨设备同步（可选）：Supabase（Auth + Postgres + Realtime）；未配置时退化为纯本地 localStorage
- 通知通道做了抽象（[`src/notify/index.ts`](src/notify/index.ts)），未来可加微信 / 邮件 / Web Push

## 环境要求

- **Node.js** 20 或更高
- **npm** 9+（或兼容的包管理器）

## 快速开始

```bash
git clone https://github.com/caseclose/cadence.git
cd cadence
npm install
cp .env.example .env.local   # 可选：配置 Supabase，见下文
```

## 本地开发

带热更新的开发服务器，适合改代码：

```bash
npm run dev
```

浏览器打开终端里显示的地址（默认 `http://localhost:5173/`）。开发模式走站点根路径 `/`，无需设置 `VITE_BASE`。

```bash
npm test          # 运行单测
npm run test:watch
```

## 本地部署

在本机构建**生产版本**并用静态服务器预览，适合内网访问、自托管或部署前验收。

### 一键启动

```bash
npm run start:local
```

等价于 `build:local` + `preview:local`。构建完成后访问：

- 本机：**http://localhost:4173/**
- 局域网：终端会打印 `Network: http://<你的 IP>:4173/`，同一 WiFi 下的手机/平板也可访问

### 分步执行

```bash
# 1. 按根路径 / 构建（与 GitHub Pages 的 /cadence/ 不同）
npm run build:local

# 2. 启动预览服务
npm run preview:local
```

构建产物在 `dist/`，可用任意静态服务器托管，例如：

```bash
# 需先 npm run build:local
npx serve dist -l 8080
# 打开 http://localhost:8080/
```

### 本地部署 vs GitHub Pages

| 场景 | 命令 | 访问路径 |
|------|------|----------|
| 本地开发 | `npm run dev` | `http://localhost:5173/` |
| 本地部署 | `npm run start:local` | `http://localhost:4173/` |
| GitHub Pages | CI 自动 `npm run build` | `https://<user>.github.io/cadence/` |

GitHub Pages 使用 `VITE_BASE=/cadence/`（由 CI 按仓库名注入）。本地部署使用 `VITE_BASE=/`，通过 `build:local` 设置。

### 环境变量（`.env.local`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `VITE_SUPABASE_URL` | 否 | Supabase 项目 URL；留空则纯本地模式 |
| `VITE_SUPABASE_ANON_KEY` | 否 | 浏览器端 anon / publishable key |
| `VITE_BASE` | 否 | 构建时的 base 路径；本地部署用 `/`，一般不必在 `.env.local` 里写（`build:local` 已处理） |

纯本地模式：不创建 `.env.local`，或留空 Supabase 两项，即可挂起任务（数据在浏览器 localStorage，不跨设备）。

## 配置 Supabase（可选）

需要用户名登录、多设备同步时：

1. 在 [supabase.com](https://supabase.com) 建一个免费项目。
2. 打开 SQL Editor，运行 [`supabase/schema.sql`](supabase/schema.sql) 建表、开 RLS 和 Realtime。
3. Authentication → Email：开启 Email provider，**关闭** Confirm email（无需邮件即可注册登录）。
4. 在 `Settings → API` 拿到 **Project URL** 和 **anon / publishable key**，写入 `.env.local`。
5. 重新执行 `npm run dev` 或 `npm run start:local`。

两个 key 都可安全放进浏览器（靠 RLS 行级权限保护），**不要**暴露 `service_role` / secret key。

## 部署到 GitHub Pages

1. Fork 或 push 到 GitHub 仓库（默认 base 为 `/cadence/`，CI 会按仓库名自动设置 `VITE_BASE`）。
2. 仓库 **Settings → Secrets and variables → Actions** 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`（可选，不配则访客侧为本地模式）。
3. 仓库 **Settings → Pages** 的 Source 选 **GitHub Actions**。
4. 推到 `main` 即自动构建部署，见 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)。

## 局限与后续

- Web Notification 只在标签页开着时触发。关页/手机后台推送需 Service Worker + Web Push（已在 notify 层预留通道抽象）。
- 同步为 last-write-wins，按 `updatedAt` 合并，适合单人多设备。
