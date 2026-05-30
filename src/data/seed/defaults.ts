import type { AppSettings, Reminder, UserProfile } from '@/types';

/**
 * Default local profile pre-filled from the coaching sheet so the app is usable
 * immediately on first launch. Everything is editable in Settings / Profile.
 */
export const SEED_PROFILE: UserProfile = {
  id: 'local-user',
  name: 'Mohamed Atef',
  age: 28,
  weightKg: 93.5,
  heightCm: 177,
  goal: 'recomp',
  activityLevel: 'moderate',
  locale: 'en',
  createdAt: 0,
  updatedAt: 0,
};

export const SEED_SETTINGS: AppSettings = {
  locale: 'en',
  theme: 'dark',
  restDefaultSec: 90,
  keepAwakeDuringWorkout: true,
  vibrationEnabled: true,
  notificationsEnabled: false,
  targets: {
    calories: 1815,
    protein: 158,
    carbs: 180,
    fats: 53,
    waterMl: 4000,
    steps: 10000,
    cardioMinutes: 40,
  },
  updatedAt: 0,
};

/** Sensible default reminders (disabled until the user opts in). */
export const SEED_REMINDERS: Reminder[] = [
  { id: 'rem_meal1', kind: 'meal', label: 'Meal 1 (breakfast)', time: '08:00', enabled: false, repeatDays: [] },
  { id: 'rem_meal2', kind: 'meal', label: 'Meal 2 (lunch)', time: '12:30', enabled: false, repeatDays: [] },
  { id: 'rem_meal3', kind: 'meal', label: 'Meal 3 (dinner)', time: '16:30', enabled: false, repeatDays: [] },
  { id: 'rem_meal4', kind: 'meal', label: 'Meal 4 (snack)', time: '20:00', enabled: false, repeatDays: [] },
  { id: 'rem_supps', kind: 'supplements', label: 'Vitamins after breakfast', time: '08:30', enabled: false, repeatDays: [] },
  { id: 'rem_mag', kind: 'supplements', label: 'Mag White before sleep', time: '23:15', enabled: false, repeatDays: [] },
  { id: 'rem_creatine', kind: 'creatine', label: 'Creatine', time: '17:00', enabled: false, repeatDays: [] },
  { id: 'rem_water', kind: 'water', label: 'Drink water', time: '14:00', enabled: false, repeatDays: [] },
  { id: 'rem_workout', kind: 'workout', label: 'Workout time', time: '18:00', enabled: false, repeatDays: [] },
  { id: 'rem_cardio', kind: 'cardio', label: 'Cardio / walk', time: '19:00', enabled: false, repeatDays: [] },
];
