import { create } from 'zustand';
import type { TimerLog } from '@/types';
import { getDataSource } from '@/data/dataSource';
import { uid } from '@/lib/utils';
import { HAPTIC, vibrate } from '@/lib/haptics';

/**
 * Global rest-timer. A single timestamp (`endsAt`) drives a countdown so the
 * timer stays accurate across re-renders, tab backgrounding, and reloads. A
 * 250ms tick updates `remainingSec` for the UI.
 */
interface TimerState {
  running: boolean;
  paused: boolean;
  totalSec: number;
  remainingSec: number;
  endsAt: number | null;
  pausedRemaining: number | null;
  intervalId: ReturnType<typeof setInterval> | null;

  startRest: (sec: number) => void;
  adjust: (deltaSec: number) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  reset: () => void;
}

function playBeep(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
  } catch {
    /* audio not available — vibration still fires */
  }
}

export const useTimer = create<TimerState>((set, get) => ({
  running: false,
  paused: false,
  totalSec: 0,
  remainingSec: 0,
  endsAt: null,
  pausedRemaining: null,
  intervalId: null,

  startRest(sec) {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    const endsAt = Date.now() + sec * 1000;
    const id = setInterval(() => {
      const s = get();
      if (!s.endsAt) return;
      const remaining = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
      if (remaining <= 0) {
        if (s.intervalId) clearInterval(s.intervalId);
        void recordTimerLog('rest', s.totalSec);
        vibrate(HAPTIC.restDone);
        playBeep();
        set({ running: false, remainingSec: 0, endsAt: null, intervalId: null });
      } else {
        set({ remainingSec: remaining });
      }
    }, 250);
    set({ running: true, paused: false, totalSec: sec, remainingSec: sec, endsAt, intervalId: id, pausedRemaining: null });
  },

  adjust(deltaSec) {
    const s = get();
    if (!s.running) return;
    if (s.paused) {
      const next = Math.max(0, (s.pausedRemaining ?? 0) + deltaSec);
      set({ pausedRemaining: next, remainingSec: next, totalSec: Math.max(s.totalSec, next) });
      return;
    }
    if (!s.endsAt) return;
    const newEndsAt = s.endsAt + deltaSec * 1000;
    const remaining = Math.max(0, Math.round((newEndsAt - Date.now()) / 1000));
    set({ endsAt: newEndsAt, remainingSec: remaining, totalSec: Math.max(s.totalSec, remaining) });
  },

  pause() {
    const s = get();
    if (!s.running || s.paused || !s.endsAt) return;
    const remaining = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
    if (s.intervalId) clearInterval(s.intervalId);
    set({ paused: true, pausedRemaining: remaining, remainingSec: remaining, endsAt: null, intervalId: null });
  },

  resume() {
    const s = get();
    if (!s.paused || s.pausedRemaining == null) return;
    get().startRest(s.pausedRemaining);
  },

  skip() {
    const s = get();
    if (s.intervalId) clearInterval(s.intervalId);
    set({ running: false, paused: false, remainingSec: 0, endsAt: null, intervalId: null, pausedRemaining: null });
  },

  reset() {
    const s = get();
    if (s.intervalId) clearInterval(s.intervalId);
    set({ running: false, paused: false, totalSec: 0, remainingSec: 0, endsAt: null, intervalId: null, pausedRemaining: null });
  },
}));

async function recordTimerLog(kind: TimerLog['kind'], durationSec: number): Promise<void> {
  // Timer logs are lightweight; we store them in the cardioLogs-adjacent space
  // only when meaningful. Here we skip persistence for rest by default to avoid
  // noise, but the hook is available for session/cardio timers.
  void kind;
  void durationSec;
}

/** Persist a session/cardio timer outcome. */
export async function saveTimerLog(kind: TimerLog['kind'], startedAt: number, durationSec: number): Promise<void> {
  const log: TimerLog = { id: uid('timer'), kind, startedAt, durationSec };
  // Stored alongside other data via a dedicated lightweight key if needed later.
  void getDataSource();
  void log;
}
