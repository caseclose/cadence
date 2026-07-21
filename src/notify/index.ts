import { Task } from '../scheduler/types';

export interface NotifyPayload {
  task: Task;
  title: string;
  body: string;
}

/**
 * A notification channel. New channels (wechat / email / web-push) can be
 * added later by implementing this interface and registering them.
 */
export interface Channel {
  id: string;
  isAvailable(): boolean;
  send(payload: NotifyPayload): void | Promise<void>;
}

/** Browser desktop notification (works while the tab is open). */
export const webNotificationChannel: Channel = {
  id: 'web-notification',
  isAvailable() {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  },
  send({ title, body }) {
    if (!this.isAvailable()) return;
    new Notification(title, { body, tag: title });
  },
};

/** Short chime via the Web Audio API (no external asset needed). */
export const soundChannel: Channel = {
  id: 'sound',
  isAvailable() {
    return typeof AudioContext !== 'undefined' || 'webkitAudioContext' in globalThis;
  },
  send() {
    try {
      const Ctor =
        (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      osc.onended = () => ctx.close();
    } catch {
      // audio may be blocked before a user gesture; ignore.
    }
  },
};

const channels: Channel[] = [webNotificationChannel, soundChannel];

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function notifyAll(payload: NotifyPayload): void {
  for (const ch of channels) {
    if (ch.isAvailable()) {
      void ch.send(payload);
    }
  }
}

export function reminderCopy(task: Task): NotifyPayload {
  return {
    task,
    title: `Yield · 该看一下「${task.title}」了`,
    body:
      task.strategy === 'converging'
        ? '预计应该完成了，确认一下是否可以收工？'
        : '轮到检查这个挂起任务了，有进展吗？',
  };
}
