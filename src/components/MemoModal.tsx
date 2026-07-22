import { useEffect, useRef, useState } from 'react';
import { Task } from '../scheduler/types';
import { MarkdownView } from './MarkdownView';

interface Props {
  task: Task;
  onSave: (id: string, note: string) => void;
  onClose: () => void;
}

const AUTOSAVE_MS = 400;

/**
 * Wide centered memo modal with debounced autosave.
 */
export function MemoModal({ task, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(task.note ?? '');
  const [tab, setTab] = useState<'edit' | 'preview'>(task.note ? 'preview' : 'edit');
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saved'>('idle');

  const draftRef = useRef(draft);
  const taskIdRef = useRef(task.id);
  const noteRef = useRef(task.note ?? '');
  const onSaveRef = useRef(onSave);

  draftRef.current = draft;
  noteRef.current = task.note ?? '';
  onSaveRef.current = onSave;

  useEffect(() => {
    if (taskIdRef.current === task.id) return;
    taskIdRef.current = task.id;
    setDraft(task.note ?? '');
    setTab(task.note ? 'preview' : 'edit');
    setSaveState('idle');
  }, [task.id, task.note]);

  useEffect(() => {
    if (draft.trim() === (task.note ?? '').trim()) return;
    setSaveState('pending');
    const timer = window.setTimeout(() => {
      onSaveRef.current(task.id, draft);
      setSaveState('saved');
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, task.id, task.note]);

  const flushAndClose = () => {
    const current = draftRef.current;
    if (current.trim() !== noteRef.current.trim()) {
      onSaveRef.current(task.id, current);
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') flushAndClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close over latest flush via refs
  }, [onClose, task.id]);

  const statusLabel =
    saveState === 'pending' ? '保存中…' : saveState === 'saved' ? '已自动保存' : '自动保存';

  return (
    <div className="modal-backdrop memo-backdrop" onClick={flushAndClose}>
      <div
        className="modal memo-modal"
        role="dialog"
        aria-labelledby="memo-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="memo-modal-head">
          <div>
            <div id="memo-modal-title" className="modal-title">
              备忘录
            </div>
            <div className="memo-modal-task">{task.title}</div>
          </div>
          <button type="button" className="ghost" onClick={flushAndClose}>
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

        <div className="memo-body">
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
        </div>

        <div className="memo-modal-foot">
          <span className="memo-hint">支持标题、列表、代码块、链接</span>
          <span className={`memo-save-status memo-save-${saveState}`} aria-live="polite">
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
