import { create } from 'zustand';
import type { Reminder } from '@/types';
import { getDataSource } from '@/data/dataSource';
import { today } from '@/lib/utils';
import { useSettings } from '@/stores/settingsStore';

interface ReminderState {
  reminders: Reminder[];
  /** Reminder currently due and not dismissed — drives the in-app banner. */
  due: Reminder | null;
  intervalId: ReturnType<typeof setInterval> | null;
  load: () => Promise<void>;
  update: (reminder: Reminder) => Promise<void>;
  start: () => void;
  stop: () => void;
  dismissDue: () => void;
  requestPermission: () => Promise<boolean>;
}

function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function fire(reminder: Reminder): Promise<void> {
  const enabled = useSettings.getState().settings?.notificationsEnabled;
  if (enabled && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.ready;
      const body = reminder.label;
      if (reg) {
        await reg.showNotification('Gym Tracker', { body, tag: reminder.id, badge: '/icons/icon-192.png', icon: '/icons/icon-192.png' });
      } else {
        new Notification('Gym Tracker', { body });
      }
    } catch {
      /* fall back to in-app banner only */
    }
  }
}

export const useReminders = create<ReminderState>((set, get) => ({
  reminders: [],
  due: null,
  intervalId: null,

  async load() {
    const reminders = await getDataSource().reminders.getAll();
    set({ reminders: reminders.sort((a, b) => a.time.localeCompare(b.time)) });
  },

  async update(reminder) {
    await getDataSource().reminders.put(reminder);
    set({ reminders: get().reminders.map((r) => (r.id === reminder.id ? reminder : r)).sort((a, b) => a.time.localeCompare(b.time)) });
  },

  start() {
    if (get().intervalId) return;
    const check = async () => {
      const hm = nowHM();
      const dow = new Date().getDay();
      const day = today();
      for (const r of get().reminders) {
        if (!r.enabled) continue;
        if (r.repeatDays.length > 0 && !r.repeatDays.includes(dow)) continue;
        if (r.time !== hm) continue;
        if (r.lastFiredDate === day) continue;
        const fired: Reminder = { ...r, lastFiredDate: day };
        await get().update(fired);
        await fire(fired);
        set({ due: fired });
      }
    };
    void check();
    // Check every 30s so we catch the minute boundary reliably.
    const id = setInterval(() => void check(), 30_000);
    set({ intervalId: id });
  },

  stop() {
    const id = get().intervalId;
    if (id) clearInterval(id);
    set({ intervalId: null });
  },

  dismissDue() {
    set({ due: null });
  },

  async requestPermission() {
    if (!('Notification' in window)) return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
  },
}));
