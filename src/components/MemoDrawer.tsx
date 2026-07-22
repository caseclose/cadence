import { useEffect, useState } from 'react';
import { Task } from '../scheduler/types';
import { MarkdownView } from './MarkdownView';

interface Props {
  task: Task;
  onSave: (id: string, note: string) => void;
  onClose: () => void;
}

/**
 * Full memo surface for a task: edit Markdown context, preview rendered output.
 */
export function MemoDrawer({ task, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(task.note ?? '');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    setDraft(task.note ?? '');
    setTab(task.note ? 'preview' : 'edit');
  }, [task.id, task.note]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dirty = draft !== (task.note ?? '');

  const save = () => {
    onSave(task.id, draft.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop memo-backdrop" onClick={onClose}>
      <div
        className="modal memo-drawer"
        role="dialog"
        aria-labelledby="memo-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="memo-drawer-head">
          <div>
            <div id="memo-drawer-title" className="modal-title">
              备忘录
            </div>
            <div className="memo-drawer-task">{task.title}</div>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="memo-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'edit'}
            className={tab === 'edit' ? 'active' : ''}
            onClick={() => setTab('edit')}
          >
            编辑
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={tab === 'preview' ? 'active' : ''}
            onClick={() => setTab('preview')}
          >
            预览
          </button>
        </div>

        {tab === 'edit' ? (
          <textarea
            className="memo-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              '支持 Markdown：\n# 标题\n- 检查清单\n`命令`\n```\n代码块\n```\n[链接](https://…)'
            }
            spellCheck={false}
            autoFocus
          />
        ) : draft.trim() ? (
          <MarkdownView source={draft} className="memo-preview" />
        ) : (
          <div className="memo-empty">还没有内容。切到「编辑」写点上下文吧。</div>
        )}

        <div className="memo-drawer-foot">
          <span className="memo-hint">支持标题、列表、代码块、链接</span>
          <div className="memo-foot-actions">
            <button type="button" className="ghost" onClick={onClose}>
              取消
            </button>
            <button type="button" className="primary" disabled={!dirty} onClick={save}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
