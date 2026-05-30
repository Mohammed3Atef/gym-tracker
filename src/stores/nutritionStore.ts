import { create } from 'zustand';
import type { FoodItem, Macros, MealPlan, NutritionLog } from '@/types';
import { getDataSource } from '@/data/dataSource';
import { today } from '@/lib/utils';
import { notifyHabitChange } from './habitStore';

interface NutritionState {
  plan: MealPlan | null;
  log: NutritionLog | null;
  loaded: boolean;
  load: (date?: string) => Promise<void>;
  toggleMeal: (mealId: string) => Promise<void>;
  toggleSupplement: (suppId: string) => Promise<void>;
  addWater: (ml: number) => Promise<void>;
  setCreatine: (taken: boolean) => Promise<void>;
  addCustomFood: (food: FoodItem) => Promise<void>;
  removeCustomFood: (id: string) => Promise<void>;
}

/**
 * Pure macro total for a day. Exported so components compute it via useMemo —
 * never call this through a Zustand selector (it returns a new object and would
 * break useSyncExternalStore's snapshot caching).
 */
export function computeConsumed(plan: MealPlan | null, log: NutritionLog | null): Macros {
  const acc: Macros = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  if (!log) return acc;
  if (plan) {
    for (const meal of plan.meals) {
      if (!log.mealsEaten[meal.id]) continue;
      for (const item of meal.items) {
        acc.calories += item.calories;
        acc.protein += item.protein;
        acc.carbs += item.carbs;
        acc.fats += item.fats;
      }
    }
  }
  for (const f of log.customFoods) {
    acc.calories += f.calories;
    acc.protein += f.protein;
    acc.carbs += f.carbs;
    acc.fats += f.fats;
  }
  return acc;
}

function emptyLog(date: string): NutritionLog {
  return {
    id: date,
    date,
    mealsEaten: {},
    supplementsTaken: {},
    customFoods: [],
    waterMl: 0,
    creatineTaken: false,
    updatedAt: Date.now(),
    dirty: true,
  };
}

export const useNutrition = create<NutritionState>((set, get) => ({
  plan: null,
  log: null,
  loaded: false,

  async load(date = today()) {
    const ds = getDataSource();
    const [plans, log] = await Promise.all([
      ds.mealPlans.getAll(),
      ds.nutritionLogs.get(date),
    ]);
    set({ plan: plans[0] ?? null, log: log ?? emptyLog(date), loaded: true });
  },

  async toggleMeal(mealId) {
    const cur = get().log;
    if (!cur) return;
    const next: NutritionLog = {
      ...cur,
      mealsEaten: { ...cur.mealsEaten, [mealId]: !cur.mealsEaten[mealId] },
      updatedAt: Date.now(),
      dirty: true,
    };
    set({ log: next });
    await getDataSource().nutritionLogs.put(next);
    notifyHabitChange();
  },

  async toggleSupplement(suppId) {
    const cur = get().log;
    if (!cur) return;
    const next: NutritionLog = {
      ...cur,
      supplementsTaken: { ...cur.supplementsTaken, [suppId]: !cur.supplementsTaken[suppId] },
      updatedAt: Date.now(),
      dirty: true,
    };
    set({ log: next });
    await getDataSource().nutritionLogs.put(next);
    notifyHabitChange();
  },

  async addWater(ml) {
    const cur = get().log;
    if (!cur) return;
    const next: NutritionLog = {
      ...cur,
      waterMl: Math.max(0, cur.waterMl + ml),
      updatedAt: Date.now(),
      dirty: true,
    };
    set({ log: next });
    await getDataSource().nutritionLogs.put(next);
    notifyHabitChange();
  },

  async setCreatine(taken) {
    const cur = get().log;
    if (!cur) return;
    const next: NutritionLog = { ...cur, creatineTaken: taken, updatedAt: Date.now(), dirty: true };
    set({ log: next });
    await getDataSource().nutritionLogs.put(next);
    notifyHabitChange();
  },

  async addCustomFood(food) {
    const cur = get().log;
    if (!cur) return;
    const next: NutritionLog = {
      ...cur,
      customFoods: [...cur.customFoods, food],
      updatedAt: Date.now(),
      dirty: true,
    };
    set({ log: next });
    await getDataSource().nutritionLogs.put(next);
  },

  async removeCustomFood(id) {
    const cur = get().log;
    if (!cur) return;
    const next: NutritionLog = {
      ...cur,
      customFoods: cur.customFoods.filter((f) => f.id !== id),
      updatedAt: Date.now(),
      dirty: true,
    };
    set({ log: next });
    await getDataSource().nutritionLogs.put(next);
  },
}));
