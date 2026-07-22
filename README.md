# Cadence

<p align="center"><strong>把 CPU 调度搬到人的多任务管理上</strong></p>

<p align="center">自适应退避提醒 · 端到端加密 · 开源自用</p>

<p align="center">
  <a href="https://github.com/caseclose">
    <img src="https://img.shields.io/badge/设计_&_开发-Feng_Wang-181717?style=for-the-badge&logo=github&logoColor=white" alt="设计 & 开发" />
  </a>
  <a href="mailto:fengw2002@gmail.com">
    <img src="https://img.shields.io/badge/Gmail-fengw2002%40gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail" />
  </a>
  <a href="mailto:fengwang@stu.pku.edu.cn">
    <img src="https://img.shields.io/badge/北大邮箱-fengwang%40stu.pku.edu.cn-8B0000?style=for-the-badge&logo=telegram&logoColor=white" alt="北大邮箱" />
  </a>
</p>

<p align="center">挂起任务 · Markdown 备忘录 · Web Push / 飞书企微钉钉</p>

<p align="center">
  <a href="https://caseclose.github.io/cadence/">
    <img src="https://img.shields.io/badge/Demo-caseclose.github.io-0E8A5F?logo=githubpages&logoColor=white" alt="Online demo" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

---

把 CPU 的「上下文切换 + 自适应退避轮询」搬到人的多任务管理上。

单核 CPU 在等待某个任务（I/O、计时器）时会把它挂起（`yield()`），去做别的事，并周期性回来检查它是否就绪。人也一样：你启动了一次模型训练、或把某件事交给了某个人/agent，需要过一阵才有结果。Cadence 让你把这件事「挂起」，然后按一个自适应的回访节奏（cadence）回来提醒你确认，而不是一直占着你的注意力。

## 核心机制：自适应退避

每个挂起任务带一个预计时长 ETA，第一次提醒正好落在 ETA。到点后你四选一，对应不同的调度动作（已完成 / 还没好 / 没空看 / 重估时长）。间隔按两种策略自适应：

- **收敛式**（默认，适合有可靠 ETA 的，如模型训练）：过了 ETA 大概率快好了，间隔越来越短，快速收敛到确认完成。
- **指数式**（适合等人 / 等 agent，ETA 不可靠）：间隔翻倍，越等越少打扰。

护栏：最小间隔防刷屏、最大间隔封顶、±10% jitter 避免多任务撞车、过期加速。完整原理与调度动作见 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

## 主要能力

- **挂起 + 自适应提醒**：到点四选一（完成 / 还没好 / 没空看 / 重估）
- **备忘录（Markdown）**：任务可附带长上下文（命令、链接、检查清单）；居中宽模态编辑/预览，到点提醒时一并展示；云端同步时随任务 E2EE 加密
- **后台提醒**：Web Push；国内推荐飞书 / 企微 / 钉钉 Webhook；可单独选择是否发送任务明文（见 [docs/PUSH.md](docs/PUSH.md)）
- **可选云同步**：Supabase Auth + Realtime；未配置时纯本地 localStorage
- **中英文界面**：顶部可切换中文 / English，选择会保存在当前浏览器

## 通知方式

Cadence 提供三种通知通道，可按使用环境组合开启：

| 通道 | 适用场景 | 说明 |
|------|----------|------|
| **网页通知** | 网页保持打开 | 浏览器原生通知权限；页面运行时提醒，适合桌面端和日常使用 |
| **后台推送** | 关闭页面 / 锁屏 | Service Worker + Web Push；需要浏览器支持，中国大陆 Chrome 可能受推送服务限制 |
| **群机器人 Webhook** | 中国大陆 / 团队协作 | 飞书、企业微信、钉钉直接接收群消息；不依赖浏览器保持打开，见 [docs/PUSH.md](docs/PUSH.md) |

界面中的「开启网页通知」和「开启后台推送」是两条独立通道。大陆用户建议优先配置群机器人 Webhook。

## 任务备忘录

任务可以附带 Markdown 备忘录，用来保存命令、链接、上下文和检查清单。备忘录支持居中宽模态编辑 / 预览，并会在输入后自动保存；到点提醒中点击备忘录即可直接打开编辑。

## 技术栈

- React + Vite + TypeScript，纯静态前端
- 提醒：浏览器 Web Notification + Web Audio 铃声（网页开着时生效）；可选后台 Web Push / 群机器人 Webhook
- 跨设备同步（可选）：Supabase（Auth + Postgres + Realtime）；未配置时退化为纯本地 localStorage
- 登录用户任务内容（含备忘录）**端到端加密**后再上云，云端只存密文
- Markdown：`marked` 渲染 + `DOMPurify` 消毒

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
| [docs/PUSH.md](docs/PUSH.md) | 后台提醒：Web Push + 飞书/企微/钉钉 Webhook |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 开发约定与贡献流程 |

## 许可证

[MIT](LICENSE)
