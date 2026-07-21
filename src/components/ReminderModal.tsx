import { useState } from 'react';
import { Action, Task } from '../scheduler/types';
import { parseWhen, formatDuration, formatClock } from '../util/time';

interface Props {
  task: Task;
  onResolve: (id: string, action: Action) => void;
  onClose: () => void;
}

/**
 * The core interaction: when a task is due, ask you what happened and turn
 * your answer into a scheduler action (done / not done / no time / reestimate).
 */
export function ReminderModal({ task, onResolve, onClose }: Props) {
  const [reWhen, setReWhen] = useState('');
  const parsed = reWhen ? parseWhen(reWhen) : null;

  const act = (action: Action) => {
    onResolve(task.id, action);
    onClose();
  };

  const hint =
    parsed && parsed.etaMs > 0
      ? parsed.kind === 'clock'
        ? `将在 ${formatClock(parsed.fireAt)} 重新提醒（约 ${formatDuration(parsed.etaMs)} 后）`
        : `将在 ${formatDuration(parsed.etaMs)} 后重新提醒`
      : reWhen
        ? '无法识别，试试 30m / 14:00 / 下午3点'
        : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">该看一下「{task.title}」了</div>
        <div className="modal-sub">
          {task.strategy === 'converging'
            ? '按预计现在应该差不多完成了。当前状态如何？'
            : '轮到检查这个挂起任务了。有进展吗？'}
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={() => act({ type: 'done' })}>
            已完成 / 收工
          </button>
          <button onClick={() => act({ type: 'checked_not_done' })}>
            看了，还没好（稍后再提醒）
          </button>
          <button onClick={() => act({ type: 'no_resources' })}>
            现在没空看（小睡一会）
          </button>
        </div>

        <div className="modal-reestimate">
          <input
            placeholder="重估：30m / 14:00 / 下午3点"
            value={reWhen}
            onChange={(e) => setReWhen(e.target.value)}
          />
          <button
            disabled={!parsed || parsed.etaMs <= 0}
            onClick={() => parsed && act({ type: 'reestimate', etaMs: parsed.etaMs })}
          >
            重估
          </button>
        </div>
        {hint && <div className="hint">{hint}</div>}
      </div>
    </div>
  );
}
