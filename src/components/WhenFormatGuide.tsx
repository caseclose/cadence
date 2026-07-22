import { useState } from 'react';

/** Collapsible cheat sheet for the when/ETA input field. */
export function WhenFormatGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="format-guide">
      <button
        type="button"
        className="link format-guide-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? '收起格式说明' : '格式说明'}
      </button>
      {open && (
        <div className="format-guide-body">
          <p className="format-guide-lead">
            「多久后」和「几点/哪天几点」等价，都会自动换算成第一次提醒时间。
          </p>
          <div className="format-guide-grid">
            <section>
              <h4>相对时长</h4>
              <ul>
                <li><code>1h</code> · <code>90m</code> · <code>2d</code></li>
                <li><code>10分钟</code> · <code>1小时</code> · <code>2天</code></li>
                <li><code>半小时</code> · <code>45</code>（纯数字 = 分钟）</li>
              </ul>
            </section>
            <section>
              <h4>时刻 / 相对日期</h4>
              <ul>
                <li><code>14:00</code> · <code>下午3点</code></li>
                <li><code>明天上午10点</code> · <code>后天14:00</code></li>
              </ul>
            </section>
            <section>
              <h4>星期</h4>
              <ul>
                <li><code>周五下午2点</code></li>
                <li><code>下周五14:00</code></li>
                <li><code>这周五上午10点</code></li>
              </ul>
            </section>
            <section>
              <h4>指定日期</h4>
              <ul>
                <li><code>7月22日上午10点</code></li>
                <li><code>7/22 10:00</code></li>
                <li><code>2026年7月22日下午3点</code></li>
              </ul>
            </section>
          </div>
          <p className="format-guide-note">
            仅写日期不写时间 → 默认 <strong>09:00</strong>。指定日期若已过且无年份 → 自动算到<strong>明年</strong>。
            预览示例：<strong>7月22日 10:00</strong>。
          </p>
        </div>
      )}
    </div>
  );
}
