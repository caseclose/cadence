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
            「多久后」和「几点提醒」等价，都会自动换算成第一次提醒时间。
          </p>
          <div className="format-guide-grid">
            <section>
              <h4>相对时长</h4>
              <ul>
                <li><code>1h</code> · <code>90m</code> · <code>1h30m</code></li>
                <li><code>2d</code> · <code>1d12h</code>（跨天时长）</li>
                <li><code>45s</code> · <code>45</code>（纯数字 = 分钟）</li>
              </ul>
            </section>
            <section>
              <h4>绝对时刻</h4>
              <ul>
                <li><code>14:00</code> · <code>下午3点</code> · <code>3pm</code></li>
                <li><code>明天下午3点</code> · <code>后天14:00</code></li>
                <li><code>明天</code>（默认 09:00）</li>
              </ul>
            </section>
          </div>
          <p className="format-guide-note">
            跨天规则：填的时刻若今天已过 → 自动算到<strong>明天</strong>同一时刻；
            也可显式写<strong>明天/后天</strong>指定日期。预览会显示「明天 15:00」等。
          </p>
        </div>
      )}
    </div>
  );
}
