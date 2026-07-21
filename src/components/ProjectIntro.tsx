export function ProjectIntro() {
  return (
    <details className="intro-card">
      <summary className="intro-summary">
        <span className="intro-summary-icon" aria-hidden>
          ◷
        </span>
        <span className="intro-summary-text">
          <span className="intro-summary-title">为什么做 Cadence？</span>
          <span className="intro-summary-hint">CPU 式挂起 · 自适应回访节奏</span>
        </span>
        <span className="intro-chevron" aria-hidden />
      </summary>

      <div className="intro-panel">
        <div className="intro-panel-inner">
          <p className="intro-lead">
            单核 CPU 同时处理多件事时，会把暂时等不到结果的任务<strong>挂起</strong>（就像{' '}
            <code>yield()</code>），转去做别的，再按节奏回来检查。人的多任务也一样：模型在训、事情交给
            同事或 agent——你不必一直盯着，但需要有人<strong>适时提醒你回来看一眼</strong>。
          </p>
          <p className="intro-body">
            Cadence 就是这个「人类任务调度器」：挂起任务并给出预计时间，到点问你进展如何。你说「还没好」或
            「现在没空」，它会<strong>自适应决定下次何时再来问</strong>——有可靠 ETA 越问越勤，等人回复则越问越疏。
          </p>
          <div className="intro-strategies">
            <div className="intro-strategy">
              <span className="intro-badge converging">收敛式</span>
              <span>训练、烘焙等有明确完成时间</span>
            </div>
            <div className="intro-strategy">
              <span className="intro-badge exponential">指数式</span>
              <span>等人、等 agent 回复等 ETA 不确定</span>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
