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
  startSession: (dayId: string) => Promise<void>;
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
    startedAt: Date.now(),
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
    // An unfinished log == an in-progress session to recover.
    const active = logs.find((l) => !l.finished) ?? null;
    set({ plan, logs: logs.sort((a, b) => b.date.localeCompare(a.date)), active, loaded: true });
  },

  async startSession(dayId) {
    const { plan } = get();
    if (!plan) return;
    const day = plan.days.find((d) => d.id === dayId);
    if (!day) return;
    const date = today();
    const existing = await getDataSource().workoutLogs.get(date);
    // If there's already an unfinished session today, reuse it; else start fresh.
    const session = existing && !existing.finished ? existing : buildSession(plan, day, date);
    set({ active: session });
    await getDataSource().workoutLogs.put(session);
  },

  resumeActive() {
    return get().active;
  },

  async discardActive() {
    const { active } = get();
    if (!active) return;
    await getDataSource().workoutLogs.remove(active.id);
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
    persist(next);
  },

  toggleSetDone(exerciseId, setIndex) {
    const { active } = get();
    if (!active) return;
    const exercises = active.exercises.map((ex) => {
      if (ex.exerciseId !== exerciseId) return ex;
      const sets = ex.sets.map((s) =>
        s.setIndex === setIndex ? { ...s, done: !s.done } : s,
      );
      return { ...ex, sets, done: sets.every((s) => s.done) };
    });
    const next = { ...active, exercises, updatedAt: Date.now(), dirty: true };
    set({ active: next });
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
    persist(next);
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
    persist(next);
  },

  async finishSession() {
    const { active, logs } = get();
    if (!active) return;
    const endedAt = Date.now();
    const finished: WorkoutLog = {
      ...active,
      endedAt,
      durationSec: Math.round((endedAt - active.startedAt) / 1000),
      finished: true,
      updatedAt: endedAt,
      dirty: true,
    };
    await getDataSource().workoutLogs.put(finished);
    const others = logs.filter((l) => l.id !== finished.id);
    set({
      active: null,
      logs: [finished, ...others].sort((a, b) => b.date.localeCompare(a.date)),
    });
    notifyHabitChange();
  },

  previousFor(exerciseId) {
    const { logs, active } = get();
    for (const log of logs) {
      if (active && log.id === active.id) continue;
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
