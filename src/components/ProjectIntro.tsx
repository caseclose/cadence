export function ProjectIntro() {
  return (
    <details className="intro-card">
      <summary className="intro-summary">
        <span className="intro-summary-label">
          <span className="intro-summary-q">为什么做 Cadence？</span>
          <span className="intro-summary-sep" aria-hidden>
            ·
          </span>
          <span className="intro-summary-sub">挂起任务，自适应回访</span>
        </span>
        <span className="intro-chevron" aria-hidden />
      </summary>

      <div className="intro-panel">
        <div className="intro-panel-inner">
          <p className="intro-copy">
            单核 CPU 会把等不到结果的任务<strong>挂起</strong>（<code>yield()</code>
            ），转去做别的，再按节奏回来检查。Cadence 把这套机制搬到人的多任务上：模型在训、事情交给同事或
            agent——你不必一直盯着，到点它会问你进展。
          </p>
          <h3 className="intro-strategies-title">两种回访策略</h3>
          <p className="intro-strategies-lead">
            你点「看了，还没好」之后，Cadence 按策略决定<strong>下次何时再来问</strong>（「现在没空」则是短睡，不推进退避）。
          </p>
          <div className="intro-strategies">
            <div className="intro-strategy">
              <span className="intro-badge converging">收敛式 · 越来越勤</span>
              <p className="intro-strategy-scene">
                <strong>适合</strong> 训练模型、烘焙、跑脚本等有<strong>明确完成时间</strong>的事。
              </p>
              <p className="intro-strategy-rhythm">
                到了 ETA，任务大概率快好了 → 提醒间隔<strong>逐渐缩短</strong>，帮你尽快确认能否收工。
              </p>
              <p className="intro-strategy-example">
                例：ETA 1h → 1h 后首问 → 约 +15m → +9m → 最短约 5m 一次
              </p>
            </div>
            <div className="intro-strategy">
              <span className="intro-badge exponential">指数式 · 越来越疏</span>
              <p className="intro-strategy-scene">
                <strong>适合</strong> 等人回复、等 agent 产出等<strong>完成时间说不准</strong>的事。
              </p>
              <p className="intro-strategy-rhythm">
                刚挂起时不宜频繁打扰 → 提醒间隔<strong>逐渐拉长</strong>，越等越不刷屏。
              </p>
              <p className="intro-strategy-example">
                例：首问后约 +5m → +10m → +20m → +40m…，最长约 4h 一次
              </p>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
