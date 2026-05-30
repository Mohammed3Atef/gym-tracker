import { create } from 'zustand';
import type { DailyChecklist, Streaks } from '@/types';
import { getDataSource } from '@/data/dataSource';
import { today } from '@/lib/utils';
import {
  buildChecklist,
  computeStreaks,
  extractManual,
} from '@/services/habits/habitLogic';

const EMPTY_STREAK = { current: 0, longest: 0, lastDate: null };

interface HabitState {
  checklist: DailyChecklist | null;
  streaks: Streaks;
  /** Recompute today's checklist from current logs and persist it. */
  refresh: (date?: string) => Promise<void>;
  /** Recompute all streaks (reads full history). */
  refreshStreaks: () => Promise<void>;
  /** Manually toggle a checklist item (overrides the auto value). */
  toggle: (key: string) => Promise<void>;
}

export const useHabits = create<HabitState>((set, get) => ({
  checklist: null,
  streaks: {
    workout: EMPTY_STREAK,
    nutrition: EMPTY_STREAK,
    water: EMPTY_STREAK,
    steps: EMPTY_STREAK,
    overall: EMPTY_STREAK,
  },

  async refresh(date = today()) {
    const ds = getDataSource();
    const [settings, mealPlan, workoutLog, nutritionLog, cardioAll, stored] =
      await Promise.all([
        ds.settings.get(),
        ds.mealPlans.getAll().then((p) => p[0] ?? null),
        ds.workoutLogs.get(date),
        ds.nutritionLogs.get(date),
        ds.cardioLogs.getAll(),
        ds.dailyChecklists.get(date),
      ]);
    if (!settings) return;

    const checklist = buildChecklist({
      date,
      targets: settings.targets,
      mealPlan,
      workoutLog,
      nutritionLog,
      cardioForDay: cardioAll.filter((c) => c.date === date),
      manual: extractManual(stored),
    });

    await ds.dailyChecklists.put(checklist);
    set({ checklist });
    if (date === today()) await get().refreshStreaks();
  },

  async refreshStreaks() {
    const ds = getDataSource();
    const [settings, mealPlan, checklists, workoutLogs, nutritionLogs, cardioLogs] =
      await Promise.all([
        ds.settings.get(),
        ds.mealPlans.getAll().then((p) => p[0] ?? null),
        ds.dailyChecklists.getAll(),
        ds.workoutLogs.getAll(),
        ds.nutritionLogs.getAll(),
        ds.cardioLogs.getAll(),
      ]);
    if (!settings) return;

    const streaks = computeStreaks({
      todayKey: today(),
      checklists,
      workoutLogs,
      nutritionLogs,
      cardioLogs,
      targets: settings.targets,
      mealCount: mealPlan?.meals.length ?? 0,
    });
    set({ streaks });
  },

  async toggle(key) {
    const cur = get().checklist;
    if (!cur) return;
    const ds = getDataSource();
    const existing = cur.items[key];
    const nextDone = !existing?.done;
    const items = {
      ...cur.items,
      [key]: { done: nextDone, auto: false },
    };
    const keys = Object.keys(items);
    const doneCount = keys.filter((k) => items[k].done).length;
    const next: DailyChecklist = {
      ...cur,
      items,
      completionPct: keys.length ? Math.round((doneCount / keys.length) * 100) : 0,
      fullyComplete: keys.length > 0 && doneCount === keys.length,
      updatedAt: Date.now(),
      dirty: true,
    };
    set({ checklist: next });
    await ds.dailyChecklists.put(next);
    await get().refreshStreaks();
  },
}));

/** Convenience: refresh the habit checklist after any module mutates today. */
export function notifyHabitChange(): void {
  void useHabits.getState().refresh();
}
