import { Task } from '../scheduler/types';
import { formatRelative, formatDuration } from '../util/time';

interface Props {
  task: Task;
  now: number;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
  done?: boolean;
}

const stateLabel: Record<Task['state'], string> = {
  waiting: '等待中',
  due: '待确认',
  polling: '轮询中',
  snoozed: '已小睡',
  done: '已完成',
};

export function TaskCard({ task, now, onCheck, onDelete, done }: Props) {
  const overdue = !done && task.nextFireAt <= now && task.state !== 'done';
  return (
    <div className={`card task ${overdue ? 'overdue' : ''} ${done ? 'done-card' : ''}`}>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        {task.note && <div className="task-note">{task.note}</div>}
        <div className="task-meta">
          <span className={`badge s-${task.state}`}>{stateLabel[task.state]}</span>
          <span className="badge strategy">
            {task.strategy === 'converging' ? '收敛' : '指数'}
          </span>
          <span>ETA {formatDuration(task.etaMs)}</span>
          {!done && (
            <>
              <span>· 提醒 {task.attempts} 次</span>
              <span>· {formatRelative(task.nextFireAt, now)}</span>
            </>
          )}
        </div>
      </div>
      {!done && (
        <div className="task-actions">
          <button type="button" className="ghost" onClick={() => onCheck(task.id)}>
            现在查看
          </button>
          <button type="button" className="ghost danger" onClick={() => onDelete(task.id)}>
            删除
          </button>
        </div>
      )}
      {done && (
        <div className="task-actions">
          <button type="button" className="ghost danger" onClick={() => onDelete(task.id)}>
            删除
          </button>
        </div>
      )}
    </div>
  );
}
