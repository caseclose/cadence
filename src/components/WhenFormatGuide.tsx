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
                <li><code>45s</code> · <code>45</code>（纯数字 = 分钟）</li>
              </ul>
            </section>
            <section>
              <h4>绝对时刻</h4>
              <ul>
                <li><code>14:00</code> · <code>9:30</code></li>
                <li><code>下午3点</code> · <code>下午3点半</code></li>
                <li><code>晚上8点</code> · <code>3pm</code></li>
              </ul>
            </section>
          </div>
          <p className="format-guide-note">
            若填的时刻今天已过，会自动算到明天同一时刻。
          </p>
        </div>
      )}
    </div>
  );
}
