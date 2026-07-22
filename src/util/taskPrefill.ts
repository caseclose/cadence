import type { Strategy } from '../scheduler/types';

export function parseTaskPrefill(search: string): { title?: string; when?: string; strategy?: Strategy; note?: string } {
  const params = new URLSearchParams(search);
  const strategy = params.get('strategy');
  return {
    title: params.get('title') || undefined,
    when: params.get('when') || undefined,
    strategy: strategy === 'converging' || strategy === 'exponential' ? strategy : undefined,
    note: params.get('note') || undefined,
  };
}
