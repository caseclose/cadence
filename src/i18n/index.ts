import { useCallback, useSyncExternalStore } from 'react';

export type Locale = 'zh' | 'en';
const STORAGE_KEY = 'cadence.locale.v1';
let locale: Locale = loadLocale();
const listeners = new Set<() => void>();

function loadLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

export function getLocale(): Locale { return locale; }
export function setLocale(next: Locale): void {
  if (locale === next) return;
  locale = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  listeners.forEach((listener) => listener());
}
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, () => locale, () => 'zh');
}
export function useLanguage(): { locale: Locale; setLocale: (next: Locale) => void; toggle: () => void } {
  const current = useLocale();
  const toggle = useCallback(() => setLocale(current === 'zh' ? 'en' : 'zh'), [current]);
  return { locale: current, setLocale, toggle };
}

type Dictionary = Record<string, string>;
const zh: Dictionary = {
  appName: 'Cadence', whyCadence: '为什么做 Cadence？', introSub: '挂起任务，自适应回访',
  enableWeb: '开启网页通知', enablePush: '开启后台推送', pushEnabled: '后台推送已开启',
  localMode: '本地模式', signOut: '退出', loading: '加载中…', export: '导出', import: '导入',
  queue: '挂起队列', completed: '已完成', empty: '还没有挂起的任务。上面挂起一个试试。',
  loginToView: '登录后查看和同步你的任务。', unlockToView: '请先输入密码解锁加密任务。',
  decryptTitle: '解锁端到端加密', loginPassword: '登录密码', unlock: '解锁',
  formTitle: '挂起新任务', loginFirst: '请先登录后再挂起任务。',
  taskName: '任务名称，例如：等模型训练完', when: '多久后 / 几点 / 日期时间',
  converging: '收敛式 · 越来越勤', exponential: '指数式 · 越来越疏', suspend: '挂起',
  memoPlaceholder: '备忘录（可选，支持 Markdown：命令、链接、检查清单…）',
  waiting: '等待中', due: '待确认', polling: '轮询中', snoozed: '已小睡', done: '已完成',
  memo: '备忘录', writeMemo: '写备忘录', viewNow: '现在查看', delete: '删除',
  editTitle: '点击编辑任务名称', lockedTitle: '解锁后查看任务名称', taskLocked: '任务已加密，输入密码进行本地解密',
  reminderTitle: '该看一下「{title}」了', convergingPrompt: '按预计现在应该差不多完成了。当前状态如何？',
  pollingPrompt: '轮到检查这个挂起任务了。有进展吗？', doneAction: '已完成 / 收工', notDone: '看了，还没好（稍后再提醒）',
  noResources: '现在没空看（小睡一会）', reestimate: '重估', reestimatePlaceholder: '重估：30m / 14:00 / 下午3点',
  memoEdit: '编辑', memoPreview: '预览', close: '关闭', autosave: '自动保存', saving: '保存中…', saved: '已自动保存',
  emptyMemo: '还没有内容。切到「编辑」写点上下文吧。', memoHint: '支持标题、列表、代码块、链接 · 自动保存',
  reminderCount: '提醒',
  parseHint: '无法识别，试试 1h / 10分钟 / 周五下午2点 / 7月22日上午10点', invalidWhen: '无法识别，试试 30m / 2d / 明天14:00',
  openMemoEdit: '点击打开备忘录编辑', clickMemoEdit: '点击备忘录开始编辑', convergingShort: '收敛', exponentialShort: '指数',
  language: '语言', switchToEnglish: '切换到英文', switchToChinese: '切换到中文',
};
const en: Dictionary = {
  appName: 'Cadence', whyCadence: 'Why Cadence?', introSub: 'Suspend work, revisit adaptively',
  enableWeb: 'Enable web notifications', enablePush: 'Enable background push', pushEnabled: 'Background push enabled',
  localMode: 'Local mode', signOut: 'Sign out', loading: 'Loading…', export: 'Export', import: 'Import',
  queue: 'Suspended queue', completed: 'Completed', empty: 'No suspended tasks yet. Try adding one above.',
  loginToView: 'Sign in to view and sync your tasks.', unlockToView: 'Enter your password to unlock encrypted tasks.',
  decryptTitle: 'Unlock end-to-end encryption', loginPassword: 'Login password', unlock: 'Unlock',
  formTitle: 'Suspend a new task', loginFirst: 'Sign in before suspending a task.',
  taskName: 'Task name, e.g. wait for model training', when: 'In how long / time / date and time',
  converging: 'Converging · check more often', exponential: 'Exponential · check less often', suspend: 'Suspend',
  memoPlaceholder: 'Memo (optional, supports Markdown: commands, links, checklists…)',
  waiting: 'Waiting', due: 'Due', polling: 'Polling', snoozed: 'Snoozed', done: 'Completed',
  memo: 'Memo', writeMemo: 'Write memo', viewNow: 'Check now', delete: 'Delete',
  editTitle: 'Click to edit task name', lockedTitle: 'Unlock to view task name', taskLocked: 'Task encrypted, enter password to decrypt locally',
  reminderTitle: 'It’s time to check “{title}”', convergingPrompt: 'It should be nearly done by now. How is it going?',
  pollingPrompt: 'It’s time to check this suspended task. Any progress?', doneAction: 'Done / finish', notDone: 'Checked, not done (remind me later)',
  noResources: 'Can’t check now (snooze)', reestimate: 'Re-estimate', reestimatePlaceholder: 'Re-estimate: 30m / 14:00 / 3 PM',
  memoEdit: 'Edit', memoPreview: 'Preview', close: 'Close', autosave: 'Auto-save', saving: 'Saving…', saved: 'Auto-saved',
  emptyMemo: 'Nothing here yet. Switch to “Edit” to add context.', memoHint: 'Headings, lists, code blocks, links · auto-save',
  reminderCount: 'Reminders',
  parseHint: 'Not recognized. Try 1h / 10 minutes / Friday 2 PM', invalidWhen: 'Not recognized. Try 30m / 2d / tomorrow 14:00',
  openMemoEdit: 'Click to open memo editor', clickMemoEdit: 'Click memo to start editing', convergingShort: 'Converging', exponentialShort: 'Exponential',
  language: 'Language', switchToEnglish: 'Switch to English', switchToChinese: 'Switch to Chinese',
};
export function t(key: string, vars?: Record<string, string>): string {
  let value = (locale === 'en' ? en : zh)[key] ?? key;
  for (const [name, replacement] of Object.entries(vars ?? {})) value = value.split('{' + name + '}').join(replacement);
  return value;
}
export function dictionary(localeName: Locale): Dictionary { return localeName === 'en' ? en : zh; }
