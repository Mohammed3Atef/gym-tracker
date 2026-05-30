import type {
  CardioLog,
  ChecklistItemState,
  DailyChecklist,
  DailyTargets,
  MealPlan,
  NutritionLog,
  StreakValue,
  Streaks,
  WorkoutLog,
} from '@/types';
import { addDays, diffDays } from '@/lib/utils';

/**
 * Pure functions that derive the daily checklist and streaks from the raw logs.
 * Keeping them pure means the checklist is always recomputable from source data
 * (no drift) and is trivially testable.
 */

export interface DayInputs {
  date: string;
  targets: DailyTargets;
  mealPlan: MealPlan | null;
  workoutLog: WorkoutLog | null;
  nutritionLog: NutritionLog | null;
  cardioForDay: CardioLog[];
  /** Manual overrides the user has toggled (key -> done). */
  manual?: Record<string, boolean>;
}

/** Builds the auto-derived checklist for a single day. */
export function buildChecklist(input: DayInputs): DailyChecklist {
  const { date, targets, mealPlan, workoutLog, nutritionLog, cardioForDay, manual } = input;
  const items: Record<string, ChecklistItemState> = {};

  const setItem = (key: string, autoDone: boolean) => {
    const manualDone = manual?.[key];
    const done = manualDone ?? autoDone;
    items[key] = { done, auto: manualDone === undefined };
  };

  // Workout: done if a finished session exists, or all working sets are done.
  const workoutDone =
    !!workoutLog &&
    (workoutLog.finished ||
      (workoutLog.exercises.length > 0 &&
        workoutLog.exercises.every((ex) => ex.sets.every((s) => s.done))));
  setItem('workout', workoutDone);

  // Each planned meal.
  if (mealPlan) {
    for (const meal of mealPlan.meals) {
      setItem(`meal:${meal.id}`, !!nutritionLog?.mealsEaten[meal.id]);
    }
    // Supplements: done when every supplement is checked.
    const supps = mealPlan.supplements;
    const allSupps =
      supps.length > 0 && supps.every((s) => nutritionLog?.supplementsTaken[s.id]);
    setItem('supplements', allSupps);
  }

  // Water target.
  setItem('water', (nutritionLog?.waterMl ?? 0) >= targets.waterMl);
  // Creatine.
  setItem('creatine', !!nutritionLog?.creatineTaken);

  // Steps + cardio aggregated from cardio logs of the day.
  const totalSteps = cardioForDay.reduce((a, c) => a + (c.steps ?? 0), 0);
  const totalCardioSec = cardioForDay.reduce((a, c) => a + c.durationSec, 0);
  setItem('steps', totalSteps >= targets.steps);
  setItem('cardio', totalCardioSec >= targets.cardioMinutes * 60);

  const keys = Object.keys(items);
  const doneCount = keys.filter((k) => items[k].done).length;
  const completionPct = keys.length ? Math.round((doneCount / keys.length) * 100) : 0;

  return {
    id: date,
    date,
    items,
    completionPct,
    fullyComplete: keys.length > 0 && doneCount === keys.length,
    updatedAt: Date.now(),
    dirty: true,
  };
}

/** Merges a freshly-built checklist with manual overrides from a stored one. */
export function extractManual(stored: DailyChecklist | null): Record<string, boolean> {
  if (!stored) return {};
  const manual: Record<string, boolean> = {};
  for (const [key, state] of Object.entries(stored.items)) {
    if (!state.auto) manual[key] = state.done;
  }
  return manual;
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

const EMPTY: StreakValue = { current: 0, longest: 0, lastDate: null };

/**
 * Computes a streak from the set of "qualifying" day keys (days where the habit
 * was met). `current` counts back from today (or yesterday) consecutively.
 */
function streakFromDays(qualifying: Set<string>, todayKey: string): StreakValue {
  if (qualifying.size === 0) return EMPTY;
  const sorted = [...qualifying].sort();
  const lastDate = sorted[sorted.length - 1];

  // longest run of consecutive days
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev && diffDays(d, prev) === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  // current run: walk back from today; allow today not-yet-done (start yesterday)
  let current = 0;
  let cursor = qualifying.has(todayKey) ? todayKey : addDays(todayKey, -1);
  while (qualifying.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, longest, lastDate };
}

export interface StreakInputs {
  todayKey: string;
  checklists: DailyChecklist[];
  workoutLogs: WorkoutLog[];
  nutritionLogs: NutritionLog[];
  cardioLogs: CardioLog[];
  targets: DailyTargets;
  mealCount: number;
}

export function computeStreaks(input: StreakInputs): Streaks {
  const { todayKey, checklists, workoutLogs, nutritionLogs, cardioLogs, targets, mealCount } =
    input;

  const workoutDays = new Set(
    workoutLogs.filter((w) => w.finished).map((w) => w.date),
  );

  const nutritionDays = new Set(
    nutritionLogs
      .filter((n) => {
        const eaten = Object.values(n.mealsEaten).filter(Boolean).length;
        return mealCount > 0 && eaten >= mealCount;
      })
      .map((n) => n.date),
  );

  const waterDays = new Set(
    nutritionLogs.filter((n) => n.waterMl >= targets.waterMl).map((n) => n.date),
  );

  const stepsByDay = new Map<string, number>();
  for (const c of cardioLogs) {
    stepsByDay.set(c.date, (stepsByDay.get(c.date) ?? 0) + (c.steps ?? 0));
  }
  const stepsDays = new Set(
    [...stepsByDay.entries()].filter(([, v]) => v >= targets.steps).map(([k]) => k),
  );

  const overallDays = new Set(
    checklists.filter((c) => c.fullyComplete).map((c) => c.date),
  );

  return {
    workout: streakFromDays(workoutDays, todayKey),
    nutrition: streakFromDays(nutritionDays, todayKey),
    water: streakFromDays(waterDays, todayKey),
    steps: streakFromDays(stepsDays, todayKey),
    overall: streakFromDays(overallDays, todayKey),
  };
}
