export function ProjectIntro() {
  return (
    <section className="intro-card card" aria-labelledby="intro-title">
      <h2 id="intro-title" className="intro-title">
        为什么做 Cadence？
      </h2>
      <p className="intro-lead">
        单核 CPU 同时处理多件事时，会把暂时等不到结果的任务<strong>挂起</strong>（就像系统调用{' '}
        <code>yield()</code>），转去做别的，再按节奏回来检查它是否就绪。人的多任务也一样：模型在训、
        事情交给同事或 agent 去做——你不必一直盯着，但需要有人<strong>适时提醒你回来看一眼</strong>。
      </p>
      <p className="intro-body">
        Cadence 就是这个「人类任务调度器」：你把事情挂起并给一个预计时间，到点它会问你进展如何。
        你说「还没好」或「现在没空」，它会<strong>自适应地决定下次什么时候再来问</strong>——有可靠 ETA
        的任务越问越勤（收敛式），等人回复的则越问越疏（指数式），尽量不打扰你，又不错过该确认的时刻。
      </p>
      <ul className="intro-points">
        <li>
          <span className="intro-badge converging">收敛式</span>
          适合训练、烘焙等有明确完成时间的任务
        </li>
        <li>
          <span className="intro-badge exponential">指数式</span>
          适合等人、等 agent 回复等 ETA 不确定的任务
        </li>
      </ul>
    </section>
  );
}
