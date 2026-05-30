import { create } from 'zustand';
import type {
  ExerciseLog,
  SetLog,
  WorkoutDay,
  WorkoutLog,
  WorkoutPlan,
} from '@/types';
import { getDataSource } from '@/data/dataSource';
import { debounce, today } from '@/lib/utils';
import { notifyHabitChange } from './habitStore';
import { useDay } from './dayStore';
import { recordDeletion } from '@/data/sync/tombstones';

/** Last performed weight×reps for an exercise, for the "previous" ghost column. */
export interface PrevPerf {
  date: string;
  sets: { weightKg: number | null; actualReps: number | null }[];
}

interface WorkoutState {
  plan: WorkoutPlan | null;
  logs: WorkoutLog[];
  active: WorkoutLog | null;
  loaded: boolean;

  load: () => Promise<void>;
  loadDay: (date: string) => void;
  startSession: (dayId: string) => Promise<void>;
  beginTimer: () => void;
  discardDraft: () => void;
  resumeActive: () => WorkoutLog | null;
  discardActive: () => Promise<void>;
  updateSet: (exerciseId: string, setIndex: number, patch: Partial<SetLog>) => void;
  toggleSetDone: (exerciseId: string, setIndex: number) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setIndex: number) => void;
  finishSession: () => Promise<void>;
  previousFor: (exerciseId: string) => PrevPerf | null;
}

function buildSets(workingSets: number, repRange: string): SetLog[] {
  const sets: SetLog[] = [];
  // One warm-up set for resistance exercises (mobility has 0 working sets).
  if (workingSets > 0) {
    sets.push({ setIndex: 0, type: 'warmup', targetReps: repRange, actualReps: null, weightKg: null, rpe: null, done: false });
  }
  const count = workingSets > 0 ? workingSets : 1;
  const startType = workingSets > 0 ? 'working' : 'warmup';
  for (let i = 0; i < count; i += 1) {
    sets.push({
      setIndex: sets.length,
      type: startType,
      targetReps: repRange,
      actualReps: null,
      weightKg: null,
      rpe: null,
      done: false,
    });
  }
  return sets;
}

function buildSession(plan: WorkoutPlan, day: WorkoutDay, date: string): WorkoutLog {
  const exercises: ExerciseLog[] = day.exerciseIds.map((exId) => {
    const ex = plan.exercises[exId];
    return { exerciseId: exId, sets: buildSets(ex.workingSets, ex.repRange), done: false };
  });
  return {
    id: date,
    date,
    dayId: day.id,
    startedAt: null, // not timing yet — the user taps "Start" to begin the timer
    endedAt: null,
    durationSec: 0,
    exercises,
    finished: false,
    updatedAt: Date.now(),
    dirty: true,
  };
}

const persist = debounce((log: WorkoutLog) => {
  void getDataSource().workoutLogs.put(log);
}, 300);

export const useWorkout = create<WorkoutState>((set, get) => ({
  plan: null,
  logs: [],
  active: null,
  loaded: false,

  async load() {
    const ds = getDataSource();
    const [plans, logs] = await Promise.all([
      ds.workoutPlans.getAll(),
      ds.workoutLogs.getAll(),
    ]);
    const plan = plans[0] ?? null;
    const sorted = logs.sort((a, b) => b.date.localeCompare(a.date));
    set({ plan, logs: sorted, loaded: true });
    // Focus today's log by default (in-progress → resume, finished → editable).
    get().loadDay(today());
  },

  /** Point `active` at the log for the given calendar day (or null). */
  loadDay(date) {
    const log = get().logs.find((l) => l.id === date) ?? null;
    set({ active: log });
  },

  async startSession(dayId) {
    const { plan, logs } = get();
    if (!plan) return;
    const day = plan.days.find((d) => d.id === dayId);
    if (!day) return;
    const date = useDay.getState().selected;
    const existing = logs.find((l) => l.id === date);
    // Existing same-day workout → open it (resume/edit). Otherwise open a DRAFT
    // that is NOT saved yet — nothing is recorded until the user starts (presses
    // Start or checks off a set), so they can browse and back out freely.
    const session = existing && existing.dayId === dayId ? existing : buildSession(plan, day, date);
    set({ active: session });
  },

  /** Persist the draft + start the timer (first real "record" action). */
  beginTimer() {
    const { active, logs } = get();
    if (!active || active.startedAt || active.finished) return;
    const next = { ...active, startedAt: Date.now(), updatedAt: Date.now(), dirty: true };
    const others = logs.filter((l) => l.id !== next.id);
    set({ active: next, logs: [next, ...others].sort((a, b) => b.date.localeCompare(a.date)) });
    void getDataSource().workoutLogs.put(next);
  },

  resumeActive() {
    return get().active;
  },

  /** Drop an unstarted, unsaved draft (e.g. user backs out without starting). */
  discardDraft() {
    const { active } = get();
    if (active && !active.startedAt && !active.finished) set({ active: null });
  },

  async discardActive() {
    const { active } = get();
    if (!active) return;
    if (active.startedAt || active.finished) {
      await getDataSource().workoutLogs.remove(active.id);
      await recordDeletion('workoutLogs', active.id);
    }
    set({ active: null, logs: get().logs.filter((l) => l.id !== active.id) });
  },

  updateSet(exerciseId, setIndex, patch) {
    const { active } = get();
    if (!active) return;
    const exercises = active.exercises.map((ex) =>
      ex.exerciseId !== exerciseId
        ? ex
        : {
            ...ex,
            sets: ex.sets.map((s) => (s.setIndex === setIndex ? { ...s, ...patch } : s)),
          },
    );
    const next = { ...active, exercises, updatedAt: Date.now(), dirty: true };
    set({ active: next });
    if (next.startedAt) persist(next); // edits before "Start" stay in memory
  },

  toggleSetDone(exerciseId, setIndex) {
    const { active, logs } = get();
    if (!active) return;
    const exercises = active.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      const sets = ex.sets.map((s) =>
        s.setIndex === setIndex ? { ...s, done: !s.done } : s,
      );
      return { ...ex, sets, done: sets.every((s) => s.done) };
    });
    let next = { ...active, exercises, updatedAt: Date.now(), dirty: true };
    // Checking off a set is a "record" action — start (and persist) if needed.
    if (!next.startedAt && !next.finished) {
      next = { ...next, startedAt: Date.now() };
      const others = logs.filter((l) => l.id !== next.id);
      set({ active: next, logs: [next, ...others].sort((a, b) => b.date.localeCompare(a.date)) });
    } else {
      set({ active: next });
    }
    persist(next);
  },

  addSet(exerciseId) {
    const { active } = get();
    if (!active) return;
    const exercises = active.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      const last = ex.sets[ex.sets.length - 1];
      const newSet: SetLog = {
        setIndex: ex.sets.length,
        type: 'working',
        targetReps: last?.targetReps ?? '',
        actualReps: null,
        weightKg: last?.weightKg ?? null,
        rpe: null,
        done: false,
      };
      return { ...ex, sets: [...ex.sets, newSet], done: false };
    });
    const next = { ...active, exercises, updatedAt: Date.now(), dirty: true };
    set({ active: next });
    if (next.startedAt) persist(next);
  },

  removeSet(exerciseId, setIndex) {
    const { active } = get();
    if (!active) return;
    const exercises = active.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      // Drop the set and re-number the remaining ones so indices stay contiguous.
      const sets = ex.sets
        .filter((s) => s.setIndex !== setIndex)
        .map((s, i) => ({ ...s, setIndex: i }));
      return { ...ex, sets, done: sets.length > 0 && sets.every((s) => s.done) };
    });
    const next = { ...active, exercises, updatedAt: Date.now(), dirty: true };
    set({ active: next });
    if (next.startedAt) persist(next);
  },

  async finishSession() {
    const { active, logs } = get();
    if (!active) return;
    const endedAt = Date.now();
    // Compute duration only for a live, freshly-run session. Editing an already
    // finished workout (or one that was never timed) keeps its existing value.
    const durationSec =
      active.startedAt && !active.finished
        ? Math.round((endedAt - active.startedAt) / 1000)
        : active.durationSec;
    const finished: WorkoutLog = {
      ...active,
      endedAt: active.endedAt ?? endedAt,
      durationSec,
      finished: true,
      updatedAt: endedAt,
      dirty: true,
    };
    await getDataSource().workoutLogs.put(finished);
    const others = logs.filter((l) => l.id !== finished.id);
    set({
      active: finished,
      logs: [finished, ...others].sort((a, b) => b.date.localeCompare(a.date)),
    });
    notifyHabitChange();
  },

  previousFor(exerciseId) {
    const { logs, active } = get();
    // Most recent finished session BEFORE the day being edited.
    for (const log of logs) {
      if (active && log.id >= active.date) continue;
      if (!log.finished) continue;
      const ex = log.exercises.find((e) => e.exerciseId === exerciseId);
      if (ex && ex.sets.some((s) => s.weightKg != null || s.actualReps != null)) {
        return {
          date: log.date,
          sets: ex.sets.map((s) => ({ weightKg: s.weightKg, actualReps: s.actualReps })),
        };
      }
    }
    return null;
  },
}));
