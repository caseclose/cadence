# 架构说明

Cadence 是纯静态前端（React + Vite + TypeScript），可选接一个 Supabase 后端做认证与跨设备同步。核心是一个纯函数式的**自适应退避调度引擎**。

## 目录结构

```
src/
├── App.tsx                 # 根组件，装配布局与全局状态
├── main.tsx                # 入口，挂载 React + ErrorBoundary
├── components/             # UI 组件（无业务逻辑，靠 store 驱动）
│   ├── AuthBar.tsx         #   登录/注册/登出
│   ├── TaskForm.tsx        #   挂起新任务
│   ├── TaskCard.tsx        #   单个挂起任务
│   ├── ReminderModal.tsx   #   到点提醒的四选一弹窗
│   ├── UnlockVault.tsx     #   刷新后重新输入密码解锁 E2EE
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
├── notify/index.ts        # 通知通道抽象（当前：Web Notification + Web Audio）
├── theme/                 # 主题定义与 hook
└── util/time.ts           # 时间解析/格式化
```

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

## 认证与同步

- 底层用 Supabase 邮箱 auth；用户名映射为 `xxx@cadence.auth`，中文用户名编码为 `u.{base64}@cadence.auth`（见 `store/username.ts`）。
- 同步为 last-write-wins，按 `updatedAt` 合并，适合单人多设备。

## 端到端加密

登录用户的任务内容在浏览器内加密后才同步，云端只存密文。完整机制见 [PRIVACY-E2EE.md](PRIVACY-E2EE.md)。

## 已知局限与后续

- Web Notification 只在标签页开着时触发；关页/后台推送需 Service Worker + Web Push（notify 层已预留通道抽象）。
- 同步为 last-write-wins，不做冲突合并 UI。
