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
            agent——你不必一直盯着，到点它会问你进展；「还没好」或「现在没空」时，会<strong>自适应决定下次何时再来</strong>
            （有 ETA 越问越勤，等人回复则越问越疏）。
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
