import localforage from 'localforage';
import { getDataSource } from './dataSource';
import { blobStore } from './blobStore';

/** All localForage object stores used by the app (kept in sync with adapters). */
const STORES = [
  'profile',
  'settings',
  'workoutPlans',
  'workoutLogs',
  'mealPlans',
  'nutritionLogs',
  'cardioLogs',
  'weightLogs',
  'videoAssets',
  'progressPhotos',
  'dailyChecklists',
  'reminders',
  'blobs',
  'meta',
];

/**
 * Wipe ALL local data (logs, plans, profile, settings, downloaded videos,
 * photos, seed marker). The next launch re-seeds the defaults from scratch.
 */
export async function clearAllLocalData(): Promise<void> {
  await Promise.all(
    STORES.map((storeName) =>
      localforage.createInstance({ name: 'gym-tracker', storeName }).clear(),
    ),
  );
}

/**
 * Delete every record logged for a single calendar day: workout, nutrition,
 * weight, cardio/steps, the daily checklist, and that day's progress photos.
 * Plans and settings are left untouched.
 */
export async function clearDayData(date: string): Promise<void> {
  const ds = getDataSource();
  await ds.workoutLogs.remove(date);
  await ds.nutritionLogs.remove(date);
  await ds.weightLogs.remove(date);
  await ds.dailyChecklists.remove(date);

  const cardio = await ds.cardioLogs.getAll();
  await Promise.all(
    cardio.filter((c) => c.date === date).map((c) => ds.cardioLogs.remove(c.id)),
  );

  const photos = await ds.progressPhotos.getAll();
  await Promise.all(
    photos
      .filter((p) => p.date === date)
      .map(async (p) => {
        await blobStore.remove(p.localKey);
        await ds.progressPhotos.remove(p.id);
      }),
  );
}
