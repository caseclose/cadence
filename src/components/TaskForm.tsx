import { FormEvent, useState } from 'react';
import { Strategy } from '../scheduler/types';
import { parseWhen, formatDuration, formatFireAt } from '../util/time';
import { WhenFormatGuide } from './WhenFormatGuide';

interface Props {
  onAdd: (input: { title: string; note?: string; strategy: Strategy; etaMs: number }) => void;
  disabled?: boolean;
}

export function TaskForm({ onAdd, disabled }: Props) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('converging');
  const [note, setNote] = useState('');

  const parsed = when ? parseWhen(when) : null;
  const canSubmit = !disabled && title.trim().length > 0 && parsed !== null && parsed.etaMs > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !parsed) return;
    onAdd({ title: title.trim(), note: note.trim() || undefined, strategy, etaMs: parsed.etaMs });
    setTitle('');
    setWhen('');
    setNote('');
    setStrategy('converging');
  };

  const hint = (() => {
    if (!when) return null;
    if (!parsed) return '无法识别，试试 1h / 周五下午2点 / 7月22日上午10点';
    if (parsed.kind === 'clock') {
      return `将在 ${formatFireAt(parsed.fireAt)} 提醒你（约 ${formatDuration(parsed.etaMs)} 后）`;
    }
    return `将在 ${formatDuration(parsed.etaMs)} 后第一次提醒你`;
  })();

  return (
    <form className={`card form-card form${disabled ? ' form-disabled' : ''}`} onSubmit={submit}>
      <h3 className="form-card-title">挂起新任务</h3>
      {disabled && <p className="form-login-hint">请先登录后再挂起任务。</p>}
      <input
        className="field-full"
        placeholder="任务名称，例如：等模型训练完"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={disabled}
      />
      <input
        className="field-full"
        placeholder="多久后 / 几点 / 日期时间"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        disabled={disabled}
      />
      <div className="form-actions-row">
        <select
          className="field-strategy"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as Strategy)}
          aria-label="退避策略"
          disabled={disabled}
        >
          <option value="converging">收敛式 · 越来越勤</option>
          <option value="exponential">指数式 · 越来越疏</option>
        </select>
        <button type="submit" className="btn-submit" disabled={!canSubmit}>
          挂起
        </button>
      </div>
      <input
        className="field-full subtle"
        placeholder="备注（可选）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={disabled}
      />
      {hint && <div className="hint">{hint}</div>}
      <WhenFormatGuide />
    </form>
  );
}
