# 部署与配置

涵盖三种运行方式（本地开发、本地部署、GitHub Pages）以及可选的 Supabase 后端配置。

## 环境要求

- **Node.js** 20 或更高
- **npm** 9+（或兼容的包管理器）

## 三种运行方式对比

| 场景 | 命令 | 访问路径 | base 路径 |
|------|------|----------|-----------|
| 本地开发（热更新） | `npm run dev` | `http://localhost:5173/` | `/` |
| 本地部署（生产版预览） | `npm run start:local` | `http://localhost:4173/` | `/` |
| GitHub Pages | CI 自动 `npm run build` | `https://<user>.github.io/cadence/` | `/cadence/` |

`VITE_BASE` 决定构建时的资源前缀：GitHub Pages 项目站需要 `/仓库名/`（CI 按仓库名注入），本地场景用 `/`。

## 本地开发

带热更新，适合改代码：

```bash
npm install
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
npm run build:local     # 按根路径 / 构建
npm run preview:local   # 启动预览服务
```

构建产物在 `dist/`，可用任意静态服务器托管：

```bash
npx serve dist -l 8080
# 打开 http://localhost:8080/
```

## 配置 Supabase（可选）

不配置 Supabase 时，应用为**纯本地模式**（数据存浏览器 `localStorage`，不跨设备，无需登录）。需要用户名登录、多设备同步时按下述步骤配置：

1. 在 [supabase.com](https://supabase.com) 建一个免费项目。
2. 打开 SQL Editor，运行 [`../supabase/schema.sql`](../supabase/schema.sql) 建表、开 RLS 和 Realtime（已含 E2EE 用的 `enc` 字段）。
3. 若你**很早以前**建过库、表里没有 `enc`，再补跑一次 [`../supabase/migration_e2ee.sql`](../supabase/migration_e2ee.sql)。
4. Authentication → Email：开启 Email provider，**关闭** Confirm email（无需邮件即可注册登录）。
5. 在 `Settings → API` 拿到 **Project URL** 和 **anon / publishable key**，写入 `.env.local`。
6. 重新执行 `npm run dev` 或 `npm run start:local`。

两个 key 都可安全放进浏览器（靠 RLS 行级权限保护），**不要**暴露 `service_role` / secret key。

### 环境变量（`.env.local`）

复制 [`../.env.example`](../.env.example) 为 `.env.local` 后按需填写：

| 变量 | 必填 | 说明 |
|------|------|------|
| `VITE_SUPABASE_URL` | 否 | Supabase 项目 URL；留空则纯本地模式 |
| `VITE_SUPABASE_ANON_KEY` | 否 | 浏览器端 anon / publishable key |
| `VITE_VAPID_PUBLIC_KEY` | 否 | Web Push VAPID 公钥；不配则无「开启推送」按钮。见 [PUSH.md](PUSH.md) |
| `VITE_BASE` | 否 | 构建时的 base 路径；本地部署用 `/`，一般不必手写（`build:local` 已处理） |

## 手机后台推送（可选）

需要关页 / 锁屏也能提醒时，按 [PUSH.md](PUSH.md) 配置 VAPID、部署 `push-due` Edge Function、执行 `migration_push.sql`。iOS 必须「添加到主屏幕」后使用。


## CLI（可选）

CLI 位于 `cli/`，使用当前账号的 Supabase JWT 经 RLS 访问任务。首次登录保存的仅是 session（`~/.config/cadence/config.json`，权限 0600）；每次读取或创建任务都必须临时提供 `CADENCE_PASSWORD` 解开 E2EE 数据密钥。不要将这个密码写进 shell 配置文件或 CI 日志。

```bash
cd cli && npm install && npm run build
node dist/index.js login --url "$VITE_SUPABASE_URL" --anon-key "$VITE_SUPABASE_ANON_KEY" --username YOUR_USERNAME --password 'LOGIN_PASSWORD'
CADENCE_PASSWORD='LOGIN_PASSWORD' node dist/index.js task add --title '等部署完成' --eta-ms 1800000
```

## 每日摘要（可选）

先执行 [`../supabase/migration_digest.sql`](../supabase/migration_digest.sql) 与 [`../supabase/migration_templates_events.sql`](../supabase/migration_templates_events.sql)，再部署 `daily-digest` Edge Function，并设置 `CADENCE_CRON_SECRET`。然后按 [`../supabase/migration_daily_digest_cron.sql`](../supabase/migration_daily_digest_cron.sql) 用 Vault 配置每 5 分钟调度。摘要在用户本地时区和设置时间发送，仅包含活跃/到期任务计数，不含 E2EE 任务内容。

## 部署到 GitHub Pages

1. Fork 或 push 到 GitHub 仓库（默认 base 为 `/cadence/`，CI 会按仓库名自动设置 `VITE_BASE`）。
2. 仓库 **Settings → Secrets and variables → Actions** 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`（可选，不配则访客侧为本地模式）。
3. 仓库 **Settings → Pages** 的 Source 选 **GitHub Actions**。
4. 推到 `main` 即自动构建部署，工作流见 [`../.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)。
