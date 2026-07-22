# 后台提醒（Web Push + 国内 Webhook）

让登录用户在**关页 / 锁屏**时也能收到任务到点提醒。服务器只知道「何时提醒」（`next_fire_at` 明文），不知任务内容（仍在 `enc` 密文）；推送 / 群消息均为**通用文案**。

## 架构一览

1. **Web Push（可选）**：PWA / 浏览器订阅 → `push_subscriptions`（大陆 Chrome 常因 FCM 不可用而失败）
2. **群机器人 Webhook（国内推荐）**：用户配置飞书 / 企微 / 钉钉 Webhook → `notification_webhooks`
3. 任务同步时，加密行把内容放进 `enc`，但 **`next_fire_at` / `state` 明文**
4. `pg_cron` 每分钟调用 Edge Function `push-due`
5. Function 查出到点任务 → Web Push（若有）+ Webhook（若有）→ 写 `notified_fire_at`

## 飞书 / 企微 / 钉钉（国内用户）

登录后展开 **「提醒通道」**，选择平台，粘贴群机器人 Webhook URL（飞书/钉钉若开了加签再填密钥），点保存。

到点后群内会收到类似：

> Cadence · 有挂起任务到点了。打开应用确认进度（内容已端到端加密，本消息不含任务明文）。

| 平台 | 获取方式 | 密钥 |
|------|----------|------|
| 飞书 | 群设置 → 机器人 → 自定义机器人 | 可选「签名校验」 |
| 企业微信 | 群 → 添加群机器人 → Webhook | 一般不需要 |
| 钉钉 | 智能群助手 → 自定义机器人 | 「加签」填 SEC；「关键词」请含 `Cadence` |

数据库迁移（只需跑一次）：执行 [`supabase/migration_webhooks.sql`](../supabase/migration_webhooks.sql)。

部署更新后的 Edge Function：

```bash
npx supabase functions deploy push-due
```

## Web Push（iOS / 海外 / 可访问 Google 时）

### 1. 生成 VAPID 密钥对

```bash
npx web-push generate-vapid-keys
```

### 2. 前端 / CI 配置公钥

本地 `.env.local` 与 GitHub Actions Secret：`VITE_VAPID_PUBLIC_KEY=<Public Key>`。

### 3. Supabase Secrets

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<Public Key> \
  VAPID_PRIVATE_KEY=<Private Key> \
  VAPID_SUBJECT=mailto:you@example.com
```

### 4. 部署 Edge Function

```bash
supabase functions deploy push-due
```

手动试跑期望：`{ "ok": true, "due": 0, "pushSent": 0, "webhookSent": 0 }`。

### 5. Push 表 + cron

执行 [`migration_push.sql`](../supabase/migration_push.sql)（改 `PROJECT_REF` 与 `service_role`）。Webhook 另跑 `migration_webhooks.sql`。

### 6. 用户侧

| 平台 | 要求 |
|------|------|
| 海外 Chrome / Edge | 登录 → 「开启推送」 |
| 大陆 Chrome | 常失败（FCM）；请用 Webhook |
| iOS Safari | 「添加到主屏幕」后的 PWA 再开推送 |

## 隐私

推送 / 群消息不含任务明文；Webhook URL 仅本人可见（RLS）。见 [PRIVACY-E2EE.md](PRIVACY-E2EE.md)。

## 排障

| 现象 | 排查 |
|------|------|
| Chrome「push service not available」 | 改用飞书/企微/钉钉 Webhook |
| 群里收不到 | URL/加签/钉钉关键词；cron 与 `push-due` 日志 |
| webhookSent: 0 | `notification_webhooks` 是否有 enabled 行 |
