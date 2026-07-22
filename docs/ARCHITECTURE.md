# 架构说明

Cadence 是纯静态前端（React + Vite + TypeScript），可选接一个 Supabase 后端做认证与跨设备同步。核心是一个纯函数式的**自适应退避调度引擎**。

## 目录结构

```
src/
├── App.tsx                 # 根组件，装配布局与全局状态
├── main.tsx                # 入口，挂载 React + ErrorBoundary
├── components/             # UI 组件（无业务逻辑，靠 store 驱动）
│   ├── AuthBar.tsx         #   登录/注册/登出、Web Push 开关
│   ├── TaskForm.tsx        #   挂起新任务（可写 Markdown 备忘录）
│   ├── TaskCard.tsx        #   单个挂起任务（摘要 + 打开备忘录）
│   ├── MemoModal.tsx       #   备忘录居中宽模态（编辑 / 预览）
│   ├── MarkdownView.tsx    #   安全 Markdown 渲染
│   ├── ReminderModal.tsx   #   到点提醒的四选一弹窗（含备忘录）
│   ├── UnlockVault.tsx     #   刷新后重新输入密码解锁 E2EE
│   ├── WebhookSettings.tsx #   飞书 / 企微 / 钉钉 Webhook
│   ├── ProjectIntro.tsx    #   可折叠的项目介绍
│   ├── ErrorBoundary.tsx   #   兜底渲染，防白屏
│   ├── ThemeToggle.tsx / WhenFormatGuide.tsx
├── scheduler/             # 调度引擎（纯函数，可独立测试）
│   ├── backoff.ts          #   退避序列计算（收敛式 / 指数式）
│   ├── ticker.ts           #   定时轮询，触发到点提醒
│   └── types.ts            #   Task / 策略等类型定义
├── store/                 # 状态、持久化、认证、同步
│   ├── useStore.ts         #   Zustand store（唯一状态源）
│   ├── supabase.ts         #   Supabase 客户端（未配置时为 null）
│   ├── mapping.ts          #   Task ↔ DB 行互转，含 enc 加解密
│   ├── taskSanitize.ts     #   校验/修复本地缓存，防损坏数据崩溃
│   ├── username.ts         #   用户名 ↔ 邮箱映射（支持中文）
│   └── authErrors.ts       #   认证错误信息本地化
├── crypto/                # 端到端加密
│   ├── e2ee.ts             #   RSA/AES/PBKDF2 原语
│   └── keyring.ts          #   会话内 DEK 管理
├── notify/
│   ├── index.ts            #   本地通道：Web Notification + Web Audio
│   ├── push.ts             #   Web Push 订阅 / 退订（后台推送）
│   └── webhooks.ts         #   群机器人 Webhook CRUD / 测试
├── theme/                 # 主题定义与 hook
└── util/
    ├── time.ts             #   时间解析/格式化（含中文时长）
    └── markdown.ts         #   Markdown 渲染 + 摘要截断
```

根目录与 `public/` 相关：

- `public/sw.js` — Service Worker（收推送、点通知打开应用）
- `public/manifest.webmanifest` + `public/icons/` — PWA 安装
- `supabase/functions/push-due/` — 到点推送 Edge Function

## 数据流

```
用户操作 ──▶ components ──▶ useStore (action)
                               │
                               ├─▶ scheduler：计算下次提醒时间
                               ├─▶ localStorage：按用户分 key 缓存
                               └─▶ Supabase（若已配置）
                                     │  mapping：Task → 行，crypto 加密为 enc
                                     └─▶ Realtime 订阅 ──▶ 回流更新 store
```

- **单一状态源**：所有状态在 `useStore`，组件只读状态、派发 action。
- **降级策略**：未配置 Supabase 时，`supabase.ts` 导出 `null`，store 自动退化为纯 localStorage 模式。
- **防崩溃**：本地缓存经 `taskSanitize` 校验；渲染层有 `ErrorBoundary` 兜底。

## 调度引擎：自适应退避

每个挂起任务带预计时长 ETA，首次提醒落在 ETA。到点后用户四选一，对应不同调度动作：

| 用户回答 | 调度动作 |
|----------|----------|
| 已完成 / 收工 | 任务出队 |
| 看了，还没好 | 走退避序列，稍后再提醒 |
| 现在没空看 | 短「小睡」，很快再问（不消耗退避序列） |
| 重估还要多久 | 回等待态，按新 ETA 重新计时 |

两种退避策略按任务类型选：

- **收敛式**（默认，适合有可靠 ETA，如模型训练）：过了 ETA 说明大概率快好了，间隔越来越短。首个间隔 `ETA × 1/4`，之后每次 `× 0.6`，floor 到 `minInterval`（默认 5m）。
- **指数式**（适合等人/等 agent，ETA 不可靠）：间隔翻倍 `5m → 10m → 20m → 40m…`，cap 到 `maxInterval`（默认 4h）。

护栏：`minInterval` 防刷屏、`maxInterval` 封顶、±10% jitter 避免多任务提醒撞车、过期加速。

引擎是纯函数，见 [`../src/scheduler/backoff.ts`](../src/scheduler/backoff.ts)，测试见 [`../src/scheduler/backoff.test.ts`](../src/scheduler/backoff.test.ts)。

## 备忘录（Markdown）

任务的 `note` 字段可存较长上下文（命令、链接、检查清单），支持 Markdown：

- 创建时在 `TaskForm` 多行输入；日常在 `MemoModal` 居中宽模态里编辑 / 预览
- 队列卡片只显示一行摘要（`util/markdown.noteSummary`），点开看全文
- 到点提醒 `ReminderModal` 会渲染备忘录，方便对照上下文做四选一
- 渲染：`marked` + `DOMPurify`（`MarkdownView` / `util/markdown.ts`）；上云时随任务 E2EE 加密

## 认证与同步

- 底层用 Supabase 邮箱 auth；用户名映射为 `xxx@cadence.auth`，中文用户名编码为 `u.{base64}@cadence.auth`（见 `store/username.ts`）。
- 同步为 last-write-wins，按 `updatedAt` 合并，适合单人多设备。

## 端到端加密

登录用户的任务内容在浏览器内加密后才同步，云端只存密文。完整机制见 [PRIVACY-E2EE.md](PRIVACY-E2EE.md)。

为支持后台 Web Push，加密行会把 **`next_fire_at` / `state` 明文**留给服务器（内容仍在 `enc`）。推送文案为通用文字，不含任务标题。见 [PUSH.md](PUSH.md)。

## 后台推送（可选）

- 前端：`public/sw.js` + `src/notify/push.ts`；登录后可点「开启推送」
- **国内推荐**：`src/notify/webhooks.ts` + `WebhookSettings` — 飞书 / 企微 / 钉钉群机器人
- 后端：`supabase/functions/push-due` 同时发 Web Push 与 Webhook；`pg_cron` 每分钟扫描
- 运维与平台说明见 [PUSH.md](PUSH.md)

## 已知局限与后续

- 未配置 VAPID / 未订阅推送时，提醒仍依赖标签页开着时的本地 ticker + Notification。
- 同步为 last-write-wins，不做冲突合并 UI。
