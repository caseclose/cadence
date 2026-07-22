# 手机后台推送（Web Push + PWA）

让登录用户在**关页 / 锁屏**时也能收到任务到点提醒。服务器只知道「何时提醒」（`next_fire_at` 明文），不知任务内容（仍在 `enc` 密文）；推送文案为通用文案。

## 架构一览

1. 用户在已安装的 PWA / 支持 Push 的浏览器里点「开启推送」→ `pushManager.subscribe`（VAPID 公钥）
2. 订阅（endpoint + keys）写入 `push_subscriptions`
3. 任务同步时，加密行仍把内容放进 `enc`，但 **`next_fire_at` / `state` 明文**，供服务器调度
4. `pg_cron` 每分钟调用 Edge Function `push-due`
5. Function 查出到点且未通知过的任务 → 向该用户所有订阅发 Web Push → 写 `notified_fire_at`
6. 手机上的 Service Worker 收到 `push` → `showNotification`

## 一次性运维步骤

### 1. 生成 VAPID 密钥对

```bash
npx web-push generate-vapid-keys
```

会输出 `Public Key` 和 `Private Key`（URL-safe base64）。

### 2. 前端 / CI 配置公钥

本地 `.env.local`：

```bash
VITE_VAPID_PUBLIC_KEY=<Public Key>
```

GitHub 仓库 **Settings → Secrets and variables → Actions** 增加同名 secret `VITE_VAPID_PUBLIC_KEY`（CI 已在构建时注入，见 `.github/workflows/deploy.yml`）。

### 3. Supabase Secrets（私钥只放这里）

```bash
# 需已安装并登录 supabase CLI，并 link 到你的项目
supabase secrets set \
  VAPID_PUBLIC_KEY=<Public Key> \
  VAPID_PRIVATE_KEY=<Private Key> \
  VAPID_SUBJECT=mailto:you@example.com
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 由平台自动注入 Edge Function，不必手设。

### 4. 部署 Edge Function

```bash
cd /path/to/cadence
supabase functions deploy push-due
```

源码在 [`supabase/functions/push-due/index.ts`](../supabase/functions/push-due/index.ts)。`supabase/config.toml` 里对该函数设置了 `verify_jwt = false`，以便 `pg_cron` 用 service_role Bearer 调用。

手动试跑（把 URL / key 换成你的）：

```bash
curl -i -X POST \
  'https://PROJECT_REF.supabase.co/functions/v1/push-due' \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

期望 JSON 类似 `{ "ok": true, "due": 0, "sent": 0 }`。

### 5. 跑数据库迁移

在 Supabase **SQL Editor** 执行 [`supabase/migration_push.sql`](../supabase/migration_push.sql)：

1. 建 `push_subscriptions`、给 `tasks` 加 `notified_fire_at`
2. 启用 `pg_net` / `pg_cron`（若 Dashboard → Database → Extensions 里未开，先手动开）
3. **务必把脚本里的占位符改掉**：
   - `PROJECT_REF` → 你的项目 ref（URL 里 `https://xxxx.supabase.co` 的 xxxx）
   - `SERVICE_ROLE_KEY_HERE` → Settings → API → `service_role`（**不要**写进前端或 Git）

验证 cron：

```sql
select * from cron.job where jobname = 'cadence-push-due';
select * from cron.job_run_details order by start_time desc limit 10;
```

新库若直接跑完整 [`supabase/schema.sql`](../supabase/schema.sql)，仍需单独配置 cron（schema 不含带密钥的 schedule）；按上面改好 `migration_push.sql` 的 cron 段执行即可。

### 6. 用户侧（尤其是 iPhone）

| 平台 | 要求 |
|------|------|
| Android Chrome | 打开站点 → 登录 → 点「开启推送」→ 允许通知 |
| 桌面 Chrome / Edge / Firefox | 同上 |
| **iOS Safari** | 必须先 **分享 → 添加到主屏幕**，从主屏幕图标打开（PWA），再登录并点「开启推送」。普通 Safari 标签页**不支持** Web Push |

未配置 `VITE_VAPID_PUBLIC_KEY` 时，界面不显示「开启推送」按钮（退化为「网页开着时的本地提醒」）。

## 隐私说明

- 推送标题/正文为固定通用文案，**不含任务标题或备注**
- 云端可见每个未完成任务的 `next_fire_at` 与 `state`（为了调度）；内容仍只在 `enc` 密文里
- 详见 [PRIVACY-E2EE.md](PRIVACY-E2EE.md)

## 排障

| 现象 | 排查 |
|------|------|
| 没有「开启推送」按钮 | 未设 `VITE_VAPID_PUBLIC_KEY`，或浏览器不支持 Push（iOS 未装 PWA） |
| 点开启后报权限错误 | 系统通知被关；iOS 需在「设置 → 通知」里允许 Cadence |
| 开着网页能提醒、关页不行 | Edge Function / cron 未部署；或未成功写入 `push_subscriptions` |
| cron 有跑但 `sent: 0` | 用户未订阅；或 VAPID 公私钥不一致（前端公钥 ≠ Secrets 公钥） |
| 410 / 订阅被删 | 正常：浏览器吊销了 endpoint，下次需重新「开启推送」 |

日志：Supabase Dashboard → Edge Functions → `push-due` → Logs；以及 `cron.job_run_details`。
