import { Task } from '../scheduler/types';
import { formatRelative, formatDuration } from '../util/time';
import { noteSummary } from '../util/markdown';
import { useState } from 'react';

interface Props {
  task: Task;
  now: number;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenMemo?: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  done?: boolean;
}

const stateLabel: Record<Task['state'], string> = {
  waiting: '等待中',
  due: '待确认',
  polling: '轮询中',
  snoozed: '已小睡',
  done: '已完成',
};

export function TaskCard({ task, now, onCheck, onDelete, onOpenMemo, onUpdateTitle, done }: Props) {
  const overdue = !done && task.nextFireAt <= now && task.state !== 'done';
  const locked = task.title === '[e2ee]';
  const summary = task.note?.trim() ? noteSummary(task.note) : '';
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const saveTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== task.title) onUpdateTitle?.(task.id, next);
    setEditingTitle(false);
  };
  return (
    <div className={`card task ${overdue ? 'overdue' : ''} ${done ? 'done-card' : ''}`}>
      <div className="task-main">
        {editingTitle ? (
          <input
            className="task-title-editor"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
            }}
            aria-label="编辑任务名称"
          />
        ) : (
          <button
            type="button"
            className={`task-title task-title-button ${locked ? 'task-title-locked' : ''}`}
            disabled={locked || !onUpdateTitle}
            onClick={() => setEditingTitle(true)}
            title={locked ? '解锁后查看任务名称' : '点击编辑任务名称'}
          >
            {locked ? '🔒 任务已加密，输入密码进行本地解密' : task.title}
          </button>
        )}
        {summary && !locked && (
          <button
            type="button"
            className="task-note-summary"
            onClick={() => onOpenMemo?.(task.id)}
            title="打开备忘录"
          >
            {summary}
          </button>
        )}
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
          {onOpenMemo && !locked && (
            <button type="button" className="ghost" onClick={() => onOpenMemo(task.id)}>
              {task.note?.trim() ? '备忘录' : '写备忘录'}
            </button>
          )}
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
          {onOpenMemo && task.note?.trim() && !locked && (
            <button type="button" className="ghost" onClick={() => onOpenMemo(task.id)}>
              备忘录
            </button>
          )}
          <button type="button" className="ghost danger" onClick={() => onDelete(task.id)}>
            删除
          </button>
        </div>
      )}
    </div>
  );
}
