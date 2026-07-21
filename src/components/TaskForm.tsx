import { FormEvent, useState } from 'react';
import { Strategy } from '../scheduler/types';
import { parseEta, formatDuration } from '../util/time';

interface Props {
  onAdd: (input: { title: string; note?: string; strategy: Strategy; etaMs: number }) => void;
}

export function TaskForm({ onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [eta, setEta] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('converging');
  const [note, setNote] = useState('');

  const etaMs = parseEta(eta);
  const canSubmit = title.trim().length > 0 && etaMs !== null && etaMs > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || etaMs === null) return;
    onAdd({ title: title.trim(), note: note.trim() || undefined, strategy, etaMs });
    setTitle('');
    setEta('');
    setNote('');
    setStrategy('converging');
  };

  return (
    <form className="card form" onSubmit={submit}>
      <div className="row">
        <input
          className="grow"
          placeholder="挂起一个任务，例如：等模型训练完"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="row">
        <input
          placeholder="预计多久 (1h / 90m / 1h30m)"
          value={eta}
          onChange={(e) => setEta(e.target.value)}
        />
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
          <option value="converging">收敛式 (有ETA，越来越勤)</option>
          <option value="exponential">指数式 (等人/agent，越来越疏)</option>
        </select>
        <button type="submit" disabled={!canSubmit}>
          挂起
        </button>
      </div>
      <div className="row">
        <input
          className="grow subtle"
          placeholder="备注（可选）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {eta && (
        <div className="hint">
          {etaMs ? `将在 ${formatDuration(etaMs)} 后第一次提醒你` : '无法识别时长，试试 1h / 30m'}
        </div>
      )}
    </form>
  );
}
