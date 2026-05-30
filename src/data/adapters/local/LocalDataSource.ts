import type { DataSource } from '@/data/repositories';
import { LocalRepository, LocalSingleton } from './LocalRepository';
import type {
  AppSettings,
  CardioLog,
  DailyChecklist,
  MealPlan,
  NutritionLog,
  ProgressPhoto,
  Reminder,
  UserProfile,
  VideoAsset,
  WeightLog,
  WorkoutLog,
  WorkoutPlan,
} from '@/types';

/** Local-only data source — works fully offline with zero configuration. */
export class LocalDataSource implements DataSource {
  readonly kind = 'local' as const;

  profile = new LocalSingleton<UserProfile>('profile');
  settings = new LocalSingleton<AppSettings>('settings');
  workoutPlans = new LocalRepository<WorkoutPlan>('workoutPlans');
  workoutLogs = new LocalRepository<WorkoutLog>('workoutLogs');
  mealPlans = new LocalRepository<MealPlan>('mealPlans');
  nutritionLogs = new LocalRepository<NutritionLog>('nutritionLogs');
  cardioLogs = new LocalRepository<CardioLog>('cardioLogs');
  weightLogs = new LocalRepository<WeightLog>('weightLogs');
  videoAssets = new LocalRepository<VideoAsset>('videoAssets');
  progressPhotos = new LocalRepository<ProgressPhoto>('progressPhotos');
  dailyChecklists = new LocalRepository<DailyChecklist>('dailyChecklists');
  reminders = new LocalRepository<Reminder>('reminders');
}
